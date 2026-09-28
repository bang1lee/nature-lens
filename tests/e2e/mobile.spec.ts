import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [390, 412]) {
 test(`mobile skeleton ${width}: photo, quick draft, library and persistence`, async ({page}) => {
  await page.setViewportSize({width,height:844}); await page.goto('/mobile/');
  await expect(page.getByRole('heading',{name:'오늘은 어떤 자연을 만났나요?'})).toBeVisible();
  await page.getByRole('button',{name:'촬영',exact:true}).click();
  await expect(page.getByLabel('카메라로 촬영')).toHaveAttribute('capture','environment');
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await expect(page.getByRole('heading',{name:'발견한 순간을 남겨요'})).toBeVisible();
  await page.getByLabel('한 줄 메모').fill('햇빛 아래 잎을 관찰했어요');
  const noteAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(noteAudit.violations).toEqual([]);
  await page.getByRole('button',{name:'내 기록에 저장'}).click();
  await expect(page.getByRole('heading',{name:'발견 하나가 쌓였어요'})).toBeVisible();
  await page.getByRole('button',{name:'방금 기록 보기'}).click();
  await expect(page.getByText('햇빛 아래 잎을 관찰했어요')).toBeVisible();
  await page.getByRole('button',{name:'목록으로'}).click();
  await page.reload(); await page.getByRole('button',{name:'내 기록',exact:true}).click();
  await expect(page.getByRole('button',{name:'오늘 만난 자연 기록 열기'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);
 });
}
test('invalid photo, retry, discard confirmation and all tabs',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');
 await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await expect(page.locator('.m-error[role=alert]')).toContainText('JPEG');
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'촬영 닫기'}).click();await expect(page.getByRole('button',{name:'내 기록에 저장'})).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'촬영 닫기'}).click();
 await page.getByRole('button',{name:'모아보기',exact:true}).click();await expect(page.getByRole('heading',{name:'발견을 차곡차곡'})).toBeVisible();
 await page.getByRole('button',{name:'설정',exact:true}).click();await expect(page.getByRole('heading',{name:'내 손안의 관찰실'})).toBeVisible();
});
test('browser back warns before abandoning a captured draft',async({page})=>{
 await page.goto('/');await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');await page.getByLabel('한 줄 메모').fill('보존할 메모');
 let warned=false;page.once('dialog',async d=>{warned=d.type()==='beforeunload';await d.dismiss();});
 await page.goBack({timeout:2500}).catch(()=>{});
 expect(warned).toBe(true);await expect(page.getByLabel('한 줄 메모')).toHaveValue('보존할 메모');
});
