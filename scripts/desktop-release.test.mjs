import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const record = path.resolve('scripts/record-desktop-candidate.mjs');
const imports = path.resolve('scripts/check-desktop-runtime.mjs');
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'prysm-candidate-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'release'));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'1.2.3'}));
 return root;
}
for (const platform of ['mac','win']) test(`records ${platform} only when updater matches actual package`,t=>{
 const root=fixture(t),name=platform==='mac'?'Prysm-mac-arm64-1.2.3.zip':'Prysm-Setup-1.2.3.exe';
 const bytes=Buffer.from('test package'),sha512=crypto.createHash('sha512').update(bytes).digest('base64');
 fs.writeFileSync(path.join(root,'release',name),bytes);
 if(platform==='win')fs.writeFileSync(path.join(root,'release',name+'.blockmap'),'blockmap');
 const manifest=path.join(root,'release',platform==='mac'?'latest-mac.yml':'latest.yml');
 const yaml=`version: 1.2.3\nfiles:\n  - url: ${name}\n    sha512: ${sha512}\n    size: ${bytes.length}\n`;
 fs.writeFileSync(manifest,yaml);
 const options={cwd:root,env:{...process.env,GITHUB_SHA:'a'.repeat(40)},encoding:'utf8'};
 assert.equal(spawnSync(process.execPath,[record,platform],options).status,0);
 const receipt=JSON.parse(fs.readFileSync(path.join(root,'release/candidate.json')));
 assert.equal(receipt.sha,'a'.repeat(40));
 assert.equal(receipt.files[name].sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
 fs.writeFileSync(manifest,yaml.replace(sha512,'invalid'));
 assert.notEqual(spawnSync(process.execPath,[record,platform],options).status,0);
 if(platform==='mac') {
  fs.writeFileSync(manifest,yaml+`  - url: Prysm-mac-x64-1.2.3.zip\n    sha512: ${sha512}\n    size: ${bytes.length}\n`);
  assert.notEqual(spawnSync(process.execPath,[record,platform],options).status,0);
 }
});
test('runtime import check rejects a newly externalized renderer dependency',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'dist-electron'));
 const file=path.join(root,'dist-electron/main.js');
 fs.writeFileSync(file,'const example = "from react"; require("fs"); require("googleapis");');
 assert.equal(spawnSync(process.execPath,[imports],{cwd:root}).status,0);
 fs.writeFileSync(file,'require("react");');
 assert.notEqual(spawnSync(process.execPath,[imports],{cwd:root}).status,0);
});

import { releaseTargets } from './release-targets.mjs';
test('Windows-only selection applies only to the named release',()=>{
 assert.deepEqual(releaseTargets('1.0.99',{skipMacForVersions:['1.0.99']}),{windows:true,macos:false});
 assert.deepEqual(releaseTargets('1.0.100',{skipMacForVersions:['1.0.99']}),{windows:true,macos:true});
 assert.throws(()=>releaseTargets('1.0.99',{skipMacForVersions:'all'}));
});
