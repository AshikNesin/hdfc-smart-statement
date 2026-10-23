import crypto from 'node:crypto';
import vm from 'node:vm';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const decodeEntities = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/\s+/g, ' ')
    .trim();

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Logs in to a Smart Statement link and returns the decrypted statement HTML. */
export async function fetchStatementHtml(url, password) {
  const base = new URL('.', url).href;
  const cookies = new Map();

  async function http(target, init = {}) {
    const cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(target, {
      ...init,
      headers: { 'User-Agent': UA, ...(cookie && { Cookie: cookie }), ...init.headers },
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${target}`);
    return res.text();
  }

  const loginHtml = await http(url);
  const field = (id) => loginHtml.match(new RegExp(`id=["']${id}["'][^>]*value=['"]([^'"]*)['"]`))?.[1];
  const jobkey = field('ke');
  const seqence = field('seqence');
  if (!jobkey) throw new Error('Could not find jobkey on login page (link expired?)');

  const token = (await http(`${base}CRSGetToken?jobkey=${jobkey}`)).trim();
  const ctx = vm.createContext({ Math });
  vm.runInContext(await http(`${base}js/encrypt.js`), ctx);

  const stmtHtml = await http(`${base}webresources/app/htmlformat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: url },
    body: new URLSearchParams({ ke: jobkey, seqence, pwd: ctx.encrypt(token + password) }),
  });
  const m = stmtHtml.match(/Data\("([^"]+)","([^"]+)"\)/);
  if (!m) throw new Error('Statement not returned - wrong password or expired link?');

  const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from(m[1], 'base64'), null);
  return Buffer.concat([decipher.update(Buffer.from(m[2], 'base64')), decipher.final()]).toString('utf8');
}

/** Parses the Account Statement transactions table into `{ header, rows }` (7 visible columns). */
export function parseTransactions(html) {
  const table = html.match(/<table[^>]*id="Table76"[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error('Transactions table not found in decrypted statement');
  const [header, ...rows] = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => decodeEntities(c[1])).slice(0, 7),
  );
  return { header: header.map((h, i) => (i >= 4 ? `${h} (INR)` : h)), rows };
}

export function toCsv({ header, rows }) {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Convenience: link + password in, CSV string out. */
export async function statementToCsv(url, password) {
  return toCsv(parseTransactions(await fetchStatementHtml(url, password)));
}
