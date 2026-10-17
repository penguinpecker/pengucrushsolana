import { createHash } from 'node:crypto';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { Game } from '../app/src/engine.js';
import { LEVELS, COMPANIONS } from '../app/src/levels.js';
import { uuid, fail } from './catalog.js';

export function replay(proof) {
  const {version,runId,levelId,seed,companion,actions} = proof || {};
  if(version!==1 || !uuid(runId) || !Number.isInteger(levelId) || !LEVELS[levelId-1] ||
    !Number.isInteger(seed) || seed<0 || seed>0xffffffff || !Number.isInteger(companion) ||
    !COMPANIONS[companion] || !Array.isArray(actions) || !actions.length || actions.length>256) fail(400,'This run cannot be verified. Start a new level and try again.');
  const game=new Game(LEVELS[levelId-1],seed);
  if(COMPANIONS[companion].type>=game.level.colors) fail(400,'Invalid companion.');
  game.companion=companion;
  let assisted=false;
  for(const action of actions) {
    if(!Array.isArray(action)) fail(400,'Invalid replay.');
    const [type,a,b]=action;
    const cell=n=>Number.isInteger(n)&&n>=0&&n<game.size;
    let result;
    if(type==='swap'&&action.length===3&&cell(a)&&cell(b)) result=game.swap(a,b);
    else if(type==='activate'&&action.length===2&&cell(a)) result=game.activate(a);
    else if(type==='advance'&&action.length===1) result=game.advancePhase();
    else if(type==='boost'&&action.length===3&&['hammer','shuffle','companion','blast','aurora'].includes(a)&&cell(b)) {
      result=game.boost(a,b); if(a!=='companion') assisted=true;
    }
    if(!result?.valid) fail(400,'The recorded moves could not be verified.');
  }
  if(game.status!=='won') fail(400,'Only completed levels can be submitted.');
  return {level:levelId,score:game.score,stars:game.stars(),assisted,runId,
    replayHash:createHash('sha256').update(JSON.stringify([levelId,seed,companion,actions])).digest('hex')};
}
let activeWorkers=0;
export function verifyReplay(proof) {
  if(activeWorkers>=2)fail(429,'The score checker is busy. Please try again in a moment.');
  activeWorkers++;
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:proof,resourceLimits:{maxOldGenerationSizeMb:64}});
    const timer=setTimeout(()=>{worker.terminate();reject(Object.assign(new Error('Replay took too long.'),{status:400}));},5000);
    worker.once('message',result=>{clearTimeout(timer);result.error?reject(Object.assign(new Error(result.error),{status:400})):resolve(result);});
    worker.once('error',error=>{clearTimeout(timer);reject(error);});
    worker.once('exit',code=>{if(code){clearTimeout(timer);reject(new Error('Replay worker stopped.'));}});
  }).finally(()=>{activeWorkers--;});
}
if(!isMainThread) { try {parentPort.postMessage(replay(workerData));} catch(error) {parentPort.postMessage({error:error.message});} }
