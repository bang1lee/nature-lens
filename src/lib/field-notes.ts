export type LightEstimate = 'shade' | 'partial' | 'sun';

/** Pixel brightness is only a rough photo-based cue, not a light-meter reading. */
export function estimatePhotoLight(pixels: Uint8ClampedArray): LightEstimate {
  let sum = 0;
  let count = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    count++;
  }
  if (!count) throw new Error('사진의 밝기를 읽을 수 없어요.');
  const mean = sum / count;
  return mean < 85 ? 'shade' : mean < 170 ? 'partial' : 'sun';
}

export function seasonForMonth(month: number): string {
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}
