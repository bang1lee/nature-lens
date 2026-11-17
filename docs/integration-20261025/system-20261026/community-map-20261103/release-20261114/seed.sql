-- Separately applied after successful migration; a pre-existing conflicting ID aborts.
-- Representative point is the rounded midpoint of Yangbok-ri and Oheung-ri; not GPS.
begin;
insert into public.map_areas(id,label,latitude,longitude,radius_m,active)
values ('anseong-cheongnyangsan-area','안성 청량산 일대',37.013,127.334,2000,true)
on conflict(id) do nothing;
do $$ begin
 if not exists (select 1 from public.map_areas where id='anseong-cheongnyangsan-area' and label='안성 청량산 일대' and latitude=37.013 and longitude=127.334 and radius_m=2000 and active) then
  raise exception 'existing public area differs; no changes made';
 end if;
end $$;
commit;
