import { Connection } from '@solana/web3.js';
const rpc=process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com';
const connection=new Connection(rpc,{commitment:'finalized',disableRetryOnRateLimit:true,fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})});
const {lastValidBlockHeight}=await connection.getLatestBlockhash('finalized');
const height=await connection.getBlockHeight('finalized');
console.log(JSON.stringify({rpcReachable:true,lastValidBlockHeight,finalizedHeight:height}));
