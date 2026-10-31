import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Operator-only CLI. It validates by default; --send is an explicit broadcast action.
const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
const category=args.includes('--category')?get('--category'):'news';
const title=get('--title'),body=get('--body'),route=args.includes('--route')?get('--route'):'home';
// --segment sends to stored tokens of opted-in installs instead of the topic: a comma-separated AND of all | reached:N | not-reached:N | inactive:D.
const segmented=args.includes('--segment'),countOnly=segmented&&args.includes('--count'),where=[],params=[];
// 'open' events carry the player's unlocked level, so progress made before 0.6.2 counts too.
const reached=n=>`EXISTS (SELECT 1 FROM events e WHERE e.installation=i.installation AND e.level>=$${n})`;
const filters={reached,'not-reached':n=>`NOT ${reached(n)}`,inactive:n=>`i.last_seen<now()-make_interval(days=>$${n})`};
const segmentOk=!segmented||String(get('--segment')).split(',').every(part=>{
  const [kind,value]=part.split(':');
  if(part==='all')return true;
  if(!filters[kind]||!/^\d+$/.test(value)||+value<1||(kind!=='inactive'&&+value>100))return false;
  where.push(filters[kind](params.push(+value)));return true;
});
if((!countOnly&&(!args.includes('--title')||!args.includes('--body')||title.length>70||body.length>240))||!['events','news'].includes(category)||!['home','journey','journal','friends','backpack','leaderboard'].includes(route)||!segmentOk||(args.includes('--count')&&!segmented)) {
  console.error('Usage: node scripts/cloud-message.mjs --category news --title "Title" --body "Message" [--route home] [--token-file /private/path] [--send]');
  console.error('   or: node scripts/cloud-message.mjs --category news --segment all|reached:N|not-reached:N|inactive:D[,...] (--count | --title "Title" --body "Message" [--route home] [--send])');process.exit(1);
}
let db,tokens;
if(segmented){
  const pg=createRequire(new URL('../../backend/package.json',import.meta.url))('pg');
  const local=process.env.DATABASE_URL,connectionString=local||JSON.parse(execFileSync('railway',['variable','list','--service','Postgres','--project','f99e792b-0fb1-4497-9a11-bde758ba69a8','--environment','production','--json'],{encoding:'utf8'})).DATABASE_PUBLIC_URL;
  // Without a URL pg would silently fall back to PG* variables or localhost and target the wrong tokens.
  if(!connectionString)throw Error('Set DATABASE_URL or sign in with the Railway CLI.');
  db=new pg.Client({connectionString,ssl:local?undefined:{rejectUnauthorized:false}});
  await db.connect();
  tokens=(await db.query(`SELECT DISTINCT push_token FROM installs i WHERE push_active AND push_${category} AND push_token IS NOT NULL${where.map(w=>' AND '+w).join('')}`,params)).rows.map(r=>r.push_token);
  console.log(`Matched ${tokens.length} opted-in installation token(s).`);
  if(countOnly){await db.end();process.exit(0);}
}
const require=createRequire(import.meta.url),globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const auth=require(join(globalRoot,'firebase-tools/lib/auth.js')),account=auth.getGlobalDefaultAccount();
if(!account)throw Error('Run firebase login first.');
const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const validate_only=!args.includes('--send'),data={id:randomUUID(),category,title,body,route,expiresAt:String(Date.now()+86400_000)};
const send=async target=>{const response=await fetch('https://fcm.googleapis.com/v1/projects/pengucrush-solana/messages:send',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({validate_only,message:{...target,android:{priority:'NORMAL',ttl:'86400s'},data}})});return {ok:response.ok,result:await response.json()};};
if(!segmented){
  const target=args.includes('--token-file')?{token:readFileSync(get('--token-file'),'utf8').trim()}:{topic:`pengucrush_${category}_v1`};
  const {ok,result}=await send(target);
  if(!ok){console.error('FCM rejected the request:',result.error?.status,result.error?.message);process.exit(1);}
  console.log(validate_only?'Cloud message validated. Nothing was sent.':`Cloud message accepted: ${result.name}`);
}else{
  // One request per token, 10 at a time. Dead tokens are only marked inactive (never deleted), and only on a real --send.
  const summary={validateOnly:validate_only,matched:tokens.length,accepted:0,failed:0,deactivated:0,reasons:{}};let next=0;
  await Promise.all(Array.from({length:10},async()=>{while(next<tokens.length){
    const pushToken=tokens[next++];let ok=false,result;
    try{({ok,result}=await send({token:pushToken}));}catch(error){result={error:{status:error.cause?.code||error.message}};}
    if(ok){summary.accepted++;continue;}
    const error=result.error,reason=error?.details?.find(d=>d.errorCode)?.errorCode||error?.status||'UNKNOWN';
    summary.failed++;summary.reasons[reason]=(summary.reasons[reason]||0)+1;
    // Dead, foreign-project or malformed tokens only; a bad payload is also INVALID_ARGUMENT but never names the registration token.
    const dead=error?.status==='NOT_FOUND'||error?.details?.some(d=>['UNREGISTERED','SENDER_ID_MISMATCH'].includes(d.errorCode))||(error?.status==='INVALID_ARGUMENT'&&/registration token/i.test(error.message));
    if(!validate_only&&dead){await db.query('UPDATE installs SET push_active=false,push_updated_at=now() WHERE push_token=$1',[pushToken]);summary.deactivated++;}
  }}));
  await db.end();
  console.log(JSON.stringify(summary));
  process.exitCode=summary.failed?1:0;
}
