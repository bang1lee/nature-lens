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
  const id=pendingIdentification();
  const url=new URL(window.location.href),hash=new URLSearchParams(url.hash.slice(1));
  const callback=url.searchParams.has('code')||['error','error_code','error_description'].some(k=>url.searchParams.has(k)||hash.has(k));
  if(!id&&!callback)return;
  let active=true;
  let canOpen=true;
  const cleanCallback=()=>{
   const current=new URL(window.location.href),fragment=new URLSearchParams(current.hash.slice(1));
   for(const key of ['code','sb_flow_id','error','error_code','error_description']){current.searchParams.delete(key);fragment.delete(key);}
   if(['error','error_code','error_description'].some(k=>hash.has(k)))current.hash=fragment.toString();
   window.history.replaceState(window.history.state,'',current.toString());
  };
  if(callback)setMessage('로그인 연결을 확인하고 있어요…');
  const timer=window.setTimeout(()=>{if(active){active=false;setMessage('로그인 확인이 늦어지고 있어요. 내 기록은 그대로예요. 설정에서 로그인 상태를 확인해 주세요.');}},15000);
  // Never open an old record over a new action while session recovery is slow.
  const cancel=()=>{canOpen=false;};
  window.addEventListener('pointerdown',cancel,{once:true});window.addEventListener('keydown',cancel,{once:true});
  void getSupabase().then(async client=>{
   // Read the SDK's shared initialization result: getSession alone can return
   // an older valid session even when this particular email link failed.
   const initialized=await client.auth.initialize();
   if(initialized.error)throw initialized.error;
   if(callback&&new URL(window.location.href).searchParams.has('code'))throw new Error('callback-not-consumed');
   return client.auth.getSession();
  }).then(async({data,error})=>{
   if(error)throw error;
   if(!active)return;
   if(!data.session){if(callback)throw new Error('callback-no-session');return;}
   if(callback){cleanCallback();setMessage('로그인했어요. 내 기록은 계속 이 기기에 보관됩니다.');}
   if(!id||!canOpen)return;
   const record=(await readLibrary()).observations.find(o=>o.id===id&&!o.demo);
   if(!active||!canOpen)return;
   clearIdentificationReturn();
   if(record)open(record);else setMessage('로그인은 완료했지만 이 브라우저에서 이어갈 기록을 찾지 못했어요. 원래 기록을 저장한 브라우저를 확인해 주세요.');
  }).catch(()=>{if(active){if(callback)cleanCallback();setMessage(callback?'이 로그인 링크를 완료하지 못했어요. 링크를 요청한 같은 브라우저에서 열거나, 설정에서 새 링크를 요청해 주세요. 내 기록은 그대로예요.':'로그인 연결을 확인하지 못했어요. 내 기록은 기기에 그대로 보관돼 있어요.');}}).finally(()=>window.clearTimeout(timer));
  return()=>{active=false;window.clearTimeout(timer);window.removeEventListener('pointerdown',cancel);window.removeEventListener('keydown',cancel);};
 },[open]);
 return message;
}
