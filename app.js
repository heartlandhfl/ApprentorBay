'use strict';

/**
 * Production / Hostinger entry.
 *
 * Deploy this repo as an Express Node.js web app (entry file: app.js).
 * Do not use the Vite/static preset — that only uploads client/dist and
 * leaves /api/health and every other API route as a Hostinger 404.
 */

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const entry = path.join(__dirname, 'server', 'dist', 'index.js');

if (!fs.existsSync(entry)) {
  console.error('Missing server/dist/index.js. Hostinger must run `npm run build` before start.');
  process.exit(1);
}

import(pathToFileURL(entry).href).catch((error) => {
  console.error(error);
  process.exit(1);
});
