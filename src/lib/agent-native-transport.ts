import { normalizeApiBaseUrl } from '@/services/api-base-url';
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

declare const __PRYSM_AGENT_API_URL__: string;

type Request = { id: string; path: string; method: string; headers: Record<string, string>; body?: number[] };
const allowed = /^\/api\/(agents24(?:\/|$)|v1\/agent(?:\/|$))/;

function safePath(path: string) {
  if (!allowed.test(path) || /[\\\r\n\0#]/.test(path)) return false;
  try {
    return path.split('?')[0].split('/').every(segment => {
      const decoded = decodeURIComponent(segment);
      return decoded !== '.' && decoded !== '..' && !/[\\/\r\n\0%]/.test(decoded);
    });
  } catch { return false; }
}

/** Native authenticated BFF transport; no arbitrary URLs, organization keys, or provider calls. */
export function installAgentTransport(window: BrowserWindow) {
  const pending = new Map<string, AbortController>();
  const acknowledgements = new Map<string, () => void>();
  const authorize = (event: IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Denied');
  };
  ipcMain.removeAllListeners('prysm-agent-ack');
  ipcMain.on('prysm-agent-ack', (event, id: string) => {
    if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame) acknowledgements.get(id)?.();
  });
  ipcMain.removeHandler('prysm-agent-fetch');
  ipcMain.removeHandler('prysm-agent-abort');
  ipcMain.handle('prysm-agent-abort', (event, id: string) => { authorize(event); pending.get(id)?.abort(); });
  ipcMain.handle('prysm-agent-fetch', async (event, request: Request) => {
    authorize(event);
    if (pending.size >= 64 || !safePath(request.path) || !/^[a-zA-Z0-9-]{36}$/.test(request.id) || pending.has(request.id) ||
        !['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method) || (request.body?.length || 0) > 26 * 1024 * 1024) throw new Error('Invalid agent request');
    const configured = new URL(normalizeApiBaseUrl(__PRYSM_AGENT_API_URL__));
    const url = new URL(request.path, configured.origin);
    if (url.origin !== configured.origin || !allowed.test(url.pathname)) throw new Error('Denied');
    const abort = new AbortController();
    pending.set(request.id, abort);
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (/^(authorization|content-type|accept|idempotency-key|x-prysm-clinic-id|x-prysm-client-id)$/i.test(key)) headers.set(key, value);
    }
    try {
      const response = await fetch(url, { method: request.method, headers,
        body: request.body ? new Uint8Array(request.body) : undefined, redirect: 'error', signal: abort.signal });
      const reader = response.body?.getReader();
      void (async () => {
        try {
          if (reader) while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (window.isDestroyed()) { abort.abort(); break; }
            const acknowledgement = new Promise<void>((resolve, reject) => {
              const fail = () => { cleanup(); reject(new Error('Aborted')); };
              const timer = setTimeout(fail, 60000);
              const cleanup = () => { clearTimeout(timer); acknowledgements.delete(request.id); abort.signal.removeEventListener('abort', fail); };
              acknowledgements.set(request.id, () => { cleanup(); resolve(); });
              abort.signal.addEventListener('abort', fail, { once: true });
            });
            window.webContents.send(`prysm-agent-chunk:${request.id}`, Array.from(value));
            await acknowledgement;
          }
          if (!window.isDestroyed()) window.webContents.send(`prysm-agent-end:${request.id}`, null);
        } catch {
          if (!window.isDestroyed()) window.webContents.send(`prysm-agent-end:${request.id}`, 'agent.operationFailed');
        } finally { acknowledgements.delete(request.id); pending.delete(request.id); }
      })();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => { responseHeaders[key] = value; });
      return { status: response.status, headers: responseHeaders };
    } catch { pending.delete(request.id); throw new Error('agent.operationFailed'); }
  });
  window.once('closed', () => { for (const abort of pending.values()) abort.abort(); pending.clear(); });
}
