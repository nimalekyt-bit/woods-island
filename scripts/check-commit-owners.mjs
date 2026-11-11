import { execFileSync } from 'node:child_process';

const allowed = new Set(['nimalekyt@gmail.com', '272979364+nimalekyt-bit@users.noreply.github.com']);
const ref = process.argv[2] || 'HEAD';
const commits = execFileSync('git', ['log', '--format=%H%x09%ae%x09%ce', ref], {encoding:'utf8'}).trim().split('\n');
for (const line of commits) {
  const [sha, author, committer] = line.trim().split('\t');
  if (!allowed.has(author?.toLowerCase()) || !allowed.has(committer?.toLowerCase())) {
    throw new Error(`Commit ${sha} must belong to nimalekyt-bit (author and committer)`);
  }
}
const bodies = execFileSync('git', ['log', '--format=%B', ref], {encoding:'utf8'});
if (/^co-authored-by\s*:/im.test(bodies)) throw new Error('Co-authored-by trailers are not allowed in this repository');
console.log(`Verified ${commits.length} commits: only nimalekyt-bit`);
