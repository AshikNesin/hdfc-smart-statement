#!/usr/bin/env node
import fs from 'node:fs';
import { statementToCsv } from '../src/index.js';

const [url, outFile] = process.argv.slice(2);
const password = process.env.HDFC_PASSWORD;
if (!url || !password) {
  console.error('Usage: HDFC_PASSWORD=xxxx hdfc-smart-statement "<smart statement url>" [out.csv]');
  console.error('Writes CSV to stdout when no output file is given.');
  process.exit(1);
}

try {
  const csv = await statementToCsv(url, password);
  if (outFile) {
    fs.writeFileSync(outFile, csv);
    console.error(`Wrote ${csv.trimEnd().split('\n').length - 1} transactions to ${outFile}`);
  } else {
    process.stdout.write(csv);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
