import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PublicSpeciesDetail from '../src/components/mobile/PublicSpeciesDetail';
import { getSpeciesStory } from '../src/lib/species-stories';

describe('public species detail', () => {
  it('renders supported sourced story and safely separates observations from location', () => {
    const story = getSpeciesStory('Acer palmatum', 'species');
    const html = renderToStaticMarkup(
      React.createElement(PublicSpeciesDetail, {
        scientificName: 'Acer palmatum',
        observations: 2,
        story,
      }),
    );
    expect(html).toContain('종 상세 목차');
    expect(html).toContain('계절에 따라 살펴보기');
    expect(html).toContain('North Carolina State University');
    expect(html).toContain('2건');
    expect(html).toContain('위치는 이 페이지에 표시하지 않아요');
    expect(html).not.toContain('<img');
  });
  it('shows empty sections when no sourced information is available', () => {
    const html = renderToStaticMarkup(
      React.createElement(PublicSpeciesDetail, {
        scientificName: 'Unknown example',
        observations: 1,
      }),
    );
    expect(html).toContain('확인된 종');
    expect(html).toContain('종 이야기가 없어요');
    expect(html).toContain('계절 관찰 정보가 없어요');
    expect(html).toContain('주의 자료가 아직 없어요');
    expect(html).toContain('출처가 아직 없어요');
  });
  it('uses the sourced Korean name when available', () => {
    const html = renderToStaticMarkup(
      React.createElement(PublicSpeciesDetail, {
        scientificName: 'Pinus koraiensis',
        observations: 1,
        story: getSpeciesStory('Pinus koraiensis', 'species'),
      }),
    );
    expect(html).toContain('잣나무');
    expect(html).toContain('산림청');
  });
  it('shows sourced warning when available', () => {
    const html = renderToStaticMarkup(
      React.createElement(PublicSpeciesDetail, {
        scientificName: 'Convallaria keiskei',
        observations: 1,
        story: getSpeciesStory('Convallaria keiskei', 'species'),
      }),
    );
    expect(html).toContain('주의가 알려진 식물');
    expect(html).toContain('북부지방산림청');
  });
});
