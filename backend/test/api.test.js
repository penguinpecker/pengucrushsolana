import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Keypair,Transaction } from '@solana/web3.js';
import { createApp } from '../api.js';
import { RecordedGame,scoreProof } from '../../app/src/recorded-game.js';
import { LEVELS } from '../../app/src/levels.js';

test('PostgreSQL integration: wallet ownership, replay, exact payment, concurrency, receipts, leaderboard and deletion',{skip:!process.env.TEST_DATABASE_URL,timeout:120000},async t=>{
  const schema=`test_${randomUUID().replaceAll('-','')}`;
  const base={connectionString:process.env.TEST_DATABASE_URL,ssl:process.env.TEST_DATABASE_SSL==='1'?{rejectUnauthorized:false}:undefined};
  const admin=new pg.Pool(base);await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new pg.Pool({...base,options:`-c search_path=${schema}`,max:5});
  await pool.query(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
  const transactions=new Map(),blockhash=Keypair.generate().publicKey.toBase58();
  const connection={getLatestBlockhash:async()=>({blockhash,lastValidBlockHeight:1000}),getBlockHeight:async()=>500,
    getTransaction:async signature=>transactions.get(signature)||null,
    getSignaturesForAddress:async()=>[...transactions.keys()].map(signature=>({signature,err:null}))};
  const treasury=Keypair.generate().publicKey.toBase58(),wallet=Keypair.generate();
  const app=createApp({pool,connection,treasury,cluster:'devnet'}),server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  async function request(path,{method='GET',body,token,expected=200}={}) {
    const response=await fetch(origin+'/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
    const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;
  }
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
  assert.equal((await request('/catalog')).bundles.length,3);
  const newCatalog=await request('/catalog?version=2');assert.equal(newCatalog.bundles.length,5);assert.equal(newCatalog.bundles.find(b=>b.id==='power-duo').lamports,10000000);
  const address=wallet.publicKey.toBase58(),challenge=await request('/auth/challenge',{method:'POST',body:{wallet:address}});
  const signature=bs58.encode(nacl.sign.detached(Buffer.from(challenge.message),wallet.secretKey));
  await request('/auth/verify',{method:'POST',body:{wallet:address,nonce:challenge.nonce,signature:bs58.encode(new Uint8Array(64))},expected:401});
  const {token}=await request('/auth/verify',{method:'POST',body:{wallet:address,nonce:challenge.nonce,signature}});
  await request('/auth/verify',{method:'POST',body:{wallet:address,nonce:challenge.nonce,signature},expected:401});
  assert.ok((await pool.query('SELECT used_at FROM challenges WHERE nonce=$1',[challenge.nonce])).rows[0].used_at,'a used challenge is kept and marked');
  const signIns=async()=>(await pool.query('SELECT sign_ins FROM wallets WHERE wallet=$1',[address])).rows[0].sign_ins;
  assert.equal(await signIns(),1);
  let game;
  for(let seed=1;seed<100;seed++){game=new RecordedGame(LEVELS[0],seed);while(game.status==='playing')game.swap(...game.legalMoves()[0]);if(game.status==='won')break;}
  assert.equal(game.status,'won');
  const installation=randomUUID(),body={kind:'score',proof:{...scoreProof(game.snapshot()),score:9999999},installation,idempotencyKey:randomUUID(),lamports:1};
  await request('/orders',{method:'POST',body,expected:401});
  await request('/orders',{method:'POST',token,body:{...body,proof:{...body.proof,actions:[['swap',0,999]]}},expected:400});
  const order=await request('/orders',{method:'POST',body,token});assert.equal(order.lamports,10000000);assert.equal(order.payload.score,game.score);
  const duplicate=await request('/orders',{method:'POST',body,token});assert.equal(duplicate.id,order.id);
  const txResult=await request(`/orders/${order.id}/transaction`,{method:'POST',body:{},token});
  const retryTx=await request(`/orders/${order.id}/transaction`,{method:'POST',body:{},token});assert.equal(retryTx.transaction,txResult.transaction);
  const pending=await request(`/orders/${order.id}/confirm`,{method:'POST',body:{},token});assert.equal(pending.status,'pending');
  assert.equal((await request('/leaderboard')).entries.length,0);
  function finalize(encoded) {const tx=Transaction.from(Buffer.from(encoded,'base64'));tx.sign(wallet);const sig=bs58.encode(tx.signature);transactions.set(sig,{meta:{err:null},blockTime:Math.floor(Date.now()/1000),transaction:{message:tx.compileMessage(),signatures:[sig]}});return sig;}
  const paid=finalize(txResult.transaction);
  const confirmations=await Promise.all(Array.from({length:4},()=>request(`/orders/${order.id}/confirm`,{method:'POST',body:{signature:paid},token})));
  assert.ok(confirmations.every(row=>row.status==='confirmed'));
  const board=await request('/leaderboard');assert.equal(board.entries.length,1);assert.equal(board.entries[0].score,game.score);assert.equal(board.entries[0].wallet,address);
  const boosterBody={kind:'boosters',bundleId:'trail',installation,idempotencyKey:randomUUID(),lamports:1};
  const pack=await request('/orders',{method:'POST',body:boosterBody,token});assert.equal(pack.lamports,15000000);assert.equal(pack.payload.hammer,10);
  const packTx=await request(`/orders/${pack.id}/transaction`,{method:'POST',body:{},token});
  await request(`/orders/${pack.id}/confirm`,{method:'POST',body:{signature:paid},token,expected:400});
  finalize(packTx.transaction);
  const recovered=await request(`/orders/${pack.id}/confirm`,{method:'POST',body:{},token});assert.equal(recovered.status,'confirmed');
  const repeated=await request('/orders',{method:'POST',body:boosterBody,token});assert.equal(repeated.id,pack.id);assert.equal(repeated.status,'confirmed');
  const power=await request('/orders',{method:'POST',token,body:{kind:'boosters',bundleId:'arctic-arsenal',installation,idempotencyKey:randomUUID(),lamports:1,blast:999}});
  assert.equal(power.lamports,25000000);assert.equal(power.payload.blast,6);assert.equal(power.payload.aurora,6);
  const powerTx=await request(`/orders/${power.id}/transaction`,{method:'POST',body:{},token});finalize(powerTx.transaction);
  assert.equal((await request(`/orders/${power.id}/confirm`,{method:'POST',body:{},token})).status,'confirmed');
  const receipts=await request(`/orders?installation=${installation}`,{token});assert.equal(receipts.orders.length,3);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM orders WHERE status='confirmed'")).rows[0].n,3);
  // Telemetry: every install is recorded, events are idempotent, a session only adds the wallet.
  const install=randomUUID(),at=Date.now(),opened={id:randomUUID(),type:'open',at};
  const events=[opened,{id:randomUUID(),type:'start',level:1,at},{id:randomUUID(),type:'win',level:1,score:120,stars:3,at:at+600_000}];
  const telemetry=(body,options)=>request('/telemetry',{method:'POST',body:{installation:install,appVersion:'0.6.2',events:[],...body},...options});
  const installRow=id=>pool.query('SELECT wallet,push_token,push_events,push_news,push_active FROM installs WHERE installation=$1',[id]).then(r=>r.rows[0]);
  assert.equal((await telemetry({events},{token:'f'.repeat(64)})).accepted,3);
  assert.equal((await telemetry({events},{token:'garbage'})).accepted,0);
  assert.equal((await telemetry({events:[...events,{id:randomUUID(),type:'lose',level:2,at}]})).accepted,1);
  assert.equal((await installRow(install)).wallet,null);
  const times=(await pool.query('SELECT bool_and(wallet IS NULL) AS anonymous,bool_or(occurred_at=to_timestamp($2::float8/1000)) AS kept,bool_and(occurred_at<=now()) AS clamped FROM events WHERE installation=$1',[install,at])).rows[0];
  assert.deepEqual(times,{anonymous:true,kept:true,clamped:true});
  for(const bad of [{installation:'nope'},{events:[{...opened,type:'quit'}]},{events:[{id:randomUUID(),type:'win',at}]},{events:Array.from({length:101},()=>({id:randomUUID(),type:'open',at}))}])
    await telemetry(bad,{expected:400});
  const linked=randomUUID();
  assert.equal((await telemetry({installation:linked,events:[{id:randomUUID(),type:'open',at}]},{token})).accepted,1);
  await telemetry({installation:linked,events:[{id:randomUUID(),type:'open',at}]},{token:'garbage'});
  assert.equal((await installRow(linked)).wallet,address);
  assert.deepEqual((await pool.query('SELECT wallet FROM events WHERE installation=$1 ORDER BY wallet',[linked])).rows.map(r=>r.wallet),[address,null]);
  await telemetry({push:{token:'fcm-token',events:true,news:false}});
  await telemetry({});
  assert.deepEqual(await installRow(install),{wallet:null,push_token:'fcm-token',push_events:true,push_news:false,push_active:true});
  await telemetry({push:{token:'fcm-token',events:false,news:false}});assert.equal((await installRow(install)).push_active,false);
  await telemetry({push:{token:'',events:true,news:true}});
  assert.deepEqual(await installRow(install),{wallet:null,push_token:null,push_events:true,push_news:true,push_active:false});
  // A challenge stays one-use under concurrency; logout keeps the session row but rejects its token.
  const again=await request('/auth/challenge',{method:'POST',body:{wallet:address}});
  const signed=JSON.stringify({wallet:address,nonce:again.nonce,signature:bs58.encode(nacl.sign.detached(Buffer.from(again.message),wallet.secretKey))});
  const race=await Promise.all(Array.from({length:4},()=>fetch(origin+'/v1/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:signed}).then(async r=>({status:r.status,...await r.json()}))));
  assert.deepEqual(race.map(r=>r.status).sort(),[200,401,401,401]);
  assert.equal(await signIns(),2);
  const second=race.find(r=>r.status===200).token;
  await request('/auth/logout',{method:'POST',body:{},token:second});
  await request('/auth/logout',{method:'POST',body:{},token:second,expected:401});
  assert.deepEqual((await pool.query('SELECT count(*)::int AS kept,count(*) FILTER (WHERE expires_at>now())::int AS active FROM sessions WHERE wallet=$1',[address])).rows[0],{kept:2,active:1});
  const afterLogout=randomUUID();
  await telemetry({installation:afterLogout,events:[{id:randomUUID(),type:'open',at}]},{token:second});
  assert.equal((await installRow(afterLogout)).wallet,null);
  await request('/profile',{method:'DELETE',token});assert.equal((await request('/leaderboard')).entries.length,0);
  await request(`/orders?installation=${installation}`,{token,expected:401});
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,3);
});
