import {openRecordDetails} from './capture-helpers';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('forest entry connects private capture to the selected month and back',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');
 await expect(page.getByRole('heading',{name:'이름을 알면, 다시 만나고 싶어져요.'})).toBeVisible();
 await page.getByRole('button',{name:'오늘의 자연 기록하기'}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await openRecordDetails(page);await page.getByLabel('이름 선택').fill('시월의 나무');
 await openRecordDetails(page);await page.getByLabel('관찰 날짜').fill('2026-09-12');
 await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
 await page.getByRole('button',{name:'이달의 도감에 모아 보기'}).click();
 await expect(page.getByLabel('도감 월')).toHaveValue('2026-09');
 await page.getByRole('button',{name:'내 기록으로 도감 펼치기'}).click();
 await page.getByRole('button',{name:'시월의 나무 상세 · 다시 관찰하기'}).click();
 await expect(page.getByRole('heading',{name:'시월의 나무',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'같은 대상 다시 관찰하기'})).toBeVisible();
 // Ordinary records must never show mock results or apply a demo candidate.
 await expect(page.getByLabel('식별 화면 시연')).toHaveCount(0);
 await expect(page.locator('.nl-decision button')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'시월의 나무',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'이 기록의 월간 도감 보기'}).click();
 await expect(page.getByLabel('도감 월')).toHaveValue('2026-09');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations).toEqual([]);
});
test('nameplate sample stays separate and returns to the working app',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');
 await page.screenshot({path:'docs/overnight-20261016/integration-home.png'});
 await page.getByRole('link',{name:'숲의 이름표 둘러보기 · 시연'}).click();
 await expect(page.getByLabel('이 이름표의 웹 주소')).toHaveValue('http://127.0.0.1:3107/plants/demo-tree-001/');
 await expect(page.getByText('시연 이름표 웹 주소 QR',{exact:true})).toBeAttached();
 await expect(page.getByText('예시 데이터 · 실제 지정 나무가 아닙니다')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations).toEqual([]);
 await page.getByRole('link',{name:'내 관찰 시작하기'}).click();
 await expect(page.getByRole('button',{name:'오늘의 자연 기록하기'})).toBeVisible();
});
