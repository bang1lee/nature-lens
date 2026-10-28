import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
const base=process.env.TEST_BASE_PATH??'/nature-lens';
const origin='http://127.0.0.1:3108';
const root=path.resolve(process.env.NATURE_LENS_DIST_DIR||'out');
const server=createServer(async(req,res)=>{
 try{if(!new URL(req.url,'http://localhost').pathname.startsWith(base+'/'))throw new Error('Outside basePath');let requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(base.length);if(requested.endsWith('/'))requested+='index.html';const file=path.resolve(root,'.'+requested);if(!file.startsWith(root+path.sep))throw new Error();const content=await readFile(file);const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(content);}catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(3108,'127.0.0.1',resolve));
let diagnosticPage;
const browser=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 const context=await browser.newContext({timezoneId:'Pacific/Honolulu'});const page=await context.newPage();diagnosticPage=page;const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message);});
 await page.goto(`${origin}${base}/`);await page.getByRole('button',{name:'먼저 예제 3건으로 둘러보기'}).click();await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 편집'}).waitFor();
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 편집'}).click();
 await page.getByLabel('사진과 기록의 출판 권한·동의를 확인했습니다.').check();await page.getByLabel('사진에 인물과 개인정보가 없습니다.').check();await page.getByRole('button',{name:'검수 완료로 저장'}).click();await page.getByRole('button',{name:'기록집 만들기'}).click();await page.locator('.book-page').waitFor();
 await mkdir('test-results',{recursive:true});const pdf=await page.pdf({path:'test-results/recordbook.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
 const pageCount=(pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;if(pageCount!==2)throw new Error(`Expected cover + 1 record, got ${pageCount} pages`);
 await page.goto(`${origin}${base}/mobile/`);await page.locator('main[data-ready=true]').waitFor();await page.getByRole('button',{name:'내 기록',exact:true}).click();await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 기록 열기'}).waitFor();
 await page.getByRole('button',{name:'저널',exact:true}).click();await page.getByRole('button',{name:'9월호 미리 읽기'}).click();const journal=await page.pdf({path:'test-results/monthly-journal.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});const journalPages=(journal.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;if(journalPages!==6)throw new Error(`Expected 6 journal pages, got ${journalPages}`);
 // Visit the board for the first time OFFLINE: proves it was precached at installation.
 await page.goto(`${origin}${base}/board/`);
 await page.getByRole('heading',{name:'내 관찰 보드',exact:false}).waitFor();
 await page.getByRole('button',{name:'관찰 추가',exact:true}).click();
 await page.getByRole('button',{name:'카메라 켜기',exact:true}).click();
 await page.getByRole('button',{name:'사진 촬영하기',exact:true}).click();
 await page.getByText('기록 더하기',{exact:false}).click();
 await page.getByRole('textbox',{name:'이름 선택',exact:true}).fill('오프라인 촬영 검증');
 await page.getByRole('button',{name:'내 기록에 저장'}).click();
 await page.getByRole('button',{name:'홈으로',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:'오프라인 촬영 검증 기록 열기'}).waitFor();
 const manifest=await page.evaluate(async()=>{const link=document.querySelector('link[rel=manifest]');return fetch(link.href).then(r=>r.json());});
 if(manifest.start_url!=='./board/')throw new Error('Wrong board install start URL');
 await page.goto(`${origin}${base}/plants/demo-tree-001/`);await page.getByRole('link',{name:'내 관찰 시작하기'}).click();await page.getByRole('button',{name:'오늘의 자연 기록하기'}).waitFor();
 if(errors.length)throw new Error(errors.join('\n'));console.log('PASS: production basePath, first-visit precache, offline reload, local review, PDF rendering, offline board camera and persistence, board manifest, zero page errors');
}catch(error){await mkdir('test-results',{recursive:true});if(diagnosticPage){await diagnosticPage.screenshot({path:'test-results/production-failure.png',fullPage:true});console.error('PAGE:',await diagnosticPage.locator('body').innerText());}throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
