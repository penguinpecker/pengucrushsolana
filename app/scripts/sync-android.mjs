import fs from 'node:fs/promises';
import opentype from 'opentype.js';
const project=new URL('../../android-app/',import.meta.url);
const www=new URL('app/src/main/assets/www/',project);
await fs.rm(www,{recursive:true,force:true});
await fs.mkdir(www,{recursive:true});
await fs.cp(new URL('../dist/',import.meta.url),www,{recursive:true});
async function font(name) {
  const b=await fs.readFile(new URL('../node_modules/@fontsource/'+name,import.meta.url));
  return opentype.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
}
const headline=await font('lilita-one/files/lilita-one-latin-400-normal.woff');
const body=await font('rubik/files/rubik-latin-500-normal.woff');
function line(f,text,size,baseline,color) {
  const glyphs=Array.from(text,c=>f.charToGlyph(c)), scale=size/f.unitsPerEm;
  const widths=glyphs.map((g,i)=>(g.advanceWidth+(i+1<glyphs.length?f.getKerningValue(g,glyphs[i+1]):0))*scale);
  let x=(240-widths.reduce((a,b)=>a+b,0))/2;
  const paths=glyphs.map((g,i)=>{const path=g.getPath(x,baseline,size).toPathData(2);x+=widths[i];return path;}).join(' ');
  return `<path android:fillColor="${color}" android:pathData="${paths}" />`;
}
const xml=`<?xml version="1.0" encoding="utf-8"?><vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="200dp" android:height="80dp" android:viewportWidth="240" android:viewportHeight="96">${line(headline,'PENGUCRUSH',34,48,'#172D3E')}${line(body,'BEYOND THE HORIZON',10,68,'#56778F')}</vector>\n`;
await fs.writeFile(new URL('app/src/main/res/drawable/splash_brand.xml',project),xml);
console.log('Synced the offline game and generated the native splash wordmark.');
