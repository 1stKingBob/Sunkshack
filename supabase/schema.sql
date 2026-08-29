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
  -- 0-10, see src/lib/score.ts for how this is derived from a Weave report.
  score numeric not null check (score >= 0 and score <= 10),
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

-- Aggregate view the map reads from: one row per building with its average
-- score and how many reports back it up.
create or replace view building_scores as
select
  b.place_id,
  b.name,
  b.address,
  b.lat,
  b.lng,
  b.category,
  round(avg(r.score)::numeric, 1) as avg_score,
  count(r.id) as report_count,
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
