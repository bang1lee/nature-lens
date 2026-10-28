import {gotoReady} from './capture-helpers';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [360,390,1440])test(`forest navigation readable and usable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await gotoReady(page,'/mobile/');await expect(page.getByRole('button',{name:'오늘의 자연 기록하기'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 await page.getByRole('button',{name:'설정',exact:true}).click();await expect(page.getByRole('heading',{name:'내 기록과 개인정보'})).toBeVisible();
 await page.getByRole('button',{name:'내 기록',exact:true}).click();await expect(page.getByRole('heading',{name:'첫 번째 발견을 담아보세요'})).toBeVisible();
 await page.getByRole('button',{name:'촬영',exact:true}).click();await expect(page.getByLabel('앨범 사진 선택')).toBeAttached();expect(errors).toEqual([]);
});
test('reduced motion keeps controls still and keyboard focus visible',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await gotoReady(page,'/mobile/');
 const button=page.getByRole('button',{name:'오늘의 자연 기록하기'});await button.focus();
 expect(await button.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
 expect(await button.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 await page.keyboard.press('Enter');await expect(page.getByLabel('앨범 사진 선택')).toBeAttached();
});
