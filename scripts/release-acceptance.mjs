import assert from 'node:assert/strict';
export function hasFullInstallerAcceptance(jobs) {
  const successful=jobs.jobs.filter(job=>job.conclusion==='success');
  const passed=name=>successful.some(job=>job.steps.some(step=>step.name===name && step.conclusion==='success'));
  return passed('Build Windows executable') && passed('Sign and verify updater package') && successful.filter(job=>job.steps.some(step=>step.name==='Verify installation and removal' && step.conclusion==='success')).length===2;
}
export async function selectInstallerAcceptance(github, sourceRevision, pinnedRunId) {
  const candidates=pinnedRunId ? [await github(`actions/runs/${pinnedRunId}`)] : (await github('actions/workflows/ci.yml/runs?event=workflow_dispatch&status=success&per_page=100')).workflow_runs;
  for(const run of candidates) {
    if(run.head_sha!==sourceRevision || run.status!=='completed' || run.conclusion!=='success' || run.event!=='workflow_dispatch')continue;
    const jobs=await github(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
    if(hasFullInstallerAcceptance(jobs))return run;
  }
  assert.fail('No accepted full installer workflow for this exact release revision');
}
