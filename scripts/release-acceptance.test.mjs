import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasFullInstallerAcceptance, selectInstallerAcceptance } from './release-acceptance.mjs';
const source='1'.repeat(40);
const run=id=>({id,head_sha:source,status:'completed',conclusion:'success',event:'workflow_dispatch'});
const job=name=>({conclusion:'success',steps:[{name,conclusion:'success'}]});
const complete={jobs:['Build Windows executable','Sign and verify updater package','Verify installation and removal','Verify installation and removal'].map(job)};
test('a newer diagnostic reuse run cannot shadow an older full accepted build',async()=>{
  const calls=[];
  const github=async path=>{calls.push(path);if(path.startsWith('actions/workflows/'))return {workflow_runs:[run(3),run(2)]};return path.includes('/3/') ? {jobs:complete.jobs.slice(2)} : complete;};
  assert.equal((await selectInstallerAcceptance(github,source)).id,2);assert.equal(calls.length,3);
});
test('an existing sidecar pins its accepted run when newer full builds exist',async()=>{
  const calls=[];const github=async path=>{calls.push(path);return path==='actions/runs/2' ? run(2) : complete;};
  assert.equal((await selectInstallerAcceptance(github,source,2)).id,2);assert.equal(calls.length,2);assert(!calls.some(path=>path.startsWith('actions/workflows/')));
});
test('missing signature, skipped build, failed step and incomplete installer matrix are rejected',()=>{
  for(const mutate of [j=>j.jobs.splice(1,1),j=>j.jobs[0].conclusion='skipped',j=>j.jobs[1].steps[0].conclusion='failure',j=>j.jobs.pop()]){const jobs=structuredClone(complete);mutate(jobs);assert.equal(hasFullInstallerAcceptance(jobs),false);}
});
test('a pinned run with the wrong source or missing acceptance is never replaced silently',async()=>{
  await assert.rejects(selectInstallerAcceptance(async()=>({...run(2),head_sha:'2'.repeat(40)}),source,2));
  await assert.rejects(selectInstallerAcceptance(async path=>path==='actions/runs/2'?run(2):{jobs:[]},source,2));
});
