import pkg from '../package.json' with {type:'json'};
import { api, installationId, walletSession } from './commerce.js';
import { getNotificationStatus, nativeNotifications, testSession } from './notifications.js';

const QUEUE='pengucrush_telemetry_queue_v1';
const load=()=>{try{const q=JSON.parse(localStorage.getItem(QUEUE));return Array.isArray(q)?q:[];}catch{return [];}};
const save=q=>{try{localStorage.setItem(QUEUE,JSON.stringify(q.slice(-1000)));}catch{}};
let timer,flight=null,again=false;
const later=()=>{clearTimeout(timer);timer=setTimeout(flushTelemetry,2000);};
// JSON drops undefined fields, so optional level/score/stars are omitted when absent.
export function track(type,{level,score,stars}={}){
  if(testSession())return;
  save([...load(),{id:crypto.randomUUID(),type,level,score,stars,at:Date.now()}]);later();
}
async function send(){
  const events=load().slice(0,100),drop=()=>{const sent=new Set(events.map(e=>e.id));save(load().filter(e=>!sent.has(e.id)));};
  try{
    const status=nativeNotifications()?getNotificationStatus():null;
    // The FCM token only leaves the device while a cloud category is on and Android allows notifications.
    const push=status&&{token:status.permission&&(status.events||status.news)&&status.token||'',events:!!status.events,news:!!status.news};
    await api('/telemetry',{method:'POST',session:walletSession()||undefined,body:{installation:installationId(),appVersion:pkg.version,events,...(push&&{push})}});
    drop();if(events.length===100)again=true;
  }catch(error){if(error.status===400)drop();} // A rejected batch would fail forever and block everything queued after it.
}
// One request at a time; a flush asked for mid-flight runs again afterwards. Never rejects.
export async function flushTelemetry(){
  if(flight){again=true;return flight;}
  flight=send();
  try{await flight;}finally{flight=null;if(again){again=false;later();}}
}
