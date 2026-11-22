import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,basename,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const repo='nimalekyt-bit/woods-island',version='1.3.0';
const sourceRevision='3daea921bd9ff0eeb4f49361b2e2650bc86c16fb',acceptanceRunId=44977282639;
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');assert.equal(process.env.GITHUB_REPOSITORY,repo);
assert.equal(process.env.ACCEPTANCE_RUN_ID,String(acceptanceRunId));assert.equal(process.env.SOURCE_REVISION,sourceRevision);
const source=resolve('accepted'),artifacts=resolve('dist-installer'),raw=resolve('application/woods-island.exe');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),sourceRevision);
assert.equal(JSON.parse(await readFile(join(source,'package.json'),'utf8')).version,version);
const token=process.env.GITHUB_TOKEN;assert(token);
const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Woods-Island-accepted-release'};
async function api(route,method='GET',body){
  const response=await fetch('https://api.github.com/repos/'+repo+'/'+route,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  if(!response.ok){const error=Error(`GitHub ${method} ${route}: HTTP ${response.status}`);error.status=response.status;throw error;}
  return response.status===204?null:response.json();
}
const {selectInstallerAcceptance}=await import(pathToFileURL(join(source,'scripts/release-acceptance.mjs')).href);
async function gates(){
  await selectInstallerAcceptance(api,sourceRevision,acceptanceRunId);
  assert.equal((await api('commits/main')).sha,sourceRevision,'Main source changed');
  const runs=(await api('actions/workflows/ci.yml/runs?event=push&branch=main&status=success&per_page=30')).workflow_runs;
  const main=runs.find(r=>r.head_sha===sourceRevision&&r.event==='push'&&r.head_branch==='main'&&r.status==='completed'&&r.conclusion==='success');assert(main,'Exact main push acceptance missing');
  const jobs=await api(`actions/runs/${main.id}/jobs`);
  assert(jobs.jobs.some(j=>j.conclusion==='success'&&j.steps.some(s=>s.name==='Build Windows executable'&&s.conclusion==='success')));
  return main.id;
}
const mainRunId=await gates();
async function walk(folder){const paths=[];for(const item of await readdir(folder,{withFileTypes:true})){const file=join(folder,item.name);assert(!item.isSymbolicLink());paths.push(...(item.isDirectory()?await walk(file):[file]));}return paths;}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=await walk(artifacts);
const select=name=>{const found=files.filter(p=>basename(p)===name);assert.equal(found.length,1,name);return found[0];};
const setup=`Woods-Island-${version}-windows-x64-Setup.exe`,portable=`Woods-Island-${version}-windows-x64-portable.zip`;
const names=[setup,portable,'latest.json',setup+'.sig'];
const manifest=JSON.parse(await readFile(select(`Woods-Island-${version}-windows-x64-Setup.manifest.json`),'utf8'));
assert.equal(manifest.version,version);assert.equal(manifest.generatedNsisPayloadVerified,true);assert.equal(manifest.binaryPatching,false);
assert.equal(sha(await readFile(select(setup))),manifest.installer.sha256);
const exeEntry=manifest.files.find(f=>f.name==='woods-island.exe');assert(exeEntry);
assert.equal(sha(await readFile(raw)),exeEntry.sha256,'Raw accepted EXE differs from installer manifest');
const portableRoot=resolve('verified-portable');
execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command','$ErrorActionPreference="Stop"; Expand-Archive -LiteralPath $env:WOODS_PUBLISH_ZIP -DestinationPath $env:WOODS_PUBLISH_PORTABLE'],{windowsHide:true,env:{...process.env,WOODS_PUBLISH_ZIP:select(portable),WOODS_PUBLISH_PORTABLE:portableRoot}});
const portableManifest=JSON.parse(await readFile(join(portableRoot,'manifest.json'),'utf8'));assert.equal(portableManifest.version,version);
assert.deepEqual((await walk(portableRoot)).map(p=>relative(portableRoot,p).replaceAll('\\','/')).sort(),[...portableManifest.files.map(f=>f.name),'README.txt','manifest.json'].sort());
for(const entry of portableManifest.files){assert(!entry.name.includes('..')&&!entry.name.startsWith('/')&&!entry.name.includes(':'));const bytes=await readFile(join(portableRoot,entry.name));assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);}
assert.equal(sha(await readFile(join(portableRoot,'woods-island.exe'))),exeEntry.sha256);
const update=JSON.parse(await readFile(select('latest.json'),'utf8')),signature=(await readFile(select(setup+'.sig'),'utf8')).trim();
const content=JSON.parse(await readFile(join(source,`releases/${version}/release.json`),'utf8'));
assert.equal(update.version,version);assert.equal(update.notes,content.updaterNotes);assert.equal(update.platforms['windows-x86_64'].signature,signature);
assert.equal(update.platforms['windows-x86_64'].url,`https://github.com/${repo}/releases/download/v${version}/${setup}`);
const publishDirectory=resolve('verified-payloads');await mkdir(publishDirectory);
const payloads=[];
for(const name of names){const bytes=await readFile(select(name));await writeFile(join(publishDirectory,name),bytes);payloads.push({name,bytes:bytes.length,sha256:sha(bytes)});}
const sums=payloads.map(p=>`${p.sha256}  ${p.name}\n`).join('');await writeFile(join(publishDirectory,'SHA256SUMS.txt'),sums);payloads.push({name:'SHA256SUMS.txt',bytes:Buffer.byteLength(sums),sha256:sha(sums)});
await gates();
let tag;try{tag=await api('git/ref/tags/v'+version);}catch(e){if(e.status!==404)throw e;}
if(!tag)tag=await api('git/refs','POST',{ref:'refs/tags/v'+version,sha:sourceRevision});
assert.equal((await api('commits/v'+version)).sha,sourceRevision);
let release;try{release=await api('releases/tags/v'+version);}catch(e){if(e.status!==404)throw e;}
if(!release)release=await api('releases','POST',{tag_name:'v'+version,target_commitish:sourceRevision,name:'Woods Island '+version,body:content.githubNotes,draft:true,prerelease:false});
assert(release.draft,'Release is already public; do not rewrite');assert.equal(release.prerelease,false);
for(const expected of payloads){
  const existing=release.assets.filter(a=>a.name===expected.name);assert(existing.length<=1);
  if(existing.length){assert.equal(existing[0].size,expected.bytes);assert.equal(existing[0].digest,'sha256:'+expected.sha256);continue;}
  const bytes=await readFile(join(publishDirectory,expected.name));assert.equal(sha(bytes),expected.sha256);
  const response=await fetch(`https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(expected.name)}`,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(120000)});
  assert.equal(response.status,201,'Payload upload failed');const uploaded=await response.json();assert.equal(uploaded.size,expected.bytes);assert.equal(uploaded.digest,'sha256:'+expected.sha256);
}
release=await api('releases/'+release.id);assert.deepEqual(release.assets.map(a=>a.name).sort(),payloads.map(a=>a.name).sort());
await gates();assert.equal((await api('commits/v'+version)).sha,sourceRevision);
// Leave the verified draft for the owner's final API publication. Its release event
// then triggers the existing metadata workflow without a GITHUB_TOKEN event suppression.
assert(release.draft);
const report={version,sourceRevision,acceptanceRunId,mainRunId,exeSha256:exeEntry.sha256,payloads,releaseId:release.id,url:release.html_url,draft:true,preparedAt:new Date().toISOString(),workerRevision:process.env.GITHUB_SHA};
await writeFile('release-receipt.json',JSON.stringify(report,null,2));console.log('RELEASE_RECEIPT '+JSON.stringify(report));
