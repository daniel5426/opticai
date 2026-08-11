import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const indexFile = path.join(distDir, 'index.html');
const port = Number(process.env.PORT || 4173);

const app = express();
const supportedLocales = new Set(['he', 'en']);
const defaultLocale = 'he';
const unprefixedPaths = new Set(['/auth/callback', '/oauth/callback']);

function readLocaleCookie(cookieHeader = '') {
  const value = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('prysm_locale='))
    ?.slice('prysm_locale='.length)
    ?.toLowerCase();
  return supportedLocales.has(value) ? value : null;
}

function readAcceptedLocale(header = '') {
  for (const entry of header.split(',')) {
    const language = entry.trim().split(';')[0].toLowerCase().split('-')[0];
    if (supportedLocales.has(language)) return language;
  }
  return null;
}

function resolveLocale(req) {
  return readLocaleCookie(req.headers.cookie)
    ?? readAcceptedLocale(req.headers['accept-language'])
    ?? defaultLocale;
}

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

  if (/^\/en(?:\/|$)/.test(req.path)) {
    res.redirect(302, `/he${req.originalUrl.slice(3)}`);
    return;
  }

  if (!unprefixedPaths.has(req.path) && !/^\/he(?:\/|$)/.test(req.path)) {
    const locale = resolveLocale(req);
    res.setHeader('Vary', 'Accept-Language, Cookie');
    res.redirect(302, `/${locale}${req.originalUrl === '/' ? '/' : req.originalUrl}`);
    return;
  }

  res.sendFile(indexFile);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Prysm web server listening on port ${port}`);
});
