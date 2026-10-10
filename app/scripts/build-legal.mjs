import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {policies} from '../../store/policies.js';
const root=new URL('../../',import.meta.url);
const config=JSON.parse(await readFile(new URL('store/publisher.json',root)));
const docs=policies(config), out=new URL('../public/legal/',import.meta.url);
await mkdir(out,{recursive:true});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const draft=!config.publisherName||!config.supportEmail;
const frame=(title,body)=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(title)} · PenguCrush</title><link rel="stylesheet" href="policy.css"><body><main><a class="brand" href="index.html">PENGUCRUSH / PRIVACY & PLAY</a><h1>${escape(title)}</h1>${body}<footer>PenguCrush · Updated ${escape(config.effectiveDate)} · Policy ${escape(config.policyVersion)}</footer></main></body></html>`;
await writeFile(new URL('policy.css',out),`*{box-sizing:border-box}body{background:#fff2cf;color:#172d3e;margin:0;font:16px/1.8 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:38px 24px 70px}h1{font-size:42px;line-height:1.1;margin:35px 0 20px}h2{font-size:23px;line-height:1.3;margin-top:32px}a{color:#286f64;text-underline-offset:4px}.brand{font-size:11px;font-weight:800;letter-spacing:1.5px;text-decoration:none}.draft{background:#ecd5a1;padding:14px;border-radius:8px;font-size:13px}footer{border-top:1px solid #bdc8b6;padding-top:25px;margin-top:45px;font-size:12px}nav a{display:block;padding:15px;border-bottom:1px solid #bdc8b6}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}details{border-bottom:1px solid #bdc8b6;padding:15px 0}summary{cursor:pointer}li{margin:10px 0}`);
for(const [key,doc]of Object.entries(docs))await writeFile(new URL(`${key}.html`,out),frame(doc.title,`${draft?'<p class="draft">Preview policy: publisher identity and a public contact must be configured before store release.</p>':''}<p>${escape(doc.intro)}</p>${doc.sections.map(([title,text])=>`<section><h2>${escape(title)}</h2><p>${escape(text)}</p></section>`).join('')}${doc.links?.map(([label,url])=>`<p><a rel="noopener noreferrer" href="${escape(url)}">${escape(label)}</a></p>`).join('')||''}`));
const notices=[];
for(const name of ['react','react-dom','scheduler','@phosphor-icons/react','@fontsource/lilita-one','@fontsource/rubik']){
 const pkg=new URL(`../node_modules/${name}/`,import.meta.url),meta=JSON.parse(await readFile(new URL('package.json',pkg)));
 notices.push({name,version:meta.version,text:await readFile(new URL('LICENSE',pkg),'utf8')});
}
let native=[];try{native=JSON.parse(await readFile(new URL('store/native-dependencies.json',root)));}catch{}
const apache=await readFile(new URL('store/Apache-2.0.txt',root),'utf8');
const protobuf=await readFile(new URL('store/Protobuf-BSD-3-Clause.txt',root),'utf8');
for(const row of native){
 if(row.name==='com.google.guava:listenablefuture')row.licenses=[{name:'Apache 2.0',url:'https://github.com/google/guava/blob/master/COPYING'}];
 const licenseText=row.licenses.some(l=>l.name.includes('Apache'))?apache:row.licenses.some(l=>l.name.includes('BSD'))?protobuf:'';
 notices.push({...row,text:[row.licenses.map(l=>`${l.name}\n${l.url}`).join('\n\n'),...(row.notices?.length?row.notices:[licenseText])].filter(Boolean).join('\n\n')});
}
await writeFile(new URL('licenses.json',out),JSON.stringify(notices));
await writeFile(new URL('licenses.html',out),frame('Third-party licenses',`<p>PenguCrush includes these libraries and fonts. Their authors retain their respective rights.</p>${notices.map(n=>`<details><summary>${escape(n.name)} ${escape(n.version)}</summary><pre>${escape(n.text)}</pre></details>`).join('')}`));
await writeFile(new URL('index.html',out),frame('Privacy & play',`<p>Policies, support and data controls for PenguCrush.</p><nav>${Object.entries(docs).map(([key,doc])=>`<a href="${key}.html">${escape(doc.title)}</a>`).join('')}<a href="licenses.html">Third-party licenses</a></nav>`));
await mkdir(new URL('store/site/',root),{recursive:true});
await cp(out,new URL('store/site/',root),{recursive:true});
console.log(`Generated public policy site and ${notices.length} dependency notices${draft?' (publisher details pending)':''}.`);
