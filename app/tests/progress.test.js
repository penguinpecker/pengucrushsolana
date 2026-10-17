import test from 'node:test';
import assert from 'node:assert/strict';
import {readProfile,saveProfile,awardWin,defaultProfile} from '../src/storage.js';
test('corrupt or unavailable storage falls back to a fresh profile',()=>{
  assert.equal(readProfile({getItem:()=>'{bad'}).unlocked,1);
  assert.equal(readProfile({getItem:()=>{throw Error();}}).unlocked,1);
  assert.equal(saveProfile(defaultProfile(),{setItem:()=>{throw Error();}}),false);
});
test('wins unlock the next level and improved stars reward only the difference',()=>{
  let p=awardWin(defaultProfile(),1,2);assert.equal(p.unlocked,2);assert.equal(p.coins,60);
  p=awardWin(p,1,2);assert.equal(p.coins,60);
  p=awardWin(p,1,3);assert.equal(p.coins,70);assert.equal(p.stars[1],3);
});
test('older saves get one power sample; spent samples and independent music preference persist',()=>{
  const old={...defaultProfile(),boosters:{hammer:9,shuffle:4},sound:false};delete old.music;
  let p=readProfile({getItem:()=>JSON.stringify(old)});
  assert.deepEqual(p.boosters,{hammer:9,shuffle:4,blast:1,aurora:1});assert.equal(p.music,true);assert.equal(p.sound,false);
  p.boosters.blast=0;p.boosters.aurora=0;p.music=false;
  const restored=readProfile({getItem:()=>JSON.stringify(p)});
  assert.equal(restored.boosters.blast,0);assert.equal(restored.boosters.aurora,0);assert.equal(restored.music,false);
});
