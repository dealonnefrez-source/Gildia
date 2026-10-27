alter table public.profiles
  add column if not exists role text not null default 'DPS'
  check (role in ('Tank', 'Healer', 'DPS'));
