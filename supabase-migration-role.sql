-- Legacy migration only. For the updated character card, use
-- supabase-migration-character-card.sql instead (it also migrates the role).
-- Do not run this after that migration or after the current supabase-schema.sql.
alter table public.profiles
  add column if not exists role text not null default 'DPS'
  check (role in ('Tank', 'Healer', 'DPS'));
