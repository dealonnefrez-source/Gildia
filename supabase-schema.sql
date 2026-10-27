create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  imie text not null check (char_length(imie) between 1 and 40),
  rasa text not null check (rasa in ('Ork', 'Undead', 'Tauren', 'Troll', 'Skyelf')),
  klasa text not null check (klasa in ('Warrior', 'Hunter', 'Mage', 'Warlock', 'Shaman', 'Priest', 'Paladin', 'Rogue', 'Druid')),
  rola text not null default 'DPS' check (rola in ('Tank', 'Healer', 'DPS')),
  profesja_1 text not null default '' check (char_length(profesja_1) <= 60),
  poziom_profesji_1 integer not null default 0 check (poziom_profesji_1 between 0 and 600),
  profesja_2 text not null default '' check (char_length(profesja_2) <= 60),
  poziom_profesji_2 integer not null default 0 check (poziom_profesji_2 between 0 and 600),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  starts_at timestamptz not null,
  description text check (description is null or char_length(description) <= 1000),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.event_signups (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_signups_pkey primary key (event_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_signups enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, delete on public.event_signups to authenticated;

create policy "Authenticated users can view profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Authenticated users can view events"
  on public.events for select to authenticated
  using (true);

create policy "Authenticated users can create events"
  on public.events for insert to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Event creators can update their events"
  on public.events for update to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "Event creators can delete their events"
  on public.events for delete to authenticated
  using ((select auth.uid()) = created_by);

create policy "Authenticated users can view event signups"
  on public.event_signups for select to authenticated
  using (true);

create policy "Users can sign up as themselves"
  on public.event_signups for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can cancel their own signup"
  on public.event_signups for delete to authenticated
  using ((select auth.uid()) = user_id);
