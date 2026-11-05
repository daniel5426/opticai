import fs from 'node:fs';

export function releaseTargets(version, policy) {
  const skipped = policy.skipMacForVersions;
  if (!Array.isArray(skipped) || skipped.some(value => typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value))) throw new Error('Invalid version-specific desktop targets');
  return { windows: true, macos: !skipped.includes(version) };
}
if (process.argv[1]?.endsWith('/release-targets.mjs') || process.argv[1] === 'scripts/release-targets.mjs') {
  const version = JSON.parse(fs.readFileSync('package.json')).version;
  const file = 'config/release-targets.json';
  const policy = JSON.parse(fs.readFileSync(file));
  if (process.argv.includes('--windows-only')) {
    policy.skipMacForVersions = [...new Set([...policy.skipMacForVersions, version])];
    fs.writeFileSync(file, JSON.stringify(policy, null, 2) + '\n');
  }
  console.log(JSON.stringify(releaseTargets(version, policy)));
}
