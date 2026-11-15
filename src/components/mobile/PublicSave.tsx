'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {CloudCheck,CloudOff,Globe,LoaderCircle,Smartphone} from 'lucide-react';
import type {Observation} from '@/lib/domain';
import {cloudConfig} from '@/lib/cloud/config';
import {getSupabase} from '@/lib/cloud/client';
import {buildSubmissionPayload} from '@/lib/cloud/contract';
import {cloudErrorMessage,createAlias,fetchAlias,listMySubmissions,submitObservation} from '@/lib/cloud/api';
import {saveObservation} from '@/lib/storage';
import IdentificationAccess,{type IdentificationAccessState} from './IdentificationAccess';

// Remembers, on this device only, which local records were already accepted by the public queue.
const KEY='nature-lens-public-saves';
function readSaves():Record<string,string>{try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}}
function markSaved(id:string){try{localStorage.setItem(KEY,JSON.stringify({...readSaves(),[id]:new Date().toISOString()}));}catch{/* The server copy still exists; only the local badge is lost. */}}

type Phase='idle'|'saving'|'failed'|'unconfirmed'|'saved';
type Props={record:Observation;onApplied:(record:Observation)=>void;onBusyChange?:(busy:boolean)=>void};

export default function PublicSave({record,onApplied,onBusyChange}:Props){
 const [open,setOpen]=useState(false),[phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState('');
 const [access,setAccess]=useState<IdentificationAccessState>('checking');
 const [alias,setAlias]=useState<string|null>(null),[aliasState,setAliasState]=useState<'loading'|'ready'|'error'>('loading'),[aliasInput,setAliasInput]=useState(''),[aliasAttempt,setAliasAttempt]=useState(0);
 const [name,setName]=useState(record.species),[memo,setMemo]=useState(record.notes);
 const [agree,setAgree]=useState(false),[noPeople,setNoPeople]=useState(false);
 const flight=useRef(false),alive=useRef(true),started=useRef(0),needsName=useRef(!record.species.trim()),needsMemo=useRef(!record.notes.trim());
 const field=useId();
 useEffect(()=>{alive.current=true;if(readSaves()[record.id])setPhase('saved');return()=>{alive.current=false;onBusyChange?.(false);};},[record.id]);
 // A name applied from a candidate after this panel opened should not have to be typed again.
 useEffect(()=>{if(record.species.trim())setName(record.species);},[record.species]);
 useEffect(()=>{
  if(!open||access!=='signed-in')return;let active=true;setAliasState('loading');
  void getSupabase().then(async client=>{const {data}=await client.auth.getSession();if(!data.session)throw Error();const value=await fetchAlias(client,data.session.user.id);if(active){setAlias(value);setAliasState('ready');}}).catch(()=>{if(active)setAliasState('error');});
  return()=>{active=false;};
 },[open,access,aliasAttempt]);

 async function session(){const client=await getSupabase();const {data}=await client.auth.getSession();if(!data.session)throw new Error('로그인이 필요해요. 로그인 상태를 다시 확인해 주세요.');return {client,userId:data.session.user.id};}
 async function submit(){
  if(flight.current||phase==='saved'||phase==='unconfirmed')return;flight.current=true;setPhase('saving');setError('');onBusyChange?.(true);
  try{
   const {client}=await session();
   if(!alias){const created=await createAlias(client,aliasInput);if(alive.current)setAlias(created);}
   const species=name.trim(),notes=memo.trim();
   const updated={...record,species,notes,title:record.title==='오늘 만난 자연'&&species?species:record.title,consent:true,noPeople:true};
   const changed=updated.species!==record.species||updated.notes!==record.notes||updated.title!==record.title||!record.consent||!record.noPeople;
   const stored=changed?await saveObservation(updated,record.updatedAt):record;
   if(changed&&alive.current)onApplied(stored);
   const built=buildSubmissionPayload(stored,{uploadConsent:true,noPeople:true});
   if(!built.ok)throw new Error(built.issues.join(' '));
   started.current=Date.now();
   await submitObservation(client,built.payload);
   markSaved(record.id);if(alive.current)setPhase('saved');
  }catch(e){
   if(!alive.current)return;
   const message=e instanceof Error?e.message:cloudErrorMessage(e);
   // A slow reply may still have been accepted: never offer a blind retry in that case.
   if(message.includes('제출 결과를 확인하지 못했어요')){setPhase('unconfirmed');setError('저장 결과를 확인하지 못했어요. 중복 저장을 막기 위해 먼저 결과를 확인해 주세요.');}
   else{setPhase('failed');setError(message);}
  }finally{flight.current=false;onBusyChange?.(false);}
 }
 async function confirmResult(){
  if(flight.current)return;flight.current=true;setError('');onBusyChange?.(true);
  try{
   const {client,userId}=await session();const mine=await listMySubmissions(client,userId);
   const found=mine.some(item=>item.title===record.title&&item.observed_on===record.date&&Date.parse(item.created_at)>=started.current-60_000);
   if(!alive.current)return;
   if(found){markSaved(record.id);setPhase('saved');}else{setPhase('failed');setError('아직 저장되지 않았어요. 사진은 그대로예요. 다시 저장할 수 있어요.');}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:cloudErrorMessage(e));}
  finally{flight.current=false;onBusyChange?.(false);}
 }

 if(record.demo)return null;
 const saving=phase==='saving';
 return <section className="m-public" aria-label="공개 저장">
  {phase==='saved'?<><p className="m-save-state is-cloud" role="status"><CloudCheck size={20} aria-hidden="true"/> 공개 저장을 접수했어요. 운영 확인 후 모두에게 보여요.</p><details><summary>자세히</summary><p>공개를 취소하려면 설정의 ‘함께 관찰하기’에서 철회할 수 있어요. 이 기기의 기록은 그대로 남아요.</p></details></>
  :!cloudConfig.enabled?<p className="m-save-state"><Smartphone size={20} aria-hidden="true"/> 이 기기에만 보관 중이에요. 공개 저장은 아직 연결되지 않았어요.</p>
  :<>
   <p className="m-save-state"><Smartphone size={20} aria-hidden="true"/> 이 기기에만 보관 중</p>
   {!open?<button type="button" key={record.species.trim()?'named':'unnamed'} className={record.species.trim()?'m-primary':'m-secondary'} onClick={()=>setOpen(true)}><Globe size={19} aria-hidden="true"/> 공개로 저장</button>:<>
    <IdentificationAccess draft={false} recordId={record.id} onState={setAccess}/>
    {access==='signed-in'&&<form onSubmit={e=>{e.preventDefault();void submit();}}>
     {aliasState==='loading'?<p role="status">공개 별칭을 확인하고 있어요.</p>:aliasState==='error'?<><p role="alert">공개 별칭을 확인하지 못했어요. 사진은 그대로예요.</p><button type="button" className="m-secondary" onClick={()=>setAliasAttempt(n=>n+1)}>다시 확인</button></>:!alias&&<label htmlFor={`${field}-alias`}>공개 별칭<input id={`${field}-alias`} required maxLength={20} value={aliasInput} disabled={saving} onChange={e=>setAliasInput(e.target.value)} placeholder="이메일 대신 보이는 이름 · 2–20자"/></label>}
     {needsName.current&&<label htmlFor={`${field}-name`}>이름<input id={`${field}-name`} required maxLength={100} value={name} disabled={saving} onChange={e=>setName(e.target.value)} placeholder="공개할 생물 이름"/></label>}
     {needsMemo.current&&<label htmlFor={`${field}-memo`}>한 줄 메모<input id={`${field}-memo`} required maxLength={4000} value={memo} disabled={saving} onChange={e=>setMemo(e.target.value)} placeholder="색, 모양, 그때의 느낌"/></label>}
     <label><input type="checkbox" checked={agree} disabled={saving} onChange={e=>setAgree(e.target.checked)}/>사진과 기록을 모두에게 공개하는 데 동의해요</label>
     <label><input type="checkbox" checked={noPeople} disabled={saving} onChange={e=>setNoPeople(e.target.checked)}/>사진에 사람·개인정보가 없어요</label>
     {error&&<p className="m-save-state is-failed" role="alert"><CloudOff size={20} aria-hidden="true"/> {error}</p>}
     {phase==='unconfirmed'?<button type="button" className="m-primary" onClick={()=>void confirmResult()}>저장 결과 확인</button>
     :<button className="m-primary" disabled={!agree||!noPeople||saving||aliasState!=='ready'}>{saving?<><LoaderCircle className="spin" size={19} aria-hidden="true"/> 저장하는 중</>:<><Globe size={19} aria-hidden="true"/> {phase==='failed'?'다시 저장':'동의하고 공개로 저장'}</>}</button>}
    </form>}
   </>}
   <p className="m-public-scope"><Globe size={18} aria-hidden="true"/> 운영 확인 후 사진과 기록이 모두에게 보여요</p>
   <details><summary>자세히</summary><p>사진, 이름, 관찰일, 메모와 공개 별칭이 보여요. 이메일과 정밀 GPS, 지도 위치는 공개하지 않아요. 사진 전송(이름 확인)과 공개 저장은 따로 동의해요.</p></details>
  </>}
 </section>;
}
