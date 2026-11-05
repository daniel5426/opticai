import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import fs from 'node:fs';
const expectedVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const app = await _electron.launch({ executablePath: 'release/mac-arm64/Prysm.app/Contents/MacOS/Prysm', timeout: 60000 });
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
  await window.screenshot({ path: 'release/mac-smoke.png' });
  console.log(`Packaged macOS ${version}: renderer, external modules and native SQLite passed`);
} catch (error) {
  console.error(error);
  throw error;
} finally {
  // This fresh CI profile has no user session; bypass interactive quit/logout guards.
  app.process().kill('SIGKILL');
}
