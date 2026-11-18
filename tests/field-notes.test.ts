import { describe, expect, it } from 'vitest';
import { estimatePhotoLight, seasonForMonth } from '../src/lib/field-notes';
import { observationSchema, parseBackup } from '../src/lib/domain';

const record = {
  id: 'one',
  title: '관찰',
  species: '',
  scientificName: '',
  date: '2026-11-18',
  notes: '',
  habitat: '',
  protection: 'unknown',
  consent: false,
  noPeople: false,
  aiAssisted: false,
  status: 'draft',
  sessionId: null,
  photo: 'data:image/png;base64,AAAA',
  demo: false,
  updatedAt: '2026-11-18T00:00:00.000Z',
};
describe('관찰 상태와 계절', () => {
  it('기존 관찰과 새 필드가 있는 백업을 모두 읽는다', () => {
    expect(observationSchema.safeParse(record).success).toBe(true);
    const backup = parseBackup(
      JSON.stringify({
        version: 1,
        observations: [{ ...record, symptoms: '잎이 노래짐', photoLight: 'shade' }],
        collections: [],
      }),
    );
    expect(backup.observations[0]).toMatchObject({ symptoms: '잎이 노래짐', photoLight: 'shade' });
    expect(observationSchema.safeParse({ ...record, photoLight: 'unknown' }).success).toBe(false);
  });
  it('사진 픽셀의 밝기를 추정하고 빈 사진은 거절한다', () => {
    expect(estimatePhotoLight(new Uint8ClampedArray([20, 20, 20, 255]))).toBe('shade');
    expect(estimatePhotoLight(new Uint8ClampedArray([120, 120, 120, 255]))).toBe('partial');
    expect(estimatePhotoLight(new Uint8ClampedArray([220, 220, 220, 255]))).toBe('sun');
    expect(() => estimatePhotoLight(new Uint8ClampedArray([0, 0, 0, 0]))).toThrow();
  });
  it('관찰 월을 계절로 표시한다', () => {
    expect([1, 4, 7, 10].map(seasonForMonth)).toEqual(['겨울', '봄', '여름', '가을']);
  });
});
