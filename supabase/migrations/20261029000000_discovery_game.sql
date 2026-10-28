-- Private game state; only the authenticated gateway may call these functions.
-- No photos, coordinates, email addresses, or provider keys are stored.
create table public.discovery_rounds (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 photo_hash text not null check(length(photo_hash)=64), observation_id text not null,
 prediction text not null default '', reason text not null default '',
 state text not null check(state in ('processing','waiting','revealed','failed','seen')),
 eligible boolean not null default true, result jsonb, points integer not null default 0 check(points in (0,10)),
 created_at timestamptz not null default now(),
 ready_at timestamptz not null default (((now() at time zone 'Asia/Seoul')::date + 1 + time '09:00') at time zone 'Asia/Seoul'),
 unique(user_id,photo_hash)
);
alter table public.discovery_rounds enable row level security;
revoke all on public.discovery_rounds from public,anon,authenticated;

create function public.discovery_action(p_user uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.discovery_rounds; fresh boolean:=false; total integer; n text; top_name text; second_score numeric; matched boolean:=false;
begin
 if p_user is null then raise exception 'invalid_user'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
 if p_action in ('begin','seen') then
  if length(p_data->>'hash')<>64 or length(p_data->>'observationId') not between 1 and 100 then raise exception 'invalid_input'; end if;
  select * into r from public.discovery_rounds where user_id=p_user and photo_hash=p_data->>'hash' for update;
  if p_action='seen' then
   if r.id is null then
    insert into public.discovery_rounds(user_id,photo_hash,observation_id,state,eligible) values(p_user,p_data->>'hash',p_data->>'observationId','seen',false);
   elsif r.state<>'revealed' then update public.discovery_rounds set eligible=false where id=r.id; end if;
   return jsonb_build_object('ok',true);
  end if;
  if length(trim(coalesce(p_data->>'prediction',''))) not between 1 and 140 or length(coalesce(p_data->>'reason',''))>1000 then raise exception 'invalid_prediction'; end if;
  if r.id is null then
   insert into public.discovery_rounds(user_id,photo_hash,observation_id,prediction,reason,state)
   values(p_user,p_data->>'hash',p_data->>'observationId',trim(p_data->>'prediction'),coalesce(p_data->>'reason',''),'processing') returning * into r; fresh:=true;
  elsif r.state='failed' or (r.state='processing' and r.created_at<now()-interval '5 minutes') then
   update public.discovery_rounds set state='processing',created_at=now() where id=r.id returning * into r; fresh:=true;
  end if;
 else
  select * into r from public.discovery_rounds where user_id=p_user and id=(p_data->>'id')::uuid for update;
  if r.id is null then return jsonb_build_object('error','not-found'); end if;
  if p_action='complete' and r.state='processing' then
   update public.discovery_rounds set result=p_data->'result',state='waiting' where id=r.id returning * into r;
  elsif p_action='fail' and r.state='processing' then
   update public.discovery_rounds set state='failed' where id=r.id returning * into r;
  elsif p_action='reveal' and r.state='waiting' then
   if now()<r.ready_at and not coalesce((p_data->>'early')::boolean,false) then return jsonb_build_object('error','too-early'); end if;
   -- Exact normalized common/scientific name match, never LLM fuzzy grading.
   n:=regexp_replace(lower(r.prediction),'[[:space:]]','','g');
   second_score:=coalesce((r.result->'candidates'->1->>'score')::numeric,0);
   matched:=r.result->>'state'='candidates' and (r.result->'candidates'->0->>'score')::numeric>=0.7
    and (r.result->'candidates'->0->>'score')::numeric-second_score>=0.15
    and n in (regexp_replace(lower(r.result->'candidates'->0->>'scientificName'),'[[:space:]]','','g'),regexp_replace(lower(r.result->'candidates'->0->>'commonName'),'[[:space:]]','','g'));
   update public.discovery_rounds set state='revealed',eligible=eligible and not coalesce((p_data->>'early')::boolean,false),
    points=case when matched and eligible and not coalesce((p_data->>'early')::boolean,false) then 10 else 0 end where id=r.id returning * into r;
  elsif p_action not in ('read','reveal','complete','fail') then raise exception 'invalid_action'; end if;
 end if;
 select coalesce(sum(points),0) into total from public.discovery_rounds where user_id=p_user;
 return jsonb_build_object('id',r.id,'state',r.state,'prediction',r.prediction,'reason',r.reason,'readyAt',r.ready_at,'serverNow',now(),'eligible',r.eligible,'points',r.points,'totalPoints',total,'fresh',fresh,
  'result',case when r.state='revealed' then r.result else null end);
end;
$$;
revoke all on function public.discovery_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.discovery_action(uuid,text,jsonb) to service_role;
