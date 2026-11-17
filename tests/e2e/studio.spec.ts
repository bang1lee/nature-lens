import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('full local publication flow, persistence, edit invalidation, backup and safe restore',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'먼저 예제 3건으로 둘러보기'}).click();
 await expect(page.getByRole('button',{name:'겹겹이 펼쳐진 초록 편집'})).toBeVisible();
 await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 편집'}).click();
 await page.getByRole('button',{name:'검수 완료로 저장'}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('동의');
 await page.getByLabel('사진과 기록의 출판 권한·동의를 확인했습니다.').check();await page.getByLabel('사진에 인물과 개인정보가 없습니다.').check();
 await page.getByRole('button',{name:'검수 완료로 저장'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.reload();await page.getByRole('button',{name:'기록집 만들기'}).click();await expect(page.locator('.book-page')).toHaveCount(1);await expect(page.getByRole('button',{name:'인쇄 · PDF 저장'})).toBeEnabled();
 await page.emulateMedia({media:'print'});await expect(page.locator('.book-cover')).toBeVisible();await expect(page.locator('.sidebar')).not.toBeVisible();await page.emulateMedia({media:'screen'});
 await page.getByRole('button',{name:'관찰실'}).click();await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 편집'}).click();await page.getByLabel('관찰 메모').fill('검수 후 수정한 메모');await page.getByRole('button',{name:'초안 저장'}).click();await page.getByRole('button',{name:'기록집 만들기'}).click();await expect(page.getByRole('button',{name:'인쇄 · PDF 저장'})).toBeDisabled();
 await page.getByRole('button',{name:'저장과 백업',exact:true}).first().click();const dlPromise=page.waitForEvent('download');await page.getByRole('button',{name:'전체 백업 내려받기'}).click();const dl=await dlPromise;expect(dl.suggestedFilename()).toContain('nature-lens-backup');
 await page.locator('input[type=file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{}')});await expect(page.getByRole('status')).toContainText('올바른 Nature Lens');
 await page.getByRole('button',{name:'관찰실'}).click();await expect(page.locator('.observation-card')).toHaveCount(3);
});
test('real upload, search, collections, keyboard modal and mobile accessibility',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'컬렉션',exact:true}).click();await page.getByLabel('새 컬렉션').fill('가을 산책');await page.getByRole('button',{name:'만들기',exact:true}).click();await expect(page.getByRole('button',{name:'가을 산책'})).toBeVisible();
 await page.getByRole('button',{name:'관찰실'}).click();await page.getByRole('button',{name:'관찰 기록하기'}).click();await page.getByLabel('관찰 사진').setInputFiles('public/icon-192.png');await page.getByLabel('관찰 제목').fill('직접 찍은 기록');await page.getByLabel('컬렉션',{exact:true}).selectOption({label:'가을 산책'});await page.getByRole('button',{name:'초안 저장'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'직접 찍은 기록 편집'}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'직접 찍은 기록 편집'})).toBeFocused();
 await page.getByLabel('관찰 검색').fill('no match');await expect(page.getByText('조건에 맞는 기록이 없어요')).toBeVisible();await page.getByLabel('관찰 검색').clear();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('desktop capture and accessibility',async({page})=>{await page.setViewportSize({width:1440,height:1050});await page.goto('/');await page.getByRole('button',{name:'먼저 예제 3건으로 둘러보기'}).click();await expect(page.locator('.observation-card')).toHaveCount(3);await page.screenshot({path:'test-results/desktop.png',fullPage:true});const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(axe.violations).toEqual([]);});
test('backup round trip restores photos as drafts and duplicate import is idempotent',async({page,browser})=>{
 await page.goto('/');await page.getByRole('button',{name:'먼저 예제 3건으로 둘러보기'}).click();await expect(page.locator('.observation-card')).toHaveCount(3);
 await page.getByRole('button',{name:'숲의 작은 무늬 편집'}).click();await page.getByLabel('사진과 기록의 출판 권한·동의를 확인했습니다.').check();await page.getByLabel('사진에 인물과 개인정보가 없습니다.').check();await page.getByRole('button',{name:'검수 완료로 저장'}).click();
 await page.getByRole('button',{name:'저장과 백업',exact:true}).first().click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'전체 백업 내려받기'}).click();const file=await (await download).path();
 const target=await browser.newPage();await target.goto('http://127.0.0.1:3107');await target.getByRole('button',{name:'저장과 백업',exact:true}).first().click();await target.locator('input[type=file]').setInputFiles(file!);await expect(target.getByRole('status')).toContainText('3건을 초안으로 복원');await target.locator('input[type=file]').setInputFiles(file!);await expect(target.getByRole('status')).toContainText('0건을 초안으로 복원');await target.getByRole('button',{name:'관찰실'}).click();await expect(target.locator('.observation-card')).toHaveCount(3);await expect(target.locator('.badge.reviewed')).toHaveCount(0);await expect(target.locator('.card-image img').first()).toHaveJSProperty('naturalWidth',800);await target.close();
});
