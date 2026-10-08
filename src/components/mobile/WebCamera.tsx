'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,Leaf,LoaderCircle,SwitchCamera,Flower2,Cherry} from 'lucide-react';
export default function WebCamera({onCapture}:{onCapture:(photo:string)=>void}) {
 const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);const generation=useRef(0);
 const [live,setLive]=useState(false);const [pending,setPending]=useState(false);const [ready,setReady]=useState(false);
 const [facing,setFacing]=useState<'environment'|'user'>('environment');const [error,setError]=useState('');
 function stop(){generation.current++;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;setLive(false);setPending(false);setReady(false);}
 useEffect(()=>{
  const suspend=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',suspend);
  return ()=>{document.removeEventListener('visibilitychange',suspend);generation.current++;stream.current?.getTracks().forEach(t=>t.stop());};
 },[]);
 async function start(next=facing){
  stop();setError('');
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setError('카메라는 HTTPS 또는 localhost에서 사용할 수 있어요. 아래에서 사진을 선택해 주세요.');return;}
  const request=++generation.current;setPending(true);setFacing(next);
  try{
   const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:next},width:{ideal:1600},height:{ideal:1200}}});
   if(request!==generation.current){acquired.getTracks().forEach(t=>t.stop());return;}
   stream.current=acquired;setLive(true);
   const element=video.current;if(!element){stop();return;}element.srcObject=acquired;
   acquired.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(request===generation.current){stop();setError('카메라 연결이 끝났어요. 다시 켜거나 사진을 선택해 주세요.');}},{once:true}));
   await element.play();if(request===generation.current)setReady(element.videoWidth>0);
  }catch(e){if(request!==generation.current)return;stop();const name=e instanceof DOMException?e.name:'';setError(name==='NotAllowedError'?'카메라 권한이 허용되지 않았어요. 브라우저 권한을 변경하거나 사진을 선택해 주세요.':name==='NotFoundError'?'연결된 카메라가 없어요. 사진 선택을 이용해 주세요.':'카메라를 열지 못했어요. 다른 앱의 카메라 사용을 종료하거나 사진을 선택해 주세요.');}
  finally{if(request===generation.current)setPending(false);}
 }
 function capture(){
  const v=video.current;if(!v||!ready||!v.videoWidth)return;
  const scale=Math.min(1,1600/Math.max(v.videoWidth,v.videoHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);
  const ctx=canvas.getContext('2d');if(!ctx){setError('사진을 만들지 못했어요. 다시 시도해 주세요.');return;}
  ctx.drawImage(v,0,0,canvas.width,canvas.height);const photo=canvas.toDataURL('image/jpeg',.85);stop();onCapture(photo);
 }
 return <div className="m-web-camera">
  <div className={`m-viewfinder ${live?'lens-viewfinder-live':''}`}>
   <video ref={video} hidden={!live} autoPlay muted playsInline aria-label="카메라 미리보기" onLoadedData={()=>setReady(Boolean(stream.current&&video.current?.videoWidth))}/>
   {!live&&<><Leaf size={60} strokeWidth={1}/><h1>오늘 만난 자연을<br/>사진으로 남겨요.</h1><p>카메라를 켜거나 아래에서 사진을 선택하세요.<br/>촬영 전에는 카메라를 사용하지 않아요.</p></>}
   {live&&<><div className="lens-focus-frame" aria-hidden="true"><i/><i/><i/><i/></div><p className="lens-focus-hint">관찰할 자연을 가운데에 담아보세요</p></>}
  </div>
  {error&&<p className="m-error" role="alert">{error}</p>}
  <div className={`m-live-controls ${live?'lens-controls-live':''}`}>
   {!live&&!pending&&<button className="m-secondary" onClick={()=>void start()}><Camera size={20}/> 카메라 켜기</button>}
   {pending&&<p role="status"><LoaderCircle className="spin" size={18}/> 카메라 연결 대기 중</p>}
   {live&&<><button className="m-secondary" disabled={pending} onClick={()=>void start(facing==='environment'?'user':'environment')}><SwitchCamera size={18}/> 카메라 전환</button><button className="m-shutter" aria-label="사진 촬영하기" disabled={!ready||pending} onClick={capture}><Camera size={27}/></button></>}
   {(live||pending)&&<button className="m-secondary" onClick={stop}>{pending?'연결 취소':'카메라 끄기'}</button>}
  </div>
  <div className="lens-shot-guide"><span><Leaf size={16} aria-hidden="true"/> 잎</span><span><Flower2 size={16} aria-hidden="true"/> 꽃</span><span><Cherry size={16} aria-hidden="true"/> 열매</span><p>모양과 무늬가 선명하게 보이도록 가까이 담아주세요.</p></div>
 </div>;
}
