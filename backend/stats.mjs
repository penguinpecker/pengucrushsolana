import { execFileSync } from 'node:child_process';
import pg from 'pg';
// Operator-only, read-only report. The connection URL stays in process memory and is never printed.
let connectionString=process.env.DATABASE_URL,ssl;
if(!connectionString){
  const vars=JSON.parse(execFileSync('railway',['variable','list','--service','Postgres','--project','f99e792b-0fb1-4497-9a11-bde758ba69a8','--environment','production','--json'],{encoding:'utf8'}));
  connectionString=vars.DATABASE_PUBLIC_URL;ssl={rejectUnauthorized:false};
}
if(!connectionString)throw Error('Set DATABASE_URL or sign in with the Railway CLI.');
const client=new pg.Client({connectionString,ssl});await client.connect();
try {
  await client.query('BEGIN READ ONLY');
  const day=d=>`count(*) FILTER (WHERE last_seen>now()-interval '${d} days')::int`;
  const i=(await client.query(`SELECT count(*)::int AS total,min(first_seen) AS first,max(last_seen) AS last,${day(1)} AS d1,${day(7)} AS d7,${day(30)} AS d30,
    count(*) FILTER (WHERE push_active)::int AS push,count(*) FILTER (WHERE push_active AND push_news)::int AS news,count(*) FILTER (WHERE push_active AND push_events)::int AS events,pg_size_pretty(pg_database_size(current_database())) AS size FROM installs`)).rows[0];
  const wallets=(await client.query('SELECT count(*)::int AS n FROM (SELECT wallet FROM wallets UNION SELECT wallet FROM sessions UNION SELECT wallet FROM orders) w')).rows[0].n;
  const levels=(await client.query(`WITH per AS (SELECT max(level) AS reached,max(level) FILTER (WHERE type='win') AS won FROM events GROUP BY installation)
    SELECT n AS level,count(*) FILTER (WHERE reached>=n)::int AS reached,count(*) FILTER (WHERE won>=n)::int AS completed FROM unnest(ARRAY[1,3,5,10,50]) n LEFT JOIN per ON true GROUP BY n ORDER BY n`)).rows;
  await client.query('ROLLBACK');
  console.log(`Installs ${i.total} (first ${i.first?.toISOString()??'-'}, last ${i.last?.toISOString()??'-'})`);
  console.log(`Seen in last 1/7/30 days ${i.d1} / ${i.d7} / ${i.d30}`);
  console.log(`Wallets ${wallets}`);
  console.log('Level  reached  completed');
  for(const l of levels)console.log(`${String(l.level).padStart(5)}  ${String(l.reached).padStart(7)}  ${String(l.completed).padStart(9)}`);
  console.log(`Push reachable ${i.push} (news ${i.news}, events ${i.events})`);
  console.log(`Database size ${i.size} (nothing is pruned; watch the volume)`);
} finally {await client.end();}
