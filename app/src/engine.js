import { COMPANIONS } from './levels.js';

const copy = value => structuredClone(value);
export const adjacent = (a, b, cols = 7) => Math.abs(a % cols - b % cols) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1;

/** A deterministic rules engine, independent of rendering, clocks, storage and purchases. */
export class Game {
  constructor(level, seed = level.seed, saved = null) {
    this.root = level;
    this.phaseIndex = saved?.phaseIndex || 0;
    this.level = this.phaseIndex ? {...level,...level.phases[this.phaseIndex]} : level;
    this.seed = seed >>> 0;
    this.rng = this.seed;
    this.serial = 0;
    this.moves = this.level.moves;
    this.budget = this.moves;
    this.score = 0;
    this.turn = 0;
    this.phaseTurn = 0;
    this.counts = this.emptyCounts();
    this.stats = {clears:0,ice:0,coral:0,rescue:0,special:0,net:0,lantern:0,moves:0,currents:0};
    this.charge = 0;
    this.companion = 0;
    this.status = 'playing';
    this.configureBoard();
    if (saved) {
      if (saved.levelId !== level.id || saved.board?.length !== this.size || saved.version !== 2) throw new Error('Incompatible saved game');
      for (const key of ['seed','rng','serial','moves','budget','score','turn','phaseTurn','counts','stats','charge','companion','status','ice','coral','nets','lanterns','board']) this[key] = copy(saved[key]);
      return;
    }
    this.fillBoard();
  }
  emptyCounts(){return {collect:[0,0,0,0,0,0],ice:0,coral:0,rescue:0,special:0,lantern:0,net:0};}
  configureBoard(){
    const level=this.level;
    this.cols=level.cols;this.rows=level.rows;this.size=this.cols*this.rows;
    this.mask=level.mask?.length===this.size?level.mask:Array(this.size).fill(true);
    this.exits=level.exits||Array.from({length:this.cols},(_,c)=>(this.rows-1)*this.cols+c);
    this.ice=Array.from({length:this.size},(_,i)=>level.ice?.[i]||0);
    this.coral=Array.from({length:this.size},(_,i)=>level.coral?.[i]||0);
    this.nets=Array.from({length:this.size},(_,i)=>level.nets?.[i]||0);
    this.lanterns=Array.from({length:this.size},(_,i)=>Object.hasOwn(level.lanterns||{},i)?level.lanterns[i]:-1);
    this.board=Array(this.size).fill(null);
  }
  fillBoard(){
    for (let i = 0; i < this.size; i++) if (this.mask[i] && !this.coral[i]) {
      let type, tries = 0;
      do { type = this.randomType(); tries++; } while (tries < 50 && (
        (i % this.cols >= 2 && this.board[i-1]?.type === type && this.board[i-2]?.type === type) ||
        (i >= this.cols * 2 && this.board[i-this.cols]?.type === type && this.board[i-this.cols*2]?.type === type)
      ));
      this.board[i] = this.tile(type);
    }
    const entries=this.level.entries||Array.from({length:this.level.rescue||0},(_,n)=>2+n*2);
    for(const i of entries)this.board[i]=this.tile(6);
    this.ensureMoves();
  }

  random() {
    this.rng = (this.rng + 0x6D2B79F5) >>> 0;
    let t = this.rng;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  randomType() { return Math.floor(this.random() * this.level.colors); }
  tile(type = this.randomType(), special = null) { return { id: ++this.serial, type, special }; }
  snapshot() {
    return copy({ version:2, levelId:this.root.id, phaseIndex:this.phaseIndex, seed:this.seed, rng:this.rng, serial:this.serial, moves:this.moves, budget:this.budget, score:this.score, turn:this.turn, phaseTurn:this.phaseTurn, counts:this.counts, stats:this.stats, charge:this.charge, companion:this.companion, status:this.status, ice:this.ice, coral:this.coral, nets:this.nets, lanterns:this.lanterns, board:this.board });
  }
  clone() { return new Game(this.root, this.seed, this.snapshot()); }
  progress(goal) { return goal.kind === 'collect' ? this.counts.collect[goal.piece] : this.counts[goal.kind]; }
  complete() { return this.level.goals.every(g => this.progress(g) >= g.target); }
  neighbors(i) {
    return [i-1, i+1, i-this.cols, i+this.cols].filter(j => j >= 0 && j < this.size && this.mask[j] && adjacent(i,j,this.cols));
  }

  matches() {
    const runs = [];
    for (const axis of ['row', 'col']) {
      const outer = axis === 'row' ? this.rows : this.cols;
      const inner = axis === 'row' ? this.cols : this.rows;
      for (let a = 0; a < outer; a++) {
        let run = [], type = -1;
        const finish = () => { if (run.length >= 3) runs.push({ indices: run, axis }); };
        for (let b = 0; b <= inner; b++) {
          const i = axis === 'row' ? a*this.cols+b : b*this.cols+a;
          const next = b < inner ? this.board[i]?.type : -1;
          if (next != null && next >= 0 && next < 6 && next === type) run.push(i);
          else {
            finish();
            type = next ?? -1;
            run = next != null && next >= 0 && next < 6 ? [i] : [];
          }
        }
      }
    }
    const groups = [];
    for (const run of runs) {
      const touching = groups.filter(g => run.indices.some(i => g.indices.has(i)));
      const group = { indices: new Set(run.indices), runs: [run] };
      for (const old of touching) {
        for (const i of old.indices) group.indices.add(i);
        group.runs.push(...old.runs);
        groups.splice(groups.indexOf(old), 1);
      }
      groups.push(group);
    }
    return groups;
  }

  canSwap(a,b) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || !adjacent(a,b,this.cols) || !this.board[a] || !this.board[b] || this.nets[a] || this.nets[b]) return false;
    const t1 = this.board[a], t2 = this.board[b];
    if ((t1.special && t2.special) || (t1.special === 'pearl' && t2.type !== 6) || (t2.special === 'pearl' && t1.type !== 6)) return true;
    [this.board[a], this.board[b]] = [t2,t1];
    const valid = this.matches().some(g => g.indices.has(a) || g.indices.has(b));
    [this.board[a], this.board[b]] = [t1,t2];
    return valid;
  }
  legalMoves() {
    const moves = [];
    for (let a = 0; a < this.size; a++) for (const b of [a+1, a+this.cols]) if (b < this.size && this.canSwap(a,b)) moves.push([a,b]);
    return moves;
  }

  ensureMoves() {
    if (this.legalMoves().length) return false;
    this.reshuffle();
    return true;
  }
  reshuffle() {
    const positions = this.board.flatMap((t,i) => t && t.type !== 6 && !this.nets[i] ? [i] : []);
    const tiles = positions.map(i => this.board[i]);
    for (let attempt = 0; attempt < 500; attempt++) {
      for (let i = tiles.length-1; i > 0; i--) {
        const j = Math.floor(this.random()*(i+1));
        [tiles[i],tiles[j]] = [tiles[j],tiles[i]];
      }
      positions.forEach((p,i) => { this.board[p] = tiles[i]; });
      if (!this.matches().length && this.legalMoves().length) return;
    }
    // Recovery for pathologically constrained boards: recolor ordinary pieces only.
    for (let attempt = 0; attempt < 1000; attempt++) {
      positions.forEach(p => { if (!this.board[p].special) this.board[p].type = this.randomType(); });
      if (!this.matches().length && this.legalMoves().length) return;
    }
    throw new Error('Could not create a playable board');
  }

  area(center, radius) {
    const r = Math.floor(center/this.cols), c = center%this.cols;
    return Array.from({ length: this.size },(_,i) => i).filter(i => this.mask[i] && Math.abs(Math.floor(i/this.cols)-r) <= radius && Math.abs(i%this.cols-c) <= radius);
  }
  effect(i, special, color = null) {
    if (special === 'bomb') return this.area(i,1);
    if (special === 'pearl') {
      if (color == null) {
        const counts = Array(6).fill(0);
        this.board.forEach(t => { if (t && t.type >= 0 && t.type < 6) counts[t.type]++; });
        color = counts.indexOf(Math.max(...counts));
      }
      return this.board.flatMap((t,j) => t?.type === color || j === i ? [j] : []);
    }
    return Array.from({ length: this.size }, (_,j) => j).filter(j => this.mask[j] && (special === 'row' ? Math.floor(j/this.cols) === Math.floor(i/this.cols) : j%this.cols === i%this.cols));
  }

  blast(initial, creations, frames, combo, consumed = [], adjacentDamage = true) {
    const before = this.snapshot();
    const affected = new Set([...initial].filter(i=>this.mask[i]));
    const protectedCells = new Set(creations.map(c => c.at));
    const fired = new Set(consumed);
    const queue = [...affected];
    for (let q=0; q<queue.length; q++) {
      const i = queue[q], tile = this.board[i];
      if (tile?.special && !fired.has(i) && !protectedCells.has(i)) {
        fired.add(i);
        for (const j of this.effect(i,tile.special)) if (!affected.has(j)) { affected.add(j); queue.push(j); }
      }
    }
    const coralHits = new Set(), lanternHits=new Set();
    for (const i of affected) {
      if(this.lanterns[i]>=0&&this.lanterns[i]<2)lanternHits.add(i);
      if(adjacentDamage)for(const j of this.neighbors(i))if(this.lanterns[j]>=0&&this.lanterns[j]<2)lanternHits.add(j);
      if(this.nets[i]){this.nets[i]=0;this.counts.net++;this.stats.net++;}
      if (this.coral[i]) coralHits.add(i);
      if (adjacentDamage) for (const j of this.neighbors(i)) if (this.coral[j]) coralHits.add(j);
      if (this.ice[i]) { this.ice[i]--; if (!this.ice[i]) {this.counts.ice++;this.stats.ice++;} }
      const tile = this.board[i];
      if (!tile || tile.type === 6 || protectedCells.has(i)) continue;
      if (tile.type >= 0) {
        this.counts.collect[tile.type]++;
        this.stats.clears++;
        if (tile.type === COMPANIONS[this.companion].type) this.charge = Math.min(COMPANIONS[this.companion].charge, this.charge+1);
      }
      this.score += 60 * Math.min(combo,5);
      this.board[i] = null;
    }
    for (const i of coralHits) { this.coral[i]--; if (!this.coral[i]) { this.counts.coral++;this.stats.coral++; this.score += 150; } }
    for(const i of lanternHits){this.lanterns[i]++;if(this.lanterns[i]===2){this.counts.lantern++;this.stats.lantern++;this.score+=200;}}
    for (const c of creations) {
      this.board[c.at] = this.tile(c.special === 'pearl' ? -1 : c.type, c.special);
      this.counts.special++;
      this.stats.special++;
      this.score += 120;
    }
    frames.push({ type: 'clear', before, after: this.snapshot(), cells: [...affected].filter(i => !protectedCells.has(i)), coralHits: [...coralHits], combo, created: creations.length, fired: fired.size });
    this.gravity();
    frames.push({ type: 'drop', after: this.snapshot() });
    this.rescueFriends(frames);
  }

  gravity() {
    for (let c=0; c<this.cols; c++) {
      let bottom=this.rows-1;
      while (bottom>=0) {
        if (!this.mask[bottom*this.cols+c] || this.coral[bottom*this.cols+c] || this.nets[bottom*this.cols+c]) { bottom--; continue; }
        let top=bottom;
        while (top>0 && this.mask[(top-1)*this.cols+c] && !this.coral[(top-1)*this.cols+c] && !this.nets[(top-1)*this.cols+c]) top--;
        const tiles=[];
        for (let r=bottom;r>=top;r--) if (this.board[r*this.cols+c]) tiles.push(this.board[r*this.cols+c]);
        for (let r=bottom;r>=top;r--) this.board[r*this.cols+c]=tiles[bottom-r] || this.tile();
        bottom=top-1;
      }
    }
  }
  rescueFriends(frames) {
    let rescued;
    do {
      rescued=[];
      for (const i of this.exits) {
        if (this.board[i]?.type === 6) { rescued.push(i); this.board[i]=null; this.counts.rescue++;this.stats.rescue++; this.score+=500; }
      }
      if (rescued.length) { this.gravity(); frames.push({ type:'rescue', cells:rescued, after:this.snapshot() }); }
    } while (rescued.length);
  }

  resolve(frames, preferred = []) {
    let combo=0;
    for (let safety=0;safety<128;safety++) {
      const groups=this.matches();
      if (!groups.length) return;
      combo++;
      const cells=new Set(), creations=[];
      for (const group of groups) {
        group.indices.forEach(i => cells.add(i));
        const longest=group.runs.reduce((a,b) => a.indices.length >= b.indices.length ? a : b);
        const special=longest.indices.length>=5 ? 'pearl' : new Set(group.runs.map(r=>r.axis)).size>1 ? 'bomb' : longest.indices.length===4 ? longest.axis : null;
        if (special) {
          const candidates=[...preferred,...group.indices].filter(i=>group.indices.has(i) && !this.board[i]?.special);
          const at=candidates[0] ?? [...group.indices][0];
          creations.push({ at, special, type:this.board[at].type });
        }
      }
      this.blast(cells,creations,frames,combo);
      preferred=[];
    }
    throw new Error('Cascade safety limit exceeded');
  }

  finish(frames) {
    if (this.complete()) this.status=this.phaseIndex<(this.root.phases?.length||1)-1?'phase':'won';
    else if (this.moves<=0) this.status='lost';
    else if (this.ensureMoves()) frames.push({ type:'shuffle', after:this.snapshot() });
    frames.push({ type:'settled', after:this.snapshot() });
    return { valid:true, frames, state:this.snapshot() };
  }

  advancePhase(){
    if(this.status!=='phase')return{valid:false,frames:[]};
    const carry=Math.min(5,Math.max(0,this.moves));
    this.phaseIndex++;
    this.level={...this.root,...this.root.phases[this.phaseIndex]};
    this.moves=this.level.moves+carry;this.budget+=this.level.moves;
    this.rng=(this.seed+this.phaseIndex*15485863)>>>0;
    this.phaseTurn=0;this.counts=this.emptyCounts();this.status='playing';
    this.configureBoard();this.fillBoard();
    return{valid:true,frames:[{type:'phase',carry,after:this.snapshot()}],state:this.snapshot()};
  }
  applyCurrent(frames){
    const current=this.level.current;
    if(!current||this.phaseTurn%current.every!==0||this.complete())return;
    const path=current.path.filter(i=>this.board[i]&&!this.nets[i]&&this.board[i].type!==6);
    if(path.length<2)return;
    const tiles=path.map(i=>this.board[i]),step=current.direction;
    path.forEach((cell,j)=>{this.board[cell]=tiles[(j-step+path.length)%path.length];});
    this.stats.currents++;
    frames.push({type:'current',cells:path,after:this.snapshot()});
    this.resolve(frames);this.rescueFriends(frames);
  }

  swap(a,b) {
    if (this.status!=='playing' || !this.canSwap(a,b)) return { valid:false, frames:[], state:this.snapshot() };
    const first=this.board[a], second=this.board[b], frames=[];
    [this.board[a],this.board[b]]=[second,first];
    this.moves--; this.turn++;this.phaseTurn++;this.stats.moves++;
    frames.push({ type:'swap', after:this.snapshot() });
    if (first.special==='pearl' || second.special==='pearl') {
      const pearl=first.special==='pearl' ? b : a, other=pearl===a ? b : a;
      const mate=this.board[other];
      let cells;
      if (mate.special==='pearl') cells=Array.from({length:this.size},(_,i)=>i);
      else {
        cells=[pearl,...this.effect(pearl,'pearl',mate.type)];
        if (mate.special) {
          const colored=[...cells].filter(i=>this.board[i]?.type===mate.type);
          for (const i of colored) cells.push(...this.effect(i,mate.special));
        }
      }
      this.blast(cells,[],frames,1,[a,b]);
    } else if (first.special && second.special) {
      let cells;
      if (first.special==='bomb' && second.special==='bomb') cells=this.area(b,2);
      else if (first.special==='bomb' || second.special==='bomb') {
        cells=[];
        for (const i of this.area(b,1)) cells.push(...this.effect(i,'row'),...this.effect(i,'col'));
      } else cells=[...this.effect(b,'row'),...this.effect(b,'col')];
      this.blast([...cells,a,b],[],frames,1,[a,b]);
    }
    this.resolve(frames,[b,a]);
    this.applyCurrent(frames);
    return this.finish(frames);
  }

  activate(i) {
    if (this.status!=='playing' || !this.board[i]?.special || this.nets[i]) return { valid:false,frames:[] };
    const frames=[];
    this.moves--;this.turn++;this.phaseTurn++;this.stats.moves++;
    this.blast([i],[],frames,1);
    this.resolve(frames);
    this.applyCurrent(frames);
    return this.finish(frames);
  }

  boost(kind, i = 0) {
    if (this.status!=='playing') return {valid:false,frames:[]};
    if (kind==='hammer' && (!Number.isInteger(i) || i<0 || i>=this.size || (!this.board[i] && !this.coral[i]) || this.board[i]?.type===6)) return {valid:false,frames:[]};
    if (!['hammer','shuffle','companion'].includes(kind)) return {valid:false,frames:[]};
    const frames=[];
    if (kind==='shuffle') { this.reshuffle();frames.push({type:'shuffle',after:this.snapshot()}); }
    else if (kind==='hammer') this.blast([i],[],frames,1,[],false);
    else {
      const companion=COMPANIONS[this.companion];
      if (this.charge<companion.charge) return {valid:false,frames:[]};
      this.charge=0;
      if (this.companion===1) {
        for (let j=0;j<this.size;j++) if (this.ice[j]) { this.ice[j]--;if (!this.ice[j]) {this.counts.ice++;this.stats.ice++;} }
        frames.push({type:'tide',after:this.snapshot()});
      } else {
        const candidates=this.board.flatMap((t,j)=>t && t.type<6 && !t.special && !this.nets[j] ? [j] : []);
        if (!candidates.length) {this.charge=companion.charge;return {valid:false,frames:[]};}
        const at=candidates[Math.floor(candidates.length/2)];
        this.board[at]=this.tile(this.companion===2 ? -1 : this.board[at].type,this.companion===2 ? 'pearl' : 'row');
        frames.push({type:'gift',after:this.snapshot()});
      }
    }
    this.resolve(frames);
    return this.finish(frames);
  }
  stars() {
    if (this.status!=='won') return 0;
    const saved=(this.budget-this.stats.moves)/this.budget;
    return saved>=0.3 ? 3 : saved>=0.12 ? 2 : 1;
  }
}
