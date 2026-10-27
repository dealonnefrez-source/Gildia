-- Existing database: run this once in the Supabase SQL Editor before deploying
-- the updated frontend. New databases should use supabase-schema.sql instead.
-- Existing profession data becomes profesja_1; unknown levels start at 0.
-- Column renames preserve data, grants and existing row-level security policies.
begin;

alter table public.profiles
  add column if not exists role text not null default 'DPS'
  check (role in ('Tank', 'Healer', 'DPS'));

alter table public.profiles rename column character_name to imie;
alter table public.profiles rename column race to rasa;
alter table public.profiles rename column character_class to klasa;
alter table public.profiles rename column role to rola;
alter table public.profiles rename column profession to profesja_1;

alter table public.profiles drop constraint profiles_character_class_check;

update public.profiles
set klasa = case klasa
  when 'Shamman' then 'Shaman'
  when 'Rodue' then 'Rogue'
  else klasa
end
where klasa in ('Shamman', 'Rodue');

alter table public.profiles
  add constraint profiles_klasa_check
    check (klasa in ('Warrior', 'Hunter', 'Mage', 'Warlock', 'Shaman', 'Priest', 'Paladin', 'Rogue', 'Druid')),
  add column poziom_profesji_1 integer not null default 0 check (poziom_profesji_1 between 0 and 600),
  add column profesja_2 text not null default '' check (char_length(profesja_2) <= 60),
  add column poziom_profesji_2 integer not null default 0 check (poziom_profesji_2 between 0 and 600);

commit;
