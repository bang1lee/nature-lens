'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Camera, Check, ChevronRight, Download, FolderOpen, Home, ImagePlus, Images, Leaf, List, Search, Settings, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { readLibrary, saveObservation } from '@/lib/storage';
import type { Collection, Observation } from '@/lib/domain';
const BackupPanel = dynamic(() => import('./BackupPanel'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const ReviewPreview = dynamic(() => import('./ReviewPreview'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const IdentificationPanel = dynamic(() => import('./IdentificationPanel'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const CloudPanel = dynamic(() => import('./CloudPanel'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const QuickCapture = dynamic(() => import('./QuickCapture'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const Editor = dynamic(() => import('../Editor'), {loading: () => <p className="m-loading" role="status">편집 화면을 준비하고 있어요…</p>});
import {useIdentificationReturn} from './useIdentificationReturn';
import {identificationEndpoint} from '@/lib/ai/client';
import TaxonCard from './TaxonCard';
import SpecimenPanel from './SpecimenPanel';
import CommunityHome from './CommunityHome';
const CommunityMap = dynamic(() => import('./CommunityMap'), {ssr:false, loading:()=> <p>지도를 준비하고 있어요.</p>});
const MonthlyJournal = dynamic(() => import('./MonthlyJournal'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
import PrivateLocationNote from './PrivateLocationNote';
import ParticipationPanel from './ParticipationPanel';
import {BetaFeed, BetaMine, BetaPublish} from './BetaPhotos';
import './mobile.css';
import './forest-journey.css';

type Tab = 'home' | 'discover' | 'records' | 'collections' | 'journal' | 'settings';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function MobileApp({webBoard=false,embed=false}:{webBoard?:boolean;embed?:boolean}) {
  const [mapOpen,setMapOpen]=useState(false);
  const [captureKey,setCaptureKey]=useState(0);
  const [today, setToday] = useState('오늘의 관찰');
  const [tab, setTab] = useState<Tab>(webBoard?'records':'home');
  const [records, setRecords] = useState<Observation[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [capture, setCapture] = useState(false);
  const [reobserveFrom,setReobserveFrom]=useState<Observation|null>(null);
  const [saved, setSaved] = useState<Observation | null>(null);
  const [detail, setDetail] = useState<Observation | null>(null);
  const [editing, setEditing] = useState<Observation | null>(null);
  const [detailIdentifying,setDetailIdentifying]=useState(false);
  const [detailPublishing,setDetailPublishing]=useState(false);
  const [detailLocationBusy,setDetailLocationBusy]=useState(false);
  const detailBusy=detailIdentifying||detailPublishing||detailLocationBusy;
  const editReturnFocus = useRef<HTMLElement | null>(null);
  const loginReturnMessage=useIdentificationReturn(setDetail);
  const [query, setQuery] = useState('');
  const [taxonFilter,setTaxonFilter]=useState('all');
  const [group, setGroup] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [journalMonth,setJournalMonth]=useState<string|undefined>();

  async function load() {
    const data = await readLibrary();
    setRecords(data.observations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setCollections(data.collections);
  }
  useEffect(() => {
    setToday(new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }));
    void load().catch(() => setError('기록을 불러오지 못했어요. 브라우저의 저장 권한을 확인해 주세요.')).finally(() => setLoading(false));
    // Wake the idle identification host early. No photo or account data is sent.
    if (identificationEndpoint && navigator.onLine) void fetch(`${identificationEndpoint}/health`, {mode:'no-cors',cache:'no-store',credentials:'omit'}).catch(() => {});
    const online = () => setOffline(!navigator.onLine);
    online(); window.addEventListener('online', online); window.addEventListener('offline', online);
    const refresh = () => { if (document.visibilityState === 'visible') void load().catch(() => setError('기록을 새로 불러오지 못했어요.')); };
    document.addEventListener('visibilitychange', refresh);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_NATIVE_SHELL !== 'true') void navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', online); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.closest('input,textarea,select,[contenteditable]'))) return;
      if (!capture && !saved && !detailBusy && !editing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); setReobserveFrom(null); setCapture(true); window.scrollTo(0, 0); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [capture, saved,detailBusy,editing]);

  useEffect(()=>{
    if(!detailBusy)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[detailBusy]);

  function navigate(next: Tab) { if(detailBusy||editing)return;setTab(webBoard&&next==='home'?'records':next); setDetail(null); setGroup(null); setQuery(''); window.scrollTo(0, 0); }
  async function afterSave(record: Observation, opened = false) {
    // A record already continued inside the capture flow opens directly instead of repeating a success screen.
    setCapture(false); if (opened) { setSaved(null); setDetail(record); setTab('records'); } else setSaved(record); window.scrollTo(0, 0);
    try { await load(); } catch { setError('저장은 완료했지만 목록 갱신에 실패했어요. 다시 열어 주세요.'); }
  }
  function openEditor(record: Observation) {
    if(detailBusy)return;
    editReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(record);
  }
  function closeEditor() {
    setEditing(null);
    requestAnimationFrame(() => editReturnFocus.current?.focus());
  }
  async function saveEdit(record: Observation, expectedUpdatedAt: string | null) {
    const stored = await saveObservation(record, expectedUpdatedAt);
    setRecords(current => current.map(item => item.id === stored.id ? stored : item));
    setDetail(current => current?.id === stored.id ? stored : current);
    closeEditor();
    void load().catch(() => setError('수정은 저장했지만 목록 갱신에 실패했어요. 다시 열어 주세요.'));
  }
  async function refreshDetailAfterLocationRemoval(id:string){
    const data=await readLibrary();
    const latest=data.observations.find(item=>item.id===id);
    if(!latest)throw new Error('record-not-found');
    setDetail(current=>current?.id===id?latest:current);
    setRecords(data.observations.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
    setCollections(data.collections);
  }
  const filtered = records.filter(r => (taxonFilter==='all'||r.taxonGroup===taxonFilter) && (!group || r.sessionId === group) && `${r.title} ${r.species} ${r.notes}`.toLowerCase().includes(query.toLowerCase()));
  const standaloneLink = embed ? {target:'_blank',rel:'noopener noreferrer'} : {};
  const openCapture = () => { if(detailBusy||editing)return;setSaved(null); setReobserveFrom(null); setCapture(true); window.scrollTo(0, 0); };
  const recordCard = (r: Observation) => <button key={r.id} className="m-record-card" aria-label={`${r.title} 기록 열기`} onClick={() => { setDetail(r); window.scrollTo(0, 0); }}><img src={r.photo} alt="" loading="lazy" decoding="async"/><span className="m-record-copy"><small>{r.date.replaceAll('-', '. ')}{r.demo ? ' · 예제' : ''}</small><strong>{r.title}</strong><span>{r.status === 'reviewed' ? '기기 기록 · 내 확인 완료' : '기기 기록 · 초안'}</span>{webBoard&&r.notes&&<span className="m-board-note">{r.notes}</span>}</span></button>;

  return <div className={`m-stage ${webBoard ? 'm-web-board' : ''} ${embed ? 'm-embed' : ''}`}>
    <aside className="m-preview-note"><Leaf size={30}/><h2>손안의<br/>자연 기록장.</h2><p>촬영하고, 한 줄 남기고,<br/>다음 발견으로.</p><span>나의 자연 관찰실</span><ol><li>사진 촬영 또는 앨범 선택</li><li>이름과 메모는 필요할 때만</li><li>초안 저장 후 나중에 검수</li></ol><a href={detailBusy||editing?undefined:`${base}/`} {...standaloneLink} aria-disabled={detailBusy||!!editing} tabIndex={detailBusy||editing?-1:undefined}>기존 출판 작업실 <ArrowRight size={16}/></a></aside>
    <div className={`m-app ${capture && !saved ? 'm-in-capture' : ''}`}>
      <main id="main" className="m-content" tabIndex={-1} aria-busy={loading} data-ready={!loading}>
      {capture ? <QuickCapture key={captureKey} reobserveFrom={reobserveFrom} onClose={() => setCapture(false)} onSaved={(r,opened) => void afterSave(r,opened)} onRetake={r=>{setReobserveFrom(r);setCaptureKey(k=>k+1);window.scrollTo(0,0);void load().catch(()=>{});}}/> : saved ? <section className="m-success">
        <div className="m-success-mark"><Smartphone size={32} aria-hidden="true"/></div><span className="m-muted">이 기기에 보관했어요</span><h1>발견 하나가 쌓였어요</h1><p>지금의 작은 관찰이<br/>나중엔 멋진 이야기가 될 거예요.</p><img src={saved.photo} alt="저장된 관찰 사진"/><strong>{saved.title}</strong><span className="m-draft-chip">기기 기록 · 초안</span><BetaPublish record={saved} onBusyChange={setDetailPublishing}/><p className="f-next-note">기록 상세에서 이름 후보를 확인하고,<br/>다음 만남을 같은 대상에 이어 남겨요.</p><div className="m-success-actions"><button disabled={detailPublishing} className="m-primary" onClick={() => { setDetail(saved); setSaved(null); setTab('records'); }}>내 기록 보기 <ArrowRight size={19}/></button><button disabled={detailPublishing} className="m-text" onClick={()=>{setJournalMonth(saved.date.slice(0,7));setSaved(null);navigate('journal');}}><BookOpen size={17}/> 이달의 도감에 모아 보기</button><button disabled={detailPublishing} className="m-secondary" onClick={()=>{setReobserveFrom(saved);setSaved(null);setCapture(true);window.scrollTo(0,0);}}><Camera size={19}/> 같은 대상 다시 관찰하기</button><button disabled={detailPublishing} className="m-text" onClick={openCapture}><Camera size={17}/> 하나 더 기록하기</button><button disabled={detailPublishing} className="m-text" onClick={() => { setSaved(null); navigate('home'); }}>홈으로</button></div>
      </section> : detail ? <section className="m-detail">
        <header className="m-header"><button className="m-icon" aria-label="목록으로" disabled={detailBusy||!!editing} onClick={() => { setDetail(null); setTab('records'); }}><ArrowLeft/></button><span>나의 관찰</span><span className="m-draft-chip">{detail.status === 'reviewed' ? '내 확인 완료' : '초안'}</span></header>
        <img className="m-detail-photo" src={detail.photo} alt={detail.title}/>
        <div className="m-detail-copy"><span className="m-muted">{detail.date} · {detail.region || '지역 비공개'}</span><h1>{detail.title}</h1><p className="m-species">{detail.species || '생물 이름은 나중에 확인해도 돼요'}</p>{detail.scientificName&&!detail.demo&&<TaxonCard key={`taxon-${detail.scientificName}`} scientificName={detail.scientificName}/>}
          <fieldset className="m-identification-group" disabled={detailPublishing||detailLocationBusy||!!editing}><legend className="m-visually-hidden">이름 확인</legend><IdentificationPanel key={`${detail.id}-${detail.updatedAt}`} record={detail} onBusyChange={setDetailIdentifying} onRetake={()=>{setReobserveFrom(detail);setSaved(null);setCapture(true);window.scrollTo(0,0);}} onApplied={record=>{setDetail(record);void load().catch(()=>setError('목록을 다시 열어 주세요.'));}}/></fieldset>
          <BetaPublish key={`public-${detail.id}`} record={detail} disabled={detailIdentifying||detailLocationBusy||!!editing} onBusyChange={setDetailPublishing}/>
          <fieldset className="m-identification-group" disabled={detailBusy||!!editing}><legend className="m-visually-hidden">기록 관리</legend>
            <PrivateLocationNote key={detail.id} id={detail.id} onBusyChange={setDetailLocationBusy} onRemoved={()=>refreshDetailAfterLocationRemoval(detail.id)}/>
            <p className="m-detail-notes">{detail.notes || '아직 메모가 없어요. 사진에 담긴 발견을 천천히 살펴보세요.'}</p>
            <SpecimenPanel record={detail} records={records} onOpen={record=>{setDetail(record);window.scrollTo(0,0);}} onReobserve={()=>{setReobserveFrom(detail);setSaved(null);setCapture(true);window.scrollTo(0,0);}}/>
            <button className="m-secondary f-month-link" onClick={()=>{setJournalMonth(detail.date.slice(0,7));navigate('journal');}}><BookOpen size={18}/> 이 기록의 월간 도감 보기</button>
            <button className="m-secondary" onClick={()=>openEditor(detail)}>기록 수정 및 공개 준비</button>
          </fieldset>
          {detail.demo && <p className="m-private-note">사용법을 보여 주는 가상 예제입니다.</p>}
          <div className="m-info-line"><ShieldCheck size={21}/><p>이 브라우저에 저장된 기록이에요.<br/>기록을 수정하고 공개 전 확인을 할 수 있어요. 백업은 설정에서 할 수 있어요.</p></div>
          <a className="m-secondary" href={detailBusy||editing?undefined:`${base}/`} {...standaloneLink} aria-disabled={detailBusy||!!editing} tabIndex={detailBusy||editing?-1:undefined}>출판 작업실에서 이어하기 <ArrowRight size={18}/></a>
        </div>
      </section> : <>
        {embed&&<div className="e-top-link"><a href="https://newleaf.or.kr/" target="_blank" rel="noopener noreferrer">사단법인 뉴리프 홈페이지 <ArrowUpRight size={15} aria-hidden="true"/></a></div>}
        <header className="m-header"><a className="m-brand" href={`${base}/${embed?'embed':webBoard?'board':'mobile'}/`} onClick={embed?event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate('home');}}:undefined}><Leaf size={25}/> nature lens</a><span className="m-header-state">{offline ? <><WifiOff size={14}/> 오프라인</> : '나의 관찰실'}</span></header>
        {loginReturnMessage&&<p role="status">{loginReturnMessage}</p>}
        {error && <p className="m-error" role="alert">{error}</p>}
        {tab === 'home' && <>{embed ? <>
          <section className="e-intro" aria-labelledby="embed-welcome-title">
            <img src={`${base}/community/moss.jpg`} alt="" fetchPriority="high"/>
            <div className="e-intro-copy"><span>자연을 가까이 만나는 시간</span><h1 id="embed-welcome-title">가까이 볼수록,<br/>새로운 세계</h1><p>오늘의 발견을 담고, 함께 만나보세요.</p></div>
            <small>이끼 풍경 · AI 예시 이미지</small>
          </section>
          <div className="e-actions" role="group" aria-label="자연 관찰 시작">
            <button type="button" onClick={openCapture}><Camera size={22} aria-hidden="true"/><span><strong>사진으로 관찰하기</strong><small>직접 담고 기록해요</small></span><ArrowRight size={18} aria-hidden="true"/></button>
            <button type="button" onClick={()=>navigate('discover')}><Images size={22} aria-hidden="true"/><span><strong>다른 사람의 관찰 보기</strong><small>함께 남긴 사진을 만나요</small></span><ArrowRight size={18} aria-hidden="true"/></button>
          </div>
        </> : <><section className="f-journey-cover"><img className="f-cover-photo" src={`${base}/community/moss.jpg`} alt="" fetchPriority="high"/><span className="f-cover-date">{today}</span><h2>이름을 알면,<br/>다시 만나고 싶어져요.</h2><p>사진 한 장에서 시작해<br/>계절을 담은 나의 도감으로.</p><button className="m-primary" onClick={openCapture}><Camera size={19}/> 오늘의 자연 기록하기</button><a href={`${base}/plants/demo-tree-001/`} {...standaloneLink}>숲의 이름표 둘러보기 · 시연 <ArrowRight size={16}/></a><small>이끼 풍경 · AI 예시 이미지</small></section><ol className="f-journey-steps" aria-label="자연 기록의 흐름"><li>01 사진</li><li>02 이름 후보</li><li>03 재관찰</li><li>04 월간 도감</li></ol></>}{!loading && records.length > 0 && <section className="f-return"><span>다시 만날 자연</span><button onClick={()=>{setDetail(records[0]);setTab('records');window.scrollTo(0,0);}}><img src={records[0].photo} alt="" width={56} height={64}/><span><strong>{records[0].title}{records[0].demo ? ' · 예제' : ''}</strong><small>지난 기록을 보고, 오늘의 변화를 남겨요</small></span><ChevronRight size={19}/></button></section>}{records.some(r=>r.discoveryId)&&<section className="f-return" aria-label="다음날 확인 모아보기"><span>내가 남긴 예상</span>{records.filter(r=>r.discoveryId).slice(0,3).map(r=><button key={r.id} onClick={()=>{setDetail(r);setTab('records');window.scrollTo(0,0);}}><span><strong>{r.title}</strong><small>다음날 확인 · 예상과 결과 보기</small></span><ChevronRight size={19}/></button>)}</section>}{!embed&&<BetaFeed/>}{mapOpen?<CommunityMap onJoin={()=>navigate('settings')}/>:<section className="m-settings-note"><h2>함께 발견한 자연</h2><p>우리 주변의 공개 관찰 기록을 지도에서 만나보세요.</p><button className="m-secondary" onClick={()=>setMapOpen(true)}>지도 열기</button></section>}<ParticipationPanel records={records}/><details className="m-settings-note"><summary>숲의 이야기 둘러보기 · 예시</summary><CommunityHome onCapture={openCapture} onJournal={() => navigate('journal')}/></details></>}
        {tab === 'discover' && embed && <section className="e-discover"><button className="m-text e-back" onClick={()=>navigate('home')}><ArrowLeft size={18} aria-hidden="true"/> 홈으로</button><h1>다른 사람의 관찰</h1><BetaFeed showUnavailable/></section>}
        {tab === 'journal' && <MonthlyJournal key={journalMonth||'current'} records={records} initialMonth={journalMonth} onOpen={record=>{setDetail(record);window.scrollTo(0,0);}} onCapture={openCapture}/>}
        {tab === 'records' && <section className="m-records"><div className="m-page-title"><span className="m-muted">사진으로 쌓이는 나의 도감</span><h1>{group ? collections.find(c => c.id === group)?.name : (webBoard?'내 관찰 보드':'내가 만난 자연')} <span>{filtered.length}</span></h1></div>{webBoard&&<div className="m-board-tools"><p>사진 한 장, 발견 하나.<br/>이 브라우저에 먼저 보관하는 나의 자연 기록장입니다.</p><button className="m-primary" onClick={openCapture}><Camera size={20}/> 관찰 추가</button><label>생물군<select value={taxonFilter} onChange={e=>setTaxonFilter(e.target.value)}><option value="all">모든 생명</option><option value="plant">식물</option><option value="insect">곤충</option><option value="other">기타 생명</option></select></label></div>}<button className="m-text" onClick={() => navigate('collections')}>컬렉션 모아보기 <FolderOpen size={16}/></button><label className="m-search"><Search size={19}/><input aria-label="내 기록 검색" placeholder="이름이나 메모로 찾기" value={query} onChange={e => setQuery(e.target.value)}/></label>{group && <button className="m-text" onClick={() => setGroup(null)}>전체 기록 보기</button>}{filtered.length ? <div className="m-recent-grid">{filtered.map(recordCard)}</div> : <div className="m-empty m-empty-large"><ImagePlus size={39} strokeWidth={1}/><h2>{query ? '일치하는 기록이 없어요' : '첫 번째 발견을 담아보세요'}</h2><p>{query ? '다른 이름이나 메모로 찾아보세요.' : '사진만 찍어도 멋진 관찰의 시작이에요.'}</p>{!query && <button className="m-primary" onClick={openCapture}><Camera size={19}/> 사진으로 기록하기</button>}</div>}<BetaMine records={records} onRestored={load} onLogin={()=>navigate('settings')}/></section>}
        {tab === 'collections' && <section className="m-collections"><div className="m-page-title"><span className="m-muted">같은 계절, 함께한 산책</span><h1>발견을 차곡차곡</h1><p>작업실에서 만든 컬렉션을 여기서 살펴보세요.</p></div><button className="m-collection-row" onClick={() => navigate('records')}><span className="m-folder-icon"><Leaf/></span><span><strong>모든 발견</strong><small>{records.length}개의 기록</small></span><ChevronRight size={20}/></button>{collections.map(c => <button key={c.id} className="m-collection-row" onClick={() => { setGroup(c.id); setTab('records'); }}><span className="m-folder-icon"><FolderOpen/></span><span><strong>{c.name}</strong><small>{records.filter(r => r.sessionId === c.id).length}개의 기록</small></span><ChevronRight size={20}/></button>)}<div className="m-coming"><BookOpen size={31} strokeWidth={1}/><h2>기록이 모이면, 한 권의 책</h2><p>사진을 고르고 검수해 나만의 기록집으로.<br/>출판 작업실에서 이어서 만들 수 있어요.</p><a className="m-secondary" href={`${base}/`} {...standaloneLink}>출판 작업실 열기 <ArrowRight size={17}/></a></div></section>}
        {tab === 'settings' && <section className="m-settings"><div className="m-page-title"><span className="m-muted">나만의 자연 기록장</span><h1>내 손안의 관찰실</h1></div><section className="m-settings-note" aria-labelledby="privacy-heading"><h2 id="privacy-heading">내 기록과 개인정보</h2><dl className="nl-privacy-list"><dt>로그인 없이 기록하기</dt><dd>사진과 메모는 먼저 이 브라우저에 저장돼요. 공개로 저장한 사진은 로그인 후 다른 기기에서도 가져올 수 있어요. 기기 기록은 자동 동기화되지 않으니 브라우저 데이터를 지우기 전에 백업하세요.</dd><dt>전송은 각각 확인해요</dt><dd>AI 식별, 공개 베타 저장과 공동 관찰 제출은 각각 확인해요. 이전 기록은 자동으로 올리지 않아요.</dd><dt>위치와 내보내기</dt><dd>원본 사진의 위치 정보는 제거해요. 따로 기록한 정밀 GPS는 일반 백업과 개인 도감 인쇄에서 제외됩니다. 직접 쓴 메모에 주소나 연락처가 없는지도 확인하세요.</dd><dt>삭제와 공개 철회</dt><dd>기기 기록은 출판 작업실에서 삭제할 수 있어요. 기존 공동 관찰 제출은 아래에서 따로 철회해야 해요. 공개 베타 사진의 서버 삭제는 아직 앱에서 지원하지 않으며 기기 기록 삭제로 공개본이 사라지지 않아요.</dd></dl></section><BackupPanel onRestored={load}/><ReviewPreview/><ParticipationPanel records={records}/><CloudPanel records={records} onEditRecord={openEditor}/><div className="m-settings-note"><Smartphone size={30}/><h2>홈 화면에 두고 바로 기록하세요</h2><p>아이폰은 Safari 공유 메뉴에서 ‘홈 화면에 추가’, 안드로이드는 Chrome 메뉴에서 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 선택하세요. 메뉴 이름은 기기에 따라 달라요.</p></div><div className="m-info-line"><ShieldCheck size={23}/><p>기록은 먼저 이 브라우저에 저장돼요.<br/>선택한 사진은 동의 후 공개 베타 서버에 저장할 수 있어요. 자동 동기화는 제공하지 않아요.</p></div><a className="m-settings-link" href={`${base}/`} {...standaloneLink}><Download size={20}/><span>작업실에서 백업·복원하기</span><ChevronRight size={18}/></a><details className="m-settings-note"><summary>베타 이용 안내</summary><p>웹에서 사진을 기록하고 이름 후보를 확인해 공개 저장할 수 있어요. Mac·Android 실기기와 스토어 배포는 아직 검증하지 않았어요.</p></details></section>}
      </>}
      </main>
      {editing && <Editor record={editing} collections={collections} onSave={saveEdit} onClose={closeEditor} mobileIdentification/>}
      {!capture && !saved && <nav className="m-tabbar" aria-label="모바일 메뉴"><button disabled={detailBusy||!!editing} onClick={() => navigate('home')} aria-current={!detail && tab === 'home' ? 'page' : undefined}><Home size={22}/><span>홈</span></button><button disabled={detailBusy||!!editing} onClick={() => navigate('records')} aria-current={tab === 'records' ? 'page' : undefined}><List size={23}/><span>내 기록</span></button><button disabled={detailBusy||!!editing} className="m-tab-camera" aria-label="촬영" onClick={openCapture}><span><Camera size={25}/></span><small>촬영</small></button><button disabled={detailBusy||!!editing} onClick={() => navigate('journal')} aria-current={tab === 'journal' ? 'page' : undefined}><BookOpen size={22}/><span>저널</span></button><button disabled={detailBusy||!!editing} onClick={() => navigate('settings')} aria-current={tab === 'settings' ? 'page' : undefined}><Settings size={22}/><span>설정</span></button></nav>}
    </div>
  </div>;
}
