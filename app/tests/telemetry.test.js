import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import pkg from '../package.json' with {type:'json'};
import {track,flushTelemetry} from '../src/telemetry.js';

const QUEUE='pengucrush_telemetry_queue_v1',memory=new Map();
globalThis.localStorage={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
mock.timers.enable({apis:['setTimeout']});
const queue=()=>JSON.parse(memory.get(QUEUE)||'[]');
const fill=n=>memory.set(QUEUE,JSON.stringify(Array.from({length:n},(_,i)=>({id:`e${i}`,type:'start',level:1,at:i}))));
let calls=[];
const reply=(status=200)=>async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});return {ok:status<300,status,json:async()=>({ok:true})};};
test.beforeEach(()=>{memory.clear();calls=[];globalThis.location={search:''};delete globalThis.PenguNative;globalThis.fetch=reply();});

test('qa and review sessions record nothing',()=>{
  for(const search of ['?qa=1','?review']){globalThis.location={search};track('open');}
  assert.equal(memory.has(QUEUE),false);
});
test('queue keeps the newest 1000 events and omits absent fields',()=>{
  fill(1000);track('lose',{level:4});
  const q=queue();assert.equal(q.length,1000);assert.equal(q[0].id,'e1');
  const last=q.at(-1);assert.equal(last.type,'lose');assert.equal(last.level,4);assert.equal('score' in last,false);assert.match(last.id,/^[0-9a-f-]{36}$/);
});
test('a successful flush sends the oldest 100 and removes exactly those; no push without the native bridge',async()=>{
  fill(150);await flushTelemetry();
  assert.equal(calls.length,1);const {url,init,body}=calls[0];
  assert.match(url,/\/v1\/telemetry$/);assert.equal(init.method,'POST');assert.equal(init.headers['Content-Type'],'application/json');assert.equal(init.headers.Authorization,undefined);
  assert.equal(body.appVersion,pkg.version);assert.match(body.installation,/^[0-9a-f-]{36}$/);assert.equal('push' in body,false);
  assert.deepEqual(body.events.map(e=>e.id),Array.from({length:100},(_,i)=>`e${i}`));
  assert.deepEqual(queue().map(e=>e.id),Array.from({length:50},(_,i)=>`e${i+100}`));
});
test('failed or unreachable flushes keep the queue and never throw',async()=>{
  fill(3);globalThis.fetch=reply(500);await flushTelemetry();assert.equal(queue().length,3);
  globalThis.fetch=reply(429);await flushTelemetry();assert.equal(queue().length,3);
  globalThis.fetch=async()=>{throw new TypeError('offline');};await flushTelemetry();assert.equal(queue().length,3);
});
test('a batch the server rejects as invalid is dropped so later events still go out',async()=>{
  fill(150);globalThis.fetch=reply(400);await flushTelemetry();
  assert.deepEqual(queue().map(e=>e.id),Array.from({length:50},(_,i)=>`e${i+100}`));
});
test('events tracked during an in-flight flush survive it, and only one request is in flight',async()=>{
  fill(2);let release;
  globalThis.fetch=(url,init)=>{calls.push({body:JSON.parse(init.body)});return new Promise(r=>{release=()=>r({ok:true,status:200,json:async()=>({ok:true})});});};
  const first=flushTelemetry();await Promise.resolve();track('win',{level:1,stars:3,score:900});
  const second=flushTelemetry();assert.equal(calls.length,1);
  release();await first;await second;
  const q=queue();assert.equal(q.length,1);assert.equal(q[0].type,'win');assert.equal(q[0].stars,3);
});
test('empty queue still reports; push state and wallet session ride along',async()=>{
  memory.set('pengu-wallet-session-v1',JSON.stringify({token:'a'.repeat(64),wallet:'w'}));
  globalThis.PenguNative={notificationStatus:()=>JSON.stringify({permission:true,events:true,news:false,token:'fcm-token'})};
  await flushTelemetry();
  assert.equal(calls[0].init.headers.Authorization,`Bearer ${'a'.repeat(64)}`);
  assert.deepEqual(calls[0].body.events,[]);assert.deepEqual(calls[0].body.push,{token:'fcm-token',events:true,news:false});
  globalThis.PenguNative={notificationStatus:()=>JSON.stringify({permission:true,events:false,news:false,token:'fcm-token'})};
  await flushTelemetry();assert.deepEqual(calls[1].body.push,{token:'',events:false,news:false});
});
