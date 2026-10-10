import tuning from './campaign-tuning.js';
export const CAMPAIGN_VERSION=3, LEVEL_COUNT=100;
export const PIECES=[
  {name:'Lagoon fish',short:'fish',color:'#23bfd1'},{name:'Peach star',short:'stars',color:'#ffaa59'},
  {name:'Berry shell',short:'shells',color:'#ec68a8'},{name:'Mint pop',short:'pops',color:'#68cc91'},
  {name:'Ice crystal',short:'crystals',color:'#8198ef'},{name:'Golden bell',short:'bells',color:'#efbd48'},
];
export const ACTS=['Cast off','Beyond the chart','Into the sky','The lost coast','Bring back the light'];
export const CHAPTERS=[
  ['Frosthaven','Every great voyage starts with cold feet.','frosthaven','Kip','#7ccbd4','#eaf0da','#6eaabd','#8dd6dd','First-light compass','The post office','Deliver the first signal. A whole ocean is waiting.','ice'],
  ['Coral Cove','Little friends. Very big currents.','coral-cove','Rook','#ec9b83','#ffe4b6','#db987b','#6dcacb','Tideglass shell','The tide observatory','Clear the reef and bring the lost chicks home.','coral'],
  ['Lantern Marsh','Follow the lights that follow you.','coral-cove','Juno','#bac86e','#e9e7aa','#80a774','#78b8ad','Firefly lantern','The lantern keeper','Wake the marsh lanterns, one warm glow at a time.','lantern'],
  ['Clockwork Quay','Good timing. Questionable machinery.','frosthaven','Kip','#eebd65','#f3d4a1','#b88862','#77b6c8','Brass tidewheel','The clock tower','Ride the moving channels to restart the old harbor.','current'],
  ['Crystal Orchard','Mind the branches. And the tangles.','aurora-peaks','Juno','#9eb0df','#d5e8cf','#82a7a5','#92cfdb','Prism seed','The glasshouse','Free the crystal grove from the abandoned fishing nets.','net'],
  ['Cloudline','Tickets, please. Next stop: the sky.','frosthaven','Kip','#e8bd98','#fff1d2','#aaaec6','#accfdf','Cloudstone ticket','The sky station','Cross the cloud bridges and get the gondola moving.','rescue'],
  ['Sunken Archive','Some stories are worth diving for.','coral-cove','Rook','#72bfb7','#cce2cc','#609ca4','#57aebd','Ammonite atlas','The drowned library','Light the reading rooms and uncover the old sea charts.','lantern'],
  ['Ember Atoll','Warm toes. Cool heads.','coral-cove','Rook','#eb9472','#efc69a','#ac7069','#83bdc4','Ember heart','The beacon forge','Break the basalt reef and relight the ancient forge.','coral'],
  ['Moonpetal Garden','The tide comes in. The flowers wake.','aurora-peaks','Juno','#b3a4d0','#d9e0bc','#8896af','#8caccb','Moonpetal lens','The moon pavilion','Guide the moonlit currents through the sleeping garden.','current'],
  ['Aurora Crown','Ten beacons. One extraordinary crew.','aurora-peaks','Juno','#b5cddd','#eef0df','#8fa8c9','#88b8d0','Northstar beacon','The final observatory','Bring all ten lights together. Find the way home.','all'],
].map(([name,subtitle,art,companion,color,land,edge,sea,relic,landmark,story,mechanic],id)=>({id,name,subtitle,art,companion,color,land,edge,sea,relic,landmark,story,mechanic,act:Math.floor(id/2),start:id*10+1,end:id*10+10,map:'journey'}));
export const COMPANIONS=[
  {name:'Kip',role:'The courier',description:'Gets there first. Asks for directions later. Fish matches charge a rocket drop.',power:'Rocket drop',type:0,unlock:1,charge:18},
  {name:'Rook',role:'The icebreaker',description:'Big crest. Short patience. Cracks a layer off every piece of ice.',power:'Icebreaker',type:2,unlock:11,charge:18},
  {name:'Juno',role:'The navigator',description:'Maps, snacks, backup maps. Crystal matches charge an aurora pearl.',power:'Northstar',type:4,unlock:21,charge:18},
];
export const DIFFICULTIES={gentle:{name:'Gentle',color:'#4a9e9e',pressure:.56},normal:{name:'Classic',color:'#3a98b6',pressure:.77},hard:{name:'Hard',color:'#c378b1',pressure:.97},super:{name:'Super hard',color:'#9a76cf',pressure:1.09},nightmare:{name:'Nightmarish',color:'#5966ad',pressure:1.2},legendary:{name:'Legendary',color:'#ba8b3c',pressure:1.14}};
export const SHAPES={rectangle:'Open water',rounded:'Ice floe',diamond:'Diamond',hourglass:'Hourglass',bridge:'Twin bays',cross:'Compass',lagoon:'Atoll',stairs:'Switchback',islands:'Split islands'};
const TITLES=[
  ['A little hello','Pocketful of stars','Special delivery','First frost','The slippery shortcut','A warm welcome','Around the ice floe','Snowflake switchback','A very cold parcel','Light the first beacon'],
  ['Rook joins the crew','A reef between friends','A little way home','The shell collector','Under the coral arch','A picnic at low tide','Two chicks, one boat','The reef has teeth','Last boat out','The heart of the cove'],
  ['A light in the reeds','Firefly neighbors','The lantern trail','Round the lily pond','A flicker in the fog','Tea with the keeper','A crooked little bridge','No chick left behind','The longest night','Wake the sleeping marsh'],
  ['All aboard the tide','Tick, tock, swap','The moving walkway','Clockwise, mostly','A wrench in the works','Lunch on the docks','Two lanes to nowhere','The clockmaker’s shortcut','Against the current','Restart the harbor'],
  ['Tangled in crystal','Cut the first knot','The glasshouse door','A garden of angles','The thorny route','Mint tea in the grove','A knot in every corner','Free the little gardeners','One last tangle','Make the orchard bloom'],
  ['Tickets to the clouds','The first sky bridge','A chick above the clouds','A station between worlds','Mind the gap','A picnic with a view','The upside of down','A pair of sky islands','Last gondola home','Open the cloudline'],
  ['The drowned reading room','A chapter by lamplight','Stories under ice','The spiral staircase','The room with no floor','A quiet afternoon','An atlas in pieces','The deep-water crossing','The forgotten passage','Recover the sea atlas'],
  ['Warm toes, cold fish','The basalt breakfast','A forge of two halves','The ember garden','The stubborn old reef','An afternoon in the shade','A narrow escape','The furnace channels','The last spark','Awaken the forge'],
  ['When the moon rises','The petal procession','A current of stars','The midnight lanterns','A twist in the tide','A moonlit picnic','The gardener’s secret','The silver crossing','Before the flowers close','Turn the moonlit tide'],
  ['The final ascent','Letters from home','A sky full of lanterns','The compass crossing','An impossible-looking path','The crew takes a breath','Every trick you know','The last lost chicks','Beyond the northern lights','The sky is ours'],
];
const LESSONS={collect:'Swipe two neighbors. Match three or more to collect pieces.',ice:'Match on frosted squares to chip the ice. Thick ice needs two hits.',coral:'Match beside coral, or hit it with a special, to open the board.',rescue:'Clear pieces beneath the chicks. Guide each one to a marked exit.',special:'Four makes a rocket. A T or L makes a puffer. Five makes a pearl.',lantern:'Matches on or beside a lantern charge it. Two charges light it.',net:'Netted pieces cannot swap. Match them in place, or blast them free.',current:'The marked channel moves one space every two moves. Plan with the tide.'};
export const MECHANICS=Object.entries(LESSONS).map(([id,description])=>({id,description}));
export const hash=n=>{let x=n|0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return(x^(x>>>16))>>>0;};
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const neighbors=(i,cols,size)=>[i-1,i+1,i-cols,i+cols].filter(j=>j>=0&&j<size&&Math.abs(j%cols-i%cols)+Math.abs(Math.floor(j/cols)-Math.floor(i/cols))===1);
export function shapeMask(shape,cols,rows){
  return Array.from({length:cols*rows},(_,i)=>{
    const r=Math.floor(i/cols),c=i%cols,edge=Math.min(r,rows-1-r),mid=Math.abs(r-(rows-1)/2);
    if(shape==='rounded')return !(edge===0&&(c===0||c===cols-1));
    if(shape==='diamond'){const cut=Math.max(0,Math.ceil(mid)-1);return c>=cut&&c<cols-cut;}
    if(shape==='hourglass'){const cut=mid<1?2:mid<2?1:0;return c>=cut&&c<cols-cut;}
    if(shape==='bridge')return !(mid<1.2&&(c<2||c>=cols-2));
    if(shape==='cross')return mid<1.6||(c>=2&&c<cols-2);
    if(shape==='lagoon')return !(mid<1.1&&c>=Math.floor(cols/2)-1&&c<=Math.floor(cols/2));
    if(shape==='stairs'){const cut=Math.floor(r/3)%3;return c>=cut&&c<cols-Math.max(0,2-cut);}
    if(shape==='islands')return c!==3&&c!==4;
    return true;
  });
}
function makeStage(id,phase,difficulty){
  const chapter=Math.floor((id-1)/10),beat=(id-1)%10,seed=7907+id*7919+phase*15485863;
  const teaching=beat===0,breather=beat===5;
  const shapes=chapter<1?['rectangle','rounded','rectangle','rounded','diamond','rectangle','rounded','stairs','hourglass','rounded']:['rounded','rectangle','bridge','diamond','hourglass','rounded','lagoon','cross','islands','stairs'];
  let shape=shapes[(beat+phase*3)%10],cols=id<=2?6:['islands','lagoon','stairs'].includes(shape)?8:7,rows=id===1?6:id===2?7:6+hash(id+phase)%4;
  if(['diamond','cross','islands'].includes(shape))rows=7;
  if(teaching){shape='rectangle';cols=6+Number(chapter>=3);rows=7;}
  if(id===1){cols=6;rows=6;}
  const mask=shapeMask(shape,cols,rows),active=mask.flatMap((yes,i)=>yes?[i]:[]);
  const colors=id<5?4:teaching||breather?4+Number(chapter>=2):Math.min(6,4+Number(id>=7)+Number(id>=61));
  const rank=Object.keys(DIFFICULTIES).indexOf(difficulty),mix=beat>=3&&!breather,feature=CHAPTERS[chapter].mechanic;
  let kinds=chapter===0?(beat<3||beat===5?['collect']:['ice']):chapter===1?([2,6,8].includes(beat)?['rescue','coral']:['coral']):feature==='all'?(phase===2?['lantern','rescue','net']:phase===1?['coral','ice']:['lantern','ice']):[feature==='current'?'collect':feature];
  if(breather)kinds=['collect'];
  if(mix&&chapter>=1&&kinds.length<2)kinds.push(['collect','ice','rescue'][hash(id+phase)%3]);
  if(beat===9&&chapter>=2&&!kinds.includes('lantern')&&phase>0)kinds.push('lantern');
  if(beat===2&&chapter===0)kinds.push('special');
  kinds=[...new Set(kinds)].slice(0,3);
  const exits=[],rescueEntries=[];
  for(let c=0;c<cols;c++){
    let bottom=rows-1;while(bottom>=0&&!mask[bottom*cols+c])bottom--;
    if(bottom<0)continue;
    let top=bottom;while(top>0&&mask[(top-1)*cols+c])top--;
    if(bottom-top>=3){exits.push(bottom*cols+c);rescueEntries.push(top*cols+c);}
  }
  const rescue=kinds.includes('rescue')?Math.min(exits.length,1+Number(chapter>=1&&!teaching)+Number(id===100&&phase===2)):0;
  const entries=rescueEntries.sort((a,b)=>Math.abs(a%cols-(cols-1)/2)-Math.abs(b%cols-(cols-1)/2)).filter((v,i)=>i%2===0).slice(0,rescue);
  while(entries.length<rescue)entries.push(rescueEntries.find(i=>!entries.includes(i)));
  const ranked=active.filter(i=>!entries.includes(i)).sort((a,b)=>hash(a*331+seed)-hash(b*331+seed));
  const coral={},ice={},nets={},lanterns={};
  if(kinds.includes('coral')){
    const amount=clamp(Math.round(active.length*(teaching?.08:.12+rank*.014)),3,12);
    for(const i of ranked){if(neighbors(i,cols,mask.length).filter(j=>mask[j]&&!coral[j]).length<2)continue;coral[i]=chapter>=7||chapter>=3&&rank>=2?2:1;if(Object.keys(coral).length>=amount)break;}
  }
  const open=ranked.filter(i=>!coral[i]);
  if(kinds.includes('ice'))open.slice(0,clamp(Math.round(active.length*(teaching?.15:.21+rank*.02)),4,22)).forEach(i=>ice[i]=chapter>=4||chapter>=2&&rank>=2?2:1);
  if(kinds.includes('net'))open.slice().reverse().slice(0,clamp(4+rank+Math.floor(chapter/3),4,11)).forEach(i=>nets[i]=1);
  if(kinds.includes('lantern'))open.filter(i=>neighbors(i,cols,mask.length).filter(j=>mask[j]&&!coral[j]).length>=3).slice(0,teaching?3:Math.min(7,4+Math.floor(chapter/3))).forEach(i=>lanterns[i]=0);
  const goals=kinds.map(kind=>{
    if(kind==='collect')return{kind,piece:id<=2?id-1:hash(id+phase)%colors,target:id===1?12:Math.round((teaching?20:24+chapter*2+rank*3)*Math.min(1.2,active.length/42))};
    if(['ice','coral','net','lantern'].includes(kind))return{kind,target:Object.keys(kind==='net'?nets:kind==='lantern'?lanterns:kind==='ice'?ice:coral).length};
    return{kind,target:kind==='rescue'?rescue:2+Math.floor(chapter/3)};
  }).filter(g=>g.target>0);
  let current=null;
  if((feature==='current'||chapter>=5&&mix&&beat%2===0||id===100&&phase===2)&&!breather){const row=Math.floor(rows/2),path=active.filter(i=>Math.floor(i/cols)===row&&!coral[i]&&!nets[i]);if(path.length>=3)current={path,every:2,direction:id%2===0?1:-1};}
  const windows=active.reduce((n,i)=>n+Number(i%cols<cols-2&&mask[i+1]&&mask[i+2])+Number(i+2*cols<mask.length&&mask[i+cols]&&mask[i+2*cols]),0);
  const topology=+(1-Math.min(1,windows/(active.length*1.45))).toFixed(3),hits=o=>Object.values(o).reduce((a,b)=>a+b,0);
  const effort=goals.map(g=>g.kind==='collect'?g.target/(2.7-(colors-4)*.35):g.kind==='ice'?hits(ice)*.78:g.kind==='coral'?hits(coral)*1.1:g.kind==='net'?g.target*1.35:g.kind==='lantern'?g.target*2.1:g.kind==='rescue'?rows*.8+g.target*2:g.target*3.4).sort((a,b)=>b-a);
  const work=(effort[0]||8)+effort.slice(1).reduce((a,b)=>a+b*.28,0);
  const estimatedTurns=+(work*(1+topology*.32+(current?.08:0))*(1+(colors-4)*.045)+2).toFixed(2);
  const moves=tuning[`${id}:${phase}`]||clamp(Math.round(estimatedTurns/DIFFICULTIES[difficulty].pressure),id===1?12:14,38);
  return{id,chapter,name:TITLES[chapter][beat],difficulty,cols,rows,shape,mask,colors,moves,goals,ice,coral,nets,lanterns,rescue,entries,exits,current,seed,phaseName:phase===0?(beat===9?'Open the way':'The crossing'):phase===1?'Light the beacon':'Bring everyone home',lesson:LESSONS[current&&teaching?'current':kinds[0]],design:{beat:teaching?'Discover':breather?'Breather':beat===9?'Finale':rank>=2?'Challenge':'Practice',activeCells:active.length,topology,estimatedTurns,pressure:+(estimatedTurns/moves).toFixed(3),mechanics:[...kinds,...(current?['current']:[])],seed}};
}
export function createLevel(id){
  if(!Number.isInteger(id)||id<1||id>100)throw new RangeError('Level must be 1–100');
  const chapter=Math.floor((id-1)/10),beat=(id-1)%10,curve=['gentle',chapter<2?'gentle':'normal','normal','normal','hard','gentle','normal','hard',chapter<2?'hard':chapter>=6?'nightmare':'super',chapter<2?'hard':'legendary'];
  const difficulty=curve[beat],phaseCount=id===100?3:beat===9?2:1,phases=Array.from({length:phaseCount},(_,phase)=>makeStage(id,phase,difficulty));
  return{...phases[0],phases,phaseCount,act:Math.floor(chapter/2),relic:beat===9?CHAPTERS[chapter].relic:null};
}
export const LEVELS=Array.from({length:100},(_,i)=>createLevel(i+1));
export const activeLevel=(id,phase=0)=>({...LEVELS[id-1],...LEVELS[id-1].phases[phase],phases:LEVELS[id-1].phases});
export function goalName(goal){return goal.kind==='collect'?`Collect ${PIECES[goal.piece].short}`:({ice:'Clear the ice',coral:'Break the coral',rescue:'Rescue chicks',special:'Create specials',lantern:'Light lanterns',net:'Cut the nets'}[goal.kind]||goal.kind);}
export function auditLevels(){
  const issues=[];
  for(const root of LEVELS)for(const l of root.phases){
    const label=`${root.id}/${l.phaseName}`;
    if(l.moves<1||l.colors<4||l.colors>6||l.mask.length!==l.rows*l.cols)issues.push(`Invalid config ${label}`);
    if(l.design.activeCells<24)issues.push(`Too few cells ${label}`);
    for(const g of l.goals)if(!(g.target>0)||g.kind==='collect'&&g.piece>=l.colors)issues.push(`Invalid goal ${label}`);
    for(const set of [l.ice,l.coral,l.nets,l.lanterns])for(const p of Object.keys(set))if(!l.mask[p])issues.push(`Obstacle in void ${label}`);
    if(Object.keys(l.coral).some(p=>l.ice[p]||l.nets[p]||p in l.lanterns))issues.push(`Overlapping blocker ${label}`);
    if(l.entries.length!==l.rescue||l.entries.some(i=>!l.mask[i]||l.coral[i]))issues.push(`Unreachable rescue ${label}`);
    for(const key of ['ice','coral','net','lantern']){const g=l.goals.find(g=>g.kind===key),data=key==='net'?l.nets:key==='lantern'?l.lanterns:l[key];if(g&&g.target!==Object.keys(data).length)issues.push(`Goal count mismatch ${label}/${key}`);}
  }
  return issues;
}
