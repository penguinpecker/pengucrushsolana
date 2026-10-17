import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordedGame, scoreProof } from '../../app/src/recorded-game.js';
import { LEVELS } from '../../app/src/levels.js';
import { replay, verifyReplay } from '../replay.js';
export function winningGame(seedStart=1) {
  for(let seed=seedStart;seed<seedStart+100;seed++) {
    const game=new RecordedGame(LEVELS[0],seed);
    while(game.status==='playing')game.swap(...game.legalMoves()[0]);
    if(game.status==='won')return game;
  }
  throw Error('No winning test run');
}
test('a completed recorded run survives resume and the server calculates its score',async()=>{
  const game=winningGame(),proof=scoreProof(game.snapshot());
  const resumed=new RecordedGame(LEVELS[0],0,game.snapshot());
  assert.deepEqual(scoreProof(resumed.snapshot()),proof);
  const result=await verifyReplay({...proof,score:999999999});
  assert.equal(result.score,game.score);assert.equal(result.stars,game.stars());assert.equal(result.assisted,false);
});
test('incomplete, impossible, oversized, invalid and tampered runs are rejected',()=>{
  const game=winningGame(),proof=scoreProof(game.snapshot());
  assert.throws(()=>replay({...proof,actions:proof.actions.slice(0,1)}),/completed/);
  assert.throws(()=>replay({...proof,actions:[['swap',-1,500]]}),/verified/);
  assert.throws(()=>replay({...proof,actions:Array(257).fill(['boost','shuffle',0])}),/verified/);
  assert.throws(()=>replay({...proof,levelId:101}),/verified/);
  assert.throws(()=>replay({...proof,companion:900}),/verified/);
  assert.throws(()=>replay({...proof,actions:[...proof.actions,['swap',0,1]]}),/verified/);
});
test('both new powers replay exactly and mark the score as assisted',async()=>{
  for(const kind of ['blast','aurora']) {
    let winner;
    for(let seed=1;seed<100&&!winner;seed++) {
      const game=new RecordedGame(LEVELS[0],seed);
      assert(game.boost(kind,kind==='blast'?14:game.board.findIndex(t=>t?.type===0)).valid);
      while(game.status==='playing')game.swap(...game.legalMoves()[0]);
      if(game.status==='won')winner=game;
    }
    assert(winner);const result=await verifyReplay(scoreProof(winner.snapshot()));
    assert.equal(result.score,winner.score);assert.equal(result.assisted,true);
  }
});
