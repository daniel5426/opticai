import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const isOptic = JSON.parse(fs.readFileSync('package.json', 'utf8')).name === 'opticai';
const args = process.argv.slice(2);
function execute(command, arguments_, env = {}) {
 const start = Date.now();
 const result = spawnSync(command, arguments_, {cwd: root, stdio: 'inherit', env: {...process.env, ...env}});
 console.log(`[check] ${command} ${arguments_.join(' ')}: ${Date.now()-start}ms`);
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status || 1);
}
export function affected(files) {
 const result = new Set();
 for (const file of files) {
  if (/^(docs\/|Start\.md$|CI\.md$|AGENTS\.md$)/.test(file)) continue;
  if (isOptic && file.startsWith('backend/')) result.add('backend');
  else if (isOptic && /^(src\/|public\/|index\.html)/.test(file)) result.add('web');
  else if (!isOptic && /^(src\/|public\/|tests\/)/.test(file)) result.add('app');
  else return new Set(isOptic ? ['backend','web'] : ['app']);
 }
 return result;
}
if (args.includes('--selection-test')) {
 if (affected(['scripts/check.mjs']).size === 0 || affected(['package-lock.json']).size === 0 || affected(['src/a.ts']).size === 0) throw new Error('Unsafe selection');
 console.log('Selection fallbacks passed'); process.exit();
}
if (args.includes('--release')) {
 const lock = JSON.parse(fs.readFileSync('package-lock.json','utf8'));
 const local = Object.values(lock.packages || {}).some(p => /(?:localhost|127\.0\.0\.1|file:|link:)/.test(p.resolved || ''));
 if (local) execute('node', ['scripts/devdesk-release-inputs.mjs', 'check']);
}
if (args.includes('--lock-only')) process.exit();
let base;
const index=args.indexOf('--base'); if(index>=0) base=args[index+1];
if (!base && args.includes('--pre-push')) {
 const input=fs.readFileSync(0,'utf8').trim().split('\n');
 const remote=input[0]?.split(/\s+/)[3];
 if(remote && /^[a-f0-9]{40}$/.test(remote) && !/^0+$/.test(remote)) base=remote;
}
const diff=spawnSync('git',['diff','--name-only',base || 'HEAD~1','--'],{encoding:'utf8'});
const files=diff.status===0?diff.stdout.trim().split('\n').filter(Boolean):['package.json'];
const selection=args.includes('--full') ? new Set(isOptic ? ['backend','web'] : ['app']) : affected(files);
if (!selection.size) {console.log('Documentation-only change: no runtime checks needed.'); process.exit();}
if (args.includes('--fast')) {
 if (!isOptic) execute('node',['node_modules/typescript/bin/tsc','--noEmit']);
 if (isOptic && selection.has('web')) {execute('npm',['test','--','--run']);execute('npm',['run','build:web']);}
 if (isOptic && selection.has('backend')) {
  const changed=files.filter(f=>f.startsWith('backend/') && f.endsWith('.py') && fs.existsSync(f));
  if(changed.length) execute(fs.existsSync('backend/.venv/bin/python')?'backend/.venv/bin/python':'python3',['-m','py_compile',...changed]);
 }
 const lintFiles=files.filter(f=>/\.[cm]?[jt]sx?$/.test(f)&&fs.existsSync(f));
 if(!isOptic && lintFiles.length) execute('node',['node_modules/eslint/bin/eslint.js',...lintFiles]);
} else {
 if (isOptic) {
  if(selection.has('backend')) execute(fs.existsSync('backend/.venv/bin/python')?'backend/.venv/bin/python':'python3',['-m','pytest','backend/tests/test_ai_responses.py','backend/tests/test_production_hardening.py','backend/tests/test_files_api.py','backend/tests/test_default_exam_layout_seeds.py','backend/tests/test_migration_helpers.py','backend/tests/test_softoptic_migration_service.py','backend/tests/test_softoptic_worker_compatibility.py','backend/tests/test_order_groups.py','backend/tests/test_legacy_order_compatibility.py','backend/tests/test_legacy_referral_compatibility.py'],{PYTHONPATH:root+path.delimiter+path.join(root,'backend'),DATABASE_URL:'sqlite:///:memory:',SECRET_KEY:'devdesk-isolated-check-only'});
  if(selection.has('web')) {execute('npm',['test','--','--run']);execute('npm',['run','build:web']);}
 } else {
  execute('npm',['test']);execute('npm',['run','typecheck']);execute('npm',['run','lint']);execute('npm',['run','build']);
 }
}
