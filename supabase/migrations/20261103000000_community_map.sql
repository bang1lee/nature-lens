-- Review and apply only to the intended project. No public areas are seeded here.
begin;
create table public.map_areas (
 id text primary key check(id ~ '^[a-z0-9_-]{1,80}$'),
 label text not null check(length(trim(label)) between 1 and 100),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 radius_m integer not null check(radius_m between 500 and 50000),
 active boolean not null default true
);
alter table public.map_areas enable row level security;
revoke all on public.map_areas from public, anon, authenticated;
grant select on public.map_areas to anon, authenticated;
create policy map_areas_public on public.map_areas for select to anon, authenticated using(active);
alter table public.community_submissions add column map_area_id text references public.map_areas(id), add column consent_map boolean not null default false;
alter table public.community_submissions add constraint map_consent_area check(not consent_map or map_area_id is not null);
grant insert(map_area_id,consent_map) on public.community_submissions to authenticated;
-- A submitter can only select an active, operator-defined area.
create function public.validate_community_map_area() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.consent_map and not exists (select 1 from public.map_areas a where a.id=new.map_area_id and a.active) then
  raise exception 'map_area_unavailable';
 end if;
 return new;
end $$;
revoke all on function public.validate_community_map_area() from public,anon,authenticated;
create trigger community_map_area_validate before insert or update of map_area_id,consent_map on public.community_submissions for each row execute function public.validate_community_map_area();
-- Public projection is deliberately minimal, including on DELETE realtime payloads.
create table public.community_map_points (
 id uuid primary key references public.community_submissions(id) on delete cascade,
 area_id text not null references public.map_areas(id),
 area_label text not null,
 latitude double precision not null,
 longitude double precision not null,
 approved_at timestamptz not null
);
create index community_map_recent on public.community_map_points(approved_at desc,id);
alter table public.community_map_points enable row level security;
revoke all on public.community_map_points from public, anon, authenticated;
grant select on public.community_map_points to anon, authenticated;
create policy map_points_public on public.community_map_points for select to anon, authenticated using(exists (select 1 from public.map_areas a where a.id=community_map_points.area_id and a.active));
create function public.sync_community_map_point() returns trigger language plpgsql security definer set search_path='' as $$
declare area public.map_areas%rowtype;
begin
 -- Serialize against area deactivation/coordinate edits before touching its points.
 if new.map_area_id is not null then
  select * into area from public.map_areas where id=new.map_area_id for share;
 end if;
 delete from public.community_map_points where id=new.id;
 if new.status='approved' and new.approved_at is not null and new.protection='common' and new.consent_upload and new.no_people and new.consent_map and area.active then
  insert into public.community_map_points(id,area_id,area_label,latitude,longitude,approved_at)
  values(new.id,area.id,area.label,area.latitude,area.longitude,new.approved_at);
 end if;
 return new;
end $$;
revoke all on function public.sync_community_map_point() from public,anon,authenticated;
create trigger community_map_sync after insert or update on public.community_submissions for each row execute function public.sync_community_map_point();
-- Changes to area policy or representative coordinates propagate atomically.
create function public.sync_community_map_area() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.community_map_points where area_id=new.id;
 if new.active then
  insert into public.community_map_points(id,area_id,area_label,latitude,longitude,approved_at)
  select s.id,new.id,new.label,new.latitude,new.longitude,s.approved_at from public.community_submissions s
  where s.map_area_id=new.id and s.status='approved' and s.approved_at is not null and s.protection='common' and s.consent_upload and s.no_people and s.consent_map;
 end if;
 return new;
end $$;
revoke all on function public.sync_community_map_area() from public,anon,authenticated;
create trigger community_map_area_sync after update on public.map_areas for each row execute function public.sync_community_map_area();
grant all on public.map_areas,public.community_map_points to service_role;
-- Realtime has access to this sanitized table only, never the private submission table.
alter publication supabase_realtime add table public.community_map_points;
commit;
