-- BANGER Sets (community tracklists)
create table if not exists setlists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue text,
  played_on date,
  source_url text not null,
  cover_url text,
  created_by uuid,
  created_at timestamptz default now(),
  unlocked_at timestamptz,
  published boolean default true
);
create table if not exists setlist_tracks (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid references setlists(id) on delete cascade,
  position int not null,
  start_sec int,
  title text,            -- null = still an ID
  artist text,
  named_by uuid[] default '{}',
  validated_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists setlist_tracks_set_idx on setlist_tracks (setlist_id, position);
create table if not exists setlist_reactions (
  id bigserial primary key,
  setlist_id uuid references setlists(id) on delete cascade,
  user_id uuid not null,
  kind text not null,    -- like | follow | fire | ask
  track_id uuid,
  at_sec int,
  bucket int not null default -1,
  created_at timestamptz default now(),
  unique (setlist_id, user_id, kind, bucket)
);
create table if not exists setlist_suggestions (
  id bigserial primary key,
  track_id uuid references setlist_tracks(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  artist text not null,
  key text not null,
  weight int not null default 1,
  verified boolean default false,
  status text not null default 'open',   -- open | accepted | rejected | closed
  created_at timestamptz default now()
);
create index if not exists setlist_suggestions_track_idx on setlist_suggestions (track_id, status);
alter table setlists enable row level security;
alter table setlist_tracks enable row level security;
alter table setlist_reactions enable row level security;
alter table setlist_suggestions enable row level security;

-- Release status of named tracks in sets
alter table setlist_tracks add column if not exists released boolean;
alter table setlist_tracks add column if not exists release_date date;
alter table setlist_tracks add column if not exists release_label text;
alter table setlist_tracks add column if not exists release_checked_at timestamptz;

-- Review queue: what the set scan heard is stored as a proposal (never renames an ID by itself)
alter table setlist_suggestions add column if not exists source text default 'user';   -- user | scan
alter table setlist_suggestions add column if not exists heard int;                     -- scan: heard 1× or 2×
alter table setlist_suggestions alter column track_id drop not null;
