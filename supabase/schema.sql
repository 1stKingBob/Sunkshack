-- Weave Community — schema.
--
-- Run this once in the Supabase SQL editor for a fresh project.
--
-- Security note for a hackathon build: RLS policies below allow anyone with
-- the public anon key to insert and read. That is deliberate — there is no
-- auth in this app yet — but it means anyone can post a score for any
-- building. Fine for a demo; add auth + ownership checks before this is
-- exposed to strangers on the internet.

create extension if not exists pgcrypto;

create table if not exists buildings (
  place_id text primary key,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists accessibility_reports (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references buildings (place_id) on delete cascade,
  -- Does this report clear AS 1428.1 / ADA with margin to spare? See
  -- src/community/lib/score.ts — every route and the turning circle must
  -- beat the code minimum by ACCESS_MARGIN_MM (150 mm), not just meet it.
  accessible boolean not null,
  profile_id text not null,
  profile_name text not null,
  room_width_mm integer,
  room_depth_mm integer,
  -- [{ label, measuredMm, requiredMm, passes }], one per route checked
  routes jsonb not null default '[]',
  -- { diameterMm, requiredMm, passes } | null
  turning jsonb,
  passes boolean not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists accessibility_reports_place_id_idx
  on accessibility_reports (place_id);

-- Migration for a database created before the score → accessible switch.
-- Every statement here is idempotent, so re-running the whole file is safe
-- whether the table is brand new or already exists with the old shape. Old
-- rows can't be reclassified against the new margin rule from a bare 0-10
-- score, so they backfill to false (not accessible) rather than a guess.
alter table accessibility_reports add column if not exists accessible boolean;
update accessibility_reports set accessible = false where accessible is null;
alter table accessibility_reports alter column accessible set not null;
alter table accessibility_reports drop column if exists score;

-- Aggregate view the map reads from: one row per building with how many
-- reports call it accessible vs. not, and a majority-vote verdict. A tie
-- counts as not accessible — the honest default when the evidence is split.
drop view if exists building_scores;
create view building_scores as
select
  b.place_id,
  b.name,
  b.address,
  b.lat,
  b.lng,
  b.category,
  count(r.id) filter (where r.accessible) as accessible_count,
  count(r.id) as report_count,
  count(r.id) filter (where r.accessible) * 2 > count(r.id) as accessible,
  max(r.created_at) as last_reported_at
from buildings b
join accessibility_reports r on r.place_id = b.place_id
group by b.place_id, b.name, b.address, b.lat, b.lng, b.category;

alter table buildings enable row level security;
alter table accessibility_reports enable row level security;

create policy "buildings are publicly readable"
  on buildings for select using (true);
create policy "anyone can register a building"
  on buildings for insert with check (true);

create policy "reports are publicly readable"
  on accessibility_reports for select using (true);
create policy "anyone can submit a report"
  on accessibility_reports for insert with check (true);
