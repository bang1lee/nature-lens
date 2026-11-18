'use client';
import { useEffect, useState } from 'react';
import { cloudConfig } from '@/lib/cloud/config';
import { getSupabase } from '@/lib/cloud/client';
import { getSpeciesStory } from '@/lib/species-stories';
import PublicSpeciesDetail from './PublicSpeciesDetail';
type Species = { scientific_name: string; observations: number };
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export default function PublicSpecies() {
  const [rows, setRows] = useState<Species[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get('name') || '';
    setSelected(name);
    let active = true;
    void (async () => {
      try {
        if (!cloudConfig.enabled) throw Error();
        const client = await getSupabase();
        const query = client.from('public_species_summary').select('scientific_name,observations');
        const { data, error } = await (name
          ? query.eq('scientific_name', name)
          : query.order('scientific_name').limit(500));
        if (error) throw error;
        if (active) {
          setRows(
            (data ?? []).filter(
              (r): r is Species =>
                typeof r.scientific_name === 'string' &&
                Number.isInteger(r.observations) &&
                r.observations > 0,
            ),
          );
          setState('ready');
        }
      } catch {
        if (active) setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const species = rows.find((r) => r.scientific_name === selected);
  const story = species ? getSpeciesStory(species.scientific_name, 'species') : undefined;
  return (
    <main id="main" style={{ maxWidth: 680, margin: '2rem auto', padding: '0 1rem' }}>
      <a href={`${base}/mobile/`}>← 관찰실로</a>
      <h1>{selected ? '함께 확인한 종 상세' : '함께 확인한 종'}</h1>
      <p>
        전문가가 확인하고 공개에 동의한 관찰을 종별로 모았어요. 위치와 개인 기록은 표시하지
        않습니다.
      </p>
      {state === 'loading' ? (
        <p role="status">목록을 불러오는 중이에요.</p>
      ) : state === 'error' ? (
        <p role="status">목록을 불러올 수 없어요. 연결과 서비스 준비 상태를 확인해 주세요.</p>
      ) : selected ? (
        species ? (
          <>
            <a href={`${base}/species/`}>← 종 목록</a>
            <PublicSpeciesDetail
              scientificName={species.scientific_name}
              observations={species.observations}
              story={story}
            />
          </>
        ) : (
          <p>
            공개된 확인 기록이 없거나 철회된 종이에요. <a href={`${base}/species/`}>목록 보기</a>
          </p>
        )
      ) : rows.length ? (
        <ul>
          {rows.map((r) => (
            <li key={r.scientific_name}>
              <a href={`${base}/species/?name=${encodeURIComponent(r.scientific_name)}`}>
                <i>{r.scientific_name}</i>
              </a>{' '}
              · 관찰 {r.observations}건
            </li>
          ))}
        </ul>
      ) : (
        <p>아직 공개된 전문가 확인 기록이 없어요.</p>
      )}
    </main>
  );
}
