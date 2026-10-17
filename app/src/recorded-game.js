import { Game } from './engine.js';

// Presentation-free rules stay deterministic; the app separately records a replay.
export class RecordedGame extends Game {
  constructor(level, seed, saved = null) {
    super(level, seed, saved);
    this.proof = saved ? structuredClone(saved.proof || null) : {version:1, runId:crypto.randomUUID(), actions:[]};
  }
  snapshot() { return {...super.snapshot(), proof:structuredClone(this.proof || null)}; }
  record(action, perform) {
    const result = perform();
    if (result.valid && this.proof) this.proof.actions.push(action);
    if (result.valid) result.state = this.snapshot();
    return result;
  }
  swap(a,b) { return this.record(['swap',a,b],()=>super.swap(a,b)); }
  activate(i) { return this.record(['activate',i],()=>super.activate(i)); }
  boost(kind,i=0) { return this.record(['boost',kind,i],()=>super.boost(kind,i)); }
  advancePhase() { return this.record(['advance'],()=>super.advancePhase()); }
}
export function scoreProof(snapshot) {
  return snapshot?.proof && { ...snapshot.proof, levelId:snapshot.levelId, seed:snapshot.seed, companion:snapshot.companion };
}
