import { z } from 'zod';
export const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기도','경기 안성','경기 수원','강원도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','경남 거제','제주도'] as const;
export const regionLabelSchema = z.enum(REGIONS);
const rounded = (min: number, max: number) => z.number().min(min).max(max).refine(n => Math.abs(n * 10 - Math.round(n * 10)) < 0.000001);
export const publicGridSchema = z.object({ latitude: rounded(-90, 90), longitude: rounded(-180, 180) }).strict();
export const privateLocationSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0), capturedAt: z.iso.datetime() }).strict();
export type PrivateLocation = z.infer<typeof privateLocationSchema>;
export type PublicGrid = z.infer<typeof publicGridSchema>;
export function coarsePoint(latitude: number, longitude: number): PublicGrid {
 return publicGridSchema.parse({latitude: Number(latitude.toFixed(1)), longitude: Number(longitude.toFixed(1))});
}
export function publicLocation(o: {region?: string; protection: string; publicGrid?: PublicGrid}) {
 const label = o.region || '지역 비공개';
 if (o.protection !== 'common' || !o.publicGrid) return {label, hidden: true};
 const grid = publicGridSchema.safeParse(o.publicGrid);
 return grid.success ? {label, hidden: false, grid: grid.data} : {label, hidden: true};
}
