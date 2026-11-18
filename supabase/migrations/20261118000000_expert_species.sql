-- Local proposal only. Enable requests only after an actual review operation is staffed.
begin;
create table public.expert_service_settings (id boolean primary key default true check(id), accepting boolean not null default false);
insert into public.expert_service_settings(id) values(true);
create table public.expert_requests (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 submission_id uuid references public.community_submissions(id) on delete set null,
 observation_id text not null check(length(observation_id) between 1 and 100), question text not null check(length(trim(question)) between 1 and 500),
 created_at timestamptz not null default now(), unique(owner_id, observation_id)
);
alter table public.expert_service_settings enable row level security;
alter table public.expert_requests enable row level security;
revoke all on public.expert_service_settings, public.expert_requests from public,anon,authenticated;
grant select on public.expert_service_settings to anon,authenticated;
create policy expert_settings_read on public.expert_service_settings for select to anon,authenticated using(true);
grant select,delete on public.expert_requests to authenticated;
grant insert(owner_id,observation_id,question,submission_id) on public.expert_requests to authenticated;
create policy expert_request_read on public.expert_requests for select to authenticated using(owner_id=(select auth.uid()));
create policy expert_request_delete on public.expert_requests for delete to authenticated using(owner_id=(select auth.uid()));
create policy expert_request_create on public.expert_requests for insert to authenticated with check(owner_id=(select auth.uid()) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and exists(select 1 from public.expert_service_settings where accepting) and (submission_id is null or exists(select 1 from public.community_submissions s where s.id=submission_id and s.owner_id=(select auth.uid()) and s.consent_upload and s.no_people)));
-- Only the trusted operator may add an identified expert's response. Owners can read their own.
create table public.expert_responses (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.expert_requests(id) on delete cascade,
 expert_id text not null check(length(trim(expert_id)) between 1 and 100),
 response text not null check(length(trim(response)) between 1 and 2000),
 created_at timestamptz not null default now()
);
alter table public.expert_responses enable row level security;
revoke all on public.expert_responses from public,anon,authenticated;
grant select on public.expert_responses to authenticated;
create policy expert_response_owner_read on public.expert_responses for select to authenticated using(exists(select 1 from public.expert_requests q where q.id=request_id and q.owner_id=(select auth.uid())));
grant all on public.expert_responses to service_role;
-- Expert assessments are written only by a trusted operator; editorial approval alone is insufficient.
create table public.expert_species_reviews (
 submission_id uuid primary key references public.community_submissions(id) on delete cascade,
 scientific_name text not null check(length(trim(scientific_name)) between 1 and 140),
 expert_id text not null check(length(trim(expert_id)) between 1 and 100),
 rationale text not null check(length(trim(rationale)) between 1 and 2000),
 reviewed_at timestamptz not null default now()
);
alter table public.expert_species_reviews enable row level security;
revoke all on public.expert_species_reviews from public,anon,authenticated;
grant all on public.expert_requests,public.expert_species_reviews,public.expert_service_settings to service_role;
-- Only counts and verified names are exposed; no user text, photos, dates, or location.
create view public.public_species_summary with (security_barrier=true) as
 select r.scientific_name, count(*)::integer as observations
 from public.expert_species_reviews r join public.community_submissions s on s.id=r.submission_id
 where s.status='approved' and s.approved_at is not null and s.consent_upload and s.no_people
 group by r.scientific_name;
revoke all on public.public_species_summary from public,anon,authenticated;
grant select on public.public_species_summary to anon,authenticated;
commit;
