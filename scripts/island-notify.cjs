// Woods Island bridge. No shell execution and no network requests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const argv = process.argv.slice(2);
const flag = name => { const index = argv.indexOf(name); return index < 0 ? undefined : argv[index + 1]; };
const provider = flag('--provider') || 'codex';
const event = flag('--event') || 'agent-turn-complete';
const dataDirectory = process.env.WOODS_ISLAND_DATA_DIR || path.join(process.env.APPDATA || process.env.TEMP || '.', 'woods-island');
const events = path.join(dataDirectory, 'agents');
const answers = path.join(events, 'answers');

function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, file);
}
function readPayload() {
  const last = argv[argv.length - 1];
  if (last && /^[\s]*\{/.test(last)) return JSON.parse(last);
  const stdin = fs.readFileSync(0, 'utf8');
  return stdin.trim() ? JSON.parse(stdin) : {};
}
function projectName(cwd) { return cwd ? path.win32.basename(cwd.replaceAll('/', '\\')) : ''; }
function text(value) { return typeof value === 'string' ? value.slice(0, 180) : ''; }
function agentRecord(payload, source = provider, hook = event) {
  const at = Date.now();
  const session = payload.session_id || payload['thread-id'] || payload.sessionID || 'default';
  const id = crypto.createHash('sha256').update(`${source}:${session}`).digest('hex').slice(0, 32);
  const waiting = hook === 'PermissionRequest' || (hook === 'Notification' && payload.notification_type === 'permission_prompt') || hook === 'permission.asked';
  const done = ['Stop','agent-turn-complete','session.idle','SessionEnd'].includes(hook) || (hook === 'session.status' && payload.status?.type === 'idle');
  return {
    id, agent: source, state: done ? 'done' : waiting ? 'waiting' : 'working',
    project: projectName(payload.cwd || payload.directory),
    message: text(payload.message || payload['last-assistant-message'] || payload.tool_name), at,
  };
}
function islandRunning() {
  try { const age = Date.now() - JSON.parse(fs.readFileSync(path.join(events, 'heartbeat.json'), 'utf8')).at; return age >= 0 && age < 5000; }
  catch { return false; }
}
function emit(payload, source = provider, hook = event) {
  const record = agentRecord(payload, source, hook);
  atomic(path.join(events, `${record.id}.json`), record);
  return record;
}

async function main() {
  const payload = readPayload();
  const record = agentRecord(payload);
  if (provider === 'claude' && event === 'PermissionRequest' && islandRunning()) {
    const requestId = crypto.randomUUID();
    const toolInput = payload.tool_input || {};
    record.ask = {
      id: requestId, kind: 'permission', agent: provider, project: record.project,
      tool: payload.tool_name || 'Tool', note: text(payload.permission_suggestions?.[0]?.type),
      detail: text(toolInput.command || toolInput.file_path || toolInput.description),
      until: Date.now() + 120000,
    };
    atomic(path.join(events, `${record.id}.json`), record);
    const answerFile = path.join(answers, `${requestId}.json`);
    while (Date.now() < record.ask.until) {
      if (!islandRunning()) break;
      if (fs.existsSync(answerFile)) {
        const response = JSON.parse(fs.readFileSync(answerFile, 'utf8'));
        if (response.verdict === 'allow' || response.verdict === 'deny') {
          process.stdout.write(JSON.stringify({ hookSpecificOutput: {
            hookEventName: 'PermissionRequest', decision: {
              behavior: response.verdict,
              ...(response.verdict === 'deny' ? { message: 'Denied from Woods Island' } : {}),
            },
          } }));
        }
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    emit(payload, provider, 'PostToolUse');
  } else {
    emit(payload);
  }
  if (provider === 'codex') {
    let prior;
    try { prior = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'codex-notify-chain.json'), 'utf8')); }
    catch { prior = null; }
    if (Array.isArray(prior) && prior.length && prior.every(item => typeof item === 'string') && !prior.some(item => path.resolve(item).toLowerCase() === path.resolve(__filename).toLowerCase())) {
      const old = spawnSync(prior[0], [...prior.slice(1), JSON.stringify(payload)], { shell: false, windowsHide: true, timeout: 30000, stdio: 'ignore' });
      if (old.error || old.signal) process.exitCode = 1;
      else if (old.status) process.exitCode = old.status;
    }
  }
}

if (require.main === module) main().catch(() => { process.exitCode = 1; });
module.exports = { agentRecord, projectName };

