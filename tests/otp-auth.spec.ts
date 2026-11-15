import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const email='synthetic@example.org';
function session(){
 const jwt=`${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:'synthetic-user',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
 return {access_token:jwt,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:{id:'synthetic-user',aud:'authenticated',role:'authenticated',email,app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};
}
async function routes(page:Page){
 const calls:{send:number;verify:number;identify:number;discovery:number}={send:0,verify:0,identify:0,discovery:0};
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1'&&url.port==='3115')return route.continue();
  if(url.hostname==='127.0.0.1'&&url.port==='8787'){
   if(url.pathname==='/capabilities')return route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}});
   if(url.pathname==='/identify'){calls.identify++;return route.fulfill({status:401,json:{code:'unauthorized'}});}
   if(url.pathname==='/discovery-capabilities')return route.fulfill({json:{discovery:true}});
   if(url.pathname==='/discovery/submit'){calls.discovery++;return route.fulfill({status:401,json:{code:'unauthorized'}});}
  }
  if(url.hostname==='mock.supabase.co'){
   if(url.pathname.endsWith('/otp')){calls.send++;expect(req.postDataJSON()).toMatchObject({email,create_user:true});return route.fulfill({json:{}});}
   if(url.pathname.endsWith('/verify')){
    calls.verify++;const body=req.postDataJSON();expect(body).toMatchObject({email,type:'email'});
    return body.token==='123456'?route.fulfill({json:session()}):route.fulfill({status:403,headers:{'x-supabase-api-version':'2024-01-01'},json:{code:'otp_expired',msg:'invalid code'}});
   }
   if(url.pathname.endsWith('/profiles'))return route.fulfill({json:null});
   return route.fulfill({json:[]});
  }
  return route.abort();
 });
 return calls;
}

test('email code signs up or signs in without requiring a public alias',async({page})=>{
 await page.setViewportSize({width:390,height:844});const calls=await routes(page);
 await page.goto('/mobile/');await page.getByRole('button',{name:'설정',exact:true}).click();
 const panel=page.locator('.m-cloud');
 await expect(panel.getByLabel('인증번호',{exact:true})).toHaveCount(0);
 await panel.getByLabel('로그인 이메일',{exact:true}).fill(email);
 await panel.getByRole('button',{name:'인증번호 받기',exact:true}).click();
 await expect(panel.getByLabel('인증번호',{exact:true})).toBeVisible();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 await expect(panel.getByRole('button',{name:'인증번호 다시 받기',exact:true})).toBeDisabled();
 await expect(panel.getByText('로그인되어 있어요.',{exact:true})).toHaveCount(0);
 await panel.getByLabel('인증번호',{exact:true}).fill('000000');
 await panel.getByRole('button',{name:'인증하고 계속',exact:true}).click();
 await expect(panel.getByRole('alert')).toContainText('인증번호');
 await expect(panel.getByLabel('인증번호',{exact:true})).toHaveValue('000000');
 await panel.getByLabel('인증번호',{exact:true}).fill('123456');
 await panel.getByRole('button',{name:'인증하고 계속',exact:true}).click();
 await expect(panel.getByText('로그인되어 있어요.',{exact:true})).toBeVisible();
 expect(calls).toMatchObject({send:1,verify:2,identify:0});
});

test('a timed-out code request is not repeated or presented as successful',async({page})=>{
 await page.clock.install();await routes(page);let sends=0,release!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/auth/v1/otp**',async route=>{sends++;await held;await route.fulfill({json:{}}).catch(()=>{});});
 await page.goto('/mobile/');await page.getByRole('button',{name:'설정',exact:true}).click();
 const panel=page.locator('.m-cloud');await panel.getByLabel('로그인 이메일',{exact:true}).fill(email);
 const send=panel.getByRole('button',{name:'인증번호 받기',exact:true});await send.click();
 await expect.poll(()=>sends).toBe(1);
 await panel.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(sends).toBe(1);
 await page.clock.fastForward(16_000);
 await expect(panel.getByRole('alert')).toContainText('메일함');
 await expect(panel.getByLabel('인증번호',{exact:true})).toHaveCount(0);
 await expect(send).toBeDisabled();release();
 await expect(panel.getByText('인증번호를 요청했어요.',{exact:false})).toHaveCount(0);
 await page.clock.fastForward(45_000);await expect(send).toBeEnabled();
});

test('a 401 can be followed by fresh code verification on the same saved record',async({page})=>{
 const calls=await routes(page);
 await page.addInitScript(session=>localStorage.setItem('sb-mock-auth-token',JSON.stringify({...session,expires_at:Math.floor(Date.now()/1000)+3600})),session());
 await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();await page.getByRole('button',{name:'방금 기록 보기'}).click();
 await page.getByLabel('인물과 개인정보가 없는 사진입니다').check();await page.getByLabel('사진 전송과 처리 안내에 동의합니다').check();
 await page.getByRole('button',{name:'이름 후보 찾기',exact:true}).click();
 await page.getByLabel('식별 로그인 이메일',{exact:true}).fill(email);
 await page.getByRole('button',{name:'인증번호 받기',exact:true}).click();
 await page.getByLabel('인증번호',{exact:true}).fill('123456');
 await page.getByRole('button',{name:'인증하고 계속',exact:true}).click();
 await expect(page.getByLabel('식별 로그인 이메일',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'이름 후보 찾기',exact:true})).toBeVisible();
 expect(calls).toMatchObject({send:1,verify:1,identify:1});
 await expect(page.locator('.m-detail-photo')).toBeVisible();
});

test('prediction 401 offers fresh code login without resending the photo',async({page})=>{
 const calls=await routes(page);
 await page.addInitScript(session=>localStorage.setItem('sb-mock-auth-token',JSON.stringify({...session,expires_at:Math.floor(Date.now()/1000)+3600})),session());
 await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await page.getByRole('radio',{name:/다음날 확인하기/}).check();
 await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();await page.getByRole('button',{name:'방금 기록 보기'}).click();
 await page.getByLabel('내가 예상한 식물 이름').fill('합성 꽃');
 await page.getByLabel('인물과 개인정보가 없는 사진입니다').check();
 await page.getByLabel('사진 전송 및 예상·결과·점수 보관에 동의합니다').check();
 await page.getByRole('button',{name:'예상 제출하고 내일 확인하기'}).click();
 await page.getByLabel('식별 로그인 이메일',{exact:true}).fill(email);
 await page.getByRole('button',{name:'인증번호 받기',exact:true}).click();
 await page.getByLabel('인증번호',{exact:true}).fill('123456');
 await page.getByRole('button',{name:'인증하고 계속',exact:true}).click();
 await expect(page.getByLabel('식별 로그인 이메일',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'예상 제출하고 내일 확인하기'})).toBeVisible();
 expect(calls).toMatchObject({send:1,verify:1,discovery:1});
 await expect(page.getByLabel('내가 예상한 식물 이름')).toHaveValue('합성 꽃');
});
