import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { github, download } from './release-github.mjs';
import { assetNames, validateContent, validateReleaseIdentity, sha256 } from './release-contract.mjs';
import { selectInstallerAcceptance } from './release-acceptance.mjs';
const root=new URL('../',import.meta.url);
const version=process.argv[2];assert(/^\d+\.\d+\.\d+$/.test(version),'Usage: node scripts/finalize-release.mjs <stable-version> [--publish]');
assert.equal(execFileSync('git',['rev-parse','--is-shallow-repository'],{cwd:root,encoding:'utf8'}).trim(),'false','Full Git history is required to identify the editorial revision; fetch with --unshallow');
const content=validateContent(JSON.parse(await readFile(new URL(`releases/${version}/release.json`,root),'utf8')));
assert.equal(content.version,version);
const release=await github(`releases/tags/v${version}`);
const latest=await github('releases/latest');assert.equal(release.id,latest.id,'Only the selected stable release may receive metadata');
const source=await github('commits/'+encodeURIComponent(release.tag_name));
const current=release.assets.filter(asset=>asset.name==='website-release.json');assert(current.length<=1);
let pinnedRunId;
const selectedRunArg=process.argv.find(value=>value.startsWith('--acceptance-run-id='));
const selectedRunId=selectedRunArg?Number(selectedRunArg.slice('--acceptance-run-id='.length)):undefined;
if(selectedRunArg)assert(Number.isSafeInteger(selectedRunId)&&selectedRunId>0,'Invalid accepted run id');
if(current.length){
  assert(current[0].size<=262144 && /^sha256:[a-f0-9]{64}$/.test(current[0].digest),'Invalid published website metadata');
  const published=JSON.parse((await download(current[0].browser_download_url,{bytes:current[0].size,sha256:current[0].digest.slice(7)},true)).toString('utf8'));
  validateReleaseIdentity(published,release,source.sha);pinnedRunId=published.acceptanceRunId;
}
if(selectedRunId&&pinnedRunId)assert.equal(selectedRunId,pinnedRunId,'Published metadata pins another acceptance run');
const run=await selectInstallerAcceptance(github,source.sha,pinnedRunId||selectedRunId);
const assets={};
for(const [kind,name] of Object.entries(assetNames(version))) {
  const matches=release.assets.filter(asset=>asset.name===name);assert.equal(matches.length,1,'Missing/duplicate release asset: '+name);
  const asset=matches[0];assert(/^sha256:[a-f0-9]{64}$/.test(asset.digest),'GitHub SHA256 required');
  assets[kind]={name,bytes:asset.size,sha256:asset.digest.slice(7),url:asset.browser_download_url};
}
const contentRevision=execFileSync('git',['log','-1','--format=%H','--',`releases/${version}/release.json`],{cwd:root,encoding:'utf8'}).trim();
const committed=await github(`contents/releases/${version}/release.json?ref=${contentRevision}`);
assert.deepEqual(JSON.parse(Buffer.from(committed.content,'base64').toString('utf8')),content,'Content must already be committed and pushed');
const manifest={schemaVersion:1,releaseId:release.id,tag:release.tag_name,publishedAt:release.published_at,sourceRevision:source.sha,acceptanceRunId:run.id,contentRevision,content,assets};
validateReleaseIdentity(manifest,release,source.sha);
const small={};for(const kind of ['checksums','updater','signature'])small[kind]=await download(assets[kind].url,assets[kind],true);
const updater=JSON.parse(small.updater.toString('utf8'));assert.equal(updater.version,version);assert.equal(updater.notes,content.updaterNotes);assert.equal(updater.platforms['windows-x86_64'].url,assets.setup.url);assert.equal(updater.platforms['windows-x86_64'].signature,small.signature.toString('utf8').trim(),'Updater signature file mismatch');
const sums=new Map([...small.checksums.toString('utf8').matchAll(/^([a-f0-9]{64})\s+\*?([^\r\n]+)$/gm)].map(m=>[m[2],m[1]]));
for(const kind of ['setup','portable','updater','signature'])assert.equal(sums.get(assets[kind].name),assets[kind].sha256,'Published sums mismatch');
for(const kind of ['setup','portable'])await download(assets[kind].url,assets[kind]);
const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
assert(bytes.length<=262144,'Website metadata exceeds 256 KiB; shorten editorial content before publication');
await mkdir(new URL('dist-release-metadata/',root),{recursive:true});await writeFile(new URL('dist-release-metadata/website-release.json',root),bytes);
if(process.argv.includes('--publish')) {
  if(current.length){assert.equal(current[0].digest,'sha256:'+sha256(bytes),'Published website manifest differs; inspect before any revision');console.log('Existing website metadata verified; no changes.');}
  else {
    assert.equal((await github('releases/latest')).id,release.id,'Stable pointer changed during verification');
    const upload=release.upload_url.replace(/\{.*$/,'')+'?name=website-release.json';
    const response=await fetch(upload,{method:'POST',headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'Content-Type':'application/octet-stream','User-Agent':'Woods-release-metadata'},body:bytes,signal:AbortSignal.timeout(60000)});
    assert(response.ok,'Metadata upload failed: '+response.status);const asset=await response.json();assert.equal(asset.digest,'sha256:'+sha256(bytes));assert.equal(asset.state,'uploaded');
    console.log('Published verified website-release.json; binaries and updater were preserved.');
  }
}
console.log(`${manifest.tag}: source, accepted installer CI and all five downloadable payloads verified.`);
