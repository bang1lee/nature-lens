'use client';
import {Camera} from 'lucide-react';
import type {IdentificationDecision} from '../../lib/ai/decision';
import {TaxonDetails,useTaxonInfo} from './TaxonCard';
import './decision-result.css';

const abstainText={provider_no_match:'사진에서 뚜렷한 후보를 찾지 못했어요.',insufficient_evidence:'이름을 좁히기에는 근거가 부족해요.',poor_photo:'흔들림이나 어두운 부분 때문에 특징을 보기 어려워요.',multiple_subjects:'여러 생물이 보여요. 한 대상에 가까이 다가가 찍어 주세요.',out_of_scope:'현재 지원하는 생물 범위에서 찾기 어려워요.'};
const unavailableText={network:'인터넷 연결을 확인한 뒤 다시 시도해 주세요.',timeout:'응답이 늦어 요청을 중단했어요.',not_configured:'이름 찾기 연결을 준비하고 있어요.',unauthorized:'로그인이 필요하거나 세션이 만료됐어요.',quota:'현재 이용 한도에 도달했어요.',invalid_response:'응답 형식을 확인하지 못했어요.'};
export const decisionDemos:Record<IdentificationDecision['state'],IdentificationDecision>={
 candidates:{state:'candidates',needsHumanReview:true,provenance:{provider:'화면 시연',modelVersion:'mock-v1',policyVersion:'demo'},candidates:[{scientificName:'Pinus densiflora',koreanName:'소나무',taxonId:null,rank:'species',score:.78,scoreMeaning:'uncalibrated'},{scientificName:'Pinus thunbergii',koreanName:'곰솔',taxonId:null,rank:'species',score:.61,scoreMeaning:'uncalibrated'}]},
 ancestor:{state:'ancestor',needsHumanReview:true,provenance:{provider:'화면 시연',modelVersion:'mock-v1',policyVersion:'demo'},taxon:{scientificName:'Pinus',koreanName:'소나무속',taxonId:null,rank:'genus',score:.8,scoreMeaning:'uncalibrated'}},
 abstain:{state:'abstain',needsHumanReview:true,provenance:{provider:'화면 시연',modelVersion:'mock-v1',policyVersion:'demo'},reason:'insufficient_evidence'},
 unavailable:{state:'unavailable',needsHumanReview:true,reason:'not_configured',retryable:false},
};
type Candidate=Extract<IdentificationDecision,{state:'candidates'}>['candidates'][number];
// Wording for the provider's similarity score. It is not a probability of being correct.
function strength(score:number){return score>=.6?'사진과 많이 닮았어요':score>=.35?'사진과 어느 정도 닮았어요':'닮은 정도가 낮아요 · 다른 각도 사진을 더하면 좋아요';}
function TopCandidate({candidate,demo,saving,onCandidate}:{candidate:Candidate;demo:boolean;saving:boolean;onCandidate?:(index:number,koreanName?:string)=>void}){
 const lookup=useTaxonInfo(demo?null:candidate.scientificName);
 const korean=lookup.info?.koreanName??candidate.koreanName??null;
 const name=korean||candidate.displayName||candidate.scientificName;
 return <li className="nl-top-candidate"><strong>{name}</strong><span><i>{candidate.scientificName}</i></span>{!korean&&<small>{lookup.state==='loading'?'한국어 이름 찾는 중…':'한국어 이름 미확인'}</small>}<small className="nl-strength">{strength(candidate.score)}</small><TaxonDetails lookup={lookup}/>{!demo&&onCandidate&&<button type="button" aria-label={`${name} 이름을 미확정 초안에 반영`} disabled={saving} onClick={()=>onCandidate(0,korean??undefined)}>이 이름으로 기록하기</button>}</li>;
}
function CandidateRow({candidate,index,demo,saving,onCandidate}:{candidate:Candidate;index:number;demo:boolean;saving:boolean;onCandidate?:(index:number,koreanName?:string)=>void}){
 const lookup=useTaxonInfo(demo?null:candidate.scientificName);
 const korean=lookup.info?.koreanName??candidate.koreanName??null;
 const name=korean||candidate.displayName||candidate.scientificName;
 return <li><strong>{name}</strong><span><i>{candidate.scientificName}</i></span><small>후보 점수 {Math.round(candidate.score*100)} / 100</small>{index>0&&!demo&&onCandidate&&<button type="button" aria-label={`${name} 이름을 미확정 초안에 반영`} disabled={saving} onClick={()=>onCandidate(index,korean??undefined)}>이 이름으로 기록하기</button>}</li>;
}
export default function DecisionResult({decision,demo=false,saving=false,onCandidate,onRetake}:{decision:IdentificationDecision;demo?:boolean;saving?:boolean;onCandidate?:(index:number,koreanName?:string)=>void;onRetake?:()=>void}){
 const retake=!demo&&onRetake?<button type="button" disabled={saving} onClick={onRetake}><Camera size={18} aria-hidden="true"/> 다른 각도 사진 추가</button>:null;
 return <div className="nl-decision" aria-live="polite" aria-atomic="true">
  <span className="nl-decision-label">{demo?'화면 시연 · 실제 분석 아님':'AI 보조 · 전문가 미검수'}</span>
  {decision.state==='candidates'&&<><h3>이런 생물일 수 있어요</h3><ul><TopCandidate key={decision.candidates[0].scientificName} candidate={decision.candidates[0]} demo={demo} saving={saving} onCandidate={onCandidate}/></ul><details><summary>다른 후보 보기</summary><p>후보 점수는 유사도 지표이며 정답 확률이 아니에요.</p><ul>{decision.candidates.map((candidate,index)=><CandidateRow key={`${candidate.scientificName}-${index}`} candidate={candidate} index={index} demo={demo} saving={saving} onCandidate={onCandidate}/>)}</ul></details></>}
  {decision.state==='ancestor'&&<><h3>아직 정확한 종은 알 수 없어요</h3><p><strong>{decision.taxon.koreanName||decision.taxon.scientificName}</strong> 수준의 분류만 제안할 수 있어요. 종 이름이 확정된 결과가 아닙니다.</p><p>다른 각도 사진이 필요해요. 잎의 앞뒷면과 전체 모습을 담아 주세요.</p>{retake}</>}
  {decision.state==='abstain'&&<><h3>다른 각도 사진이 필요해요</h3><p>{abstainText[decision.reason]}</p>{retake}</>}
  {decision.state==='unavailable'&&<><h3>지금은 식별을 사용할 수 없어요</h3><p>{unavailableText[decision.reason]}</p><p>이름을 몰라도 사진과 관찰 기록은 남길 수 있어요.</p></>}
  <p className="nl-decision-note">{demo?'시연 결과는 저장하거나 기록에 적용할 수 없어요.':'먹거나 약으로 써도 되는지 판단하는 데 사용하지 마세요.'}</p>
  {'provenance' in decision&&<details><summary>분석 출처</summary><small>{decision.provenance.provider} · {decision.provenance.modelVersion}</small></details>}
 </div>;
}
