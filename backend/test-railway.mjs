import { execFileSync,spawnSync } from 'node:child_process';
// Credentials stay in process memory; the test creates and drops an isolated schema.
let connection=process.env.DATABASE_URL,ssl='0';
if(!connection){
  const vars=JSON.parse(execFileSync('railway',['variable','list','--service','Postgres','--json'],{encoding:'utf8'}));
  connection=vars.DATABASE_PUBLIC_URL;ssl='1';
}
if(!connection)throw Error('Run inside the private Railway service: railway ssh --service pengucrush-api -- node test-railway.mjs');
const result=spawnSync(process.execPath,['--test','test/api.test.js','test/payments.test.js','test/replay.test.js'],{cwd:new URL('.',import.meta.url),stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:connection,TEST_DATABASE_SSL:ssl}});
process.exit(result.status??1);
