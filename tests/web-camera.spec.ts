import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});
test.beforeEach(async({page})=>{
 await page.route('https://mock.supabase.co/**',r=>r.fulfill({json:[]}));
 await page.route('**/capabilities',r=>r.fulfill({json:{groups:[],policyUrl:null}}));
});
test('web board: camera starts only on demand, captures and persists a card',async({page})=>{
 await page.goto('/board/');await expect(page.getByRole('heading',{name:'내 관찰 보드',exact:false})).toBeVisible();
 await page.getByRole('button',{name:'관찰 추가',exact:true}).click();
 await expect(page.getByRole('button',{name:'카메라 켜기',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'카메라 켜기',exact:true}).click();
 const shoot=page.getByRole('button',{name:'사진 촬영하기',exact:true});await expect(shoot).toBeEnabled();await shoot.click();
 await expect(page.getByLabel('이름',{exact:false}).first()).toBeVisible();
 await page.getByLabel('이름',{exact:false}).first().fill('산책길의 작은 발견');
 await page.getByRole('button',{name:'내 기록에 저장'}).click();await page.getByRole('button',{name:'홈으로',exact:true}).click();
 await expect(page.getByRole('button',{name:'산책길의 작은 발견 기록 열기'})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'산책길의 작은 발견 기록 열기'})).toBeVisible();
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(audit.violations).toEqual([]);
 await page.screenshot({path:'test-results/web-board-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/web-board-mobile.png',fullPage:true});
});
test('mobile observation save stays visible and does not cover the final privacy note',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/board/');await page.getByRole('button',{name:'관찰 추가',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
 const save=page.getByRole('button',{name:'내 기록에 저장'});await expect(save).toBeVisible();
 const buttonBox=await save.boundingBox();expect(buttonBox).not.toBeNull();expect(buttonBox!.y).toBeGreaterThanOrEqual(0);expect(buttonBox!.y+buttonBox!.height).toBeLessThanOrEqual(844);
 await page.getByLabel('이름',{exact:false}).first().fill('모바일 저장 동선');
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 await expect(save).toBeInViewport();
 await page.locator('.m-private-note').scrollIntoViewIfNeeded();
 const noteBox=await page.locator('.m-private-note').boundingBox();const finalSaveBox=await save.boundingBox();
 expect(noteBox).not.toBeNull();expect(finalSaveBox).not.toBeNull();expect(noteBox!.y+noteBox!.height).toBeLessThan(finalSaveBox!.y);
 await page.setViewportSize({width:390,height:480});await page.getByLabel('한 줄 메모').focus();await expect(save).toBeInViewport();
});
test('mobile camera and album choices fit in the initial capture viewport',async({page})=>{
 for(const [width,height] of [[390,844],[320,667]]){
  await page.setViewportSize({width,height});await page.goto('/board/');await page.getByRole('button',{name:'관찰 추가',exact:true}).click();
  for(const name of ['카메라 켜기','사진 선택','기기 카메라로 촬영']){
   const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box,`${name} at ${width}x${height}`).not.toBeNull();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(height);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
test('denied camera still permits photo upload and closed preview releases stream',async({page})=>{
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError');};});
 await page.goto('/board/');await page.getByRole('button',{name:'관찰 추가',exact:true}).click();await page.getByRole('button',{name:'카메라 켜기',exact:true}).click();
 await expect(page.locator('.m-web-camera [role=alert]')).toContainText('권한');
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');await expect(page.getByRole('button',{name:'내 기록에 저장'})).toBeVisible();
});
test('camera tracks stop on explicit off and closing the capture screen',async({page})=>{
 await page.addInitScript(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const s=await original(c);(window as unknown as {cameraStream:MediaStream}).cameraStream=s;return s;};});
 await page.goto('/board/');await page.getByRole('button',{name:'관찰 추가',exact:true}).click();await page.getByRole('button',{name:'카메라 켜기',exact:true}).click();await expect(page.getByRole('button',{name:'사진 촬영하기',exact:true})).toBeEnabled();await page.getByRole('button',{name:'카메라 끄기',exact:true}).click();
 expect(await page.evaluate(()=>(window as unknown as {cameraStream:MediaStream}).cameraStream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);
 await page.getByRole('button',{name:'카메라 켜기',exact:true}).click();await expect(page.getByRole('button',{name:'사진 촬영하기',exact:true})).toBeEnabled();await page.getByRole('button',{name:'촬영 닫기'}).click();
 expect(await page.evaluate(()=>(window as unknown as {cameraStream:MediaStream}).cameraStream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);
});
test('late permission grant after closing immediately releases the camera',async({page})=>{
 await page.addInitScript(()=>{
  Object.assign(window,{cameraStopped:false,resolveCamera:()=>{}});
  navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{(window as unknown as {resolveCamera:()=>void}).resolveCamera=()=>resolve({getTracks:()=>[{stop:()=>{(window as unknown as {cameraStopped:boolean}).cameraStopped=true;}}]} as unknown as MediaStream);});
 });
 await page.goto('/board/');await page.getByRole('button',{name:'관찰 추가',exact:true}).click();await page.getByRole('button',{name:'카메라 켜기',exact:true}).click();await expect(page.getByRole('status')).toContainText('연결 대기');
 await page.getByRole('button',{name:'촬영 닫기'}).click();await page.evaluate(()=>(window as unknown as {resolveCamera:()=>void}).resolveCamera());
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {cameraStopped:boolean}).cameraStopped)).toBe(true);
});
