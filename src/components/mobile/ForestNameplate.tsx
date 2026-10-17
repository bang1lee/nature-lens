'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Camera, Check, Copy, Leaf, LockKeyhole } from 'lucide-react';
import './forest-nameplate.css';

// Adapted from Lovable PlantNameplate at 642aa9a864451eb87448fd082f5dd397bb24d85b.
// A fixed public sample path; never serialize observation IDs, photos, or location.
export default function ForestNameplate() {
  const [url, setUrl] = useState('');
  const [localOnly, setLocalOnly] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const address = useRef<HTMLInputElement>(null);
  const addressId = useId();
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  useEffect(() => {
    const origin = window.location.origin;
    if (!/^https?:/.test(origin)) { setError('이 환경에서는 웹 주소를 만들 수 없어요. 웹 브라우저에서 이름표를 열어 주세요.'); return; }
    setUrl(new URL(`${base}/plants/demo-tree-001/`, origin).href);
    setLocalOnly(['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname));
  }, [base]);
  async function copy() {
    setCopied(false);
    try { await navigator.clipboard.writeText(url); setCopied(true); setError(''); }
    catch { setError('아래 주소를 선택했어요. 직접 복사해 주세요.'); address.current?.focus(); address.current?.select(); }
  }
  return <div className="fn-page">
    <header className="fn-header"><a href={`${base}/mobile/`}><ArrowLeft size={17} aria-hidden="true" />내 관찰로</a><span><Leaf size={17} aria-hidden="true" />네이처렌즈</span></header>
    <main id="main">
      <section className="fn-cover" aria-labelledby="fn-title">
        <img src={`${base}/community/moss.jpg`} alt="" width={1200} height={800} />
        <div className="fn-cover-copy"><span>시연용 식물 이름표</span><h1 id="fn-title">이름을 알면,<br />다시 만나고 싶어져요.</h1><p>숲에서의 만남이<br />한 계절의 기록이 되도록.</p><a href="#fn-plate">이름표 살펴보기</a></div>
        <small>이끼 풍경 · 아래 시연 나무의 관찰 사진이 아닙니다</small>
      </section>
      <div className="fn-body">
        <section id="fn-plate" className="fn-story" aria-labelledby="fn-tree-name">
          <p className="fn-sample">예시 데이터 · 실제 지정 나무가 아닙니다</p>
          <div className="fn-plate">
            <span className="fn-screw" aria-hidden="true" /><span className="fn-screw fn-second" aria-hidden="true" />
            <div className="fn-plate-copy"><span><Leaf size={14} aria-hidden="true" />숲의 이름표</span><h2 id="fn-tree-name">느티나무</h2><em lang="la">Zelkova serrata</em><small>NL-DEMO-001</small></div>
            <div className="fn-qr">{url ? <QRCodeSVG value={url} size={128} level="M" marginSize={4} title="시연 이름표 웹 주소 QR" /> : <span role="status">주소 준비 중</span>}<span>이름표 열기</span></div>
          </div>
          <div className="fn-address"><label htmlFor={addressId}>이 이름표의 웹 주소</label><input id={addressId} ref={address} readOnly value={url} onFocus={event => event.target.select()} /><button type="button" onClick={() => void copy()} disabled={!url} aria-label="이름표 주소 복사">{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}</button></div>
          <p className="fn-address-note">QR에는 이 시연 페이지 주소만 들어 있어요. 개인 사진·내 기록·위치는 포함하지 않아요.</p>
          {localOnly && <p className="fn-local-note">지금은 이 컴퓨터의 로컬 주소예요. 휴대전화에서는 열리지 않으므로 현장 이름표로 사용하지 마세요.</p>}
          {copied && <p role="status" className="fn-feedback">이름표 주소를 복사했어요.</p>}
          {error && <p role="alert" className="fn-feedback">{error}</p>}
          <h3>한 그루와 오래 알아가기</h3><p className="fn-prose">오늘 눈에 띈 잎, 달라진 그늘, 비가 온 뒤의 모습. 같은 자리에 다시 찾아와 작은 변화를 남겨 보세요.</p>
          <p className="fn-prose">현장 이름표는 관리자의 허락을 받고 설치해요. 나무에 못을 박거나 가지를 꺾지 않고, 가까운 안내대에서 인사를 건네요.</p>
        </section>
        <section className="fn-seasons" aria-labelledby="fn-seasons-title"><h2 id="fn-seasons-title">계절이 남기는 이야기</h2><p className="fn-prose">아래는 참여 흐름을 보여주는 가상 기록이에요. 실제 관찰이나 전문가 검수 결과가 아닙니다.</p>
          <ol>{[{season:'봄',title:'처음 만난 작은 잎',text:'“가지 끝에서 새 잎을 발견했어요. 다음 산책에도 들러 볼래요.”'},{season:'여름',title:'그늘에서 잠깐 쉬어 가기',text:'“지난번과 같은 자리에서 사진을 남겼어요. 잎이 훨씬 풍성해 보여요.”'},{season:'가을',title:'같은 자리, 달라진 빛',text:'“사진을 나란히 보니 시간이 보이네요. 겨울의 모습도 궁금해요.”'}].map(item=><li key={item.season}><span>{item.season} · 예시</span><h3>{item.title}</h3><p>{item.text}</p></li>)}</ol>
          <aside className="fn-journal"><Leaf size={23} aria-hidden="true" /><div><h3>우리 동네의 한 달이 모이면</h3><p>재관찰과 전문가 검수를 거쳐 월간 도감으로 엮는 흐름을 준비하고 있어요. 이 시연 기록은 실제 도감에 실리지 않아요.</p></div></aside>
        </section>
      </div>
      <footer className="fn-footer"><LockKeyhole size={15} aria-hidden="true" /><p>현재 시연 이름표와 개인 관찰은 자동 연결되지 않아요.<br />관찰 화면에서 주변 자연의 새 기록을 남겨 보세요.</p></footer>
    </main>
    <div className="fn-actions"><a href={`${base}/mobile/`}><Camera size={19} aria-hidden="true" />내 관찰 시작하기</a></div>
  </div>;
}
