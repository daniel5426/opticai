export function normalizeApiBaseUrl(rawUrl?: string): string {
  const fallback = 'http://localhost:8000/api/v1';
  if (!rawUrl) return fallback;

  try {
    const url = new URL(rawUrl);
    if (url.hostname === '0.0.0.0') {
      url.hostname = 'localhost';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawUrl.replace('://0.0.0.0', '://localhost').replace(/\/$/, '');
  }
}

