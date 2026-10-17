import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBoosterReceipt } from '../src/commerce.js';
import { defaultProfile,saveProfile,deleteProfile } from '../src/storage.js';
test('only confirmed receipts credit boosters and repeated recovery cannot grant twice',()=>{
  const profile=defaultProfile(),order={id:'receipt-1',kind:'boosters',status:'pending',payload:{hammer:10,shuffle:10}};
  assert.equal(applyBoosterReceipt(profile,order),profile);
  order.status='confirmed';const result=applyBoosterReceipt(profile,order);
  assert.equal(result.boosters.hammer,13);assert.equal(result.boosters.shuffle,13);
  assert.equal(applyBoosterReceipt(result,order),result);
  const memory=new Map(),storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  saveProfile(result,storage);const reset=deleteProfile(storage);
  assert.equal(reset.boosters.hammer,3);assert.equal(applyBoosterReceipt(reset,order),reset);
});
test('power receipts grant exactly once without losing existing inventory; legacy packs preserve powers',()=>{
  const profile=defaultProfile(),order={id:'power-1',kind:'boosters',status:'confirmed',payload:{blast:2,aurora:2}};
  const result=applyBoosterReceipt(profile,order);
  assert.deepEqual(result.boosters,{hammer:3,shuffle:3,blast:3,aurora:3});
  assert.equal(applyBoosterReceipt(result,order),result);
  const old=applyBoosterReceipt(result,{...order,id:'old-pack',payload:{hammer:3,shuffle:3}});
  assert.deepEqual(old.boosters,{hammer:6,shuffle:6,blast:3,aurora:3});
  for(const payload of [{blast:-1},{blast:1.5},{blast:101},{blast:0,aurora:0},{blast:'2'}])assert.throws(()=>applyBoosterReceipt(profile,{...order,payload}),/Invalid/);
});
