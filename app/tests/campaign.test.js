import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,CHAPTERS,shapeMask} from '../src/campaign.js';
import {Game} from '../src/engine.js';
import {defaultProfile,readProfile,checkpointRun,awardWin,claimChest,claimQuest,quests,refreshDaily} from '../src/storage.js';
const fixture=()=>new Game({...LEVELS[0],cols:7,rows:8,mask:Array(56).fill(true),exits:[49,50,51,52,53,54,55],goals:[{kind:'collect',piece:0,target:999}]});
test('100 levels cover ten regions, nine shapes and 111 stages with explicit teaching breaks',()=>{
 assert.equal(LEVELS.length,100);assert.equal(CHAPTERS.length,10);
 assert.equal(LEVELS.reduce((n,l)=>n+l.phaseCount,0),111);
 assert.equal(new Set(LEVELS.flatMap(l=>l.phases.map(p=>p.shape))).size,9);
 for(let i=0;i<10;i++){assert.equal(LEVELS[i*10].difficulty,'gentle');assert.equal(LEVELS[i*10+5].difficulty,'gentle');assert.ok(LEVELS[i*10+9].phaseCount>=2);}
});
test('voids separate falling wells and line matches cannot cross them',()=>{
 const g=fixture();g.mask[24]=false;g.board[24]=null;const above=g.board[17].id,below=g.board[31].id;
 for(const i of [38,45,52])g.board[i]=null;g.gravity();
 assert.equal(g.board[17].id,above);assert.equal(g.board[52].id,below);assert.equal(g.board[24],null);
 g.board[23]=g.tile(0);g.board[25]=g.tile(0);assert.ok(g.matches().every(group=>!group.indices.has(24)));
});
test('nets anchor their piece, reject swaps, and break only when their square is hit',()=>{
 const g=fixture();g.nets[24]=1;const id=g.board[24].id;
 assert.equal(g.canSwap(24,25),false);g.board[31]=null;g.gravity();assert.equal(g.board[24].id,id);
 g.blast([23],[],[],1);assert.equal(g.nets[24],1);
 g.blast([24],[],[],1);assert.equal(g.nets[24],0);assert.equal(g.counts.net,1);assert.equal(g.stats.net,1);
});
test('a lantern receives one charge per wave and completes after two distinct waves',()=>{
 const g=fixture();g.lanterns[24]=0;
 g.blast([23,25,17,31],[],[],1);assert.equal(g.lanterns[24],1);assert.equal(g.counts.lantern,0);
 g.blast([23],[],[],1);assert.equal(g.lanterns[24],2);assert.equal(g.counts.lantern,1);
 g.blast([24],[],[],1);assert.equal(g.counts.lantern,1);
});
test('currents move every second valid turn without moving anchored pieces or rescue chicks',()=>{
 const g=fixture();g.level={...g.level,current:{path:[21,22,23,24,25,26,27],every:2,direction:1}};
 g.nets[24]=1;g.board[26]=g.tile(6);const ids=g.board.map(t=>t?.id);
 // Freeze cascade resolution only to inspect the channel transport itself.
 g.resolve=()=>{};g.rescueFriends=()=>{};
 g.phaseTurn=1;g.applyCurrent([]);assert.deepEqual(g.board.map(t=>t?.id),ids);
 g.phaseTurn=2;const frames=[];g.applyCurrent(frames);
 assert.equal(g.board[24].id,ids[24]);assert.equal(g.board[26].id,ids[26]);
 assert.equal(g.board[22].id,ids[21]);assert.equal(g.board[21].id,ids[27]);assert.equal(g.stats.currents,1);
});
test('finales require every stage, preserve a save at intermission and carry at most five moves',()=>{
 const level=LEVELS[99],g=new Game(level);const fill=()=>{for(const goal of g.level.goals)if(goal.kind==='collect')g.counts.collect[goal.piece]=goal.target;else g.counts[goal.kind]=goal.target;};
 fill();g.moves=9;g.finish([]);assert.equal(g.status,'phase');assert.equal(g.stars(),0);
 const h=new Game(level,0,g.snapshot());assert.deepEqual(h.snapshot(),g.snapshot());
 const previousBudget=g.budget;g.advancePhase();h.advancePhase();assert.deepEqual(h.snapshot(),g.snapshot());
 assert.equal(g.phaseIndex,1);assert.equal(g.moves,level.phases[1].moves+5);assert.equal(g.budget,previousBudget+level.phases[1].moves);assert.equal(g.counts.lantern,0);
 fill();g.finish([]);assert.equal(g.status,'phase');g.advancePhase();fill();g.finish([]);assert.equal(g.status,'won');assert.equal(g.phaseIndex,2);
});
test('existing player stars, inventory and currency migrate; old incompatible boards do not',()=>{
 const old={version:1,unlocked:31,stars:{1:3,10:2,20:1,30:3},coins:170,boosters:{hammer:5,shuffle:7},run:{version:1,levelId:12}};
 const p=readProfile({getItem:()=>JSON.stringify(old)});
 assert.equal(p.version,2);assert.equal(p.unlocked,31);assert.equal(p.coins,170);assert.equal(p.boosters.hammer,5);assert.equal(p.stars[10],2);assert.deepEqual(p.relics,[0,1,2]);assert.equal(p.run,null);
});
test('checkpoint retries never double-count quest progress, including after restore',()=>{
 let p=refreshDaily(defaultProfile()),g=new Game(LEVELS[0]);p=checkpointRun(p,g.snapshot());
 g.swap(...g.legalMoves()[0]);p=checkpointRun(p,g.snapshot());const once=p.stats.clears;
 p=checkpointRun(p,g.snapshot());assert.equal(p.stats.clears,once);
 const h=new Game(LEVELS[0],0,p.run);h.swap(...h.legalMoves()[0]);p=checkpointRun(p,h.snapshot());assert.equal(p.stats.clears,h.stats.clears);
});
test('quest claims are guarded, paid once, and new days get fresh baselines',()=>{
 let p=refreshDaily(defaultProfile(),'2026-09-24');const id='daily:2026-09-24:clears';
 assert.equal(claimQuest(p,id,'2026-09-24'),null);p.stats.clears=125;
 const result=claimQuest(p,id,'2026-09-24');assert.equal(result.profile.coins,35);assert.equal(claimQuest(result.profile,id,'2026-09-24'),null);
 p=refreshDaily(result.profile,'2026-09-25');assert.equal(quests(p,'2026-09-25').find(q=>q.id.endsWith(':clears')).value,0);
 assert.equal(claimQuest(p,id,'2026-09-25'),null);
});
test('regional chests use regional stars and cannot be farmed or claimed early',()=>{
 let p=defaultProfile();p.stars={1:3,2:3,3:2,15:3};assert.equal(claimChest(p,1,0),null);
 const result=claimChest(p,0,0);assert.equal(result.profile.coins,60);assert.equal(result.profile.boosters.hammer,4);
 assert.equal(claimChest(result.profile,0,0),null);assert.equal(claimChest(p,0,1),null);
});
test('beacon reward and win receipt are paid once and the final level caps unlock at 101',()=>{
 let p={...defaultProfile(),unlocked:100};p=awardWin(p,100,2,77);const before=structuredClone(p);
 assert.equal(p.unlocked,101);assert.deepEqual(p.relics,[9]);assert.equal(p.coins,160);assert.equal(p.boosters.hammer,4);
 p=awardWin(p,100,2,77);assert.equal(p.coins,before.coins);assert.equal(p.stats.wins,before.stats.wins);
 p=awardWin(p,100,3,78);assert.equal(p.coins,170);assert.equal(p.stats.wins,2);
});
test('beacon, chest and quest rewards preserve new power inventory',()=>{
 const p={...defaultProfile(),unlocked:10,boosters:{hammer:3,shuffle:3,blast:7,aurora:8},stars:{1:3,2:3,3:2}};
 assert.equal(awardWin(p,10,3,77).boosters.blast,7);
 assert.equal(claimChest(p,0,0).profile.boosters.aurora,8);
 assert.equal(claimQuest(p,'first-post').profile.boosters.blast,7);
});
