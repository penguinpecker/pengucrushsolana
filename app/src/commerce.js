import { useEffect, useRef, useState } from 'react';
import bs58 from 'bs58';
import network from '../../store/network.json' with {type:'json'};
import { BUNDLES, SCORE_LAMPORTS } from '../../backend/catalog.js';
import { BOOSTER_KEYS } from './boosters.js';

const SESSION='pengu-wallet-session-v1', INSTALLATION='pengu-installation-v1', PENDING='pengu-pending-purchase-v1';
const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const waiting=new Map();
globalThis.addEventListener?.('pengu:wallet',event=>{
  let result;try{result=typeof event.detail==='string'?JSON.parse(event.detail):event.detail;}catch{return;}
  const task=waiting.get(result.id);if(!task)return;waiting.delete(result.id);clearTimeout(task.timer);
  result.error?task.reject(Object.assign(new Error(result.error),{code:result.code})):task.resolve(result.data);
});
export const shortWallet=wallet=>wallet?`${wallet.slice(0,4)}…${wallet.slice(-4)}`:'';
export const sol=lamports=>Number(lamports/1e9).toLocaleString('en-US',{maximumFractionDigits:9});
export const nativeWalletAvailable=()=>!!globalThis.PenguNative?.walletRequest;
export function installationId(){let id=localStorage.getItem(INSTALLATION);if(!id){id=crypto.randomUUID();localStorage.setItem(INSTALLATION,id);}return id;}
export const walletSession=()=>read(SESSION);
function native(action,args={}) {
  if(!nativeWalletAvailable())return Promise.reject(new Error('Open the PenguCrush Android app on your Seeker to use its wallet.'));
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>{waiting.delete(id);reject(new Error('Wallet response interrupted. Check payment status if you approved it.'));},120000);
    waiting.set(id,{resolve,reject,timer});
    try{PenguNative.walletRequest(id,action,JSON.stringify(args));}catch(error){clearTimeout(timer);waiting.delete(id);reject(error);}
  });
}
export async function api(path,{method='GET',body,session}={}) {
  const endpoint=import.meta.env?.DEV?'/api':`${network.apiOrigin}/v1`;
  const response=await fetch(`${endpoint}${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Authorization:`Bearer ${session.token}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({error:'Could not reach PenguCrush. Please try again.'}));
  if(!response.ok)throw Object.assign(new Error(data.error||'Could not reach PenguCrush. Please try again.'),{status:response.status});
  return data;
}
export function applyBoosterReceipt(profile,order) {
  if(order.kind!=='boosters'||order.status!=='confirmed'||profile.paidReceipts?.[order.id])return profile;
  const amounts=BOOSTER_KEYS.map(key=>order.payload?.[key]??0);
  if(!amounts.some(n=>n>0)||amounts.some(n=>!Number.isInteger(n)||n<0||n>100))throw Error('Invalid purchase receipt. Contact support.');
  const boosters={...profile.boosters};
  BOOSTER_KEYS.forEach((key,index)=>{boosters[key]=(boosters[key]||0)+amounts[index];});
  return {...profile,boosters,paidReceipts:{...profile.paidReceipts,[order.id]:true}};
}
export function useCommerce(grant) {
  const [session,setSession]=useState(()=>read(SESSION));
  const sessionRef=useRef(session),grantRef=useRef(grant);grantRef.current=grant;
  const [catalog,setCatalog]=useState({cluster:network.cluster,bundles:BUNDLES,scoreLamports:SCORE_LAMPORTS,paymentsEnabled:false,loading:true});
  const [orders,setOrders]=useState([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const busyRef=useRef(false);
  function updateSession(value){if(value?.wallet!==sessionRef.current?.wallet)setOrders([]);value?write(SESSION,value):localStorage.removeItem(SESSION);sessionRef.current=value;setSession(value);}
  function merge(order){setOrders(rows=>[order,...rows.filter(r=>r.id!==order.id)]);if(order.status==='confirmed'){grantRef.current(order);const p=read(PENDING);if(p?.orderId===order.id)localStorage.removeItem(PENDING);}return order;}
  async function connectWallet(){
    if(sessionRef.current&&new Date(sessionRef.current.expiresAt)>new Date())return sessionRef.current;
    setNotice('Choose your wallet, then approve the sign-in message.');
    const connected=await native('connect');
    const wallet=bs58.encode(bytes(connected.walletBase64));
    const challenge=await api('/auth/challenge',{method:'POST',body:{wallet}});
    const signed=await native('signMessage',{walletBase64:connected.walletBase64,message:challenge.message});
    const authenticated=await api('/auth/verify',{method:'POST',body:{wallet,nonce:challenge.nonce,signature:bs58.encode(bytes(signed.signatureBase64))}});
    const value={...authenticated,walletBase64:connected.walletBase64};updateSession(value);setNotice('Wallet connected.');return value;
  }
  async function run(work) {
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setError('');
    try {return await work();} catch(e){if(e.status===401)updateSession(null);setNotice('');setError(e.name==='TimeoutError'?'Connection timed out. Check payment status before retrying.':e.message);}
    finally {busyRef.current=false;setBusy(false);}
  }
  async function checkOrder(id,signature,auth=sessionRef.current) {
    const order=await api(`/orders/${id}/confirm`,{method:'POST',session:auth,body:signature?{signature}:{}});return merge(order);
  }
  async function refreshOrders(auth=sessionRef.current,checkPending=false) {
    if(!auth)return;
    const data=await api(`/orders?installation=${installationId()}`,{session:auth});
    for(const order of data.orders)if(order.status==='confirmed'){grantRef.current(order);if(read(PENDING)?.orderId===order.id)localStorage.removeItem(PENDING);}
    setOrders(data.orders);
    if(checkPending)for(const order of data.orders.filter(o=>o.status==='pending').slice(0,8))await checkOrder(order.id,undefined,auth);
  }
  async function payOrder(order,auth) {
    if(order.status==='confirmed'){merge(order);setNotice(order.kind==='score'?'Your score is on the board!':'Your boosters are in the backpack!');return;}
    merge(order);
    const pending=read(PENDING)||{};write(PENDING,{...pending,orderId:order.id,wallet:auth.wallet});
    const result=await api(`/orders/${order.id}/transaction`,{method:'POST',body:{},session:auth});
    if(result.order.status==='confirmed'){merge(result.order);setNotice('Payment confirmed. Your purchase is ready.');return;}
    setNotice('Review the SOL payment in your wallet. You can cancel there.');
    const signed=await native('signAndSend',{walletBase64:auth.walletBase64,transaction:result.transaction});
    const signature=bs58.encode(bytes(signed.signatureBase64));write(PENDING,{...read(PENDING),signature});
    setNotice('Payment sent. Waiting for Solana confirmation…');
    for(let attempt=0;attempt<8;attempt++) {
      const confirmed=await checkOrder(order.id,signature,auth);
      if(confirmed.status==='confirmed'){setNotice(order.kind==='score'?'Your score is on the board!':'Your boosters are in the backpack!');return;}
      await new Promise(resolve=>setTimeout(resolve,4000));
    }
    setNotice('Still confirming. You can keep playing; use Check status in your backpack at any time.');
  }
  function purchase(input){return run(async()=>{
    if(!catalog.paymentsEnabled)throw Error('SOL purchases are not available yet. Keep playing and earn supplies with shells.');
    const auth=await connectWallet();
    let pending=read(PENDING);
    if(pending&&pending.wallet!==auth.wallet)pending=null;
    const requestTag=input.kind==='score'?`score:${input.proof.runId}`:`boosters:${input.bundleId}`;
    // A declined order must never force the player to pay before choosing another item.
    // Earlier orders remain recoverable in the server's installation history.
    if(pending?.requestTag&&pending.requestTag!==requestTag)pending=null;
    if(!pending?.body) {
      pending={wallet:auth.wallet,requestTag,body:{...input,installation:installationId(),idempotencyKey:crypto.randomUUID()}};
      write(PENDING,pending);
    }
    const order=await api('/orders',{method:'POST',body:pending.body,session:auth});
    await payOrder(order,auth);
  });}
  function check(){return run(async()=>{const auth=await connectWallet();const pending=read(PENDING);
    if(pending?.wallet===auth.wallet&&pending.body&&!pending.orderId){const order=await api('/orders',{method:'POST',body:pending.body,session:auth});merge(order);write(PENDING,{...pending,orderId:order.id});}
    await refreshOrders(auth,true);setNotice('Payment status updated. Pending payments can take a little longer.');
  });}
  function recordActivity(proof){return run(async()=>{
    if(!proof)throw Error('This level result is not ready to record.');
    const auth=await connectWallet();
    setNotice('Review the level activity transaction in your Seeker wallet.');
    const result=await api('/activity/transaction',{method:'POST',body:{proof},session:auth});
    await native('signAndSend',{walletBase64:auth.walletBase64,transaction:result.transaction});
    setNotice('Level activity sent to Solana.');
    return true;
  });}
  function retry(order){return run(async()=>{const auth=await connectWallet();await payOrder(order,auth);});}
  function loadCatalog(){
    return api('/catalog?version=2').then(data=>{if(data.cluster!==network.cluster)throw Error('Wallet network configuration changed. Update the app.');setCatalog({...data,loading:false});}).catch(e=>{setCatalog(c=>({...c,loading:false}));setError(e.message);});
  }
  useEffect(()=>{
    loadCatalog();
    if(sessionRef.current)run(()=>refreshOrders());
    const resume=()=>{loadCatalog();if(!busyRef.current&&sessionRef.current)run(()=>refreshOrders(undefined,true));};
    addEventListener('pengu:commerce-resume',resume);addEventListener('online',resume);
    return()=>{removeEventListener('pengu:commerce-resume',resume);removeEventListener('online',resume);};
  },[]);
  return {session,catalog,orders,busy,notice,error,purchase,check,retry,
    recordActivity,
    connect:()=>run(async()=>{const auth=await connectWallet();await refreshOrders(auth,true);}),
    disconnect:()=>run(async()=>{const auth=sessionRef.current;updateSession(null);setOrders([]);setNotice('Wallet disconnected.');try{if(auth)await api('/auth/logout',{method:'POST',session:auth});}finally{await native('disconnect');}}),
    deleteLeaderboard:()=>run(async()=>{const auth=await connectWallet();await api('/profile',{method:'DELETE',session:auth});updateSession(null);setOrders([]);setNotice('Your leaderboard entries and wallet sessions have been deleted. Blockchain transactions and payment receipts remain.');}),
  };
}
