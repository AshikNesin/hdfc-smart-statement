# hdfc-smart-statement

Extract the transactions table from an HDFC Bank **Smart Statement** email link as CSV — no browser, no dependencies.

## CLI

```sh
HDFC_PASSWORD=xxxx npx hdfc-smart-statement "<smart statement url>" transactions.csv
```

Omit the output file to print CSV to stdout. The password is read from the `HDFC_PASSWORD` environment variable so it stays out of shell history.

## API

```js
import { statementToCsv, fetchStatementHtml, parseTransactions } from 'hdfc-smart-statement';

const csv = await statementToCsv(url, password);
```

`parseTransactions(html)` returns `{ header, rows }` if you'd rather have arrays than CSV.

## How it works

The Smart Statement page encrypts your password in the browser with a script served by HDFC (run here in a `vm`) and returns the statement as an AES-128-ECB blob whose key is embedded in the response. This tool replays that flow and parses the "Account Statement" table. Values are kept exactly as HDFC shows them (e.g. `"2,00,000.00"`, `-` for empty).

## Caveats

- Relies on undocumented HDFC endpoints; it may break without notice.
- Unofficial and unaffiliated with HDFC Bank. Your credentials only go to the HDFC host in the link you provide.
