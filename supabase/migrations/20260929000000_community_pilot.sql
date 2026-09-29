-- Apply only to a reviewed, dedicated Supabase project. No private GPS fields.
begin;
create table public.profiles (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 alias text not null unique check (alias ~ '^[0-9A-Za-z가-힣_]{2,20}$' and lower(alias) !~ '^(admin|administrator|root|system|nature_?lens|new_?leaf|운영자|관리자|뉴리프|네이처렌즈)$')
);
create table public.community_submissions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references public.profiles(user_id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 120),
 species text not null check(length(trim(species)) between 1 and 100),
 scientific_name text not null check(length(scientific_name)<=140),
 observed_on date not null,
 notes text not null check(length(trim(notes)) between 1 and 4000),
 habitat text not null check(length(habitat)<=150),
 taxon_group text not null check(taxon_group in ('plant','insect','other')),
 region text check(region is null),
 protection text not null check(protection in ('unknown','protected','common')),
 photo text not null check(length(photo)<=6000000 and photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'),
 consent_upload boolean not null check(consent_upload), no_people boolean not null check(no_people),
 ai_assisted boolean not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), approved_at timestamptz,
 moderation_note text check(length(moderation_note)<=500),
 check(status <> 'approved' or approved_at is not null)
);
create index community_owner on public.community_submissions(owner_id);
create index community_published on public.community_submissions(approved_at desc) where status='approved';
alter table public.profiles enable row level security;
alter table public.community_submissions enable row level security;
revoke all on public.profiles, public.community_submissions from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant insert(alias) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy profiles_create on public.profiles for insert to authenticated with check(user_id=(select auth.uid()));
grant select,delete on public.community_submissions to authenticated;
grant insert(title,species,scientific_name,observed_on,notes,habitat,taxon_group,region,protection,photo,consent_upload,no_people,ai_assisted) on public.community_submissions to authenticated;
create policy submissions_read on public.community_submissions for select to authenticated using(owner_id=(select auth.uid()));
create policy submissions_create on public.community_submissions for insert to authenticated with check(owner_id=(select auth.uid()) and status='pending' and approved_at is null);
create policy submissions_delete on public.community_submissions for delete to authenticated using(owner_id=(select auth.uid()));
-- Per-owner caps serialized to prevent concurrent insert bypass. Not a global billing cap.
create function public.limit_community_submissions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
 if (select count(*) from public.community_submissions where owner_id=new.owner_id)>=100 then raise exception 'submission_limit'; end if;
 if (select count(*) from public.community_submissions where owner_id=new.owner_id and status='pending')>=10 then raise exception 'pending_limit'; end if;
 return new;
end; $$;
revoke all on function public.limit_community_submissions() from public,anon,authenticated;
create trigger community_limits before insert on public.community_submissions for each row execute function public.limit_community_submissions();
-- Intentional definer view: base rows are owner-only; expose ONLY approved public fields.
-- Keep owner_id, moderation notes and all private data out of this view.
create view public.community_feed with (security_barrier=true) as
 select s.id,s.title,s.species,s.scientific_name,s.observed_on,s.notes,s.taxon_group,s.region,s.photo,p.alias as author_alias,s.approved_at
 from public.community_submissions s join public.profiles p on p.user_id=s.owner_id
 where s.status='approved' and s.consent_upload and s.no_people and s.approved_at is not null;
revoke all on public.community_feed from public,anon,authenticated;
grant select on public.community_feed to anon,authenticated;
-- Only trusted server/SQL operator moderates; never grant update to browser roles.
grant all on public.profiles,public.community_submissions to service_role;
commit;
