-- ============================================
-- Fase 2: CSV mappings + policy profili
-- Applica nel pannello SQL di Supabase
-- ============================================

-- Mappature colonne CSV per fonte bancaria
create table csv_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source_name text not null,
  headers_fingerprint text not null,
  column_map jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, headers_fingerprint)
);

alter table csv_mappings enable row level security;

create policy "Gestisci le tue mappature CSV" on csv_mappings
  for all using (user_id = auth.uid());

-- Policy mancanti su profiles (necessarie per l'upsert dal dashboard)
create policy "Crea il tuo profilo" on profiles
  for insert with check (auth.uid() = id);

create policy "Aggiorna il tuo profilo" on profiles
  for update using (auth.uid() = id);
