create extension if not exists pgcrypto;

create table if not exists public.bpro_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  snippet_path text,
  release_date date,
  allow_preview boolean not null default false,
  uploader_email text not null,
  status text not null default 'processing',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.unreleased_tracks
add column if not exists source_bpro_id uuid;

create unique index if not exists unreleased_tracks_source_bpro_id_key
on public.unreleased_tracks (source_bpro_id);

create or replace function public.sync_bpro_to_unreleased_tracks()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'ready'
     and new.snippet_path is not null then

    insert into public.unreleased_tracks (
      source_bpro_id,
      title,
      artist,
      snippet_path,
      release_date,
      allow_preview,
      uploader_email
    )
    values (
      new.id,
      new.title,
      new.artist,
      new.snippet_path,
      new.release_date,
      coalesce(new.allow_preview,false),
      new.uploader_email
    )
    on conflict (source_bpro_id)
    do update set
      title = excluded.title,
      artist = excluded.artist,
      snippet_path = excluded.snippet_path,
      release_date = excluded.release_date,
      allow_preview = excluded.allow_preview,
      uploader_email = excluded.uploader_email;

  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_bpro_to_unreleased_tracks
on public.bpro_tracks;

create trigger trg_sync_bpro_to_unreleased_tracks
after insert or update on public.bpro_tracks
for each row
execute function public.sync_bpro_to_unreleased_tracks();
