import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Operator-only CLI. It validates by default; --send is an explicit broadcast action.
const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
const category=args.includes('--category')?get('--category'):'news';
const title=get('--title'),body=get('--body'),route=args.includes('--route')?get('--route'):'home';
if(!args.includes('--title')||!args.includes('--body')||!['events','news'].includes(category)||title.length>70||body.length>240||!['home','journey','journal','friends','backpack','leaderboard'].includes(route)) {
  console.error('Usage: node scripts/cloud-message.mjs --category news --title "Title" --body "Message" [--route home] [--token-file /private/path] [--send]');process.exit(1);
}
const require=createRequire(import.meta.url),globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const auth=require(join(globalRoot,'firebase-tools/lib/auth.js')),account=auth.getGlobalDefaultAccount();
if(!account)throw Error('Run firebase login first.');
const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const target=args.includes('--token-file')?{token:readFileSync(get('--token-file'),'utf8').trim()}:{topic:`pengucrush_${category}_v1`};
const payload={validate_only:!args.includes('--send'),message:{...target,android:{priority:'NORMAL',ttl:'86400s'},data:{id:randomUUID(),category,title,body,route,expiresAt:String(Date.now()+86400_000)}}};
const response=await fetch('https://fcm.googleapis.com/v1/projects/pengucrush-solana/messages:send',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
const result=await response.json();
if(!response.ok){console.error('FCM rejected the request:',result.error?.status,result.error?.message);process.exit(1);}
console.log(payload.validate_only?'Cloud message validated. Nothing was sent.':`Cloud message accepted: ${result.name}`);
