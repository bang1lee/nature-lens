import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// One creation per run. Use isolated local D1 for repeated/adversarial tests.
// No tokens, keys, transfer URLs or user data are written to the result artifact.
const target = (process.env.LIVE_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const browser = await chromium.launch();
let sender, receiver, a, b;
const diagnosticErrors=[];
const summary = { target, observations: 3, stages: [], pageErrors: 0 };
try {
  sender = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  receiver = await browser.newContext({ viewport: { width: 390, height: 844 } });
  a = await sender.newPage(); b = await receiver.newPage();
  let posts = 0;
  for (const p of [a, b]) { p.on('pageerror', () => summary.pageErrors++);p.on('console',message=>{if(message.type()==='error')diagnosticErrors.push(message.text().slice(0,220));}); }
  a.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/transfers') posts++; });
  await a.goto(`${target}/board/`);
  await a.getByRole('button', { name: '예제 불러오기', exact: false }).click();
  await a.getByRole('button', { name: '겹겹이 펼쳐진 초록 기록 열기' }).waitFor();
  await a.getByRole('button', { name: '보관·전달', exact: true }).click();
  const prepare = a.getByRole('button', { name: '전달 준비', exact: true });
  await prepare.waitFor();
  await prepare.click();
  await a.getByLabel('전달 링크의 접근과 보관 기간을 확인했습니다').check();
  await a.getByRole('button', { name: '암호화 링크 만들기', exact: true }).click();
  const linkField = a.getByLabel('전달 링크', { exact: true });
  await linkField.waitFor();
  const link = await linkField.inputValue();
  assert.equal(posts, 1, 'exactly one creation request');
  assert.equal(new URL(link).origin, new URL(target).origin, 'same origin link');
  summary.stages.push('real-server-upload');
  await b.goto(link);
  await b.getByRole('heading', { name: '기록을 가져오기 전에 확인하세요' }).waitFor();
  assert.equal(new URL(b.url()).hash, '', 'fragment removed');
  // Both contexts have independent IndexedDB; preview must not write records.
  const before = await b.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('nature-lens-v1', 2);
      req.onupgradeneeded = () => { const d=req.result; if(!d.objectStoreNames.contains('observations'))d.createObjectStore('observations',{keyPath:'id'});if(!d.objectStoreNames.contains('collections'))d.createObjectStore('collections',{keyPath:'id'});if(!d.objectStoreNames.contains('privateLocations'))d.createObjectStore('privateLocations'); };
      req.onerror = () => reject(new Error('storage unavailable'));
      req.onsuccess = () => { const db=req.result; const tx=db.transaction('observations');const count=tx.objectStore('observations').count();count.onsuccess=()=>resolve(count.result);tx.oncomplete=()=>db.close(); };
    });
  });
  assert.equal(before, 0, 'preview does not restore');
  await b.getByLabel('초안으로 추가하고 다시 검수해야 함을 확인했습니다').check();
  await b.getByRole('button', { name: '이 브라우저에 추가하기' }).click();
  await b.getByRole('heading', { name: '3건을 초안으로 추가했어요' }).waitFor();
  summary.stages.push('independent-browser-preview-and-restore');
  await b.goto(`${target}/board/`);
  await b.getByRole('button', { name: '겹겹이 펼쳐진 초록 기록 열기' }).waitFor();
  const stored = await b.evaluate(async () => new Promise((resolve,reject) => {
    const req=indexedDB.open('nature-lens-v1',2);req.onerror=()=>reject(new Error('storage unavailable'));req.onsuccess=()=>{const db=req.result;const tx=db.transaction('observations');const records=tx.objectStore('observations').getAll();records.onsuccess=()=>resolve(records.result.map(r=>({status:r.status,hasPhoto:r.photo.startsWith('data:image/')})));tx.oncomplete=()=>db.close();};
  }));
  assert.equal(stored.length, 3);assert(stored.every(r=>r.status==='draft'&&r.hasPhoto));
  assert(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'mobile has no horizontal overflow');
  await mkdir('test-results', { recursive: true });
  await b.screenshot({ path: 'test-results/live-board-mobile.png', fullPage: true });
  await b.goto(link);
  await b.getByLabel('초안으로 추가하고 다시 검수해야 함을 확인했습니다').check();
  await b.getByRole('button', { name: '이 브라우저에 추가하기' }).click();
  await b.getByRole('heading', { name: '0건을 초안으로 추가했어요' }).waitFor();
  summary.stages.push('duplicate-restore-preserves-existing-records');
  await a.getByRole('button', { name: '지금 삭제', exact: true }).first().click();
  await a.getByRole('button', { name: '전달 삭제', exact: true }).click();
  await b.goto(link);
  await b.getByRole('alert').filter({ hasText: '만료됐거나 삭제됐거나' }).waitFor();
  summary.stages.push('creator-delete-revokes-link');
  await a.goto(`${target}/board/`);
  await a.getByRole('button', { name: '겹겹이 펼쳐진 초록 기록 열기' }).waitFor();
  await a.screenshot({ path: 'test-results/live-board-desktop.png', fullPage: true });
  assert.equal(summary.pageErrors, 0, 'no uncaught page errors');
  await writeFile('test-results/live-transfer-summary.json', JSON.stringify(summary, null, 2));
  console.log('PASS real Worker + D1 + two browsers: encrypted upload, preview, restore 3 draft photos, duplicate preservation, creator deletion, no page errors');
} catch (error) {
  const message = String(error?.message || error).replace(/#v1\.[A-Za-z0-9_.-]+/g, '#[redacted]');
  console.error(message);
  console.error(JSON.stringify(diagnosticErrors));
  if(b)console.error((await b.locator('body').innerText().catch(()=>'' )).replace(/#v1\.[A-Za-z0-9_.-]+/g,'#[redacted]').slice(0,1800));
  process.exitCode = 1;
} finally {
  await sender?.close();await receiver?.close();await browser.close();
}
