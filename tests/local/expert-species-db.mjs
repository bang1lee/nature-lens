// Run with PGLITE_MODULE pointing at an independently installed @electric-sql/pglite.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
try {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$; grant usage on schema auth to anon,authenticated,service_role; grant execute on all functions in schema auth to anon,authenticated,service_role;`,
  );
  for (const f of ['20260929000000_community_pilot.sql', '20261118000000_expert_species.sql'])
    await db.exec(await readFile(`supabase/migrations/${f}`, 'utf8'));
  const uid = '11111111-1111-4111-8111-111111111111',
    sid = '22222222-2222-4222-8222-222222222222';
  await db.exec(
    `insert into auth.users values ('${uid}'),('33333333-3333-4333-8333-333333333333'); insert into profiles(user_id,alias) values ('${uid}','tester'); insert into community_submissions(id,owner_id,title,species,scientific_name,observed_on,notes,habitat,taxon_group,protection,photo,consent_upload,no_people,ai_assisted,status,approved_at) values ('${sid}','${uid}','title','name','Example species','2026-01-01','note','','plant','unknown','data:image/jpeg;base64,AA==',true,true,false,'approved',now()); set request.jwt.claim.sub='${uid}'; set request.jwt.claims='{"is_anonymous":false}'; set role authenticated;`,
  );
  await assert.rejects(
    db.exec(`insert into expert_requests(observation_id,question) values ('record','question')`),
  );
  assert.equal(
    (await db.query('select * from public_species_summary')).rows.length,
    0,
    'editorial approval is not expert review',
  );
  await assert.rejects(
    db.exec(
      `insert into expert_species_reviews(submission_id,scientific_name,expert_id,rationale) values ('${sid}','Example species','x','x')`,
    ),
  );
  await db.exec(
    `reset role; update expert_service_settings set accepting=true; insert into expert_species_reviews(submission_id,scientific_name,expert_id,rationale) values ('${sid}','Example species','expert-1','reviewed features'); set role authenticated; insert into expert_requests(observation_id,question,submission_id) values ('record','question','${sid}');`,
  );
  assert.deepEqual((await db.query('select * from public_species_summary')).rows, [
    { scientific_name: 'Example species', observations: 1 },
  ]);
  const request = (await db.query('select id from expert_requests')).rows[0].id;
  await db.exec(`set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';`);
  await assert.rejects(
    db.exec(
      `insert into expert_requests(observation_id,question,submission_id) values ('other','question','${sid}')`,
    ),
    'another user cannot link a submission',
  );
  await assert.rejects(
    db.exec(
      `insert into expert_requests(owner_id,observation_id,question) values ('${uid}','switched','private question')`,
    ),
    'new session cannot submit as previous owner',
  );
  assert.equal(
    (await db.query('select * from expert_requests')).rows.length,
    0,
    'new session cannot read previous requests',
  );
  await db.exec(`set request.jwt.claim.sub='${uid}';`);
  await assert.rejects(
    db.exec(
      `insert into expert_responses(request_id,expert_id,response) values ('${request}','forged','answer')`,
    ),
  );
  await db.exec(
    `reset role; insert into expert_responses(request_id,expert_id,response) values ('${request}','expert-1','actual answer'); set role authenticated;`,
  );
  assert.equal(
    (await db.query('select response from expert_responses')).rows[0].response,
    'actual answer',
  );
  await db.exec(`set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';`);
  assert.equal(
    (await db.query('select * from expert_responses')).rows.length,
    0,
    'other user cannot read responses',
  );
  await db.exec(`set request.jwt.claim.sub='${uid}';`);
  await assert.rejects(
    db.exec(`insert into expert_requests(observation_id,question) values ('record','duplicate')`),
  );
  await db.exec(`delete from community_submissions where id='${sid}';`);
  assert.equal(
    (await db.query('select submission_id from expert_requests')).rows[0].submission_id,
    null,
    'withdrawal unlinks the submitted record',
  );
  await db.exec(`delete from expert_requests where id='${request}';`);
  assert.equal(
    (await db.query('select * from expert_responses')).rows.length,
    0,
    'withdrawal removes responses',
  );
  assert.equal(
    (await db.query('select * from public_species_summary')).rows.length,
    0,
    'withdrawal removes public aggregate',
  );
  await db.exec(
    `reset role; set request.jwt.claims='{"is_anonymous":true}'; set role authenticated;`,
  );
  await assert.rejects(
    db.exec(`insert into expert_requests(observation_id,question) values ('other','question')`),
  );
  console.log('expert request and public species isolation: passed');
} finally {
  await db.close();
}
