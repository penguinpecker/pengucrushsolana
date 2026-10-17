// Original, locally synthesized expedition music and effects. No downloads or tracking.
let context,musicBus,effectsBus,timer,nextBeat=0,beat=0,unlocked=false,nativePaused=false;
let preferences={music:true,effects:true,scene:'camp'};
const frequency=midi=>440*2**((midi-69)/12);
const melody=[
  [72,null,76,79,null,76,74,72], [69,null,72,76,null,74,72,null],
  [65,null,69,72,77,null,76,72], [67,null,71,74,null,79,77,74],
  [76,79,84,null,79,76,74,72], [69,72,76,null,81,79,76,null],
  [77,null,76,72,69,72,76,77], [79,null,77,74,71,74,72,null],
];
const chords=[[48,60,64,67],[45,57,60,64],[41,53,57,60],[43,55,59,62]];
function graph() {
  if(context)return context;
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Audio)return null;
  context=new Audio();
  musicBus=context.createGain();musicBus.gain.value=.42;musicBus.connect(context.destination);
  effectsBus=context.createGain();effectsBus.gain.value=preferences.effects?1:0;effectsBus.connect(context.destination);
  return context;
}
function note(hz,time,duration,volume,bus,type='sine',endHz=null) {
  const oscillator=context.createOscillator(),gain=context.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(hz,time);
  if(endHz)oscillator.frequency.exponentialRampToValueAtTime(endHz,time+duration);
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(volume,time+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  oscillator.connect(gain);gain.connect(bus);oscillator.start(time);oscillator.stop(time+duration+.025);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
}
function schedule() {
  if(!context||context.state!=='running'||!preferences.music||nativePaused||document.hidden)return;
  const length=60/(preferences.scene==='play'?112:96)/2;
  while(nextBeat<context.currentTime+.12) {
    const bar=Math.floor(beat/8)%8,step=beat%8,chord=chords[bar%4],pitch=melody[bar][step];
    if(pitch) {
      note(frequency(pitch),nextBeat,.30,.08,musicBus,'sine');
      note(frequency(pitch+12),nextBeat,.13,.017,musicBus,'triangle');
    }
    if(step===0||step===4)note(frequency(chord[0]),nextBeat,.42,.09,musicBus,'triangle');
    if(step%2===1)note(frequency(chord[1+Math.floor(step/2)%3]),nextBeat,.20,.027,musicBus,'sine');
    if(step===0||step===4)note(105,nextBeat,.12,.07,musicBus,'sine',45);
    if(preferences.scene==='play'&&step%2===0)note(1800,nextBeat,.035,.012,musicBus,'triangle',650);
    beat=(beat+1)%64;nextBeat+=length;
  }
}
function sync() {
  if(!context)return;
  const active=unlocked&&!nativePaused&&!document.hidden;
  effectsBus.gain.setTargetAtTime(preferences.effects?1:0,context.currentTime,.02);
  musicBus.gain.setTargetAtTime(preferences.music ? .42 : 0,context.currentTime,.08);
  clearInterval(timer);timer=null;
  if(!active||(!preferences.music&&!preferences.effects)){void context.suspend().catch(()=>{});return;}
  void context.resume().then(()=>{
    if(!unlocked||nativePaused||document.hidden||!preferences.music)return;
    nextBeat=context.currentTime+.04;clearInterval(timer);timer=setInterval(schedule,50);schedule();
  }).catch(()=>{});
}
export function configureAudio(options) {preferences={...preferences,...options};sync();}
export function installAudioLifecycle() {
  const unlock=()=>{if(unlocked&&context?.state==='running')return;unlocked=true;try{graph();sync();}catch{/* Audio must never block play. */}};
  const pause=()=>{nativePaused=true;sync();},resume=()=>{nativePaused=false;sync();};
  document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',sync);globalThis.addEventListener('pengu:native-pause',pause);globalThis.addEventListener('pengu:commerce-resume',resume);
  return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',sync);globalThis.removeEventListener('pengu:native-pause',pause);globalThis.removeEventListener('pengu:commerce-resume',resume);clearInterval(timer);if(context)void context.suspend().catch(()=>{});};
}
export function sound(kind,enabled=true,step=1) {
  if(!enabled||!preferences.effects||nativePaused||globalThis.document?.hidden)return;
  try {
    if(!graph())return;
    if(context.state==='suspended')void context.resume().catch(()=>{});
    const now=context.currentTime+.008;
    if(kind==='blast') {
      note(150,now,.48,.20,effectsBus,'triangle',35);
      [72,79,84,88].forEach((p,i)=>note(frequency(p),now+i*.055,.28,.065,effectsBus));return;
    }
    if(kind==='aurora') {
      [72,76,79,84,88,91,96].forEach((p,i)=>note(frequency(p),now+i*.047,.38,.067,effectsBus));return;
    }
    const notes=kind==='win'?[72,76,79,84,79,84,88]:kind==='match'?[67,72,76]:kind==='invalid'?[48,45]:kind==='special'?[72,79,84,88]:kind==='shuffle'?[60,64,67,72]:[79];
    notes.forEach((pitch,i)=>note(frequency(pitch+(kind==='match'?Math.min(7,Math.max(0,step-1)*2):0)),now+i*(kind==='win'?.105:.045),kind==='win'?.38:.19,kind==='tap'?.04:.07,effectsBus,kind==='invalid'?'triangle':'sine'));
  } catch { /* Audio is optional when blocked by the device. */ }
}
