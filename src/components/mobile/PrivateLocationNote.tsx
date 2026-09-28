'use client';
import {useEffect,useState} from 'react';
import {readPrivateLocation,removeObservationLocation} from '@/lib/storage';
import type {PrivateLocation} from '@/lib/location';
export default function PrivateLocationNote({id,onRemoved}:{id:string;onRemoved:()=>void}) {
 const [location,setLocation]=useState<PrivateLocation>();const [error,setError]=useState('');
 useEffect(()=>{let active=true;void readPrivateLocation(id).then(p=>{if(active)setLocation(p);}).catch(()=>{if(active)setError('정밀 위치를 확인하지 못했어요.');});return()=>{active=false;};},[id]);
 return <div className="m-private-note">{error&&<p role="alert">{error}</p>}{location&&<><p>이 브라우저 전용 GPS · 정확도 약 {Math.round(location.accuracy)}m<br/>일반 백업과 저널에는 포함되지 않아요.</p></>}<button className="m-text" onClick={()=>void removeObservationLocation(id).then(()=>{setLocation(undefined);onRemoved();}).catch(()=>setError('위치 정보를 삭제하지 못했어요.'))}>모든 위치 정보 삭제</button></div>;
}
