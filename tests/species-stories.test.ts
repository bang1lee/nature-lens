import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { getSpeciesStory, speciesStoryCatalog } from '../src/lib/species-stories';
import SpeciesStory from '../src/components/mobile/SpeciesStory';

describe('species stories', () => {
  it('contains unique species and a traceable source for every entry', () => {
    const keys = speciesStoryCatalog.map((item) => item.scientificName.toLowerCase());
    expect(keys).toHaveLength(30);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of speciesStoryCatalog) {
      expect(item.sources.length).toBeGreaterThan(0);
      for (const source of item.sources) expect(new URL(source.url).protocol).toBe('https:');
      expect(getSpeciesStory(item.scientificName, 'species')).toBe(item);
    }
  });
  it('matches only the exact species, never an ancestor or a related species', () => {
    expect(getSpeciesStory('  PINUS  densiflora ', 'species')?.scientificName).toBe(
      'Pinus densiflora',
    );
    expect(getSpeciesStory('Pinus koraiensis', 'species')?.koreanName).toBe('잣나무');
    expect(getSpeciesStory('Pinus', 'genus')).toBeUndefined();
    expect(getSpeciesStory('Pinus thunbergii', 'species')).toBeUndefined();
    expect(getSpeciesStory('Pinus densiflora', 'genus')).toBeUndefined();
  });
  it('marks only explicitly listed species under the verified notice', () => {
    expect(getSpeciesStory('Sicyos angulatus', 'species')?.designation?.notice).toContain(
      '2025-165',
    );
    expect(getSpeciesStory('Sicyos', 'genus')).toBeUndefined();
    expect(getSpeciesStory('Sicyos other', 'species')).toBeUndefined();
    expect(getSpeciesStory('Forsythia koreana', 'species')?.symbolism).toContain('희망');
  });
  it('shows sourced caution and seasonal context only when available', () => {
    const html = renderToStaticMarkup(
      createElement(SpeciesStory, { scientificName: 'Convallaria keiskei', rank: 'species' }),
    );
    expect(html).toContain('주의가 알려진 식물');
    expect(html).toContain('forest.go.kr');
    expect(html).toContain('전문가 검수 전');
    expect(html).toContain('지역과 날씨');
    expect(
      renderToStaticMarkup(createElement(SpeciesStory, { scientificName: 'Pinus', rank: 'genus' })),
    ).toBe('');
  });
});
