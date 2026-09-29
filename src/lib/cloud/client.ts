import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudConfig, type CloudConfig } from './config';

let cached: Promise<SupabaseClient> | null = null;

export function getSupabase(config: CloudConfig = cloudConfig): Promise<SupabaseClient> {
  if (!config.enabled) return Promise.reject(new Error('cloud-disabled'));
  if (config === cloudConfig && cached) return cached;
  const created = import('@supabase/supabase-js').then(({ createClient }) => createClient(config.url, config.key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));
  if (config === cloudConfig) { cached = created; created.catch(() => { cached = null; }); }
  return created;
}
