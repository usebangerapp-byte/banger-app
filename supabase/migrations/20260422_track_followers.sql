create table if not exists public.track_followers (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  track_title text not null,
  track_subtitle text,
  created_at timestamptz not null default now()
);

create unique index if not exists track_followers_user_track_uidx
  on public.track_followers (
    user_id,
    track_title,
    coalesce(track_subtitle, '')
  );

alter table public.track_followers enable row level security;

drop policy if exists "track_followers_select_own" on public.track_followers;
create policy "track_followers_select_own"
on public.track_followers
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "track_followers_insert_own" on public.track_followers;
create policy "track_followers_insert_own"
on public.track_followers
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "track_followers_delete_own" on public.track_followers;
create policy "track_followers_delete_own"
on public.track_followers
for delete
to authenticated
using (auth.uid() = user_id);
