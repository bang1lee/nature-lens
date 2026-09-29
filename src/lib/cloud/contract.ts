import { z } from 'zod';
import { observationSchema, publicationIssues, type Observation } from '../domain';
import { regionLabelSchema } from '../location';

const RESERVED = /^(admin|administrator|root|system|nature.?lens|newleaf|new.?leaf|운영자|관리자|뉴리프|네이처렌즈)$/i;
export const aliasSchema = z.string().trim().regex(/^[0-9A-Za-z가-힣_]{2,20}$/, '별칭은 2–20자의 한글·영문·숫자·밑줄만 쓸 수 있어요.').refine(v => !RESERVED.test(v), '사용할 수 없는 별칭이에요.');
export const emailSchema = z.string().trim().max(254).pipe(z.email('올바른 이메일 주소를 입력해 주세요.'));

export const submissionPayloadSchema = z.object({
  title: z.string().min(1).max(120), species: z.string().min(1).max(100), scientific_name: z.string().max(140),
  observed_on: observationSchema.shape.date, notes: z.string().min(1).max(4000), habitat: z.string().max(150),
  taxon_group: z.enum(['plant', 'insect', 'other']), region: regionLabelSchema.nullable(),
  protection: z.enum(['unknown', 'protected', 'common']), photo: observationSchema.shape.photo,
  consent_upload: z.literal(true), no_people: z.literal(true), ai_assisted: z.boolean(),
}).strict();
export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;

export type SubmitConfirmation = { uploadConsent: boolean; noPeople: boolean };
export type PayloadResult = { ok: true; payload: SubmissionPayload } | { ok: false; issues: string[] };

export function buildSubmissionPayload(o: Observation, confirm: SubmitConfirmation): PayloadResult {
  const issues: string[] = [];
  if (o.demo) issues.push('가상 예제 기록은 커뮤니티에 제출할 수 없어요.');
  if (!o.photo) issues.push('사진이 있는 기록만 제출할 수 있어요.');
  if (!confirm.uploadConsent) issues.push('업로드 동의를 체크해 주세요.');
  if (!confirm.noPeople) issues.push('사진에 사람·개인정보가 없는지 다시 확인해 주세요.');
  issues.push(...publicationIssues(o));
  if (issues.length) return { ok: false, issues };
  const parsed = submissionPayloadSchema.safeParse({
    title: o.title, species: o.species, scientific_name: o.scientificName, observed_on: o.date, notes: o.notes, habitat: o.habitat,
    taxon_group: o.taxonGroup ?? 'other', region: null, protection: o.protection,
    photo: o.photo, consent_upload: true, no_people: true, ai_assisted: o.aiAssisted,
  });
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false, issues: ['기록 내용이 제출 형식에 맞지 않아요. 제목·이름·메모·사진을 확인해 주세요.'] };
}

export const mySubmissionSchema = z.object({
  id: z.uuid(), title: z.string().max(120), species: z.string().max(100), observed_on: z.string().max(10),
  status: z.enum(['pending', 'approved', 'rejected']), created_at: z.string().max(40), moderation_note: z.string().max(500).nullable(),
});
export type MySubmission = z.infer<typeof mySubmissionSchema>;

export const feedItemSchema = z.object({
  id: z.uuid(), title: z.string().max(120), species: z.string().max(100), scientific_name: z.string().max(140), observed_on: z.string().max(10),
  notes: z.string().max(4000), taxon_group: z.enum(['plant', 'insect', 'other']), region: regionLabelSchema.nullable(),
  photo: observationSchema.shape.photo, author_alias: z.string().max(20), approved_at: z.string().max(40),
});
export type FeedItem = z.infer<typeof feedItemSchema>;

export const FEED_COLUMNS = 'id,title,species,scientific_name,observed_on,notes,taxon_group,region,photo,author_alias,approved_at';
export const MY_COLUMNS = 'id,title,species,observed_on,status,created_at,moderation_note';
