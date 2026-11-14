import {expect,test,type Page} from '@playwright/test';

async function mockSession(page:Page,expired=false){
 await page.addInitScript(expired=>{
  const expires=Math.floor(Date.now()/1000)+3600;
  const jwt=`${btoa('{"alg":"none"}')}.${btoa(JSON.stringify({sub:'test-user',exp:expires}))}.test`;
  localStorage.setItem('sb-mock-auth-token',JSON.stringify({access_token:jwt,refresh_token:'test',expires_at:expired?1:expires,expires_in:3600,token_type:'bearer',user:{id:'test-user',aud:'authenticated',role:'authenticated',email:'test@example.org',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));
 },expired);
}
async function openSettings(page:Page){
 await page.goto('/board/');
 await page.getByRole('button',{name:'보관·전달',exact:true}).click();
 return page.locator('.m-cloud');
}
test.beforeEach(async({page})=>{
 // Every non-local request is blocked unless a test explicitly supplies a response.
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.route('https://mock.supabase.co/**',route=>route.fulfill({json:{}}));
});

test('missing community tables do not disguise a valid login or an unread feed as empty',async({page})=>{
 await mockSession(page);
 await page.route('**/rest/v1/**',route=>route.fulfill({status:404,json:{code:'PGRST205',message:'Could not find the table in the schema cache'}}));
 const panel=await openSettings(page);
 await expect(panel.getByText('로그인되어 있어요.',{exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'로그아웃',exact:true})).toBeEnabled();
 await expect(panel.getByText(/공동 관찰.*준비/).first()).toBeVisible();
 await expect(panel.getByLabel('공개 별칭',{exact:true})).toHaveCount(0);
 await expect(panel.getByText('현재 표시할 승인 기록이 없어요.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'관찰 보드',exact:true}).click();
 await expect(page.getByRole('button',{name:'관찰 추가',exact:true})).toBeEnabled();
});

test('a pending community read never holds the signed-in controls',async({page})=>{
 await mockSession(page);await page.clock.install();
 let reads=0;await page.route('**/rest/v1/**',()=>{reads++;});
 const panel=await openSettings(page);
 await expect.poll(()=>reads).toBeGreaterThan(0);
 await expect(panel.getByRole('button',{name:'로그아웃',exact:true})).toBeEnabled();
 await page.clock.fastForward(16_000);
 await expect(panel.getByRole('button',{name:'공동 관찰 연결 다시 확인',exact:true})).toBeVisible();
 await expect(panel.getByText('현재 표시할 승인 기록이 없어요.',{exact:true})).toHaveCount(0);
});

test('rapid login submissions send once and respect the resend wait',async({page})=>{
 await page.clock.install();let sends=0;
 await page.route('**/rest/v1/**',route=>route.fulfill({json:[]}));
 await page.route('**/auth/v1/otp**',route=>{sends++;return route.fulfill({json:{}});});
 const panel=await openSettings(page);
 await panel.getByLabel('로그인 이메일',{exact:true}).fill('test@example.org');
 const send=panel.getByRole('button',{name:'이메일 로그인 링크 받기',exact:true});
 await send.click();
 await expect(panel.getByText('로그인 링크를 요청했어요.',{exact:false})).toBeVisible();
 await expect(send).toBeDisabled();
 await panel.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 expect(sends).toBe(1);
 await page.clock.fastForward(60_000);await expect(send).toBeEnabled();
});

test('an unanswered login request ends visibly and ignores late success',async({page})=>{
 await page.clock.install();let sends=0;let release!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/rest/v1/**',route=>route.fulfill({json:[]}));
 await page.route('**/auth/v1/otp**',async route=>{sends++;await held;await route.fulfill({json:{}}).catch(()=>{});});
 const panel=await openSettings(page);
 await panel.getByLabel('로그인 이메일',{exact:true}).fill('test@example.org');
 const send=panel.getByRole('button',{name:'이메일 로그인 링크 받기',exact:true});
 await send.click();await expect.poll(()=>sends).toBe(1);
 await page.clock.fastForward(16_000);
 await expect(panel.getByRole('alert')).toContainText('메일함');
 await expect(panel.getByText('처리 중…',{exact:true})).toHaveCount(0);
 await expect(send).toBeDisabled();release();
 await expect(panel.getByText('로그인 링크를 요청했어요.',{exact:false})).toHaveCount(0);
});

test('map area loading failure is visible and can be retried',async({page})=>{
 await mockSession(page);let calls=0;
 await page.route('**/rest/v1/**',route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/map_areas'))return (++calls===1||calls===3)?route.fulfill({status:400,json:{message:'unavailable'}}):route.fulfill({json:[{id:'anseong-cheongnyangsan-area',label:'안성 청량산 일대'}]});if(path.endsWith('/profiles'))return route.fulfill({json:{alias:'테스트회원'}});return route.fulfill({json:[]});});
 const panel=await openSettings(page);await expect(panel.getByText('지도 공개 구역을 불러오지 못했어요.',{exact:false})).toBeVisible();await panel.getByRole('button',{name:'지도 구역 다시 확인'}).click();await expect(panel.getByLabel('공개 구역')).toBeVisible();await expect(panel.getByRole('option',{name:'안성 청량산 일대'})).toHaveCount(1);await panel.getByLabel('공개 구역').selectOption('anseong-cheongnyangsan-area');await panel.getByLabel('선택한 구역의 대표 지점에 이 기록을 공개하는 데 동의합니다').check();await panel.getByRole('button',{name:'지도 구역 다시 확인'}).click();await expect(panel.getByText('지도 공개 구역을 불러오지 못했어요.',{exact:false})).toBeVisible();await panel.getByRole('button',{name:'지도 구역 다시 확인'}).click();await expect(panel.getByLabel('공개 구역')).toHaveValue('');await expect(panel.getByLabel('선택한 구역의 대표 지점에 이 기록을 공개하는 데 동의합니다')).toHaveCount(0);
});

test('accepted submission remains successful when refreshing the list fails',async({page})=>{
 await mockSession(page);let posted=0;let payload:Record<string,unknown>|undefined;
 await page.route('**/rest/v1/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;if(path.endsWith('/map_areas'))return route.fulfill({json:[{id:'anseong-cheongnyangsan-area',label:'안성 청량산 일대'}]});if(path.endsWith('/profiles'))return route.fulfill({json:{alias:'테스트회원'}});if(path.endsWith('/community_submissions')){if(req.method()==='POST'){posted++;payload=req.postDataJSON();return route.fulfill({status:201,body:''});}return posted?route.fulfill({status:400,json:{message:'refresh failed'}}):route.fulfill({json:[]});}return route.fulfill({json:[]});});
 let panel=await openSettings(page);
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('nature-lens-v1',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('observations','readwrite');tx.objectStore('observations').put({id:'synthetic-map-observation',title:'합성 관찰',species:'민들레',scientificName:'',date:'2026-11-14',notes:'합성 메모',habitat:'',protection:'common',consent:true,noPeople:true,aiAssisted:false,status:'draft',sessionId:null,photo:'data:image/png;base64,YQ==',demo:false,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();});
 await page.reload();await page.getByRole('button',{name:'보관·전달',exact:true}).click();panel=page.locator('.m-cloud');await panel.getByLabel('제출할 내 기록').selectOption('synthetic-map-observation');await panel.getByLabel('공개 구역').selectOption('anseong-cheongnyangsan-area');await panel.getByLabel('선택한 구역의 대표 지점에 이 기록을 공개하는 데 동의합니다').check();await panel.getByLabel('이 기록의 서버 전송·검수·승인 후 공개에 동의합니다').check();await panel.getByLabel('사진에 사람·개인정보가 없음을 확인했습니다').check();await panel.getByRole('button',{name:'검수 대기열에 제출'}).click();
 await expect(panel.getByText('검수 대기열에 제출했어요. 아직 공개되지 않았습니다.',{exact:true})).toBeVisible();await expect(panel.getByText('제출은 완료했지만 목록을 갱신하지 못했어요.',{exact:false})).toBeVisible();await expect(panel.getByLabel('제출할 내 기록')).toHaveValue('');expect(posted).toBe(1);expect(payload).toMatchObject({map_area_id:'anseong-cheongnyangsan-area',consent_map:true,protection:'common',region:null});expect(payload).not.toHaveProperty('publicGrid');
});
