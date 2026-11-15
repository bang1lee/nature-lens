-- New opt-in public beta only. Does not alter legacy observations or obs-photos.
begin;
create table public.beta_public_observations (
 id uuid primary key,
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 local_id text not null check(length(local_id) between 1 and 100),
 photo_path text not null unique check(photo_path=id::text||'.jpg'),
 photo_sha256 text not null check(photo_sha256 ~ '^[0-9a-f]{64}$'),
 record jsonb not null check(
  jsonb_typeof(record)='object' and octet_length(record::text)<=100000
  and record ?& array['id','title','species','date','notes']
  and jsonb_typeof(record->'id')='string' and record->>'id'=local_id
  and jsonb_typeof(record->'title')='string' and length(record->>'title') between 1 and 120
  and jsonb_typeof(record->'species')='string' and length(record->>'species')<=100
  and jsonb_typeof(record->'notes')='string' and length(record->>'notes')<=4000
  and jsonb_typeof(record->'date')='string' and record->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
  and not (record ?| array['photo','region','publicGrid','latitude','longitude','gps','privateLocation'])
 ),
 public_consent boolean not null check(public_consent), no_people boolean not null check(no_people),
 state text not null default 'staging' check(state in ('staging','published')),
 created_at timestamptz not null default now(), published_at timestamptz,
 unique(owner_id,local_id),
 check(state<>'published' or published_at is not null)
);
create index beta_public_recent on public.beta_public_observations(published_at desc,id) where state='published';
alter table public.beta_public_observations enable row level security;
revoke all on public.beta_public_observations from public,anon,authenticated;
grant select on public.beta_public_observations to authenticated;
grant insert(id,owner_id,local_id,photo_path,photo_sha256,record,public_consent,no_people) on public.beta_public_observations to authenticated;
grant update(state) on public.beta_public_observations to authenticated;
create policy beta_owner_read on public.beta_public_observations for select to authenticated using(owner_id=(select auth.uid()));
create policy beta_owner_insert on public.beta_public_observations for insert to authenticated with check(owner_id=(select auth.uid()) and state='staging' and published_at is null);
create policy beta_owner_publish on public.beta_public_observations for update to authenticated using(owner_id=(select auth.uid()) and state='staging') with check(owner_id=(select auth.uid()) and state='published');
create function public.beta_limit_and_publish() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,222));
  if (select count(*) from public.beta_public_observations where owner_id=new.owner_id)>=500 then raise exception 'beta_record_limit'; end if;
 elsif new.state='published' and old.state='staging' then
  if not exists(select 1 from storage.objects where bucket_id='nature-lens-beta-public' and name=new.photo_path) then raise exception 'beta_photo_missing'; end if;
  new.published_at=now();
 end if;
 return new;
end $$;
revoke all on function public.beta_limit_and_publish() from public,anon,authenticated;
create trigger beta_limit_publish before insert or update on public.beta_public_observations for each row execute function public.beta_limit_and_publish();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('nature-lens-beta-public','nature-lens-beta-public',true,4500000,array['image/jpeg']);
-- UUID path does not embed an account identifier. Only the owner's reserved path is writable.
create policy beta_photo_insert on storage.objects for insert to authenticated with check(bucket_id='nature-lens-beta-public' and exists(select 1 from public.beta_public_observations r where r.owner_id=(select auth.uid()) and r.state='staging' and r.photo_path=name));
create policy beta_photo_owner_read on storage.objects for select to authenticated using(bucket_id='nature-lens-beta-public' and exists(select 1 from public.beta_public_observations r where r.owner_id=(select auth.uid()) and r.photo_path=name));
-- Intentional definer view: only published, approved-for-public-beta fields; no owner or private metadata.
create view public.beta_public_feed with (security_barrier=true) as
 select id,record->>'title' as title,record->>'species' as species,record->>'date' as observed_on,record->>'notes' as notes,photo_path,published_at
 from public.beta_public_observations where state='published';
revoke all on public.beta_public_feed from public,anon,authenticated;
grant select on public.beta_public_feed to anon,authenticated;
grant all on public.beta_public_observations to service_role;
commit;
