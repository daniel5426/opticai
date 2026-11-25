import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron } from 'playwright';
import fs from 'node:fs';
const expectedVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const windows = process.platform === 'win32';
const executablePath = windows ? 'release/win-unpacked/Prysm.exe' : 'release/mac-arm64/Prysm.app/Contents/MacOS/Prysm';
const app = await _electron.launch({ executablePath, timeout: 60000 });
let exitCode = 0;
try {
  const window = await app.firstWindow({ timeout: 30000 });
  console.log('Packaged main window opened');
  await window.locator('#app > *').first().waitFor({ timeout: 30000 });
  console.log('Packaged renderer mounted');
  const version = await Promise.race([app.evaluate(async ({ app }) => {
    const { createRequire } = process.getBuiltinModule('node:module');
    const require = createRequire(`${app.getAppPath()}/package.json`);
    for (const name of ['cors', 'express', 'googleapis']) require(name);
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.prepare('SELECT 1').get();
    db.close();
    return app.getVersion();
  }), new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('Packaged runtime evaluation timed out')), 30000);
    timer.unref();
  })]);
  assert.equal(version, expectedVersion);
  if (!windows) await window.screenshot({ path: 'release/mac-smoke.png' });
  console.log(`Packaged ${windows ? 'Windows' : 'macOS'} ${version}: renderer, external modules and native SQLite passed`);

  const printing = await app.evaluate(async ({ app, BrowserWindow }) => {
    const source = BrowserWindow.getAllWindows()[0].webContents;
    const getPrinters = source.getPrintersAsync;
    let available = true;
    let accepted = true;
    const jobs = [];
    source.getPrintersAsync = async () => available ? [{ name: 'Synthetic_Default', isDefault: true }] : [];
    const observePrint = (_event, printWindow) => {
      printWindow.webContents.print = (options, callback) => {
        jobs.push({ visible: printWindow.isVisible(), silent: options.silent, deviceName: options.deviceName });
        callback(accepted, accepted ? '' : 'Synthetic printer rejected the job');
      };
    };
    app.on('browser-window-created', observePrint);
    try {
      const request = () => source.executeJavaScript(
        'window.electronAPI.printHtmlSilently("<!doctype html><p>Packaged printing smoke</p>")',
      );
      const success = await request();
      accepted = false;
      const rejected = await request();
      available = false;
      const unavailable = await request();
      return { success, rejected, unavailable, jobs };
    } finally {
      app.removeListener('browser-window-created', observePrint);
      source.getPrintersAsync = getPrinters;
    }
  });
  assert.deepEqual(printing, {
    success: true,
    rejected: false,
    unavailable: false,
    jobs: Array.from({ length: 2 }, () => ({ visible: false, silent: true, deviceName: 'Synthetic_Default' })),
  });
  console.log('Packaged app sent a synthetic job to the default printer and reported rejection or missing printer for fallback.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  // Exit Electron itself so the Windows renderer and inspector can close cleanly.
  const child = app.process();
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    void app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await Promise.race([exited, delay(5000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}
process.exit(exitCode);
