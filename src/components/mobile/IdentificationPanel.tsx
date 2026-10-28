'use client';
import {useEffect,useRef,useState} from 'react';
import {Leaf,LoaderCircle} from 'lucide-react';
import {isLocalApp,localEndpoint,localCapabilitySchema,requestLocalIdentification} from '@/lib/ai/local-client';
import {cloudConfig} from '@/lib/cloud/config';
import {getSupabase} from '@/lib/cloud/client';
import IdentificationAccess,{type IdentificationAccessState} from './IdentificationAccess';
import {checkIdentificationService,type ServiceReadiness} from '@/lib/ai/readiness';
import DecisionResult from './DecisionResult';
import {fromGatewayResult,type IdentificationDecision} from '@/lib/ai/decision';
import {candidateDraft} from '@/lib/ai/apply';
import {identificationEndpoint,requestIdentification} from '@/lib/ai/client';
import type {IdentificationCandidate} from '@/lib/ai/contract';
import type {Observation} from '@/lib/domain';
import {readLibrary,saveObservation} from '@/lib/storage';
import DiscoveryPanel from './DiscoveryPanel';
import {preparePhoto} from '@/lib/image';

type Props={draft?:boolean;onBusyChange?:(busy:boolean)=>void;record:Observation;onApplied:(record:Observation)=>void};
function ImmediateIdentification({record,onApplied,draft=false,onBusyChange}:Props) {
 const [mode,setMode]=useState<'local'|'external'>('external');
 const [localReady,setLocalReady]=useState(false);const [localApp,setLocalApp]=useState(false);
 const [group,setGroup]=useState<'plant'|'insect'>(record.taxonGroup==='insect'?'insect':'plant');
 const [service,setService]=useState<ServiceReadiness>({state:'checking'});
 const [probeAttempt,setProbeAttempt]=useState(0);
 const [forceLogin,setForceLogin]=useState(false);
 const [access,setAccess]=useState<IdentificationAccessState>('checking');
 const groups=service.state==='ready'?service.groups:[];const policy=service.state==='ready'?service.policyUrl:'';
 const [consent,setConsent]=useState(false);const [noPeople,setNoPeople]=useState(false);
 const [busy,setBusy]=useState(false);const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [decision,setDecision]=useState<IdentificationDecision|null>(record.aiIdentification?.decision||null);
 const controller=useRef<AbortController|null>(null);const mounted=useRef(true);const flight=useRef(false);
 useEffect(()=>{
  mounted.current=true;
  const c=new AbortController();
  if(isLocalApp()){setLocalApp(true);void fetch(`${localEndpoint}/capabilities`,{signal:c.signal,credentials:'omit',cache:'no-store'}).then(r=>r.json()).then(raw=>{localCapabilitySchema.parse(raw);setLocalReady(true);if(!cloudConfig.enabled)setMode('local');}).catch(()=>{});}
  return ()=>{mounted.current=false;c.abort();controller.current?.abort();onBusyChange?.(false);};
 },[]);
 useEffect(()=>{
  const c=new AbortController();let active=true;setService({state:'checking'});
  void checkIdentificationService(cloudConfig.enabled?identificationEndpoint:null,c.signal).then(value=>{if(active)setService(value);}).catch(()=>{});
  return()=>{active=false;c.abort();};
 },[probeAttempt]);
 const ready=!record.demo&&(mode==='local'?localReady:Boolean(identificationEndpoint&&cloudConfig.enabled&&groups.includes(group)&&policy));
 async function identify(){
  if(!ready||!consent||!noPeople||flight.current||access!=='signed-in')return;
  if(mode==='external'&&!navigator.onLine){setMessage('오프라인이에요. 연결 후 다시 시도해 주세요.');return;}
  flight.current=true;onBusyChange?.(true);const c=new AbortController();controller.current=c;setBusy(true);setMessage('');setDecision(null);
  try{
   let token='';
   if(mode==='external'){const client=await getSupabase();const {data}=await client.auth.getSession();
    if(!data.session){setAccess('signed-out');throw new Error('로그인이 필요해요. 먼저 기록을 저장하고 로그인해 주세요.');}token=data.session.access_token;}
   if(c.signal.aborted)return;
   const [prefix,encoded]=record.photo.split(',');
   const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
   const photo=await preparePhoto(new File([bytes],'observation',{type:prefix.slice(5).split(';')[0]}));
   if(c.signal.aborted)return;
   const input={requestId:crypto.randomUUID(),observationId:record.id,photo,taxonGroup:group,transmissionConsent:true,noPeople:true};
   const started=performance.now();
   const local=mode==='local'?await requestLocalIdentification(input,c.signal):null;
   const answer=local?null:await requestIdentification(identificationEndpoint!,token,input,c.signal);
   const next=local?.decision||fromGatewayResult(answer!);
   if(!c.signal.aborted&&mounted.current){
    setDecision(next);
    const updated={...record,taxonGroup:group,aiIdentification:{decision:next,analyzedAt:new Date().toISOString(),elapsedMs:Math.round(performance.now()-started)}};
    if(draft){onApplied(updated);return;}
    await saveObservation(updated,record.updatedAt);
    const latest=(await readLibrary()).observations.find(o=>o.id===record.id);
    if(!c.signal.aborted&&mounted.current&&latest){onApplied(latest);setMessage(local?`이 Mac에서 분석했어요 · ${local.metrics.elapsedMs}ms · 외부 API 비용 $0 (기기 비용 제외)`:'분석 결과를 기록에 보관했어요.');}
   }
  }catch(error){if(mounted.current&&!c.signal.aborted){if(error instanceof Error&&error.message.includes('로그인'))setForceLogin(true);setDecision({state:'unavailable',reason:error instanceof Error&&error.name==='TimeoutError'?'timeout':error instanceof Error&&error.message.includes('로그인')?'unauthorized':error instanceof Error&&error.message.includes('한도')?'quota':error instanceof Error&&error.message.includes('준비되지')?'not_configured':error instanceof Error&&error.name==='ZodError'?'invalid_response':'network',retryable:true,needsHumanReview:true});setMessage(error instanceof Error&&error.name==='TimeoutError'?'응답 시간이 길어 중단했어요. 수동 기록을 계속할 수 있어요.':error instanceof Error?error.message:'연결하지 못했어요.');}}
  finally{if(controller.current===c){flight.current=false;onBusyChange?.(false);if(mounted.current)setBusy(false);}}
 }
 async function apply(candidate:IdentificationCandidate){
  if(flight.current||decision?.state!=='candidates')return;flight.current=true;setSaving(true);setMessage('');
  try{
   const updated={...candidateDraft(record,candidate),taxonGroup:group};
   if(draft){onApplied(updated);return;}
   await saveObservation(updated,record.updatedAt);
   const latest=(await readLibrary()).observations.find(o=>o.id===record.id);
   if(mounted.current&&latest)onApplied(latest);
  }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:'후보를 저장하지 못했어요.');}
  finally{flight.current=false;if(mounted.current)setSaving(false);}
 }
 return <section className="m-identify" aria-labelledby="identify-title">
  <h2 id="identify-title"><Leaf size={20}/> 식물·곤충 이름 찾기</h2>
  <p>사진에서 이름 후보를 찾아요. 확정된 이름은 아니에요.</p>
  {localApp&&<label>식별 처리 방식<select value={mode} disabled={busy||saving} onChange={e=>{setMode(e.target.value as typeof mode);setConsent(false);setNoPeople(false);setDecision(null);setMessage('');}}><option value="local">이 Mac에서 처리 · 실험용</option><option value="external">외부 API · 로그인 필요</option></select></label>}
  <details><summary>찾을 생물 바꾸기</summary><label>찾을 생물<select value={group} disabled={busy||saving} onChange={e=>{setGroup(e.target.value as typeof group);setDecision(null);setConsent(false);setMessage('');}}><option value="plant">식물</option><option value="insect">곤충</option></select></label></details>
  {cloudConfig.enabled&&!record.demo&&<IdentificationAccess draft={draft} recordId={record.id} forceLogin={forceLogin} onState={setAccess}/>}
  {access==='signed-in'&&<>{!ready?<div className="m-private-note"><p>{record.demo?'예제 사진은 전송하지 않아요. 직접 촬영한 기록에서 사용해 주세요.':mode==='local'?'이 Mac의 실험용 인식 서버에 연결하지 못했어요. 수동 기록을 계속할 수 있어요.':service.state==='checking'?'이름 찾기 서버를 확인하고 있어요. 사진을 보내지 않는 연결 확인입니다.':service.state==='unconfigured'?'이 배포에는 온라인 식별 연결이 설정되지 않았어요. 사진을 먼저 저장하고 나중에 이름을 확인할 수 있어요.':service.state==='disabled'?'인식 서버 연결 준비 중이에요. 지금은 이름을 직접 기록할 수 있어요.':service.state==='timeout'?'서버 응답이 늦어 연결 확인을 멈췄어요. 사진을 먼저 저장하거나 잠시 뒤 다시 확인해 주세요.':service.state==='invalid'?'식별 서버의 응답이나 사진 처리 안내를 확인할 수 없어 전송을 막았어요. 수동 기록은 계속할 수 있어요.':service.state==='unavailable'?'식별 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요. 사진은 먼저 저장할 수 있어요.':'선택한 생물은 현재 연결된 식별 서비스에서 지원하지 않아요. 이름 없이 저장할 수 있어요.'}</p>{!record.demo&&mode==='external'&&['timeout','invalid','unavailable','disabled'].includes(service.state)&&<button type="button" className="m-secondary" onClick={()=>setProbeAttempt(n=>n+1)}>식별 연결 다시 확인</button>}</div>:<>
   {mode==='local'?<p>이 Mac의 실험용 소형 모델로 분석해요. 사진은 외부 서비스로 보내지 않고 분석 중 메모리에서만 처리해요. GPS는 사용하지 않으며 한국어 이름과 정확도는 검증 중입니다.</p>:<p>이 사진 한 장을 {group==='plant'?'Pl@ntNet':'Kindwise insect.id'}로 전송해요. GPS·메모는 보내지 않아요. 공급자의 보관·재사용 조건은 <a href={policy} target="_blank" rel="noreferrer">사진 처리 안내</a>에서 확인하세요.</p>}
   <label className="m-identify-check"><input type="checkbox" checked={noPeople} disabled={busy||saving} onChange={e=>setNoPeople(e.target.checked)}/>인물과 개인정보가 없는 사진입니다</label>
   <label className="m-identify-check"><input type="checkbox" checked={consent} disabled={busy||saving} onChange={e=>setConsent(e.target.checked)}/>{mode==='local'?'이 Mac에서 사진을 분석하는 데 동의합니다':'사진 전송과 처리 안내에 동의합니다'}</label>
  </>}
  <button type="button" className="m-secondary" disabled={!ready||!consent||!noPeople||busy||saving||access!=='signed-in'} onClick={()=>void identify()}>{busy?<><LoaderCircle className="spin" size={18}/> 이름 후보 찾는 중</>:'이름 후보 찾기'}</button>
  {busy&&<button type="button" className="m-text" onClick={()=>{controller.current?.abort();setBusy(false);setMessage('대기를 취소했어요. 이미 전송된 사진의 처리는 완료될 수 있어요.');}}>대기 취소</button>}
  </>}<p role="status" aria-live="polite">{message}</p>
  {decision&&<DecisionResult decision={decision} saving={saving||busy} onCandidate={index=>{const taxon=decision.state==='candidates'?decision.candidates[index]:null;if(taxon)void apply({scientificName:taxon.scientificName,commonName:taxon.koreanName||taxon.displayName||'',score:taxon.score});}}/>}
  {record.aiAssisted&&<p className="m-private-note">AI 후보를 반영한 미확정 기록입니다.</p>}
  {record.aiIdentification&&<details><summary>분석 정보</summary><p className="m-private-note">최근 분석 {record.aiIdentification.elapsedMs}ms · {record.aiIdentification.decision.state==='unavailable'?'연결 실패':record.aiIdentification.decision.provenance.provider} · {draft?'사진과 함께 저장할 분석 결과예요.':'분석 결과를 기기에 보관했어요.'}</p></details>}
 </section>;
}

export function IdentificationChoice({value,onChange,disabled=false}:{value:'now'|'tomorrow';onChange:(value:'now'|'tomorrow')=>void;disabled?:boolean}){
 return <fieldset className="m-identification-choice" disabled={disabled}><legend>이름을 알아보는 방식</legend>{([{value:'now',title:'지금 알아보기',description:'이름 후보를 바로 확인해요.'},{value:'tomorrow',title:'내일의 발견',description:'먼저 예상하고 내일 오전 9시에 비교해요.'}] as const).map(choice=><label key={choice.value} className={value===choice.value?'is-selected':''}><input type="radio" name="identification-timing" value={choice.value} checked={value===choice.value} onChange={()=>onChange(choice.value)}/><span><strong>{choice.title}</strong><small>{choice.description}</small></span></label>)}</fieldset>;
}
export default function IdentificationPanel(props:Props){
 const [timing,setTiming]=useState<'now'|'tomorrow'>(props.record.identificationTiming||'now');
 const [working,setWorking]=useState(false);
 const [changing,setChanging]=useState(false),[choiceError,setChoiceError]=useState('');
 const tomorrow=Boolean(props.record.discoveryId)||timing==='tomorrow';
 async function choose(value:'now'|'tomorrow'){
  if(changing||working||props.record.discoveryId)return;
  setChanging(true);setChoiceError('');
  try{const updated={...props.record,identificationTiming:value};const stored=props.draft?updated:await saveObservation(updated,props.record.updatedAt);setTiming(value);props.onApplied(stored);}
  catch{setChoiceError('선택을 저장하지 못했어요. 다시 시도해 주세요.');}
  finally{setChanging(false);}
 }
 if(props.record.taxonGroup==='other')return <p className="m-private-note">기타 생명은 아직 이름 찾기를 지원하지 않아요. 이름 없이 기록할 수 있어요.</p>;
 return <><IdentificationChoice value={tomorrow?'tomorrow':'now'} disabled={changing||working||Boolean(props.record.discoveryId)} onChange={value=>void choose(value)}/>{choiceError&&<p role="alert">{choiceError}</p>}{tomorrow?<DiscoveryPanel {...props} onBusyChange={value=>{setWorking(value);props.onBusyChange?.(value);}}/>:<ImmediateIdentification {...props} onBusyChange={value=>{setWorking(value);props.onBusyChange?.(value);}}/>}</>;
}
