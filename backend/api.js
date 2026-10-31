import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { BUNDLES, catalogBundles, SCORE_LAMPORTS, fail, uuid } from './catalog.js';
import { verifyReplay } from './replay.js';
import { paymentTransaction, findPayment } from './payments.js';
import { activityTransaction } from './activity.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
function walletAddress(value) {
  try {const key=new PublicKey(value);if(typeof value!=='string'||!PublicKey.isOnCurve(key.toBytes()))throw Error();return key.toBase58();}
  catch {fail(400,'Choose a valid Solana wallet.');}
}
function publicOrder(row) {
  return {id:row.id,kind:row.kind,lamports:Number(row.lamports),treasury:row.treasury,status:row.status,
    payload:row.payload,signature:row.signature,createdAt:row.created_at};
}
export function createApp({pool,connection,treasury='',cluster='mainnet-beta',allowLocal=false}) {
  if(treasury) treasury=new PublicKey(treasury).toBase58();
  if(!['mainnet-beta','devnet'].includes(cluster))throw Error('Unsupported Solana cluster');
  const app=express();
  app.set('trust proxy',1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({origin(origin,done){done(null,!origin||['https://appassets.androidplatform.net','https://digitalchocolate.co'].includes(origin)||(allowLocal&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)));}}));
  app.use(express.json({limit:'48kb'}));
  app.use('/v1',rateLimit({windowMs:60_000,limit:120,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Please wait a minute before trying again.'}}));
  app.get('/health',async(req,res)=>{await pool.query('SELECT 1');res.json({ok:true,version:'0.6.2',database:'postgresql',cluster,paymentsEnabled:!!treasury});});
  app.get('/v1/catalog',(req,res)=>res.json({cluster,treasury:treasury||null,paymentsEnabled:!!treasury,scoreLamports:SCORE_LAMPORTS,bundles:catalogBundles(req.query.version==='2'?2:1)}));
  app.post('/v1/auth/challenge',rateLimit({windowMs:60_000,limit:10}),async(req,res)=>{
    const wallet=walletAddress(req.body.wallet),nonce=randomBytes(24).toString('hex'),expires=new Date(Date.now()+300_000);
    const message=`digitalchocolate.co wants you to sign in to PenguCrush:\n${wallet}\n\nConnect your wallet to submit scores and buy boosters. This signature does not transfer SOL.\n\nURI: https://digitalchocolate.co/pengucrush/\nVersion: 1\nChain: solana:${cluster}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}\nExpiration Time: ${expires.toISOString()}`;
    await pool.query('INSERT INTO challenges(nonce,wallet,message,expires_at) VALUES($1,$2,$3,$4)',[nonce,wallet,message,expires]);
    res.json({nonce,message});
  });
  app.post('/v1/auth/verify',async(req,res)=>{
    const wallet=walletAddress(req.body.wallet),{nonce,signature}=req.body;
    if(typeof nonce!=='string'||nonce.length!==48||typeof signature!=='string'||signature.length>100)fail(400,'Invalid sign-in.');
    const row=(await pool.query('SELECT * FROM challenges WHERE nonce=$1 AND wallet=$2 AND expires_at>now() AND used_at IS NULL',[nonce,wallet])).rows[0];
    let valid=false;
    try{valid=!!row&&nacl.sign.detached.verify(Buffer.from(row.message),bs58.decode(signature),new PublicKey(wallet).toBytes());}catch{}
    if(!valid)fail(401,'Wallet signature could not be verified. Please reconnect.');
    const token=randomBytes(32).toString('hex'),expires=new Date(Date.now()+7*86400_000);
    // Consuming the challenge (kept, marked used), recording the wallet and creating its session are one atomic statement.
    const result=await pool.query(`WITH consumed AS (UPDATE challenges SET used_at=now() WHERE nonce=$1 AND expires_at>now() AND used_at IS NULL RETURNING wallet),
      seen AS (INSERT INTO wallets(wallet,sign_ins) SELECT wallet,1 FROM consumed ON CONFLICT(wallet) DO UPDATE SET last_seen=now(),sign_ins=wallets.sign_ins+1)
      INSERT INTO sessions(token_hash,wallet,expires_at) SELECT $2,wallet,$3 FROM consumed RETURNING wallet`,[nonce,hash(token),expires]);
    if(!result.rowCount)fail(401,'This sign-in has expired or was already used.');
    res.json({wallet,token,expiresAt:expires});
  });
  const auth=async(req,res,next)=>{
    const token=req.get('Authorization')?.replace(/^Bearer /,'');
    if(!token||!/^[0-9a-f]{64}$/.test(token))return next(Object.assign(Error('Connect your wallet to continue.'),{status:401}));
    try{const row=(await pool.query('SELECT wallet FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hash(token)])).rows[0];
      if(!row)fail(401,'Your wallet session expired. Please reconnect.');req.wallet=row.wallet;req.tokenHash=hash(token);next();
    }catch(error){next(error);}
  };
  app.post('/v1/auth/logout',auth,async(req,res)=>{await pool.query('UPDATE sessions SET expires_at=now() WHERE token_hash=$1',[req.tokenHash]);res.json({ok:true});});
  const VERSION=/^[0-9A-Za-z.-]{1,20}$/,TYPES=['open','start','win','lose'],int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max,optional=(v,min,max)=>v==null||int(v,min,max);
  app.post('/v1/telemetry',rateLimit({windowMs:60_000,limit:30}),async(req,res)=>{
    const {installation,appVersion,push,events}=req.body??{};
    if(!uuid(installation)||typeof appVersion!=='string'||!VERSION.test(appVersion)||!Array.isArray(events)||events.length>100||
      push!=null&&(typeof push.token!=='string'||push.token.length>4096||typeof push.events!=='boolean'||typeof push.news!=='boolean')||
      !events.every(e=>uuid(e?.id)&&TYPES.includes(e.type)&&(e.type==='open'?optional(e.level,1,100):int(e.level,1,100))&&optional(e.score,0,10_000_000)&&optional(e.stars,0,3)&&typeof e.at==='number'))fail(400,'Invalid telemetry.');
    // A missing, malformed or expired session only means the events stay anonymous.
    const token=req.get('Authorization')?.replace(/^Bearer /,'');
    const wallet=token&&/^[0-9a-f]{64}$/.test(token)?(await pool.query('SELECT wallet FROM sessions WHERE token_hash=$1 AND expires_at>now()',[hash(token)])).rows[0]?.wallet??null:null;
    const now=Date.now(),rows=events.map(e=>({id:e.id,type:e.type,level:e.level??null,score:e.score??null,stars:e.stars??null,
      at:Number.isFinite(e.at)&&e.at>=Date.UTC(2026,0,1)&&e.at<=now+300_000?new Date(e.at).toISOString():null}));
    const client=await pool.connect();let accepted;
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO installs(installation,app_version,wallet) VALUES($1,$2,$3) ON CONFLICT(installation) DO UPDATE SET last_seen=now(),app_version=excluded.app_version,wallet=COALESCE(excluded.wallet,installs.wallet)',[installation,appVersion,wallet]);
      if(push!=null)await client.query("UPDATE installs SET push_token=NULLIF($2::text,''),push_events=$3,push_news=$4,push_active=($2<>'' AND ($3 OR $4)),push_updated_at=now() WHERE installation=$1",[installation,push.token,push.events,push.news]);
      accepted=(await client.query(`INSERT INTO events(id,installation,wallet,type,level,score,stars,occurred_at,app_version)
        SELECT id,$1,$2,type,level,score,stars,COALESCE(at,now()),$3 FROM jsonb_to_recordset($4::jsonb) AS e(id uuid,type text,level integer,score integer,stars integer,at timestamptz)
        ON CONFLICT(id) DO NOTHING`,[installation,wallet,appVersion,JSON.stringify(rows)])).rowCount;
      await client.query('COMMIT');
    } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
    res.json({ok:true,accepted});
  });
  app.get('/v1/leaderboard',async(req,res)=>{
    const level=req.query.level===undefined||req.query.level==='all'?null:Number(req.query.level);
    if(level!==null&&(!Number.isInteger(level)||level<1||level>100))fail(400,'Choose a level from 1 to 100.');
    const query=level===null?`SELECT wallet,sum(score)::integer AS score,count(*)::integer AS levels,bool_or(assisted) AS assisted,max(achieved_at) AS achieved_at FROM scores GROUP BY wallet ORDER BY score DESC,achieved_at,wallet LIMIT 100`:
      `SELECT wallet,score,1 AS levels,stars,assisted,achieved_at FROM scores WHERE level=$1 ORDER BY score DESC,achieved_at,wallet LIMIT 100`;
    const rows=(await pool.query(query,level===null?[]:[level])).rows;
    res.set('Cache-Control','public, max-age=10').json({level:level??'all',entries:rows.map((r,i)=>({...r,rank:i+1})),updatedAt:new Date().toISOString()});
  });
  app.post('/v1/activity/transaction',auth,rateLimit({windowMs:3600_000,limit:100,keyGenerator:req=>req.wallet}),async(req,res)=>{
    const payload=await verifyReplay(req.body.proof);
    const {blockhash}=await connection.getLatestBlockhash('finalized');
    const transaction=activityTransaction(req.wallet,payload,blockhash).serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64');
    res.json({transaction});
  });
  app.get('/v1/orders',auth,async(req,res)=>{
    if(!uuid(req.query.installation))fail(400,'Invalid installation.');
    const rows=(await pool.query('SELECT * FROM orders WHERE wallet=$1 AND installation=$2 ORDER BY created_at DESC LIMIT 200',[req.wallet,req.query.installation])).rows;
    res.json({orders:rows.map(publicOrder)});
  });
  app.post('/v1/orders',auth,rateLimit({windowMs:3600_000,limit:60,keyGenerator:req=>req.wallet}),async(req,res)=>{
    if(!treasury)fail(503,'Payments are not available yet. You can keep playing for free.');
    const {kind,installation,idempotencyKey}=req.body;
    if(!uuid(installation)||!uuid(idempotencyKey))fail(400,'Invalid purchase request.');
    let payload,lamports,requestKey;
    if(kind==='score') {payload=await verifyReplay(req.body.proof);lamports=SCORE_LAMPORTS;requestKey=`score:${payload.replayHash}`;}
    else if(kind==='boosters') {payload=BUNDLES.find(b=>b.id===req.body.bundleId);if(!payload)fail(400,'Unknown booster pack.');lamports=payload.lamports;requestKey=`boosters:${idempotencyKey}`;}
    else fail(400,'Unknown purchase.');
    const row=(await pool.query(`INSERT INTO orders(id,wallet,installation,request_key,kind,lamports,treasury,reference,payload)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(wallet,request_key) DO UPDATE SET request_key=orders.request_key RETURNING *`,
    [randomUUID(),req.wallet,installation,requestKey,kind,lamports,treasury,Keypair.generate().publicKey.toBase58(),payload])).rows[0];
    if(row.installation!==installation)fail(409,'This run was already submitted from another installation.');
    res.json(publicOrder(row));
  });
  async function lockedOrder(req,perform) {
    if(!uuid(req.params.id))fail(400,'Invalid order.');
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const order=(await client.query('SELECT * FROM orders WHERE id=$1 AND wallet=$2 FOR UPDATE',[req.params.id,req.wallet])).rows[0];
      if(!order)fail(404,'Order not found.');
      const result=await perform(client,order);await client.query('COMMIT');return result;
    } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
  }
  async function confirm(client,order,signature) {
    if(order.status==='confirmed'||!order.blockhash)return order;
    const paid=await findPayment(connection,order,signature);
    if(!paid)return order;
    const confirmed=(await client.query("UPDATE orders SET status='confirmed',signature=$2,confirmed_at=now() WHERE id=$1 RETURNING *",[order.id,paid])).rows[0];
    if(order.kind==='score') {
      const p=order.payload;
      await client.query(`INSERT INTO scores(wallet,level,score,stars,assisted,order_id) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(wallet,level) DO UPDATE SET score=excluded.score,stars=excluded.stars,assisted=excluded.assisted,order_id=excluded.order_id,achieved_at=now() WHERE excluded.score>scores.score`,[order.wallet,p.level,p.score,p.stars,p.assisted,order.id]);
    }
    return confirmed;
  }
  app.post('/v1/orders/:id/confirm',auth,async(req,res)=>res.json(await lockedOrder(req,async(client,order)=>publicOrder(await confirm(client,order,req.body.signature)))));
  app.post('/v1/orders/:id/transaction',auth,async(req,res)=>res.json(await lockedOrder(req,async(client,order)=>{
    if(order.status==='confirmed')return {order:publicOrder(order)};
    if(order.blockhash) {
      order=await confirm(client,order);
      if(order.status==='confirmed')return {order:publicOrder(order)};
      // Never issue a second payable transaction while the previous one can land.
      if(await connection.getBlockHeight('finalized')<=Number(order.last_valid_height))return {order:publicOrder(order),transaction:order.transaction_base64};
    }
    const {blockhash,lastValidBlockHeight}=await connection.getLatestBlockhash('finalized');
    const transaction=paymentTransaction(order,blockhash).serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64');
    await client.query('UPDATE orders SET transaction_base64=$2,blockhash=$3,last_valid_height=$4 WHERE id=$1',[order.id,transaction,blockhash,lastValidBlockHeight]);
    return {order:publicOrder(order),transaction};
  })));
  app.delete('/v1/profile',auth,async(req,res)=>{
    const client=await pool.connect();
    try {await client.query('BEGIN');await client.query('DELETE FROM scores WHERE wallet=$1',[req.wallet]);await client.query('DELETE FROM challenges WHERE wallet=$1',[req.wallet]);await client.query('DELETE FROM sessions WHERE wallet=$1',[req.wallet]);await client.query('COMMIT');}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    res.json({ok:true});
  });
  app.use((error,req,res,next)=>{
    const status=error.status||error.statusCode||503;
    if(status>=500)console.error('Request failed',req.method,req.path,error.code||error.name);
    res.status(status).json({error:status<500?error.message:'The server could not finish this request. Please try again. No extra payment is needed to check an order.'});
  });
  return app;
}
