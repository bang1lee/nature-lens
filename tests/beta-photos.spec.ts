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
function server(){
  const rows:Row[]=[];
  const photos=new Map<string,Buffer>();
  const posted:Record<string,unknown>[]=[];
  const identified:Record<string,unknown>[]=[];
  const signupRequests:Record<string,unknown>[]=[];
  let uploadAttempts=0;
  let failFirstUpload=false;
  let holdOwner:string|null=null;
  let releaseHeld=()=>{};
  let heldRequest=()=>{};
  const held=new Promise<void>(resolve=>{heldRequest=resolve;});
  const gate=new Promise<void>(resolve=>{releaseHeld=resolve;});
  return {rows,photos,posted,identified,signupRequests,held,releaseHeld,failUpload:()=>{failFirstUpload=true;},hold:(id:string)=>{holdOwner=id;},get uploadAttempts(){return uploadAttempts;},async attach(context:BrowserContext){
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),method=request.method();
      if(url.hostname==='127.0.0.1'&&url.port==='3142')return route.continue();
      if(method==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.hostname==='127.0.0.1'&&url.port==='8787'){
        if(url.pathname==='/capabilities')return route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'},headers});
        if(url.pathname==='/identify'){identified.push(request.postDataJSON());return route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'test',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true},headers});}
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
      if(url.pathname==='/rest/v1/beta_public_observations'){
        if(method==='POST'){
          const body=request.postDataJSON() as Omit<Row,'owner_id'|'state'|'published_at'>;
          posted.push(body as unknown as Record<string,unknown>);
          const row={...body,owner_id:uid,state:'staging',published_at:null};rows.push(row);
          return route.fulfill({status:201,json:row,headers});
        }
        const owner=url.searchParams.get('owner_id')?.replace('eq.','');
        if(method==='GET'&&owner===holdOwner&&url.searchParams.get('state')){heldRequest();await gate;}
        const filtered=rows.filter(r=>r.owner_id===uid&&(!owner||r.owner_id===owner)&&(!url.searchParams.has('id')||r.id===url.searchParams.get('id')?.replace('eq.',''))&&(!url.searchParams.has('local_id')||r.local_id===url.searchParams.get('local_id')?.replace('eq.',''))&&(!url.searchParams.has('state')||r.state===url.searchParams.get('state')?.replace('eq.','')));
        if(method==='PATCH')for(const row of filtered){row.state='published';row.published_at=new Date().toISOString();}
        return route.fulfill({json:filtered,headers});
      }
      if(url.pathname.startsWith('/storage/v1/object/')){
        const path=url.pathname.split('/').at(-1)!;
        if(method==='POST'){
          uploadAttempts++;
          if(failFirstUpload&&uploadAttempts===1)return route.fulfill({status:503,json:{message:'mock unavailable'},headers});
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
  await page.getByRole('button',{name:'방금 기록 보기'}).click();
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
  await page.getByRole('button',{name:'방금 기록 보기'}).click();
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

test('capture, identify, apply an unconfirmed candidate and publish the same record',async({context,page})=>{
  const mock=server();await seed(context,userA);await mock.attach(context);
  await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByLabel('인물과 개인정보가 없는 사진이며, 사진을 식별 서비스에 보내 분석하는 데 동의합니다').check();
  await page.getByRole('button',{name:'가입 없이 바로 확인하기',exact:true}).click();
  await page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'}).click();
  await expect(page.getByText('AI 후보를 반영한 미확정 기록입니다.')).toBeVisible();
  await page.getByRole('button',{name:'공개 저장으로 계속',exact:true}).click();
  const panel=page.getByLabel('공개 베타 사진 저장');
  await panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();
  await panel.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  await panel.getByRole('button',{name:'공개로 저장'}).click();
  await expect(panel.getByRole('status')).toContainText('공개 베타에 저장했어요');
  expect(mock.identified).toHaveLength(1);
  expect(mock.identified[0]).not.toHaveProperty('notes');
  expect(mock.posted).toHaveLength(1);
  expect(mock.posted[0].record).toMatchObject({species:'민들레',aiAssisted:true,identificationTiming:'now'});
});
