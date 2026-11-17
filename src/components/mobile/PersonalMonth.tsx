'use client';
import {useRef,useState} from 'react';
import './personal-month-print.css';
import type {Observation} from '@/lib/domain';

export default function PersonalMonth({records,initialMonth,onOpen,onCapture}:{records:Observation[];initialMonth?:string;onOpen?:(record:Observation)=>void;onCapture?:()=>void}){
 const [month,setMonth]=useState(initialMonth||new Date().toLocaleDateString('en-CA').slice(0,7));
 const [preview,setPreview]=useState(false);
 const [reading,setReading]=useState(false);
 const [printing,setPrinting]=useState(false);
 const [printError,setPrintError]=useState('');
 const printBook=useRef<HTMLDivElement>(null);
 async function print(){
  if(printing)return;setPrinting(true);setPrintError('');
  try{
   const book=printBook.current;
   if(!book)return;
   const images=Array.from(book.querySelectorAll('img'));
   await Promise.all(images.map(image=>image.decode()));
   if(document.fonts)await document.fonts.ready;
   if(printBook.current!==book||!book.isConnected)return;
   window.print();
  }catch{setPrintError('사진을 모두 준비하지 못했어요. 잠시 뒤 다시 시도해 주세요.');}
  finally{setPrinting(false);}
 }
 const entries=records.filter(r=>!r.demo&&r.date.startsWith(month+'-')).sort((a,b)=>a.date.localeCompare(b.date));
 const subjects=new Set(entries.map(r=>r.specimenId||r.id));
 if(reading)return <section className="personal-print-view" aria-label="개인 도감 인쇄 미리보기">
  <div className="personal-print-tools"><button className="m-text" onClick={()=>setReading(false)}>월간 기록으로 돌아가기</button><button className="m-secondary" disabled={printing||!entries.length} onClick={()=>void print()}>{printing?'사진 준비 중':'인쇄 · PDF로 저장'}</button><p>인쇄 창에서 PDF로 저장을 선택할 수 있어요. 개인 사진과 메모가 포함되며 서버로 전송하지 않습니다.</p>{printError&&<p role="alert">{printError}</p>}</div>
  <div className="personal-print-book" ref={printBook}>
   <header className="personal-print-cover"><span>NATURE LENS / 나의 자연 기록장</span><h1>{month}<br/>다시 만난 자연</h1><p>{entries.length}개의 기록 · {subjects.size}개의 관찰 대상</p><p>개인 도감 · 비공개 초안<br/>전문가 검수·공개 발행본이 아닙니다.</p></header>
   {entries.map(record=><article className="personal-print-entry" key={record.id}><span>{record.date} · {record.previousObservationId?'재관찰':'첫 기록'}</span><h2>{record.title}</h2><img src={record.photo} alt={record.title}/><p>{record.species||'이름 미확정'}</p><p className="personal-print-notes">{record.notes||'사진으로 남긴 관찰'}</p><footer>개인 관찰 · 전문가 동정 미확인 · 위치 제외</footer></article>)}
  </div>
 </section>;
 return <section className="m-personal-month" aria-labelledby="personal-month-title">
  <span className="m-muted">이 브라우저에 모인 나의 관찰</span><h2 id="personal-month-title">이번 달, 다시 만난 자연</h2>
  <label>도감 월<input type="month" value={month} onChange={e=>{setMonth(e.target.value);setPreview(false);}}/></label>
  <p>{entries.length}개의 기록 · {subjects.size}개의 관찰 대상 · {entries.filter(r=>r.previousObservationId).length}번의 재관찰</p>
  <p className="m-private-note">개인 도감 초안이에요. 전문가 검수나 공개 발행을 의미하지 않아요. 사진과 메모는 이 브라우저 안에서만 모읍니다.</p>
  {entries.length ? <button className="m-secondary" onClick={()=>setPreview(!preview)}>{preview?'내 도감 접기':'내 기록으로 도감 펼치기'}</button>:<p>이달의 기록이 아직 없어요. 다른 달을 고르거나 사진 한 장으로 시작해 보세요.</p>}
  {!entries.length&&onCapture&&<button className="m-secondary" onClick={onCapture}>첫 관찰 기록하기</button>}
  {entries.length>0&&<button className="m-secondary personal-print-open" onClick={()=>setReading(true)}>개인 도감 인쇄 미리보기</button>}
  {preview&&<div aria-label="개인 월간 도감 미리보기"><h3>{month} 나의 자연 도감 · 비공개 초안</h3>{entries.map(r=><article className="j-paper" key={r.id}><span>{r.date} · {r.previousObservationId?'재관찰':'첫 기록'}</span><h3>{r.title}</h3><img src={r.photo} alt={r.title} style={{width:'100%',maxHeight:300,objectFit:'contain'}}/><p>{r.species||'이름 미확정'}</p><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{r.notes||'사진으로 남긴 관찰'}</p><small>개인 기록 · 전문가 동정 미확인</small>{onOpen&&<button className="m-text" onClick={()=>onOpen(r)}>{r.title} 상세 · 다시 관찰하기</button>}</article>)}</div>}
 </section>;
}
