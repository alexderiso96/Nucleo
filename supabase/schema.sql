-- ============================================
-- Schema: Bilancio di famiglia
-- ============================================

-- Nucleo familiare: entità che collega piu' utenti
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'La mia famiglia',
  created_at timestamptz not null default now()
);

-- Profilo utente, collegato a auth.users di Supabase
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  household_id uuid references households(id) on delete set null,
  drive_file_url text, -- link al file Drive collegato (se autorizzato)
  drive_last_synced_at timestamptz, -- ultima volta che abbiamo letto il file
  created_at timestamptz not null default now()
);

-- Codici di invito per collegare un secondo account al nucleo familiare
create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Spese
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  household_id uuid references households(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  category text not null default 'altro',
  description text,
  expense_date date not null,
  source text not null default 'manual', -- manual | csv | drive | email
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

-- Analisi busta paga
create table payslips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  period_month date not null, -- es. 2026-09-01 per rappresentare il mese
  gross_amount numeric(12,2) not null,
  net_amount numeric(12,2) not null,
  irpef numeric(12,2) default 0,
  inps_contributions numeric(12,2) default 0,
  regional_municipal_tax numeric(12,2) default 0,
  overtime_hours numeric(6,2) default 0,
  overtime_amount numeric(12,2) default 0,
  meal_vouchers numeric(12,2) default 0,
  tfr_accrued_this_period numeric(12,2) default 0,
  tfr_total_accrued numeric(12,2) default 0,
  source_file_url text,
  created_at timestamptz not null default now(),
  unique (user_id, period_month)
);

-- ============================================
-- Row Level Security: ognuno vede solo i propri dati
-- o i dati condivisi del proprio nucleo familiare
-- ============================================

alter table profiles enable row level security;
alter table expenses enable row level security;
alter table payslips enable row level security;
alter table household_invites enable row level security;

create policy "Vedi il tuo profilo" on profiles
  for select using (auth.uid() = id);

create policy "Vedi le tue spese o quelle condivise del tuo nucleo" on expenses
  for select using (
    user_id = auth.uid()
    or (is_shared and household_id in (
      select household_id from profiles where id = auth.uid()
    ))
  );

create policy "Gestisci le tue spese" on expenses
  for insert with check (user_id = auth.uid());

create policy "Modifica le tue spese" on expenses
  for update using (user_id = auth.uid());

create policy "Vedi solo la tua busta paga" on payslips
  for select using (user_id = auth.uid());

create policy "Gestisci la tua busta paga" on payslips
  for all using (user_id = auth.uid());
