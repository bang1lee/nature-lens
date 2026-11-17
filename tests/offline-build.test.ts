import {test,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const script=path.resolve('scripts/build-offline.mjs');
const source=path.resolve('public/sw.js');
test('offline version tracks same-path image and HTML bytes, remains stable, respects custom output',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'nature-cache-'));
 try{
  await mkdir(path.join(root,'public'));await mkdir(path.join(root,'custom/mobile'),{recursive:true});
  await writeFile(path.join(root,'public/sw.js'),await readFile(source));
  await writeFile(path.join(root,'custom/mobile/index.html'),'<h1>one</h1>');
  await writeFile(path.join(root,'custom/photo.png'),'image-v1');
  const build=async()=>{execFileSync(process.execPath,[script],{cwd:root,env:{...process.env,NATURE_LENS_DIST_DIR:'custom',NEXT_PUBLIC_BASE_PATH:'/nature-lens'}});return readFile(path.join(root,'custom/sw.js'),'utf8');};
  const first=await build();expect(first).toContain('/nature-lens/mobile/');expect(first).toContain('/nature-lens/photo.png');
  expect(await build()).toBe(first);
  await writeFile(path.join(root,'custom/photo.png'),'image-v2');const imageChanged=await build();expect(imageChanged).not.toBe(first);
  await writeFile(path.join(root,'custom/mobile/index.html'),'<h1>two</h1>');const htmlChanged=await build();expect(htmlChanged).not.toBe(imageChanged);
  expect(await build()).toBe(htmlChanged);
 }finally{await rm(root,{recursive:true,force:true});}
});
