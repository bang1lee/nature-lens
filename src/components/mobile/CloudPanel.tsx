'use client';
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Observation} from '@/lib/domain';
import {cloudConfig,CLOUD_DISABLED_TEXT} from '@/lib/cloud/config';
import {getSupabase} from '@/lib/cloud/client';
import {buildSubmissionPayload,type FeedItem,type MySubmission} from '@/lib/cloud/contract';
import {fetchAlias,createAlias,listMySubmissions,listFeed,submitObservation,withdrawSubmission,cloudErrorMessage,listMapAreas} from '@/lib/cloud/api';
import EmailSignIn from './EmailSignIn';
export default function CloudPanel({records,onEditRecord}:{records:Observation[];onEditRecord?:(record:Observation)=>void}){
 const client=useRef<SupabaseClient|null>(null);const epoch=useRef(0);const lock=useRef(false);const alive=useRef(false);const feedTicket=useRef(0);const areaTicket=useRef(0);
 const [uid,setUid]=useState<string|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [attempt,setAttempt]=useState(0),[authError,setAuthError]=useState('');
 const [community,setCommunity]=useState<'loading'|'ready'|'error'>('loading'),[communityError,setCommunityError]=useState('');
 const [feedState,setFeedState]=useState<'loading'|'ready'|'error'>('loading'),[feedError,setFeedError]=useState('');
 const [alias,setAlias]=useState<string|null>(null),[aliasInput,setAliasInput]=useState('');
 const [mine,setMine]=useState<MySubmission[]>([]),[feed,setFeed]=useState<FeedItem[]>([]),[selected,setSelected]=useState('');
 const [areas,setAreas]=useState<{id:string;label:string}[]>([]),[mapArea,setMapArea]=useState(''),[mapConsent,setMapConsent]=useState(false);
 const [areaState,setAreaState]=useState<'loading'|'ready'|'error'>('loading'),[mineWarning,setMineWarning]=useState('');
 const [consent,setConsent]=useState(false),[noPeople,setNoPeople]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function loadCommunity(c:SupabaseClient,id:string,ticket:number){
  setCommunity('loading');setCommunityError('');
  try{const [a,m]=await Promise.all([fetchAlias(c,id),listMySubmissions(c,id)]);if(alive.current&&ticket===epoch.current){setAlias(a);setMine(m);setCommunity('ready');}}
  catch(e){if(alive.current&&ticket===epoch.current){setCommunityError(cloudErrorMessage(e));setCommunity('error');}}
 }
 async function loadAreas(c:SupabaseClient){
  const ticket=++areaTicket.current;setAreaState('loading');
  try{const a=await listMapAreas(c);if(alive.current&&ticket===areaTicket.current){setAreas(a);setMapArea(previous=>a.some(area=>area.id===previous)?previous:'');setMapConsent(false);setAreaState('ready');}}
  catch{if(alive.current&&ticket===areaTicket.current){setAreas([]);setMapArea('');setMapConsent(false);setAreaState('error');}}
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
  const ticket=++epoch.current;setUid(id);setMine([]);setAlias(null);setSelected('');setConsent(false);setNoPeople(false);setMapArea('');setMapConsent(false);setMessage('');setError('');setCommunityError('');setMineWarning('');
  if(id&&client.current)void loadCommunity(client.current,id,ticket);
 };
 void getSupabase().then(async c=>{if(!active)return;client.current=c;void loadFeed(c);void loadAreas(c);
 const {data}=c.auth.onAuthStateChange((_event,s)=>{if(active)changed(s&&!s.user.is_anonymous?s.user.id:null);});unsub=()=>data.subscription.unsubscribe();
 const {data:s,error:e}=await c.auth.getSession();if(e)throw e;if(active&&currentId===undefined)changed(s.session&&!s.session.user.is_anonymous?s.session.user.id:null);
 }).catch(e=>{if(active&&currentId===undefined){clearTimeout(timer);setAuthError(cloudErrorMessage(e));}});
 return()=>{active=false;alive.current=false;clearTimeout(timer);++epoch.current;++feedTicket.current;++areaTicket.current;unsub?.();client.current=null;};},[attempt]);
 async function action(work:(c:SupabaseClient,t:number)=>Promise<void>){if(lock.current||!client.current)return;lock.current=true;setBusy(true);setError('');setMessage('');const t=epoch.current;
 try{await work(client.current,t);}catch(e){if(alive.current&&t===epoch.current)setError(e instanceof Error?e.message:cloudErrorMessage(e));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 if(!cloudConfig.enabled)return <section className="m-settings-note"><h2>함께 관찰하기 · 연결 준비</h2><p>{CLOUD_DISABLED_TEXT[cloudConfig.reason]}</p><p>내 기록은 계속 이 기기에 보관됩니다. 홈의 이야기와 공감은 가상 예시이며 실제 커뮤니티와 별개입니다.</p></section>;
 const local=records.filter(r=>!r.demo);const selectedRecord=local.find(r=>r.id===selected);const readiness=selectedRecord?buildSubmissionPayload(selectedRecord,{uploadConsent:true,noPeople:true}):null;
 return <section className="m-settings-note m-cloud"><h2>함께 관찰하기</h2><p>내 기록은 자동 전송되지 않아요. 선택한 기록만 동의를 확인한 뒤 검수 대기열로 보냅니다.</p>
 {authError?<><p className="m-error" role="alert">{authError}</p><button className="m-secondary" onClick={()=>setAttempt(n=>n+1)}>로그인 상태 다시 확인</button></>:!ready?<p role="status">로그인 상태 확인 중…</p>:!uid?<EmailSignIn/>:<>
 <p>로그인되어 있어요.</p>
 <button className="m-text" disabled={busy} onClick={()=>void action(async c=>{const {error:e}=await c.auth.signOut();if(e)throw new Error(cloudErrorMessage(e));})}>로그아웃</button>
 {community==='loading'?<p role="status">공동 관찰 연결 확인 중… 내 기록은 계속 이용할 수 있어요.</p>:community==='error'?<><p className="m-error" role="alert">{communityError}</p><button className="m-secondary" disabled={busy} onClick={()=>{if(client.current)void loadCommunity(client.current,uid,epoch.current);}}>공동 관찰 연결 다시 확인</button></>:<>
 {!alias?<form onSubmit={e=>{e.preventDefault();void action(async(c,t)=>{const a=await createAlias(c,aliasInput);if(t===epoch.current)setAlias(a);});}}><label>공개 별칭<input value={aliasInput} maxLength={20} onChange={e=>setAliasInput(e.target.value)} required/></label><p>이메일 대신 표시할 2–20자 별칭입니다.</p><button disabled={busy} className="m-secondary">별칭 저장</button></form>:<p>공개 별칭: {alias}</p>}
 <form onSubmit={e=>{e.preventDefault();const o=records.find(r=>r.id===selected);if(!o)return;const r=buildSubmissionPayload(o,{uploadConsent:consent,noPeople});if(!r.ok){setError(r.issues.join(' '));return;}void action(async(c,t)=>{await submitObservation(c,mapConsent?{...r.payload,map_area_id:mapArea,consent_map:true}:r.payload);if(t!==epoch.current)return;setConsent(false);setNoPeople(false);setSelected('');setMapArea('');setMapConsent(false);setMineWarning('');setMessage('검수 대기열에 제출했어요. 아직 공개되지 않았습니다.');try{const m=await listMySubmissions(c,uid);if(t===epoch.current)setMine(m);}catch{if(t===epoch.current)setMineWarning('제출은 완료했지만 목록을 갱신하지 못했어요. 목록을 다시 확인해 주세요.');}});}}>
 <label>제출할 내 기록<select required value={selected} onChange={e=>{setSelected(e.target.value);setConsent(false);setNoPeople(false);setMapArea('');setMapConsent(false);}}><option value="">기록을 선택하세요</option>{local.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
 {selectedRecord&&onEditRecord&&<button type="button" className="m-secondary" onClick={()=>{setConsent(false);setNoPeople(false);setMapConsent(false);onEditRecord(selectedRecord);}}>선택한 기록 수정</button>}{readiness&&!readiness.ok&&<p role="status">제출 전 확인: {readiness.issues.join(' ')}</p>}<p>이름·메모·출판 동의를 {onEditRecord?'선택한 기록 수정에서':'작업실에서'} 확인한 기록만 제출할 수 있어요. 선택한 사진, 제목, 이름, 관찰일, 메모, 서식 환경과 생물군을 서버에 보관하며 승인 후 공개합니다. 정밀 GPS는 전송하지 않으며 지도 공개에 동의하면 선택한 구역 ID를 전송합니다. 사진·글에 주소나 연락처가 없는지 확인하세요.</p>
 {areaState==='error'&&<><p role="alert">지도 공개 구역을 불러오지 못했어요. 내 기록 제출은 계속할 수 있어요.</p><button type="button" className="m-text" onClick={()=>{if(client.current)void loadAreas(client.current);}}>지도 구역 다시 확인</button></>}{areaState==='loading'&&<p role="status">지도 공개 구역 확인 중…</p>}{areaState==='ready'&&areas.length===0&&<p>현재 선택할 수 있는 지도 공개 구역이 없어요.</p>}{areas.length>0&&<fieldset><legend>지도 공개 · 선택</legend><button type="button" className="m-text" onClick={()=>{if(client.current)void loadAreas(client.current);}}>지도 구역 다시 확인</button><p>운영 검수에서 공개에 적합한 일반 생물로 확인되고 승인된 기록만 구역 대표 지점에 표시돼요. 실제 GPS는 보내지 않아요.</p><label>공개 구역<select value={mapArea} onChange={e=>{setMapArea(e.target.value);setMapConsent(false);}}><option value="">지도에 표시하지 않음</option>{areas.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>{mapArea&&<label className="m-cloud-check"><input type="checkbox" checked={mapConsent} onChange={e=>setMapConsent(e.target.checked)}/>선택한 구역의 대표 지점에 이 기록을 공개하는 데 동의합니다</label>}</fieldset>}<label className="m-cloud-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>이 기록의 서버 전송·검수·승인 후 공개에 동의합니다</label><label className="m-cloud-check"><input type="checkbox" checked={noPeople} onChange={e=>setNoPeople(e.target.checked)}/>사진에 사람·개인정보가 없음을 확인했습니다</label><button className="m-primary" disabled={busy||!alias||!selected||!consent||!noPeople||areaState==='loading'||(!!mapArea&&!mapConsent)}>검수 대기열에 제출</button></form>
 <h3>내 제출과 철회</h3>{mineWarning&&<p role="status">{mineWarning}</p>}<button type="button" className="m-text" disabled={busy} onClick={()=>void action(async(c,t)=>{const m=await listMySubmissions(c,uid);if(t===epoch.current){setMine(m);setMineWarning('');}})}>내 제출 목록 다시 확인</button>{mine.length===0?<p>제출한 기록이 없어요.</p>:mine.map(m=><article key={m.id}><strong>{m.title}</strong><p>{({pending:'검수 대기',approved:'공개됨',rejected:'검수 반려'})[m.status]}</p><p>{m.consent_map&&m.map_area_id?`지도 공개 동의 · ${areas.find(a=>a.id===m.map_area_id)?.label??'선택한 구역'}`:'지도에 표시하지 않음'}</p>{m.moderation_note&&<p>{m.moderation_note}</p>}<button className="m-secondary" disabled={busy} onClick={()=>{if(!confirm('서버 제출을 철회하고 삭제할까요? 기기의 원본은 유지됩니다.'))return;void action(async(c,t)=>{await withdrawSubmission(c,m.id);if(t===epoch.current){setMine(x=>x.filter(a=>a.id!==m.id));setFeed(x=>x.filter(a=>a.id!==m.id));setMessage('서버 제출을 철회했습니다.');}});}}>서버 제출 철회</button></article>)}</>}</>}
 <p role="status">{busy?'처리 중…':message}</p>{error&&<p className="m-error" role="alert">{error}</p>}
 <h3>승인된 공동 관찰</h3><p>최근 최대 6건 · 가상 예시가 아닌 서버 승인 기록</p><button className="m-text" disabled={busy||feedState==='loading'||!client.current} onClick={()=>{if(client.current)void loadFeed(client.current);}}>공동 관찰 새로고침</button>{feedState==='loading'?<p role="status">공동 관찰 목록 확인 중…</p>:feedState==='error'?<p className="m-error" role="alert">{feedError}</p>:feed.length===0?<p>현재 표시할 승인 기록이 없어요.</p>:feed.map(f=><article key={f.id}><img src={f.photo} alt={f.title}/><h3>{f.title}</h3><p>{f.author_alias} · {f.observed_on} · {f.species}</p><p>{f.notes}</p></article>)}
 </section>;
}
