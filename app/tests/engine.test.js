import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, adjacent } from '../src/engine.js';
import { LEVELS, auditLevels } from '../src/levels.js';

const fixture = () => {
  const g=new Game({...LEVELS[0],cols:7,rows:8,mask:Array(56).fill(true),exits:[49,50,51,52,53,54,55],goals:[{kind:'collect',piece:0,target:999}]});
  g.board=Array.from({length:56},(_,i)=>g.tile((Math.floor(i/7)*2+i%7)%4));
  return g;
};
test('all 100 campaign levels have consistent, achievable goal definitions',()=>assert.deepEqual(auditLevels(),[]));
test('initial boards contain no matches and always allow a move across 2,000 seeds',()=>{
  for(const l of LEVELS) for(let seed=1;seed<=20;seed++) {
    const g=new Game(l,seed*7919);
    assert.equal(g.matches().length,0,`initial match in ${l.id}/${seed}`);
    assert.ok(g.legalMoves().length,`dead board in ${l.id}/${seed}`);
    assert.equal(g.board.filter(t=>t?.type===6).length,l.rescue);
  }
});
test('same seed gives same board and invalid swaps leave the entire state unchanged',()=>{
  const a=new Game(LEVELS[0],100), b=new Game(LEVELS[0],100);
  assert.deepEqual(a.snapshot(),b.snapshot());
  const before=a.snapshot();assert.equal(a.swap(0,55).valid,false);assert.deepEqual(a.snapshot(),before);
  let pair;
  for(let i=0;i<55;i++)if(adjacent(i,i+1,a.cols)&&!a.canSwap(i,i+1)){pair=[i,i+1];break;}
  assert.equal(a.swap(...pair).valid,false);assert.deepEqual(a.snapshot(),before);
});
test('one valid turn spends exactly one move, completes cascades, and remains playable',()=>{
  const g=new Game(LEVELS[0]);const result=g.swap(...g.legalMoves()[0]);
  assert.equal(result.valid,true);assert.equal(g.moves,LEVELS[0].moves-1);assert.equal(g.matches().length,0);
  assert.ok(g.board.every(Boolean));assert.ok(g.legalMoves().length);
});
test('four in a row creates a rocket; five creates a pearl',()=>{
  for(const [length,special] of [[4,'row'],[5,'pearl']]) {
    const g=fixture();for(let i=21;i<21+length;i++)g.board[i]=g.tile(0);
    for(const row of [2,4]) for(let c=0;c<7;c++)g.board[row*7+c]=g.tile(1+c%3);
    const frames=[];g.resolve(frames,[23]);
    assert.equal(frames[0].after.board[23].special,special);
    assert.ok(g.counts.special>=1);
  }
});
test('intersecting T and L matches create one puffer',()=>{
  const g=fixture();for(const i of [22,23,24,16,30])g.board[i]=g.tile(3);
  const frames=[];g.resolve(frames,[23]);assert.equal(frames[0].after.board[23].special,'bomb');
});
test('ice is fixed to squares and loses one layer per blast',()=>{
  const g=fixture();g.ice[24]=2;const frames=[];
  g.blast([24],[],frames,1);assert.equal(g.ice[24],1);assert.equal(g.counts.ice,0);
  g.blast([24],[],frames,1);assert.equal(g.ice[24],0);assert.equal(g.counts.ice,1);
});
test('coral receives at most one hit per cascade wave',()=>{
  const g=fixture();g.coral[24]=2;g.board[24]=null;
  g.blast([23,25,17,31],[],[],1);assert.equal(g.coral[24],1);assert.equal(g.counts.coral,0);
  g.blast([23],[],[],1);assert.equal(g.coral[24],0);assert.equal(g.counts.coral,1);
});
test('gravity keeps pieces in their own coral-separated column segments',()=>{
  const g=fixture();g.coral[24]=1;g.board[24]=null;
  const above=g.board[17].id,below=g.board[31].id;g.board[38]=null;g.board[45]=null;g.board[52]=null;
  g.gravity();assert.equal(g.board[17].id,above);assert.equal(g.board[52].id,below);assert.equal(g.board[24],null);
});
test('rescues cannot be destroyed by blasts and are collected only at the exit',()=>{
  const g=fixture();g.board[3]=g.tile(6);const id=g.board[3].id;
  g.blast([3],[],[],1);assert.ok(g.board.some(t=>t?.id===id));assert.equal(g.counts.rescue,0);
  for(let r=1;r<8;r++)g.board[r*7+3]=null;g.gravity();g.rescueFriends([]);
  assert.equal(g.counts.rescue,1);assert.ok(!g.board.some(t=>t?.id===id));
});
test('rocket + rocket clears a cross; pearl + pearl clears the board',()=>{
  const g=fixture();g.board[23]=g.tile(1,'row');g.board[24]=g.tile(2,'col');
  const result=g.swap(23,24);const clear=result.frames.find(f=>f.type==='clear');
  assert.equal(clear.cells.length,14);assert.equal(g.moves,LEVELS[0].moves-1);
  const h=fixture();h.board[23]=h.tile(-1,'pearl');h.board[24]=h.tile(-1,'pearl');
  assert.equal(h.swap(23,24).frames.find(f=>f.type==='clear').cells.length,56);
});
test('pearl + color collects every piece of that color',()=>{
  const g=fixture();g.board[23]=g.tile(-1,'pearl');const target=g.board[24].type;
  const count=g.board.filter(t=>t.type===target).length;
  g.swap(23,24);assert.ok(g.counts.collect[target]>=count);
});
test('automatic dead-board shuffle costs no moves and preserves all pieces',()=>{
  const g=fixture();g.board.forEach((t,i)=>t.type=(Math.floor(i/7)+i%7)%4);
  assert.equal(g.legalMoves().length,0);const ids=g.board.map(t=>t.id).sort();
  const moves=g.moves;assert.equal(g.ensureMoves(),true);assert.equal(g.moves,moves);
  assert.deepEqual(g.board.map(t=>t.id).sort(),ids);assert.equal(g.matches().length,0);assert.ok(g.legalMoves().length);
});
test('save and restore continue with the same future random draws',()=>{
  const g=new Game(LEVELS[4]);g.swap(...g.legalMoves()[0]);const h=new Game(LEVELS[4],0,g.snapshot());
  const move=g.legalMoves()[0];g.swap(...move);h.swap(...move);assert.deepEqual(g.snapshot(),h.snapshot());
});
test('goals win without a second score gate and final-move wins take priority',()=>{
  const g=new Game(LEVELS[0]);g.counts.collect[0]=15;g.score=0;g.moves=0;g.stats.moves=g.budget;g.finish([]);
  assert.equal(g.status,'won');assert.equal(g.stars(),1);
});
test('boosters and companions do not spend a move, and unavailable powers do nothing',()=>{
  const g=fixture(), before=g.snapshot();assert.equal(g.boost('companion').valid,false);assert.deepEqual(g.snapshot(),before);
  g.charge=18;assert.equal(g.boost('companion').valid,true);assert.equal(g.charge,0);assert.equal(g.moves,LEVELS[0].moves);
  g.boost('hammer',10);assert.equal(g.moves,LEVELS[0].moves);g.boost('shuffle');assert.equal(g.moves,LEVELS[0].moves);
});
test('closed games reject moves and boosters',()=>{
  const g=fixture();g.status='lost';assert.equal(g.swap(0,1).valid,false);assert.equal(g.boost('shuffle').valid,false);
});
test('hammer chips only its target, without hitting neighboring coral',()=>{
  const g=fixture();g.coral[24]=2;g.coral[25]=2;g.board[24]=null;g.board[25]=null;
  const result=g.boost('hammer',24),first=result.frames[0].after;
  assert.equal(first.coral[24],1);assert.equal(first.coral[25],2);
});
test('pearl + rocket activates the matched color across multiple lines',()=>{
  const g=fixture();g.board[23]=g.tile(-1,'pearl');g.board[24]=g.tile(1,'row');
  const expected=new Set([23,24]);g.board.forEach((t,i)=>{if(t.type===1)g.effect(i,'row').forEach(p=>expected.add(p));});
  const frame=g.swap(23,24).frames.find(f=>f.type==='clear');
  assert.ok(frame.cells.length>=expected.size);assert.equal(g.moves,LEVELS[0].moves-1);
});
test('puffer + puffer makes a 5 by 5 blast and puffer + rocket makes broad cross',()=>{
  for(const special of ['bomb','row']){
    const g=fixture();g.board[23]=g.tile(1,'bomb');g.board[24]=g.tile(2,special);
    const frame=g.swap(23,24).frames.find(f=>f.type==='clear');
    assert.equal(frame.cells.length,special==='bomb'?25:36);
  }
});
