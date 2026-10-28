import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function record(page:Page){
 await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await page.getByRole('button',{name:'내 기록에 저장'}).click();await page.getByRole('button',{name:'방금 기록 보기'}).click();
}
async function mockSession(page:Page){
 await page.addInitScript(()=>{
  const jwt=`${btoa('{"alg":"none"}')}.${btoa(JSON.stringify({sub:'test-user',exp:Math.floor(Date.now()/1000)+3600}))}.test`;
  localStorage.setItem('sb-mock-auth-token',JSON.stringify({access_token:jwt,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'test-user',aud:'authenticated',role:'authenticated',email:'test@example.org',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));
 });
 await page.route('https://mock.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
const result={state:'candidates',provider:'kindwise-insect',modelVersion:'mock-v1',candidates:[{scientificName:'Harmonia axyridis',commonName:'무당벌레 테스트',score:.83}],needsHumanReview:true};
for(const width of [360,412,1280])test(`app shell ${width}: consent, candidate, draft and keyboard`,async({page})=>{
 await page.setViewportSize({width,height:900});await mockSession(page);
 await page.route('**/capabilities',r=>r.fulfill({json:{groups:['plant','insect'],policyUrl:'https://example.org/privacy'}}));
 let calls=0;await page.route('**/identify',async r=>{calls++;const input=r.request().postDataJSON();expect(input).not.toHaveProperty('latitude');expect(input).not.toHaveProperty('notes');expect(input.taxonGroup).toBe('insect');await r.fulfill({json:result});});
 await record(page);await page.getByLabel('찾을 생물').selectOption('insect');
 const find=page.getByRole('button',{name:'이름 후보 찾기',exact:true});await expect(find).toBeDisabled();expect(calls).toBe(0);
 await page.getByLabel('인물과 개인정보가 없는 사진입니다').check();await page.getByLabel('사진 전송과 처리 안내에 동의합니다').check();await find.click();
 await page.getByRole('button',{name:/무당벌레 테스트/}).click();await expect(page.locator('.m-species')).toHaveText('무당벌레 테스트');await expect(page.getByText('AI 후보를 반영한 미확정 기록입니다.',{exact:false})).toBeVisible();
 expect(calls).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations).toEqual([]);
 await page.screenshot({path:`test-results/app-${width}.png`,fullPage:true});
 if(width===1280){await page.keyboard.press('n');await expect(page.getByLabel('앨범 사진 선택')).toBeAttached();}
});
test('unconfigured gateway preserves manual record and reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
 await page.route('https://mock.supabase.co/**',r=>r.fulfill({json:[]}));await page.route('**/capabilities',r=>r.fulfill({json:{groups:[],policyUrl:null}}));
 await record(page);await expect(page.getByRole('button',{name:'이름 후보 찾기',exact:true})).toBeDisabled();await expect(page.getByText('인식 서버 연결 준비 중이에요.',{exact:false})).toBeVisible();
 await page.screenshot({path:'test-results/app-mobile.png',fullPage:true});
});
test('error does not overwrite and cancellation ignores late result',async({page})=>{
 await mockSession(page);await page.route('**/capabilities',r=>r.fulfill({json:{groups:['plant','insect'],policyUrl:'https://example.org/privacy'}}));
 await record(page);await page.getByLabel('인물과 개인정보가 없는 사진입니다').check();await page.getByLabel('사진 전송과 처리 안내에 동의합니다').check();
 await page.route('**/identify',r=>r.fulfill({status:429,json:{error:'quota'}}));await page.getByRole('button',{name:'이름 후보 찾기',exact:true}).click();await expect(page.getByRole('status')).toContainText('한도');
 await page.unroute('**/identify');await page.route('**/identify',async r=>{await new Promise(resolve=>setTimeout(resolve,600));await r.fulfill({json:result}).catch(()=>{});});
 await page.getByRole('button',{name:'이름 후보 찾기',exact:true}).click();await page.getByRole('button',{name:'대기 취소'}).click();await expect(page.getByRole('status')).toContainText('취소');
 await page.waitForTimeout(750);await expect(page.getByRole('button',{name:/무당벌레 테스트/})).toHaveCount(0);await expect(page.locator('.m-species')).toContainText('나중에');
});

test('signed out capture saves first, login returns to the same record without a photo request',async({page})=>{
 await page.route('https://mock.supabase.co/**',r=>r.fulfill({json:{}}));
 await page.route('**/capabilities',r=>r.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}));
 let photos=0,emails=0;await page.route('**/identify',r=>{photos++;return r.abort();});
 await page.route('**/auth/v1/otp**',r=>{emails++;expect(r.request().postDataJSON()).not.toHaveProperty('photo');return r.fulfill({json:{}});});
 await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await page.getByText('저장 전에 사진에서 이름 찾기',{exact:true}).click();
 await expect(page.getByText('먼저 아래 ‘내 기록에 저장’',{exact:false})).toBeVisible();
 await expect(page.getByLabel('식별 로그인 이메일')).toHaveCount(0);
 await page.getByRole('button',{name:'내 기록에 저장'}).click();await page.getByRole('button',{name:'방금 기록 보기'}).click();
 await page.getByLabel('식별 로그인 이메일').fill('test@example.org');
 await page.getByRole('button',{name:'이 기록에서 로그인 이어가기'}).dblclick();
 await expect(page.getByText('로그인 링크를 요청했어요.',{exact:false})).toBeVisible();expect(emails).toBe(1);expect(photos).toBe(0);
 const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem('nature-lens:identification-return:v1')!));expect(pending.id).toBeTruthy();
 await mockSession(page);await page.reload();
 await expect(page.getByRole('heading',{name:'오늘 만난 자연',exact:true})).toBeVisible();
 await expect(page.getByLabel('식별 로그인 이메일')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('nature-lens:identification-return:v1'))).toBeNull();
 expect(photos).toBe(0);
 const stored=await page.evaluate(()=>new Promise<any[]>((resolve,reject)=>{const r=indexedDB.open('nature-lens-v1',2);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('observations');const q=tx.objectStore('observations').getAll();q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close();};}));
 expect(stored).toHaveLength(1);expect(stored[0].id).toBe(pending.id);expect(stored[0].photo).toMatch(/^data:image/);
});

test('capabilities failure is retryable without sending or losing a saved photo',async({page})=>{
 await mockSession(page);let available=false,photos=0;
 await page.route('**/capabilities',r=>{return !available?r.fulfill({status:503,json:{}}):r.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}});});
 await page.route('**/identify',r=>{photos++;return r.abort();});
 // Save without opening the identification details in the capture form.
 await record(page);
 await expect(page.getByRole('button',{name:'식별 연결 다시 확인'})).toBeVisible();
 available=true;await page.getByRole('button',{name:'식별 연결 다시 확인'}).click();
 await expect(page.getByLabel('사진 전송과 처리 안내에 동의합니다')).toBeVisible();
 expect(photos).toBe(0);await expect(page.getByRole('button',{name:'이름 후보 찾기',exact:true})).toBeDisabled();
});

test('slow capability check ends, offers retry, and keeps the saved record',async({page})=>{
 await mockSession(page);let ready=false;
 await page.route('**/capabilities',async r=>{if(!ready)await new Promise(resolve=>setTimeout(resolve,14000));await r.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}).catch(()=>{});});
 await record(page);
 await expect(page.getByText('서버 응답이 늦어 연결 확인을 멈췄어요.',{exact:false})).toBeVisible({timeout:14000});
 ready=true;await page.getByRole('button',{name:'식별 연결 다시 확인'}).click();
 await expect(page.getByLabel('사진 전송과 처리 안내에 동의합니다')).toBeVisible();
 await expect(page.locator('.m-species')).toContainText('나중에');
});

test('late sign in return does not cover a newly started board capture',async({page})=>{
 await mockSession(page);await page.route('**/capabilities',r=>r.fulfill({json:{groups:[],policyUrl:null}}));
 await record(page);
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const r=indexedDB.open('nature-lens-v1',2);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('observations').objectStore('observations').getAll();q.onsuccess=()=>{localStorage.setItem('nature-lens:identification-return:v1',JSON.stringify({id:q.result[0].id,expiresAt:Date.now()+3600000}));db.close();resolve();};};}));
 await page.addInitScript(()=>{const key='sb-mock-auth-token';const session=JSON.parse(localStorage.getItem(key)!);session.expires_at=1;localStorage.setItem(key,JSON.stringify(session));});
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let refresh=false;
 await page.route('**/auth/v1/token**',async r=>{refresh=true;await held;await r.fulfill({json:{access_token:'fresh-token',refresh_token:'test',expires_in:3600,token_type:'bearer',user:{id:'test-user',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}}).catch(()=>{});});
 await page.goto('/board/');await expect.poll(()=>refresh).toBe(true);
 await page.getByRole('button',{name:'관찰 추가',exact:true}).click();release();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sb-mock-auth-token')!).access_token)).toBe('fresh-token');
 await expect(page.getByLabel('빠른 촬영 기록')).toBeVisible();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'내 기록에 저장'})).toBeEnabled();
});


test('server rejection of an expired session offers sign in on the saved record',async({page})=>{
 await mockSession(page);await page.route('**/capabilities',r=>r.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}));
 await page.route('**/identify',r=>r.fulfill({status:401,json:{error:'unauthorized'}}));
 await record(page);await page.getByLabel('인물과 개인정보가 없는 사진입니다').check();await page.getByLabel('사진 전송과 처리 안내에 동의합니다').check();
 await page.getByRole('button',{name:'이름 후보 찾기',exact:true}).click();
 await expect(page.getByLabel('식별 로그인 이메일')).toBeVisible();
 await expect(page.getByRole('button',{name:'이름 후보 찾기',exact:true})).toBeDisabled();
 await expect(page.locator('.m-species')).toContainText('나중에');
});

// Exercise the actual SDK PKCE exchange, with only the service response mocked.
function callbackSession(){
 const jwt=`${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:'test-user',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
 return {access_token:jwt,refresh_token:'callback-refresh',expires_in:3600,token_type:'bearer',user:{id:'test-user',aud:'authenticated',role:'authenticated',email:'test@example.org',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}};
}
async function callbackRoutes(page:Page, failure=false){
 let exchanges=0;
 await page.route('https://mock.supabase.co/**',r=>r.fulfill({json:[]}));
 await page.route('**/auth/v1/token**',r=>{
  exchanges++;expect(r.request().url()).toContain('grant_type=pkce');
  expect(r.request().postDataJSON()).toEqual({auth_code:'mock-email-code',code_verifier:'mock-verifier'});
  return failure?r.fulfill({status:400,json:{code:'flow_state_expired',msg:'Expired code'}}):r.fulfill({json:callbackSession()});
 });
 return ()=>exchanges;
}
test('general email callback exchanges PKCE once on home without a pending record',async({page})=>{
 const exchanges=await callbackRoutes(page);
 await page.addInitScript(()=>localStorage.setItem('sb-mock-auth-token-code-verifier',JSON.stringify('mock-verifier')));
 await page.goto('/mobile/?code=mock-email-code');
 await expect(page.getByRole('status').filter({hasText:'로그인했어요.'})).toBeVisible();
 await expect(page).toHaveURL(/\/mobile\/$/);expect(exchanges()).toBe(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-mock-auth-token')!).user.id)).toBe('test-user');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('saved record survives PKCE email callback with no automatic photo upload',async({page})=>{
 await page.route('**/capabilities',r=>r.fulfill({json:{groups:[],policyUrl:null}}));
 const exchanges=await callbackRoutes(page);let uploads=0;
 await page.route('**/identify',r=>{uploads++;return r.abort();});
 await record(page);
 const before=await page.evaluate(()=>new Promise<any>((resolve,reject)=>{const req=indexedDB.open('nature-lens-v1',2);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,q=db.transaction('observations').objectStore('observations').getAll();q.onsuccess=()=>{const rows=q.result;localStorage.setItem('nature-lens:identification-return:v1',JSON.stringify({id:rows[0].id,expiresAt:Date.now()+3600000}));localStorage.setItem('sb-mock-auth-token-code-verifier',JSON.stringify('mock-verifier'));resolve(rows);db.close();};};}));
 await page.goto('/mobile/?code=mock-email-code');
 await expect(page.locator('.m-detail')).toBeVisible();expect(exchanges()).toBe(1);expect(uploads).toBe(0);
 expect(await page.evaluate(()=>localStorage.getItem('nature-lens:identification-return:v1'))).toBeNull();
 const after=await page.evaluate(()=>new Promise<any>((resolve,reject)=>{const req=indexedDB.open('nature-lens-v1',2);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,q=db.transaction('observations').objectStore('observations').getAll();q.onsuccess=()=>{resolve(q.result);db.close();};};}));
 expect(after).toEqual(before);
});
for(const scenario of ['missing-verifier','expired-with-old-session','error-fragment'])test(`failed email callback: ${scenario}`,async({page})=>{
 if(scenario==='expired-with-old-session')await mockSession(page);
 const exchanges=await callbackRoutes(page,true);
 if(scenario==='expired-with-old-session')await page.addInitScript(()=>localStorage.setItem('sb-mock-auth-token-code-verifier',JSON.stringify('mock-verifier')));
 await page.goto(scenario==='error-fragment'?'/mobile/#error=access_denied&error_code=otp_expired':'/mobile/?code=mock-email-code');
 await expect(page.getByRole('status').filter({hasText:'이 로그인 링크를 완료하지 못했어요.'})).toBeVisible();
 await expect(page.getByText('로그인했어요.',{exact:false})).toHaveCount(0);
 await expect(page).toHaveURL(/\/mobile\/$/);
 expect(exchanges()).toBe(scenario==='expired-with-old-session'?1:0);
 if(scenario==='expired-with-old-session')expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-mock-auth-token')!).user.id)).toBe('test-user');
 await page.getByRole('button',{name:'촬영',exact:true}).click();
 await expect(page.getByLabel('앨범 사진 선택')).toBeAttached();
});

test('discovery persists private round, reveals server result and score without another photo upload',async({page})=>{
 await mockSession(page);
 await page.route('**/capabilities',r=>r.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy',discovery:true}}));
 let state='waiting',ready=false,submits=0,reveals=0;
 const round=()=>({id:'00000000-0000-4000-8000-000000000001',state,prediction:'민들레',reason:'노란 꽃',readyAt:'2026-10-30T00:00:00Z',serverNow:ready?'2026-10-30T01:00:00Z':'2026-10-29T00:00:00Z',eligible:true,points:state==='revealed'?10:0,totalPoints:state==='revealed'?10:0,result:state==='revealed'?{state:'candidates',provider:'plantnet',modelVersion:'test',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true}:null});
 await page.route('**/discovery-capabilities',r=>r.fulfill({json:{discovery:true}}));
 await page.route('**/discovery/*',async route=>{
  const action=new URL(route.request().url()).pathname.split('/').at(-1);
  const input=route.request().postDataJSON();
  if(action==='submit'){submits++;expect(input.prediction).toBe('민들레');expect(input.reason).toBe('노란 꽃');expect(input).not.toHaveProperty('latitude');}
  else expect(input).not.toHaveProperty('photo');
  if(action==='reveal'){reveals++;state='revealed';}
  await route.fulfill({json:round()});
 });
 await record(page);await page.getByLabel('이름을 알아보는 방식').selectOption('tomorrow');
 await page.getByLabel('내가 예상한 식물 이름').fill('민들레');await page.getByLabel('그렇게 생각한 이유').fill('노란 꽃');
 await page.getByLabel('인물과 개인정보가 없는 사진입니다').check();await page.getByLabel('사진 전송 및 예상·결과·점수 보관에 동의합니다').check();
 await page.getByRole('button',{name:'예상 제출하고 내일 확인하기'}).click();
 await expect(page.getByText('나의 예상: 민들레')).toBeVisible();
 await expect(page.getByRole('button',{name:'내 예상과 결과 비교하기'})).toHaveCount(0);
 await expect(page.getByText('Taraxacum officinale',{exact:true})).toHaveCount(0);
 expect(submits).toBe(1);
 await page.reload();await page.getByRole('button',{name:'내 기록',exact:true}).click();await page.getByRole('button',{name:'오늘 만난 자연 기록 열기'}).click();
 await expect(page.getByText('나의 예상: 민들레')).toBeVisible();
 ready=true;await page.getByRole('button',{name:'공개 상태 새로 확인'}).click();await page.getByRole('button',{name:'내 예상과 결과 비교하기'}).click();
 await expect(page.getByText('이번 예측 10점 · 누적 10점')).toBeVisible();expect(submits).toBe(1);expect(reveals).toBe(1);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 await page.screenshot({path:'test-results/discovery-score.png',fullPage:true});
 await page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'}).click();
 await expect(page.locator('.m-species')).toHaveText('민들레');
 await expect(page.getByText('이번 예측 10점 · 누적 10점')).toBeVisible();
 expect(submits).toBe(1);expect(reveals).toBe(1);
});

test('signed out discovery cannot submit predictions; capture choice survives save',async({page})=>{
 await page.route('https://mock.supabase.co/**',r=>r.fulfill({json:{}}));
 await page.route('**/capabilities',r=>r.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy',discovery:true}}));
 let calls=0;await page.route('**/discovery/*',r=>{calls++;return r.abort();});
 await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await page.getByText('저장 전에 사진에서 이름 찾기',{exact:true}).click();await page.getByLabel('이름을 알아보는 방식').selectOption('tomorrow');
 await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();await page.getByRole('button',{name:'방금 기록 보기'}).click();
 await expect(page.getByLabel('이름을 알아보는 방식')).toHaveValue('tomorrow');
 await expect(page.getByLabel('식별 로그인 이메일')).toBeVisible();
 await expect(page.getByRole('button',{name:'예상 제출하고 내일 확인하기'})).toHaveCount(0);expect(calls).toBe(0);
});
