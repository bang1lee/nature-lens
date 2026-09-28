import { readdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=`${dir}/${entry.name}`;if(entry.isDirectory())result.push(...await walk(name));else result.push(name);}return result;}
const allFiles=await walk('out');
const files=allFiles.filter(f=>/\.(js|css|woff2?|png|svg|webmanifest)$/.test(f)&&!f.endsWith('/sw.js'));
const routes=allFiles.filter(f=>f.endsWith('/index.html')).map(f=>base+'/'+f.slice(4).replace(/index\.html$/,''));
const urls=[...routes,...files.map(f=>base+'/'+f.slice(4))];
const source=await readFile('public/sw.js','utf8');
const version=createHash('sha256').update(JSON.stringify(urls)+source).digest('hex').slice(0,12);
await writeFile('out/sw.js',source.replace("'nature-lens-shell-v1'",`'nature-lens-shell-${version}'`).replace("[BASE,BASE+'manifest.webmanifest',BASE+'icon-192.png',BASE+'icon-512.png']",JSON.stringify(urls)));
await writeFile('out/.nojekyll','');
console.log(`Offline shell: ${urls.length} assets, ${version}`);
