'use client';
import {useEffect,useState} from 'react';
import {BookOpen} from 'lucide-react';
import {lookupTaxonInfo,taxonInfoEnabled,type TaxonInfo} from '../../lib/taxon-info';
import './taxon-card.css';

export type TaxonLookup={state:'off'|'loading'|'done';info:TaxonInfo|null};
/** Looks up encyclopedia details for a scientific name. Pass null to skip (demo data, empty names). */
export function useTaxonInfo(scientificName:string|null|undefined):TaxonLookup{
 const name=taxonInfoEnabled&&scientificName?.trim()?scientificName.trim():null;
 const [lookup,setLookup]=useState<{name:string|null;info:TaxonInfo|null;done:boolean}>({name,info:null,done:false});
 useEffect(()=>{
  if(!name)return;let active=true;
  setLookup({name,info:null,done:false});
  void lookupTaxonInfo(name).then(info=>{if(active)setLookup({name,info,done:true});});
  return()=>{active=false;};
 },[name]);
 if(!name)return {state:'off',info:null};
 return lookup.name===name&&lookup.done?{state:'done',info:lookup.info}:{state:'loading',info:null};
}

/** Reference photo, Korean name and a short description with a visible source. */
export function TaxonDetails({lookup}:{lookup:TaxonLookup}){
 const info=lookup.info;
 if(!info)return null;
 return <div className="nl-taxon">
  {info.image&&<img src={info.image} alt={`${info.koreanName??info.matchedName} 참고 사진`} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}
  {info.level==='genus'&&<p className="nl-taxon-level">종까지는 찾지 못해 <i>{info.matchedName}</i> 속(屬) 정보를 보여드려요.</p>}
  {info.description&&<p>{info.description}</p>}
  <p className="nl-taxon-source">참고 사진·이름·설명 출처: 위키백과. 내 사진과 다른 개체이며 표준 식물명과 다를 수 있어요.{info.url&&<> <a href={info.url} target="_blank" rel="noreferrer"><BookOpen size={14} aria-hidden="true"/> 더 읽기</a></>}</p>
 </div>;
}

/** Stand-alone card for a saved record that already has a scientific name. */
export default function TaxonCard({scientificName}:{scientificName:string}){
 const lookup=useTaxonInfo(scientificName);
 if(lookup.state!=='done'||!lookup.info)return null;
 return <section className="nl-taxon-card" aria-label="식물 정보"><h2>{lookup.info.koreanName??lookup.info.matchedName} 알아보기</h2><TaxonDetails lookup={lookup}/></section>;
}
