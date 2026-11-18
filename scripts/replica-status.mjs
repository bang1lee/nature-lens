#!/usr/bin/env node
// Read the shared handoff without printing document contents or changing either checkout.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultWorkspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const usage = 'Usage: node scripts/replica-status.mjs [--workspace PATH] [--watch] [--interval MS]';

function parseArgs(args) {
  const options = { workspace: defaultWorkspace, watch: false, interval: 2000 };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--watch') options.watch = true;
    else if (arg === '--workspace' || arg === '--interval') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}.`);
      if (arg === '--workspace') options.workspace = path.resolve(value);
      else {
        options.interval = Number(value);
        if (!Number.isSafeInteger(options.interval) || options.interval < 50 || options.interval > 3600000) {
          throw new Error('Interval must be an integer from 50 to 3600000 milliseconds.');
        }
      }
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// Reject paths that escape the shared workspace, including existing symlinks.
function resolveShared(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) return null;
  const candidate = path.resolve(root, relative);
  if (!inside(root, candidate)) return null;
  try {
    if (!inside(realpathSync(root), realpathSync(candidate))) return null;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return candidate;
}

function digest(data) {
  return createHash('sha256').update(data).digest('hex');
}

function evidenceState(root, name) {
  let file;
  try {
    file = resolveShared(root, name);
    if (!file) return { path: '[invalid path]', status: 'invalid-path' };
    const stat = statSync(file);
    if (!stat.isFile()) return { path: name, status: 'not-a-file', modifiedMs: stat.mtimeMs };
    const data = readFileSync(file);
    return { path: name, status: 'present', size: data.length, sha256: digest(data) };
  } catch (error) {
    return { path: file ? name : '[invalid path]', status: error.code === 'ENOENT' ? 'missing' : 'unreadable' };
  }
}

function repositoryState(root, repo) {
  try {
    const directory = resolveShared(root, repo);
    if (!directory) return { status: 'invalid-path', head: null };
    statSync(directory);
    // A real checkout or worktree has its own .git; don't accidentally report an ancestor.
    statSync(path.join(directory, '.git'));
    const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
    for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[name];
    const head = execFileSync('git', ['-C', directory, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!/^[0-9a-f]{40,64}$/i.test(head)) return { path: repo, status: 'unavailable', head: null };
    return { path: repo, status: 'available', head };
  } catch (error) {
    return { path: typeof repo === 'string' && !path.isAbsolute(repo) ? repo : '[invalid path]', status: error.code === 'ENOENT' ? 'missing' : 'unavailable', head: null };
  }
}

function readState(root) {
  let data;
  try {
    const ledgerFile = resolveShared(root, '.harness/picturethis.json');
    if (!ledgerFile) return {
      ledger: { status: 'invalid-path', path: '.harness/picturethis.json' },
      repository: { status: 'unavailable', head: null }, handoff: { status: 'unavailable' }, tasks: [],
    };
    data = readFileSync(ledgerFile);
  } catch (error) {
    return {
      ledger: { status: error.code === 'ENOENT' ? 'missing' : 'unreadable', path: '.harness/picturethis.json', hint: 'Point --workspace to the shared Nature Lens folder.' },
      repository: { status: 'unavailable', head: null }, handoff: { status: 'unavailable' }, tasks: [],
    };
  }
  const ledger = { path: '.harness/picturethis.json', sha256: digest(data), status: 'available' };
  let source;
  try {
    source = JSON.parse(data.toString('utf8'));
    if (!source || typeof source !== 'object' || !Array.isArray(source.tasks)) throw new Error('Invalid ledger');
  } catch {
    return { ledger: { ...ledger, status: 'invalid' }, repository: { status: 'unavailable', head: null }, handoff: { status: 'unavailable' }, tasks: [] };
  }
  const allowedStatuses = new Set(['todo', 'doing', 'done', 'blocked']);
  const tasks = source.tasks
    .filter((task) => task && typeof task.id === 'string' && /^PT-\d+$/.test(task.id))
    .map((task) => ({
      id: task.id,
      status: allowedStatuses.has(task.status) ? task.status : 'unknown',
      evidence: Array.isArray(task.evidence) ? task.evidence.map((name) => evidenceState(root, name)) : [],
    }));
  const handoff = typeof source.handoff?.doc === 'string'
    ? evidenceState(root, source.handoff.doc)
    : { status: 'unavailable' };
  return { ledger, repository: repositoryState(root, source.implementation_worktree ?? source.app_repo), handoff, tasks };
}

function changesSince(previous, current) {
  const changes = {};
  if (JSON.stringify(previous.ledger) !== JSON.stringify(current.ledger)) changes.ledger = current.ledger;
  if (JSON.stringify(previous.repository) !== JSON.stringify(current.repository)) changes.repository = current.repository;
  if (JSON.stringify(previous.handoff) !== JSON.stringify(current.handoff)) changes.handoff = current.handoff;
  const previousTasks = new Map(previous.tasks.map((task) => [task.id, task]));
  const currentIds = new Set(current.tasks.map((task) => task.id));
  const updated = current.tasks.filter((task) => JSON.stringify(previousTasks.get(task.id)) !== JSON.stringify(task));
  const removed = previous.tasks.filter((task) => !currentIds.has(task.id)).map((task) => task.id);
  if (updated.length) changes.tasks = updated;
  if (removed.length) changes.removedTaskIds = removed;
  return changes;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) console.log(usage);
  else {
    process.stdout.on('error', (error) => { if (error.code === 'EPIPE') process.exit(0); });
    let previous = readState(options.workspace);
    console.log(JSON.stringify({ type: 'snapshot', state: previous }));
    if (!options.watch) {
      if (previous.ledger.status !== 'available' || previous.repository.status !== 'available') process.exitCode = 1;
    } else {
      setInterval(() => {
        const current = readState(options.workspace);
        const changes = changesSince(previous, current);
        if (Object.keys(changes).length) console.log(JSON.stringify({ type: 'update', changes }));
        previous = current;
      }, options.interval);
    }
  }
} catch (error) {
  console.error(`${error.message}\n${usage}`);
  process.exitCode = 2;
}
