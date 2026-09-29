'use client';
import { useRef, useState } from 'react';
import { createBackup, downloadBackupFile, restoreBackupFile, backupErrorMessage } from '@/lib/backup';
export default function BackupPanel({onRestored}:{onRestored:()=>Promise<void>}) {
 const input=useRef<HTMLInputElement>(null); const lock=useRef(false);
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');const [error,setError]=useState('');
 async function act(file?:File){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');
 try{if(file){const n=await restoreBackupFile(file);setMessage(`${n}건을 초안으로 복원했습니다. 중복 기록은 유지합니다.`);try{await onRestored();}catch{setError('복원은 완료됐지만 목록 갱신에 실패했습니다. 화면을 다시 열어 주세요.');}}
 else{const b=await createBackup();downloadBackupFile(b.blob,b.filename);setMessage('백업 다운로드를 요청했어요. 파일 앱에서 저장 여부를 확인해 주세요.');}}
 catch(e){setError(backupErrorMessage(e));}finally{lock.current=false;setBusy(false);if(input.current)input.current.value='';}}
 return <section className="m-settings-note"><h2>기록을 안전하게 보관하기</h2><p>사진과 메모를 파일로 보관하세요. 정밀 GPS는 포함되지 않습니다. 복원한 기록은 다시 검수해야 합니다.</p><div className="m-cloud-actions"><button className="m-primary" disabled={busy} onClick={()=>void act()}>전체 백업 내려받기</button><button className="m-secondary" disabled={busy} onClick={()=>input.current?.click()}>백업 복원하기</button></div><input ref={input} aria-label="모바일 백업 파일" type="file" accept=".json,application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void act(f);}}/><p className="m-muted">최대 50MB · 작업실 45MB / 500건 / 100컬렉션</p><p role="status">{busy?'처리 중이에요…':message}</p>{error&&<p role="alert" className="m-error">{error}</p>}</section>;
}
