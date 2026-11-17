import { readdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=`${dir}/${entry.name}`;if(entry.isDirectory())result.push(...await walk(name));else result.push(name);}return result;}
const output=process.env.NATURE_LENS_DIST_DIR||'out';
const allFiles=(await walk(output)).sort();
const relative=f=>f.slice(output.length+1);
const files=allFiles.filter(f=>/\.(js|css|woff2?|png|jpe?g|svg|webmanifest)$/.test(f)&&!f.endsWith('/sw.js'));
const htmlFiles=allFiles.filter(f=>f.endsWith('/index.html'));
const routes=htmlFiles.filter(f=>!relative(f).startsWith('transfer/')).map(f=>base+'/'+relative(f).replace(/index\.html$/,''));
const urls=[...routes,...files.map(f=>base+'/'+relative(f))];
const source=await readFile('public/sw.js','utf8');
// Stable URLs (images and HTML especially) still need a new cache when bytes change.
// Hash only cached inputs, never the generated worker itself.
const contents=await Promise.all([...htmlFiles,...files].map(async file=>[
  relative(file),createHash('sha256').update(await readFile(file)).digest('hex'),
]));
const version=createHash('sha256').update(JSON.stringify({urls,contents,source})).digest('hex').slice(0,12);
await writeFile(`${output}/sw.js`,source.replace("'nature-lens-shell-v2'",`'nature-lens-shell-${version}'`).replace("[BASE,BASE+'manifest.webmanifest',BASE+'icon-192.png',BASE+'icon-512.png']",JSON.stringify(urls)));
await writeFile(`${output}/.nojekyll`,'');
console.log(`Offline shell: ${urls.length} assets, ${version}`);
