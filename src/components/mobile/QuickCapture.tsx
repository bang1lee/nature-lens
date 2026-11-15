'use client';

import { useEffect, useRef, useState } from 'react';
import IdentificationPanel, {IdentificationChoice} from './IdentificationPanel';
import WebCamera from './WebCamera';
import {reobservationContext} from '@/lib/reobservation';
import { ImagePlus, LoaderCircle, Smartphone, X } from 'lucide-react';
import {BetaPublish} from './BetaPhotos';
import { newObservation, type Observation } from '@/lib/domain';
import { preparePhoto } from '@/lib/image';
import { saveObservation } from '@/lib/storage';
import { REGIONS, coarsePoint, type PrivateLocation } from '@/lib/location';

type Props = { reobserveFrom?: Observation | null; onClose: () => void; onSaved: (record: Observation, opened?: boolean) => void; onRetake?: (record: Observation) => void };

export default function QuickCapture({ onClose, onSaved, onRetake, reobserveFrom }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const continued = useRef<HTMLDivElement>(null);
  const [taxonGroup, setTaxonGroup] = useState<'plant'|'insect'|'other'>('plant');
  const [region, setRegion] = useState<typeof REGIONS[number] | ''>('');
  const [position, setPosition] = useState<PrivateLocation | null>(null);
  const [keepPrecise, setKeepPrecise] = useState(false);
  const [matches, setMatches] = useState(false);
  const [locating, setLocating] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function locate() {
    if (!navigator.geolocation) { setLocationError('이 브라우저는 GPS를 지원하지 않아요. 지역만 선택해도 저장할 수 있어요.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(p => { if (!active.current) return; setPosition({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:new Date().toISOString()}); setMatches(false); setLocating(false); }, () => { if (!active.current) return; setLocating(false); setLocationError('위치를 가져오지 못했어요. 지역만 선택하거나 위치 없이 저장할 수 있어요.'); }, {enableHighAccuracy:true,timeout:10000,maximumAge:0});
  }
  const [identificationTiming,setIdentificationTiming]=useState<'now'|'tomorrow'>('now');
  const [analysis,setAnalysis]=useState<Observation['aiIdentification']>();
  const [scientificName,setScientificName]=useState('');
  const [aiAssisted,setAiAssisted]=useState(false);
  const [identifying,setIdentifying]=useState(false);
  const [draftBase]=useState(newObservation);
  const [photoRevision,setPhotoRevision]=useState(0);
  const [photo, setPhoto] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [observedDate,setObservedDate]=useState(new Date().toLocaleDateString('en-CA'));
  const [sameSubject,setSameSubject]=useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locationError,setLocationError]=useState('');
  const [savedRecord,setSavedRecord]=useState<Observation|null>(null);
  useEffect(()=>{if(savedRecord)continued.current?.focus();},[savedRecord?.id]);

  useEffect(() => {
    if (!photo || savedRecord) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [photo,savedRecord]);

  function close() {
    if (busy || locating || identifying) return;
    if(savedRecord){onSaved(savedRecord,true);return;}
    if (!photo || confirm('저장하지 않은 사진과 메모를 닫을까요?')) onClose();
  }

  async function select(file?: File) {
    if (!file || busy || identifying) return;
    setBusy(true); setError('');
    try { setPhoto(await preparePhoto(file)); if(aiAssisted)setName('');setAnalysis(undefined);setIdentificationTiming('now');setScientificName('');setAiAssisted(false);setPhotoRevision(v=>v+1); setSameSubject(false); setMatches(false); setKeepPrecise(false); }
    catch (e) { setError(e instanceof Error ? e.message : '사진을 읽지 못했어요. 다른 사진을 선택해 주세요.'); }
    finally {
      setBusy(false);
      if (camera.current) camera.current.value = '';
      if (album.current) album.current.value = '';
    }
  }

  async function save(continueFlow=false) {
    if (!photo || busy || locating || identifying) return;
    if(reobserveFrom && !sameSubject){setError('같은 개체를 다시 관찰한 것인지 확인해 주세요.');return;}
    setBusy(true); setError('');
    try {
      const record = { ...draftBase, identificationTiming, aiIdentification:analysis, scientificName, aiAssisted, ...(reobserveFrom ? reobservationContext(reobserveFrom) : {}), date:observedDate, photo, title: name.trim() || '오늘 만난 자연', species: name.trim(), notes: notes.trim(), taxonGroup, ...(region ? {region} : {}), ...(position && matches ? {publicGrid:coarsePoint(position.latitude, position.longitude)} : {}) };
      const stored = await saveObservation(record, null, position && matches && keepPrecise ? position : null);
      if(continueFlow){setSavedRecord(stored);window.scrollTo(0,0);}else onSaved(stored);
    } catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했어요. 사진을 유지한 채 다시 시도할 수 있어요.'); }
    finally { setBusy(false); }
  }

  return <section className={`m-capture ${photo ? 'm-capture-review' : ''}`} aria-label="빠른 촬영 기록">
    <header className="m-flow-header">
      <button className="m-icon" aria-label="촬영 닫기" onClick={close} disabled={busy||identifying}><X size={23}/></button>
      <span>{savedRecord?'이름 확인':photo ? '사진 확인' : '자연 담기'}</span>
      <span className="m-step">{photo ? '2 / 2' : '1 / 2'}</span>
    </header>
    <input ref={camera} hidden type="file" aria-label="카메라로 촬영" capture="environment" accept="image/jpeg,image/png,image/webp" onChange={e => void select(e.target.files?.[0])}/>
    <input ref={album} hidden type="file" aria-label="앨범 사진 선택" accept="image/jpeg,image/png,image/webp" onChange={e => void select(e.target.files?.[0])}/>
    {savedRecord?<div ref={continued} tabIndex={-1} aria-label="사진 저장 후 이름 알아보기" className="m-quick-fields"><div className="m-photo-review is-kept"><img src={savedRecord.photo} alt="방금 담은 자연 사진"/></div><IdentificationPanel hideChoice record={savedRecord} onBusyChange={setIdentifying} onApplied={setSavedRecord} onRetake={onRetake?()=>onRetake(savedRecord):undefined}/><BetaPublish record={savedRecord}/><button className="m-secondary" disabled={identifying} onClick={()=>onSaved(savedRecord,true)}>내 기록 보기</button></div>:!photo ? <>
      <WebCamera onCapture={value=>{setPhoto(value);setSameSubject(false);setMatches(false);setKeepPrecise(false);}}/>
      {error && <p className="m-error" role="alert">{error}</p>}
      <div className="m-camera-fallback">
        <button className="m-secondary" onClick={()=>album.current?.click()} disabled={busy||identifying}><ImagePlus size={20}/> 사진 선택</button>
        <button className="m-secondary" onClick={()=>camera.current?.click()} disabled={busy||identifying}>기기 카메라로 촬영</button>
      </div>
      <p className="m-camera-help">사진은 동의하기 전까지 어디에도 보내지 않아요.</p>
    </> : <form onSubmit={e => { e.preventDefault(); void save(); }} className="m-quick-form">
      <div className="m-photo-review"><img src={photo} alt="방금 선택한 자연 사진"/><button type="button" onClick={() => album.current?.click()} disabled={busy||identifying}><ImagePlus size={16}/> 사진 바꾸기</button></div>
      <div className="m-quick-fields"><span className="m-muted">{new Date().toLocaleDateString('ko-KR')} · 위치는 선택 사항</span>
        <h1>어떻게 알아볼까요?</h1><IdentificationChoice legendHidden value={identificationTiming} onChange={setIdentificationTiming} disabled={busy||identifying}/>{reobserveFrom && <div className="m-private-note"><strong>다시 만난 {reobserveFrom.title}</strong><p>같은 종류가 아니라, 지난번에 만난 바로 그 개체의 변화를 기록해요.</p><label className="m-location-check"><input type="checkbox" checked={sameSubject} onChange={e=>setSameSubject(e.target.checked)}/>지난번과 같은 개체를 관찰했습니다</label></div>}<button type="button" className="m-primary" disabled={busy||locating||identifying} onClick={()=>void save(true)}>{busy?'저장하는 중…':'계속하기'}</button><p className="m-muted">계속하면 사진을 이 기기에 먼저 보관해요.</p><details className="m-extra-fields"><summary>기록 더하기 <span>선택</span></summary><label>관찰 날짜<input type="date" required value={observedDate} onChange={e=>setObservedDate(e.target.value)} disabled={busy||identifying}/></label><p>이름을 몰라도 괜찮아요. 사진만 저장해도 돼요.</p>
        <label>이름 <span>선택</span><input maxLength={100} value={name} onChange={e => {setName(e.target.value);setScientificName('');setAiAssisted(false);}} placeholder="어떤 자연을 만났나요?" disabled={busy||identifying}/></label>
        <label>한 줄 메모 <span>선택</span><textarea rows={3} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="색, 모양, 그때의 느낌을 자유롭게" disabled={busy||identifying}/></label>
        <label>만난 생명<select aria-label="만난 생명" value={taxonGroup} disabled={identifying} onChange={e => {setTaxonGroup(e.target.value as typeof taxonGroup);setAnalysis(undefined);setIdentificationTiming('now');setScientificName('');if(aiAssisted)setName('');setAiAssisted(false);}}><option value="plant">식물</option><option value="insect">곤충</option><option value="other">기타 생명</option></select></label>
        <label>관찰 지역 <span>선택</span><select aria-label="관찰 지역" value={region} onChange={e => setRegion(e.target.value as typeof region)}><option value="">지역 비공개</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></label>
        <div className="m-location"><h2>어디에서 만났나요?</h2><p>위치는 선택이에요.</p><button type="button" className="m-secondary" onClick={locate} disabled={busy || locating || identifying}>{locating ? '위치를 찾는 중…' : '현재 GPS 위치 가져오기'}</button>
        {locationError&&<div><p className="m-error" role="alert">{locationError}</p><button type="button" className="m-text" onClick={()=>setLocationError('')}>위치 없이 계속</button></div>}{position && <><p>측정 정확도 약 {Math.round(position.accuracy)}m. 지금 있는 위치이며, 사진을 찍었던 장소와 다를 수 있어요.</p><label className="m-location-check"><input type="checkbox" checked={matches} onChange={e=>setMatches(e.target.checked)}/>이곳이 관찰한 장소입니다</label><label className="m-location-check"><input type="checkbox" checked={keepPrecise} onChange={e=>setKeepPrecise(e.target.checked)}/>정밀 좌표를 이 브라우저에만 보관</label><button type="button" className="m-text" onClick={()=>{setPosition(null);setMatches(false);setKeepPrecise(false);}}>GPS 사용 안 하기</button></>}
        <p>정밀 좌표는 일반 백업·저널에서 제외해요. 공개 위치는 넓은 지역 단위로만 사용하며, 보호 여부가 미확인인 기록의 지도 좌표는 숨깁니다.</p></div></details>
        {error && <p className="m-error" role="alert">{error}</p>}
        <button className="m-secondary" disabled={busy || locating || identifying}>{busy ? <LoaderCircle className="spin" size={20} aria-hidden="true"/> : <Smartphone size={20} aria-hidden="true"/>} {busy ? '저장하는 중' : '내 기록에 저장'}</button>
      </div>
    </form>}
  </section>;
}
