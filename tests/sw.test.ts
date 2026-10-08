import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect,it } from 'vitest';
function harness(base:string){const listeners:Record<string,(event:any)=>void>={};let responses=0;const source=readFileSync('public/sw.js','utf8');vm.runInNewContext(source,{URL,Response,self:{location:{href:`https://nature.test${base}sw.js`,origin:'https://nature.test'},addEventListener:(name:string,fn:any)=>{listeners[name]=fn;}},fetch:()=>Promise.resolve(new Response('ok')),caches:{open:()=>Promise.resolve({put:()=>Promise.resolve()}),match:()=>Promise.resolve()}});return {send(path:string){listeners.fetch({request:new Request(`https://nature.test${path}`),respondWith(p:Promise<unknown>){responses++;p.catch(()=>{});},waitUntil(){}});return responses;}};}
it('bypasses API requests entirely at root and under the GitHub base path',()=>{for(const base of ['/','/nature-lens/']){const h=harness(base);expect(h.send(base+'api/transfers/test')).toBe(0);expect(h.send(base+'api/capabilities')).toBe(0);expect(h.send('/api/transfers/test')).toBe(0);expect(h.send(base+'board/')).toBe(1);}});
it('activates the next cache namespace and only removes app shell caches',async()=>{let removed:string[]=[];let namespace='';let work:Promise<unknown>=Promise.resolve();const source=readFileSync('public/sw.js','utf8');const listeners:Record<string,(e:any)=>void>={};vm.runInNewContext(source,{URL,self:{location:{href:'https://nature.test/sw.js'},addEventListener:(n:string,f:any)=>listeners[n]=f,clients:{claim:()=>{}},skipWaiting(){}},caches:{keys:async()=>['nature-lens-shell-v1','nature-lens-shell-v2','unrelated'],delete:async(n:string)=>{removed.push(n);},open:async(n:string)=>{namespace=n;return {addAll:async()=>{}};}}});listeners.install({waitUntil(p:Promise<unknown>){work=p;}});await work;expect(namespace).toBe('nature-lens-shell-v2');listeners.activate({waitUntil(p:Promise<unknown>){work=p;}});await work;expect(removed).toEqual(['nature-lens-shell-v1']);});
it('never stores no-store responses even for ordinary same-origin assets',async()=>{const listeners:Record<string,(e:any)=>void>={};let puts=0;let work:Promise<unknown>=Promise.resolve();vm.runInNewContext(readFileSync('public/sw.js','utf8'),{URL,Response,self:{location:{href:'https://nature.test/sw.js',origin:'https://nature.test'},addEventListener:(n:string,f:any)=>listeners[n]=f},fetch:async()=>({ok:true,type:'basic',headers:new Headers({'Cache-Control':'private, no-store'}),clone(){return this;}}),caches:{open:async()=>({put:async()=>{puts++;}})}});listeners.fetch({request:new Request('https://nature.test/transfer/'),respondWith(p:Promise<unknown>){work=p;},waitUntil(p:Promise<unknown>){work=Promise.all([work,p]);}});await work;await new Promise(r=>setTimeout(r,0));expect(puts).toBe(0);});

it('offline transfer navigation clears the fragment and explains reopening the complete link',async()=>{
 for(const base of ['/','/nature-lens/']){
  const listeners:Record<string,(e:any)=>void>={};let work:Promise<Response>=Promise.resolve(new Response());let reads=0;
  vm.runInNewContext(readFileSync('public/sw.js','utf8'),{URL,Response,self:{location:{href:`https://nature.test${base}sw.js`,origin:'https://nature.test'},addEventListener:(n:string,f:any)=>listeners[n]=f},fetch:async()=>{throw new Error('offline');},caches:{match:async()=>{reads++;return new Response('Studio shell');}}});
  listeners.fetch({request:{url:`https://nature.test${base}transfer/#secret-key`,method:'GET',mode:'navigate'},respondWith(p:Promise<Response>){work=p;},waitUntil(){}});
  const response=await work;const html=await response.text();expect(response.status).toBe(503);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(response.headers.get('Content-Type')).toContain('text/html');expect(html).toContain('history.replaceState(null,\'\',location.pathname)');expect(html).toContain('인터넷 연결');expect(html).toContain('전체 링크');expect(html).toContain(`href="${base}board/"`);expect(html).not.toContain('secret-key');expect(reads).toBe(0);
 }
});

it('offline builder excludes private transfer HTML from install precache at both base paths',async()=>{
 const source=readFileSync('public/sw.js','utf8');const builder=path.resolve('scripts/build-offline.mjs');
 for(const base of ['', '/nature-lens']){const dir=mkdtempSync(path.join(tmpdir(),'nature-sw-'));try{
  mkdirSync(path.join(dir,'out/board'),{recursive:true});mkdirSync(path.join(dir,'out/transfer'));mkdirSync(path.join(dir,'public'));writeFileSync(path.join(dir,'public/sw.js'),source);
  for(const page of ['out/index.html','out/board/index.html','out/transfer/index.html'])writeFileSync(path.join(dir,page),'hello');
  execFileSync(process.execPath,[builder],{cwd:dir,env:{...process.env,NEXT_PUBLIC_BASE_PATH:base}});let urls:string[]=[];let pending:Promise<unknown>=Promise.resolve();
  const listeners:Record<string,(e:any)=>void>={};vm.runInNewContext(readFileSync(path.join(dir,'out/sw.js'),'utf8'),{URL,self:{location:{href:`https://nature.test${base}/sw.js`},addEventListener:(n:string,f:any)=>listeners[n]=f,skipWaiting(){}},caches:{open:async()=>({addAll:async(v:string[])=>{urls=v;}})}});
  listeners.install({waitUntil(p:Promise<unknown>){pending=p;}});await pending;expect(urls).toContain(base+'/board/');expect(urls).not.toContain(base+'/transfer/');
 }finally{rmSync(dir,{recursive:true,force:true});}}
});
