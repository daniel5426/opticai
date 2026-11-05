import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const isOptic = JSON.parse(fs.readFileSync(path.join(root,'package.json'), 'utf8')).name === 'opticai';
export function affected(files) {
 const result = new Set();
 for (const file of files) {
  if (/^(docs\/|(?:Start|CI|AGENTS|README)\.md$)/.test(file)) continue;
  if (isOptic && file.startsWith('backend/')) result.add('backend');
  else if (isOptic && /^(src\/|public\/|index\.html)/.test(file)) result.add('web');
  else if (!isOptic && /^(src\/|public\/|tests\/)/.test(file)) result.add('app');
  else return new Set(isOptic ? ['backend','web'] : ['app']);
 }
 return result;
}
function git(args) {
 const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});
 if(r.status!==0) return undefined;
 return r.stdout;
}
function changed(args) {
 const option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
 if(option('--files')!==undefined) return option('--files').split(',').filter(Boolean);
 let base=option('--base');
 if(args.includes('--pre-push')) {
  const lines=fs.readFileSync(0,'utf8').trim().split('\n').filter(Boolean);
  if(lines.length!==1) return ['package.json'];
  const [,local,,remote]=lines[0].split(/\s+/);
  if(/^0+$/.test(local)) return [];
  if(!/^[a-f0-9]{40}$/.test(remote)||/^0+$/.test(remote)||local!==git(['rev-parse','HEAD'])?.trim()) return ['package.json'];
  const committed=git(['diff','--name-only','-z',remote,local,'--']);
  return committed===undefined?['package.json']:committed.split('\0').filter(Boolean);
 }
 const diff=git(['diff','--name-only','-z',base||'HEAD','--']);
 const untracked=git(['ls-files','--others','--exclude-standard','-z']);
 if(diff===undefined||untracked===undefined) return ['package.json'];
 return [...new Set((diff+'\0'+untracked).split('\0').filter(Boolean))];
}
async function execute([command,...args],env={}) {
 const start=Date.now();
 const child=spawn(command,args,{cwd:root,stdio:'inherit',env:{...process.env,...env}});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
 console.log(`[check] ${command} ${args.join(' ')}: ${Date.now()-start}ms`);
 if(code!==0) throw new Error(`Check failed: ${command} ${args.join(' ')}`);
}
async function main() {
 const args=process.argv.slice(2);
 const option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
 if(args.includes('--selection-test')) {
  if(!affected(['scripts/check.mjs']).size||!affected(['package-lock.json']).size||!affected(['src/a.ts']).size||affected(['CI.md']).size) throw new Error('Unsafe component selection');
  console.log('Selection fallbacks passed');return;
 }
 if(args.includes('--release')) await execute(['node','scripts/devdesk-release-inputs.mjs','check']);
 if(args.includes('--lock-only'))return;
 const files=changed(args);
 const selection=args.includes('--full')?new Set(isOptic?['backend','web']:['app']):affected(files);
 if(args.includes('--selection')){console.log(JSON.stringify([...selection]));return;}
 if(!selection.size){console.log('Documentation-only change: no runtime checks.');return;}
 const jobs=[];
 const python=fs.existsSync(path.join(root,'backend/.venv/bin/python'))?'backend/.venv/bin/python':'python3';
 const tests=(option('--tests')||'').split(',').filter(Boolean);
 if(args.includes('--fast')) {
  if(isOptic&&selection.has('web')) {
   const related=files.filter(f=>/^src\/.*\.[cm]?[jt]sx?$/.test(f)&&fs.existsSync(path.join(root,f)));
   const shared=files.some(f=>!/^src\/|^public\//.test(f)&&!/^backend\//.test(f));
   if(shared)jobs.push(()=>execute(['npm','test','--','--run']));
   else if(related.length)jobs.push(()=>execute(['node','node_modules/vitest/vitest.mjs','related','--run',...related,'--passWithNoTests']));
  }
  if(isOptic&&selection.has('backend')) {
   const changedPython=files.filter(f=>f.startsWith('backend/')&&f.endsWith('.py')&&fs.existsSync(path.join(root,f)));
   if(changedPython.length)jobs.push(()=>execute([python,'-m','py_compile',...changedPython]));
   const focused=[...new Set([...tests,...files.filter(f=>/^backend\/tests\/.*\.py$/.test(f))])].filter(f=>fs.existsSync(path.join(root,f)));
   if(focused.length)jobs.push(()=>execute([python,'-m','pytest','-q',...focused],{PYTHONPATH:root+path.delimiter+path.join(root,'backend')}));
  }
  if(!isOptic) {
   jobs.push(()=>execute(['npm','run','typecheck']));
   const lint=files.filter(f=>/\.[cm]?[jt]sx?$/.test(f)&&fs.existsSync(path.join(root,f)));
   if(lint.length)jobs.push(()=>execute(['node','node_modules/eslint/bin/eslint.js',...lint]));
   const focused=[...new Set([...tests,...files.filter(f=>/^tests\/.*\.test\.mjs$/.test(f))])];
   if(focused.length)jobs.push(()=>execute(['node','--experimental-strip-types','--test','--test-concurrency=4',...focused]));
  }
 } else if(isOptic) {
  if(selection.has('backend'))jobs.push(()=>execute([python,'-m','pytest',...(tests.length?tests:['backend/tests/test_ai_responses.py','backend/tests/test_production_hardening.py','backend/tests/test_files_api.py','backend/tests/test_default_exam_layout_seeds.py','backend/tests/test_migration_helpers.py','backend/tests/test_softoptic_migration_service.py'])],{PYTHONPATH:root+path.delimiter+path.join(root,'backend'),DATABASE_URL:'sqlite:///:memory:',SECRET_KEY:'local-ci-check-only'}));
  if(selection.has('web')){jobs.push(()=>execute(['npm','test','--','--run']));jobs.push(()=>execute(['npm','run','build:web']));}
 } else {
  // Next build already checks TypeScript; do not repeat tsc in this path.
  for(const script of ['test','lint','build']) jobs.push(()=>execute(['npm','run',script]));
 }
 if(args.includes('--plan')){console.log(JSON.stringify({selection:[...selection],files,jobs:jobs.map(j=>j.toString()),concurrency:2}));return;}
 let cursor=0;let failed;
 await Promise.all(Array.from({length:Math.min(2,jobs.length)},async()=>{while(cursor<jobs.length&&!failed){const job=jobs[cursor++];try{await job();}catch(error){failed=error;}}}));
 if(failed)throw failed;
 if(!jobs.length)console.log('No executable changes in this selection; the agent chooses any additional focused checks from CI.md.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
