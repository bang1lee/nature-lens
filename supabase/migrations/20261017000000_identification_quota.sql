-- Server-only quota. Photos, notes, coordinates and API keys are never stored here.
create table public.identification_requests (
 user_id uuid not null,
 request_id uuid not null,
 requested_on date not null default (now() at time zone 'utc')::date,
 primary key(user_id,request_id)
);
create index identification_requests_day on public.identification_requests(requested_on,user_id);
alter table public.identification_requests enable row level security;
revoke all on public.identification_requests from public,anon,authenticated;

create function public.reserve_identification(p_user_id uuid,p_request_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'utc')::date;
begin
 if p_user_id is null or p_request_id is null then raise exception 'invalid_request'; end if;
 -- Serialize all reservations so concurrent users cannot exceed the project cap.
 perform pg_catalog.pg_advisory_xact_lock(20261017);
 delete from public.identification_requests where requested_on < today - 7;
 if exists(select 1 from public.identification_requests where user_id=p_user_id and request_id=p_request_id) then return 'duplicate'; end if;
 if (select count(*) from public.identification_requests where requested_on=today)>=50
 or (select count(*) from public.identification_requests where requested_on=today and user_id=p_user_id)>=5
 then return 'quota'; end if;
 insert into public.identification_requests(user_id,request_id,requested_on) values(p_user_id,p_request_id,today);
 return 'ok';
end;
$$;
revoke all on function public.reserve_identification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_identification(uuid,uuid) to service_role;
