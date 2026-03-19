drop trigger if exists trg_sync_bpro_to_unreleased_tracks on public.bpro_tracks;
drop function if exists public.sync_bpro_to_unreleased_tracks;
drop table if exists public.unreleased_tracks;
