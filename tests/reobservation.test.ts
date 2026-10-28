import { describe, expect, it } from 'vitest';
import { newObservation, observationSchema, parseBackup, type Observation } from '../src/lib/domain';
import { observationTimeline, reobservationContext } from '../src/lib/reobservation';

const original: Observation = {
  id: 'root', title: '소나무', species: '소나무', scientificName: 'Pinus densiflora',
  date: '2026-09-01', notes: '첫 관찰', habitat: '숲', protection: 'unknown',
  consent: true, noPeople: true, aiAssisted: true, status: 'reviewed', sessionId: null,
  photo: 'data:image/jpeg;base64,YQ==', demo: false, updatedAt: '2026-09-01T10:00:00.000Z',
};
const followup: Observation = {
  ...original, id: 'second', date: '2026-10-01', updatedAt: '2026-10-01T10:00:00.000Z',
  ...reobservationContext(original),
};
const backup = (observations: Observation[]) => JSON.stringify({ version: 1, observations, collections: [] });

describe('explicit specimen linkage', () => {
  it('reads legacy records and v1 backups without inventing linkage', () => {
    expect(observationSchema.parse(original).specimenId).toBeUndefined();
    expect(parseBackup(backup([original])).observations[0]).toEqual({ ...original, status: 'draft' });
  });
  it('preserves new optional linkage in v1 backups while resetting review status', () => {
    expect(parseBackup(backup([original, followup])).observations[1]).toEqual({ ...followup, status: 'draft' });
    expect(() => observationSchema.parse({ ...original, specimenId: '' })).toThrow();
    expect(() => observationSchema.parse({ ...original, previousObservationId: 'x'.repeat(101) })).toThrow();
  });
  it('creates context from the selected observation without inheriting content or permissions', () => {
    const context = reobservationContext(followup);
    expect(context).toEqual({ specimenId: 'root', previousObservationId: 'second' });
    const fresh = { ...newObservation(), ...context };
    expect(fresh.photo).toBe('');
    expect(fresh.species).toBe('');
    expect(fresh.consent).toBe(false);
    expect(fresh.status).toBe('draft');
  });
  it('includes the legacy root and sorts by observation date, then update time without mutating input', () => {
    const later = { ...followup, id: 'third', updatedAt: '2026-10-01T11:00:00.000Z' };
    const records = [later, followup, original];
    expect(observationTimeline(records, followup).map(o => o.id)).toEqual(['root', 'second', 'third']);
    expect(records.map(o => o.id)).toEqual(['third', 'second', 'root']);
  });
  it('keeps the group when the root or intermediate observation has been deleted', () => {
    const third = { ...followup, id: 'third', ...reobservationContext(followup) };
    expect(parseBackup(backup([third])).observations[0].previousObservationId).toBe('second');
    expect(observationTimeline([third], third).map(o => o.id)).toEqual(['third']);
    expect(observationTimeline([followup, third], third)).toHaveLength(2);
  });
  it('never groups records by the same species, collection, title or previous id alone', () => {
    const unrelated = { ...original, id: 'other' };
    const onlyPrevious = { ...unrelated, id: 'previous-only', previousObservationId: 'root' };
    const explicitOther = { ...original, id: 'different-root', specimenId: 'elsewhere' };
    const records = [original, unrelated, onlyPrevious, explicitOther, followup];
    expect(observationTimeline(records, original).map(o => o.id)).toEqual(['root', 'second']);
    expect(observationTimeline(records, unrelated).map(o => o.id)).toEqual(['other']);
  });
});
