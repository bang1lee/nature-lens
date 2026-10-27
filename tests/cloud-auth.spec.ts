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
