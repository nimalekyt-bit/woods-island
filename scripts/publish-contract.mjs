import assert from 'node:assert/strict';
import { assetNames, repository } from './release-contract.mjs';
import { hasFullInstallerAcceptance } from './release-acceptance.mjs';

export function acceptedBuild(run, jobs, revision) {
  assert(/^[a-f0-9]{40}$/.test(revision), 'Invalid release source revision');
  assert.equal(run.repository?.full_name, repository, 'Build belongs to another repository');
  assert.equal(run.head_repository?.full_name, repository, 'Fork builds cannot be published');
  assert.equal(run.head_branch, 'main', 'Only accepted main builds can be published');
  assert.equal(run.path, '.github/workflows/ci.yml', 'Wrong build workflow');
  assert.equal(run.head_sha, revision, 'Build source differs from the selected checkout');
  assert.equal(run.event, 'workflow_dispatch', 'A complete installer run is required');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert(hasFullInstallerAcceptance(jobs), 'Build, signature and both installer scenarios must pass');
  return run;
}

export function acceptedPayload({version, content, setup, application, manifest, updater, signature, reports, run}) {
  const names=assetNames(version);
  assert.equal(content.version, version); assert.equal(manifest.version, version);
  assert.equal(manifest.installer.name, names.setup);
  assert.equal(manifest.installer.sha256, setup.sha256);
  assert.equal(manifest.installer.bytes, setup.bytes);
  const executables=manifest.files.filter(file=>file.name==='woods-island.exe');
  assert.equal(executables.length,1,'Ambiguous installer executable');
  assert.equal(executables[0].sha256,application.sha256); assert.equal(executables[0].bytes,application.bytes);
  assert.equal(updater.version,version); assert.equal(updater.notes,content.updaterNotes);
  assert.equal(updater.platforms?.['windows-x86_64']?.url,`https://github.com/${repository}/releases/download/v${version}/${names.setup}`);
  assert.equal(updater.platforms['windows-x86_64'].signature,signature.trim());
  assert(Buffer.from(signature.trim(),'base64').toString('utf8').split(/\r?\n/).some(line=>line.startsWith('trusted comment:')&&line.split('\t').includes(`version:${version}`)),'Signature is not bound to this version');
  assert.equal(reports.length,2,'Both installer reports are required');
  assert.deepEqual(reports.map(report=>report.Scenario).sort(),['ExistingRuntime','MissingRuntime']);
  for(const report of reports){
    assert.equal(report.Passed,true,'Installer acceptance failed'); assert.equal(report.Commit,run.head_sha);
    assert.equal(String(report.RunId),String(run.id),'Acceptance report comes from another run');
    assert.equal(report.Version,version); assert.equal(report.Installer.SHA256.toLowerCase(),setup.sha256);
    assert.equal(report.ExpectedExe.SHA256.toLowerCase(),application.sha256);
    if(report.Scenario==='ExistingRuntime')assert.equal(report.VersionUpgrade,'passed-actual-previous-version','The actual previous installer upgrade must pass');
  }
}

function versionParts(tag){assert(/^v\d+\.\d+\.\d+$/.test(tag),'Invalid stable release tag');return tag.slice(1).split('.').map(BigInt);}
export function releaseCanAdvance(version, latest) {
  if(!latest)return;
  const selected=versionParts('v'+version),current=versionParts(latest.tag_name);
  for(let index=0;index<3;index++){
    if(selected[index]>current[index])return;
    if(selected[index]<current[index])assert.fail('A newer stable release already exists');
  }
}

/** Existing accepted assets are reused; an upload never replaces different bytes. */
export function missingAssets(release, payloads) {
  const missing=[];
  for(const file of payloads){
    const matches=release.assets.filter(asset=>asset.name===file.name);
    assert(matches.length<=1,'Duplicate release asset: '+file.name);
    if(!matches.length){missing.push(file);continue;}
    assert.equal(matches[0].state,'uploaded'); assert.equal(matches[0].size,file.bytes);
    assert.equal(matches[0].digest,'sha256:'+file.sha256,'Release already contains different bytes: '+file.name);
  }
  if(!release.draft)assert.equal(missing.length,0,'A published release must already contain every accepted payload');
  return missing;
}
