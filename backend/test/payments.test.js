import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { paymentTransaction, verifyTransaction } from '../payments.js';
const key=()=>Keypair.generate().publicKey.toBase58();
test('payment verification rejects wrong receiver, amount, memo, payer, failed and unrelated transactions',()=>{
  const payer=Keypair.generate(),blockhash=key();
  const order={id:randomUUID(),wallet:payer.publicKey.toBase58(),treasury:key(),reference:key(),lamports:10_000_000,blockhash,created_at:new Date()};
  function response(changes={}) {const tx=paymentTransaction({...order,...changes},blockhash);tx.sign(payer);const signature=bs58.encode(tx.signature);return [signature,{meta:{err:null},blockTime:Math.floor(Date.now()/1000),transaction:{message:tx.compileMessage(),signatures:[signature]}}];}
  const [sig,tx]=response();assert.equal(verifyTransaction(order,tx,sig),true);
  for(const change of [{treasury:key()},{lamports:1},{id:randomUUID()},{reference:key()}]) {const [signature,wrong]=response(change);assert.throws(()=>verifyTransaction(order,wrong,signature),/does not match/);}
  assert.throws(()=>verifyTransaction({...order,wallet:key()},tx,sig),/does not match/);
  assert.throws(()=>verifyTransaction(order,{...tx,meta:{err:{InstructionError:[0,'InsufficientFunds']}}},sig),/did not succeed/);
  assert.throws(()=>verifyTransaction(order,tx,bs58.encode(new Uint8Array(64))),/signature/);
  assert.equal(verifyTransaction(order,null,sig),false);
});
