'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {getSupabase} from '@/lib/cloud/client';
import {requestMagicLink} from '@/lib/cloud/api';
import {rememberIdentification} from '@/lib/cloud/identification-return';
export type IdentificationAccessState='checking'|'signed-in'|'signed-out'|'error';
export default function IdentificationAccess({draft,recordId,onState,forceLogin=false}:{draft:boolean;recordId:string;forceLogin?:boolean;onState:(state:IdentificationAccessState)=>void}){
 const [state,setState]=useState<IdentificationAccessState>('checking');
 const [attempt,setAttempt]=useState(0),[email,setEmail]=useState(''),[message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);const [cooldown,setCooldown]=useState(false);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(false),60_000);return()=>clearTimeout(timer);},[cooldown]);const lock=useRef(false);const alive=useRef(true);const field=useId();
 useEffect(()=>{
  alive.current=true;let active=true;let unsubscribe:(()=>void)|undefined;
  const update=(next:IdentificationAccessState)=>{if(active){const value=forceLogin&&next==='signed-in'?'signed-out':next;setState(value);onState(value);}};
  update('checking');
  const timer=setTimeout(()=>update('error'),10_000);
  void getSupabase().then(async client=>{
   if(!active)return;
   const {data}=client.auth.onAuthStateChange((_event,session)=>{clearTimeout(timer);update(session?'signed-in':'signed-out');});
   unsubscribe=()=>data.subscription.unsubscribe();
   const session=await client.auth.getSession();if(session.error)throw session.error;
   clearTimeout(timer);update(session.data.session?'signed-in':'signed-out');
  }).catch(()=>{clearTimeout(timer);update('error');});
  return()=>{active=false;alive.current=false;clearTimeout(timer);unsubscribe?.();};
 },[attempt,onState,forceLogin]);
 async function login(){
  if(lock.current||cooldown)return;lock.current=true;setBusy(true);setMessage('');
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   // Only an already saved record ID is remembered; photos and notes never leave here.
   rememberIdentification(recordId);
   setCooldown(true);
   await Promise.race([getSupabase().then(client=>requestMagicLink(client,email,`${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH||''}/mobile/`)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('링크 요청 결과를 확인하지 못했어요. 메일함을 먼저 확인한 뒤 잠시 후 다시 요청해 주세요.')),15_000);})]);
   if(alive.current)setMessage('로그인 링크를 요청했어요. 이메일의 링크를 같은 브라우저에서 열면 저장한 기록으로 돌아옵니다.');
  }catch(error){if(alive.current)setMessage(error instanceof Error?error.message:'로그인 링크를 요청하지 못했어요. 저장한 기록은 그대로예요.');}
  finally{clearTimeout(timer);lock.current=false;if(alive.current)setBusy(false);}
 }
 if(state==='signed-in')return null;
 if(state==='checking')return <p>로그인 상태를 확인하고 있어요. 사진은 아직 보내지 않았어요.</p>;
 if(state==='error')return <div><p>로그인 상태를 확인하지 못했어요. 사진과 메모는 계속 저장할 수 있어요.</p><button type="button" className="m-secondary" onClick={()=>setAttempt(n=>n+1)}>로그인 상태 다시 확인</button></div>;
 if(draft)return <p className="m-private-note">외부 식별에는 로그인이 필요해요. 먼저 아래 ‘내 기록에 저장’을 누른 뒤 ‘방금 기록 보기’에서 로그인하면, 사진과 메모를 잃지 않고 이름 찾기를 이어갈 수 있어요.</p>;
 return <div className="m-settings-note"><p>이 기록은 기기에 저장돼 있어요. 로그인 후에도 여기에서 이어갈 수 있어요. 로그인만으로 사진을 전송하지 않아요.</p><form onSubmit={e=>{e.preventDefault();void login();}}><label htmlFor={field}>식별 로그인 이메일</label><input id={field} type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/><button className="m-secondary" disabled={busy||cooldown}>{busy?'링크 요청 중…':cooldown?'잠시 후 다시 요청할 수 있어요':'이 기록에서 로그인 이어가기'}</button></form>{message&&<p role="status">{message}</p>}</div>;
}
