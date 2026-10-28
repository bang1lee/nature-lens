// Isolated browser only. No owner session, credentials, or user photos.
// Blocks every browser write request; uses the bundled app icon as a local fixture.
import {chromium, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
const app='https://nature-lens-mvp.pages.dev';
const gateway='https://nature-lens-identify.onrender.com';
const output=process.env.AUDIT_OUTPUT_DIR||'test-results/deployed-journey-audit';
await mkdir(output,{recursive:true});
const evidence={startedAt:new Date().toISOString(),checks:[],externalPhotoRequests:0,providerIdentification:'NOT_TESTED',errors:[]};
const browser=await chromium.launch();
try {
 for(const [path,options,status] of [
  ['/health',{},200],
  ['/capabilities',{headers:{Origin:app}},200],
  ['/capabilities',{headers:{Origin:'https://untrusted.invalid'}},403],
  ['/identify',{method:'POST',headers:{Origin:app,'Content-Type':'application/json'},body:'{}'},401],
 ]) {
  const start=Date.now();const response=await fetch(gateway+path,{...options,signal:AbortSignal.timeout(60000)});
  evidence.checks.push({path,status:response.status,expected:status,ms:Date.now()-start});
  expect(response.status).toBe(status);
  if(path==='/capabilities'&&status===200)expect((await response.json()).groups).toEqual(['plant']);
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>{
  const request=route.request();
  if(['GET','HEAD'].includes(request.method()))return route.continue();
  if(new URL(request.url()).pathname==='/identify')evidence.externalPhotoRequests++;
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
 await page.goto(app+'/mobile/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.f-cover-date')).not.toHaveText('오늘의 관찰');
 await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await expect(page.getByRole('radio',{name:/지금 알아보기/})).toBeChecked();
 await page.screenshot({path:output+'/capture.png',fullPage:true});
 await page.getByText('기록 더하기',{exact:false}).click();
 evidence.checks.push({name:'live capability UI and signed-out identification gate',pass:true});
 await page.getByLabel('이름 선택').fill('검수용 나무');
 await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
 await page.getByRole('button',{name:'방금 기록 보기'}).click();
 await expect(page.getByLabel('식별 로그인 이메일')).toBeVisible();
 await expect(page.getByRole('button',{name:'이름 후보 찾기',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'같은 대상 다시 관찰하기'}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 await page.getByLabel('지난번과 같은 개체를 관찰했습니다').check();
 await page.getByText('기록 더하기',{exact:false}).click();
 await page.getByLabel('한 줄 메모').fill('검수용 재관찰');
 await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
 await page.getByRole('button',{name:'방금 기록 보기'}).click();
 await expect(page.locator('.m-specimen')).toContainText('검수용 나무');
 await page.reload();await page.locator('.f-return').waitFor();
 await page.getByRole('button',{name:'저널',exact:true}).click();
 await expect(page.locator('.m-personal-month')).toContainText('2개의 기록 · 1개의 관찰 대상 · 1번의 재관찰');
 await page.getByRole('button',{name:'내 기록으로 도감 펼치기'}).click();
 await expect(page.locator('.m-personal-month')).toContainText('검수용 재관찰');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:output+'/monthly.png',fullPage:true});
 expect(evidence.errors).toEqual([]);expect(evidence.externalPhotoRequests).toBe(0);
 evidence.checks.push({name:'deployed local save → reobservation → reload → monthly journal',pass:true});
 console.log('PASS deployed journey and gateway guards; real provider identification NOT TESTED');
} catch(error) {evidence.failure=error.message;process.exitCode=1;console.error(error.message);}
finally {await browser.close();await writeFile(output+'/evidence.json',JSON.stringify(evidence,null,2));}
