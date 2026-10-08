// Real local Worker + D1 integration. No account, remote database, or project secrets.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { gzipSync } from 'node:zlib';
import { createHmac } from 'node:crypto';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
const temporary = await mkdtemp(path.join(tmpdir(), 'nature-lens-worker-'));
const config = path.join(temporary, 'wrangler.json');
const persist = path.join(temporary, 'state');
const logs = [];
let child;
let base;
const cli = async (...args) => (await run(process.execPath, [wrangler, ...args, '--config', config], {
  cwd: temporary, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, maxBuffer: 4 * 1024 * 1024,
})).stdout;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stop() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  current.kill('SIGTERM');
  await Promise.race([new Promise(resolve => current.once('exit', resolve)), pause(5000)]);
  if (current.exitCode === null) current.kill('SIGKILL');
  child = undefined;
}
async function start(vars = { IP_HASH_SECRET: 'local-only-smoke-secret' }) {
  await stop();
  await writeFile(config, JSON.stringify({
    name: 'nature-lens-smoke', main: path.join(root, 'worker/index.ts'),
    compatibility_date: '2026-04-01', vars,
    d1_databases: [{ binding: 'DB', database_name: 'smoke-transfers',
      database_id: '00000000-0000-0000-0000-000000000001',
      migrations_dir: path.join(root, 'worker/migrations') }],
    triggers: { crons: ['17 * * * *'] },
    observability: { enabled: false },
  }));
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [wrangler, 'dev', '--local', '--test-scheduled',
    '--ip', '127.0.0.1', '--port', String(port), '--persist-to', persist,
    '--log-level', 'error', '--config', config], {
    cwd: temporary, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => logs.push(data.toString()));
  child.stderr.on('data', data => logs.push(data.toString()));
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error('Local Worker startup failed');
    try { await fetch(`${base}/api/health`); return; } catch { await pause(200); }
  }
  throw new Error('Local Worker startup timed out');
}
const request = (url, init) => fetch(base + url, init);
const highIp = { IP_HASH_SECRET: 'local-only-smoke-secret', TRANSFER_IP_CREATE_LIMIT: '1000' };
const sql = async command => JSON.parse(await cli('d1', 'execute', 'smoke-transfers', '--local',
  '--persist-to', persist, '--command', command, '--json'))[0].results;
const reset = () => sql('DELETE FROM transfers; DELETE FROM creations; DELETE FROM read_failures;');
const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const magic = new TextEncoder().encode('NLT1');
const plain = '{"version":1,"observations":[],"privateNote":"smoke-private-observation"}';
const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: magic }, key, gzipSync(plain));
const envelope = Buffer.concat([magic, iv, new Uint8Array(encrypted)]);
const sensitive = [plain, envelope.toString('hex'), 'smoke-private-observation'];
const post = async (payload = envelope, headers = {}) => {
  const response = await request('/api/transfers', {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'CF-Connecting-IP': '203.0.113.7', ...headers }, body: payload,
  });
  if (response.status === 201) {
    const item = await response.clone().json();
    sensitive.push(item.readToken, item.deleteToken);
  }
  return response;
};
async function create() {
  const response = await post();
  assert.equal(response.status, 201, 'encrypted transfer creation must succeed');
  const result = await response.json();
  sensitive.push(result.readToken, result.deleteToken);
  assert.match(result.id, /^[A-Za-z0-9_-]{22}$/);
  assert.match(result.readToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(result.deleteToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(result.readToken, result.deleteToken);
  assert.equal(result.size, envelope.byteLength);
  assert.ok(Math.abs(Date.parse(result.expiresAt) - Date.now() - 86400000) < 10000);
  return result;
}
const read = (transfer, token = transfer.readToken) => request(`/api/transfers/${transfer.id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const remove = (transfer, token = transfer.deleteToken) => request(`/api/transfers/${transfer.id}`, {
  method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
});
async function expectError(response, status, error) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error });
}

try {
  await start();
  const health = await request('/api/health');
  assert.equal(health.status, 200, 'health must be available');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  const body = await health.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'nature-lens');
  assert.equal(typeof body.build, 'string');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(health.headers.get('access-control-allow-origin'), null);
  const capabilities = await (await request('/api/capabilities')).json();
  assert.deepEqual(capabilities, { localStorage: true, transfer: {
    available: true, maxBytes: 1048576, ttlSeconds: 86400,
  }, sync: false, identify: false });
  await expectError(await request('/api/nope'), 404, 'not-found');
  for (const [url, method, allow] of [
    ['/api/health', 'PUT', 'GET'], ['/api/capabilities', 'POST', 'GET'],
    ['/api/transfers', 'OPTIONS', 'POST'], ['/api/transfers/bad', 'POST', 'GET, DELETE'],
    ['/api/identify', 'GET', 'POST'],
  ]) {
    const response = await request(url, { method });
    assert.equal(response.headers.get('allow'), allow);
    await expectError(response, 405, 'method-not-allowed');
  }
  await expectError(await request('/api/identify', { method: 'POST', body: 'ignored' }), 503, 'not-configured');
  console.log('PASS Worker health, capabilities, routing, disabled identify');

  await cli('d1', 'migrations', 'apply', 'smoke-transfers', '--local', '--persist-to', persist);
  await reset();
  const transfer = await create();
  const fetched = await read(transfer);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.headers.get('content-type'), 'application/octet-stream');
  assert.equal(fetched.headers.get('cache-control'), 'no-store');
  assert.equal(fetched.headers.get('x-transfer-expires-at'), transfer.expiresAt);
  assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), envelope);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: magic }, key, envelope.subarray(16));
  assert.deepEqual(Buffer.from(decrypted), gzipSync(plain));
  console.log('PASS real AES-GCM encrypted binary create/read roundtrip');

  const privacy = (await sql("SELECT typeof(payload) AS storage, length(read_hash) AS readLength, length(delete_hash) AS deleteLength FROM transfers"))[0];
  assert.deepEqual(privacy, { storage: 'blob', readLength: 64, deleteLength: 64 });
  const stored = (await sql('SELECT read_hash, delete_hash FROM transfers'))[0];
  assert.notEqual(stored.read_hash, transfer.readToken);
  assert.notEqual(stored.delete_hash, transfer.deleteToken);
  const ipRow = (await sql('SELECT ip_hash FROM creations'))[0];
  assert.match(ipRow.ip_hash, /^[a-f0-9]{32}$/);
  assert.equal(ipRow.ip_hash, createHmac('sha256', 'local-only-smoke-secret').update('203.0.113.7').digest('hex').slice(0, 32));

  await expectError(await post(envelope, { 'Content-Type': 'application/json' }), 415, 'unsupported-media-type');
  await expectError(await post(Buffer.alloc(33)), 400, 'invalid-payload');
  await expectError(await post(Buffer.concat([magic, Buffer.alloc(28)])), 400, 'invalid-payload');
  const largest = Buffer.alloc(1048576); largest.set(magic);
  const maximum = await post(largest);
  assert.equal(maximum.status, 201, '1 MiB envelope must be accepted by real D1');
  sensitive.push(...Object.values(await maximum.json()).filter(value => typeof value === 'string' && value.length === 43));
  await expectError(await post(Buffer.alloc(1048577)), 413, 'payload-too-large');
  async function* chunks() { for (let i = 0; i < 32; i++) yield Buffer.alloc(65536); }
  await expectError(await request('/api/transfers', {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: chunks(), duplex: 'half',
  }), 413, 'payload-too-large');
  console.log('PASS binary validation, exact 1 MiB D1 row, oversized and chunked rejection');

  for (const response of [
    await read(transfer, 'A'.repeat(43)), await request(`/api/transfers/${transfer.id}`),
    await request('/api/transfers/not-valid', { headers: { Authorization: 'Bearer malformed' } }),
    await read({ id: 'A'.repeat(22), readToken: transfer.readToken }), await remove(transfer, transfer.readToken),
  ]) await expectError(response, 404, 'not-found');
  const deleted = await remove(transfer);
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: true });
  await expectError(await read(transfer), 404, 'not-found');
  await expectError(await remove(transfer), 404, 'not-found');
  console.log('PASS uniform unauthorized errors, separate read/delete tokens, deletion');

  await reset();
  const protectedTransfer = await create();
  for (let i = 0; i < 25; i++) {
    const foreignHeaders = i % 3 === 0 ? { 'Sec-Fetch-Site': 'cross-site' }
      : i % 3 === 1 ? { 'Sec-Fetch-Site': 'same-site' } : { Origin: 'https://foreign.example' };
    await expectError(await request('/api/transfers/invalid', { headers: foreignHeaders }), 404, 'not-found');
  }
  assert.equal((await sql('SELECT COUNT(*) AS count FROM read_failures'))[0].count, 0,
    'foreign browser requests must not consume the victim IP failure ledger');
  await expectError(await post(envelope, { 'Sec-Fetch-Site': 'cross-site' }), 404, 'not-found');
  for (const headers of [{ 'Sec-Fetch-Site': 'same-origin' }, { 'Sec-Fetch-Site': 'none' }, { Origin: base }]) {
    const response = await request(`/api/transfers/${protectedTransfer.id}`, {
      headers: { Authorization: `Bearer ${protectedTransfer.readToken}`, ...headers },
    });
    assert.equal(response.status, 200);
  }
  assert.equal((await read(protectedTransfer)).status, 200);
  assert.equal((await remove(protectedTransfer)).status, 200);
  assert.equal((await sql('SELECT COUNT(*) AS count FROM read_failures'))[0].count, 0);
  console.log('PASS 25 foreign-site requests do not consume quota; valid same-origin/CLI access and deletion survive');


  await reset();
  const expired = await create();
  await sql('UPDATE transfers SET expires_at = 0;');
  await expectError(await read(expired), 404, 'not-found');
  await expectError(await remove(expired), 404, 'not-found');
  await sql('UPDATE creations SET created_at = 0; UPDATE read_failures SET created_at = 0;');
  const scheduled = await request('/__scheduled');
  assert.equal(scheduled.status, 200);
  assert.deepEqual((await sql(`SELECT (SELECT COUNT(*) FROM transfers) AS transfers,
    (SELECT COUNT(*) FROM creations) AS creations, (SELECT COUNT(*) FROM read_failures) AS failures`))[0],
    { transfers: 0, creations: 0, failures: 0 });
  console.log('PASS expiry denies both GET and DELETE, scheduled cleanup');

  await start(highIp);
  await reset();
  const concurrent = await Promise.all(Array.from({ length: 40 }, () => post()));
  assert.equal(concurrent.filter(response => response.status === 201).length, 32);
  for (const response of concurrent.filter(response => response.status !== 201)) {
    assert.equal(response.headers.get('retry-after'), '3600');
    await expectError(response, 429, 'quota-active');
  }
  assert.equal((await sql('SELECT COUNT(*) AS count FROM transfers'))[0].count, 32);
  assert.equal((await sql('SELECT COUNT(*) AS count FROM creations'))[0].count, 32);
  console.log('PASS concurrency A: exactly 32 of 40 creations; ledger matches');

  await reset();
  for (let i = 0; i < 64; i++) {
    const item = await create();
    assert.equal((await remove(item)).status, 200);
  }
  await expectError(await post(), 429, 'quota-daily');
  assert.equal((await sql('SELECT COUNT(*) AS count FROM transfers'))[0].count, 0);
  assert.equal((await sql('SELECT COUNT(*) AS count FROM creations'))[0].count, 64);
  // Rolling window uses recent timestamps, not an accumulating or midnight-reset counter.
  await sql("UPDATE creations SET created_at = (strftime('%s','now') * 1000) - 90000000;");
  assert.equal((await post()).status, 201);
  assert.equal((await sql('SELECT COUNT(*) AS count FROM creations'))[0].count, 65);
  console.log('PASS concurrency B: deletion preserves rolling 24h quota; old ledger does not consume quota');

  await start({ ...highIp, TRANSFER_ACTIVE_LIMIT: '1000' });
  await reset();
  const interleaved = await Promise.all(Array.from({ length: 70 }, async () => {
    const response = await post();
    if (response.status === 201) {
      const item = await response.json();
      assert.equal((await remove(item)).status, 200);
      return true;
    }
    assert.equal(response.status, 429);
    return false;
  }));
  const total = (await sql('SELECT COUNT(*) AS count FROM creations'))[0].count;
  assert.equal(total, 64);
  assert.equal(total, interleaved.filter(Boolean).length);
  assert.equal(interleaved.filter(Boolean).length, 64);
  console.log('PASS concurrency C: exactly 64 of 70 interleaved create/delete requests at rolling quota');

  await start();
  await reset();
  for (let i = 0; i < 6; i++) await create();
  await expectError(await post(), 429, 'rate-limited');
  assert.equal((await sql('SELECT COUNT(*) AS count FROM creations'))[0].count, 6);
  await reset();
  const sameIp = await Promise.all(Array.from({ length: 10 }, () => post()));
  assert.equal(sameIp.filter(response => response.status === 201).length, 6);
  for (const response of sameIp.filter(response => response.status !== 201)) await expectError(response, 429, 'rate-limited');
  assert.equal((await sql('SELECT COUNT(*) AS count FROM creations'))[0].count, 6);
  console.log('PASS default IP creation limit: seventh rejected and parallel 10 allow exactly 6');

  await reset();
  for (let i = 0; i < 20; i++) await expectError(await request('/api/transfers/invalid'), 404, 'not-found');
  await expectError(await request('/api/transfers/invalid'), 429, 'rate-limited');
  assert.equal((await sql('SELECT COUNT(*) AS count FROM read_failures'))[0].count, 20);
  await reset();
  const failures = await Promise.all(Array.from({ length: 50 }, (_, index) => request('/api/transfers/invalid', { method: index % 2 ? 'GET' : 'DELETE' })));
  assert.equal(failures.filter(response => response.status === 404).length, 20);
  assert.equal(failures.filter(response => response.status === 429).length, 30);
  assert.equal((await sql('SELECT COUNT(*) AS count FROM read_failures'))[0].count, 20);
  console.log('PASS sequential and 50 parallel failed requests: at most 20 writes per IP/hour');

  await reset();
  const existing = await create();
  const manyIps = await Promise.all(Array.from({ length: 300 }, (_, index) => request('/api/transfers/invalid', {
    headers: { 'CF-Connecting-IP': `198.51.${Math.floor(index / 250)}.${index % 250 + 1}` },
  })));
  assert.equal(manyIps.filter(response => response.status === 404).length, 256);
  assert.equal(manyIps.filter(response => response.status === 429).length, 44);
  const failureRows = (await sql('SELECT COUNT(*) AS count, COUNT(DISTINCT ip_hash) AS ips FROM read_failures'))[0];
  assert.equal(failureRows.count, 256, 'global failure ledger must remain bounded');
  assert.ok(failureRows.ips > 1, 'fixture must exercise distinct IP hashes');
  assert.equal((await read(existing)).status, 200, 'full global failure ledger must not reject a valid existing transfer');
  assert.equal((await remove(existing)).status, 200, 'full global failure ledger must not reject valid deletion');
  await sql('UPDATE read_failures SET created_at = 0;');
  await expectError(await request('/api/transfers/invalid'), 404, 'not-found');
  assert.equal((await sql('SELECT COUNT(*) AS count FROM read_failures'))[0].count, 1);
  console.log('PASS global failure ledger bounds across distinct IPs and preserves valid access');

  await start({});
  const disabled = await (await request('/api/capabilities')).json();
  assert.equal(disabled.transfer.available, false);
  await expectError(await post(), 503, 'transfer-disabled');
  await expectError(await read(existing), 503, 'transfer-disabled');
  await expectError(await remove(existing), 503, 'transfer-disabled');
  const output = logs.join('');
  for (const value of sensitive) assert.ok(!output.includes(value), 'Worker logs must omit sensitive data');
  assert.ok(!output.includes('198.51.'), 'Worker logs must omit raw IP');
  assert.ok(!output.includes('203.0.113.7'), 'Worker logs must omit raw upload IP');
  console.log('PASS missing-secret fail-closed and sensitive-log scan');
  console.log('PASS all Worker + real local D1 smoke checks');

} finally {
  await stop();
  await rm(temporary, { recursive: true, force: true });
}
