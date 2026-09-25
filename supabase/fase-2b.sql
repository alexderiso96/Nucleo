-- merchant_rules: dizionario pattern → categoria per utente
create table if not exists merchant_rules (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  pattern     text        not null,
  category    text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, pattern)
);
alter table merchant_rules enable row level security;
create policy "Gestisci le tue regole merchant" on merchant_rules
  for all using (user_id = auth.uid());

-- Confidenza categoria: 'high' (utente o regola nota) | 'low' (auto, da rivedere)
alter table expenses
  add column if not exists category_confidence text
    check (category_confidence in ('high', 'low'))
    default 'low';
