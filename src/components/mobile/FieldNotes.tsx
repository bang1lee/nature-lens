'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { preparePhoto } from '@/lib/image';
import type { Observation } from '@/lib/domain';
import { estimatePhotoLight, seasonForMonth, type LightEstimate } from '@/lib/field-notes';
import { readLibrary, saveObservation } from '@/lib/storage';
import './field-notes.css';
import ExpertRequest from './ExpertRequest';

function estimate(photo: string): Promise<LightEstimate> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        if (!context) throw new Error();
        context.drawImage(image, 0, 0, 64, 64);
        resolve(estimatePhotoLight(context.getImageData(0, 0, 64, 64).data));
      } catch {
        reject(new Error('사진의 밝기를 읽을 수 없어요.'));
      }
    };
    image.onerror = () => reject(new Error('사진을 불러올 수 없어요.'));
    image.src = photo;
  });
}

export type FieldNotesHandle = { save: () => Promise<boolean> };
const FieldNotes = forwardRef<
  FieldNotesHandle,
  { record: Observation; onSaved: (record: Observation) => void; onReobserve: () => void }
>(function FieldNotes({ record, onSaved, onReobserve }, ref) {
  const [liveRecord, setLiveRecord] = useState(record);
  const [symptoms, setSymptoms] = useState(record.symptoms ?? '');
  const [phenophase, setPhenophase] = useState<Observation['phenophase'] | ''>(
    record.phenophase ?? '',
  );
  const [light, setLight] = useState<LightEstimate | ''>(record.photoLight ?? '');
  const [photos, setPhotos] = useState<string[]>(record.symptomPhotos ?? []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setPhenophase(record.phenophase ?? '');
    setPhotos(record.symptomPhotos ?? []);
    setLiveRecord(record);
    setSymptoms(record.symptoms ?? '');
    setLight(record.photoLight ?? '');
    setMessage('');
    readLibrary()
      .then(({ observations }) => {
        const latest = observations.find((item) => item.id === record.id);
        if (active && latest && latest.updatedAt !== record.updatedAt) {
          setPhenophase(latest.phenophase ?? '');
          setPhotos(latest.symptomPhotos ?? []);
          setLiveRecord(latest);
          setSymptoms(latest.symptoms ?? '');
          setLight(latest.photoLight ?? '');
        }
      })
      .catch(() => {
        if (active) setMessage('저장된 관찰 내용을 불러오지 못했어요.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [record]);
  async function addPhotos(files: File[]) {
    if (!files.length) return;
    if (files.length + photos.length > 3) {
      setMessage('다른 각도 사진은 한 관찰에 세 장까지 담을 수 있어요.');
      return;
    }
    setBusy(true);
    try {
      const additions: string[] = [];
      for (const file of files) additions.push(await preparePhoto(file));
      setPhotos([...photos, ...additions]);
      setMessage('사진을 담았어요. 관찰 내용을 저장해 주세요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '사진을 읽지 못했어요.');
    } finally {
      setBusy(false);
    }
  }
  async function save(next?: () => void): Promise<boolean> {
    if (busy || loading) return false;
    setBusy(true);
    setMessage('');
    try {
      const storedPhotos = liveRecord.symptomPhotos ?? [];
      const photosChanged =
        photos.length !== storedPhotos.length ||
        photos.some((photo, index) => photo !== storedPhotos[index]);
      const changed = photosChanged ||
        symptoms !== (liveRecord.symptoms ?? '') ||
        light !== (liveRecord.photoLight ?? '') ||
        phenophase !== (liveRecord.phenophase ?? '');
      if (!changed) {
        next?.();
        return true;
      }
      const updated: Observation = {
        ...liveRecord,
        symptoms,
        symptomPhotos: photos.length ? photos : undefined,
        status: 'draft',
        ...(light ? { photoLight: light } : {}),
      };
      if (!light) delete updated.photoLight;
      if (phenophase) updated.phenophase = phenophase;
      else delete updated.phenophase;
      const saved = await saveObservation(updated, liveRecord.updatedAt);
      setLiveRecord(saved);
      onSaved(saved);
      setMessage('관찰 내용을 저장했어요.');
      if (next) next();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장하지 못했어요.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  useImperativeHandle(ref, () => ({ save: () => save() }));
  async function measure() {
    setBusy(true);
    setMessage('');
    try {
      setLight(await estimate(record.photo));
      setMessage('사진 밝기를 추정했어요. 현장 상황에 맞게 고친 뒤 저장해 주세요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '밝기를 추정하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="m-field-notes" aria-label="관찰 상태와 계절 미션">
      <fieldset disabled={loading || busy}>
        <legend>관찰 상태</legend>
        <p>
          {record.date.slice(5, 7)}월 · {seasonForMonth(Number(record.date.slice(5, 7)))} 관찰.
          계절에 따른 변화일 수도 있어요. 병을 진단하는 기능은 아니에요.
        </p>
        <label>
          관찰한 생장 단계
          <select
            value={phenophase}
            onChange={(e) => setPhenophase(e.target.value as Observation['phenophase'] | '')}
          >
            <option value="">기록하지 않음</option>
            <option value="bud">꽃봉오리</option>
            <option value="flower">꽃</option>
            <option value="fruit">열매</option>
          </select>
        </label>
        <p>직접 본 모습만 선택해 주세요. 이 기록은 이 기기에 저장돼요.</p>
        <label>
          자주 보이는 변화 선택
          <select
            value=""
            onChange={(e) => {
              if (e.target.value)
                setSymptoms((previous) =>
                  previous ? `${previous}, ${e.target.value}`.slice(0, 1000) : e.target.value,
                );
            }}
          >
            <option value="">선택해 메모에 추가</option>
            <option>잎이 노랗게 변함</option>
            <option>잎에 반점</option>
            <option>잎이 시듦</option>
            <option>잎 가장자리가 마름</option>
          </select>
        </label>
        <label>
          눈에 보이는 변화
          <textarea
            maxLength={1000}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="잎의 색, 반점, 시든 부분 등을 적어 보세요"
          />
        </label>
        <label>
          다른 각도 사진
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={photos.length === 3}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              void addPhotos(files);
            }}
          />
        </label>
        <p>
          잎 앞뒷면과 식물 전체를 세 장까지 담을 수 있어요. 이 사진은 공개 피드에 보내지 않아요.
        </p>
        {photos.length > 0 && (
          <ul className="m-field-photos">
            {photos.map((photo, index) => (
              <li key={index}>
                <img src={photo} alt={`다른 각도 관찰 사진 ${index + 1}`} />
                <button
                  type="button"
                  aria-label={`사진 ${index + 1} 빼기`}
                  onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}
        <label>
          사진 밝기 추정
          <select value={light} onChange={(e) => setLight(e.target.value as LightEstimate | '')}>
            <option value="">선택하지 않음</option>
            <option value="shade">그늘</option>
            <option value="partial">반그늘</option>
            <option value="sun">양지</option>
          </select>
        </label>
        <p>
          사진 노출과 촬영 조건에 영향을 받는 참고용 추정이에요. 실제 현장에 맞게 바꿀 수 있어요.
        </p>
        <div className="m-field-actions">
          <button type="button" disabled={busy || !record.photo} onClick={measure}>
            사진으로 추정하기
          </button>
          <button type="button" disabled={busy} onClick={() => void save()}>
            관찰 내용 저장
          </button>
        </div>
        <button type="button" onClick={() => void save(onReobserve)}>
          다른 각도 사진으로 이어서 관찰하기
        </button>
      </fieldset>
      {message && <p role="status">{message}</p>}
      <ExpertRequest observationId={record.id} demo={record.demo} />
    </section>
  );
});
export default FieldNotes;
