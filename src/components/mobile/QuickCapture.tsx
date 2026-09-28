'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Leaf, LoaderCircle, X } from 'lucide-react';
import { newObservation, type Observation } from '@/lib/domain';
import { preparePhoto } from '@/lib/image';
import { saveObservation } from '@/lib/storage';

type Props = { onClose: () => void; onSaved: (record: Observation) => void };

export default function QuickCapture({ onClose, onSaved }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!photo) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [photo]);

  function close() {
    if (busy) return;
    if (!photo || confirm('저장하지 않은 사진과 메모를 닫을까요?')) onClose();
  }

  async function select(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError('');
    try { setPhoto(await preparePhoto(file)); }
    catch (e) { setError(e instanceof Error ? e.message : '사진을 읽지 못했어요. 다른 사진을 선택해 주세요.'); }
    finally {
      setBusy(false);
      if (camera.current) camera.current.value = '';
      if (album.current) album.current.value = '';
    }
  }

  async function save() {
    if (!photo || busy) return;
    setBusy(true); setError('');
    try {
      const record = { ...newObservation(), photo, title: name.trim() || '오늘 만난 자연', species: name.trim(), notes: notes.trim() };
      await saveObservation(record, null);
      onSaved(record);
    } catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했어요. 사진을 유지한 채 다시 시도할 수 있어요.'); }
    finally { setBusy(false); }
  }

  return <section className={`m-capture ${photo ? 'm-capture-review' : ''}`} aria-label="빠른 촬영 기록">
    <header className="m-flow-header">
      <button className="m-icon" aria-label="촬영 닫기" onClick={close} disabled={busy}><X size={23}/></button>
      <span>{photo ? '기록 남기기' : '자연 담기'}</span>
      <span className="m-step">{photo ? '2 / 2' : '1 / 2'}</span>
    </header>
    <input ref={camera} hidden type="file" aria-label="카메라로 촬영" capture="environment" accept="image/jpeg,image/png,image/webp" onChange={e => void select(e.target.files?.[0])}/>
    <input ref={album} hidden type="file" aria-label="앨범 사진 선택" accept="image/jpeg,image/png,image/webp" onChange={e => void select(e.target.files?.[0])}/>
    {!photo ? <>
      <div className="m-viewfinder">
        <span className="m-corner m-tl"/><span className="m-corner m-tr"/><span className="m-corner m-bl"/><span className="m-corner m-br"/>
        <Leaf size={76} strokeWidth={.8}/>
        <h1>작은 발견을<br/>가까이 담아보세요.</h1>
        <p>아래 촬영 버튼을 누르면<br/>휴대폰 카메라가 열립니다.</p>
      </div>
      {error && <p className="m-error" role="alert">{error}</p>}
      <div className="m-camera-tip">잎이나 꽃이 선명하게 보이도록 찍어주세요.</div>
      <div className="m-shutter-bar">
        <button className="m-album-button" onClick={() => album.current?.click()} disabled={busy}><ImagePlus size={24}/><span>앨범</span></button>
        <button className="m-shutter" aria-label="사진 촬영하기" onClick={() => camera.current?.click()} disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <Camera size={29}/>}</button>
        <span className="m-camera-mode">사진<br/><small>후면 카메라</small></span>
      </div>
      <p className="m-camera-help">기기에 따라 카메라 또는 사진 선택 화면이 열릴 수 있어요.</p>
    </> : <form onSubmit={e => { e.preventDefault(); void save(); }} className="m-quick-form">
      <div className="m-photo-review"><img src={photo} alt="방금 선택한 자연 사진"/><button type="button" onClick={() => album.current?.click()} disabled={busy}><ImagePlus size={16}/> 사진 바꾸기</button></div>
      <div className="m-quick-fields"><span className="m-muted">{new Date().toLocaleDateString('ko-KR')} · 위치 저장 안 함</span>
        <h1>발견한 순간을 남겨요</h1><p>이름을 몰라도 괜찮아요. 사진만 저장해도 돼요.</p>
        <label>이름 <span>선택</span><input maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="어떤 자연을 만났나요?" disabled={busy}/></label>
        <label>한 줄 메모 <span>선택</span><textarea rows={3} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="색, 모양, 그때의 느낌을 자유롭게" disabled={busy}/></label>
        <p className="m-private-note">나만 보는 초안으로 저장해요. 출판 동의와 검수는 나중에 할 수 있어요.</p>
        {error && <p className="m-error" role="alert">{error}</p>}
        <button className="m-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={20}/> : <Check size={20}/>} {busy ? '저장하는 중' : '내 기록에 저장'}</button>
      </div>
    </form>}
  </section>;
}
