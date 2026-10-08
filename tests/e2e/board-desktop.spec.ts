import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [1440,1280,390])test(`board workspace ${width}: distinct empty states, reset, details and keyboard focus`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto('/board/');
 await expect(page.getByRole('heading',{name:'사진 한 장, 발견 하나'})).toBeVisible();
 await page.getByRole('button',{name:'예제 불러오기',exact:false}).click();
 await expect(page.getByRole('button',{name:'겹겹이 펼쳐진 초록 기록 열기'})).toBeVisible();
 await page.getByLabel('내 기록 검색').fill('없는 관찰');await expect(page.getByRole('heading',{name:'조건에 맞는 기록이 없어요'})).toBeVisible();
 await page.getByRole('button',{name:'검색어·필터 초기화'}).click();await expect(page.getByRole('button',{name:'겹겹이 펼쳐진 초록 기록 열기'})).toBeVisible();
 const card=page.getByRole('button',{name:'겹겹이 펼쳐진 초록 기록 열기'});await card.click();await expect(page.getByRole('dialog',{name:'겹겹이 펼쳐진 초록'})).toBeVisible();
 const detailAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(detailAudit.violations.filter(v=>['critical','serious'].includes(v.impact||''))).toEqual([]);
 await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.closest('dialog')!==null)).toBe(true);
 await page.keyboard.press('Escape');await expect(card).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations.filter(v=>['critical','serious'].includes(v.impact||''))).toEqual([]);
});
test('board filters reset together and unavailable transfer preserves local backup',async({page})=>{
 await page.route('**/api/capabilities',r=>r.fulfill({status:503,json:{error:'transfer-disabled'}}));await page.goto('/board/');
 await page.getByRole('button',{name:'예제 불러오기',exact:false}).click();await page.getByLabel('검수 상태').selectOption('reviewed');
 await expect(page.getByRole('heading',{name:'조건에 맞는 기록이 없어요'})).toBeVisible();await page.getByRole('button',{name:'검색어·필터 초기화'}).click();
 await page.getByRole('button',{name:'보관·전달',exact:true}).click();await expect(page.getByRole('button',{name:'전달 준비',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'전체 백업 내려받기'})).toBeEnabled();
});

test('record deletion starts on cancel and only removes the chosen record',async({page})=>{
 await page.goto('/board/');await page.getByRole('button',{name:'예제 불러오기',exact:true}).click();
 const card=page.getByRole('button',{name:'겹겹이 펼쳐진 초록 기록 열기'});
 await page.getByLabel('겹겹이 펼쳐진 초록 기록 메뉴').click();
 const remove=page.getByRole('button',{name:'기록 삭제',exact:true});await remove.click();
 const confirmation=page.getByRole('alertdialog',{name:'기록을 삭제할까요?'});
 await expect(confirmation.getByRole('button',{name:'취소',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(card).toBeVisible();await expect(remove).toBeFocused();
 await remove.click();await confirmation.getByRole('button',{name:'기록 삭제',exact:true}).click();
 await expect(card).toHaveCount(0);await expect(page.getByLabel('내 기록 검색')).toBeFocused();
 await expect(page.getByRole('button',{name:'빛을 머금은 잎 기록 열기'})).toBeVisible();await page.reload();await expect(card).toHaveCount(0);
});
for(const width of [320,640])test(`board narrow layout ${width} stays usable`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/board/');
 await page.getByRole('button',{name:'예제 불러오기',exact:true}).click();await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 기록 열기'}).waitFor();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 기록 열기'}).click();
 const dialog=page.getByRole('dialog',{name:'겹겹이 펼쳐진 초록'});await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
 await page.keyboard.press('Escape');
});
test('keyboard shortcuts leave an open transfer confirmation intact',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nature-lens:transfers:v1',JSON.stringify([{id:'A'.repeat(22),deleteToken:'B'.repeat(43),expiresAt:new Date(Date.now()+86400000).toISOString(),observations:1}])));
 await page.route('**/api/capabilities',route=>route.fulfill({json:{localStorage:true,transfer:{available:true,maxBytes:1048576,ttlSeconds:86400},sync:false,identify:false}}));
 await page.goto('/board/');await page.getByRole('button',{name:'보관·전달',exact:true}).click();
 await page.getByRole('button',{name:'지금 삭제',exact:false}).click();
 const confirmation=page.getByRole('dialog',{name:'전달을 지금 삭제할까요?'});await expect(confirmation).toBeVisible();
 await page.keyboard.press('n');await expect(confirmation).toBeVisible();
 await expect(page.getByLabel('앨범 사진 선택')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(confirmation).not.toBeVisible();
});

test('deleting the last record restores focus to the persistent capture action',async({page})=>{
 await page.goto('/board/');await page.getByRole('button',{name:'예제 불러오기',exact:true}).click();
 for(const title of ['겹겹이 펼쳐진 초록','빛을 머금은 잎','숲의 작은 무늬']){
  await page.getByLabel(`${title} 기록 메뉴`).click();
  await page.getByRole('button',{name:'기록 삭제',exact:true}).click();
  await page.getByRole('alertdialog',{name:'기록을 삭제할까요?'}).getByRole('button',{name:'기록 삭제',exact:true}).click();
  await expect(page.getByRole('button',{name:`${title} 기록 열기`})).toHaveCount(0);
 }
 await expect(page.getByRole('heading',{name:'사진 한 장, 발견 하나'})).toBeVisible();
 await expect(page.getByLabel('내 기록 검색')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'관찰 추가',exact:true})).toBeFocused();
});
