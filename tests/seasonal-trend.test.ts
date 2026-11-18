import { describe, it, expect } from 'vitest';
import { seasonalTrend } from '../src/lib/seasonal-trend';
import { observationSchema } from '../src/lib/domain';
import type { Observation } from '../src/lib/domain';
const base = {
  scientificName: 'Pinus densiflora',
  date: '2026-04-10',
  demo: false,
  notes: '꽃이 피었어요',
  species: '소나무',
} as Observation;
describe('local seasonal trend', () => {
  it('counts only explicit stages for the exact scientific name and preserves dated samples', () => {
    const samples = seasonalTrend(
      [
        { ...base, phenophase: 'flower' },
        { ...base, date: '2025-04-01', phenophase: 'fruit' },
        { ...base },
        { ...base, scientificName: 'Pinus thunbergii', phenophase: 'bud' },
        { ...base, demo: true, phenophase: 'flower' },
      ],
      'Pinus densiflora',
    );
    expect(samples).toEqual([
      { date: '2025-04-01', month: 4, phase: 'fruit' },
      { date: '2026-04-10', month: 4, phase: 'flower' },
    ]);
    expect(seasonalTrend([{ ...base, phenophase: 'flower' }], 'Pinus')).toEqual([]);
  });
  it('rejects invalid stages while allowing old records to omit them', () => {
    const phase = observationSchema.shape.phenophase;
    expect(phase.safeParse(undefined).success).toBe(true);
    expect(phase.safeParse('flower').success).toBe(true);
    expect(phase.safeParse('inferred').success).toBe(false);
  });
});
