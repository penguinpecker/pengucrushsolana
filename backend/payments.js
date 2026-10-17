import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import bs58 from 'bs58';
import { fail } from './catalog.js';
const MEMO=new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
export function paymentTransaction(order,blockhash) {
  const from=new PublicKey(order.wallet);
  const transfer=SystemProgram.transfer({fromPubkey:from,toPubkey:new PublicKey(order.treasury),lamports:Number(order.lamports)});
  transfer.keys.push({pubkey:new PublicKey(order.reference),isSigner:false,isWritable:false});
  return new Transaction({feePayer:from,recentBlockhash:blockhash}).add(transfer,new TransactionInstruction({
    programId:MEMO,keys:[],data:Buffer.from(`pengucrush:${order.id}`),
  }));
}
// Verify the entire server-issued message, not a client claim of payment.
export function verifyTransaction(order,tx,signature) {
  if(!tx) return false;
  if(tx.meta?.err || !tx.meta || !order.blockhash) fail(400,'The payment did not succeed.');
  if(tx.transaction.signatures[0]!==signature) fail(400,'Payment signature does not match.');
  const message=tx.transaction.message;
  const expected=paymentTransaction(order,order.blockhash).serializeMessage();
  if(!Buffer.from(message.serialize()).equals(expected)) fail(400,'This transaction does not match this order.');
  if(tx.blockTime && tx.blockTime*1000<new Date(order.created_at).getTime()-120_000) fail(400,'Payment predates this order.');
  return true;
}
export async function findPayment(connection,order,signature) {
  if(signature) {
    try { if(bs58.decode(signature).length!==64) throw Error(); } catch { fail(400,'Invalid transaction signature.'); }
    const tx=await connection.getTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
    return verifyTransaction(order,tx,signature)?signature:null;
  }
  const rows=await connection.getSignaturesForAddress(new PublicKey(order.reference),{limit:20},'finalized');
  for(const row of rows) {
    if(row.err) continue;
    const tx=await connection.getTransaction(row.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
    try {if(verifyTransaction(order,tx,row.signature)) return row.signature;} catch(error) {if(!error.status)throw error;}
  }
  return null;
}
