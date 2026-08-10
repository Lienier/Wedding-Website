create table if not exists public.wishes (
  id text primary key,
  name text not null check (char_length(name) between 1 and 40),
  relation text default '',
  type text not null check (type in ('Wish', 'Prayer', 'Advice', 'Memory')),
  message text not null check (char_length(message) between 1 and 280),
  likes integer not null default 0 check (likes >= 0),
  paper text,
  rot numeric,
  size text,
  shape text,
  decor text,
  x numeric not null default 20,
  y numeric not null default 20,
  z integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 120),
  contact text not null check (char_length(contact) between 1 and 160),
  attendance text not null check (attendance in ('accepts', 'declines')),
  guests integer not null default 1 check (guests >= 1),
  message text default '' check (char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.wishes enable row level security;
alter table public.rsvps enable row level security;

-- Apply this as well if the rsvps table was created with the previous 1–4 limit.
alter table public.rsvps drop constraint if exists rsvps_guests_check;
alter table public.rsvps add constraint rsvps_guests_check check (guests >= 1);

drop policy if exists "Anyone can read wishes" on public.wishes;
create policy "Anyone can read wishes" on public.wishes for select using (true);

drop policy if exists "Anyone can add wishes" on public.wishes;
create policy "Anyone can add wishes" on public.wishes for insert with check (true);

drop policy if exists "Anyone can update wish likes and placement" on public.wishes;
create policy "Anyone can update wish likes and placement" on public.wishes for update using (true) with check (true);

drop policy if exists "Anyone can submit an RSVP" on public.rsvps;
create policy "Anyone can submit an RSVP" on public.rsvps for insert with check (true);
