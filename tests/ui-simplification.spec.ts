import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const evidence=process.env.UI_AUDIT_OUTPUT||'test-results/ui-simplification';
async function capture(page:Page){
 await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await expect(page.getByRole('heading',{name:'어떻게 알아볼까요?'})).toBeVisible();
}
async function stored(page:Page){return page.evaluate(()=>new Promise<any[]>((resolve,reject)=>{const r=indexedDB.open('nature-lens-v1',2);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('observations').objectStore('observations').getAll();q.onsuccess=()=>{resolve(q.result);db.close();};};}));}
test('simple capture saves before login, preserves tomorrow choice, never sends photo',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('https://mock.supabase.co/**',r=>r.fulfill({json:{}}));
 await page.route('**/capabilities',r=>r.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}));
 await page.route('**/discovery-capabilities',r=>r.fulfill({json:{discovery:true}}));
 let posts=0;await page.route('**/discovery/*',r=>{posts++;return r.abort();});await page.route('**/identify',r=>{posts++;return r.abort();});
 await capture(page);
 await expect(page.getByLabel('한 줄 메모')).toBeHidden();await expect(page.getByLabel('관찰 날짜')).toBeHidden();
 await page.getByRole('radio',{name:'내일의 발견',exact:false}).check();
 await page.screenshot({path:`${evidence}/simplified-photo.png`,fullPage:true});
 await page.getByRole('button',{name:'계속하기',exact:true}).click();
 await expect(page.getByLabel('식별 로그인 이메일')).toBeVisible();
 expect(await stored(page)).toMatchObject([{identificationTiming:'tomorrow'}]);
 await expect(page.getByLabel('내가 예상한 식물 이름')).toHaveCount(0);
 await expect(page.getByRole('radio',{name:'내일의 발견',exact:false})).toBeChecked();
 expect(posts).toBe(0);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 await page.screenshot({path:`${evidence}/simplified-login.png`,fullPage:true});
});
test('guest can save optional fields without login; 320px remains usable',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.route('https://mock.supabase.co/**',r=>r.fulfill({json:{}}));
 await capture(page);await page.getByText('기록 더하기',{exact:false}).click();
 await page.getByLabel('한 줄 메모').fill('잎이 자랐어요');
 await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
 await expect(page.getByRole('button',{name:'방금 기록 보기'})).toBeVisible();
 expect(await stored(page)).toMatchObject([{notes:'잎이 자랐어요'}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('signed in continue still requires both consents before identification',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('sb-mock-auth-token',JSON.stringify({access_token:`${btoa('{"alg":"none"}')}.${btoa(JSON.stringify({sub:'test-user',exp:Math.floor(Date.now()/1000)+3600}))}.test`,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'test-user',aud:'authenticated',role:'authenticated',email:'test@example.org',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}));});
 await page.route('https://mock.supabase.co/**',r=>r.fulfill({json:[]}));
 await page.route('**/capabilities',r=>r.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}));
 let calls=0;await page.route('**/identify',r=>{calls++;return r.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'test',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true}});});
 await capture(page);await page.getByRole('button',{name:'계속하기',exact:true}).click();
 const find=page.getByRole('button',{name:'이름 후보 찾기',exact:true});await expect(find).toBeDisabled();
 await page.getByLabel('인물과 개인정보가 없는 사진입니다').check();await expect(find).toBeDisabled();
 await page.getByLabel('사진 전송과 처리 안내에 동의합니다').check();await find.click();
 await page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'}).click();
 expect(calls).toBe(1);expect(await stored(page)).toMatchObject([{species:'민들레',aiAssisted:true}]);
 await expect(page.getByText('식별 화면 시연',{exact:true})).toHaveCount(0);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});
