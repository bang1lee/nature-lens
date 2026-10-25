'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Camera, Check, ChevronRight, FolderOpen, ImagePlus, Leaf, List, MoreHorizontal, NotebookPen, ScanSearch, Search, ShieldCheck, Sprout, Trash2, WifiOff, X } from 'lucide-react';
import { deleteObservation, readLibrary, saveObservation } from '@/lib/storage';
import { canPublish, type Collection, type Observation } from '@/lib/domain';
import { demoRecords } from '@/lib/demo';
import BackupPanel from './BackupPanel';
import TransferPanel from './TransferPanel';
import IdentificationPanel from './IdentificationPanel';
import CloudPanel from './CloudPanel';
import QuickCapture from './QuickCapture';
import MonthlyJournal from './MonthlyJournal';
import PrivateLocationNote from './PrivateLocationNote';
import SpecimenPanel from './SpecimenPanel';
import './mobile.css';
import './board-layout.css';
import './board-fieldbook.css';

type Tab = 'records' | 'collections' | 'journal' | 'settings';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** The board keeps its workspace controls independent of the mobile home. */
export default function ObservationBoard() {
  const [tab, setTab] = useState<Tab>('records');
  const [records, setRecords] = useState<Observation[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [capture, setCapture] = useState(false);
  const [reobserveFrom, setReobserveFrom] = useState<Observation | null>(null);
  const [saved, setSaved] = useState<Observation | null>(null);
  const [detail, setDetail] = useState<Observation | null>(null);
  const [deleting, setDeleting] = useState<Observation | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [query, setQuery] = useState('');
  const [taxonFilter, setTaxonFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [group, setGroup] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [journalMonth, setJournalMonth] = useState<string>();
  const detailDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const deleteCancel = useRef<HTMLButtonElement>(null);
  const detailCaller = useRef<HTMLElement | null>(null);
  const deleteCaller = useRef<HTMLElement | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const captureAction = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const actionLock = useRef(false);
  const pendingFocus = useRef<{ caller: HTMLElement | null } | null>(null);
  const captureOrigin = useRef<{ record: Observation | null; caller: HTMLElement | null } | null>(null);
  const focusReobserve = useRef(false);

  async function load() {
    const data = await readLibrary();
    setRecords(data.observations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setCollections(data.collections);
  }

  useEffect(() => {
    void load().catch(() => {
      setFatal(true);
      setError('이 브라우저에서 기록 저장소를 열 수 없어요. 시크릿 창과 저장공간, 사이트 저장 권한을 확인해 주세요.');
    }).finally(() => setLoading(false));
    const online = () => setOffline(!navigator.onLine);
    online();
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    const refresh = () => {
      if (document.visibilityState === 'visible') void load().catch(() => setError('기록을 새로 불러오지 못했어요.'));
    };
    document.addEventListener('visibilitychange', refresh);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_NATIVE_SHELL !== 'true') {
      void navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
    }
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable]')) return;
      if (document.querySelector('dialog[open]') || detail || deleting || fatal || loading) return;
      if (!capture && !saved && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault(); openCapture();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [capture, saved, detail, deleting, fatal, loading]);

  useEffect(() => {
    const dialog = detailDialog.current;
    if (detail && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>(focusReobserve.current ? '.m-specimen-reobserve' : 'button')?.focus();
      focusReobserve.current = false;
    }
  }, [detail?.id]);

  useEffect(() => {
    if (deleting && deleteDialog.current && !deleteDialog.current.open) {
      deleteDialog.current.showModal(); deleteCancel.current?.focus();
    }
  }, [deleting]);

  // Resolve the fallback after React removes a deleted card (or the final search field).
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const { caller } = pendingFocus.current;
    pendingFocus.current = null;
    (caller?.isConnected ? caller : search.current || captureAction.current || main.current)?.focus();
  });

  function openDetail(record: Observation, caller?: HTMLElement) {
    detailCaller.current = caller || document.activeElement as HTMLElement;
    setDetail(record);
  }
  function closeDetail(restore = true) {
    detailDialog.current?.close(); setDetail(null);
    if (restore) pendingFocus.current = { caller: detailCaller.current };
  }
  function closeDelete() {
    deleteDialog.current?.close(); setDeleting(null); setDeleteError('');
    pendingFocus.current = { caller: deleteCaller.current };
  }
  function askDelete(record: Observation, caller: HTMLElement) {
    deleteCaller.current = caller; setDeleteError(''); setDeleting(record);
  }
  async function removeRecord() {
    if (!deleting || actionLock.current) return;
    actionLock.current = true; setBusy(true); setDeleteError('');
    try {
      await deleteObservation(deleting.id);
      setRecords(previous => previous.filter(record => record.id !== deleting.id));
      if (detail?.id === deleting.id) closeDetail(false);
      closeDelete(); setMessage('기록을 삭제했어요.');
      try { await load(); } catch { setError('삭제는 완료했지만 목록 갱신에 실패했어요. 다시 열어 주세요.'); }
    } catch { setDeleteError('기록을 삭제하지 못했어요. 다시 시도해 주세요.'); }
    finally { actionLock.current = false; setBusy(false); }
  }
  function resetFilters() { setQuery(''); setTaxonFilter('all'); setReviewFilter('all'); setGroup(null); }
  function navigate(next: Tab) {
    closeDetail(false); setTab(next); setSaved(null); resetFilters(); window.scrollTo(0, 0);
  }
  async function retryLoad() {
    setLoading(true); setError('');
    try { await load(); setFatal(false); }
    catch { setError('기록 저장소에 연결할 수 없어요. 사이트 저장 권한과 저장공간을 확인해 주세요.'); }
    finally { setLoading(false); }
  }
  async function afterSave(record: Observation) {
    captureOrigin.current = null;
    setCapture(false); setSaved(record); window.scrollTo(0, 0);
    try { await load(); } catch { setError('저장은 완료했지만 목록 갱신에 실패했어요. 다시 열어 주세요.'); }
  }
  async function loadExamples() {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const existing = new Set(records.map(record => record.id));
      for (const record of demoRecords()) if (!existing.has(record.id)) await saveObservation(record, null);
      await load(); setMessage('가상 예제 3건을 불러왔어요. 실제 관찰 자료가 아닙니다.');
    } catch { setError('예제를 불러오지 못했어요. 저장공간과 저장 권한을 확인해 주세요.'); }
    finally { actionLock.current = false; setBusy(false); }
  }
  function openCapture(previous: Observation | null = null) {
    captureOrigin.current = { record: detail, caller: document.activeElement as HTMLElement | null };
    closeDetail(false); setSaved(null); setReobserveFrom(previous); setCapture(true); window.scrollTo(0, 0);
  }
  function cancelCapture() {
    const origin = captureOrigin.current;
    captureOrigin.current = null;
    setCapture(false); setReobserveFrom(null);
    if (origin?.record) {
      focusReobserve.current = true;
      setDetail(origin.record);
    } else {
      pendingFocus.current = { caller: origin?.caller || null };
    }
  }
  function openMonth(record: Observation) {
    setJournalMonth(record.date.slice(0, 7)); navigate('journal');
    pendingFocus.current = { caller: null };
  }

  const filtered = records.filter(record =>
    (taxonFilter === 'all' || record.taxonGroup === taxonFilter)
    && (reviewFilter === 'all' || (reviewFilter === 'reviewed' ? canPublish(record) : !canPublish(record)))
    && (!group || record.sessionId === group)
    && `${record.title} ${record.species} ${record.notes}`.toLowerCase().includes(query.trim().toLowerCase()));
  const hasFilters = Boolean(query.trim() || taxonFilter !== 'all' || reviewFilter !== 'all' || group);
  const examples = records.filter(record => record.demo).length;

  return <div className={`m-stage m-web-board ${capture ? 'm-board-capturing' : ''}`}>
    <aside className="m-board-sidebar">
      <a className="m-board-brand" href={`${base}/board/`}><Leaf size={30} strokeWidth={1.2}/><span>nature lens<small>안성에서 쌓는 자연 기록</small></span></a>
      <nav className="m-board-nav" aria-label="관찰실 메뉴">{([
        ['records', '관찰 보드', List], ['collections', '컬렉션', FolderOpen], ['journal', '저널', BookOpen], ['settings', '보관·전달', ShieldCheck],
      ] as const).map(([next, label, Icon]) => <button key={next} disabled={capture} aria-current={tab === next ? 'page' : undefined} onClick={() => navigate(next)}><Icon size={20}/><span>{label}</span></button>)}
        <a className="m-board-studio" href={`${base}/`}><BookOpen size={20}/><span>출판 작업실</span><ArrowRight size={16}/></a>
      </nav>
      <div className="m-board-sidebar-bottom"><span className="m-board-local">{offline ? <WifiOff size={16}/> : <ShieldCheck size={16}/>} {offline ? '오프라인에서 기록 중' : '이 브라우저에 보관'}</span><p>작은 발견을 모아<br/>오래 남을 기록으로.</p></div>
    </aside>
    <div className={`m-app ${capture ? 'm-in-capture' : ''}`}>
      <main ref={main} id="main" className="m-content" tabIndex={-1}>
        {error && <p className="m-error" role="alert">{error}</p>}
        {capture ? <QuickCapture reobserveFrom={reobserveFrom} onClose={cancelCapture} onSaved={record => void afterSave(record)}/> : saved ? <section className="m-success">
          <div className="m-success-mark"><Check size={34}/></div><span className="m-muted">내 기록에 저장 완료</span><h1>발견 하나가 쌓였어요</h1><p>지금의 작은 관찰이<br/>나중엔 멋진 이야기가 될 거예요.</p><img src={saved.photo} alt="저장된 관찰 사진"/><strong>{saved.title}</strong><span className="m-draft-chip">나만 보는 초안</span>
          <div className="m-success-actions"><button className="m-primary" onClick={() => { openDetail(saved); setSaved(null); setTab('records'); }}>방금 기록 보기 <ArrowRight size={19}/></button><button className="m-secondary" onClick={() => openMonth(saved)}><BookOpen size={19}/> 이달의 도감에 모아 보기</button><button className="m-secondary" onClick={() => openCapture()}><Camera size={19}/> 하나 더 기록하기</button><button className="m-text" onClick={() => navigate('records')}>홈으로</button></div>
        </section> : <>
          <header className="m-header"><a className="m-brand" href={`${base}/board/`}><Leaf size={25}/> nature lens</a><span className="m-board-breadcrumb">내 관찰실 <span>/</span> {tab === 'records' ? '관찰 보드' : tab === 'collections' ? '컬렉션' : tab === 'journal' ? '저널' : '보관·전달'}</span><span className="m-header-state">{offline ? <><WifiOff size={14}/> 오프라인</> : '나의 관찰실'}</span></header>
          {message && <p className="m-board-message" role="status">{message}</p>}
          {fatal ? <section className="m-empty m-empty-large"><h1>기록 저장소에 연결할 수 없어요</h1><p>시크릿 창과 사이트 저장 권한, 저장공간을 확인해 주세요.</p><button className="m-secondary" disabled={loading} onClick={() => void retryLoad()}>다시 시도</button></section> : <>
            {tab === 'journal' && <MonthlyJournal key={journalMonth || 'current'} records={records} initialMonth={journalMonth} onOpen={record => openDetail(record)} onCapture={() => openCapture()}/>}
            {tab === 'records' && <section className="m-records" aria-busy={loading}>
              <div className="m-board-heading"><div className="m-page-title"><span className="m-muted">사진으로 쌓이는 나의 도감</span><h1>{group ? collections.find(collection => collection.id === group)?.name : '내 관찰 보드'}</h1><p>이름을 몰라도 괜찮아요. 오늘의 작은 발견부터 남겨보세요.</p></div><button ref={captureAction} className="m-primary" disabled={loading} onClick={() => openCapture()}><ImagePlus size={20}/> 관찰 추가</button></div>
              {(loading || records.length > 0 || hasFilters) && <>
                <div className="m-board-filters">
                  <label className="m-search"><Search size={19}/><input ref={search} aria-label="내 기록 검색" placeholder="이름이나 메모로 찾기" value={query} onChange={event => setQuery(event.target.value)}/></label>
                  <label>생물군<select value={taxonFilter} onChange={event => setTaxonFilter(event.target.value)}><option value="all">모든 생명</option><option value="plant">식물</option><option value="insect">곤충</option><option value="other">기타 생명</option></select></label>
                  <label>검수 상태<select value={reviewFilter} onChange={event => setReviewFilter(event.target.value)}><option value="all">모든 상태</option><option value="draft">초안·검수 대기</option><option value="reviewed">내 확인 완료</option></select></label>
                  {collections.length > 0 && <label>컬렉션<select value={group || 'all'} onChange={event => setGroup(event.target.value === 'all' ? null : event.target.value)}><option value="all">모든 컬렉션</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}
                </div>
                <div className="m-board-results"><p>{loading ? '기록을 불러오는 중…' : `전체 ${records.length}개 중 ${filtered.length}개 표시`}{examples > 0 && <span>가상 예제 {examples}개 포함</span>}</p>{hasFilters && <button className="m-text" onClick={() => { resetFilters(); pendingFocus.current = { caller: search.current }; }}>검색어·필터 초기화 <X size={15}/></button>}</div>
              </>}
              {loading ? <div className="m-board-skeleton" aria-label="기록을 불러오는 중">{Array.from({ length: 6 }, (_, index) => <div key={index}><span/><i/><i/></div>)}</div> : filtered.length ? <div className="m-recent-grid">{filtered.map(record => <article className="m-board-card" key={record.id}>
                <button className="m-record-card" aria-label={`${record.title || '이름 미정'} 기록 열기`} onClick={event => openDetail(record, event.currentTarget)}><img src={record.photo} alt="" loading="lazy"/><span className="m-record-copy"><strong>{record.title || '이름 미정'}</strong><span className="m-record-meta"><time dateTime={record.date}>{record.date.replaceAll('-', '. ')}</time><span className={`m-record-status ${canPublish(record) ? 'is-reviewed' : ''}`}>{canPublish(record) ? '내 확인 완료' : '초안'}</span></span><span className="m-board-note">{record.notes || '아직 관찰 메모가 없어요.'}</span></span></button>
                <footer><span>{record.demo ? '삽화 · 가상 예제' : collections.find(collection => collection.id === record.sessionId)?.name || '개인 관찰'}</span><details className="m-card-menu"><summary aria-label={`${record.title || '이름 미정'} 기록 메뉴`}><MoreHorizontal size={20}/></summary><button onClick={event => askDelete(record, event.currentTarget)}><Trash2 size={16}/> 기록 삭제</button></details></footer>
              </article>)}</div> : hasFilters ? <div className="m-empty m-empty-large"><ImagePlus size={45} strokeWidth={1}/><h2>조건에 맞는 기록이 없어요</h2><p>검색어와 선택한 조건을 바꿔보세요.</p></div> : <section className="m-board-start" aria-labelledby="board-start-title">
                <div className="m-board-start-copy"><span className="m-board-place">안성에서 시작하는 관찰</span><h2 id="board-start-title">사진 한 장, 발견 하나</h2><p>산책길의 잎, 텃밭의 곤충, 숲의 작은 무늬.<br/> 안성에서 만난 생명을 나만의 기록으로 남겨보세요.</p>
                  <ol className="m-board-start-steps"><li><Camera size={22}/><span><strong>사진 한 장</strong><small>눈길이 머문 모습을 담아요.</small></span></li><li><NotebookPen size={22}/><span><strong>한 줄 메모</strong><small>색과 모양, 발견한 특징을 적어요.</small></span></li><li><ScanSearch size={22}/><span><strong>나중에 확인</strong><small>이름을 몰라도 초안으로 남겨요.</small></span></li></ol>
                  <div className="m-board-start-actions"><button className="m-primary" onClick={() => openCapture()}><Camera size={19}/> 사진으로 기록하기</button><button className="m-secondary" disabled={busy} onClick={() => void loadExamples()}>예제 불러오기</button></div><small className="m-board-example-note">예제는 삽화로 만든 가상 기록입니다. 실제 관찰 자료가 아닙니다.</small>
                </div><div className="m-board-botanical" aria-hidden="true"><div className="m-board-botanical-drawing"><Sprout size={190} strokeWidth={.8}/><Leaf size={80} strokeWidth={.8}/></div><span>잎의 모양부터 천천히.</span></div>
              </section>}
            </section>}
            {tab === 'collections' && <section className="m-collections"><div className="m-page-title"><span className="m-muted">같은 계절, 함께한 산책</span><h1>발견을 차곡차곡</h1><p>작업실에서 만든 컬렉션을 여기서 살펴보세요.</p></div><button className="m-collection-row" onClick={() => navigate('records')}><span className="m-folder-icon"><Leaf/></span><span><strong>모든 발견</strong><small>{records.length}개의 기록</small></span><ChevronRight size={20}/></button>{collections.map(collection => <button key={collection.id} className="m-collection-row" onClick={() => { resetFilters(); setGroup(collection.id); setTab('records'); }}><span className="m-folder-icon"><FolderOpen/></span><span><strong>{collection.name}</strong><small>{records.filter(record => record.sessionId === collection.id).length}개의 기록</small></span><ChevronRight size={20}/></button>)}<a className="m-secondary" href={`${base}/`}>출판 작업실 열기 <ArrowRight size={17}/></a></section>}
            {tab === 'settings' && <section className="m-settings"><div className="m-page-title"><span className="m-muted">나만의 자연 기록장</span><h1>보관·전달</h1><p>파일로 안전하게 보관하고, 필요한 기기에 직접 전달하세요.</p></div><BackupPanel onRestored={load}/><TransferPanel/><CloudPanel records={records}/><div className="m-settings-note"><h2>기록을 오래 보관하려면</h2><p>사이트 데이터 삭제나 기기 변경 전에 전체 백업 파일을 내려받으세요. 주소가 다르면 기록이 자동으로 옮겨지지 않습니다.</p><p>얼굴·개인정보가 보이는 사진은 피해주세요. 사진의 원본 위치 정보는 제거합니다. 직접 선택한 지역과 GPS는 별도로 저장되며, 정밀 좌표는 일반 백업에 포함되지 않습니다.</p><p>기기 기록 삭제와 전달 링크 삭제는 서버에 제출한 공동 관찰을 자동으로 철회하지 않아요.</p></div></section>}
          </>}
        </>}
      </main>
      <dialog ref={detailDialog} className="m-detail m-board-detail" aria-labelledby="board-detail-title" onCancel={event => { event.preventDefault(); closeDetail(); }}>{detail && <>
        <header className="m-header"><button className="m-icon" aria-label="목록으로" onClick={() => closeDetail()}><X/></button><span>나의 관찰</span><span className="m-draft-chip">{canPublish(detail) ? '내 확인 완료' : '초안'}</span></header>
        <div className="m-detail-body"><img className="m-detail-photo" src={detail.photo} alt={detail.title || '관찰 사진'}/><div className="m-detail-copy"><span className="m-muted">{detail.date} · {detail.region || '지역 비공개'}</span><h1 id="board-detail-title">{detail.title || '이름 미정'}</h1><p className="m-species">{detail.species || '생물 이름은 나중에 확인해도 돼요'}</p>
          <IdentificationPanel key={`${detail.id}-${detail.updatedAt}`} record={detail} onApplied={record => { setDetail(record); void load().catch(() => setError('목록을 다시 열어 주세요.')); }}/>
          <PrivateLocationNote key={detail.id} id={detail.id} onRemoved={() => { setDetail({ ...detail, region: undefined, publicGrid: undefined, status: 'draft' }); void load().catch(() => setError('목록을 다시 열어 주세요.')); }}/>
          <p className="m-detail-notes">{detail.notes || '아직 메모가 없어요. 사진에 담긴 발견을 천천히 살펴보세요.'}</p>
          <SpecimenPanel record={detail} records={records} onOpen={record => setDetail(record)} onReobserve={() => openCapture(detail)}/>
          <button className="m-secondary" onClick={() => openMonth(detail)}><BookOpen size={18}/> 이 기록의 월간 도감 보기</button>
          {detail.demo && <p className="m-private-note">사용법을 보여 주는 가상 예제입니다. 실제 관찰 자료가 아닙니다.</p>}
          <div className="m-info-line"><ShieldCheck size={21}/><p>이 브라우저에 저장된 기록이에요.<br/>편집·검수·백업은 출판 작업실에서 이어가세요.</p></div><a className="m-secondary" href={`${base}/`}>출판 작업실에서 이어하기 <ArrowRight size={18}/></a>
          <button className="m-text m-detail-delete" onClick={event => askDelete(detail, event.currentTarget)}><Trash2 size={17}/> 기록 삭제</button>
        </div></div>
      </>}</dialog>
      <dialog ref={deleteDialog} className="m-board-delete" role="alertdialog" aria-labelledby="board-delete-title" aria-describedby="board-delete-description" onCancel={event => { event.preventDefault(); if (!busy) closeDelete(); }}>
        <h2 id="board-delete-title">기록을 삭제할까요?</h2><p id="board-delete-description">‘{deleting?.title}’ 사진과 메모를 이 브라우저에서 삭제합니다. 필요한 기록은 먼저 백업해 주세요.</p>{deleteError && <p role="alert" className="m-error">{deleteError}</p>}<div><button ref={deleteCancel} className="m-secondary" disabled={busy} onClick={closeDelete}>취소</button><button className="m-primary" disabled={busy} onClick={() => void removeRecord()}><Trash2 size={17}/> {busy ? '삭제하는 중…' : '기록 삭제'}</button></div>
      </dialog>
    </div>
  </div>;
}
