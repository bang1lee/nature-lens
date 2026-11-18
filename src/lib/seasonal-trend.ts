import type { Observation } from './domain';
export const phaseLabels = { bud: '꽃봉오리', flower: '꽃', fruit: '열매' } as const;
export function seasonalTrend(records: Observation[], scientificName: string) {
  const name = scientificName.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!/^[a-z-]+ [a-z-]+$/.test(name)) return [];
  return records
    .filter(
      (item) =>
        !item.demo &&
        item.phenophase &&
        item.scientificName.trim().replace(/\s+/g, ' ').toLowerCase() === name &&
        /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(item.date),
    )
    .map((item) => ({
      date: item.date,
      month: Number(item.date.slice(5, 7)),
      phase: item.phenophase!,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
