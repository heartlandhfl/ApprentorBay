'use strict';

/**
 * Hostinger / production entry.
 * Prefer the bundled Express build (dist/server.js). Fall back to the
 * workspace compile, then to a tiny health server so /api/health can
 * explain the crash instead of Hostinger's generic 503 page.
 */

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function listenPort() {
  const parsed = Number(process.env.PORT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3001;
}

function startFallback(message) {
  const text = message instanceof Error ? message.stack || message.message : String(message);
  console.error(text);
  const port = listenPort();
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/api/')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          service: 'apprentorbay-api',
          error: text.split('\n')[0],
          hint: 'Open Hostinger Runtime Logs. Entry file should be dist/server.js (or app.js).',
        }),
      );
      return;
    }
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><html><head><meta charset="utf-8"><title>ApprentorBay</title></head><body><h1>App failed to start</h1><pre>${text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</pre></body></html>`,
    );
  });
  server.listen(port, '0.0.0.0', () => {
    console.error(`Fallback listening on 0.0.0.0:${port}`);
  });
}

const bundled = path.join(__dirname, 'dist', 'server.js');
const compiled = path.join(__dirname, 'server', 'dist', 'index.js');
const entry = [bundled, compiled].find((file) => fs.existsSync(file));

if (!entry) {
  startFallback(
    'Missing dist/server.js. Hostinger must run `npm run build` and use entry file dist/server.js or app.js.',
  );
} else {
  import(pathToFileURL(entry).href).catch((error) => {
    startFallback(error);
  });
}
