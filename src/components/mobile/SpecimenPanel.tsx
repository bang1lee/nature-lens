'use client';

import { useId } from 'react';
import { Camera, ChevronRight, Leaf } from 'lucide-react';
import type { Observation } from '@/lib/domain';
import { observationTimeline } from '@/lib/reobservation';
import './specimen.css';

export interface SpecimenPanelProps {
  record: Observation;
  records: Observation[];
  onReobserve: () => void;
  onOpen: (record: Observation) => void;
}

function observationDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

/** Only explicit specimen links belong here; a species name is not an identity. */
export default function SpecimenPanel({ record, records, onReobserve, onOpen }: SpecimenPanelProps) {
  const headingId = useId();
  const timeline = observationTimeline(records, record);
  const missingPrevious = Boolean(record.previousObservationId && !records.some(item => item.id === record.previousObservationId));

  return (
    <section className="m-specimen" aria-labelledby={headingId}>
      <header className="m-specimen-heading">
        <Leaf size={21} aria-hidden="true" />
        <div>
          <h2 id={headingId}>같은 대상의 시간</h2>
          <p>이 기기에 남긴 관찰 {timeline.length}회</p>
        </div>
      </header>
      <p className="m-specimen-intro">다시 만난 나무 한 그루, 꽃 한 포기의 변화를 이어 보세요. 같은 대상으로 연결한 기록만 모아요.</p>
      {missingPrevious && <p className="m-specimen-notice">이전 관찰이 이 기기에 없어요. 남아 있는 기록은 계속 볼 수 있어요.</p>}
      <ol className="m-specimen-timeline" aria-label="관찰 날짜순 기록">
        {timeline.map((item, index) => {
          const current = item.id === record.id;
          return (
            <li key={item.id} className={current ? 'is-current' : undefined}>
              <span className="m-specimen-dot" aria-hidden="true" />
              <button type="button" className="m-specimen-entry" onClick={() => onOpen(item)} aria-current={current ? 'true' : undefined} aria-label={`${observationDate(item.date)}, ${item.title || '이름 없는 관찰'}${current ? ', 보고 있는 기록' : ', 기록 열기'}`}>
                {item.photo ? <img src={item.photo} alt="" width={58} height={68} loading="lazy" /> : <span className="m-specimen-no-photo"><Leaf size={23} aria-hidden="true" /></span>}
                <span className="m-specimen-entry-copy">
                  <time dateTime={item.date}>{observationDate(item.date)}</time>
                  <strong>{item.title || '이름 없는 관찰'}</strong>
                  <small>{item.demo ? '시연 기록' : current ? '보고 있는 기록' : index === 0 ? '남아 있는 첫 기록' : '이어진 관찰'}</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      {timeline.length === 1 && <p className="m-specimen-invitation">다음에 만날 때 새 사진을 남겨 주세요. 작은 변화가 이곳에 쌓여요.</p>}
      <button type="button" className="m-specimen-reobserve" onClick={onReobserve}><Camera size={18} aria-hidden="true" />같은 대상 다시 관찰하기</button>
      <p className="m-specimen-footnote">같은 종이어도 다른 개체라면 새 기록으로 남겨 주세요.</p>
    </section>
  );
}
