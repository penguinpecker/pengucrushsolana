import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationSummary} from '../src/notifications.js';
import {defaultProfile,refreshDaily,awardWin,claimQuest,claimChest,deleteProfile} from '../src/storage.js';
test('notification summary contains no player save or device identifiers',()=>{
 const profile=refreshDaily(defaultProfile());profile.run={status:'playing',levelId:7,seed:123,board:['private state']};
 const summary=notificationSummary(profile);
 assert.equal(summary.level,7);assert.equal('seed' in summary,false);assert.equal('board' in summary,false);assert.equal(summary.rewardKey,'');
});
test('earned quest reminder disappears once the reward is claimed',()=>{
 let profile=awardWin(refreshDaily(defaultProfile()),1,3,8);
 assert.match(notificationSummary(profile).rewardKey,/first-post/);
 profile=claimQuest(profile,'first-post').profile;
 assert.equal(notificationSummary(profile).rewardKey,'');
 assert.equal(notificationSummary(profile).level,0);
});
test('star chests route to journey and disappear after collection',()=>{
 let profile=refreshDaily(defaultProfile());profile.claims['first-post']=true;profile.stars={1:3,2:3,3:3};
 assert.equal(notificationSummary(profile).rewardRoute,'journey');assert.match(notificationSummary(profile).rewardKey,/chest:0:0/);
 profile=claimChest(profile,0,0).profile;assert.equal(notificationSummary(profile).rewardKey,'');
});
test('daily reward reminder expires at the next local midnight',()=>{
 const now=new Date(2026,8,24,20,0);const profile=refreshDaily(defaultProfile(),'2026-09-24');profile.stats.clears=130;
 const summary=notificationSummary(profile,now);assert.equal(summary.rewardExpiry,+new Date(2026,8,25));assert.match(summary.rewardKey,/daily:2026-09-24/);
});
test('erase save clears only the game key and produces a fresh expedition',()=>{
 const data=new Map([['pengucrush-islands-v1','old'],['unrelated','keep']]);
 const profile=deleteProfile({removeItem:key=>data.delete(key)});
 assert.equal(data.has('pengucrush-islands-v1'),false);assert.equal(data.get('unrelated'),'keep');assert.equal(profile.unlocked,1);assert.equal(profile.coins,0);assert.deepEqual(profile.stars,{});
});
