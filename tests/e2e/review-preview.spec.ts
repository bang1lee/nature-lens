import {openRecordDetails} from './capture-helpers';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('review examples remain isolated from saved observations',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');
 await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await openRecordDetails(page);await page.getByLabel('이름 선택').fill('검수되지 않은 기록');
 await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
 await page.getByRole('button',{name:'방금 기록 보기'}).click();
 await page.getByRole('button',{name:'설정',exact:true}).click();
 await expect(page.getByRole('heading',{name:'내 기록과 개인정보'})).toBeVisible();
 await page.getByText('전문가 검수 과정 미리보기 · 목업',{exact:true}).click();
 const sent:string[]=[];page.on('request',r=>{if(r.method()==='POST')sent.push(r.url());});
 for(const label of ['추가 자료 필요','검토 완료 예시','검수 대기']){
  await page.getByRole('button',{name:label,exact:true}).click();
  await expect(page.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
 }
 await expect(page.locator('.nl-review-preview')).toContainText('실제 기록의 검수 상태를 바꾸지 않아요');
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations).toEqual([]);
 expect(sent).toEqual([]);
 await page.screenshot({path:'docs/overnight-20261016/review-preview.png',fullPage:true});
 await page.getByRole('button',{name:'내 기록',exact:true}).click();
 await page.getByRole('button',{name:'검수되지 않은 기록 기록 열기'}).click();
 await expect(page.locator('.m-detail .m-draft-chip')).toHaveText('초안');
 await page.reload();await page.getByRole('button',{name:'내 기록',exact:true}).click();
 await expect(page.getByRole('button',{name:'검수되지 않은 기록 기록 열기'})).toContainText('나만 보는 초안');
});
