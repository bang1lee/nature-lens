'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, ChevronRight, Download, FolderOpen, Home, ImagePlus, Leaf, List, Search, Settings, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { readLibrary } from '@/lib/storage';
import type { Collection, Observation } from '@/lib/domain';
import QuickCapture from './QuickCapture';
import './mobile.css';

type Tab = 'home' | 'records' | 'collections' | 'settings';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function MobileApp() {
  const [today, setToday] = useState('오늘의 관찰');
  const [tab, setTab] = useState<Tab>('home');
  const [records, setRecords] = useState<Observation[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [capture, setCapture] = useState(false);
  const [saved, setSaved] = useState<Observation | null>(null);
  const [detail, setDetail] = useState<Observation | null>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

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
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') void navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', online); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  function navigate(next: Tab) { setTab(next); setDetail(null); setGroup(null); setQuery(''); window.scrollTo(0, 0); }
  async function afterSave(record: Observation) {
    setCapture(false); setSaved(record); window.scrollTo(0, 0);
    try { await load(); } catch { setError('저장은 완료했지만 목록 갱신에 실패했어요. 다시 열어 주세요.'); }
  }
  const filtered = records.filter(r => (!group || r.sessionId === group) && `${r.title} ${r.species} ${r.notes}`.toLowerCase().includes(query.toLowerCase()));
  const openCapture = () => { setSaved(null); setCapture(true); window.scrollTo(0, 0); };
  const recordCard = (r: Observation) => <button key={r.id} className="m-record-card" aria-label={`${r.title} 기록 열기`} onClick={() => { setDetail(r); window.scrollTo(0, 0); }}><img src={r.photo} alt=""/><span className="m-record-copy"><small>{r.date.replaceAll('-', '. ')}{r.demo ? ' · 예제' : ''}</small><strong>{r.title}</strong><span>{r.status === 'reviewed' ? '검수 완료' : '나만 보는 초안'}</span></span></button>;

  return <div className="m-stage">
    <aside className="m-preview-note"><Leaf size={30}/><h2>손안의<br/>자연 기록장.</h2><p>촬영하고, 한 줄 남기고,<br/>다음 발견으로.</p><span>모바일 UI 스켈레톤</span><ol><li>사진 촬영 또는 앨범 선택</li><li>이름과 메모는 필요할 때만</li><li>초안 저장 후 나중에 검수</li></ol><a href={`${base}/`}>기존 출판 작업실 <ArrowRight size={16}/></a></aside>
    <div className={`m-app ${capture && !saved ? 'm-in-capture' : ''}`}>
      <main id="main" className="m-content">
      {capture ? <QuickCapture onClose={() => setCapture(false)} onSaved={r => void afterSave(r)}/> : saved ? <section className="m-success">
        <div className="m-success-mark"><Check size={34}/></div><span className="m-muted">내 기록에 저장 완료</span><h1>발견 하나가 쌓였어요</h1><p>지금의 작은 관찰이<br/>나중엔 멋진 이야기가 될 거예요.</p><img src={saved.photo} alt="저장된 관찰 사진"/><strong>{saved.title}</strong><span className="m-draft-chip">나만 보는 초안</span><div className="m-success-actions"><button className="m-primary" onClick={() => { setDetail(saved); setSaved(null); setTab('records'); }}>방금 기록 보기 <ArrowRight size={19}/></button><button className="m-secondary" onClick={openCapture}><Camera size={19}/> 하나 더 기록하기</button><button className="m-text" onClick={() => { setSaved(null); navigate('home'); }}>홈으로</button></div>
      </section> : detail ? <section className="m-detail"><header className="m-header"><button className="m-icon" aria-label="목록으로" onClick={() => { setDetail(null); setTab('records'); }}><ArrowLeft/></button><span>나의 관찰</span><span className="m-draft-chip">{detail.status === 'reviewed' ? '검수 완료' : '초안'}</span></header><img className="m-detail-photo" src={detail.photo} alt={detail.title}/><div className="m-detail-copy"><span className="m-muted">{detail.date} · 위치 비공개</span><h1>{detail.title}</h1><p className="m-species">{detail.species || '식물 이름은 나중에 확인해도 돼요'}</p><p className="m-detail-notes">{detail.notes || '아직 메모가 없어요. 사진에 담긴 발견을 천천히 살펴보세요.'}</p>{detail.demo && <p className="m-private-note">사용법을 보여 주는 가상 예제입니다.</p>}<div className="m-info-line"><ShieldCheck size={21}/><p>이 브라우저에 저장된 기록이에요.<br/>편집·검수·백업은 출판 작업실에서 이어가세요.</p></div><a className="m-secondary" href={`${base}/`}>출판 작업실에서 이어하기 <ArrowRight size={18}/></a></div></section> : <>
        <header className="m-header"><a className="m-brand" href={`${base}/mobile/`}><Leaf size={25}/> nature lens</a><span className="m-header-state">{offline ? <><WifiOff size={14}/> 오프라인</> : '나의 관찰실'}</span></header>
        {error && <p className="m-error" role="alert">{error}</p>}
        {tab === 'home' && <section className="m-home"><div className="m-greeting"><span>{today}</span><h1>오늘은 어떤 자연을<br/>만났나요?</h1><p>이름을 몰라도, 작은 잎 하나라도 좋아요.</p></div><button className="m-capture-card" onClick={openCapture}><div className="m-capture-illustration"><Camera size={45} strokeWidth={1.4}/><Leaf size={31} strokeWidth={1.1}/></div><strong>지금 만난 자연 담기</strong><span>사진 한 장이면 기록이 시작돼요.</span><span className="m-capture-card-action">사진 찍고 기록하기 <ArrowRight size={18}/></span></button><div className="m-section-title"><h2>최근의 발견 <span>{records.length}</span></h2><button className="m-text" onClick={() => navigate('records')}>모두 보기 <ChevronRight size={16}/></button></div>{loading ? <div className="m-loading" role="status">기록 불러오는 중…</div> : records.length ? <div className="m-recent-grid">{records.slice(0, 2).map(recordCard)}</div> : <div className="m-empty"><Leaf size={29} strokeWidth={1.1}/><p>아직 비어 있는 나의 자연 기록장.<br/>첫 발견을 기다리고 있어요.</p></div>}<div className="m-field-tip"><Leaf size={23}/><div><strong>가까이 보고, 그대로 두기</strong><p>자연은 눈과 사진으로만 담아주세요.</p></div></div></section>}
        {tab === 'records' && <section className="m-records"><div className="m-page-title"><span className="m-muted">사진으로 쌓이는 나의 도감</span><h1>{group ? collections.find(c => c.id === group)?.name : '내가 만난 자연'} <span>{filtered.length}</span></h1></div><label className="m-search"><Search size={19}/><input aria-label="내 기록 검색" placeholder="이름이나 메모로 찾기" value={query} onChange={e => setQuery(e.target.value)}/></label>{group && <button className="m-text" onClick={() => setGroup(null)}>전체 기록 보기</button>}{filtered.length ? <div className="m-recent-grid">{filtered.map(recordCard)}</div> : <div className="m-empty m-empty-large"><ImagePlus size={39} strokeWidth={1}/><h2>{query ? '일치하는 기록이 없어요' : '첫 번째 발견을 담아보세요'}</h2><p>{query ? '다른 이름이나 메모로 찾아보세요.' : '사진만 찍어도 멋진 관찰의 시작이에요.'}</p>{!query && <button className="m-primary" onClick={openCapture}><Camera size={19}/> 사진으로 기록하기</button>}</div>}</section>}
        {tab === 'collections' && <section className="m-collections"><div className="m-page-title"><span className="m-muted">같은 계절, 함께한 산책</span><h1>발견을 차곡차곡</h1><p>작업실에서 만든 컬렉션을 여기서 살펴보세요.</p></div><button className="m-collection-row" onClick={() => navigate('records')}><span className="m-folder-icon"><Leaf/></span><span><strong>모든 발견</strong><small>{records.length}개의 기록</small></span><ChevronRight size={20}/></button>{collections.map(c => <button key={c.id} className="m-collection-row" onClick={() => { setGroup(c.id); setTab('records'); }}><span className="m-folder-icon"><FolderOpen/></span><span><strong>{c.name}</strong><small>{records.filter(r => r.sessionId === c.id).length}개의 기록</small></span><ChevronRight size={20}/></button>)}<div className="m-coming"><BookOpen size={31} strokeWidth={1}/><h2>기록이 모이면, 한 권의 책</h2><p>사진을 고르고 검수해 나만의 기록집으로.<br/>출판 작업실에서 이어서 만들 수 있어요.</p><a className="m-secondary" href={`${base}/`}>출판 작업실 열기 <ArrowRight size={17}/></a></div></section>}
        {tab === 'settings' && <section className="m-settings"><div className="m-page-title"><span className="m-muted">나만의 자연 기록장</span><h1>내 손안의 관찰실</h1></div><div className="m-settings-note"><Smartphone size={30}/><h2>홈 화면에 두고 바로 기록하세요</h2><p>아이폰은 Safari 공유 메뉴에서 ‘홈 화면에 추가’, 안드로이드는 Chrome 메뉴에서 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 선택하세요. 메뉴 이름은 기기에 따라 달라요.</p></div><div className="m-info-line"><ShieldCheck size={23}/><p>사진·메모는 이 브라우저에만 저장됩니다.<br/>클라우드 동기화와 AI 판별은 아직 연결 전입니다.</p></div><a className="m-settings-link" href={`${base}/`}><Download size={20}/><span>작업실에서 백업·복원하기</span><ChevronRight size={18}/></a><div className="m-settings-note"><h2>지금은 화면 골격을 살펴보는 단계예요</h2><p>촬영·앨범 선택 → 간단 기록 → 초안 저장 흐름을 사용할 수 있습니다. 네이티브 앱스토어 배포와 기기별 카메라 검증은 다음 단계입니다.</p><p>얼굴·개인정보가 보이는 사진은 피해주세요. 사진 위치 정보는 저장 전에 제거합니다.</p></div></section>}
      </>}
      </main>
      {!capture && !saved && <nav className="m-tabbar" aria-label="모바일 메뉴"><button onClick={() => navigate('home')} aria-current={!detail && tab === 'home' ? 'page' : undefined}><Home size={22}/><span>홈</span></button><button onClick={() => navigate('records')} aria-current={tab === 'records' ? 'page' : undefined}><List size={23}/><span>내 기록</span></button><button className="m-tab-camera" aria-label="촬영" onClick={openCapture}><span><Camera size={25}/></span><small>촬영</small></button><button onClick={() => navigate('collections')} aria-current={tab === 'collections' ? 'page' : undefined}><FolderOpen size={22}/><span>모아보기</span></button><button onClick={() => navigate('settings')} aria-current={tab === 'settings' ? 'page' : undefined}><Settings size={22}/><span>설정</span></button></nav>}
    </div>
  </div>;
}
