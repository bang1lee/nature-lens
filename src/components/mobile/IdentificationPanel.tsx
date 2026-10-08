'use client';
import {useEffect,useRef,useState} from 'react';
import {Leaf,LoaderCircle} from 'lucide-react';
import {cloudConfig} from '@/lib/cloud/config';
import {getSupabase} from '@/lib/cloud/client';
import {candidateDraft} from '@/lib/ai/apply';
import {capabilitySchema,identificationEndpoint,requestIdentification} from '@/lib/ai/client';
import type {IdentificationCandidate,IdentificationResult} from '@/lib/ai/contract';
import type {Observation} from '@/lib/domain';
import {readLibrary,saveObservation} from '@/lib/storage';
import {preparePhoto} from '@/lib/image';

type Props={record:Observation;onApplied:(record:Observation)=>void};
export default function IdentificationPanel({record,onApplied}:Props) {
 const [group,setGroup]=useState<'plant'|'insect'>(record.taxonGroup==='insect'?'insect':'plant');
 const [groups,setGroups]=useState<string[]>([]);const [policy,setPolicy]=useState('');
 const [consent,setConsent]=useState(false);const [noPeople,setNoPeople]=useState(false);
 const [busy,setBusy]=useState(false);const [saving,setSaving]=useState(false);
 const [result,setResult]=useState<IdentificationResult|null>(null);const [message,setMessage]=useState('');
 const controller=useRef<AbortController|null>(null);const mounted=useRef(true);const flight=useRef(false);
 useEffect(()=>{
  mounted.current=true;
  const c=new AbortController();
  if(identificationEndpoint&&cloudConfig.enabled)void fetch(`${identificationEndpoint}/capabilities`,{signal:c.signal,credentials:'omit',cache:'no-store'})
   .then(r=>{if(!r.ok)throw new Error();return r.json();}).then(raw=>{const data=capabilitySchema.parse(raw);if(!data.policyUrl?.startsWith('https://'))return;setGroups(data.groups);setPolicy(data.policyUrl);}).catch(()=>{});
  return ()=>{mounted.current=false;c.abort();controller.current?.abort();};
 },[]);
 const ready=Boolean(identificationEndpoint&&cloudConfig.enabled&&groups.includes(group)&&policy&&!record.demo);
 async function identify(){
  if(!ready||!consent||!noPeople||flight.current)return;
  if(!navigator.onLine){setMessage('오프라인이에요. 연결 후 다시 시도해 주세요.');return;}
  flight.current=true;const c=new AbortController();controller.current=c;setBusy(true);setMessage('');setResult(null);
  try{
   const client=await getSupabase();const {data}=await client.auth.getSession();
   if(!data.session)throw new Error('설정에서 로그인한 뒤 다시 시도해 주세요.');
   if(c.signal.aborted)return;
   const [prefix,encoded]=record.photo.split(',');
   const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
   const photo=await preparePhoto(new File([bytes],'observation',{type:prefix.slice(5).split(';')[0]}));
   if(c.signal.aborted)return;
   const answer=await requestIdentification(identificationEndpoint!,data.session.access_token,{requestId:crypto.randomUUID(),observationId:record.id,photo,taxonGroup:group,transmissionConsent:true,noPeople:true},c.signal);
   if(!c.signal.aborted&&mounted.current){setResult(answer);if(answer.state!=='candidates')setMessage('뚜렷한 후보를 찾지 못했어요. 가까이 찍은 사진이나 수동 이름을 사용해 주세요.');}
  }catch(error){if(mounted.current&&!c.signal.aborted)setMessage(error instanceof Error&&error.name==='TimeoutError'?'응답 시간이 길어 중단했어요. 수동 기록을 계속할 수 있어요.':error instanceof Error?error.message:'연결하지 못했어요.');}
  finally{if(controller.current===c){flight.current=false;if(mounted.current)setBusy(false);}}
 }
 async function apply(candidate:IdentificationCandidate){
  if(flight.current)return;flight.current=true;setSaving(true);setMessage('');
  try{
   await saveObservation({...candidateDraft(record,candidate),taxonGroup:group},record.updatedAt);
   const latest=(await readLibrary()).observations.find(o=>o.id===record.id);
   if(mounted.current&&latest)onApplied(latest);
  }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'후보를 저장하지 못했어요.');}
  finally{flight.current=false;if(mounted.current)setSaving(false);}
 }
 return <section className="m-identify" aria-labelledby="identify-title">
  <h2 id="identify-title"><Leaf size={20}/> 식물·곤충 이름 찾기</h2>
  <p>사진에서 이름 후보를 찾아요. 확정 동정은 아니며, 선택한 이름도 검수가 필요한 초안으로 남아요.</p>
  <label>찾을 생물<select value={group} disabled={busy||saving} onChange={e=>{setGroup(e.target.value as typeof group);setResult(null);setConsent(false);setMessage('');}}><option value="plant">식물 · Pl@ntNet</option><option value="insect">곤충 · Kindwise</option></select></label>
  {!ready?<p className="m-private-note">{record.demo?'예제 사진은 전송하지 않아요. 직접 촬영한 기록에서 사용해 주세요.':'인식 서버 연결 준비 중이에요. 지금은 이름을 직접 기록할 수 있어요.'}</p>:<>
   <p>이 사진 한 장을 {group==='plant'?'Pl@ntNet':'Kindwise insect.id'}로 전송해요. GPS·메모는 보내지 않아요. 공급자의 보관·재사용 조건은 <a href={policy} target="_blank" rel="noreferrer">사진 처리 안내</a>에서 확인하세요.</p>
   <label className="m-identify-check"><input type="checkbox" checked={noPeople} disabled={busy||saving} onChange={e=>setNoPeople(e.target.checked)}/>인물과 개인정보가 없는 사진입니다</label>
   <label className="m-identify-check"><input type="checkbox" checked={consent} disabled={busy||saving} onChange={e=>setConsent(e.target.checked)}/>사진 전송과 처리 안내에 동의합니다</label>
  </>}
  <button type="button" className="m-secondary" disabled={!ready||!consent||!noPeople||busy||saving} onClick={()=>void identify()}>{busy?<><LoaderCircle className="spin" size={18}/> 이름 후보 찾는 중</>:'이름 후보 찾기'}</button>
  {busy&&<button className="m-text" onClick={()=>{controller.current?.abort();setBusy(false);setMessage('대기를 취소했어요. 이미 전송된 사진의 처리는 완료될 수 있어요.');}}>대기 취소</button>}
  <p role="status" aria-live="polite">{message}</p>
  {result?.state==='candidates'&&<div className="m-identify-results"><p>점수는 공급자의 유사도 지표이며 정답 확률이 아니에요.</p>{result.candidates.map((c,i)=><button disabled={saving} key={`${c.scientificName}-${i}`} onClick={()=>void apply(c)}><strong>{c.commonName||c.scientificName}</strong><span>{c.commonName?c.scientificName:'한국어 일반명 미확인'}</span><small>후보 점수 {Math.round(c.score*100)} / 100 · 이 이름을 초안에 반영</small></button>)}<small>{result.provider} · {result.modelVersion}</small></div>}
  {record.aiAssisted&&<p className="m-private-note">AI 후보를 반영한 미확정 기록입니다. 식용·약용 판단에 사용하지 마세요.</p>}
 </section>;
}
