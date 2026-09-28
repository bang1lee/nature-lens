'use client';
import {useEffect,useRef,useState} from 'react';
import {X,Upload,ShieldCheck,Leaf,LoaderCircle} from 'lucide-react';
import {observationSchema,publicationIssues,type Observation,type Collection} from '@/lib/domain';
import {preparePhoto} from '@/lib/image';
export default function Editor({record,collections,onSave,onClose}:{record:Observation;collections:Collection[];onSave:(o:Observation,expectedUpdatedAt:string|null)=>Promise<void>;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);const [value,setValue]=useState(record);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [processing,setProcessing]=useState(false);
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);
 function update<K extends keyof Observation>(key:K,v:Observation[K]){setValue(p=>({...p,[key]:v,status:'draft'}));setError('');}
 async function photo(file?:File){if(!file)return;setProcessing(true);setError('');try{update('photo',await preparePhoto(file));}catch(e){setError(e instanceof Error?e.message:'사진을 처리하지 못했습니다.');}finally{setProcessing(false);}}
 async function save(review:boolean){
  if(busy||processing)return;
  const result=observationSchema.safeParse({...value,title:value.title.trim(),status:review?'reviewed':'draft',updatedAt:new Date().toISOString()});
  if(!result.success){setError(!value.photo?'사진을 추가해 주세요.':!value.title.trim()?'관찰 제목을 입력해 주세요.':'입력 내용과 날짜를 확인해 주세요.');return;}
  if(review){const issues=publicationIssues(result.data);if(issues.length){setError(issues.join(' '));return;}}
  setBusy(true);try{await onSave(result.data,record.photo?record.updatedAt:null);}catch(e){setError(e instanceof Error?e.message:'저장하지 못했습니다. 브라우저 저장 공간과 권한을 확인해 주세요. 작성 내용은 이 창에 남아 있습니다.');}finally{setBusy(false);}
 }
 return <dialog ref={ref} className="editor" onCancel={e=>{e.preventDefault();if(!busy&&!processing)onClose();}} aria-labelledby="editor-title">
  <header className="dialog-head"><div><span className="eyebrow">FIELD NOTE</span><h2 id="editor-title">{record.photo?'관찰 기록 편집':'새로운 발견을 기록해요'}</h2></div><button className="icon-button" aria-label="닫기" onClick={onClose} disabled={busy||processing}><X/></button></header>
  <form onSubmit={e=>{e.preventDefault();void save(false);}}>
  <div className="editor-body"><div className="photo-column"><label className="photo-upload">{value.photo?<img src={value.photo} alt="등록한 관찰 사진"/>:<div><Upload size={32}/><strong>사진 한 장에서 시작하세요</strong><span>JPEG · PNG · WebP / 최대 15MB</span></div>}<input aria-label="관찰 사진" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void photo(e.target.files?.[0])} disabled={busy||processing}/><span className="upload-caption">{processing?'사진 처리 중…':value.photo?'사진 바꾸기':'사진 선택'}</span></label><p className="hint">사진을 교체해 저장하면 기존 GPS·지역 연결도 제거됩니다. 사진의 위치 정보(EXIF)는 저장 전에 제거합니다. 얼굴·이름·정밀 위치가 담긴 사진은 사용하지 마세요.</p><div className="soft-note"><Leaf size={18}/><p>식물 이름은 직접 확인해 적어 주세요.<br/>현재 자동 AI 판별은 연결되어 있지 않습니다.</p></div></div>
  <div className="fields"><label>관찰 제목 <input autoFocus required maxLength={120} value={value.title} onChange={e=>update('title',e.target.value)} placeholder="예: 산책길에서 만난 작은 잎"/></label><div className="field-row"><label>관찰일<input type="date" required value={value.date} onChange={e=>update('date',e.target.value)}/></label><label>컬렉션<select aria-label="컬렉션" value={value.sessionId||''} onChange={e=>update('sessionId',e.target.value||null)}><option value="">개인 관찰</option>{collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
  <div className="field-row"><label>식물 이름<input maxLength={100} value={value.species} onChange={e=>update('species',e.target.value)} placeholder="검수 후 확정한 이름"/></label><label>학명 <span className="optional">선택</span><input maxLength={140} value={value.scientificName} onChange={e=>update('scientificName',e.target.value)} placeholder="Scientific name"/></label></div>
  <label>관찰 메모<textarea maxLength={4000} rows={4} value={value.notes} onChange={e=>update('notes',e.target.value)} placeholder="잎의 모양, 색, 주변에서 발견한 것을 기록하세요. 식용·약용 정보와 개인정보는 제외합니다."/></label>
  <div className="field-row"><label>서식 환경 <span className="optional">선택</span><input maxLength={150} value={value.habitat} onChange={e=>update('habitat',e.target.value)} placeholder="숲, 초지 등 (상세 위치 제외)"/></label><label>보호 여부<select value={value.protection} onChange={e=>update('protection',e.target.value as Observation['protection'])}><option value="unknown">확인 전</option><option value="protected">보호 필요</option><option value="common">일반종으로 확인</option></select></label></div>
  <fieldset className="consent-box"><legend><ShieldCheck size={17}/> 출판 전 확인</legend><label className="check"><input type="checkbox" checked={value.consent} onChange={e=>update('consent',e.target.checked)}/> 사진과 기록의 출판 권한·동의를 확인했습니다.</label><label className="check"><input type="checkbox" checked={value.noPeople} onChange={e=>update('noPeople',e.target.checked)}/> 사진에 인물과 개인정보가 없습니다.</label><label className="check"><input type="checkbox" checked={value.aiAssisted} onChange={e=>update('aiAssisted',e.target.checked)}/> 외부 AI가 작성한 내용을 포함합니다.</label><p className="hint">검수 완료는 종 이름·본문을 사람이 확인했다는 의미입니다. 수정하면 다시 검수해야 합니다.</p></fieldset>
  </div></div>
  <footer className="dialog-footer">{error&&<p className="error" role="alert">{error}</p>}<div className="actions"><button type="submit" className="button secondary" disabled={busy||processing}>초안 저장</button><button type="button" className="button" disabled={busy||processing} onClick={()=>void save(true)}>{busy?<LoaderCircle size={17}/>:<ShieldCheck size={17}/>} 검수 완료로 저장</button></div></footer></form>
 </dialog>;
}
