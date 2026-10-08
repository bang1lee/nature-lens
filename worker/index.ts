import {
  TRANSFER_MAX_BYTES, TRANSFER_TTL_SECONDS,
  type HealthResponse, type CapabilitiesResponse,
} from '../src/lib/transfer-contract';
import { apiError, json } from './http';
import { createTransfer, accessTransfer, cleanupTransfers } from './transfer';

export interface Env {
  ASSETS?: Fetcher;
  DB?: D1Database;
  IP_HASH_SECRET?: string;
  BUILD_ID?: string;
  TRANSFER_ACTIVE_LIMIT?: string;
  TRANSFER_CREATE_LIMIT?: string;
  TRANSFER_IP_CREATE_LIMIT?: string;
  TRANSFER_IP_FAILURE_LIMIT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (!pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    }
    const methods = pathname === '/api/health' || pathname === '/api/capabilities' ? 'GET'
      : pathname === '/api/identify' || pathname === '/api/transfers' ? 'POST'
      : /^\/api\/transfers\/[^/]+$/.test(pathname) ? 'GET, DELETE' : null;
    if (!methods) return apiError('not-found', 404);
    if (!methods.split(', ').includes(request.method)) {
      return apiError('method-not-allowed', 405, { Allow: methods });
    }
    if (pathname === '/api/health') {
      return json({ ok: true, service: 'nature-lens', build: env.BUILD_ID || 'development' } satisfies HealthResponse);
    }
    if (pathname === '/api/capabilities') {
      return json({ localStorage: true, transfer: {
        available: Boolean(env.DB && env.IP_HASH_SECRET?.trim()),
        maxBytes: TRANSFER_MAX_BYTES, ttlSeconds: TRANSFER_TTL_SECONDS,
      }, sync: false, identify: false } satisfies CapabilitiesResponse);
    }
    if (pathname === '/api/identify') return apiError('not-configured', 503);
    // CORS alone cannot prevent a foreign page from sending no-cors image/GET
    // requests and exhausting the failure allowance of a shared visitor IP.
    const site = request.headers.get('Sec-Fetch-Site');
    const origin = request.headers.get('Origin');
    if (site === 'cross-site' || site === 'same-site' || (origin && origin !== url.origin)) {
      return apiError('not-found', 404);
    }
    try {
      if (pathname === '/api/transfers') return await createTransfer(request, env);
      return await accessTransfer(request, env, pathname.slice('/api/transfers/'.length));
    } catch {
      // Never log a request, exception, URL/id, IP, header, or database payload.
      console.error({ route: 'transfers', status: 500, code: 'internal' });
      return apiError('internal', 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    try { await cleanupTransfers(env); }
    catch { console.error({ route: 'scheduled', status: 500, code: 'internal' }); }
  },
} satisfies ExportedHandler<Env>;
