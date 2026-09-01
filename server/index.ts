import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { getAdminFirebase } from './lib/firebase.js';
import { seedAdmin } from './lib/seedAdmin.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { accountRouter } from './routes/account.js';
import { adminRouter } from './routes/admin.js';
import { applicationsRouter } from './routes/applications.js';
import { contractsRouter } from './routes/contracts.js';
import { healthRouter } from './routes/health.js';
import { profilesRouter } from './routes/profiles.js';
import { relationshipsRouter } from './routes/relationships.js';
import { supportRouter } from './routes/support.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function resolveRepoRoot(startDir: string): string {
  for (const candidate of [
    path.resolve(startDir, '..'),
    path.resolve(startDir, '../..'),
  ]) {
    if (existsSync(path.join(candidate, 'client/dist'))) {
      return candidate;
    }
  }

  return path.resolve(startDir, '..');
}

const repoRoot = resolveRepoRoot(here);

dotenv.config({ path: path.join(repoRoot, '.env') });

const port = Number(process.env.PORT ?? 3001);
const clientDist = path.join(repoRoot, 'client/dist');
const hasClientBuild = existsSync(clientDist);
const clientOrigin =
  process.env.CLIENT_ORIGIN ??
  (process.env.NODE_ENV === 'production' ? true : 'http://localhost:5173');

const firebase = getAdminFirebase();

const app = express();

app.use(
  cors({
    origin: clientOrigin,
  }),
);
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/account', accountRouter);
app.use('/api/admin', adminRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/support', supportRouter);
app.use('/api', notFound);

if (hasClientBuild) {
  app.use(express.static(clientDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn('client/dist is missing. Run `npm run build` so Express can serve the app.');
}

app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
  console.log(`ApprentorBay API listening on http://0.0.0.0:${port}`);
  console.log(hasClientBuild ? `Serving client from ${clientDist}` : 'API only (client/dist not found)');
  console.log(
    `Firebase Admin: ${
      firebase.initialized
        ? firebase.emulator
          ? 'initialized (emulator)'
          : 'initialized'
        : firebase.configured
          ? 'configured but not initialized'
          : 'not configured (placeholders only)'
    }`,
  );
  void seedAdmin();
});
