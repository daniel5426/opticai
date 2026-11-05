#!/usr/bin/env node
/** Generate explicit public release inputs without replacing a developer's installed SDK train. */
import fs from 'node:fs';
import { runtimeManifest } from './desktop-runtime.mjs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const destination = path.join(root, 'config/devdesk-release');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const local = value => /(?:127\.0\.0\.1|localhost|^file:|^link:)/.test(value || '');
const packageBytes = fs.readFileSync(path.join(root, 'package.json'));
const developmentBytes = fs.readFileSync(path.join(root, 'package-lock.json'));
const pkg = JSON.parse(packageBytes), development = JSON.parse(developmentBytes);
const mode = process.argv[2] || 'check';
const versionsPath = path.join(destination, 'versions.json');
const versionsBytes = fs.existsSync(versionsPath) ? fs.readFileSync(versionsPath) : Buffer.from('{}\n');
const versions = JSON.parse(versionsBytes);
for (const [name, version] of Object.entries(versions)) if (!pkg.dependencies?.[name] || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Release version overrides must pin an existing dependency.');
function check() {
 const receipt = JSON.parse(fs.readFileSync(path.join(destination, 'inputs.json'), 'utf8'));
 const lockBytes = fs.readFileSync(path.join(destination, 'package-lock.json'));
 if (![receipt.packageJsonHash, receipt.publicPackageJsonHash].includes(digest(packageBytes)) || ![receipt.developmentLockHash, receipt.publicLockHash].includes(digest(developmentBytes))) throw new Error('Release inputs are stale. Run node scripts/devdesk-release-inputs.mjs prepare.');
 if (receipt.publicLockHash !== digest(lockBytes)) throw new Error('Release lock integrity does not match its preparation receipt.');
 const publicPackageBytes = fs.readFileSync(path.join(destination, 'package.json'));
 if (receipt.publicPackageJsonHash !== digest(publicPackageBytes) || receipt.versionsHash !== digest(versionsBytes)) throw new Error('Release package inputs changed. Prepare them again.');
 const lock = JSON.parse(lockBytes);
 const desktopPackage = fs.readFileSync('config/desktop-runtime/package.json');
 const desktopLock = fs.readFileSync('config/desktop-runtime/package-lock.json');
 if (receipt.desktopPackageHash !== digest(desktopPackage) || receipt.desktopLockHash !== digest(desktopLock) || receipt.desktopGeneratorHash !== digest(fs.readFileSync('scripts/desktop-runtime.mjs'))) throw new Error('Desktop runtime inputs are stale. Prepare release inputs again.');
 if (JSON.stringify(JSON.parse(desktopPackage)) !== JSON.stringify(runtimeManifest(JSON.parse(publicPackageBytes), lock))) throw new Error('Desktop runtime manifest is stale.');
 for (const [name, version] of Object.entries(JSON.parse(publicPackageBytes).dependencies || {})) {
  if (!lock.packages[`node_modules/${name}`]) throw new Error(`Release lock is missing dependency: ${name}`);
  if (versions[name] && lock.packages[`node_modules/${name}`].version !== version) throw new Error(`Release SDK pin was not resolved: ${name}`);
 }
 for (const [entry, value] of Object.entries(lock.packages || {})) {
  if (local(value.resolved)) throw new Error(`Release input is not portable: ${entry}`);
  if (entry.startsWith('node_modules/@agents24/') && !entry.slice('node_modules/@agents24/'.length).includes('/')) {
   if (!value.integrity || !value.resolved?.startsWith('https://registry.npmjs.org/')) throw new Error('Agents24 release inputs must identify public integrity-pinned artifacts.');
  }
 }
 return { receipt, lockBytes, publicPackageBytes };
}
if (mode === 'prepare') {
 const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-release-inputs-'));
 try {
  const publicPackage = structuredClone(pkg);
  Object.assign(publicPackage.dependencies, versions);
  const publicPackageBytes = Buffer.from(JSON.stringify(publicPackage, null, 2) + '\n');
  fs.writeFileSync(path.join(temporary, 'package.json'), publicPackageBytes);
  const input = structuredClone(development);
  const replaced = [];
  for (const [entry, value] of Object.entries(input.packages || {})) {
   if (!local(value.resolved)) continue;
   const name = entry.split('node_modules/').at(-1);
   if (!name) throw new Error('Unsupported local dependency');
   replaced.push({ entry, name, developmentVersion: value.version, developmentIntegrity: value.integrity || null });
   delete input.packages[entry];
  }
  for (const [name, version] of Object.entries(versions)) { delete input.packages[`node_modules/${name}`]; }
  Object.assign(input.packages[''].dependencies, versions);
  fs.writeFileSync(path.join(temporary, 'package-lock.json'), JSON.stringify(input, null, 2));
  const npm = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--registry=https://registry.npmjs.org', '--userconfig=/dev/null'], { cwd: temporary, stdio: 'inherit' });
  if (npm.status !== 0) throw new Error('Public release dependency resolution failed');
  // npm may retain an incomplete transitive closure on the first metadata replacement.
  const closure = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--registry=https://registry.npmjs.org', '--userconfig=/dev/null'], { cwd: temporary, stdio: 'inherit' });
  if (closure.status !== 0) throw new Error('Public dependency closure failed');
  const validation = spawnSync('npm', ['ci', '--dry-run', '--ignore-scripts', '--no-audit', '--registry=https://registry.npmjs.org', '--userconfig=/dev/null'], { cwd: temporary, stdio: 'inherit' });
  if (validation.status !== 0) throw new Error('Generated release inputs do not support npm ci');
  const lockBytes = fs.readFileSync(path.join(temporary, 'package-lock.json'));
  const lock = JSON.parse(lockBytes);
  if (Object.values(lock.packages).some(value => local(value.resolved))) throw new Error('Public resolution retained a local registry');
  // Capture the different public identities explicitly; never pretend they are the development bytes.
  const replacements = replaced.map(value => { const entry = lock.packages[value.entry] ? value.entry : `node_modules/${value.name}`;return { ...value, publicEntry: entry, publicVersion: lock.packages[entry]?.version || null, publicIntegrity: lock.packages[entry]?.integrity || null }; });
  const desktopDir = path.join(root, 'config/desktop-runtime');
  fs.mkdirSync(desktopDir, { recursive: true });
  const desktopPackageBytes = Buffer.from(JSON.stringify(runtimeManifest(publicPackage, lock), null, 2) + '\n');
  // Seed from the reviewed public lock, preserving exact transitive versions/integrities.
  const desktopLock = structuredClone(lock);
  desktopLock.packages[''] = JSON.parse(desktopPackageBytes);
  delete desktopLock.packages[''].main;
  fs.writeFileSync(path.join(temporary, 'package.json'), desktopPackageBytes);
  fs.writeFileSync(path.join(temporary, 'package-lock.json'), JSON.stringify(desktopLock, null, 2));
  const desktopResolution = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--registry=https://registry.npmjs.org', '--userconfig=/dev/null'], { cwd: temporary, stdio: 'inherit' });
  if (desktopResolution.status !== 0) throw new Error('Desktop runtime resolution failed');
  const desktopLockBytes = fs.readFileSync(path.join(temporary, 'package-lock.json'));
  fs.writeFileSync(path.join(desktopDir, 'package.json'), desktopPackageBytes);
  fs.writeFileSync(path.join(desktopDir, 'package-lock.json'), desktopLockBytes);
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'package-lock.json'), lockBytes);
  fs.writeFileSync(path.join(destination, 'package.json'), publicPackageBytes);
  fs.writeFileSync(path.join(destination, 'inputs.json'), JSON.stringify({ desktopPackageHash: digest(desktopPackageBytes), desktopLockHash: digest(desktopLockBytes), desktopGeneratorHash: digest(fs.readFileSync('scripts/desktop-runtime.mjs')), version: 1, registry: 'https://registry.npmjs.org', packageJsonHash: digest(packageBytes), publicPackageJsonHash: digest(publicPackageBytes), versionsHash: digest(versionsBytes), versions, developmentLockHash: digest(developmentBytes), publicLockHash: digest(lockBytes), replacements }, null, 2) + '\n');
  console.log(JSON.stringify({ prepared: true, packages: replacements.length, output: 'config/devdesk-release' }));
 } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
} else if (mode === 'check') {
 const { receipt } = check();
 console.log(JSON.stringify({ ready: true, publicLockHash: receipt.publicLockHash, note: 'Public artifacts are distinct from local development bytes and must pass release-copy verification.' }));
} else if (mode === 'apply') {
 check();
 // Applying is deliberately restricted to DevDesk's isolated release copy.
 const marker = path.join(root, '.git/devdesk-release-copy');
 if (!fs.existsSync(marker) && process.env.CI_RELEASE_BUILD !== '1' && process.env.DEVDESK_RELEASE_BUILD !== '1') throw new Error('Apply release inputs only in an temporary release worktree or explicit CI/container release build.');
 const { lockBytes, publicPackageBytes } = check();
 fs.writeFileSync(path.join(root, 'package.json'), publicPackageBytes);
 fs.writeFileSync(path.join(root, 'package-lock.json'), lockBytes);
 console.log('Applied the reviewed public release lock to this build copy.');
} else throw new Error('Use prepare, check, or apply');
