export type CloudConfig = { enabled: true; url: string; key: string } | { enabled: false; reason: 'missing' | 'incomplete' | 'invalid-url' | 'invalid-key' };

function jwtRole(key: string): string | null {
  const part = key.split('.')[1];
  if (key.split('.').length !== 3 || !part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch { return null; }
}

export function parseCloudConfig(rawUrl?: string, rawKey?: string): CloudConfig {
  const url = rawUrl?.trim() ?? ''; const key = rawKey?.trim() ?? '';
  if (!url && !key) return { enabled: false, reason: 'missing' };
  if (!url || !key) return { enabled: false, reason: 'incomplete' };
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { enabled: false, reason: 'invalid-url' }; }
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (!(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && local)) || parsed.username || parsed.password) return { enabled: false, reason: 'invalid-url' };
  const role = jwtRole(key);
  if (key.length < 20 || /\s/.test(key) || key.startsWith('sb_secret_') || role === 'service_role' || !(key.startsWith('sb_publishable_') || role === 'anon')) return { enabled: false, reason: 'invalid-key' };
  return { enabled: true, url: parsed.origin, key };
}

export const cloudConfig = parseCloudConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const CLOUD_DISABLED_TEXT: Record<Exclude<CloudConfig, { enabled: true }>['reason'], string> = {
  missing: '이 배포에는 커뮤니티 서버 설정이 없어 로그인과 공개 커뮤니티를 사용할 수 없어요.',
  incomplete: '커뮤니티 서버 설정이 불완전해 비활성 상태예요.',
  'invalid-url': '커뮤니티 서버 주소 설정이 올바르지 않아 비활성 상태예요.',
  'invalid-key': '공개용 키 설정이 올바르지 않아 비활성 상태예요. 브라우저에는 공개용(publishable) 키만 사용할 수 있어요.',
};
