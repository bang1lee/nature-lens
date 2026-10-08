'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,Copy,LockKeyhole,Trash2,LoaderCircle} from 'lucide-react';
import {buildTransferEnvelope,uploadTransfer,formatTransferLink,fetchServiceCapabilities,deleteTransfer,readSentTransfers,writeSentTransfers,transferErrorMessage} from '@/lib/transfer';
import '../transfer.css';
import type {SentTransferRecord} from '@/lib/transfer-contract';

type Prepared=Awaited<ReturnType<typeof buildTransferEnvelope>>;
export default function TransferPanel(){
 const [available,setAvailable]=useState(false),[checking,setChecking]=useState(true),[prepared,setPrepared]=useState<Prepared|null>(null),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[link,setLink]=useState(''),[sent,setSent]=useState<SentTransferRecord[]>([]),[now,setNow]=useState(0),[confirm,setConfirm]=useState<SentTransferRecord|null>(null);
 const lock=useRef(false),input=useRef<HTMLInputElement>(null),panel=useRef<HTMLElement>(null),prepareButton=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),caller=useRef<HTMLElement|null>(null);
 useEffect(()=>{const c=new AbortController();setSent(readSentTransfers());setNow(Date.now());void fetchServiceCapabilities(c.signal).then(v=>{if(!c.signal.aborted){setAvailable(v.transfer.available&&Boolean(crypto.subtle)&&typeof CompressionStream!=='undefined');setChecking(false);}});const timer=setInterval(()=>setNow(Date.now()),60000);return()=>{c.abort();clearInterval(timer);};},[]);
 useEffect(()=>{if(confirm){dialog.current?.showModal();cancel.current?.focus();}},[confirm]);
 function close(){dialog.current?.close();setConfirm(null);requestAnimationFrame(()=>{
  const candidates=[caller.current,input.current,prepareButton.current,panel.current?.querySelector<HTMLElement>('.transfer-list button:not(:disabled)'),panel.current?.querySelector<HTMLElement>('summary')];
  candidates.find(target=>target?.isConnected&&!target.matches(':disabled'))?.focus();
 });}
 async function prepare(){if(lock.current)return;lock.current=true;setBusy('암호화하는 중…');setError('');setMessage('');setLink('');setPrepared(null);setConsent(false);
  try{setPrepared(await buildTransferEnvelope());}catch(e){setError(transferErrorMessage(e));}finally{lock.current=false;setBusy('');}}
 async function send(){if(lock.current||!prepared||!consent)return;lock.current=true;setBusy('보내는 중…');setError('');
  try{const created=await uploadTransfer(prepared.envelope);const url=formatTransferLink(location.origin,{version:'v1',id:created.id,readToken:created.readToken,key:prepared.keyB64u});
   const next=[...sent.filter(s=>s.id!==created.id),{id:created.id,deleteToken:created.deleteToken,expiresAt:created.expiresAt,observations:prepared.observations}];
   setLink(url);setSent(next);setPrepared(null);setConsent(false);setNow(Date.now());setMessage('전달 링크를 만들었어요. 지금 복사해 두세요. 키는 이 화면을 나가면 다시 표시할 수 없어요.');
   try{writeSentTransfers(next);}catch{setError('전달은 완료됐지만 삭제 정보를 이 브라우저에 보관하지 못했어요. 이 화면에서 링크를 복사하거나 지금 삭제하세요. 화면을 나가면 삭제 정보를 잃을 수 있어요.');}
  }catch(e){setError(transferErrorMessage(e)+' 전송 결과가 불확실하면 24시간 뒤 자동 만료됩니다. 자동 재전송하지 않아요.');}
  finally{lock.current=false;setBusy('');}}
 async function copy(){try{await navigator.clipboard.writeText(link);setMessage('링크를 복사했어요. 필요한 사람에게 직접 전달하세요.');}catch{input.current?.focus();input.current?.select();setMessage('자동 복사를 사용할 수 없어요. 선택된 링크를 직접 복사하세요.');}}
 async function remove(record:SentTransferRecord){if(lock.current)return;lock.current=true;setBusy('삭제하는 중…');setError('');
  try{await deleteTransfer(record.id,record.deleteToken);const next=sent.filter(s=>s.id!==record.id);setSent(next);setLink(current=>current.includes(`#v1.${record.id}.`)?'':current);try{writeSentTransfers(next);}catch{setError('전달은 삭제됐지만 이 브라우저의 목록 갱신에 실패했어요.');}setMessage('전달을 삭제했어요. 이 링크로는 더 이상 열 수 없어요.');close();}
  catch(e){setError(transferErrorMessage(e));close();}finally{lock.current=false;setBusy('');}}
 function forget(id:string){const next=sent.filter(s=>s.id!==id);try{writeSentTransfers(next);setSent(next);}catch{setError('목록을 갱신하지 못했어요. 브라우저 저장 권한을 확인하세요.');}}
 return <section ref={panel} className="transfer-panel" aria-labelledby="transfer-heading">
  <div className="transfer-intro"><span className="transfer-icon"><LockKeyhole size={25}/></span><div><h2 id="transfer-heading">암호화 임시 전달</h2><p>다른 기기에서도, 오늘의 발견을 이어가세요.</p></div></div>
  <p>파일 백업이 기본 보관 수단입니다. 임시 전달은 전체 사진과 메모를 이 브라우저에서 잠근 뒤, 최대 24시간 동안 맡기는 보조 기능이에요. 정밀 GPS는 포함되지 않습니다.</p>
  {checking?<p role="status">전달 기능을 확인하는 중…</p>:!available?<p className="transfer-notice">이 주소에서는 암호화 임시 전달을 사용할 수 없어요. 파일 백업을 이용하세요.</p>:null}
  {!link&&<button ref={prepareButton} className="m-secondary" onClick={()=>void prepare()} disabled={!available||Boolean(busy)}>{busy==='암호화하는 중…'?<LoaderCircle className="spin" size={18}/>:<LockKeyhole size={18}/>} 전달 준비</button>}
  {prepared&&<div className="transfer-preview"><h3>보낼 기록을 확인하세요</h3><p>관찰 {prepared.observations}건 · 컬렉션 {prepared.collections}개</p><p>사진 포함 · 정밀 GPS 제외 · {(prepared.envelope.length/1048576).toFixed(2)} / 1.00 MiB</p><label className="transfer-check"><input type="checkbox" aria-label="전달 링크의 접근과 보관 기간을 확인했습니다" checked={consent} disabled={Boolean(busy)} onChange={e=>setConsent(e.target.checked)}/><span>이 링크를 가진 사람은 24시간 동안 위 기록을 열 수 있습니다. 서버에는 암호화된 내용만 저장됩니다. 삭제 뒤에도 암호문이 복구 기록에 요금제에 따라 7~30일 남을 수 있음을 확인했습니다.</span></label><button className="m-primary" disabled={!consent||Boolean(busy)} onClick={()=>void send()}><ArrowUpRight size={18}/> 암호화 링크 만들기</button></div>}
  {link&&<div className="transfer-result"><label htmlFor="transfer-link">전달 링크</label><div className="transfer-link-row"><input id="transfer-link" ref={input} aria-label="전달 링크" readOnly value={link} onFocus={e=>e.target.select()}/><button className="m-secondary" onClick={()=>void copy()}><Copy size={18}/> 링크 복사</button></div><p>키는 이 화면에서만 확인할 수 있어요. 링크를 잃어버렸다면 아래에서 삭제한 뒤 다시 만드세요.</p><button className="m-text" onClick={()=>{setLink('');setMessage('');}}>다른 전달 준비</button></div>}
  <p role="status" aria-live="polite">{busy||message}</p>{error&&<p role="alert" className="m-error">{error}</p>}
  {sent.length>0&&<div className="transfer-list"><h3>이 브라우저에서 보낸 전달</h3>{sent.map(s=>{const expired=Date.parse(s.expiresAt)<=now;return <div className="transfer-list-item" key={s.id}><div><strong>관찰 {s.observations}건</strong><span>{expired?'만료됨':`${Math.max(1,Math.ceil((Date.parse(s.expiresAt)-now)/3600000))}시간 이내 만료`} · {new Date(s.expiresAt).toLocaleString('ko-KR')}</span></div>{expired?<button className="m-text" onClick={()=>forget(s.id)}>목록에서 지우기</button>:<button className="m-text" disabled={Boolean(busy)} onClick={e=>{caller.current=e.currentTarget;setConfirm(s);}}><Trash2 size={16}/> 지금 삭제</button>}</div>;})}</div>}
  <details className="transfer-privacy"><summary>전달과 개인정보 보관 안내</summary><p>키는 링크의 # 뒤에만 있어 서버로 전송되지 않습니다. 링크와 키를 함께 가진 사람은 기록을 열 수 있습니다. 읽기 권한을 회수하려면 전달을 삭제하세요.</p><p>남용 방지를 위해 접속 주소에서 만든 일방향 값을 활성 자료에서 약 49시간 이내 정리합니다. 복구 기록에는 요금제에 따라 7~30일 남을 수 있습니다.</p><p>만료되거나 삭제한 전달은 즉시 열 수 없게 됩니다. 다만 Cloudflare D1의 복구 기록(Time Travel)에 요금제에 따라 7~30일 동안 암호화된 내용이 남을 수 있으며, 링크 속 키 없이는 읽을 수 없습니다.</p></details>
  <dialog ref={dialog} className="transfer-confirm" aria-labelledby="transfer-delete-title" onCancel={e=>{e.preventDefault();if(!busy)close();}}><h2 id="transfer-delete-title">전달을 지금 삭제할까요?</h2><p>링크를 가진 사람도 더 이상 열 수 없어요. 이미 다른 기기에 복원한 기록과 내 로컬 기록은 그대로 남습니다.</p><div className="transfer-confirm-actions"><button ref={cancel} className="m-secondary" disabled={Boolean(busy)} onClick={close}>취소</button><button className="m-primary" disabled={Boolean(busy)} onClick={()=>confirm&&void remove(confirm)}><Check size={18}/> 전달 삭제</button></div></dialog>
 </section>;
}
