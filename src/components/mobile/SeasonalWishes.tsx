'use client';
import { useEffect, useState } from 'react';
import { seasonForMonth } from '@/lib/field-notes';
import { koreanFieldStories } from '@/lib/korean-field-stories';
import './field-notes.css';
const key = 'nature-lens-seasonal-wishes-v1';
type Wish = { id: string; name: string; season: string; done: boolean };
export default function SeasonalWishes() {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [wish, setWish] = useState('');
  const [message, setMessage] = useState('');
  const [season, setSeason] = useState(() => seasonForMonth(new Date().getMonth() + 1));
  useEffect(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (Array.isArray(data))
        setWishes(
          data.filter(
            (x): x is Wish =>
              x &&
              typeof x.id === 'string' &&
              typeof x.name === 'string' &&
              typeof x.season === 'string' &&
              typeof x.done === 'boolean',
          ),
        );
    } catch {
      setMessage('찾고 싶은 식물 목록을 불러오지 못했어요.');
    }
  }, []);
  function update(next: Wish[]) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setWishes(next);
      setMessage('');
      return true;
    } catch {
      setMessage('목록을 저장하지 못했어요. 기기 저장 공간을 확인해 주세요.');
      return false;
    }
  }
  const seasonMonths: Record<string, number[]> = {
    봄: [3, 4, 5],
    여름: [6, 7, 8],
    가을: [9, 10, 11],
    겨울: [12, 1, 2],
  };
  const suggestions = koreanFieldStories
    .flatMap((item) =>
      item.koreanName
        ? (item.seasons ?? [])
            .filter((entry) => {
              const numbers = entry.label.match(/\d+/g)?.map(Number) ?? [];
              if (!numbers.length) return false;
              const [start, end = start] = numbers;
              return seasonMonths[season].some((month) => month >= start && month <= end);
            })
            .map((entry) => ({ item, entry }))
        : [],
    )
    .slice(0, 5);
  return (
    <section className="m-field-notes" aria-label="계절 미션">
      <h2>계절에 찾고 싶은 식물</h2>
      <p>봄꽃이나 가을 열매처럼 만나고 싶은 대상을 미션으로 적어 보세요. 이 기기에 저장돼요.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = wish.trim();
          if (!name) return;
          if (update([...wishes, { id: crypto.randomUUID(), name, season, done: false }]))
            setWish('');
        }}
      >
        <label>
          계절
          <select value={season} onChange={(e) => setSeason(e.target.value)}>
            {['봄', '여름', '가을', '겨울'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          찾고 싶은 식물
          <input
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            maxLength={100}
            placeholder="예: 봄꽃"
          />
        </label>
        <button type="submit">미션 추가</button>
      </form>
      <h3>{season}에 찾아볼 후보</h3>
      <p>산림청 관찰 자료를 바탕으로 한 제안이에요. 지역과 날씨에 따라 시기는 달라져요.</p>
      <ul>
        {suggestions.map(({ item, entry }) => (
          <li key={item.scientificName}>
            <strong>{item.koreanName}</strong> <i>{item.scientificName}</i>
            <p>
              {entry.label} · {entry.observation}
            </p>
            <a href={item.sources[0].url} target="_blank" rel="noreferrer">
              {item.sources[0].title} ↗
            </a>{' '}
            <button
              type="button"
              disabled={wishes.some((w) => w.name === item.koreanName && w.season === season)}
              onClick={() =>
                update([
                  ...wishes,
                  { id: crypto.randomUUID(), name: item.koreanName!, season, done: false },
                ])
              }
            >
              {wishes.some((w) => w.name === item.koreanName && w.season === season)
                ? '추가됨'
                : '미션에 추가'}
            </button>
          </li>
        ))}
      </ul>
      {suggestions.length === 0 && <p>이 계절에 연결할 자료가 아직 없어요.</p>}
      {message && <p role="status">{message}</p>}
      <ul>
        {wishes.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) =>
                  update(
                    wishes.map((w) => (w.id === item.id ? { ...w, done: e.target.checked } : w)),
                  )
                }
              />{' '}
              {item.season} · {item.name}
            </label>
            <button
              type="button"
              aria-label={`${item.name} 미션 삭제`}
              onClick={() => update(wishes.filter((w) => w.id !== item.id))}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
