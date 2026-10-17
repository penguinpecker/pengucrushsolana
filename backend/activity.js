import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

const MEMO_PROGRAM=new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function activityTransaction(wallet,payload,blockhash) {
  const memo=JSON.stringify({app:'PenguCrush',type:'level-complete',level:payload.level,score:payload.score,stars:payload.stars,runId:payload.runId,replayHash:payload.replayHash});
  return new Transaction({feePayer:new PublicKey(wallet),recentBlockhash:blockhash}).add(new TransactionInstruction({
    programId:MEMO_PROGRAM,keys:[],data:Buffer.from(memo),
  }));
}
