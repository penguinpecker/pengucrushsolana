import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url);
async function files(dir,prefix='') {
  const items=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    if(entry.name==='sw.js')continue;
    if(entry.isDirectory())items.push(...await files(new URL(entry.name+'/',dir),prefix+entry.name+'/'));
    else items.push('./'+prefix+entry.name);
  }
  return items;
}
const list=await files(root);
const hash=createHash('sha256');
for(const path of [...list].sort())hash.update(path).update(await readFile(new URL(path,root)));
const version=hash.digest('hex').slice(0,12);
await writeFile(new URL('sw.js',root),`const CACHE='pengu-islands-${version}';
const PRECACHE=${JSON.stringify(list)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pengu-islands-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return response;}).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())));});
`);
console.log(`Offline cache: ${list.length} files, revision ${version}`);
