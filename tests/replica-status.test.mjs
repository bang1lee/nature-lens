import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/replica-status.mjs', import.meta.url));
const firstHead = 'a'.repeat(40);
const secondHead = 'b'.repeat(40);

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'nature-lens-replica-'));
  mkdirSync(path.join(root, '.harness'), { recursive: true });
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  mkdirSync(path.join(root, '.research', 'app-baseline'), { recursive: true });
  const repo = path.join(root, '.research', 'app-baseline');
  const init = spawnSync('git', ['init', '-q', '-b', 'fixture', repo], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  const ref = path.join(repo, '.git', 'refs', 'heads', 'fixture');
  writeFileSync(ref, `${firstHead}\n`);
  const ledger = {
    app_repo: '.research/app-baseline',
    tasks: [{ id: 'PT-1', status: 'done', evidence: ['docs/evidence.md'] }, { id: 'PT-2', status: 'todo', evidence: ['docs/missing.md'] }],
    handoff: { doc: 'docs/HANDOFF.md' },
    note: 'private ledger text should not appear',
  };
  const ledgerPath = path.join(root, '.harness', 'picturethis.json');
  const evidencePath = path.join(root, 'docs', 'evidence.md');
  const handoffPath = path.join(root, 'docs', 'HANDOFF.md');
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  writeFileSync(evidencePath, 'private evidence text should not appear');
  writeFileSync(handoffPath, 'private handoff text should not appear');
  return { root, ledger, ledgerPath, evidencePath, handoffPath, ref };
}

function run(root, ...args) {
  return spawnSync(process.execPath, [script, '--workspace', root, ...args], { encoding: 'utf8' });
}

test('reports task status, evidence metadata and the referenced repository HEAD without printing contents', (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const result = run(fixture.root);
  assert.equal(result.status, 0, result.stderr);
  const { state } = JSON.parse(result.stdout);
  assert.equal(state.ledger.status, 'available');
  assert.equal(state.repository.head, firstHead);
  assert.equal(state.handoff.status, 'present');
  assert.equal(state.tasks[0].id, 'PT-1');
  assert.equal(state.tasks[0].status, 'done');
  assert.equal(state.tasks[0].evidence[0].status, 'present');
  assert.match(state.tasks[0].evidence[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(state.tasks[1].evidence[0].status, 'missing');
  assert.doesNotMatch(result.stdout, /private (ledger|evidence|handoff) text/);
});

test('missing shared workspace produces a portable diagnostic and a failing exit status', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'nature-lens-missing-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = run(path.join(root, 'not-mounted'));
  assert.notEqual(result.status, 0);
  const { state } = JSON.parse(result.stdout);
  assert.equal(state.ledger.status, 'missing');
  assert.equal(state.repository.status, 'unavailable');
  assert.deepEqual(state.tasks, []);
});

test('watch reports ledger content, evidence and HEAD changes as separate updates', async (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const child = spawn(process.execPath, [script, '--workspace', fixture.root, '--watch', '--interval', '80'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const events = [];
  let buffer = '';
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) if (line) events.push(JSON.parse(line));
  });
  async function waitFor(predicate) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const event = events.find(predicate);
      if (event) return event;
      if (child.exitCode !== null) throw new Error(`watch exited early: ${stderr}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`timed out waiting for watch event: ${stderr}`);
  }
  const initial = await waitFor((event) => event.type === 'snapshot');
  assert.equal(initial.state.repository.head, firstHead);
  fixture.ledger.note = 'another private ledger update';
  writeFileSync(fixture.ledgerPath, JSON.stringify(fixture.ledger));
  await waitFor((event) => event.type === 'update' && event.changes.ledger);
  writeFileSync(fixture.evidencePath, 'new private evidence contents');
  await waitFor((event) => event.type === 'update' && event.changes.tasks?.some((task) => task.id === 'PT-1'));
  writeFileSync(fixture.handoffPath, 'new private handoff contents');
  await waitFor((event) => event.type === 'update' && event.changes.handoff?.status === 'present');
  writeFileSync(fixture.ref, `${secondHead}\n`);
  await waitFor((event) => event.type === 'update' && event.changes.repository?.head === secondHead);
  assert.doesNotMatch(JSON.stringify(events), /private (ledger|evidence|handoff)/);
});
