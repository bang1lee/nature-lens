'use client';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import type {Observation} from '@/lib/domain';
import {getSupabase} from '@/lib/cloud/client';
import {cloudConfig} from '@/lib/cloud/config';
import {fetchAlias} from '@/lib/cloud/api';
const summarySchema=z.object({dailyPoints:z.number().nonnegative(),predictionPoints:z.number().nonnegative(),totalPoints:z.number().nonnegative(),tier:z.enum(['seed','sprout','tree']),todayClaimed:z.boolean(),observationDays:z.number(),serverDate:z.string(),awarded:z.number(),claimStatus:z.enum(['read','awarded','already_today','already_recorded']).optional()});
type Summary=z.infer<typeof summarySchema>;
const tiers={seed:'씨앗',sprout:'새싹',tree:'나무'};
export default function ParticipationPanel({records}:{records:Observation[]}){
 const [member,setMember]=useState(false),[alias,setAlias]=useState('관찰자'),[summary,setSummary]=useState<Summary|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const epoch=useRef(0),lock=useRef(false);
 async function refresh(ticket:number){
  try{const client=await getSupabase();const {data,error}=await client.rpc('participation_summary').abortSignal(AbortSignal.timeout(12000));if(error)throw error;if(ticket===epoch.current){setSummary(summarySchema.parse(data));setError('');}}
  catch{if(ticket===epoch.current)setError('관찰 점수를 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.');}
 }
 useEffect(()=>{if(!cloudConfig.enabled)return;let active=true;let unsub:undefined|(()=>void);let last:string|null|undefined;const visible=()=>{if(document.visibilityState==='visible'&&last)void refresh(epoch.current);};document.addEventListener('visibilitychange',visible);
  void getSupabase().then(async client=>{if(!active)return;const changed=(id:string|null)=>{if(!active||id===last)return;last=id;const ticket=++epoch.current;setBusy(false);setMember(Boolean(id));setAlias('관찰자');setSummary(null);setError('');setMessage('');if(id){void refresh(ticket);void fetchAlias(client,id).then(a=>{if(ticket===epoch.current&&a)setAlias(a);}).catch(()=>{});}};
   const {data}=client.auth.onAuthStateChange((_e,s)=>changed(s&&!s.user.is_anonymous?s.user.id:null));unsub=()=>data.subscription.unsubscribe();const {data:s}=await client.auth.getSession();if(last===undefined)changed(s.session&&!s.session.user.is_anonymous?s.session.user.id:null);
  }).catch(()=>{});return()=>{active=false;++epoch.current;document.removeEventListener('visibilitychange',visible);unsub?.();};
 },[]);
 const today=summary&&records.find(r=>!r.demo&&r.date===summary.serverDate&&r.photo);
 async function claim(){if(lock.current||!today||!summary||summary.todayClaimed)return;lock.current=true;setBusy(true);setError('');const ticket=epoch.current;
  try{const client=await getSupabase();if(ticket!==epoch.current)return;const {data,error}=await client.rpc('claim_daily_observation',{p_observation_id:today.id,p_observed_on:today.date}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;if(ticket===epoch.current){const next=summarySchema.parse(data);setSummary(next);setMessage(next.awarded?'오늘의 관찰 +2점! 내일도 주변의 변화를 만나 보세요.':next.claimStatus==='already_recorded'?'이 기록은 이미 참여에 사용했어요. 오늘 새로 촬영한 기록을 남겨 주세요.':'오늘의 참여 점수는 이미 받았어요.');}}
  catch{if(ticket===epoch.current)setError('적립 결과를 확인하지 못했어요. 다시 확인해도 중복 적립되지 않아요.');}
  finally{lock.current=false;if(ticket===epoch.current)setBusy(false);}
 }
 if(!member)return null;
 return <section className="m-settings-note" aria-label="나의 관찰 활동"><h2>{alias} {summary&&<small>· {tiers[summary.tier]} · {summary.totalPoints}점</small>}</h2>
 {summary?<><p>{summary.todayClaimed?'오늘의 관찰을 남겼어요. 내일 또 만나요.':today?'오늘 만난 자연, 참여 점수로 남겨요.':'오늘 사진 한 장을 기록하고 +2점을 받아요.'}</p>
 {!summary.todayClaimed&&today&&<><p className="m-muted">기록 번호와 관찰일만 보내요. 사진·위치는 보내지 않아요.</p><button className="m-secondary" disabled={busy} onClick={()=>void claim()}>{busy?'확인 중…':'오늘 관찰 참여하기 · +2점'}</button></>}
 <details><summary>나의 성장과 관찰 약속</summary><button className="m-text" disabled={busy} onClick={()=>void refresh(epoch.current)}>관찰 점수 새로고침</button><p>관찰 참여 {summary.dailyPoints}점 · 이름 예측 {summary.predictionPoints}점</p><p>씨앗 0점 · 새싹 20점 · 나무 100점. 하루 한 번, 한국 시간 기준으로 적립해요. 관찰 참여는 직접 남기는 활동 기록이며 사진의 진위나 식별 정확도를 인증하지 않아요.</p><ul><li>하루 한 장: 가까운 자연의 작은 변화를 기록해요.</li><li>다시 만나기: 같은 개체를 다음 주에 다시 관찰해요.</li><li>한 달 돌아보기: 월간 도감에서 계절의 변화를 찾아요.</li></ul><p>재관찰·주간 목표의 추가 보상은 준비 중이에요. 지금은 일일 참여와 이름 예측에만 점수가 붙어요.</p></details></>:!error&&<p role="status">관찰 활동을 확인하고 있어요…</p>}
 {error&&<><p role="alert">{error}</p><button className="m-text" disabled={busy} onClick={()=>void refresh(epoch.current)}>관찰 점수 다시 확인</button></>}{message&&<p role="status">{message}</p>}</section>;
}
