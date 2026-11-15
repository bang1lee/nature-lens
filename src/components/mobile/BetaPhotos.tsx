'use client';

import {useEffect, useRef, useState} from 'react';
import type {Session, SupabaseClient} from '@supabase/supabase-js';
import {Check, Globe2, Images, LoaderCircle} from 'lucide-react';
import type {Observation} from '@/lib/domain';
import {saveObservation} from '@/lib/storage';
import {getSupabase} from '@/lib/cloud/client';
import {cloudConfig} from '@/lib/cloud/config';
import {
  listBetaFeed,
  listMyBetaObservations,
  publishBetaObservation,
  restoreBetaObservation,
  type BetaFeedItem,
  type BetaOwnedObservation,
} from '@/lib/cloud/beta-public';
import EmailSignIn from './EmailSignIn';
import './beta-photos.css';

type AuthState = {kind:'checking'|'signed-out'|'error'} | {kind:'signed-in'; id:string};

// An auth event invalidates pending work synchronously, before React re-renders.
function useBetaSession() {
  const [state,setState]=useState<AuthState>({kind:'checking'});
  const [attempt,setAttempt]=useState(0);
  const client=useRef<SupabaseClient|null>(null);
  const epoch=useRef(0);
  useEffect(()=>{
    if(!cloudConfig.enabled)return;
    let active=true;
    let last:string|null|undefined;
    let unsubscribe:(()=>void)|undefined;
    setState({kind:'checking'});
    const timer=setTimeout(()=>{if(active&&last===undefined)setState({kind:'error'});},10_000);
    const changed=(session:Session|null)=>{
      if(!active)return;
      clearTimeout(timer);
      const id=session&&!session.user.is_anonymous?session.user.id:null;
      if(last===id)return;
      last=id;
      ++epoch.current;
      setState(id?{kind:'signed-in',id}:{kind:'signed-out'});
    };
    void getSupabase().then(async c=>{
      if(!active)return;
      client.current=c;
      const {data}=c.auth.onAuthStateChange((_event,session)=>changed(session));
      unsubscribe=()=>data.subscription.unsubscribe();
      const {data:session,error}=await c.auth.getSession();
      if(error)throw error;
      if(last===undefined)changed(session.session);
    }).catch(()=>{if(active&&last===undefined){clearTimeout(timer);setState({kind:'error'});}});
    return()=>{active=false;clearTimeout(timer);++epoch.current;unsubscribe?.();client.current=null;};
  },[attempt]);
  return {state,client,epoch,retry:()=>setAttempt(n=>n+1)};
}

function bounded<T>(work:Promise<T>):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  return Promise.race([
    work,
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('처리 결과를 확인하지 못했어요. 다시 시도해 확인해 주세요.')),25_000);}),
  ]).finally(()=>clearTimeout(timer));
}

export function BetaPublish({record}:{record:Observation}) {
  const auth=useBetaSession();
  const uid=auth.state.kind==='signed-in'?auth.state.id:null;
  const [consent,setConsent]=useState(false);
  const [noPeople,setNoPeople]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [published,setPublished]=useState(false);
  const [showLogin,setShowLogin]=useState(false);
  const lock=useRef(false);
  const recordVersion=useRef(`${record.id}:${record.updatedAt}`);
  const recordEpoch=useRef(0);
  const nextVersion=`${record.id}:${record.updatedAt}`;
  if(recordVersion.current!==nextVersion){recordVersion.current=nextVersion;++recordEpoch.current;}
  useEffect(()=>{lock.current=false;setConsent(false);setNoPeople(false);setBusy(false);setMessage('');setError('');setPublished(false);setShowLogin(false);},[uid,record.id,record.updatedAt]);

  async function publish(){
    const c=auth.client.current;
    if(lock.current||!c||!uid||!consent||!noPeople||record.demo)return;
    lock.current=true;
    const ticket=auth.epoch.current,version=recordEpoch.current;
    const current=()=>ticket===auth.epoch.current&&version===recordEpoch.current;
    setBusy(true);setError('');setMessage('');
    try{
      const {data,error:sessionError}=await c.auth.getSession();
      if(sessionError||data.session?.user.id!==uid||data.session.user.is_anonymous)throw new Error('로그인 상태가 바뀌었어요. 다시 확인해 주세요.');
      if(!current())return;
      const result=await bounded(publishBetaObservation(c,uid,record,{publicConsent:true,noPeople:true}));
      if(!current())return;
      setPublished(true);
      setMessage(result.alreadyPublished?'이미 공개 베타에 저장된 사진이에요.':'공개 베타에 저장했어요.');
    }catch(e){if(current())setError(e instanceof Error?e.message:'공개 저장을 확인하지 못했어요. 다시 시도해 주세요.');}
    finally{if(current()){lock.current=false;setBusy(false);}}
  }

  if(record.demo)return null;
  return <section className="beta-publish" aria-label="공개 베타 사진 저장">
    <div className="beta-heading"><Globe2 size={19} aria-hidden="true"/><h2>공개 베타에 남기기</h2></div>
    <p>사진과 기록이 누구에게나 공개돼요. 앱에서 공개 취소는 아직 지원하지 않아요.</p>
    <details><summary>공개 범위</summary><p>사진·제목·이름·관찰일·메모가 공개돼요. 복구를 위한 나머지 기록 정보도 서버에 저장해요. 사진 저장 시 이메일과 별도 위치 정보는 제외돼요. 사진과 글에 주소나 연락처가 없는지 확인해 주세요.</p></details>
    {!cloudConfig.enabled?<p role="status">공개 저장을 사용할 수 없어요. 사진은 이 기기에 그대로 있어요.</p>
      :auth.state.kind==='checking'?<p role="status">로그인 상태 확인 중…</p>
      :auth.state.kind==='error'?<><p role="alert">로그인 상태를 확인하지 못했어요.</p><button type="button" className="m-secondary" onClick={auth.retry}>로그인 상태 다시 확인</button></>
      :auth.state.kind==='signed-out'?<><p>로그인한 뒤 공개 여부를 확인해요.</p>{showLogin?<EmailSignIn recordId={record.id} emailLabel="공개 저장 로그인 이메일"/>:<button type="button" className="m-primary" onClick={()=>setShowLogin(true)}>로그인하고 공개하기</button>}</>
      :published?<p className="beta-success" role="status"><Check size={18} aria-hidden="true"/>{message}</p>
      :<>
        <label className="beta-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>이 사진과 기록을 공개 베타에 저장하는 데 동의해요</label>
        <label className="beta-check"><input type="checkbox" checked={noPeople} onChange={e=>setNoPeople(e.target.checked)}/>사진에 사람이나 개인 정보가 없어요</label>
        <button type="button" className="m-primary" disabled={busy||!consent||!noPeople} onClick={()=>void publish()}>{busy?<><LoaderCircle className="spin" size={18}/> 공개 저장 중…</>:'공개로 저장'}</button>
        {error&&<p className="m-error" role="alert">{error}</p>}
      </>}
  </section>;
}

export function BetaFeed() {
  const [items,setItems]=useState<BetaFeedItem[]>([]);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!cloudConfig.enabled)return;
    let active=true;
    setState('loading');
    void getSupabase().then(c=>bounded(listBetaFeed(c))).then(rows=>{if(active){setItems(rows);setState('ready');}}).catch(()=>{if(active){setItems([]);setState('error');}});
    return()=>{active=false;};
  },[attempt]);
  if(!cloudConfig.enabled)return null;
  return <section className="beta-feed" aria-labelledby="beta-feed-heading">
    <div className="beta-heading"><Images size={20} aria-hidden="true"/><h2 id="beta-feed-heading">함께 남긴 사진</h2></div>
    <p>베타 참여자가 공개한 최근 기록이에요.</p>
    {state==='loading'?<p role="status">사진을 불러오는 중…</p>:state==='error'?<><p role="alert">공개 사진을 불러오지 못했어요.</p><button type="button" className="m-secondary" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></>:items.length===0?<p>아직 공개된 사진이 없어요.</p>:<div className="beta-feed-grid">{items.map(item=><article key={item.id}>
      <img src={item.photoUrl} alt={`${item.title} 관찰 사진`} loading="lazy" decoding="async"/>
      <div><strong>{item.title}</strong><small>베타 참여자 · {item.observedOn}</small>{item.species&&<span>{item.species} · 이름 미확인</span>}{item.notes&&<details><summary>관찰 메모</summary><p>{item.notes}</p></details>}</div>
    </article>)}</div>}
  </section>;
}

export function BetaMine({records,onRestored,onLogin}:{records:Observation[];onRestored:()=>Promise<void>;onLogin:()=>void}) {
  const auth=useBetaSession();
  const uid=auth.state.kind==='signed-in'?auth.state.id:null;
  const [items,setItems]=useState<BetaOwnedObservation[]>([]);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0);
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const request=useRef(0);
  const lock=useRef(false);
  useEffect(()=>{
    const ticket=++request.current;
    setItems([]);setState('loading');setBusy('');setMessage('');setError('');lock.current=false;
    const c=auth.client.current;
    if(!uid||!c)return;
    const epoch=auth.epoch.current;
    void bounded(listMyBetaObservations(c,uid)).then(rows=>{if(ticket===request.current&&epoch===auth.epoch.current){setItems(rows);setState('ready');}}).catch(()=>{if(ticket===request.current&&epoch===auth.epoch.current)setState('error');});
    return()=>{++request.current;};
  },[uid,attempt,auth.client,auth.epoch]);
  async function restore(item:BetaOwnedObservation){
    const c=auth.client.current;
    if(!c||!uid||lock.current||records.some(r=>r.id===item.localId))return;
    lock.current=true;const ticket=auth.epoch.current;
    setBusy(item.id);setMessage('');setError('');
    try{
      const record=await bounded(restoreBetaObservation(c,uid,item));
      if(ticket!==auth.epoch.current)return;
      const {data,error:sessionError}=await c.auth.getSession();
      if(sessionError||data.session?.user.id!==uid||data.session.user.is_anonymous)throw new Error('로그인 상태가 바뀌었어요. 다시 확인해 주세요.');
      if(ticket!==auth.epoch.current)return;
      await saveObservation(record,null);
      try{await onRestored();if(ticket===auth.epoch.current)setMessage('사진을 이 기기의 내 기록에 가져왔어요.');}
      catch{if(ticket===auth.epoch.current)setMessage('사진은 가져왔지만 목록을 갱신하지 못했어요. 화면을 다시 열어 주세요.');}
    }catch(e){if(ticket===auth.epoch.current)setError(e instanceof Error?e.message:'사진을 가져오지 못했어요. 다시 시도해 주세요.');}
    finally{if(ticket===auth.epoch.current){lock.current=false;setBusy('');}}
  }
  if(!cloudConfig.enabled)return null;
  return <section className="beta-mine" aria-labelledby="beta-mine-heading">
    <div className="beta-heading"><Globe2 size={19} aria-hidden="true"/><h2 id="beta-mine-heading">서버에 저장한 내 사진</h2></div>
    {auth.state.kind==='checking'?<p role="status">로그인 상태 확인 중…</p>:auth.state.kind==='error'?<><p role="alert">로그인 상태를 확인하지 못했어요.</p><button type="button" className="m-secondary" onClick={auth.retry}>다시 확인</button></>:auth.state.kind==='signed-out'?<><p>로그인하면 공개한 내 사진을 가져올 수 있어요.</p><button type="button" className="m-secondary" onClick={onLogin}>로그인하기</button></>:state==='loading'?<p role="status">내 공개 사진을 불러오는 중…</p>:state==='error'?<><p role="alert">내 공개 사진을 불러오지 못했어요.</p><button type="button" className="m-secondary" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></>:items.length===0?<p>서버에 저장한 사진이 아직 없어요.</p>:<><p>공개한 사진을 이 기기의 기록으로 가져올 수 있어요.</p>{items.map(item=><article key={item.id} className="beta-mine-item"><div><strong>{item.record.title}</strong><small>{item.record.date}</small></div>{records.some(r=>r.id===item.localId)?<span>이 기기에 있음</span>:<button type="button" className="m-secondary" disabled={!!busy} onClick={()=>void restore(item)}>{busy===item.id?'가져오는 중…':'이 기기로 가져오기'}</button>}</article>)}</>}
    {message&&<p role="status">{message}</p>}{error&&<p className="m-error" role="alert">{error}</p>}
  </section>;
}
