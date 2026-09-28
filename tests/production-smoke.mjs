import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
const root=path.resolve('out');
const server=createServer(async(req,res)=>{
 try{let requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/nature-lens/,'');if(requested.endsWith('/'))requested+='index.html';const file=path.resolve(root,'.'+requested);if(!file.startsWith(root+path.sep))throw new Error();const content=await readFile(file);const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(content);}catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(3108,'127.0.0.1',resolve));
const browser=await chromium.launch();
try{
 const context=await browser.newContext({timezoneId:'Pacific/Honolulu'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3108/nature-lens/');await page.getByRole('button',{name:'먼저 예제 3건으로 둘러보기'}).click();await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 편집'}).waitFor();
 await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 편집'}).click();
 await page.getByLabel('사진과 기록의 출판 권한·동의를 확인했습니다.').check();await page.getByLabel('사진에 인물과 개인정보가 없습니다.').check();await page.getByRole('button',{name:'검수 완료로 저장'}).click();await page.getByRole('button',{name:'기록집 만들기'}).click();await page.locator('.book-page').waitFor();
 await mkdir('test-results',{recursive:true});const pdf=await page.pdf({path:'test-results/recordbook.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
 const pageCount=(pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;if(pageCount!==2)throw new Error(`Expected cover + 1 record, got ${pageCount} pages`);
 await page.goto('http://127.0.0.1:3108/nature-lens/mobile/');await page.getByRole('heading',{name:'좋아하는 마음이 생명을 돌보는 기록으로.'}).waitFor();await page.getByRole('button',{name:'내 기록',exact:true}).click();await page.getByRole('button',{name:'겹겹이 펼쳐진 초록 기록 열기'}).waitFor();
 await page.getByRole('button',{name:'저널',exact:true}).click();await page.getByRole('button',{name:'9월호 미리 읽기'}).click();const journal=await page.pdf({path:'test-results/monthly-journal.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});const journalPages=(journal.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;if(journalPages!==6)throw new Error(`Expected 6 journal pages, got ${journalPages}`);
 if(errors.length)throw new Error(errors.join('\n'));console.log('PASS: production basePath, first-visit precache, offline reload, local review, PDF rendering, zero page errors');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
