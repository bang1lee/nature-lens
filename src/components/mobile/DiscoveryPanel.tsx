'use client';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import type {Observation} from '@/lib/domain';
import {getSupabase} from '@/lib/cloud/client';
import {cloudConfig} from '@/lib/cloud/config';
import {identificationEndpoint} from '@/lib/ai/client';
import {identificationResultSchema} from '@/lib/ai/contract';
import {fromGatewayResult} from '@/lib/ai/decision';
import {candidateDraft} from '@/lib/ai/apply';
import {preparePhoto} from '@/lib/image';
import {saveObservation} from '@/lib/storage';
import IdentificationAccess,{type IdentificationAccessState} from './IdentificationAccess';
import DecisionResult from './DecisionResult';
const roundSchema=z.object({id:z.uuid(),state:z.enum(['processing','waiting','revealed','failed','seen']),prediction:z.string(),reason:z.string(),readyAt:z.string(),serverNow:z.string(),eligible:z.boolean(),points:z.number(),totalPoints:z.number(),result:identificationResultSchema.nullable()});
type Round=z.infer<typeof roundSchema>;
type Props={record:Observation;draft?:boolean;onApplied:(record:Observation)=>void;onBusyChange?:(busy:boolean)=>void};
export default function DiscoveryPanel({record,draft=false,onApplied,onBusyChange}:Props){
 const [access,setAccess]=useState<IdentificationAccessState>('checking');
 const [available,setAvailable]=useState(false),[checking,setChecking]=useState(true);
 const [prediction,setPrediction]=useState(''),[reason,setReason]=useState('');
 const [consent,setConsent]=useState(false),[noPeople,setNoPeople]=useState(false);
 const [round,setRound]=useState<Round|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef(true),flight=useRef(false),controller=useRef<AbortController|null>(null);
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{active.current=true;const c=new AbortController();setChecking(true);
  if(!identificationEndpoint){setChecking(false);return;}
  void fetch(`${identificationEndpoint}/discovery-capabilities`,{signal:AbortSignal.any([c.signal,AbortSignal.timeout(12000)]),credentials:'omit',cache:'no-store'}).then(r=>r.json()).then(raw=>{if(active.current)setAvailable(z.object({discovery:z.boolean()}).parse(raw).discovery===true);}).catch(()=>{}).finally(()=>{if(active.current)setChecking(false);});
  return()=>{active.current=false;c.abort();controller.current?.abort();onBusyChange?.(false);};
 },[attempt]);
 async function call(action:string,data:unknown){
  const client=await getSupabase();const {data:auth}=await client.auth.getSession();
  if(!auth.session)throw Error('로그인한 참여자만 이용할 수 있어요.');
  const c=new AbortController();controller.current=c;
  const response=await fetch(`${identificationEndpoint}/discovery/${action}`,{method:'POST',headers:{Authorization:`Bearer ${auth.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(data),credentials:'omit',cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(28000)])});
  if(!response.ok)throw Error(response.status===401?'로그인 상태를 다시 확인해 주세요.':response.status===404?'이 계정의 예측을 찾지 못했어요. 참여한 계정으로 로그인해 주세요.':response.status===429?'오늘 식별 한도를 사용했어요. 내일 다시 시도해 주세요.':response.status===409?'아직 공개 시간이 아니에요.':response.status===503?'예측 서버 연결이 아직 준비되지 않았어요.':'결과를 받지 못했어요. 잠시 뒤 다시 확인해 주세요.');
  return roundSchema.parse(await response.json());
 }
 async function run(action:'submit'|'read'|'reveal',early=false){
  if(flight.current||access!=='signed-in')return;flight.current=true;setBusy(true);setError('');onBusyChange?.(true);
  try{
   let data:unknown={id:record.discoveryId||round?.id,...(action==='reveal'?{early}:{})};
   if(action==='submit'){
    if(!consent||!noPeople||!prediction.trim())throw Error('예상 이름과 사진 전송 동의를 확인해 주세요.');
    const [prefix,encoded]=record.photo.split(',');const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const photo=await preparePhoto(new File([bytes],'observation',{type:prefix.slice(5).split(';')[0]}));
    data={requestId:crypto.randomUUID(),observationId:record.id,photo,taxonGroup:'plant',prediction:prediction.trim(),reason:reason.trim(),noPeople:true,transmissionConsent:true};
   }
   const result=await call(action,data);if(!active.current)return;setRound(result);setPrediction(result.prediction);setReason(result.reason);
   if(result.state==='seen')return;
   if(action==='submit'&&!record.discoveryId){
    const saved=await saveObservation({...record,identificationTiming:'tomorrow',discoveryId:result.id},record.updatedAt);if(active.current)onApplied(saved);
   }
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'연결을 확인해 주세요.');}
  finally{flight.current=false;if(active.current){setBusy(false);onBusyChange?.(false);}}
 }
 useEffect(()=>{setRound(null);setError('');if(access==='signed-in'&&record.discoveryId)void run('read');else controller.current?.abort();},[access,record.discoveryId]);
 async function apply(index:number){
  if(flight.current||!round?.result||access!=='signed-in')return;flight.current=true;setBusy(true);onBusyChange?.(true);
  try{const result=round.result;const updated=candidateDraft(record,result.candidates[index]);const saved=await saveObservation(updated,record.updatedAt);if(active.current)onApplied(saved);}
  catch{if(active.current)setError('기록에 반영하지 못했어요. 다시 열어 주세요.');}
  finally{flight.current=false;if(active.current){setBusy(false);onBusyChange?.(false);}}
 }
 return <section className="m-identify" aria-label="내일의 발견">
  <h2>내일의 발견</h2>
  {!cloudConfig.enabled?<p>로그인 연결이 필요해요.</p>:<IdentificationAccess draft={draft} recordId={record.id} onState={setAccess}/>}
  {!draft&&access==='signed-in'&&<>
   {record.taxonGroup==='insect'||record.taxonGroup==='other'?<p>내일의 발견은 식물 사진으로 참여할 수 있어요.</p>:record.demo?<p>예제 사진은 점수에 참여할 수 없어요.</p>:<>
   {!available&&<p>{checking?'예측 서버를 확인하고 있어요.':'예측·점수 서버 연결 준비 중이에요. 바로 식별은 기존 방식으로 이용할 수 있어요.'}</p>}
   {!available&&!checking&&<button type="button" className="m-secondary" onClick={()=>setAttempt(n=>n+1)}>예측 연결 다시 확인</button>}
   {round&&round.state!=='seen'?<div className="m-private-note">
    <strong>나의 예상: {round.prediction}</strong>{round.reason&&<details><summary>내가 남긴 단서</summary><p>{round.reason}</p></details>}
    <p>공개 시각: {new Date(round.readyAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} (한국 시간)</p>
    {round.state==='revealed'?<><p>이번 예측 {round.points}점 · 예측 누적 {round.totalPoints}점</p>{!round.eligible?<p>미리 확인한 사진은 점수 대상에서 제외돼요.</p>:round.points===0&&<p>일치하지 않거나 AI 판단이 불확실해 점수를 부여하지 않았어요. 후보를 비교하며 다시 관찰해 보세요.</p>}{round.result&&<DecisionResult decision={fromGatewayResult(round.result)} saving={busy} onCandidate={apply}/>}</>:<>
     <p>{round.state==='failed'?'식별에 실패했어요. 사진을 다시 제출해 주세요.':round.state==='processing'?'분석 결과를 준비 중이에요. 잠시 뒤 다시 확인해 주세요.':'예상을 보관했어요. 공개 시각 이후 이 기록에서 결과를 열어 보세요.'}</p>
     <button type="button" className="m-secondary" disabled={busy} onClick={()=>void run('read')}>공개 상태 새로 확인</button>
     {round.state==='waiting'&&(Date.parse(round.serverNow)>=Date.parse(round.readyAt)?<button type="button" className="m-primary" disabled={busy} onClick={()=>void run('reveal')}>내 예상과 결과 비교하기</button>:<button type="button" className="m-text" disabled={busy} onClick={()=>{if(confirm('미리 열면 이번 예측의 점수를 받을 수 없어요. 지금 확인할까요?'))void run('reveal',true);}}>점수 없이 지금 확인하기</button>)}
    </>}
   </div>:round?.state==='seen'?<p>이미 바로 식별한 사진이라 예측 점수를 받을 수 없어요. 새 식물 사진으로 참여해 주세요.</p>:null}
   {(!record.discoveryId||round?.state==='failed')&&round?.state!=='seen'&&<>
    <label>내가 예상한 식물 이름<input maxLength={140} value={prediction} disabled={busy||Boolean(round)} onChange={e=>setPrediction(e.target.value)} placeholder="한국어 이름 또는 학명"/></label>
    <details><summary>관찰한 단서 더하기 · 선택</summary><label>그렇게 생각한 이유<textarea maxLength={1000} value={reason} disabled={busy||Boolean(round)} onChange={e=>setReason(e.target.value)} placeholder="잎 모양, 꽃의 색, 줄기에서 찾은 단서"/></label></details>
    <p>제출한 예상은 바꿀 수 없어요. 사진은 지금 Pl@ntNet으로 분석하고, 예상·결과·점수는 서버에 보관해요. 결과는 내일 오전 9시(한국 시간)에 열려요.</p>
    <label><input type="checkbox" checked={noPeople} disabled={busy} onChange={e=>setNoPeople(e.target.checked)}/>인물과 개인정보가 없는 사진입니다</label>
    <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>사진 전송 및 예상·결과·점수 보관에 동의합니다</label>
    <a href={`${process.env.NEXT_PUBLIC_BASE_PATH||''}/identification-policy.html`} target="_blank" rel="noreferrer">사진 처리 안내</a>
    <button type="button" className="m-primary" disabled={!available||busy||!prediction.trim()||!consent||!noPeople||Boolean(record.aiIdentification)} onClick={()=>void run('submit')}>{busy?'예상을 보내는 중…':'예상 제출하고 내일 확인하기'}</button>
    {record.aiIdentification&&<p>이미 식별한 기록은 예측에 참여할 수 없어요.</p>}
   </>}
   <p>별도 알림은 없어요. 내일 이 기록에서 확인해 주세요.</p><details><summary>점수 규칙</summary><p>AI의 첫 번째 후보와 예상이 일치하면 10점. 판단이 불확실하면 채점을 보류해요. 전문가가 확인한 정답 점수는 아니에요. 한국어 이름 또는 학명이 정확히 일치해야 하며, 오타나 다른 이름은 인정되지 않을 수 있어요. 예측이 맞아도 식용·안전 판단에 사용하지 마세요.</p></details>
   </>}
  </>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
