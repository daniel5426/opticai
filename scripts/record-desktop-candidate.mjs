import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const version = JSON.parse(fs.readFileSync('package.json')).version;
const platform = process.argv[2];
const names = platform === 'mac' ? [`Prysm-mac-arm64-${version}.zip`, 'latest-mac.yml'] : [`Prysm-Setup-${version}.exe`, `Prysm-Setup-${version}.exe.blockmap`, 'latest.yml'];
const updater = fs.readFileSync(path.join('release', names.at(-1)), 'utf8');
if (!updater.includes(`version: ${version}\n`)) throw new Error('Updater version mismatch');
const entries = [...updater.matchAll(/^\s+- url: ([^\r\n]+)\r?\n\s+sha512: ([^\r\n]+)\r?\n\s+size: (\d+)/gm)];
if (entries.length !== 1 || entries[0][1] !== names[0]) throw new Error('Unexpected updater files/architecture');
const bytes = fs.readFileSync(path.join('release', names[0]));
if (Number(entries[0][3]) !== bytes.length || entries[0][2] !== crypto.createHash('sha512').update(bytes).digest('base64')) throw new Error('Updater checksum/size mismatch');
const sha = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Missing candidate SHA');
const files = Object.fromEntries(names.map(name => {
 const bytes = fs.readFileSync(path.join('release', name));
 return [name, { size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }];
}));
fs.writeFileSync('release/candidate.json', JSON.stringify({ sha, version, files }, null, 2));
