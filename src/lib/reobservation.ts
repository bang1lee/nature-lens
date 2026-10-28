import type { Observation } from './domain';

export type ReobservationContext = Required<Pick<Observation, 'specimenId' | 'previousObservationId'>>;

/** Linking is a user decision; this deliberately carries no photo, species or consent. */
export function reobservationContext(record: Observation): ReobservationContext {
  return { specimenId: record.specimenId || record.id, previousObservationId: record.id };
}

/** A missing ancestor does not break an explicitly linked specimen timeline. */
export function observationTimeline(records: readonly Observation[], record: Observation): Observation[] {
  const specimenId = record.specimenId || record.id;
  return records
    .filter(item => (item.specimenId || item.id) === specimenId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
}
