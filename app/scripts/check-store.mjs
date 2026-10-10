import {readFile,access} from 'node:fs/promises';
const root=new URL('../../',import.meta.url),config=JSON.parse(await readFile(new URL('store/publisher.json',root)));
const missing=[];
if(!config.publisherName)missing.push('Publisher/company name');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail))missing.push('Public support email');
if(!/^https:\/\/[^\s]+$/.test(config.policyBaseUrl))missing.push('Published HTTPS policy-site URL');
if(!['13+','mixed'].includes(config.audience))missing.push('Confirmed target audience (13+ or mixed; complete corresponding Play declarations)');
try{const f=JSON.parse(await readFile(new URL('android-app/app/google-services.json',root)));if(!f.client?.some(c=>c.client_info?.android_client_info?.package_name==='com.pengucrush.islands'))missing.push('Firebase config for com.pengucrush.islands');}catch{missing.push('Firebase Android client configuration');}
for(const key of ['PENGU_STORE_FILE','PENGU_STORE_PASSWORD','PENGU_KEY_ALIAS','PENGU_KEY_PASSWORD'])if(!process.env[key])missing.push(key+' signing configuration');
if(process.env.PENGU_STORE_FILE)try{await access(process.env.PENGU_STORE_FILE);}catch{missing.push('Readable upload keystore');}
if(process.argv.includes('--online')&&config.policyBaseUrl){
 for(const page of ['privacy.html','terms.html','deletion.html','support.html'])try{const response=await fetch(config.policyBaseUrl.replace(/\/$/,'')+'/'+page);const body=await response.text();if(!response.ok||!response.headers.get('content-type')?.includes('text/html')||!body.includes('PenguCrush')||body.includes('Preview policy'))missing.push(`Public policy page is not ready: ${page}`);}catch{missing.push(`Public policy URL not reachable: ${page}`);}
}
console.log(JSON.stringify({ready:missing.length===0,missing,manualPlayConsoleItems:['Developer identity/contact verification','Target audience and IARC content rating','Data safety reviewed against the final SDK configuration','App access: no login required','Ads declaration: no ads','Upload-key signing and Play App Signing','Store listing assets and mandatory testing for the developer account']},null,2));
process.exitCode=missing.length?1:0;
