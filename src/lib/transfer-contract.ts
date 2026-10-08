// 주 담당 소유. worker/와 src/가 함께 import. import 없음.
export const TRANSFER_API_PATH = '/api/transfers' as const;
export const TRANSFER_MAX_BYTES = 1_048_576;          // envelope 전체 = 최대 upload body
export const TRANSFER_MIN_BYTES = 33;                 // 4 magic + 12 IV + 16 tag + 1
export const TRANSFER_TTL_SECONDS = 86_400;
export const TRANSFER_ACTIVE_LIMIT = 32;
export const TRANSFER_CREATE_LIMIT_24H = 64;          // rolling window, 삭제로 초기화되지 않음
export const TRANSFER_IP_CREATE_LIMIT_24H = 6;
export const TRANSFER_IP_FAILURE_LIMIT_1H = 20;
export const TRANSFER_FAILURE_LOG_LIMIT = 256; // total failure rows, cleanup after 2h
export const TRANSFER_DECOMPRESSED_MAX_BYTES = 50 * 1024 * 1024; // = MAX_BACKUP_BYTES
export const TRANSFER_MAGIC = 'NLT1';                 // envelope 앞 4B, AES-GCM AAD
export const TRANSFER_IV_BYTES = 12;
export const TRANSFER_KEY_BITS = 256;
export const TRANSFER_LINK_VERSION = 'v1';
export const TRANSFER_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;    // 16B base64url
export const TRANSFER_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32B base64url (토큰·키)
export const TRANSFER_EXPIRES_HEADER = 'X-Transfer-Expires-At';
export const SENT_TRANSFERS_STORAGE_KEY = 'nature-lens:transfers:v1';
export const RESTORED_TRANSFERS_STORAGE_KEY = 'nature-lens:restored-transfers:v1';

export type ApiErrorCode =
  | 'not-found'               // 404: 없음·만료·삭제·토큰 오류·형식 오류 모두 동일
  | 'method-not-allowed'      // 405 + Allow
  | 'payload-too-large'       // 413
  | 'unsupported-media-type'  // 415
  | 'invalid-payload'         // 400
  | 'quota-active'            // 429 + Retry-After: 3600
  | 'quota-daily'             // 429
  | 'rate-limited'            // 429
  | 'transfer-disabled'       // 503 (IP_HASH_SECRET 미설정 등)
  | 'not-configured'          // 503 (/api/identify)
  | 'internal';               // 500

export interface ApiError { error: ApiErrorCode }

// GET /api/health → 200
export interface HealthResponse { ok: true; service: 'nature-lens'; build: string }

// GET /api/capabilities → 200  (ai/client.ts의 capabilitySchema와 별개)
export interface CapabilitiesResponse {
  localStorage: true;
  transfer: { available: boolean; maxBytes: number; ttlSeconds: number };
  sync: false;
  identify: false;
}

// POST /api/transfers
//   요청: Content-Type: application/octet-stream, body = envelope (33..TRANSFER_MAX_BYTES)
//   응답 201:
export interface CreateTransferResponse {
  id: string;           // TRANSFER_ID_PATTERN
  readToken: string;    // TRANSFER_SECRET_PATTERN, 서버는 SHA-256 hex만 저장
  deleteToken: string;  // TRANSFER_SECRET_PATTERN, 별도 해시, 생성 브라우저만 보관
  expiresAt: string;    // ISO-8601 UTC, 서버 시각 + TTL
  size: number;         // 저장된 envelope 바이트 수
}

// GET /api/transfers/:id     Authorization: Bearer <readToken>
//   200: application/octet-stream envelope + TRANSFER_EXPIRES_HEADER
// DELETE /api/transfers/:id  Authorization: Bearer <deleteToken>
//   200:
export interface DeleteTransferResponse { deleted: true }

// 링크: `${origin}/transfer/#v1.${id}.${readToken}.${key}` — fragment는 서버로 전송되지 않음
export interface TransferLink { version: 'v1'; id: string; readToken: string; key: string }

// localStorage SENT_TRANSFERS_STORAGE_KEY 항목 (key·readToken 저장 금지)
export interface SentTransferRecord { id: string; deleteToken: string; expiresAt: string; observations: number }

export type TransferErrorKind =
  | 'too-large' | 'link-invalid' | 'not-found' | 'decrypt' | 'invalid-backup'
  | 'quota' | 'rate-limited' | 'disabled' | 'network';
