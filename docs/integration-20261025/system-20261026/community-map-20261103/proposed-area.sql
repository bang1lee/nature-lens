-- REVIEW ONLY: Do not apply without separate authorization and local SQL/RLS testing.
-- Public representative area for the broader confirmed Cheongnyangsan vicinity.
-- This is a rounded midpoint of the OSM Yangbok-ri and Oheung-ri representative
-- coordinates, NOT a summit, observation, trail, or surveyed area boundary.
-- radius_m is a proposed broad operational label, not a geofence or precision claim.
insert into public.map_areas(id,label,latitude,longitude,radius_m,active)
values ('anseong-cheongnyangsan-area','안성 청량산 일대',37.013,127.334,2000,true);
