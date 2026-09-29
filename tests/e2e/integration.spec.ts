import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('mobile backup roundtrip, invalid restore and unconfigured community',async({page,browser})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');
 await page.getByRole('button',{name:'촬영',exact:true}).click();await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await page.getByLabel('한 줄 메모').fill('백업 복원 검증');await page.getByRole('button',{name:'내 기록에 저장'}).click();await page.getByRole('button',{name:'홈으로',exact:true}).click();
 await page.getByRole('button',{name:'설정',exact:true}).click();
 await expect(page.getByRole('heading',{name:'함께 관찰하기 · 연결 준비'})).toBeVisible();
 await expect(page.getByRole('button',{name:'이메일 로그인 링크 받기'})).toHaveCount(0);
 await page.getByLabel('모바일 백업 파일').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await expect(page.locator('.m-error[role=alert]')).toContainText('올바른 Nature Lens');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'전체 백업 내려받기'}).click();const file=await(await download).path();expect(file).toBeTruthy();
 const context=await browser.newContext({viewport:{width:390,height:844}});const restored=await context.newPage();await restored.goto('http://127.0.0.1:3107/mobile/');await restored.getByRole('button',{name:'설정',exact:true}).click();await restored.getByLabel('모바일 백업 파일').setInputFiles(file!);
 await expect(restored.getByRole('status')).toContainText('1건을 초안으로 복원');
 await restored.getByLabel('모바일 백업 파일').setInputFiles(file!);await expect(restored.getByRole('status')).toContainText('0건을 초안으로 복원');
 expect((await new AxeBuilder({page:restored}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 expect(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await restored.getByRole('button',{name:'내 기록',exact:true}).click();await restored.getByRole('button',{name:'오늘 만난 자연 기록 열기'}).click();await expect(restored.getByText('백업 복원 검증')).toBeVisible();await context.close();
});
