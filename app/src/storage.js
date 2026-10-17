import { CHAPTERS, LEVEL_COUNT, hash } from './campaign.js';

const mode=new URLSearchParams(globalThis.location?.search||'');
const KEY=`pengucrush-islands-v1${mode.has('qa')?'-qa':mode.has('review')?'-review':''}`;
const blankStats=()=>({clears:0,ice:0,coral:0,rescue:0,special:0,net:0,lantern:0,moves:0,currents:0,wins:0});
export const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const defaultProfile=()=>({version:2,campaign:3,unlocked:1,stars:{},coins:0,boosters:{hammer:3,shuffle:3,blast:1,aurora:1},companion:0,sound:true,music:true,motion:true,haptics:true,run:null,attempts:{},stats:blankStats(),claims:{},completedRuns:{},relics:[],daily:null});
export function refreshDaily(profile,today=dayKey()) {
  if(profile.daily?.day===today)return profile;
  return {...profile,daily:{day:today,baseline:{...profile.stats}}};
}
export function readProfile(storage=globalThis.localStorage) {
  try {
    const data=JSON.parse(storage.getItem(KEY));
    if(!data || ![1,2].includes(data.version))return refreshDaily(defaultProfile());
    const base=defaultProfile();
    const stars=Object.fromEntries(Object.entries(data.stars||{}).filter(([id])=>+id>=1&&+id<=LEVEL_COUNT).map(([id,n])=>[id,Math.max(0,Math.min(3,Number(n)||0))]));
    const relics=CHAPTERS.filter(c=>stars[c.end]>0).map(c=>c.id);
    return refreshDaily({...base,...data,version:2,campaign:3,unlocked:Math.min(101,Math.max(1,Number(data.unlocked)||1)),coins:Math.max(0,Number(data.coins)||0),boosters:{...base.boosters,...data.boosters},stars,attempts:data.attempts||{},stats:{...base.stats,...data.stats},claims:data.claims||{},completedRuns:data.completedRuns||{},relics,run:data.run?.version===2?data.run:null});
  } catch {return refreshDaily(defaultProfile());}
}
export function saveProfile(profile,storage=globalThis.localStorage) {
  try {storage.setItem(KEY,JSON.stringify(profile));return true;}catch{return false;}
}
export function deleteProfile(storage=globalThis.localStorage) {
  // Keep receipt IDs so an intentional reset cannot credit a consumed purchase again.
  const receipts=readProfile(storage).paidReceipts||{};
  storage.removeItem(KEY);return {...refreshDaily(defaultProfile()),paidReceipts:receipts};
}
// Checkpoint the settled rules state before any animation. Delta accounting makes
// phase changes, app backgrounding and repeated saves safe for quest progress.
export function checkpointRun(profile,snapshot) {
  const p=refreshDaily(profile),prior=p.run?.levelId===snapshot.levelId&&p.run.seed===snapshot.seed?p.run.stats:{};
  const stats={...p.stats};
  for(const [key,value] of Object.entries(snapshot.stats))stats[key]=(stats[key]||0)+Math.max(0,value-(prior?.[key]||0));
  return {...p,stats,run:snapshot};
}
export const totalStars=p=>Object.values(p.stars).reduce((a,b)=>a+b,0);
export const regionStars=(p,chapter)=>Array.from({length:10},(_,i)=>p.stars[chapter*10+i+1]||0).reduce((a,b)=>a+b,0);
export function awardWin(profile,levelId,stars,seed=null) {
  if(levelId<1||levelId>LEVEL_COUNT||levelId>profile.unlocked)return profile;
  const p=refreshDaily(profile),previous=p.stars[levelId]||0,receipt=`${levelId}:${seed??'first'}`;
  const firstRun=!p.completedRuns[receipt],newRelic=levelId%10===0&&!p.relics.includes(levelId/10-1);
  const reward=(previous===0?40+stars*10:Math.max(0,stars-previous)*10)+(newRelic?100:0);
  return {...p,unlocked:Math.max(p.unlocked,Math.min(101,levelId+1)),stars:{...p.stars,[levelId]:Math.max(previous,stars)},coins:p.coins+reward,run:null,stats:{...p.stats,wins:p.stats.wins+Number(firstRun)},completedRuns:{...p.completedRuns,[receipt]:true},relics:newRelic?[...p.relics,levelId/10-1]:p.relics,boosters:newRelic?{...p.boosters,hammer:p.boosters.hammer+1,shuffle:p.boosters.shuffle+1}:p.boosters};
}
const contracts=[
  ['first-post','First-class delivery','Win your first level.','levels',1,{coins:40}],
  ['snow-business','Snow business','Clear 80 ice squares.','ice',80,{coins:90,hammer:1}],
  ['reef-keeper','Keeper of the reef','Break 60 coral blocks.','coral',60,{coins:100,shuffle:1}],
  ['specialist','A special sort of penguin','Create 30 rockets, puffers or pearls.','special',30,{coins:80,hammer:1}],
  ['homeward','Leave no chick behind','Bring 20 chicks home.','rescue',20,{coins:120,shuffle:2}],
  ['lamplighter','The lamplighter','Light 40 lanterns.','lantern',40,{coins:140,hammer:2}],
  ['untangled','A clean escape','Cut through 80 nets.','net',80,{coins:120,hammer:2}],
  ['quarter','Uncharted waters','Complete 25 different levels.','levels',25,{coins:150,shuffle:2}],
  ['halfway','Half a world away','Complete 50 different levels.','levels',50,{coins:200,hammer:2}],
  ['stargazer','A pocketful of starlight','Earn 150 stars across the expedition.','stars',150,{coins:250,shuffle:3}],
  ['horizon','Beyond the horizon','Complete 75 different levels.','levels',75,{coins:250,hammer:3}],
  ['home','The long way home','Restore all ten beacons.','relics',10,{coins:500,hammer:3,shuffle:3}],
];
function metric(p,key){return key==='levels'?Object.values(p.stars).filter(Boolean).length:key==='stars'?totalStars(p):key==='relics'?p.relics.length:p.stats[key]||0;}
export function quests(profile,today=dayKey()) {
  const p=refreshDaily(profile,today),seed=hash(Number(today.replaceAll('-','')));
  const variety=p.unlocked>=42?['ice','coral','net','lantern']:p.unlocked>=22?['ice','coral','lantern']:p.unlocked>=12?['ice','coral']:['clears'];
  const kind=variety[seed%variety.length],target=kind==='clears'?90:kind==='lantern'?5:12;
  const daily=[
    {id:`daily:${today}:clears`,title:'A tidy little expedition',description:'Clear 120 pieces today.',metric:'clears',target:120,reward:{coins:35}},
    {id:`daily:${today}:wins`,title:'Three good adventures',description:'Win 3 levels today. Replays count.',metric:'wins',target:3,reward:{coins:50,shuffle:1}},
    {id:`daily:${today}:craft`,title:kind==='clears'?'One more pocketful':kind==='lantern'?'Evening rounds':kind==='net'?'Loose ends':kind==='coral'?'Reef patrol':'A little icebreaking',description:`${kind==='clears'?'Clear':kind==='lantern'?'Light':kind==='net'?'Cut':'Clear'} ${target} ${kind==='clears'?'pieces':kind==='lantern'?'lanterns':kind==='net'?'nets':kind==='ice'?'ice squares':'coral blocks'} today.`,metric:kind,target,reward:{coins:40,hammer:1}},
  ].map(q=>({...q,group:'daily',value:Math.max(0,metric(p,q.metric)-(p.daily.baseline[q.metric]||0)),claimed:!!p.claims[q.id]}));
  return [...daily,...contracts.map(([id,title,description,key,target,reward])=>({id,title,description,metric:key,target,reward,group:'expedition',value:metric(p,key),claimed:!!p.claims[id]}))];
}
function grant(profile,id,reward) {
  return {...profile,coins:profile.coins+(reward.coins||0),boosters:{...profile.boosters,hammer:profile.boosters.hammer+(reward.hammer||0),shuffle:profile.boosters.shuffle+(reward.shuffle||0)},claims:{...profile.claims,[id]:true}};
}
export function claimQuest(profile,id,today=dayKey()) {
  const p=refreshDaily(profile,today),q=quests(p,today).find(q=>q.id===id);
  if(!q||q.claimed||q.value<q.target)return null;
  return {profile:grant(p,id,q.reward),reward:q.reward,title:q.title};
}
export const CHESTS=[{target:8,reward:{coins:60,hammer:1}},{target:16,reward:{coins:90,shuffle:1}},{target:24,reward:{coins:140,hammer:1,shuffle:1}}];
export function claimChest(profile,chapter,tier) {
  if(!CHAPTERS[chapter]||!CHESTS[tier])return null;
  const id=`chest:${chapter}:${tier}`,chest=CHESTS[tier];
  if(profile.claims[id]||regionStars(profile,chapter)<chest.target)return null;
  return {profile:grant(profile,id,chest.reward),reward:chest.reward,title:`${CHAPTERS[chapter].name} star chest`};
}
