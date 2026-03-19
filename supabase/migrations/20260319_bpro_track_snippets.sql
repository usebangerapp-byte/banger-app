create table if not exists public.bpro_track_snippets (
  id bigserial primary key,
  track_id uuid not null references public.bpro_tracks(id) on delete cascade,
  snippet_path text not null,
  snippet_index int not null,
  start_seconds int not null default 0,
  duration_seconds int,
  acr_id text,
  acr_state int,
  is_preview boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bpro_track_snippets_track_id_idx
  on public.bpro_track_snippets(track_id);

create unique index if not exists bpro_track_snippets_track_snippet_index_uidx
  on public.bpro_track_snippets(track_id, snippet_index);
