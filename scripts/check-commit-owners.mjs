import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const allowed = new Set(['449409218cdcc35d0bc26a132ccb10cd95ecde53a9f5a976c7a393a782c52a7d', '449409218cdcc35d0bc26a132ccb10cd95ecde53a9f5a976c7a393a782c52a7d']);
const emailHash = value => createHash('sha256').update(value?.toLowerCase() || '').digest('hex');
const ref = process.argv[2] || 'HEAD';
const commits = execFileSync('git', ['log', '--format=%H%x09%ae%x09%ce', ref], {encoding:'utf8'}).trim().split('\n');
for (const line of commits) {
  const [sha, author, committer] = line.trim().split('\t');
  if (!allowed.has(emailHash(author)) || !allowed.has(emailHash(committer))) {
    throw new Error(`Commit ${sha} must belong to nimalekyt-bit (author and committer)`);
  }
}
const bodies = execFileSync('git', ['log', '--format=%B', ref], {encoding:'utf8'});
if (/^co-authored-by\s*:/im.test(bodies)) throw new Error('Co-authored-by trailers are not allowed in this repository');
console.log(`Verified ${commits.length} commits: only nimalekyt-bit`);
