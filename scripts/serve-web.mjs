import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const indexFile = path.join(distDir, 'index.html');
const port = Number(process.env.PORT || 4173);

const app = express();

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.use(
  express.static(distDir, {
    index: false,
    maxAge: '1h',
  }),
);

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  res.sendFile(indexFile);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Prysm web server listening on port ${port}`);
});
