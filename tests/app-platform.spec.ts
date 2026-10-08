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
