import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('community ranking, local reactions, filters and monthly journal',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');
 await expect(page.locator('.c-feed-card').first()).toHaveAttribute('data-story-id','butterfly');
 await page.getByRole('button',{name:'월간',exact:true}).click();
 await expect(page.locator('.c-feed-card').first()).toHaveAttribute('data-story-id','flower');
 const like=page.getByRole('button',{name:'한 걸음 늦추니, 꽃이 보였다 좋아요'});await like.click();await expect(like).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(like).toHaveAttribute('aria-pressed','true');await like.click();await expect(like).toHaveAttribute('aria-pressed','false');
 await page.getByRole('button',{name:'곤충',exact:true}).click();await expect(page.locator('.c-feed-card')).toHaveCount(1);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'저널',exact:true}).click();await page.getByRole('button',{name:'9월호 미리 읽기'}).click();await expect(page.locator('.j-paper')).toHaveCount(6);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});
test('GPS only on request; precise coordinates separate from observation export',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:37.123456,longitude:127.654321,accuracy:12});
 await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await page.getByLabel('만난 생명',{exact:true}).selectOption('insect');await page.getByLabel('관찰 지역',{exact:true}).selectOption('경기 안성');
 await page.getByRole('button',{name:'현재 GPS 위치 가져오기'}).click();await page.getByLabel('이곳이 관찰한 장소입니다').check();await page.getByLabel('정밀 좌표를 이 브라우저에만 보관').check();
 await page.getByRole('button',{name:'내 기록에 저장'}).click();await expect(page.getByRole('heading',{name:'발견 하나가 쌓였어요'})).toBeVisible();
 const data=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('nature-lens-v1',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const read=(s:string)=>new Promise<unknown[]>((resolve)=>{const r=db.transaction(s).objectStore(s).getAll();r.onsuccess=()=>resolve(r.result);});const observations=await read('observations');const privateLocations=await read('privateLocations');db.close();return {observations,privateLocations};});
 expect(JSON.stringify(data.observations)).not.toContain('37.123456');expect(data.privateLocations).toMatchObject([{latitude:37.123456,longitude:127.654321}]);expect(data.observations).toMatchObject([{region:'경기 안성',taxonGroup:'insect',publicGrid:{latitude:37.1,longitude:127.7}}]);
});

test('denied GPS still permits photo-only draft',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_ok:unknown,fail:(e:unknown)=>void)=>fail({code:1})}}));
 await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');await page.getByRole('button',{name:'현재 GPS 위치 가져오기'}).click();await expect(page.locator('.m-error[role=alert]')).toContainText('위치를 가져오지 못했어요');await page.getByRole('button',{name:'내 기록에 저장'}).click();await expect(page.getByRole('heading',{name:'발견 하나가 쌓였어요'})).toBeVisible();
});
