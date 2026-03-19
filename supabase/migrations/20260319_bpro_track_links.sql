alter table public.bpro_tracks
add column if not exists spotify_url text,
add column if not exists beatport_url text;
