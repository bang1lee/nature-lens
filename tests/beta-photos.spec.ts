import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const userA='11111111-1111-4111-8111-111111111111';
const userB='22222222-2222-4222-8222-222222222222';
const guest='33333333-3333-4333-8333-333333333333';
const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};

function session(id:string,anonymous=false){
  const expires=Math.floor(Date.now()/1000)+3600;
  const access_token=`${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:expires,role:'authenticated'})).toString('base64url')}.test`;
  return {access_token,refresh_token:'test',expires_at:expires,expires_in:3600,token_type:'bearer',user:{id,is_anonymous:anonymous,aud:'authenticated',role:'authenticated',...(anonymous?{}:{email:'test@example.org'}),app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
}
type Row={id:string;owner_id:string;local_id:string;photo_path:string;photo_sha256:string;record:Record<string,unknown>;state:string;published_at:string|null};
type FinalizeBody={p_id:string;p_expected_record:Record<string,unknown>;p_new_record:Record<string,unknown>;p_photo_sha256:string};
function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>`${JSON.stringify(key)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
function server(){
  const rows:Row[]=[];
  const photos=new Map<string,Buffer>();
  const posted:Record<string,unknown>[]=[];
  const identified:Record<string,unknown>[]=[];
  const signupRequests:Record<string,unknown>[]=[];
  const finalizations:{body:FinalizeBody;owner:string;accepted:boolean}[]=[];
  const requests:string[]=[];
  let nextConflict:'staging'|'published'|null=null,patchAttempts=0;
  let uploadAttempts=0;
  let failFirstUpload=false;
  let holdUpload=false,holdIdentify=false;
  let releaseUpload=()=>{},releaseIdentify=()=>{},uploadStarted=()=>{},identifyStarted=()=>{};
  const uploadHeld=new Promise<void>(resolve=>{uploadStarted=resolve;});
  const uploadGate=new Promise<void>(resolve=>{releaseUpload=resolve;});
  const identifyHeld=new Promise<void>(resolve=>{identifyStarted=resolve;});
  const identifyGate=new Promise<void>(resolve=>{releaseIdentify=resolve;});
  let holdOwner:string|null=null;
  let releaseHeld=()=>{};
  let heldRequest=()=>{};
  const held=new Promise<void>(resolve=>{heldRequest=resolve;});
  const gate=new Promise<void>(resolve=>{releaseHeld=resolve;});
  return {rows,photos,posted,identified,signupRequests,finalizations,requests,held,releaseHeld,uploadHeld,identifyHeld,releaseUpload,releaseIdentify,holdUpload:()=>{holdUpload=true;},holdIdentify:()=>{holdIdentify=true;},failUpload:()=>{failFirstUpload=true;},conflictNextFinalize:(kind:'staging'|'published')=>{nextConflict=kind;},hold:(id:string)=>{holdOwner=id;},get uploadAttempts(){return uploadAttempts;},get patchAttempts(){return patchAttempts;},async attach(context:BrowserContext){
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),method=request.method();
      if(url.hostname==='127.0.0.1'&&url.port==='3142')return route.continue();
      if(method==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.hostname==='127.0.0.1'&&url.port==='8787'){
        if(url.pathname==='/capabilities')return route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'},headers});
        if(url.pathname==='/identify'){identified.push(request.postDataJSON());if(holdIdentify){identifyStarted();await identifyGate;}return route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'test',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true},headers});}
      }
      if(url.hostname!=='mock.supabase.co')return route.abort();
      const token=request.headers().authorization?.split(' ')[1]||'';
      let uid=userA;
      try{uid=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub||userA;}catch{}
      if(url.pathname==='/auth/v1/user')return route.fulfill({json:session(uid,uid===guest).user,headers});
      if(url.pathname==='/auth/v1/signup'){signupRequests.push(request.postDataJSON());return route.fulfill({json:session(guest,true),headers});}
      if(url.pathname==='/auth/v1/otp')return route.fulfill({json:{},headers});
      if(url.pathname==='/auth/v1/verify')return route.fulfill({json:session(userA),headers});
      if(url.pathname==='/rest/v1/beta_public_feed')return route.fulfill({json:rows.filter(r=>r.state==='published').map(r=>({id:r.id,title:r.record.title,species:r.record.species,observed_on:r.record.date,notes:r.record.notes,photo_path:r.photo_path,published_at:r.published_at})),headers});
      if(url.pathname==='/rest/v1/rpc/finalize_beta_public_observation'&&method==='POST'){
        const body=request.postDataJSON() as FinalizeBody,row=rows.find(r=>r.id===body.p_id);
        if(row&&nextConflict){row.record={...row.record,notes:'다른 탭의 합성 메모'};if(nextConflict==='published'){row.state='published';row.published_at=new Date().toISOString();}nextConflict=null;}
        const accepted=!!row&&row.owner_id===uid&&row.state==='staging'&&row.photo_sha256===body.p_photo_sha256&&canonical(row.record)===canonical(body.p_expected_record)&&photos.has(row.photo_path);
        if(accepted&&row){row.record=structuredClone(body.p_new_record);row.state='published';row.published_at=new Date().toISOString();}
        finalizations.push({body,owner:uid,accepted});requests.push('finalize');
        return route.fulfill({json:accepted,headers});
      }
      if(url.pathname==='/rest/v1/beta_public_observations'){
        if(method==='POST'){
          const body=request.postDataJSON() as Omit<Row,'state'|'published_at'>;
          if(body.owner_id!==uid)return route.fulfill({status:403,json:{message:'not owner'},headers});
          if(rows.some(r=>r.owner_id===uid&&r.local_id===body.local_id))return route.fulfill({status:409,json:{code:'23505'},headers});
          posted.push(body as unknown as Record<string,unknown>);
          const row={...body,owner_id:uid,state:'staging',published_at:null};rows.push(row);
          return route.fulfill({status:201,json:row,headers});
        }
        if(method==='PATCH'){patchAttempts++;return route.fulfill({status:403,json:{message:'updates not granted'},headers});}
        if(method==='GET')requests.push('read');
        const owner=url.searchParams.get('owner_id')?.replace('eq.','');
        if(method==='GET'&&owner===holdOwner&&url.searchParams.get('state')){heldRequest();await gate;}
        const filtered=rows.filter(r=>r.owner_id===uid&&(!owner||r.owner_id===owner)&&(!url.searchParams.has('id')||r.id===url.searchParams.get('id')?.replace('eq.',''))&&(!url.searchParams.has('local_id')||r.local_id===url.searchParams.get('local_id')?.replace('eq.',''))&&(!url.searchParams.has('state')||r.state===url.searchParams.get('state')?.replace('eq.','')));
        return route.fulfill({json:filtered,headers});
      }
      if(url.pathname.startsWith('/storage/v1/object/')){
        const path=url.pathname.split('/').at(-1)!;
        if(method==='POST'){
          uploadAttempts++;
          if(holdUpload){holdUpload=false;uploadStarted();await uploadGate;}
          if(failFirstUpload&&uploadAttempts===1)return route.fulfill({status:503,json:{message:'mock unavailable'},headers});
          if(!rows.some(r=>r.owner_id===uid&&r.state==='staging'&&r.photo_path===path))return route.fulfill({status:403,json:{message:'not owner'},headers});
          if(photos.has(path))return route.fulfill({status:409,json:{message:'already exists'},headers});
          const body=request.postDataBuffer()!;
          const start=body.indexOf(Buffer.from([0xff,0xd8]));
          const end=body.lastIndexOf(Buffer.from([0xff,0xd9]));
          photos.set(path,start>=0&&end>=start?body.subarray(start,end+2):body);
          return route.fulfill({json:{Key:path},headers});
        }
        const photo=photos.get(path);
        return photo?route.fulfill({status:200,body:photo,contentType:'image/jpeg',headers}):route.fulfill({status:404,json:{message:'not found'},headers});
      }
      return route.fulfill({json:[],headers});
    });
  }};
}

async function seed(context:BrowserContext,id:string){await context.addInitScript(value=>localStorage.setItem('sb-mock-auth-token',JSON.stringify(value)),session(id));}
async function capture(page:Page){
  await page.goto('/mobile/');
  await page.getByRole('button',{name:'촬영',exact:true}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
  await expect(page.getByLabel('공개 베타 사진 저장')).toBeVisible();
}
async function holdObservations(page:Page){
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const open=indexedDB.open('nature-lens-v1',2);open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result,tx=db.transaction(['observations','privateLocations'],'readwrite');let holding=true;
      (window as typeof window&{releaseObservationLock?:()=>void}).releaseObservationLock=()=>{holding=false;};
      const keepOpen=()=>{const request=tx.objectStore('observations').get('__hold__');request.onsuccess=()=>{if(holding)keepOpen();};};
      tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);keepOpen();resolve();};
  }));
}
async function releaseObservations(page:Page){await page.evaluate(()=>(window as typeof window&{releaseObservationLock?:()=>void}).releaseObservationLock?.());}

test('publishing requires both confirmations; failed upload retries without duplicates and is recoverable',async({browser})=>{
  const mock=server();mock.failUpload();
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3142'});await seed(context,userA);await mock.attach(context);
  const page=await context.newPage();await capture(page);
  const panel=page.getByLabel('공개 베타 사진 저장'),publish=panel.getByRole('button',{name:'공개로 저장'});
  await page.setViewportSize({width:320,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('.beta-publish').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({width:390,height:844});
  await expect(publish).toBeDisabled();expect(mock.posted).toHaveLength(0);
  await panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await expect(publish).toBeDisabled();expect(mock.posted).toHaveLength(0);
  await panel.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await publish.click();
  await expect(panel.getByRole('alert')).toContainText('사진 전송을 완료하지 못했어요');
  expect(mock.rows).toHaveLength(1);expect(mock.rows[0].state).toBe('staging');
  const metadata=mock.posted[0].record as Record<string,unknown>;
  expect(metadata).not.toHaveProperty('email');expect(metadata).not.toHaveProperty('region');expect(metadata).not.toHaveProperty('publicGrid');expect(metadata).not.toHaveProperty('photo');
  await publish.click();await expect(panel.getByRole('status')).toContainText('공개 베타에 저장했어요');
  expect(mock.rows).toHaveLength(1);expect(mock.uploadAttempts).toBe(2);expect(mock.rows[0].state).toBe('published');expect(mock.signupRequests).toHaveLength(0);
  await page.getByRole('button',{name:'내 기록 보기'}).click();
  const again=page.getByLabel('공개 베타 사진 저장');
  await again.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await again.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await again.getByRole('button',{name:'공개로 저장'}).click();
  await expect(again.getByRole('status')).toContainText('이미 공개 베타에 저장된 사진');
  expect(mock.rows).toHaveLength(1);expect(mock.uploadAttempts).toBe(2);
  // The Next dev badge overlaps this tab in a narrow viewport; exercise its keyboard path.
  await page.getByRole('button',{name:'홈',exact:true}).press('Enter');
  await expect(page.getByRole('heading',{name:'함께 남긴 사진'})).toBeVisible();
  await expect(page.locator('.beta-feed-grid article')).toHaveCount(1);
  const fresh=await browser.newContext({baseURL:'http://127.0.0.1:3142'});await seed(fresh,userA);await mock.attach(fresh);
  const second=await fresh.newPage();await second.goto('/mobile/');await second.getByRole('button',{name:'내 기록',exact:true}).click();
  const mine=second.getByLabel('서버에 저장한 내 사진');
  await mine.getByRole('button',{name:'이 기기로 가져오기'}).click();
  await expect(mine.getByText('이 기기에 있음')).toBeVisible();
  await expect(second.getByRole('button',{name:'오늘 만난 자연 기록 열기'})).toBeVisible();
  await fresh.close();await context.close();
});

test('a guest explicitly consents, uploads without email, retries, and restores in the same browser',async({browser,context,page})=>{
  const mock=server();mock.failUpload();await mock.attach(context);await capture(page);
  const panel=page.getByLabel('공개 베타 사진 저장');
  await expect(panel.getByText('사진과 기록이 누구에게나 공개돼요.',{exact:false})).toBeVisible();
  const publish=panel.getByRole('button',{name:'공개로 저장'});
  await expect(publish).toBeDisabled();
  expect(mock.signupRequests).toHaveLength(0);expect(mock.posted).toHaveLength(0);expect(mock.uploadAttempts).toBe(0);
  await panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await expect(publish).toBeDisabled();
  await panel.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  expect(mock.signupRequests).toHaveLength(0);expect(mock.posted).toHaveLength(0);expect(mock.uploadAttempts).toBe(0);
  await publish.click();
  await expect(panel.getByRole('alert')).toContainText('사진 전송을 완료하지 못했어요');
  expect(mock.signupRequests).toHaveLength(1);expect(mock.signupRequests[0]).not.toHaveProperty('email');
  expect(mock.posted).toHaveLength(1);expect(mock.rows[0].owner_id).toBe(guest);
  expect(mock.posted[0].record).not.toHaveProperty('email');
  await publish.click();await expect(panel.getByRole('status')).toContainText('공개 베타에 저장했어요');
  expect(mock.signupRequests).toHaveLength(1);expect(mock.rows).toHaveLength(1);expect(mock.uploadAttempts).toBe(2);
  const uploaded=mock.photos.get(mock.rows[0].photo_path)!;
  expect(uploaded.length).toBeGreaterThan(100);expect(uploaded.subarray(0,2)).toEqual(Buffer.from([0xff,0xd8]));expect(uploaded.subarray(-2)).toEqual(Buffer.from([0xff,0xd9]));
  await page.getByRole('button',{name:'내 기록 보기'}).click();
  const again=page.getByLabel('공개 베타 사진 저장');
  await again.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await again.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await again.getByRole('button',{name:'공개로 저장'}).click();
  await expect(again.getByRole('status')).toContainText('이미 공개 베타에 저장된 사진');
  expect(mock.rows).toHaveLength(1);expect(mock.uploadAttempts).toBe(2);
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const open=indexedDB.open('nature-lens-v1',2);
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result,tx=db.transaction('observations','readwrite');tx.objectStore('observations').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
  }));
  await page.reload();await page.getByRole('button',{name:'내 기록',exact:true}).click();
  const mine=page.getByLabel('서버에 저장한 내 사진');
  await expect(mine.getByText('같은 브라우저',{exact:false})).toBeVisible();
  await mine.getByRole('button',{name:'이 기기로 가져오기'}).click();
  await expect(mine.getByText('이 기기에 있음')).toBeVisible();
  await page.evaluate(value=>{localStorage.setItem('sb-mock-auth-token',JSON.stringify(value));const channel=new BroadcastChannel('sb-mock-auth-token');channel.postMessage({event:'SIGNED_IN',session:value});channel.close();},session(userB));
  await expect(mine.getByText('서버에 저장한 사진이 아직 없어요.')).toBeVisible();
  await expect(mine.getByText('같은 브라우저',{exact:false})).toHaveCount(0);
  await page.evaluate(()=>{localStorage.removeItem('sb-mock-auth-token');const channel=new BroadcastChannel('sb-mock-auth-token');channel.postMessage({event:'SIGNED_OUT',session:null});channel.close();});
  await expect(mine.getByText('같은 브라우저',{exact:false})).toBeVisible();
  await expect(mine.getByText('이 기기에 있음')).toBeVisible();
  const other=await browser.newContext({baseURL:'http://127.0.0.1:3142'});await seed(other,userB);await mock.attach(other);
  const otherPage=await other.newPage();await otherPage.goto('/mobile/');await otherPage.getByRole('button',{name:'내 기록',exact:true}).click();
  const otherMine=otherPage.getByLabel('서버에 저장한 내 사진');
  await expect(otherMine.getByText('서버에 저장한 사진이 아직 없어요.')).toBeVisible();
  await expect(otherMine.getByRole('button',{name:'이 기기로 가져오기'})).toHaveCount(0);
  await other.close();
});

test('after an upload failure, edited notes are finalized on retry without changing the photo',async({context,page})=>{
  const mock=server();mock.failUpload();await mock.attach(context);await capture(page);
  const initial=page.getByLabel('공개 베타 사진 저장');
  await initial.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await initial.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await initial.getByRole('button',{name:'공개로 저장'}).click();
  await expect(initial.getByRole('alert')).toContainText('사진 전송을 완료하지 못했어요');
  expect(mock.rows).toHaveLength(1);expect(mock.rows[0].state).toBe('staging');
  const staged=structuredClone(mock.rows[0]);expect(mock.finalizations).toHaveLength(0);
  await page.getByRole('button',{name:'내 기록 보기'}).click();
  await page.getByRole('button',{name:'기록 수정 및 공개 준비'}).click();
  const editor=page.getByRole('dialog');await editor.getByLabel('관찰 메모').fill('다시 작성한 합성 메모');
  await editor.getByRole('button',{name:'초안 저장',exact:true}).click();await expect(editor).toHaveCount(0);
  const retry=page.getByLabel('공개 베타 사진 저장');
  await retry.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await retry.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await retry.getByRole('button',{name:'공개로 저장'}).click();
  await expect(retry.getByRole('status')).toContainText('공개 베타에 저장했어요');
  expect(mock.rows).toHaveLength(1);expect(mock.rows[0].id).toBe(staged.id);expect(mock.rows[0].photo_sha256).toBe(staged.photo_sha256);
  expect(mock.rows[0].record.notes).toBe('다시 작성한 합성 메모');expect(mock.rows[0].state).toBe('published');
  expect(mock.finalizations).toHaveLength(1);expect(mock.finalizations[0]).toMatchObject({owner:guest,accepted:true,body:{p_id:staged.id,p_expected_record:staged.record,p_photo_sha256:staged.photo_sha256,p_new_record:{notes:'다시 작성한 합성 메모'}}});
  expect(mock.requests.slice(mock.requests.lastIndexOf('finalize')+1)).toContain('read');expect(mock.patchAttempts).toBe(0);
});

test('editing an already published record never mutates the published version',async({context,page})=>{
  const mock=server();await seed(context,userA);await mock.attach(context);await capture(page);
  const first=page.getByLabel('공개 베타 사진 저장');
  await first.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await first.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await first.getByRole('button',{name:'공개로 저장'}).click();await expect(first.getByRole('status')).toContainText('공개 베타에 저장했어요');
  const published=structuredClone(mock.rows[0]);
  await page.getByRole('button',{name:'내 기록 보기'}).click();await page.getByRole('button',{name:'기록 수정 및 공개 준비'}).click();
  const editor=page.getByRole('dialog');await editor.getByLabel('관찰 메모').fill('공개 후 바꾼 합성 메모');
  await editor.getByRole('button',{name:'초안 저장',exact:true}).click();await expect(editor).toHaveCount(0);
  const retry=page.getByLabel('공개 베타 사진 저장');
  await retry.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();await retry.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await retry.getByRole('button',{name:'공개로 저장'}).click();await expect(retry.getByRole('alert')).toContainText('다른 버전');
  expect(mock.rows[0]).toEqual(published);expect(mock.finalizations).toHaveLength(1);expect(mock.uploadAttempts).toBe(1);expect(mock.patchAttempts).toBe(0);
});

for(const conflict of ['staging','published'] as const)test(`a ${conflict} conflict is re-read and never mistaken for our successful publication`,async({context,page})=>{
  const mock=server();mock.conflictNextFinalize(conflict);await seed(context,userA);await mock.attach(context);await capture(page);
  const panel=page.getByLabel('공개 베타 사진 저장');
  await panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();await panel.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await panel.getByRole('button',{name:'공개로 저장'}).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  expect(mock.finalizations).toHaveLength(1);expect(mock.finalizations[0].accepted).toBe(false);
  expect(mock.requests.slice(mock.requests.lastIndexOf('finalize')+1)).toContain('read');
  expect(mock.rows[0].state).toBe(conflict);expect(mock.rows[0].record.notes).toBe('다른 탭의 합성 메모');
  expect(mock.patchAttempts).toBe(0);
  if(conflict==='staging'){
    await panel.getByRole('button',{name:'공개로 저장'}).click();
    await expect(panel.getByRole('status')).toContainText('공개 베타에 저장했어요');
    expect(mock.finalizations).toHaveLength(2);expect(mock.finalizations[1].accepted).toBe(true);expect(mock.rows[0].state).toBe('published');
  }else{
    const published=structuredClone(mock.rows[0]);
    await panel.getByRole('button',{name:'공개로 저장'}).click();await expect(panel.getByRole('alert')).toBeVisible();
    expect(mock.rows[0]).toEqual(published);expect(mock.finalizations).toHaveLength(1);
  }
});

test('account switch discards an older account response',async({context,page})=>{
  const mock=server();mock.hold(userA);
  const record=(id:string,title:string)=>({id,title,species:'',scientificName:'',date:'2026-11-01',notes:'',habitat:'',protection:'unknown',consent:false,noPeople:false,aiAssisted:false,status:'draft',sessionId:null,demo:false,updatedAt:'2026-11-01T00:00:00.000Z'});
  for(const [owner,title,local] of [[userA,'이전 계정 사진','local-a'],[userB,'새 계정 사진','local-b']]){
    const id=owner===userA?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    mock.rows.push({id,owner_id:owner,local_id:local,photo_path:`${id}.jpg`,photo_sha256:'a'.repeat(64),record:record(local,title),state:'published',published_at:'2026-11-01T00:00:00Z'});
  }
  await seed(context,userA);await mock.attach(context);
  await page.goto('/mobile/');await page.getByRole('button',{name:'내 기록',exact:true}).click();await mock.held;
  await page.evaluate(value=>{localStorage.setItem('sb-mock-auth-token',JSON.stringify(value));const channel=new BroadcastChannel('sb-mock-auth-token');channel.postMessage({event:'SIGNED_IN',session:value});channel.close();},session(userB));
  const mine=page.getByLabel('서버에 저장한 내 사진');
  await expect(mine.getByText('새 계정 사진')).toBeVisible();
  mock.releaseHeld();
  await expect(mine.getByText('이전 계정 사진')).toHaveCount(0);
  await expect(mine.getByText('새 계정 사진')).toBeVisible();
});

test('the saved photo can lead directly to a linked reobservation',async({context,page})=>{
  const mock=server();await mock.attach(context);await capture(page);
  const records=()=>page.evaluate(()=>new Promise<Record<string,unknown>[]>((resolve,reject)=>{
    const open=indexedDB.open('nature-lens-v1',2);
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result,tx=db.transaction('observations'),all=tx.objectStore('observations').getAll();all.onsuccess=()=>resolve(all.result);all.onerror=()=>reject(all.error);tx.oncomplete=()=>db.close();};
  }));
  const [original]=await records();
  await page.getByRole('button',{name:'같은 대상 다시 관찰하기'}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByLabel('지난번과 같은 개체를 관찰했습니다').check();
  await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
  const next=(await records()).find(item=>item.id!==original.id);
  expect(next).toMatchObject({specimenId:original.id,previousObservationId:original.id});
  expect(mock.posted).toHaveLength(0);
});

test('the saved screen cannot leave while public photo upload is in progress',async({context,page})=>{
  const mock=server();mock.holdUpload();await seed(context,userA);await mock.attach(context);await capture(page);
  const panel=page.getByLabel('공개 베타 사진 저장');
  await panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await panel.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await panel.getByRole('button',{name:'공개로 저장'}).click();await mock.uploadHeld;
  for(const name of ['내 기록 보기','같은 대상 다시 관찰하기','하나 더 기록하기','홈으로'])await expect(page.getByRole('button',{name})).toBeDisabled();
  mock.releaseUpload();await expect(panel.getByRole('status')).toContainText('공개 베타에 저장했어요');
  await expect(page.getByRole('button',{name:'내 기록 보기'})).toBeEnabled();
});

test('detail protects identification and publication from edits or navigation, then retries a failed upload',async({context,page})=>{
  const mock=server();mock.holdIdentify();mock.holdUpload();mock.failUpload();await seed(context,userA);await mock.attach(context);
  await capture(page);await page.getByRole('button',{name:'내 기록 보기'}).click();
  const detail=page.locator('.m-detail'),panel=detail.getByLabel('공개 베타 사진 저장');
  await detail.getByLabel('인물과 개인정보가 없는 사진입니다').check();
  await detail.getByLabel('사진 전송과 처리 안내에 동의합니다').check();
  await detail.getByRole('button',{name:'이름 후보 찾기',exact:true}).click();await mock.identifyHeld;
  await expect(panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요')).toBeDisabled();
  await expect(detail.getByRole('button',{name:'기록 수정 및 공개 준비'})).toBeDisabled();
  await expect(detail.getByRole('button',{name:'모든 위치 정보 삭제'})).toBeDisabled();
  await expect(detail.getByRole('button',{name:'목록으로'})).toBeDisabled();
  await expect(page.getByRole('navigation',{name:'모바일 메뉴'}).getByRole('button',{name:'촬영'})).toBeDisabled();
  await page.keyboard.press('n');await expect(detail).toBeVisible();
  mock.releaseIdentify();
  await expect(detail.getByText('분석 정보')).toBeVisible();
  await panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await panel.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await panel.getByRole('button',{name:'공개로 저장'}).click();await mock.uploadHeld;
  await expect(detail.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'})).toBeDisabled();
  await expect(detail.getByRole('radio',{name:/다음날 확인하기/})).toBeDisabled();
  await expect(detail.getByRole('button',{name:'기록 수정 및 공개 준비'})).toBeDisabled();
  await expect(detail.getByRole('button',{name:'모든 위치 정보 삭제'})).toBeDisabled();
  await expect(detail.getByRole('button',{name:'목록으로'})).toBeDisabled();
  await expect(page.getByRole('navigation',{name:'모바일 메뉴'}).getByRole('button',{name:'홈'})).toBeDisabled();
  mock.releaseUpload();
  await expect(panel.getByRole('alert')).toContainText('사진 전송을 완료하지 못했어요');
  await expect(detail.getByRole('button',{name:'기록 수정 및 공개 준비'})).toBeEnabled();
  await panel.getByRole('button',{name:'공개로 저장'}).click();
  await expect(panel.getByRole('status')).toContainText('공개 베타에 저장했어요');
  expect(mock.rows).toHaveLength(1);expect(mock.rows[0].state).toBe('published');expect(mock.uploadAttempts).toBe(2);
  await page.setViewportSize({width:320,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('.m-detail').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});

test('changing the identification mode locks publication until the local save finishes',async({context,page})=>{
  const mock=server();await seed(context,userA);await mock.attach(context);
  await capture(page);await page.getByRole('button',{name:'내 기록 보기'}).click();
  const detail=page.locator('.m-detail'),panel=detail.getByLabel('공개 베타 사진 저장');
  await holdObservations(page);
  await detail.getByRole('radio',{name:/다음날 확인하기/}).click();
  await expect(panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요')).toBeDisabled();
  await expect(detail.getByRole('button',{name:'기록 수정 및 공개 준비'})).toBeDisabled();
  await expect(detail.getByRole('button',{name:'목록으로'})).toBeDisabled();
  await releaseObservations(page);
  await expect(detail.getByRole('radio',{name:/다음날 확인하기/})).toBeChecked();
  await expect(panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요')).toBeEnabled();
  expect(mock.posted).toHaveLength(0);
});

test('after deleting location, the current observation can still be identified and saved',async({context,page})=>{
  const mock=server();await seed(context,userA);await mock.attach(context);
  await capture(page);await page.getByRole('button',{name:'내 기록 보기'}).click();
  const detail=page.locator('.m-detail');
  const updatedAt=()=>page.evaluate(()=>new Promise<string>((resolve,reject)=>{
    const open=indexedDB.open('nature-lens-v1',2);open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result,tx=db.transaction('observations'),all=tx.objectStore('observations').getAll();all.onsuccess=()=>resolve(all.result[0].updatedAt);all.onerror=()=>reject(all.error);tx.oncomplete=()=>db.close();};
  }));
  const before=await updatedAt();
  await holdObservations(page);
  await detail.getByRole('button',{name:'모든 위치 정보 삭제'}).click();
  await expect(detail.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요')).toBeDisabled();
  await expect(detail.getByLabel('인물과 개인정보가 없는 사진입니다')).toBeDisabled();
  await expect(detail.getByRole('button',{name:'기록 수정 및 공개 준비'})).toBeDisabled();
  await expect(detail.getByRole('button',{name:'목록으로'})).toBeDisabled();
  await releaseObservations(page);
  await expect.poll(updatedAt).not.toBe(before);
  await expect(detail.getByRole('button',{name:'모든 위치 정보 삭제'})).toBeEnabled();
  await detail.getByLabel('인물과 개인정보가 없는 사진입니다').check();
  await detail.getByLabel('사진 전송과 처리 안내에 동의합니다').check();
  await detail.getByRole('button',{name:'이름 후보 찾기',exact:true}).click();
  await expect(detail.getByText('분석 정보')).toBeVisible();
  await expect.poll(()=>mock.identified.length).toBe(1);
});

test('capture, identify, apply an unconfirmed candidate and publish the same record',async({context,page})=>{
  const mock=server();await seed(context,userA);await mock.attach(context);
  await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByLabel('인물과 개인정보가 없는 사진이며, 사진을 식별 서비스에 보내 분석하는 데 동의합니다').check();
  await page.getByRole('button',{name:'가입 없이 바로 확인하기',exact:true}).click();
  await page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'}).click();
  await expect(page.getByText('AI 후보를 반영한 미확정 기록입니다.')).toBeVisible();
  const panel=page.getByLabel('공개 베타 사진 저장');
  await expect(page.getByRole('img',{name:'방금 담은 자연 사진'})).toBeVisible();
  await expect(panel).toBeVisible();
  await panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await panel.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await panel.getByRole('button',{name:'공개로 저장'}).click();
  await expect(panel.getByRole('status')).toContainText('공개 베타에 저장했어요');
  expect(mock.identified).toHaveLength(1);
  expect(mock.identified[0]).not.toHaveProperty('notes');
  expect(mock.posted).toHaveLength(1);
  expect(mock.posted[0].record).toMatchObject({species:'민들레',aiAssisted:true,identificationTiming:'now'});
});
