import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { repository, sha256, validateReleaseIdentity } from './release-contract.mjs';
const apiRoot = `https://api.github.com/repos/${repository}/`;
export async function github(path, options = {}) {
  assert(!path.startsWith('/') && !path.includes('..'), 'Invalid GitHub API path');
  const headers = { Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Woods-release-sync', ...(process.env.GITHUB_TOKEN ? { Authorization:`Bearer ${process.env.GITHUB_TOKEN}` } : {}), ...options.headers };
  for (let attempt=0; attempt<3; attempt++) {
    const response = await fetch(apiRoot+path, { ...options, headers, signal:AbortSignal.timeout(60000) });
    if(response.ok) return response.status===204 ? null : response.json();
    if(![429,500,502,503,504].includes(response.status) || attempt===2) throw Error(`GitHub ${path}: HTTP ${response.status}`);
    await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
  }
}
export async function download(url, expected, keep = false) {
  assert(url.startsWith(`https://github.com/${repository}/releases/download/`), 'Unexpected asset origin');
  let response;
  for(let redirects=0; redirects<6; redirects++) {
    response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(120000),headers:{'User-Agent':'Woods-release-sync'}});
    if([301,302,303,307,308].includes(response.status)) {
      const next=new URL(response.headers.get('location'),url);
      assert(next.protocol==='https:' && ['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(next.hostname), 'Untrusted asset redirect');
      url=next.href;continue;
    }
    break;
  }
  assert(response?.ok && response.body, `Download failed: HTTP ${response?.status}`);
  const hash=createHash('sha256'),chunks=[];let bytes=0;
  for await(const chunk of response.body) {
    bytes+=chunk.length;assert(bytes<=expected.bytes,'Asset exceeds expected size');hash.update(chunk);
    if(keep){assert(bytes<=262144,'Metadata asset too large');chunks.push(chunk);}
  }
  assert.equal(bytes,expected.bytes,'Truncated asset');assert.equal(hash.digest('hex'),expected.sha256,'Downloaded asset checksum mismatch');
  return keep ? Buffer.concat(chunks) : undefined;
}
export async function verifiedManifest(release, verifyBinaries = true) {
  const metadata=release.assets.filter(asset=>asset.name==='website-release.json');
  assert.equal(metadata.length,1,'Stable release has no unique website-release.json');
  assert(metadata[0].size<=262144 && /^sha256:[a-f0-9]{64}$/.test(metadata[0].digest),'Invalid website manifest asset');
  const raw=await download(metadata[0].browser_download_url,{bytes:metadata[0].size,sha256:metadata[0].digest.slice(7)},true);
  const manifest=JSON.parse(raw.toString('utf8'));
  const source=await github('commits/'+encodeURIComponent(release.tag_name));
  validateReleaseIdentity(manifest,release,source.sha);
  const acceptance=await github('actions/runs/'+manifest.acceptanceRunId);
  assert.equal(acceptance.head_sha,manifest.sourceRevision);assert.equal(acceptance.status,'completed');assert.equal(acceptance.conclusion,'success');assert.equal(acceptance.event,'workflow_dispatch');
  const editorial=await github(`contents/releases/${manifest.content.version}/release.json?ref=${manifest.contentRevision}`);
  assert.equal(editorial.type,'file');assert.equal(editorial.encoding,'base64');
  assert.deepEqual(JSON.parse(Buffer.from(editorial.content,'base64').toString('utf8')),manifest.content,'Editorial content differs from committed source');
  const sums=await download(manifest.assets.checksums.url,manifest.assets.checksums,true);
  const expectedSums=new Map([...sums.toString('utf8').matchAll(/^([a-f0-9]{64})\s+\*?([^\r\n]+)$/gm)].map(match=>[match[2],match[1]]));
  for(const kind of ['setup','portable','updater','signature']) assert.equal(expectedSums.get(manifest.assets[kind].name),manifest.assets[kind].sha256,'SHA256SUMS mismatch');
  const updater=JSON.parse((await download(manifest.assets.updater.url,manifest.assets.updater,true)).toString('utf8'));
  assert.equal(updater.version,manifest.content.version);assert.equal(updater.platforms['windows-x86_64'].url,manifest.assets.setup.url);
  assert.equal(updater.notes,manifest.content.updaterNotes,'Updater content is not synchronized');
  if(verifyBinaries)for(const kind of ['setup','portable','signature'])await download(manifest.assets[kind].url,manifest.assets[kind]);
  return {manifest, hash:sha256(raw)};
}
