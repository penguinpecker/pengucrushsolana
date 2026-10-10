import { quests, CHESTS, regionStars, dayKey } from './storage.js';
export function notificationSummary(profile, now=new Date()) {
  const available=quests(profile,dayKey(now)).filter(q=>!q.claimed&&q.value>=q.target);
  const chests=[];
  for(let region=0;region<10;region++)for(let tier=0;tier<CHESTS.length;tier++){
    const id=`chest:${region}:${tier}`;
    if(!profile.claims[id]&&regionStars(profile,region)>=CHESTS[tier].target)chests.push(id);
  }
  const daily=available.some(q=>q.group==='daily');
  const expiry=daily?new Date(now.getFullYear(),now.getMonth(),now.getDate()+1):new Date(+now+86400000);
  return {level:profile.run&&['playing','phase'].includes(profile.run.status)?profile.run.levelId:0,
    rewardKey:[...available.map(q=>q.id),...chests].sort().join('|'),rewardRoute:available.length?'journal':'journey',rewardExpiry:+expiry};
}
export const nativeNotifications=()=>Boolean(globalThis.PenguNative?.notificationStatus);
export function getNotificationStatus(){
  try{return JSON.parse(globalThis.PenguNative.notificationStatus());}catch{return {native:false,permission:false,configured:false,cloudStatus:'unconfigured'};}
}
export function syncNotificationGame(profile){
  // QA/review progress never schedules reminders for the real player.
  if(new URLSearchParams(globalThis.location?.search||'').has('qa')||new URLSearchParams(globalThis.location?.search||'').has('review'))return;
  globalThis.PenguNative?.notificationGameState?.(JSON.stringify(notificationSummary(profile)));
}
export function externalLink(url){
  if(globalThis.PenguNative?.openExternal)globalThis.PenguNative.openExternal(url);
  else window.open(url,'_blank','noopener,noreferrer');
}
