'use client';
import {useState} from 'react';
import './review-preview.css';
// Adapted from Lovable ReviewExamples, pinned 642aa9a. No record props or storage access.
const examples=[
 {label:'검수 대기',title:'아직 판단하지 않은 기록',text:'예시 A · 잎 사진과 메모가 도착했다고 가정한 상황입니다. 식물 이름이나 내용은 아직 검증되지 않았어요.',next:'검토할 항목: 사진의 특징, 촬영 날짜, 같은 개체 여부'},
 {label:'추가 자료 필요',title:'한 장 더 보면 알 수 있는 것',text:'예시 B · 잎의 가장자리와 전체 모습이 부족한 상황입니다. 같은 개체의 잎 뒷면과 전경을 더 살펴봐야 해요.',next:'추가 사진 요청은 앞으로 연결할 기능입니다. 이 화면에서는 요청을 보내지 않아요.'},
 {label:'검토 완료 예시',title:'검토 이후의 화면을 미리 봐요',text:'예시 C · 자료 검토를 마쳤다고 가정한 화면입니다. 실제 전문가가 확인한 기록이나 승인 결과가 아닙니다.',next:'검토와 공개 동의는 별개예요. 이 예시는 월간 도감에 실리거나 공개되지 않아요.'},
];
export default function ReviewPreview(){
 const [selected,setSelected]=useState(0);const entry=examples[selected];
 return <details className="nl-review-preview"><summary>전문가 검수 과정 미리보기 · 목업</summary><div className="nl-review-content"><h2>전문가 검수 시연</h2><p>가상의 상태 예시입니다. 내 사진을 사용하거나 실제 기록의 검수 상태를 바꾸지 않아요.</p><div className="nl-review-options" aria-label="검수 상태 예시">{examples.map((example,index)=><button type="button" key={example.label} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{example.label}</button>)}</div><article aria-live="polite"><span>독립 시연 · {entry.label}</span><h3>{entry.title}</h3><p>{entry.text}</p><p>{entry.next}</p></article><p className="nl-review-footnote">실제 운영에는 전문가 계정·판정 근거·정정 이력·철회 절차가 필요합니다. 현재는 연결 전이에요.</p></div></details>;
}
