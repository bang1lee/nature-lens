'use client';

import {useEffect,useId,useRef,useState} from 'react';
import {getSupabase} from '@/lib/cloud/client';
import {requestEmailCode,requestMagicLink,verifyEmailCode} from '@/lib/cloud/api';
import {clearIdentificationReturn,pendingIdentification,rememberIdentification} from '@/lib/cloud/identification-return';

// Enable only after both signup and magic-link mail templates include {{ .Token }}.
const emailCodeEnabled=process.env.NEXT_PUBLIC_AUTH_OTP_ENABLED==='true';

export default function EmailSignIn({recordId,emailLabel,onAuthenticated}:{recordId?:string;emailLabel?:string;onAuthenticated?:()=>void}){
 const [email,setEmail]=useState(''),[sentEmail,setSentEmail]=useState(''),[token,setToken]=useState('');
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[cooldown,setCooldown]=useState(false);
 const field=useId(),codeField=useId(),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(false),60_000);return()=>clearTimeout(timer);},[cooldown]);

 async function send(){
  if(lock.current||cooldown)return;
  lock.current=true;setBusy(true);setCooldown(true);setMessage('');setError('');
  try{
   const client=await getSupabase();
   if(emailCodeEnabled){
    await requestEmailCode(client,email);
    if(alive.current){setSentEmail(email.trim());setToken('');setMessage('인증번호를 요청했어요. 이메일을 확인해 주세요.');}
   }else{
    if(recordId)rememberIdentification(recordId);
    await requestMagicLink(client,email,`${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH||''}/mobile/`);
    if(alive.current)setMessage(recordId?'로그인 링크를 요청했어요. 이메일의 링크를 같은 브라우저에서 열면 저장한 기록으로 돌아옵니다.':'로그인 링크를 요청했어요. 같은 브라우저에서 이메일의 링크를 열어 주세요.');
   }
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'로그인 요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function verify(){
  if(lock.current||!sentEmail)return;
  lock.current=true;setBusy(true);setMessage('');setError('');
  try{
   const client=await getSupabase();
   await verifyEmailCode(client,sentEmail,token.trim());
   if(alive.current){
    if(recordId&&pendingIdentification()===recordId)clearIdentificationReturn();
    onAuthenticated?.();
   }
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'인증을 완료하지 못했어요. 다시 시도해 주세요.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return <div>
  {emailCodeEnabled&&<p>처음이라면 이메일 인증과 함께 가입하고, 계정이 있으면 로그인해요.</p>}
  <form onSubmit={e=>{e.preventDefault();void send();}}>
   <label htmlFor={field}>{emailLabel||(recordId?'식별 로그인 이메일':'로그인 이메일')}</label>
   <input id={field} type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={e=>{setEmail(e.target.value);setSentEmail('');setToken('');setMessage('');setError('');}}/>
   <button className={recordId?'m-secondary':'m-primary'} disabled={busy||cooldown}>{busy?'처리 중…':emailCodeEnabled?(sentEmail?'인증번호 다시 받기':'인증번호 받기'):(recordId?(cooldown?'잠시 후 다시 요청할 수 있어요':'이 기록에서 로그인 이어가기'):'이메일 로그인 링크 받기')}</button>
   {cooldown&&emailCodeEnabled&&<p>다시 받기는 잠시 후에 가능해요.</p>}
   {cooldown&&!emailCodeEnabled&&<p>메일함과 스팸함을 확인해 주세요. 다시 요청하려면 잠시 기다려 주세요.</p>}
  </form>
  {emailCodeEnabled&&sentEmail&&<form onSubmit={e=>{e.preventDefault();void verify();}}>
   <label htmlFor={codeField}>인증번호</label>
   <input id={codeField} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required value={token} disabled={busy} onChange={e=>setToken(e.target.value)}/>
   <button className="m-primary" disabled={busy}>{busy?'확인 중…':'인증하고 계속'}</button>
  </form>}
  {message&&<p role="status">{message}</p>}{error&&<p className="m-error" role="alert">{error}</p>}
 </div>;
}
