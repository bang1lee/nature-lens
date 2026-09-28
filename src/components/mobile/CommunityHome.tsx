'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Camera, Heart, Leaf, MapPin } from 'lucide-react';
import { DEMO_NOW, DEMO_REACTIONS, GROUP_LABELS, rankStories, STORIES, type Period, type Reaction, type Story } from '@/lib/community';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const STORAGE_KEY = 'nature-lens-community-example-likes-v1';

type Props = { onCapture: () => void; onJournal: () => void };
export default function CommunityHome({onCapture, onJournal}: Props) {
 const [period, setPeriod] = useState<Period>('week');
 const [group, setGroup] = useState('all');
 const [likes, setLikes] = useState<string[]>([]);
 const [ready, setReady] = useState(false);
 const [notice, setNotice] = useState('');
 const [opened, setOpened] = useState<Story | null>(null);
 useEffect(() => {
  try { const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); if(Array.isArray(stored))setLikes(stored.filter((id:unknown)=>typeof id==='string'&&STORIES.some(s=>s.id===id))); }
  catch { setNotice('이 브라우저에 공감을 보관하지 못해요. 이번 화면에서만 체험할 수 있어요.'); }
  setReady(true);
 },[]);
 function toggle(id:string) {
  const next=likes.includes(id)?likes.filter(x=>x!==id):[...likes,id];setLikes(next);
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(next));} catch {setNotice('공감은 이번 화면에만 반영됩니다. 브라우저 저장 권한을 확인해 주세요.');}
 }
 const reactions:Reaction[]=[...DEMO_REACTIONS,...likes.map(id=>({storyId:id,actorId:'this-browser',at:DEMO_NOW.toISOString()}))];
 const ranked=rankStories(STORIES,reactions,period,DEMO_NOW).filter(s=>group==='all'||s.group===group);
 function heart(s:Story,count:number) {return <button className={`c-heart ${likes.includes(s.id)?'is-liked':''}`} aria-label={`${s.title} 좋아요`} aria-pressed={likes.includes(s.id)} disabled={!ready} onClick={()=>toggle(s.id)}><Heart size={21} fill={likes.includes(s.id)?'currentColor':'none'}/><span>{count}</span><span className="c-heart-word">공감</span></button>;}
 if(opened) return <section className="c-story-detail"><button className="m-text" onClick={()=>setOpened(null)}><ArrowLeft size={18}/> 함께 보는 기록으로</button><img src={`${base}/community/${opened.image}`} alt={`${opened.species} AI 예시 이미지`}/><div className="c-article"><span className="c-example">가상 관찰 이야기 · AI 예시 이미지</span><h1>{opened.title}</h1><p className="c-author">{opened.author} · {opened.region} · {opened.date}</p><p>{opened.story}</p><blockquote>{opened.care}</blockquote><p className="m-private-note">실제 관찰 자료가 아닌 화면 구성 예시입니다. 종·지역·이야기는 검증된 생태 정보가 아닙니다.</p>{heart(opened,rankStories([opened],reactions,period,DEMO_NOW)[0].count)}<button className="m-secondary" onClick={onJournal}><BookOpen size={18}/> 이달의 저널에서 읽기</button></div></section>;
 return <section className="c-home">
  <div className="c-intro"><span>함께 바라보고, 함께 지키는 자연</span><h1>좋아하는 마음이<br/>생명을 돌보는 기록으로.</h1><p>누군가의 작은 발견이,<br/>우리 모두의 이야기가 됩니다.</p></div>
  <div className="c-demo-note"><Leaf size={16}/><span>커뮤니티 미리보기 · 사진·이야기·공감 수는 예시예요.</span></div>
  <div className="c-feed-heading"><h2>마음을 모은 발견</h2><div className="c-period" aria-label="공감 집계 기간"><button aria-pressed={period==='week'} onClick={()=>setPeriod('week')}>주간</button><button aria-pressed={period==='month'} onClick={()=>setPeriod('month')}>월간</button></div></div>
  <div className="c-period-caption">{period==='week'?'9월 21–27일':'9월 1–27일'} 예시 · 해당 기간에 받은 공감순</div>
  <div className="c-groups" aria-label="생물군 필터">{[['all','모든 생명'],['plant','식물'],['insect','곤충']].map(([id,label])=><button key={id} aria-pressed={group===id} onClick={()=>setGroup(id)}>{label}</button>)}</div>
  {notice&&<p className="m-error" role="status">{notice}</p>}
  <div className="c-feed">{ranked.map((s,i)=><article className="c-feed-card" key={s.id} data-story-id={s.id}>
   <header><span className="c-author-mark">{s.author[0]}</span><div><strong>{s.author}</strong><span><MapPin size={11}/>{s.region} · {GROUP_LABELS[s.group]}</span></div><span className="c-card-index">{i===0?'이번 기간의 공감 기록':'함께한 발견'}</span></header>
   <button className="c-photo-button" aria-label={`${s.title} 이야기 읽기`} onClick={()=>{setOpened(s);window.scrollTo(0,0);}}><img src={`${base}/community/${s.image}`} alt={`${s.species} AI 예시 이미지`} loading={i===0?'eager':'lazy'}/></button>
   <div className="c-card-body"><span className="c-image-caption">AI 예시 이미지 · 실제 관찰 아님</span><h3><button onClick={()=>{setOpened(s);window.scrollTo(0,0);}}>{s.title}</button></h3><p>{s.story}</p><blockquote>{s.care}</blockquote><footer>{heart(s,s.count)}<button className="m-text" onClick={()=>{setOpened(s);window.scrollTo(0,0);}}>이야기 더 읽기 <ArrowRight size={15}/></button></footer></div>
  </article>)}</div>
  <p className="c-local-likes">좋아요는 이 브라우저의 예시 화면에만 반영돼요.<br/>실제 이용자 공유·집계는 아직 연결 전입니다.</p>
  <button className="c-journal-banner" onClick={onJournal}><span><BookOpen size={22}/> 2026년 9월호 · 미리보기</span><strong>작은 생명에게<br/>마음을 건네는 방법</strong><span>사진과 에피소드로 엮은 월간 저널 <ArrowRight size={19}/></span></button>
  <button className="m-secondary c-record-cta" onClick={onCapture}><Camera size={19}/> 나의 발견도 기록하기</button>
 </section>;
}
