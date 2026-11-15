'use client';
import {useEffect,useRef,useState} from 'react';
import {readPrivateLocation,removeObservationLocation} from '@/lib/storage';
import type {PrivateLocation} from '@/lib/location';
export default function PrivateLocationNote({id,onRemoved,onBusyChange}:{id:string;onRemoved:()=>void|Promise<void>;onBusyChange?:(busy:boolean)=>void}) {
 const [location,setLocation]=useState<PrivateLocation>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);const flight=useRef(false);
 useEffect(()=>{let active=true;void readPrivateLocation(id).then(p=>{if(active)setLocation(p);}).catch(()=>{if(active)setError('정밀 위치를 확인하지 못했어요.');});return()=>{active=false;};},[id]);
 async function remove(){
  if(flight.current)return;
  flight.current=true;onBusyChange?.(true);setBusy(true);setError('');
  try{
   await removeObservationLocation(id);setLocation(undefined);
   try{await onRemoved();}catch{setError('위치는 삭제했지만 기록을 새로 불러오지 못했어요. 화면을 다시 열어 주세요.');}
  }catch{setError('위치 정보를 삭제하지 못했어요.');}
  finally{flight.current=false;setBusy(false);onBusyChange?.(false);}
 }
 return <div className="m-private-note">{error&&<p role="alert">{error}</p>}{location&&<><p>이 브라우저 전용 GPS · 정확도 약 {Math.round(location.accuracy)}m<br/>일반 백업과 저널에는 포함되지 않아요.</p></>}<button className="m-text" disabled={busy} onClick={()=>void remove()}>{busy?'위치 정보 삭제 중…':'모든 위치 정보 삭제'}</button></div>;
}
