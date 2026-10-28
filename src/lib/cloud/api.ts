import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { aliasSchema, emailSchema, feedItemSchema, mySubmissionSchema, FEED_COLUMNS, MY_COLUMNS, submissionPayloadSchema, type FeedItem, type MySubmission, type SubmissionPayload } from './contract';

type Failure = { code?: string; message?: string; status?: number; name?: string } | null | undefined;
class CloudRequestError extends Error {}

export function cloudErrorMessage(error: unknown): string {
  if (error instanceof CloudRequestError) return error.message;
  const e = (error ?? {}) as Failure & { cause?: unknown };
  const message = (e?.message ?? '').toLowerCase();
  if ((typeof navigator !== 'undefined' && navigator.onLine === false) || error instanceof TypeError || message.includes('failed to fetch') || message.includes('network') || message.includes('load failed')) return '인터넷에 연결되지 않았어요. 연결을 확인한 뒤 다시 시도해 주세요. 내 로컬 기록은 그대로예요.';
  if (e?.code === 'over_email_send_rate_limit' || message.includes('email rate limit')) return '로그인 메일 발송 한도에 도달했어요. 메일함과 스팸함을 먼저 확인하고, 시간이 지난 뒤 다시 요청해 주세요. 계속되면 운영자에게 메일 발송 설정 확인을 요청해 주세요.';
  if (e?.code === 'email_address_not_authorized' || message.includes('email address not authorized')) return '현재 메일 발송 설정에서는 이 주소로 로그인 링크를 보낼 수 없어요. 운영자가 사용자용 메일 발송(SMTP)을 설정해야 해요. 내 기록은 이 기기에 그대로 있어요.';
  if (e?.status === 429 || message.includes('rate limit') || message.includes('too many')) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (e?.code === 'PGRST205' || e?.code === '42P01') return '공동 관찰 서버가 아직 준비되지 않았어요. 운영자에게 공동 관찰 연결 설정 확인을 요청해 주세요. 로그인과 내 기록 보관은 계속 이용할 수 있어요.';
  if (e?.code === '23505') return '이미 사용 중인 별칭이에요. 다른 별칭을 골라 주세요.';
  if (message.includes('alias_required')) return '먼저 공개 별칭을 만들어 주세요.';
  if (message.includes('pending_limit')) return '검수 대기 중인 제출이 너무 많아요. 기존 제출이 처리되거나 철회된 뒤 다시 제출해 주세요.';
  if (message.includes('submission_limit')) return '제출 가능한 총 개수에 도달했어요. 이전 제출을 철회한 뒤 다시 시도해 주세요.';
  if (e?.code === '42501' || e?.status === 401 || e?.status === 403) return '권한이 없거나 로그인이 만료되었어요. 다시 로그인해 주세요.';
  if (e?.code === '23514' || e?.code === '22001') return '서버가 제출 내용을 받아들이지 않았어요. 내용을 확인해 주세요.';
  return '서버 요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

function fail(error: unknown): never { throw new CloudRequestError(cloudErrorMessage(error)); }

async function boundedRequest<T>(request: PromiseLike<T>, message = '서버 응답이 늦어 확인을 멈췄어요. 내 기록은 그대로예요. 잠시 후 다시 확인해 주세요.'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CloudRequestError(message)), 15_000);
    })]);
  } catch (error) { fail(error); }
  finally { clearTimeout(timer); }
}

export async function requestMagicLink(client: SupabaseClient, email: string, redirectTo: string) {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw new Error('올바른 이메일 주소를 입력해 주세요.');
  const { error } = await boundedRequest(client.auth.signInWithOtp({ email: parsed.data, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } }), '로그인 링크 요청 결과를 확인하지 못했어요. 메일함과 스팸함을 먼저 확인한 뒤 잠시 후 다시 요청해 주세요.');
  if (error) fail(error);
}

export async function fetchAlias(client: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await boundedRequest(client.from('profiles').select('alias').eq('user_id', userId).maybeSingle());
  if (error) fail(error);
  return data ? z.object({ alias: z.string() }).parse(data).alias : null;
}

export async function createAlias(client: SupabaseClient, alias: string): Promise<string> {
  const parsed = aliasSchema.safeParse(alias);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? '별칭을 확인해 주세요.');
  const { data, error } = await client.from('profiles').insert({ alias: parsed.data }).select('alias').single();
  if (error) fail(error);
  return z.object({ alias: z.string() }).parse(data).alias;
}

export async function submitObservation(client: SupabaseClient, payload: SubmissionPayload): Promise<void> {
  const safe = submissionPayloadSchema.parse(payload);
  const { error } = await client.from('community_submissions').insert(safe);
  if (error) fail(error);
}

export async function listMySubmissions(client: SupabaseClient, userId: string): Promise<MySubmission[]> {
  const { data, error } = await boundedRequest(client.from('community_submissions').select(MY_COLUMNS).eq('owner_id', userId).order('created_at', { ascending: false }).limit(30));
  if (error) fail(error);
  return z.array(mySubmissionSchema).parse(data ?? []);
}

export async function withdrawSubmission(client: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await client.from('community_submissions').delete().eq('id', id).select('id');
  if (error) fail(error);
  if (!data || data.length === 0) throw new Error('이미 삭제되었거나 내 제출이 아니에요. 목록을 새로고침해 주세요.');
}

export const FEED_PAGE = 6;
export async function listFeed(client: SupabaseClient, offset: number): Promise<FeedItem[]> {
  const { data, error } = await boundedRequest(client.from('community_feed').select(FEED_COLUMNS).order('approved_at', { ascending: false }).range(offset, offset + FEED_PAGE - 1));
  if (error) fail(error);
  return z.array(feedItemSchema).parse(data ?? []);
}
