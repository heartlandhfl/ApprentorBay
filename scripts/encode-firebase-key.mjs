#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/encode-firebase-key.mjs path/to/serviceAccount.json');
  process.exit(1);
}

const json = readFileSync(file, 'utf8');
const parsed = JSON.parse(json);
if (!parsed.private_key || !parsed.client_email) {
  console.error('That file is not a Firebase service-account JSON (missing private_key or client_email).');
  process.exit(1);
}
console.log('Set this Hostinger env var, then Redeploy (no quotes around the value):');
console.log('');
console.log('FIREBASE_SERVICE_ACCOUNT_BASE64');
console.log(Buffer.from(json, 'utf8').toString('base64'));
