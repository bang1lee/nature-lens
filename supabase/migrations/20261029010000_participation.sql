-- Self-reported daily observation participation, not verified scientific quality.
-- No photo, species, location, name or email leaves the device through this API.
-- Existing discovery scoring remains unchanged. Apply after discovery_game.
begin;

create table public.daily_observation_participation (
 user_id uuid not null references auth.users(id) on delete cascade,
 participation_day date not null,
 observation_id uuid not null,
 points integer not null default 2 check (points = 2),
 created_at timestamptz not null default now(),
 primary key (user_id, participation_day),
 unique (user_id, observation_id)
);
alter table public.daily_observation_participation enable row level security;
revoke all on public.daily_observation_participation from public, anon, authenticated;

-- Neither function accepts a user ID. Supabase validates the JWT and supplies it.
create function public.participation_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 member_id uuid := auth.uid();
 today date := (now() at time zone 'Asia/Seoul')::date;
 daily_points bigint;
 prediction_points bigint;
 observation_days bigint;
 total_points bigint;
begin
 if member_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
  raise exception 'login_required' using errcode = '42501';
 end if;
 select coalesce(sum(points), 0), count(*) into daily_points, observation_days
 from public.daily_observation_participation where user_id = member_id;
 select coalesce(sum(points), 0) into prediction_points
 from public.discovery_rounds where user_id = member_id;
 total_points := daily_points + prediction_points;
 return jsonb_build_object(
  'dailyPoints', daily_points, 'predictionPoints', prediction_points,
  'totalPoints', total_points, 'observationDays', observation_days,
  'tier', case when total_points >= 100 then 'tree' when total_points >= 20 then 'sprout' else 'seed' end,
  'todayClaimed', exists(select 1 from public.daily_observation_participation where user_id = member_id and participation_day = today),
  'serverDate', today, 'awarded', 0, 'claimStatus', 'read'
 );
end;
$$;
revoke all on function public.participation_summary() from public, anon, authenticated;
grant execute on function public.participation_summary() to authenticated;

create function public.claim_daily_observation(p_observation_id uuid, p_observed_on date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 member_id uuid := auth.uid();
 today date := (now() at time zone 'Asia/Seoul')::date;
begin
 if member_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
  raise exception 'login_required' using errcode = '42501';
 end if;
 if p_observation_id is null or p_observed_on is distinct from today then
  raise exception 'today_observation_required' using errcode = '22023';
 end if;
 -- Serialize the same member's claims, including two simultaneous devices.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(member_id::text, 0));
 if exists(select 1 from public.daily_observation_participation where user_id = member_id and participation_day = today) then
  return public.participation_summary() || jsonb_build_object('claimStatus', 'already_today');
 end if;
 if exists(select 1 from public.daily_observation_participation where user_id = member_id and observation_id = p_observation_id) then
  return public.participation_summary() || jsonb_build_object('claimStatus', 'already_recorded');
 end if;
 insert into public.daily_observation_participation(user_id, participation_day, observation_id)
 values(member_id, today, p_observation_id);
 return public.participation_summary() || jsonb_build_object('awarded', 2, 'claimStatus', 'awarded');
end;
$$;
revoke all on function public.claim_daily_observation(uuid, date) from public, anon, authenticated;
grant execute on function public.claim_daily_observation(uuid, date) to authenticated;

commit;
