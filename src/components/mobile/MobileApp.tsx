'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, ChevronRight, Download, FolderOpen, Home, ImagePlus, Leaf, List, Search, Settings, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { readLibrary } from '@/lib/storage';
import type { Collection, Observation } from '@/lib/domain';
const BackupPanel = dynamic(() => import('./BackupPanel'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const ReviewPreview = dynamic(() => import('./ReviewPreview'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const IdentificationPanel = dynamic(() => import('./IdentificationPanel'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const CloudPanel = dynamic(() => import('./CloudPanel'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
const QuickCapture = dynamic(() => import('./QuickCapture'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
import {useIdentificationReturn} from './useIdentificationReturn';
import SpecimenPanel from './SpecimenPanel';
import CommunityHome from './CommunityHome';
const MonthlyJournal = dynamic(() => import('./MonthlyJournal'), {loading: () => <p className="m-loading" role="status">화면을 준비하고 있어요…</p>});
import PrivateLocationNote from './PrivateLocationNote';
import ParticipationPanel from './ParticipationPanel';
import './mobile.css';
import './forest-journey.css';

type Tab = 'home' | 'records' | 'collections' | 'journal' | 'settings';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function MobileApp({webBoard=false}:{webBoard?:boolean}) {
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
      if (!capture && !saved && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); setReobserveFrom(null); setCapture(true); window.scrollTo(0, 0); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [capture, saved]);

  function navigate(next: Tab) { setTab(webBoard&&next==='home'?'records':next); setDetail(null); setGroup(null); setQuery(''); window.scrollTo(0, 0); }
  async function afterSave(record: Observation) {
    setCapture(false); setSaved(record); window.scrollTo(0, 0);
    try { await load(); } catch { setError('저장은 완료했지만 목록 갱신에 실패했어요. 다시 열어 주세요.'); }
  }
  const filtered = records.filter(r => (taxonFilter==='all'||r.taxonGroup===taxonFilter) && (!group || r.sessionId === group) && `${r.title} ${r.species} ${r.notes}`.toLowerCase().includes(query.toLowerCase()));
  const openCapture = () => { setSaved(null); setReobserveFrom(null); setCapture(true); window.scrollTo(0, 0); };
  const recordCard = (r: Observation) => <button key={r.id} className="m-record-card" aria-label={`${r.title} 기록 열기`} onClick={() => { setDetail(r); window.scrollTo(0, 0); }}><img src={r.photo} alt="" loading="lazy" decoding="async"/><span className="m-record-copy"><small>{r.date.replaceAll('-', '. ')}{r.demo ? ' · 예제' : ''}</small><strong>{r.title}</strong><span>{r.status === 'reviewed' ? '내 확인 완료' : '나만 보는 초안'}</span>{webBoard&&r.notes&&<span className="m-board-note">{r.notes}</span>}</span></button>;

  return <div className={`m-stage ${webBoard ? 'm-web-board' : ''}`}>
    <aside className="m-preview-note"><Leaf size={30}/><h2>손안의<br/>자연 기록장.</h2><p>촬영하고, 한 줄 남기고,<br/>다음 발견으로.</p><span>나의 자연 관찰실</span><ol><li>사진 촬영 또는 앨범 선택</li><li>이름과 메모는 필요할 때만</li><li>초안 저장 후 나중에 검수</li></ol><a href={`${base}/`}>기존 출판 작업실 <ArrowRight size={16}/></a></aside>
    <div className={`m-app ${capture && !saved ? 'm-in-capture' : ''}`}>
      <main id="main" className="m-content" tabIndex={-1} aria-busy={loading} data-ready={!loading}>
      {capture ? <QuickCapture reobserveFrom={reobserveFrom} onClose={() => setCapture(false)} onSaved={r => void afterSave(r)}/> : saved ? <section className="m-success">
        <div className="m-success-mark"><Check size={34}/></div><span className="m-muted">내 기록에 저장 완료</span><h1>발견 하나가 쌓였어요</h1><p>지금의 작은 관찰이<br/>나중엔 멋진 이야기가 될 거예요.</p><img src={saved.photo} alt="저장된 관찰 사진"/><strong>{saved.title}</strong><span className="m-draft-chip">나만 보는 초안</span><p className="f-next-note">기록 상세에서 이름 후보를 확인하고,<br/>다음 만남을 같은 대상에 이어 남겨요.</p><div className="m-success-actions"><button className="m-primary" onClick={() => { setDetail(saved); setSaved(null); setTab('records'); }}>방금 기록 보기 <ArrowRight size={19}/></button><button className="m-secondary" onClick={()=>{setJournalMonth(saved.date.slice(0,7));setSaved(null);navigate('journal');}}><BookOpen size={19}/> 이달의 도감에 모아 보기</button><button className="m-secondary" onClick={openCapture}><Camera size={19}/> 하나 더 기록하기</button><button className="m-text" onClick={() => { setSaved(null); navigate('home'); }}>홈으로</button></div>
      </section> : detail ? <section className="m-detail"><header className="m-header"><button className="m-icon" aria-label="목록으로" onClick={() => { setDetail(null); setTab('records'); }}><ArrowLeft/></button><span>나의 관찰</span><span className="m-draft-chip">{detail.status === 'reviewed' ? '내 확인 완료' : '초안'}</span></header><img className="m-detail-photo" src={detail.photo} alt={detail.title}/><div className="m-detail-copy"><span className="m-muted">{detail.date} · {detail.region || '지역 비공개'}</span><h1>{detail.title}</h1><p className="m-species">{detail.species || '생물 이름은 나중에 확인해도 돼요'}</p><IdentificationPanel key={`${detail.id}-${detail.updatedAt}`} record={detail} onApplied={record=>{setDetail(record);void load().catch(()=>setError('목록을 다시 열어 주세요.'));}}/><PrivateLocationNote key={detail.id} id={detail.id} onRemoved={() => {setDetail({...detail,region:undefined,publicGrid:undefined,status:'draft'});void load().catch(()=>setError('목록을 다시 열어 주세요.'));}}/><p className="m-detail-notes">{detail.notes || '아직 메모가 없어요. 사진에 담긴 발견을 천천히 살펴보세요.'}</p><SpecimenPanel record={detail} records={records} onOpen={record=>{setDetail(record);window.scrollTo(0,0);}} onReobserve={()=>{setReobserveFrom(detail);setSaved(null);setCapture(true);window.scrollTo(0,0);}}/><button className="m-secondary f-month-link" onClick={()=>{setJournalMonth(detail.date.slice(0,7));navigate('journal');}}><BookOpen size={18}/> 이 기록의 월간 도감 보기</button>{detail.demo && <p className="m-private-note">사용법을 보여 주는 가상 예제입니다.</p>}<div className="m-info-line"><ShieldCheck size={21}/><p>이 브라우저에 저장된 기록이에요.<br/>편집·검수·백업은 출판 작업실에서 이어가세요.</p></div><a className="m-secondary" href={`${base}/`}>출판 작업실에서 이어하기 <ArrowRight size={18}/></a></div></section> : <>
        <header className="m-header"><a className="m-brand" href={`${base}/${webBoard?'board':'mobile'}/`}><Leaf size={25}/> nature lens</a><span className="m-header-state">{offline ? <><WifiOff size={14}/> 오프라인</> : '나의 관찰실'}</span></header>
        {loginReturnMessage&&<p role="status">{loginReturnMessage}</p>}
        {error && <p className="m-error" role="alert">{error}</p>}
        {tab === 'home' && <><section className="f-journey-cover"><img className="f-cover-photo" src={`${base}/community/moss.jpg`} alt="" fetchPriority="high"/><span className="f-cover-date">{today}</span><h2>이름을 알면,<br/>다시 만나고 싶어져요.</h2><p>사진 한 장에서 시작해<br/>계절을 담은 나의 도감으로.</p><button className="m-primary" onClick={openCapture}><Camera size={19}/> 오늘의 자연 기록하기</button><a href={`${base}/plants/demo-tree-001/`}>숲의 이름표 둘러보기 · 시연 <ArrowRight size={16}/></a><small>이끼 풍경 · AI 예시 이미지</small></section><ol className="f-journey-steps" aria-label="자연 기록의 흐름"><li>01 사진</li><li>02 이름 후보</li><li>03 재관찰</li><li>04 월간 도감</li></ol>{!loading && records.length > 0 && <section className="f-return"><span>다시 만날 자연</span><button onClick={()=>{setDetail(records[0]);setTab('records');window.scrollTo(0,0);}}><img src={records[0].photo} alt="" width={56} height={64}/><span><strong>{records[0].title}{records[0].demo ? ' · 예제' : ''}</strong><small>지난 기록을 보고, 오늘의 변화를 남겨요</small></span><ChevronRight size={19}/></button></section>}{records.some(r=>r.discoveryId)&&<section className="f-return" aria-label="내일의 발견 모아보기"><span>내가 남긴 예상</span>{records.filter(r=>r.discoveryId).slice(0,3).map(r=><button key={r.id} onClick={()=>{setDetail(r);setTab('records');window.scrollTo(0,0);}}><span><strong>{r.title}</strong><small>내일의 발견 · 예상과 결과 확인</small></span><ChevronRight size={19}/></button>)}</section>}<ParticipationPanel records={records}/><details className="m-settings-note"><summary>숲의 이야기 둘러보기 · 예시</summary><CommunityHome onCapture={openCapture} onJournal={() => navigate('journal')}/></details></>}
        {tab === 'journal' && <MonthlyJournal key={journalMonth||'current'} records={records} initialMonth={journalMonth} onOpen={record=>{setDetail(record);window.scrollTo(0,0);}} onCapture={openCapture}/>}
        {tab === 'records' && <section className="m-records"><div className="m-page-title"><span className="m-muted">사진으로 쌓이는 나의 도감</span><h1>{group ? collections.find(c => c.id === group)?.name : (webBoard?'내 관찰 보드':'내가 만난 자연')} <span>{filtered.length}</span></h1></div>{webBoard&&<div className="m-board-tools"><p>사진 한 장, 발견 하나.<br/>이 브라우저에만 보관하는 나의 자연 기록장입니다.</p><button className="m-primary" onClick={openCapture}><Camera size={20}/> 관찰 추가</button><label>생물군<select value={taxonFilter} onChange={e=>setTaxonFilter(e.target.value)}><option value="all">모든 생명</option><option value="plant">식물</option><option value="insect">곤충</option><option value="other">기타 생명</option></select></label></div>}<button className="m-text" onClick={() => navigate('collections')}>컬렉션 모아보기 <FolderOpen size={16}/></button><label className="m-search"><Search size={19}/><input aria-label="내 기록 검색" placeholder="이름이나 메모로 찾기" value={query} onChange={e => setQuery(e.target.value)}/></label>{group && <button className="m-text" onClick={() => setGroup(null)}>전체 기록 보기</button>}{filtered.length ? <div className="m-recent-grid">{filtered.map(recordCard)}</div> : <div className="m-empty m-empty-large"><ImagePlus size={39} strokeWidth={1}/><h2>{query ? '일치하는 기록이 없어요' : '첫 번째 발견을 담아보세요'}</h2><p>{query ? '다른 이름이나 메모로 찾아보세요.' : '사진만 찍어도 멋진 관찰의 시작이에요.'}</p>{!query && <button className="m-primary" onClick={openCapture}><Camera size={19}/> 사진으로 기록하기</button>}</div>}</section>}
        {tab === 'collections' && <section className="m-collections"><div className="m-page-title"><span className="m-muted">같은 계절, 함께한 산책</span><h1>발견을 차곡차곡</h1><p>작업실에서 만든 컬렉션을 여기서 살펴보세요.</p></div><button className="m-collection-row" onClick={() => navigate('records')}><span className="m-folder-icon"><Leaf/></span><span><strong>모든 발견</strong><small>{records.length}개의 기록</small></span><ChevronRight size={20}/></button>{collections.map(c => <button key={c.id} className="m-collection-row" onClick={() => { setGroup(c.id); setTab('records'); }}><span className="m-folder-icon"><FolderOpen/></span><span><strong>{c.name}</strong><small>{records.filter(r => r.sessionId === c.id).length}개의 기록</small></span><ChevronRight size={20}/></button>)}<div className="m-coming"><BookOpen size={31} strokeWidth={1}/><h2>기록이 모이면, 한 권의 책</h2><p>사진을 고르고 검수해 나만의 기록집으로.<br/>출판 작업실에서 이어서 만들 수 있어요.</p><a className="m-secondary" href={`${base}/`}>출판 작업실 열기 <ArrowRight size={17}/></a></div></section>}
        {tab === 'settings' && <section className="m-settings"><div className="m-page-title"><span className="m-muted">나만의 자연 기록장</span><h1>내 손안의 관찰실</h1></div><section className="m-settings-note" aria-labelledby="privacy-heading"><h2 id="privacy-heading">내 기록과 개인정보</h2><dl className="nl-privacy-list"><dt>로그인 없이 기록하기</dt><dd>사진과 메모는 이 브라우저에 저장돼요. 다른 기기와 자동으로 동기화되지 않습니다. 브라우저 데이터를 지우기 전에 아래에서 백업하세요.</dd><dt>전송은 각각 확인해요</dt><dd>AI 식별과 공동 관찰 제출은 별도 기능이에요. 연결된 경우에도 사진 전송 또는 제출에 동의한 기록만 보내요. 현재 연결·로그인 상태는 아래 공동 관찰 영역에서 확인하세요.</dd><dt>위치와 내보내기</dt><dd>원본 사진의 위치 정보는 제거해요. 따로 기록한 정밀 GPS는 일반 백업과 개인 도감 인쇄에서 제외됩니다. 직접 쓴 메모에 주소나 연락처가 없는지도 확인하세요.</dd><dt>삭제와 공개 철회</dt><dd>기록 삭제는 출판 작업실에서 할 수 있어요. 서버에 제출한 기록은 별도로 철회해야 하며, 기기 기록 삭제가 서버 제출을 자동 취소하지는 않아요.</dd></dl></section><BackupPanel onRestored={load}/><ReviewPreview/><ParticipationPanel records={records}/><CloudPanel records={records}/><div className="m-settings-note"><Smartphone size={30}/><h2>홈 화면에 두고 바로 기록하세요</h2><p>아이폰은 Safari 공유 메뉴에서 ‘홈 화면에 추가’, 안드로이드는 Chrome 메뉴에서 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 선택하세요. 메뉴 이름은 기기에 따라 달라요.</p></div><div className="m-info-line"><ShieldCheck size={23}/><p>기본 기록은 이 브라우저에 보관됩니다.<br/>자동 클라우드 동기화는 아직 연결 전입니다. AI 이름 찾기는 기록 상세에서 서버 연결 상태를 확인하세요. 공동 관찰은 위의 서버 연결 상태를 확인하세요.</p></div><a className="m-settings-link" href={`${base}/`}><Download size={20}/><span>작업실에서 백업·복원하기</span><ChevronRight size={18}/></a><div className="m-settings-note"><h2>지금은 화면 골격을 살펴보는 단계예요</h2><p>촬영·앨범 선택 → 간단 기록 → 초안 저장 흐름을 사용할 수 있습니다. Mac·Android 설치형 앱 골격이 준비되어 있으며, 스토어 배포와 기기별 카메라·백업 검증은 다음 단계입니다.</p><p>얼굴·개인정보가 보이는 사진은 피해주세요. 사진의 원본 위치 정보는 제거합니다. 직접 선택한 지역과 GPS는 별도로 저장되며, 정밀 좌표는 일반 백업에 포함되지 않습니다.</p></div></section>}
      </>}
      </main>
      {!capture && !saved && <nav className="m-tabbar" aria-label="모바일 메뉴"><button onClick={() => navigate('home')} aria-current={!detail && tab === 'home' ? 'page' : undefined}><Home size={22}/><span>홈</span></button><button onClick={() => navigate('records')} aria-current={tab === 'records' ? 'page' : undefined}><List size={23}/><span>내 기록</span></button><button className="m-tab-camera" aria-label="촬영" onClick={openCapture}><span><Camera size={25}/></span><small>촬영</small></button><button onClick={() => navigate('journal')} aria-current={tab === 'journal' ? 'page' : undefined}><BookOpen size={22}/><span>저널</span></button><button onClick={() => navigate('settings')} aria-current={tab === 'settings' ? 'page' : undefined}><Settings size={22}/><span>설정</span></button></nav>}
    </div>
  </div>;
}
