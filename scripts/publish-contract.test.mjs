import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptedBuild, acceptedPayload, releaseCanAdvance, missingAssets } from './publish-contract.mjs';
const revision='a'.repeat(40),sha='b'.repeat(64);
const run={id:41,repository:{full_name:'nimalekyt-bit/woods-island'},head_repository:{full_name:'nimalekyt-bit/woods-island'},head_branch:'main',path:'.github/workflows/ci.yml',head_sha:revision,event:'workflow_dispatch',status:'completed',conclusion:'success'};
const job=name=>({conclusion:'success',steps:[{name,conclusion:'success'}]});
const jobs={jobs:['Build Windows executable','Sign and verify updater package','Verify installation and removal','Verify installation and removal'].map(job)};
function payload(){
 const signature=Buffer.from('trusted comment: timestamp:1\tversion:1.4.2\npublic test signature').toString('base64');
 return {version:'1.4.2',content:{version:'1.4.2',updaterNotes:'Accepted notes'},setup:{bytes:12,sha256:sha},application:{bytes:8,sha256:sha},manifest:{version:'1.4.2',installer:{name:'Woods-Island-1.4.2-windows-x64-Setup.exe',bytes:12,sha256:sha},files:[{name:'woods-island.exe',bytes:8,sha256:sha}]},updater:{version:'1.4.2',notes:'Accepted notes',platforms:{'windows-x86_64':{url:'https://github.com/nimalekyt-bit/woods-island/releases/download/v1.4.2/Woods-Island-1.4.2-windows-x64-Setup.exe',signature}}},signature,reports:['ExistingRuntime','MissingRuntime'].map(Scenario=>({Scenario,Passed:true,Commit:revision,RunId:41,Version:'1.4.2',Installer:{SHA256:sha},ExpectedExe:{SHA256:sha},VersionUpgrade:'passed-actual-previous-version'})),run};
}
test('Only the exact complete accepted main build is eligible',()=>{
 acceptedBuild(run,jobs,revision);
 for(const patch of [{head_branch:'feature/test'},{head_sha:'c'.repeat(40)},{event:'push'},{conclusion:'failure'},{path:'.github/workflows/other.yml'},{head_repository:{full_name:'fork/repo'}}])assert.throws(()=>acceptedBuild({...run,...patch},jobs,revision));
 assert.throws(()=>acceptedBuild(run,{jobs:jobs.jobs.slice(2)},revision));
});
test('Installer, executable, signature, updater and both receipts form one accepted payload',()=>{
 acceptedPayload(payload());
 for(const change of [p=>p.manifest.installer.sha256='c'.repeat(64),p=>p.application.bytes++,p=>p.updater.version='1.4.1',p=>p.updater.notes='Different notes',p=>p.updater.platforms['windows-x86_64'].url='https://other.example/setup.exe',p=>p.reports.pop(),p=>p.reports[0].RunId=42,p=>p.reports[0].Commit='c'.repeat(40),p=>p.reports[1].Passed=false,p=>p.reports[0].VersionUpgrade='not-tested']){const value=payload();change(value);assert.throws(()=>acceptedPayload(value));}
});
test('Stable release pointers never move to an older version',()=>{
 releaseCanAdvance('1.4.2',{tag_name:'v1.4.1'});releaseCanAdvance('1.4.2',{tag_name:'v1.4.2'});
 assert.throws(()=>releaseCanAdvance('1.4.2',{tag_name:'v1.5.0'}));assert.throws(()=>releaseCanAdvance('1.4.2',{tag_name:'nightly'}));
});
test('Draft retries add only missing assets; public retries are a byte-identical no-op',()=>{
 const file={name:'payload.zip',bytes:12,sha256:sha},asset={name:file.name,size:file.bytes,digest:'sha256:'+sha,state:'uploaded'};
 assert.deepEqual(missingAssets({draft:true,assets:[]},[file]),[file]);assert.deepEqual(missingAssets({draft:false,assets:[asset]},[file]),[]);
 assert.throws(()=>missingAssets({draft:false,assets:[]},[file]));assert.throws(()=>missingAssets({draft:true,assets:[{...asset,digest:'sha256:'+'c'.repeat(64)}]},[file]));
 assert.throws(()=>missingAssets({draft:true,assets:[asset,asset]},[file]));
});
