let context;
export function sound(kind,enabled=true,step=1) {
  if(!enabled)return;
  try {
    context ||= new (window.AudioContext||window.webkitAudioContext)();
    if(context.state==='suspended')context.resume();
    const notes=kind==='win'?[523,659,784,1047]:kind==='match'?[392*Math.min(2,1+(step-1)*.12),523*Math.min(2,1+(step-1)*.12)]:kind==='invalid'?[180]:kind==='special'?[523,784,1047]:[440];
    notes.forEach((hz,i)=>{
      const time=context.currentTime+i*.075;
      const osc=context.createOscillator(),gain=context.createGain();
      osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.055,time+.008);gain.gain.exponentialRampToValueAtTime(.001,time+.18);
      osc.connect(gain);gain.connect(context.destination);osc.start(time);osc.stop(time+.2);
    });
  } catch { /* Audio is optional when a WebView or browser blocks it. */ }
}
