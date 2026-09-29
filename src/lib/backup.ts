import { parseBackup } from './domain';
import { readLibrary, restoreLibrary } from './storage';
import { preparePhoto } from './image';

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export type PhotoPreparer = (file: File) => Promise<string>;

export async function createBackup(now = new Date()): Promise<{ blob: Blob; filename: string; observations: number }> {
  const data = await readLibrary();
  const blob = new Blob([JSON.stringify({ version: 1, observations: data.observations, collections: data.collections })], { type: 'application/json' });
  return { blob, filename: `nature-lens-backup-${now.toISOString().slice(0, 10)}.json`, observations: data.observations.length };
}

export function downloadBackupFile(blob: Blob, filename: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url; link.download = filename; link.rel = 'noopener';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function restoreBackupFile(file: File, prepare: PhotoPreparer = preparePhoto): Promise<number> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('50MB 이하의 파일을 선택해 주세요.');
  const data = parseBackup(await file.text());
  for (const observation of data.observations) {
    const blob = await (await fetch(observation.photo)).blob();
    observation.photo = await prepare(new File([blob], 'imported-photo', { type: blob.type }));
  }
  return restoreLibrary(data);
}

export function backupErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length < 150 && !error.name.includes('Zod')
    ? error.message
    : '올바른 Nature Lens 백업 파일이 아닙니다. 기존 기록은 변경하지 않았습니다.';
}
