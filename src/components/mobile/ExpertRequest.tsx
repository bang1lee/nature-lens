'use client';
import { useEffect, useRef, useState } from 'react';
import { cloudConfig } from '@/lib/cloud/config';
import { getSupabase } from '@/lib/cloud/client';
type Response = { id: string; expert_id: string; response: string; created_at: string };
type Request = {
  id: string;
  question: string;
  created_at: string;
  submission_id: string | null;
  expert_responses: Response[];
};
type Submission = { id: string; title: string };
export default function ExpertRequest({
  observationId,
  demo = false,
}: {
  observationId: string;
  demo?: boolean;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]),
    [linked, setLinked] = useState(''),
    [linkConsent, setLinkConsent] = useState(false);
  const [available, setAvailable] = useState(false),
    [checked, setChecked] = useState(false),
    [question, setQuestion] = useState(''),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [mine, setMine] = useState<Request | null>(null),
    [refresh, setRefresh] = useState(0);
  const epoch = useRef(0),
    identity = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    let unsubscribe: undefined | (() => void);
    void getSupabase()
      .then((client) => {
        if (!active) return;
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          const next = session?.user && !session.user.is_anonymous ? session.user.id : null;
          if (identity.current === next) return;
          identity.current = next;
          epoch.current++;
          setMine(null);
          setSubmissions([]);
          setLinked('');
          setLinkConsent(false);
          setQuestion('');
          setConsent(false);
          setMessage('');
          setBusy(false);
          setRefresh((x) => x + 1);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {});
    return () => {
      active = false;
      epoch.current++;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    let active = true;
    const generation = epoch.current;
    const current = () => active && generation === epoch.current;
    void (async () => {
      try {
        if (!cloudConfig.enabled) return;
        const client = await getSupabase();
        const { data, error } = await client
          .from('expert_service_settings')
          .select('accepting')
          .eq('id', true)
          .maybeSingle();
        if (!error && current()) setAvailable(data?.accepting === true);
        const { data: auth } = await client.auth.getUser();
        if (!current() || !auth.user || auth.user.is_anonymous || auth.user.id !== identity.current)
          return;
        const owner = auth.user.id;
        const submitted = await client
          .from('community_submissions')
          .select('id,title')
          .eq('owner_id', owner)
          .order('created_at', { ascending: false })
          .limit(100);
        if (current() && !submitted.error) setSubmissions(submitted.data as Submission[]);
        const result = await client
          .from('expert_requests')
          .select(
            'id,question,created_at,submission_id,expert_responses(id,expert_id,response,created_at)',
          )
          .eq('owner_id', owner)
          .eq('observation_id', observationId)
          .maybeSingle();
        if (result.error) {
          if (current()) setMessage('요청 상태를 불러오지 못했어요. 다시 확인해 주세요.');
        } else if (current()) setMine(result.data as Request | null);
      } catch {
        if (current()) setMessage('연결 상태를 확인하지 못했어요.');
      } finally {
        if (current()) setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [observationId, refresh]);
  async function submit() {
    if (
      busy ||
      !consent ||
      !question.trim() ||
      !cloudConfig.enabled ||
      !available ||
      demo ||
      (linked && !linkConsent)
    )
      return;
    const generation = epoch.current;
    const owner = identity.current;
    const current = () => generation === epoch.current && owner === identity.current;
    setBusy(true);
    setMessage('');
    try {
      const client = await getSupabase();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (!current()) return;
      if (authError || !owner || !auth.user || auth.user.is_anonymous || auth.user.id !== owner) {
        setMessage('전문가 요청에는 회원 로그인이 필요해요. 설정에서 로그인해 주세요.');
        return;
      }
      const { error } = await client
        .from('expert_requests')
        .insert({
          owner_id: owner,
          observation_id: observationId,
          question: question.trim(),
          submission_id: linked || null,
        });
      if (!current()) return;
      if (error) {
        setMessage(
          error.code === '23505'
            ? '이미 이 기록으로 요청했어요. 상태를 다시 확인해 주세요.'
            : '현재 요청을 접수할 수 없어요. 운영 준비 상태를 확인해 주세요.',
        );
        return;
      }
      setQuestion('');
      setConsent(false);
      setLinked('');
      setLinkConsent(false);
      setMessage('요청을 접수했어요. 답변 시점은 정해져 있지 않습니다.');
      setRefresh((x) => x + 1);
    } catch {
      if (current())
        setMessage(
          '접수 결과를 확인하지 못했어요. 중복 요청을 피하려면 상태를 다시 확인해 주세요.',
        );
    } finally {
      if (current()) setBusy(false);
    }
  }
  async function withdraw() {
    if (
      !mine ||
      busy ||
      !confirm('전문가 요청과 답변을 서버에서 삭제할까요? 기기 기록은 유지됩니다.')
    )
      return;
    const owner = identity.current,
      generation = epoch.current;
    const current = () => generation === epoch.current && owner === identity.current;
    if (!owner) return;
    setBusy(true);
    try {
      const client = await getSupabase();
      if (!current()) return;
      const { data, error } = await client
        .from('expert_requests')
        .delete()
        .eq('id', mine.id)
        .eq('owner_id', owner)
        .select('id');
      if (!current()) return;
      if (error || !data?.length) throw Error();
      setMine(null);
      setMessage('요청과 답변을 철회했어요.');
    } catch {
      if (current()) setMessage('철회 결과를 확인하지 못했어요. 상태를 다시 확인해 주세요.');
    } finally {
      if (current()) setBusy(false);
    }
  }
  return (
    <details className="m-private-note">
      <summary>전문가 확인 요청</summary>
      <p>
        질문과 기기 기록 ID를 전송해요. 이미 공동 관찰에 제출한 내 기록을 따로 선택해 연결할 수
        있어요. 새 사진과 위치는 자동 전송하지 않습니다. 전문가 운영이 준비되면 접수할 수 있으며
        답변 시간은 약속하지 않아요.
      </p>
      <button
        type="button"
        className="m-text"
        disabled={busy}
        onClick={() => setRefresh((x) => x + 1)}
      >
        요청 상태 다시 확인
      </button>
      {mine ? (
        <article>
          <p>요청 접수 · {mine.question}</p>
          <p>{mine.submission_id ? '공동 관찰 기록 연결됨' : '사진 연결 없는 일반 질문'}</p>
          {mine.expert_responses.length ? (
            mine.expert_responses.map((r) => (
              <p key={r.id}>
                <strong>전문가 {r.expert_id}</strong> · {r.response}
              </p>
            ))
          ) : (
            <p>아직 등록된 전문가 답변이 없어요.</p>
          )}
          <button
            type="button"
            className="m-secondary"
            disabled={busy}
            onClick={() => void withdraw()}
          >
            요청 철회
          </button>
        </article>
      ) : !checked ? (
        <p>운영 상태를 확인하고 있어요.</p>
      ) : !available ? (
        <p>현재 전문가 요청은 운영 준비 중이에요.</p>
      ) : demo ? (
        <p>저장된 실제 기록에서 요청할 수 있어요.</p>
      ) : (
        <>
          <label>
            확인하고 싶은 내용
            <textarea
              maxLength={500}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="특징이나 질문을 적어 주세요"
            />
          </label>
          <p>주소, 연락처와 정확한 위치를 적지 마세요.</p>
          <label>
            전문가에게 보여줄 기존 제출 기록 (선택)
            <select
              value={linked}
              onChange={(e) => {
                setLinked(e.target.value);
                setLinkConsent(false);
              }}
            >
              <option value="">연결하지 않음 · 일반 질문</option>
              {submissions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          {linked && (
            <label>
              <input
                type="checkbox"
                checked={linkConsent}
                onChange={(e) => setLinkConsent(e.target.checked)}
              />
              선택한 기존 공동 관찰 기록과 사진을 전문가가 확인하는 데 동의합니다
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            질문과 기록 ID의 서버 전송에 동의합니다
          </label>
          <button
            type="button"
            className="m-secondary"
            disabled={
              busy ||
              !cloudConfig.enabled ||
              !consent ||
              !question.trim() ||
              Boolean(linked && !linkConsent)
            }
            onClick={() => void submit()}
          >
            확인 요청 보내기
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </details>
  );
}
