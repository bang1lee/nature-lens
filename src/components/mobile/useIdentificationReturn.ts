'use client';
import {useEffect,useState} from 'react';
import type {Observation} from '@/lib/domain';
import {readLibrary} from '@/lib/storage';
import {cloudConfig} from '@/lib/cloud/config';
import {getSupabase} from '@/lib/cloud/client';
import {pendingIdentification,clearIdentificationReturn} from '@/lib/cloud/identification-return';
export function useIdentificationReturn(open:(record:Observation)=>void){
 const [message,setMessage]=useState('');
 useEffect(()=>{
  if(!cloudConfig.enabled)return;
  const id=pendingIdentification();if(!id)return;
  let active=true;
  // Never open an old record over a new action while session recovery is slow.
  const cancel=()=>{active=false;};
  window.addEventListener('pointerdown',cancel,{once:true});window.addEventListener('keydown',cancel,{once:true});
  void getSupabase().then(client=>client.auth.getSession()).then(async({data,error})=>{
   if(error)throw error;
   if(!active||!data.session)return;
   const record=(await readLibrary()).observations.find(o=>o.id===id&&!o.demo);
   if(!active)return;
   clearIdentificationReturn();
   if(record)open(record);else setMessage('로그인은 완료했지만 이 브라우저에서 이어갈 기록을 찾지 못했어요. 원래 기록을 저장한 브라우저를 확인해 주세요.');
  }).catch(()=>{if(active)setMessage('로그인 연결을 확인하지 못했어요. 내 기록은 기기에 그대로 보관돼 있어요.');});
  return()=>{active=false;window.removeEventListener('pointerdown',cancel);window.removeEventListener('keydown',cancel);};
 },[open]);
 return message;
}
