import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { github } from './release-github.mjs';
import { assetNames, repository, validateContent } from './release-contract.mjs';
import { acceptedBuild, acceptedPayload, releaseCanAdvance, missingAssets } from './publish-contract.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const version=process.env.PUBLISH_VERSION,runId=Number(process.env.ACCEPTED_RUN_ID);
assert(/^\d+\.\d+\.\d+$/.test(version||''),'Choose a stable release version');
assert(Number.isSafeInteger(runId)&&runId>0,'Choose an accepted full CI run');
const args=process.argv.slice(2);
assert(args.length===1&&['--inspect','--prepare','--publish'].includes(args[0]),'Choose inspect, prepare or publish');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const gh=(...args)=>execFileSync(process.env.WOODS_GH_PATH||'gh',args,{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN}});
async function optional(path){try{return await github(path);}catch(error){if(/HTTP 404$/.test(error.message))return null;throw error;}}
const run=await github(`actions/runs/${runId}`),jobs=await github(`actions/runs/${runId}/jobs?filter=latest&per_page=100`);
acceptedBuild(run,jobs,run.head_sha);
if(args[0]==='--inspect'){
  const pkg=await github(`contents/package.json?ref=${run.head_sha}`);
  assert.equal(JSON.parse(Buffer.from(pkg.content,'base64')).version,version,'Selected build has another version');
  if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,`source_revision=${run.head_sha}\n`,{flag:'a'});
  console.log(`Selected full accepted build ${runId} at ${run.head_sha}`);
  process.exit(0);
}
assert.equal(git('rev-parse','HEAD'),run.head_sha,'Checkout must be the accepted build source');
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert.equal(pkg.version,version);
const content=validateContent(JSON.parse(await readFile(join(root,'releases',version,'release.json'),'utf8')));
const directory=join(root,'dist-publish');await mkdir(directory,{recursive:true});
async function files(path){
  const result=[];
  for(const entry of await readdir(path,{withFileTypes:true})){
    assert(!entry.isSymbolicLink(),'Publication input must not contain symlinks');
    if(entry.isDirectory())result.push(...await files(join(path,entry.name)));
    else if(entry.isFile())result.push(join(path,entry.name));
  }
  return result;
}
const found=await files(join(directory,'accepted'));
const unique=name=>{const matches=found.filter(path=>basename(path)===name);assert.equal(matches.length,1,'Missing/duplicate accepted file: '+name);return matches[0];};
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
async function proof(path){const value=await readFile(path);return {path,name:basename(path),bytes:value.length,sha256:createHash('sha256').update(value).digest('hex')};}
const names=assetNames(version),setup=await proof(unique(names.setup)),portable=await proof(unique(names.portable)),application=await proof(unique('woods-island.exe'));
const manifest=await json(unique(names.setup.replace(/\.exe$/,'.manifest.json'))),updater=await json(unique(names.updater)),signatureFile=await proof(unique(names.signature)),signature=await readFile(signatureFile.path,'utf8');
const reports=[];for(const file of found.filter(path=>basename(path)==='installer-acceptance.json'))reports.push(await json(file));
acceptedPayload({version,content,setup,application,manifest,updater,signature,reports,run});
const unpacked=await files(join(directory,'portable'));
const portableExe=unpacked.filter(path=>basename(path)==='woods-island.exe');assert.equal(portableExe.length,1);
const portableProof=await proof(portableExe[0]);assert.equal(portableProof.sha256,application.sha256,'Portable and installer must use the same accepted application');
const portableManifests=unpacked.filter(path=>basename(path)==='manifest.json');assert.equal(portableManifests.length,1);
const portableManifest=await json(portableManifests[0]);assert.equal(portableManifest.version,version);
const portableApp=portableManifest.files.filter(file=>file.name==='woods-island.exe');assert.equal(portableApp.length,1);assert.equal(portableApp[0].sha256,application.sha256);
const updaterFile=await proof(unique(names.updater));
const payloads=[setup,portable,updaterFile,signatureFile];
await writeFile(join(directory,names.checksums),payloads.map(file=>`${file.sha256}  ${file.name}\n`).join(''));
payloads.push(await proof(join(directory,names.checksums)));
await writeFile(join(directory,'github-notes.md'),content.githubNotes);
await writeFile(join(directory,'publication-proof.json'),JSON.stringify({version,sourceRevision:run.head_sha,acceptanceRunId:runId,payloads:payloads.map(({path,...value})=>value),application:{bytes:application.bytes,sha256:application.sha256}},null,2)+'\n');
const initialLatest=await optional('releases/latest');releaseCanAdvance(version,initialLatest);
const tag=`v${version}`,existingCommit=await optional('commits/'+encodeURIComponent(tag));
if(existingCommit)assert.equal(existingCommit.sha,run.head_sha,'Existing tag points to another source');
let release=await optional('releases/tags/'+encodeURIComponent(tag));
function validateExisting(value){
  assert.equal(value.tag_name,tag);assert.equal(value.prerelease,false);
  assert.equal((value.body||'').replaceAll('\r\n','\n').trimEnd(),content.githubNotes.replaceAll('\r\n','\n').trimEnd(),'Existing release notes differ from the accepted source');
  if(!existingCommit)assert.equal(value.target_commitish,run.head_sha,'Draft points to another source');
  if(!value.draft)assert.equal(initialLatest?.id,value.id,'Only the current stable release can be resumed');
  missingAssets(value,payloads);
}
if(release)validateExisting(release);
console.log(`Prepared ${payloads.length} payloads from accepted run ${runId}; no build or signing repeated`);
if(args[0]!=='--publish')process.exit(0);
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&process.env.GITHUB_REPOSITORY===repository,'Publication runs only in the manually requested hosted workflow');
if(!release){
  gh('release','create',tag,'--repo',repository,'--draft','--target',run.head_sha,'--title',`Woods Island ${version}`,'--notes-file',join(directory,'github-notes.md'));
  release=await github('releases/tags/'+encodeURIComponent(tag));
}
validateExisting(release);
for(const file of missingAssets(release,payloads))gh('release','upload',tag,file.path,'--repo',repository);
release=await github('releases/tags/'+encodeURIComponent(tag));assert.equal(missingAssets(release,payloads).length,0);
if(release.draft){
  assert.equal((await optional('releases/latest'))?.id,initialLatest?.id,'Stable release changed during publication');
  gh('release','edit',tag,'--repo',repository,'--draft=false','--latest');
}
const final=await github('releases/tags/'+encodeURIComponent(tag));assert.equal(final.draft,false);assert.equal((await github('releases/latest')).id,final.id);
execFileSync(process.execPath,[join(root,'scripts/finalize-release.mjs'),version,'--publish',`--acceptance-run-id=${runId}`],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
console.log(`${tag}: accepted payloads published and website metadata verified`);
