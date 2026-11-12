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

function questionAnswers(questions, answers) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 4 || !answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Invalid question answer');
  if (Object.keys(answers).length !== questions.length) throw new Error('Every question needs an answer');
  const normalized = Object.create(null);
  for (const question of questions) {
    const key = question?.question;
    if (typeof key !== 'string' || !key || Object.hasOwn(normalized, key) || !Object.hasOwn(answers, key)) throw new Error('Missing or duplicate question');
    if (!Array.isArray(question.options) || !question.options.length || question.options.some(option => typeof option?.label !== 'string' || !option.label)) throw new Error('Invalid question options');
    if (question.multiSelect !== undefined && typeof question.multiSelect !== 'boolean') throw new Error('Invalid selection mode');
    const labels = question.options.map(option => option.label);
    const value = answers[key];
    const selections = Array.isArray(value) ? value : typeof value === 'string' && labels.includes(value) ? [value] : typeof value === 'string' && question.multiSelect ? value.split(', ') : [];
    if (!selections.length || (!question.multiSelect && selections.length !== 1) || new Set(selections).size !== selections.length || selections.some(label => typeof label !== 'string' || !labels.includes(label))) throw new Error('Invalid selected option');
    normalized[key] = selections.join(', ');
  }
  return normalized;
}

function decisionFor(response, ask, toolInput) {
  if (response.verdict === 'answer' && ask.kind === 'question') return {
    behavior: 'allow', updatedInput: { ...toolInput, answers: questionAnswers(ask.questions, response.answers) },
  };
  if (response.verdict === 'deny') return { behavior: 'deny', message: 'Denied from Woods Island' };
  if (response.verdict === 'allow' && ask.kind === 'permission') return { behavior: 'allow' };
  if (response.verdict === 'terminal') return null;
  throw new Error('Invalid reply for this request');
}

async function main() {
  const payload = readPayload();
  const record = agentRecord(payload);
  if (provider === 'claude' && event === 'PermissionRequest' && islandRunning()) {
    const requestId = crypto.randomUUID();
    const toolInput = payload.tool_input || {};
    const isQuestion = payload.tool_name === 'AskUserQuestion';
    record.ask = {
      id: requestId, kind: isQuestion ? 'question' : 'permission', agent: provider, project: record.project,
      tool: payload.tool_name || 'Tool', note: text(payload.permission_suggestions?.[0]?.type),
      detail: text(toolInput.command || toolInput.file_path || toolInput.description),
      ...(isQuestion ? { questions: toolInput.questions } : {}),
      until: Date.now() + 120000,
    };
    atomic(path.join(events, `${record.id}.json`), record);
    const answerFile = path.join(answers, `${requestId}.json`);
    while (Date.now() < record.ask.until) {
      if (!islandRunning()) break;
      if (fs.existsSync(answerFile)) {
        try {
          const response = JSON.parse(fs.readFileSync(answerFile, 'utf8'));
          const decision = decisionFor(response, record.ask, toolInput);
          if (decision) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } }));
          break;
        } catch { /* A malformed/stale reply must never approve a tool. Await a corrected response. */ }
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
module.exports = { agentRecord, projectName, questionAnswers, decisionFor };

