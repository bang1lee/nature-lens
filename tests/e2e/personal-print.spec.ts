import {openRecordDetails} from './capture-helpers';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('personal print excludes other months, public examples and navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');
 for(const [date,title] of [['2026-09-10','가을의 잎'],['2026-08-10','다른 달 기록']]){
  await page.getByRole('button',{name:'촬영',exact:true}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await openRecordDetails(page);await page.getByLabel('관찰 날짜').fill(date);await openRecordDetails(page);await page.getByLabel('이름 선택').fill(title);
  await openRecordDetails(page);await page.getByLabel('한 줄 메모').fill('나만의 관찰 메모 <script>text</script>');
  await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
  await page.getByRole('button',{name:'홈으로',exact:true}).click();
 }
 await page.getByRole('button',{name:'저널',exact:true}).click();
 await page.getByLabel('도감 월').fill('2026-09');
 await page.getByRole('button',{name:'개인 도감 인쇄 미리보기'}).click();
 await expect(page.locator('.personal-print-book')).toContainText('가을의 잎');
 await expect(page.locator('.personal-print-book')).not.toContainText('다른 달 기록');
 await expect(page.locator('.personal-print-book')).toContainText('전문가 검수·공개 발행본이 아닙니다');
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations).toEqual([]);
 await page.evaluate(()=>{window.print=()=>{document.documentElement.dataset.printRequested='true';};});
 await page.getByRole('button',{name:'인쇄 · PDF로 저장'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-print-requested','true');
 await page.emulateMedia({media:'print'});
 await expect(page.getByRole('heading',{name:'월간 생명 저널'})).not.toBeVisible();
 await expect(page.getByRole('navigation',{name:'모바일 메뉴'})).not.toBeVisible();
 await expect(page.locator('.personal-print-tools')).not.toBeVisible();
 await expect(page.locator('.personal-print-book')).toBeVisible();
 await page.screenshot({path:'docs/overnight-20261016/personal-print-preview.png',fullPage:true});
 await page.emulateMedia({media:'screen'});
 await page.evaluate(()=>{
  delete document.documentElement.dataset.printRequested;
  (window as unknown as {finishDecode:()=>void}).finishDecode=()=>{};
  HTMLImageElement.prototype.decode=()=>new Promise<void>(resolve=>{(window as unknown as {finishDecode:()=>void}).finishDecode=resolve;});
 });
 await page.getByRole('button',{name:'인쇄 · PDF로 저장'}).click();
 await page.getByRole('button',{name:'월간 기록으로 돌아가기'}).click();
 await page.evaluate(async()=>{(window as unknown as {finishDecode:()=>void}).finishDecode();await document.fonts.ready;await new Promise(requestAnimationFrame);});
 await expect(page.locator('html')).not.toHaveAttribute('data-print-requested','true');
 await expect(page.getByLabel('도감 월')).toHaveValue('2026-09');
 await page.getByLabel('도감 월').fill('2026-07');
 await expect(page.getByRole('button',{name:'개인 도감 인쇄 미리보기'})).toHaveCount(0);
});
