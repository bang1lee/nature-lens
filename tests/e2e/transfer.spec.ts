import AxeBuilder from '@axe-core/playwright';
import {createDecipheriv} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {newObservation,type Observation} from '../../src/lib/domain';
import {encryptTransferText} from '../../src/lib/transfer';
const id='a'.repeat(22),readToken='b'.repeat(43),deleteToken='d'.repeat(43);
test.use({serviceWorkers:'block'});
async function blockRemote(context:BrowserContext,origin:string){
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.fallback():route.abort('blockedbyclient'));
}
test.beforeEach(async({context,baseURL})=>{
 if(!baseURL)throw new Error('Transfer regressions require an explicit local baseURL');
 const url=new URL(baseURL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Transfer regressions only run against the local app');
 await blockRemote(context,url.origin);
});
async function syntheticPhoto(){
 const bytes=await sharp({create:{width:192,height:192,channels:3,background:'#398455'}}).png().toBuffer();
 return 'data:image/png;base64,'+bytes.toString('base64');
}
async function seedObservation(page:Page,record:Observation){
 await page.goto('/board/');await expect(page.getByRole('button',{name:'보관·전달',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>
  (await indexedDB.databases()).some(database=>database.name==='nature-lens-v1'&&database.version===2)
 )).toBe(true);
 await page.evaluate(record=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('nature-lens-v1',2);
  request.onupgradeneeded=()=>reject(new Error('The board must initialize its own database before fixture seeding'));
  request.onerror=()=>reject(request.error);request.onsuccess=()=>{
   const db=request.result,tx=db.transaction('observations','readwrite');tx.objectStore('observations').put(record);
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
  };
 }),record);
 await page.reload();await page.getByRole('button',{name:'보관·전달',exact:true}).click();
}
async function storedObservations(page:Page){
 return page.evaluate(()=>new Promise<Observation[]>((resolve,reject)=>{
  const request=indexedDB.open('nature-lens-v1',2);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('observations','readonly'),read=tx.objectStore('observations').getAll();
   read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);tx.oncomplete=()=>db.close();};
 }));
}
async function api(context:BrowserContext,state:{payload:Uint8Array|null;deleted:boolean;posts:number}){
 await context.route('**/api/capabilities',r=>r.fulfill({json:{localStorage:true,transfer:{available:true,maxBytes:1048576,ttlSeconds:86400},sync:false,identify:false}}));
 await context.route('**/api/transfers**',async r=>{
  const request=r.request(),method=request.method();if(method==='POST'){state.posts++;
   if(request.headers()['content-type']!=='application/octet-stream')return r.fulfill({status:415,json:{error:'unsupported-media-type'}});
   state.payload=new Uint8Array(request.postDataBuffer()!);return r.fulfill({status:201,json:{id,readToken,deleteToken,expiresAt:new Date(Date.now()+86400000).toISOString(),size:state.payload.length}});}
  if(method==='DELETE'){
   if(request.headers().authorization!==`Bearer ${deleteToken}`)return r.fulfill({status:404,json:{error:'not-found'}});
   if(new URL(request.url()).pathname.endsWith('/'+id))state.deleted=true;return r.fulfill({json:{deleted:true}});
  }
  if(request.headers().authorization!==`Bearer ${readToken}`||!state.payload||state.deleted)return r.fulfill({status:404,json:{error:'not-found'}});
  return r.fulfill({contentType:'application/octet-stream',headers:{'X-Transfer-Expires-At':new Date(Date.now()+86400000).toISOString()},body:Buffer.from(state.payload)});
 });
}
test('encrypted transfer uses separate browsers, previews before restore, preserves duplicates and deletes',async({page,browser})=>{
 const state={payload:null as Uint8Array|null,deleted:false,posts:0};await api(page.context(),state);await page.goto('/board/');
 await page.getByRole('button',{name:'예제 불러오기',exact:false}).click();await page.getByRole('button',{name:'보관·전달',exact:true}).click();
 await page.getByRole('button',{name:'전달 준비',exact:true}).click();await expect(page.getByText(/관찰 3건 · 컬렉션 0개/)).toBeVisible();
 await page.getByLabel('전달 링크의 접근과 보관 기간을 확인했습니다').check();await page.getByRole('button',{name:'암호화 링크 만들기',exact:true}).dblclick();
 const link=await page.getByLabel('전달 링크', {exact:true}).inputValue();expect(state.posts).toBe(1);expect(link).toContain('/transfer/#v1.');
 const receiving=await browser.newContext({serviceWorkers:'block'});await blockRemote(receiving,new URL(link).origin);await api(receiving,state);const other=await receiving.newPage();await other.goto(link);
 await expect(other.getByRole('heading',{name:'기록을 가져오기 전에 확인하세요'})).toBeVisible();expect(new URL(other.url()).hash).toBe('');
 await other.getByLabel('초안으로 추가하고 다시 검수해야 함을 확인했습니다').check();await other.getByRole('button',{name:'이 브라우저에 추가하기'}).click();await expect(other.getByRole('heading',{name:'3건을 초안으로 추가했어요'})).toBeVisible();
 await other.goto(link);await other.getByLabel('초안으로 추가하고 다시 검수해야 함을 확인했습니다').check();await other.getByRole('button',{name:'이 브라우저에 추가하기'}).click();await expect(other.getByRole('heading',{name:'0건을 초안으로 추가했어요'})).toBeVisible();
 await page.getByRole('button',{name:'지금 삭제',exact:true}).first().click();await expect(page.getByRole('button',{name:'취소',exact:true})).toBeFocused();await page.getByRole('button',{name:'전달 삭제',exact:true}).click();await expect(page.getByRole('button',{name:'전달 준비',exact:true})).toBeFocused();
 expect(await storedObservations(page)).toHaveLength(3);expect(await storedObservations(other)).toHaveLength(3);
 await other.goto(link);await expect(other.locator('main [role=alert]')).toContainText('만료됐거나 삭제됐거나');await receiving.close();
});
test('wrong key or altered ciphertext cannot reach restore; fragment is removed immediately',async({page})=>{
 const record={...newObservation(),title:'기존 기록 보호',photo:'data:image/jpeg;base64,YWJj'};const sealed=await encryptTransferText(JSON.stringify({version:1,observations:[record],collections:[]}));const other=await encryptTransferText('other');
 const state={payload:sealed.envelope,deleted:false,posts:0};await api(page.context(),state);await page.goto(`/transfer/#v1.${id}.${readToken}.${other.keyB64u}`);
 await expect(page.locator('main [role=alert]')).toContainText('키가 맞지 않거나');expect(new URL(page.url()).hash).toBe('');await expect(page.getByRole('button',{name:'이 브라우저에 추가하기'})).toHaveCount(0);
 state.payload=sealed.envelope.slice();state.payload[state.payload.length-1]^=1;await page.goto(`/transfer/#v1.${id}.${readToken}.${sealed.keyB64u}`);await expect(page.locator('main [role=alert]')).toContainText('키가 맞지 않거나');
});
test('deleting an older transfer preserves the current one-time secret link',async({page})=>{
 const old='e'.repeat(22),state={payload:null as Uint8Array|null,deleted:false,posts:0};await api(page.context(),state);
 await page.addInitScript(({old,deleteToken})=>{localStorage.setItem('nature-lens:transfers:v1',JSON.stringify([{id:old,deleteToken,expiresAt:new Date(Date.now()+86400000).toISOString(),observations:1}]));},{old,deleteToken});
 await page.goto('/board/');await page.getByRole('button',{name:'예제 불러오기',exact:false}).click();await page.getByRole('button',{name:'보관·전달',exact:true}).click();await page.getByRole('button',{name:'전달 준비',exact:true}).click();await page.getByLabel('전달 링크의 접근과 보관 기간을 확인했습니다').check();await page.getByRole('button',{name:'암호화 링크 만들기',exact:true}).click();
 const current=await page.getByLabel('전달 링크',{exact:true}).inputValue();await page.getByRole('button',{name:'지금 삭제',exact:true}).first().focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'취소',exact:true})).toBeFocused();await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(page.getByRole('dialog',{name:'전달을 지금 삭제할까요?'})).not.toBeVisible();await expect(page.getByLabel('전달 링크',{exact:true})).toHaveValue(current);await expect(page.getByLabel('전달 링크',{exact:true})).toBeFocused();
 expect(state.deleted).toBe(false);
});
test('successful upload still exposes its link when local deletion-list storage fails',async({page})=>{
 const state={payload:null as Uint8Array|null,deleted:false,posts:0};await api(page.context(),state);
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='nature-lens:transfers:v1')throw new DOMException('blocked','QuotaExceededError');original.call(this,k,v);};});
 await page.goto('/board/');await page.getByRole('button',{name:'예제 불러오기',exact:false}).click();await page.getByRole('button',{name:'보관·전달',exact:true}).click();await page.getByRole('button',{name:'전달 준비',exact:true}).click();await page.getByLabel('전달 링크의 접근과 보관 기간을 확인했습니다').check();await page.getByRole('button',{name:'암호화 링크 만들기',exact:true}).click();
 await expect(page.getByLabel('전달 링크',{exact:true})).toHaveValue(/\/transfer\/#v1\./);await expect(page.locator('.transfer-panel [role=alert]')).toContainText('전달은 완료됐지만');expect(state.posts).toBe(1);await expect(page.getByRole('button',{name:'지금 삭제',exact:true})).toBeEnabled();
});

test('receive preview makes no writes until consent and restores real photos safely',async({page})=>{
 const record={...newObservation(),title:'산책길의 잎',photo:await syntheticPhoto(),notes:'선명한 잎맥을 관찰했어요'};
 const sealed=await encryptTransferText(JSON.stringify({version:1,observations:[record],collections:[]}));const state={payload:sealed.envelope,deleted:false,posts:0};await api(page.context(),state);
 await page.setViewportSize({width:1440,height:1000});await page.goto(`/transfer/#v1.${id}.${readToken}.${sealed.keyB64u}`);
 await expect(page.getByRole('heading',{name:'기록을 가져오기 전에 확인하세요'})).toBeVisible();
 await expect(page.getByRole('button',{name:'이 브라우저에 추가하기'})).toBeDisabled();
 expect(await page.evaluate(async()=>{const dbs=await indexedDB.databases();return dbs.some(d=>d.name==='nature-lens-v1');})).toBe(false);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations.filter(v=>['critical','serious'].includes(v.impact||''))).toEqual([]);
 await page.screenshot({path:'test-results/transfer-receive-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/transfer-receive-mobile.png',fullPage:true});
 await page.getByLabel('초안으로 추가하고 다시 검수해야 함을 확인했습니다').check();await page.getByRole('button',{name:'이 브라우저에 추가하기'}).click();await expect(page.getByRole('heading',{name:'1건을 초안으로 추가했어요'})).toBeVisible();
 await page.getByRole('link',{name:'관찰 보드로',exact:true}).click();await expect(page.getByRole('button',{name:'산책길의 잎 기록 열기'})).toBeVisible();
});
test('oversized encrypted backup is rejected locally without an upload',async({page})=>{
 const state={payload:null as Uint8Array|null,deleted:false,posts:0};await api(page.context(),state);await page.goto('/board/');
 await page.getByRole('heading',{name:'사진 한 장, 발견 하나'}).waitFor();
 const random=Buffer.alloc(1400000);for(let offset=0;offset<random.length;offset+=65536)crypto.getRandomValues(random.subarray(offset,Math.min(offset+65536,random.length)));
 const record={...newObservation(),title:'파일 백업으로 보관할 큰 사진',photo:'data:image/jpeg;base64,'+random.toString('base64')};
 await page.evaluate(record=>new Promise<void>((resolve,reject)=>{const req=indexedDB.open('nature-lens-v1',2);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('observations','readwrite');tx.objectStore('observations').put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);}),record);
 await page.reload();await page.getByRole('button',{name:'보관·전달',exact:true}).click();await page.getByRole('button',{name:'전달 준비',exact:true}).click();
 await expect(page.locator('.transfer-panel [role=alert]')).toContainText('1MiB');await expect(page.getByRole('button',{name:'암호화 링크 만들기',exact:true})).toHaveCount(0);expect(state.posts).toBe(0);
});

test('a pending photo restore marks its own transfer without replacing a newly opened preview',async({page})=>{
 const photo=await syntheticPhoto();const secondId='f'.repeat(22);
 const first=await encryptTransferText(JSON.stringify({version:1,observations:[{...newObservation(),title:'먼저 받은 잎',photo}],collections:[]}));
 const second=await encryptTransferText(JSON.stringify({version:1,observations:[{...newObservation(),title:'다음에 받은 꽃',photo}],collections:[]}));
 await api(page.context(),{payload:first.envelope,deleted:false,posts:0});
 await page.context().route(`**/api/transfers/${secondId}`,r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from(second.envelope)}));
 await page.addInitScript(()=>{const native=createImageBitmap;let first=true;window.createImageBitmap=(async(...args:Parameters<typeof createImageBitmap>)=>{if(first){first=false;await new Promise<void>(resolve=>{Object.assign(window,{photoStarted:true,releasePhoto:resolve});});}return Reflect.apply(native,window,args);}) as typeof createImageBitmap;});
 await page.goto(`/transfer/#v1.${id}.${readToken}.${first.keyB64u}`);await page.getByLabel('초안으로 추가하고 다시 검수해야 함을 확인했습니다').check();await page.getByRole('button',{name:'이 브라우저에 추가하기'}).click();
 await page.waitForFunction(()=>Boolean((window as unknown as {photoStarted?:boolean}).photoStarted));
 await page.evaluate(hash=>{location.hash=hash;},`#v1.${secondId}.${readToken}.${second.keyB64u}`);await expect(page.getByRole('img',{name:'다음에 받은 꽃'})).toBeVisible();
 await page.evaluate(()=>{(window as unknown as {releasePhoto:()=>void}).releasePhoto();});
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nature-lens:restored-transfers:v1')||'[]'))).toEqual([id]);
 await expect(page.getByRole('img',{name:'다음에 받은 꽃'})).toBeVisible();await expect(page.getByRole('heading',{name:'1건을 초안으로 추가했어요'})).toHaveCount(0);expect(new URL(page.url()).hash).toBe('');
 await page.getByLabel('초안으로 추가하고 다시 검수해야 함을 확인했습니다').check();await page.getByRole('button',{name:'이 브라우저에 추가하기'}).click();await expect(page.getByRole('heading',{name:'1건을 초안으로 추가했어요'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('nature-lens:restored-transfers:v1')||'[]'))).toEqual([id,secondId]);
});

test('production transfer CSP permits local photo decoding but blocks external connections',async({page})=>{
 const policy=readFileSync('public/_headers','utf8').split('Content-Security-Policy: ')[1].trim();
 await page.route('https://transfer-policy.test/',r=>r.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':policy},body:'<!doctype html><html lang="ko"><title>전달 CSP 검사</title><body>사진 복원 검사</body></html>'}));
 let externalRequests=0;await page.route('https://example.net/**',r=>{externalRequests++;return r.fulfill({body:'synthetic external response'});});
 await page.goto('https://transfer-policy.test/');
 const photo=await syntheticPhoto();
 expect(await page.evaluate(async photo=>{try{const blob=await(await fetch(photo)).blob();const image=await createImageBitmap(blob);const width=image.width;image.close();return width;}catch{return 0;}},photo)).toBe(192);
 expect(await page.evaluate(async()=>{try{await fetch('https://example.net/private');return true;}catch{return false;}})).toBe(false);
 expect(externalRequests).toBe(0);
});

test('transfer preparation waits for explicit consent and uploads encrypted photo and notes only',async({page})=>{
 const state={payload:null as Uint8Array|null,deleted:false,posts:0};await api(page.context(),state);
 const record={...newObservation(),title:'암호화 확인용 합성 관찰',photo:await syntheticPhoto(),notes:'SYNTHETIC-NOTE-MUST-NOT-LEAVE-AS-PLAINTEXT'};
 const posts:{url:string;headers:Record<string,string>}[]=[];
 page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/api/transfers'))posts.push({url:request.url(),headers:request.headers()});});
 await seedObservation(page,record);await page.getByRole('button',{name:'전달 준비',exact:true}).click();
 await expect(page.getByText('관찰 1건 · 컬렉션 0개',{exact:true})).toBeVisible();
 const consent=page.getByLabel('전달 링크의 접근과 보관 기간을 확인했습니다'),send=page.getByRole('button',{name:'암호화 링크 만들기',exact:true});
 await expect(consent).not.toBeChecked();await expect(send).toBeDisabled();expect(state.posts).toBe(0);
 await consent.check();await consent.uncheck();await expect(send).toBeDisabled();expect(state.posts).toBe(0);
 await consent.check();await send.click();await expect(page.getByLabel('전달 링크',{exact:true})).toHaveValue(/\/transfer\/#v1\./);
 const link=new URL(await page.getByLabel('전달 링크',{exact:true}).inputValue()),key=link.hash.split('.')[3];
 expect(state.posts).toBe(1);expect(posts).toHaveLength(1);expect(posts[0].headers['content-type']).toBe('application/octet-stream');
 expect(new URL(posts[0].url).hash).toBe('');expect(new URL(posts[0].url).search).toBe('');expect(JSON.stringify(posts)).not.toContain(key);
 const envelope=Buffer.from(state.payload!);expect(envelope.subarray(0,4).toString()).toBe('NLT1');
 expect(envelope.includes(Buffer.from(record.notes))).toBe(false);expect(envelope.includes(Buffer.from(record.photo))).toBe(false);expect(envelope.includes(Buffer.from('data:image/'))).toBe(false);
 // Independent decryption catches a plaintext/gzip-only replacement of app encryption.
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64url'),envelope.subarray(4,16));
 decipher.setAAD(Buffer.from('NLT1'));decipher.setAuthTag(envelope.subarray(-16));
 const restored=JSON.parse(gunzipSync(Buffer.concat([decipher.update(envelope.subarray(16,-16)),decipher.final()])).toString('utf8'));
 expect(restored.observations).toHaveLength(1);expect(restored.observations[0]).toMatchObject({id:record.id,photo:record.photo,notes:record.notes});
 const sent=await page.evaluate(()=>JSON.parse(localStorage.getItem('nature-lens:transfers:v1')||'[]'));
 expect(sent).toHaveLength(1);expect(sent[0]).not.toHaveProperty('key');expect(sent[0]).not.toHaveProperty('readToken');
});

test('failed upload waits for a manual retry and a pending double click creates only one transfer',async({page})=>{
 const state={payload:null as Uint8Array|null,deleted:false,posts:0};await api(page.context(),state);
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});const bodies:Buffer[]=[];
 await page.context().route('**/api/transfers',async route=>{
  if(route.request().method()!=='POST')return route.fallback();state.posts++;bodies.push(route.request().postDataBuffer()!);
  if(state.posts===1)return route.fulfill({status:503,json:{error:'transfer-disabled'}});
  await pending;state.payload=new Uint8Array(bodies.at(-1)!);
  return route.fulfill({status:201,json:{id,readToken,deleteToken,expiresAt:new Date(Date.now()+86400000).toISOString(),size:state.payload.length}});
 });
 await seedObservation(page,{...newObservation(),title:'재시도용 합성 관찰',photo:await syntheticPhoto(),notes:'로컬 재시도 검증'});
 await page.getByRole('button',{name:'전달 준비',exact:true}).click();await page.getByLabel('전달 링크의 접근과 보관 기간을 확인했습니다').check();
 const send=page.getByRole('button',{name:'암호화 링크 만들기',exact:true});await send.click();
 await expect(page.locator('.transfer-panel [role=alert]')).toContainText('자동 재전송하지 않아요');await expect(send).toBeEnabled();
 expect(state.posts).toBe(1);await expect(page.getByLabel('전달 링크',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('nature-lens:transfers:v1')||'[]'))).toEqual([]);
 try{await send.dblclick();await expect.poll(()=>state.posts).toBe(2);await expect(send).toBeDisabled();expect(state.posts).toBe(2);}finally{release();}
 await expect(page.getByLabel('전달 링크',{exact:true})).toHaveValue(/\/transfer\/#v1\./);expect(state.posts).toBe(2);expect(bodies[1]).toEqual(bodies[0]);
 expect(await storedObservations(page)).toHaveLength(1);
 const sent=await page.evaluate(()=>JSON.parse(localStorage.getItem('nature-lens:transfers:v1')||'[]'));expect(sent).toHaveLength(1);
});
