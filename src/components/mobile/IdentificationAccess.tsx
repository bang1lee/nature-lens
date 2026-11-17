'use client';
import {useEffect,useState} from 'react';
import {getSupabase} from '@/lib/cloud/client';
import EmailSignIn from './EmailSignIn';
export type IdentificationAccessState='checking'|'signed-in'|'signed-out'|'error';
export default function IdentificationAccess({draft,recordId,onState,forceLogin=false,onAuthenticated}:{draft:boolean;recordId:string;forceLogin?:boolean;onState:(state:IdentificationAccessState)=>void;onAuthenticated?:()=>void}){
 const [state,setState]=useState<IdentificationAccessState>('checking');
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;let unsubscribe:(()=>void)|undefined;
  const update=(next:IdentificationAccessState)=>{if(active){const value=forceLogin&&next==='signed-in'?'signed-out':next;setState(value);onState(value);}};
  update('checking');
  const timer=setTimeout(()=>update('error'),10_000);
  void getSupabase().then(async client=>{
   if(!active)return;
   const {data}=client.auth.onAuthStateChange((_event,session)=>{clearTimeout(timer);update(session&&!session.user.is_anonymous?'signed-in':'signed-out');});
   unsubscribe=()=>data.subscription.unsubscribe();
   const session=await client.auth.getSession();if(session.error)throw session.error;
   clearTimeout(timer);update(session.data.session&&!session.data.session.user.is_anonymous?'signed-in':'signed-out');
  }).catch(()=>{clearTimeout(timer);update('error');});
  return()=>{active=false;clearTimeout(timer);unsubscribe?.();};
 },[attempt,onState,forceLogin]);
 if(state==='signed-in')return null;
 if(state==='checking')return <p>로그인 상태를 확인하고 있어요. 사진은 아직 보내지 않았어요.</p>;
 if(state==='error')return <div><p>로그인 상태를 확인하지 못했어요. 사진과 메모는 계속 저장할 수 있어요.</p><button type="button" className="m-secondary" onClick={()=>setAttempt(n=>n+1)}>로그인 상태 다시 확인</button></div>;
 if(draft)return <p className="m-private-note">외부 식별에는 로그인이 필요해요. 먼저 아래 ‘내 기록에 저장’을 누른 뒤 ‘방금 기록 보기’에서 로그인하면, 사진과 메모를 잃지 않고 이름 찾기를 이어갈 수 있어요.</p>;
 return <div className="m-settings-note"><p>이 기록은 기기에 저장돼 있어요. 로그인 후에도 여기에서 이어갈 수 있어요. 로그인만으로 사진을 전송하지 않아요.</p><EmailSignIn recordId={recordId} onAuthenticated={()=>{onAuthenticated?.();setState('signed-in');onState('signed-in');}}/></div>;
}
