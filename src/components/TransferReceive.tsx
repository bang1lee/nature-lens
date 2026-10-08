'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Leaf,LockKeyhole,LoaderCircle,Check} from 'lucide-react';
import {parseTransferLink,fetchTransfer,decryptTransfer,previewTransfer,restoreTransfer,transferErrorMessage,markTransferRestored,wasTransferRestored} from '@/lib/transfer';
import type {TransferLink} from '@/lib/transfer-contract';
import './transfer.css';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
export default function TransferReceive(){
 const initial=useRef<{link?:TransferLink;error?:unknown}|null>(null),lock=useRef(false),generation=useRef(0);
 const [restoring,setRestoring]=useState(false);
 const [status,setStatus]=useState('링크를 확인하는 중…'),[error,setError]=useState(''),[text,setText]=useState(''),[preview,setPreview]=useState<ReturnType<typeof previewTransfer>|null>(null),[consent,setConsent]=useState(false),[done,setDone]=useState<number|null>(null),[restored,setRestored]=useState(false);
 useEffect(()=>{
  // StrictMode replays this effect. Keep the one-time fragment in memory before removing it.
  let controller:AbortController|null=null;let closed=false;
  function capture(){try{return {link:parseTransferLink(location.hash)};}catch(error){return {error};}finally{history.replaceState(null,'',location.pathname);}}
  if(!initial.current)initial.current=capture();
  async function open(data:{link?:TransferLink;error?:unknown}){
   generation.current++;
   controller?.abort();const current=new AbortController();controller=current;
   setPreview(null);setText('');setDone(null);setConsent(false);setError('');setStatus('링크를 확인하는 중…');
   if(data.error){setError(transferErrorMessage(data.error));setStatus('');return;}
   try{const bytes=await fetchTransfer(data.link!,current.signal);if(closed||current.signal.aborted)return;setStatus('기록을 여는 중…');const raw=await decryptTransfer(bytes,data.link!.key);if(closed||current.signal.aborted)return;const info=previewTransfer(raw);setText(raw);setPreview(info);setRestored(wasTransferRestored(data.link!.id));setStatus('');}
   catch(e){if(!closed&&!current.signal.aborted){setError(transferErrorMessage(e));setStatus('');}}
  }
  function changed(){initial.current=capture();void open(initial.current);}
  window.addEventListener('hashchange',changed);void open(initial.current);
  return()=>{closed=true;generation.current++;controller?.abort();window.removeEventListener('hashchange',changed);};
 },[]);
 async function restore(){const id=initial.current?.link?.id;if(lock.current||!consent||!text||!id)return;const started=generation.current;lock.current=true;setRestoring(true);setStatus('기록을 추가하는 중…');setError('');
  try{const n=await restoreTransfer(text);let warning='';try{markTransferRestored(id);}catch{warning='복원은 완료됐지만 전달 확인 정보를 보관하지 못했어요. 같은 기록은 다시 덮어쓰지 않습니다.';}
   if(started===generation.current){setDone(n);setPreview(null);setText('');if(warning)setError(warning);}}
  catch(e){if(started===generation.current)setError(transferErrorMessage(e));}finally{lock.current=false;setRestoring(false);if(started===generation.current)setStatus('');}}
 const activity=status||(restoring?'기록을 추가하는 중…':'');
 return <div className="transfer-receive"><header className="receive-brand"><Leaf size={25}/><a href={`${base}/board/`}>nature lens</a><span>비공개 임시 전달</span></header><main id="main" className="receive-paper" aria-busy={Boolean(activity)}>
  <span className="receive-lock"><LockKeyhole size={26}/></span>
  {done!==null?<><span className="receive-success"><Check size={26}/></span><h1>{done}건을 초안으로 추가했어요</h1><p>사진과 메모를 가져왔어요. 출판 전에 다시 검수하세요.</p><p>보낸 브라우저에서 삭제하거나 24시간 뒤 만료됩니다.</p><a className="m-primary" href={`${base}/board/`}>관찰 보드로 <ArrowRight size={18}/></a></>:preview?<><h1>기록을 가져오기 전에 확인하세요</h1><p>관찰 {preview.observations}건 · 컬렉션 {preview.collections}개 · 사진 포함 · 정밀 GPS 제외</p><div className="receive-previews">{preview.items.map(o=><figure key={o.id}><img src={o.photo} alt={o.title}/><figcaption>{o.title}</figcaption></figure>)}</div><p>복원하면 초안으로 추가되며 다시 검수해야 합니다. 이미 있는 기록을 덮어쓰지 않고 새로운 기록만 추가합니다.</p>{restored&&<p className="transfer-notice">이 브라우저에서 이미 복원한 전달이에요. 다시 복원해도 같은 ID의 기록은 추가하지 않습니다.</p>}<label className="transfer-check"><input type="checkbox" aria-label="초안으로 추가하고 다시 검수해야 함을 확인했습니다" checked={consent} disabled={Boolean(activity)} onChange={e=>setConsent(e.target.checked)}/><span>초안으로 추가하고 다시 검수해야 함을 확인했습니다.</span></label><div className="receive-actions"><button className="m-primary" disabled={!consent||Boolean(activity)} onClick={()=>void restore()}>이 브라우저에 추가하기</button><a className="m-secondary" href={`${base}/board/`}>취소</a></div></>:<><h1>{error?'전달을 열지 못했어요':'안전하게 기록을 가져와요'}</h1>{!status&&<p>전체 전달 링크를 다시 열어 주세요. 주소창에서는 키를 바로 지우므로 새로고침하면 링크가 다시 필요해요.</p>}</>}
  {activity&&<p role="status"><LoaderCircle className="spin" size={18}/> {activity}</p>}{error&&<p role="alert" className="m-error">{error}</p>}
  <footer>복원을 선택하기 전에는 이 브라우저의 기록을 변경하지 않습니다.</footer>
 </main><p className="receive-foot">한 장의 발견을, 다음 기록으로.</p></div>;
}
