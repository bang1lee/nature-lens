import {
  TRANSFER_ACTIVE_LIMIT, TRANSFER_CREATE_LIMIT_24H, TRANSFER_IP_CREATE_LIMIT_24H,
  TRANSFER_MAX_BYTES, TRANSFER_MIN_BYTES, TRANSFER_MAGIC, TRANSFER_TTL_SECONDS,
  TRANSFER_ID_PATTERN, TRANSFER_SECRET_PATTERN, TRANSFER_EXPIRES_HEADER,
  TRANSFER_IP_FAILURE_LIMIT_1H, TRANSFER_FAILURE_LOG_LIMIT,
  type CreateTransferResponse, type DeleteTransferResponse,
} from '../src/lib/transfer-contract';
import type { Env } from './index';
import { API_HEADERS, apiError, json, PayloadTooLarge, readLimited } from './http';

const HOUR = 3_600_000;
const DAY = TRANSFER_TTL_SECONDS * 1000;
const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer): string => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
const hash = async (value: string): Promise<string> => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const random = (length: number): string => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(length))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function limit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
async function ipHash(request: Request, env: Env): Promise<string | null> {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!env.IP_HASH_SECRET?.trim() || !ip) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.IP_HASH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(ip))).slice(0, 32);
}

export async function createTransfer(request: Request, env: Env): Promise<Response> {
  const ip = await ipHash(request, env);
  const db = env.DB;
  if (!ip || !db) return apiError('transfer-disabled', 503);
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/octet-stream') {
    return apiError('unsupported-media-type', 415);
  }
  const contentLength = request.headers.get('Content-Length');
  if (contentLength !== null && Number(contentLength) > TRANSFER_MAX_BYTES) return apiError('payload-too-large', 413);
  let payload: Uint8Array;
  try { payload = await readLimited(request.body, TRANSFER_MAX_BYTES); }
  catch (error) {
    return error instanceof PayloadTooLarge ? apiError('payload-too-large', 413) : apiError('invalid-payload', 400);
  }
  if (payload.length < TRANSFER_MIN_BYTES || !encoder.encode(TRANSFER_MAGIC).every((byte, index) => payload[index] === byte)) {
    return apiError('invalid-payload', 400);
  }
  const id = random(16), readToken = random(32), deleteToken = random(32);
  const [readHash, deleteHash] = await Promise.all([hash(readToken), hash(deleteToken)]);
  const now = Date.now(), expiresAt = now + DAY;
  const active = limit(env.TRANSFER_ACTIVE_LIMIT, TRANSFER_ACTIVE_LIMIT);
  const daily = limit(env.TRANSFER_CREATE_LIMIT, TRANSFER_CREATE_LIMIT_24H);
  const ipDaily = limit(env.TRANSFER_IP_CREATE_LIMIT, TRANSFER_IP_CREATE_LIMIT_24H);
  const results = await db.batch([
    db.prepare('DELETE FROM transfers WHERE expires_at <= ?1').bind(now),
    db.prepare(`INSERT INTO creations (id, ip_hash, created_at)
      SELECT ?1, ?2, ?3
      WHERE (SELECT COUNT(*) FROM transfers WHERE expires_at > ?3) < ?4
        AND (SELECT COUNT(*) FROM creations WHERE created_at > ?5) < ?6
        AND (SELECT COUNT(*) FROM creations WHERE ip_hash = ?2 AND created_at > ?5) < ?7`)
      .bind(id, ip, now, active, now - DAY, daily, ipDaily),
    db.prepare(`INSERT INTO transfers (id, read_hash, delete_hash, payload, size, created_at, expires_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
      WHERE EXISTS (SELECT 1 FROM creations WHERE id = ?1)`)
      .bind(id, readHash, deleteHash, payload, payload.length, now, expiresAt),
  ]);
  if (results[2].meta.changes === 1) {
    return json({ id, readToken, deleteToken, expiresAt: new Date(expiresAt).toISOString(), size: payload.length } satisfies CreateTransferResponse, 201);
  }
  const counts = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM transfers WHERE expires_at > ?1) AS active,
    (SELECT COUNT(*) FROM creations WHERE created_at > ?2) AS daily`)
    .bind(now, now - DAY).first<{ active: number; daily: number }>();
  const code = counts && counts.active >= active ? 'quota-active'
    : counts && counts.daily >= daily ? 'quota-daily' : 'rate-limited';
  return apiError(code, 429, { 'Retry-After': '3600' });
}

// The conditional insert is the authoritative check: concurrent failed requests
// cannot turn a successful count-before-write check into unbounded ledger writes.
async function recordFailure(db: D1Database, ip: string, now: number, maximum: number): Promise<Response> {
  const results = await db.batch([
    db.prepare('DELETE FROM read_failures WHERE created_at <= ?1').bind(now - 2 * HOUR),
    db.prepare(`INSERT INTO read_failures (ip_hash, created_at)
      SELECT ?1, ?2
      WHERE (SELECT COUNT(*) FROM read_failures WHERE ip_hash = ?1 AND created_at > ?3) < ?4
        AND (SELECT COUNT(*) FROM read_failures) < ?5`)
      .bind(ip, now, now - HOUR, maximum, TRANSFER_FAILURE_LOG_LIMIT),
  ]);
  return results[1].meta.changes === 1 ? apiError('not-found', 404)
    : apiError('rate-limited', 429, { 'Retry-After': '3600' });
}

export async function accessTransfer(request: Request, env: Env, id: string): Promise<Response> {
  const db = env.DB;
  const ip = await ipHash(request, env);
  if (!db || !ip) return apiError('transfer-disabled', 503);
  const now = Date.now();
  const maximum = limit(env.TRANSFER_IP_FAILURE_LIMIT, TRANSFER_IP_FAILURE_LIMIT_1H);
  const failures = await db.prepare('SELECT COUNT(*) AS count FROM read_failures WHERE ip_hash = ?1 AND created_at > ?2')
    .bind(ip, now - HOUR).first<{ count: number }>();
  if (failures && failures.count >= maximum) return apiError('rate-limited', 429, { 'Retry-After': '3600' });
  const token = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!TRANSFER_ID_PATTERN.test(id) || !token || !TRANSFER_SECRET_PATTERN.test(token)) {
    return recordFailure(db, ip, now, maximum);
  }
  const tokenHash = await hash(token);
  if (request.method === 'DELETE') {
    const result = await db.prepare('DELETE FROM transfers WHERE id = ?1 AND delete_hash = ?2 AND expires_at > ?3')
      .bind(id, tokenHash, now).run();
    return result.meta.changes === 1 ? json({ deleted: true } satisfies DeleteTransferResponse)
      : recordFailure(db, ip, now, maximum);
  }
  const row = await db.prepare('SELECT payload, expires_at FROM transfers WHERE id = ?1 AND read_hash = ?2 AND expires_at > ?3')
    .bind(id, tokenHash, now).first<{ payload: number[]; expires_at: number }>();
  if (!row) return recordFailure(db, ip, now, maximum);
  return new Response(new Uint8Array(row.payload), { headers: {
    ...API_HEADERS, 'Content-Type': 'application/octet-stream',
    [TRANSFER_EXPIRES_HEADER]: new Date(row.expires_at).toISOString(),
  } });
}

export async function cleanupTransfers(env: Env, now = Date.now()): Promise<void> {
  if (!env.DB) return;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM transfers WHERE expires_at <= ?1').bind(now),
    env.DB.prepare('DELETE FROM creations WHERE created_at <= ?1').bind(now - 2 * DAY),
    env.DB.prepare('DELETE FROM read_failures WHERE created_at <= ?1').bind(now - 2 * HOUR),
  ]);
}
