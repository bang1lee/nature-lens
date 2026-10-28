'use client';
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Observation} from '@/lib/domain';
import {cloudConfig,CLOUD_DISABLED_TEXT} from '@/lib/cloud/config';
import {getSupabase} from '@/lib/cloud/client';
import {buildSubmissionPayload,type FeedItem,type MySubmission} from '@/lib/cloud/contract';
import {requestMagicLink,fetchAlias,createAlias,listMySubmissions,listFeed,submitObservation,withdrawSubmission,cloudErrorMessage} from '@/lib/cloud/api';
export default function CloudPanel({records}:{records:Observation[]}){
 const client=useRef<SupabaseClient|null>(null);const epoch=useRef(0);const lock=useRef(false);const alive=useRef(false);const feedTicket=useRef(0);
 const [uid,setUid]=useState<string|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [attempt,setAttempt]=useState(0),[authError,setAuthError]=useState(''),[cooldown,setCooldown]=useState(false);
 const [community,setCommunity]=useState<'loading'|'ready'|'error'>('loading'),[communityError,setCommunityError]=useState('');
 const [feedState,setFeedState]=useState<'loading'|'ready'|'error'>('loading'),[feedError,setFeedError]=useState('');
 const [email,setEmail]=useState(''),[alias,setAlias]=useState<string|null>(null),[aliasInput,setAliasInput]=useState('');
 const [mine,setMine]=useState<MySubmission[]>([]),[feed,setFeed]=useState<FeedItem[]>([]),[selected,setSelected]=useState('');
 const [consent,setConsent]=useState(false),[noPeople,setNoPeople]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(false),60_000);return()=>clearTimeout(timer);},[cooldown]);
 async function loadCommunity(c:SupabaseClient,id:string,ticket:number){
  setCommunity('loading');setCommunityError('');
  try{const [a,m]=await Promise.all([fetchAlias(c,id),listMySubmissions(c,id)]);if(alive.current&&ticket===epoch.current){setAlias(a);setMine(m);setCommunity('ready');}}
  catch(e){if(alive.current&&ticket===epoch.current){setCommunityError(cloudErrorMessage(e));setCommunity('error');}}
 }
 async function loadFeed(c:SupabaseClient){
  const ticket=++feedTicket.current;setFeedState('loading');setFeedError('');
  try{const f=await listFeed(c,0);if(alive.current&&ticket===feedTicket.current){setFeed(f);setFeedState('ready');}}
  catch(e){if(alive.current&&ticket===feedTicket.current){setFeedError(cloudErrorMessage(e));setFeedState('error');}}
 }
 useEffect(()=>{if(!cloudConfig.enabled)return;let active=true;alive.current=true;let unsub:(()=>void)|undefined;let currentId:string|null|undefined;
 setReady(false);setAuthError('');
 const timer=setTimeout(()=>{if(active&&currentId===undefined)setAuthError('로그인 상태를 확인하지 못했어요. 내 기록은 그대로예요. 연결을 확인하고 다시 시도해 주세요.');},10_000);
 const changed=(id:string|null)=>{
  clearTimeout(timer);setReady(true);setAuthError('');if(currentId===id)return;currentId=id;
  const ticket=++epoch.current;setUid(id);setMine([]);setAlias(null);setSelected('');setConsent(false);setNoPeople(false);setMessage('');setError('');setCommunityError('');
  if(id&&client.current)void loadCommunity(client.current,id,ticket);
 };
 void getSupabase().then(async c=>{if(!active)return;client.current=c;void loadFeed(c);
 const {data}=c.auth.onAuthStateChange((_event,s)=>{if(active)changed(s?.user.id??null);});unsub=()=>data.subscription.unsubscribe();
 const {data:s,error:e}=await c.auth.getSession();if(e)throw e;if(active&&currentId===undefined)changed(s.session?.user.id??null);
 }).catch(e=>{if(active&&currentId===undefined){clearTimeout(timer);setAuthError(cloudErrorMessage(e));}});
 return()=>{active=false;alive.current=false;clearTimeout(timer);++epoch.current;++feedTicket.current;unsub?.();client.current=null;};},[attempt]);
 async function action(work:(c:SupabaseClient,t:number)=>Promise<void>){if(lock.current||!client.current)return;lock.current=true;setBusy(true);setError('');setMessage('');const t=epoch.current;
 try{await work(client.current,t);}catch(e){if(alive.current&&t===epoch.current)setError(e instanceof Error?e.message:cloudErrorMessage(e));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 if(!cloudConfig.enabled)return <section className="m-settings-note"><h2>함께 관찰하기 · 연결 준비</h2><p>{CLOUD_DISABLED_TEXT[cloudConfig.reason]}</p><p>내 기록은 계속 이 기기에 보관됩니다. 홈의 이야기와 공감은 가상 예시이며 실제 커뮤니티와 별개입니다.</p></section>;
 const local=records.filter(r=>!r.demo);
 return <section className="m-settings-note m-cloud"><h2>함께 관찰하기</h2><p>내 기록은 자동 전송되지 않아요. 선택한 기록만 동의를 확인한 뒤 검수 대기열로 보냅니다.</p>
 {authError?<><p className="m-error" role="alert">{authError}</p><button className="m-secondary" onClick={()=>setAttempt(n=>n+1)}>로그인 상태 다시 확인</button></>:!ready?<p role="status">로그인 상태 확인 중…</p>:!uid?<form onSubmit={e=>{e.preventDefault();if(cooldown)return;void action(async(c,t)=>{setCooldown(true);await requestMagicLink(c,email,`${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH||''}/mobile/`);if(t===epoch.current)setMessage('로그인 링크를 요청했어요. 같은 브라우저에서 이메일의 링크를 열어 주세요.');});}}><label>로그인 이메일<input type="email" required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><button disabled={busy||cooldown} className="m-primary">이메일 로그인 링크 받기</button>{cooldown&&<p>메일함과 스팸함을 확인해 주세요. 다시 요청하려면 잠시 기다려 주세요.</p>}</form>:<>
 <p>로그인되어 있어요.</p>
 <button className="m-text" disabled={busy} onClick={()=>void action(async c=>{const {error:e}=await c.auth.signOut();if(e)throw new Error(cloudErrorMessage(e));})}>로그아웃</button>
 {community==='loading'?<p role="status">공동 관찰 연결 확인 중… 내 기록은 계속 이용할 수 있어요.</p>:community==='error'?<><p className="m-error" role="alert">{communityError}</p><button className="m-secondary" disabled={busy} onClick={()=>{if(client.current)void loadCommunity(client.current,uid,epoch.current);}}>공동 관찰 연결 다시 확인</button></>:<>
 {!alias?<form onSubmit={e=>{e.preventDefault();void action(async(c,t)=>{const a=await createAlias(c,aliasInput);if(t===epoch.current)setAlias(a);});}}><label>공개 별칭<input value={aliasInput} maxLength={20} onChange={e=>setAliasInput(e.target.value)} required/></label><p>이메일 대신 표시할 2–20자 별칭입니다.</p><button disabled={busy} className="m-secondary">별칭 저장</button></form>:<p>공개 별칭: {alias}</p>}
 <form onSubmit={e=>{e.preventDefault();const o=records.find(r=>r.id===selected);if(!o)return;const r=buildSubmissionPayload(o,{uploadConsent:consent,noPeople});if(!r.ok){setError(r.issues.join(' '));return;}void action(async(c,t)=>{await submitObservation(c,r.payload);if(t!==epoch.current)return;setConsent(false);setNoPeople(false);setMessage('검수 대기열에 제출했어요. 아직 공개되지 않았습니다.');const m=await listMySubmissions(c,uid);if(t===epoch.current)setMine(m);});}}>
 <label>제출할 내 기록<select required value={selected} onChange={e=>{setSelected(e.target.value);setConsent(false);setNoPeople(false);}}><option value="">기록을 선택하세요</option>{local.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
 <p>이름·메모·출판 동의를 작업실에서 확인한 기록만 제출할 수 있어요. 선택한 사진, 제목, 이름, 관찰일, 메모, 서식 환경과 생물군을 서버에 보관하며 승인 후 공개합니다. 위치는 전송하지 않습니다. 사진·글에 주소나 연락처가 없는지 확인하세요.</p>
 <label className="m-cloud-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>이 기록의 서버 전송·검수·승인 후 공개에 동의합니다</label><label className="m-cloud-check"><input type="checkbox" checked={noPeople} onChange={e=>setNoPeople(e.target.checked)}/>사진에 사람·개인정보가 없음을 확인했습니다</label><button className="m-primary" disabled={busy||!alias||!selected||!consent||!noPeople}>검수 대기열에 제출</button></form>
 <h3>내 제출과 철회</h3>{mine.length===0?<p>제출한 기록이 없어요.</p>:mine.map(m=><article key={m.id}><strong>{m.title}</strong><p>{({pending:'검수 대기',approved:'공개됨',rejected:'검수 반려'})[m.status]}</p>{m.moderation_note&&<p>{m.moderation_note}</p>}<button className="m-secondary" disabled={busy} onClick={()=>{if(!confirm('서버 제출을 철회하고 삭제할까요? 기기의 원본은 유지됩니다.'))return;void action(async(c,t)=>{await withdrawSubmission(c,m.id);if(t===epoch.current){setMine(x=>x.filter(a=>a.id!==m.id));setFeed(x=>x.filter(a=>a.id!==m.id));setMessage('서버 제출을 철회했습니다.');}});}}>서버 제출 철회</button></article>)}</>}</>}
 <p role="status">{busy?'처리 중…':message}</p>{error&&<p className="m-error" role="alert">{error}</p>}
 <h3>승인된 공동 관찰</h3><p>최근 최대 6건 · 가상 예시가 아닌 서버 승인 기록</p><button className="m-text" disabled={busy||feedState==='loading'||!client.current} onClick={()=>{if(client.current)void loadFeed(client.current);}}>공동 관찰 새로고침</button>{feedState==='loading'?<p role="status">공동 관찰 목록 확인 중…</p>:feedState==='error'?<p className="m-error" role="alert">{feedError}</p>:feed.length===0?<p>현재 표시할 승인 기록이 없어요.</p>:feed.map(f=><article key={f.id}><img src={f.photo} alt={f.title}/><h3>{f.title}</h3><p>{f.author_alias} · {f.observed_on} · {f.species}</p><p>{f.notes}</p></article>)}
 </section>;
}
