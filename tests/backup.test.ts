import 'fake-indexeddb/auto';
import { it, expect } from 'vitest';
import { createBackup, restoreBackupFile, backupErrorMessage } from '../src/lib/backup';
import { saveObservation, readLibrary } from '../src/lib/storage';
import type { Observation } from '../src/lib/domain';

const photo = 'data:image/jpeg;base64,YQ==';
const base: Observation = { id: 'b1', title: '잎', species: '', scientificName: '', date: '2026-09-29', notes: '', habitat: '', protection: 'unknown', consent: true, noPeople: true, aiAssisted: false, status: 'reviewed', sessionId: null, photo, demo: false, updatedAt: '2026-09-29T00:00:00.000Z' };
const fileOf = (text: string) => new File([text], 'b.json', { type: 'application/json' });
const passthroughPrepare = async () => photo;

it('exports without private GPS and restores as drafts with re-encoded photos', async () => {
  await saveObservation(base, null, { latitude: 37.123456, longitude: 127.654321, accuracy: 5, capturedAt: '2026-09-29T00:00:00.000Z' });
  const { blob, observations } = await createBackup();
  const text = await blob.text();
  expect(observations).toBe(1);
  expect(text).not.toContain('37.123456');
  expect(text).not.toContain('accuracy');
  const seen: string[] = [];
  const added = await restoreBackupFile(fileOf(JSON.stringify({ version: 1, observations: [{ ...base, id: 'b2' }], collections: [] })), async f => { seen.push(f.type); return photo; });
  expect(added).toBe(1);
  expect(seen).toEqual(['image/jpeg']);
  const restored = (await readLibrary()).observations.find(o => o.id === 'b2')!;
  expect(restored.status).toBe('draft');
});

it('leaves the library untouched for invalid, oversized, tampered or failing-photo backups', async () => {
  const before = JSON.stringify((await readLibrary()).observations.map(o => o.id).sort());
  await expect(restoreBackupFile(fileOf('not json'), passthroughPrepare)).rejects.toThrow();
  await expect(restoreBackupFile(fileOf(JSON.stringify({ version: 1, observations: [{ ...base, id: 'x', extra: 1 }], collections: [] })), passthroughPrepare)).rejects.toThrow();
  await expect(restoreBackupFile(fileOf(JSON.stringify({ version: 1, observations: [{ ...base, id: 'y' }, { ...base, id: 'z' }], collections: [] })), async () => { throw new Error('사진을 읽을 수 없습니다.'); })).rejects.toThrow('사진');
  const big = Object.assign(fileOf('{}'), {}); Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 + 1 });
  await expect(restoreBackupFile(big, passthroughPrepare)).rejects.toThrow('50MB');
  expect(JSON.stringify((await readLibrary()).observations.map(o => o.id).sort())).toBe(before);
});

it('keeps duplicate ids and shows a safe message for schema errors', async () => {
  const again = await restoreBackupFile(fileOf(JSON.stringify({ version: 1, observations: [{ ...base, id: 'b2' }], collections: [] })), passthroughPrepare);
  expect(again).toBe(0);
  const schemaError = await restoreBackupFile(fileOf('{"version":2}'), passthroughPrepare).catch(e => e);
  expect(backupErrorMessage(schemaError)).toContain('올바른 Nature Lens 백업');
  expect(backupErrorMessage(new Error('한도 초과'))).toBe('한도 초과');
});
