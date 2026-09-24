# Nucleo — contesto per Claude Code

App di analisi finanziaria personale e di coppia (spese, busta paga, nucleo familiare).

## Stack
- Next.js 14 (App Router) + TypeScript
- Supabase: Postgres, Auth, Storage
- Deploy: Vercel (frontend, API routes, cron job)

## Comandi
- `npm run dev` — sviluppo locale
- `npm run build` — build di produzione
- `npm run lint` — linting

## Convenzioni
- Tabelle e colonne del database in snake_case (vedi `../supabase/schema.sql`)
- Tipi TypeScript corrispondenti in `../lib/types.ts`, in PascalCase
- Componenti React in PascalCase, un componente per file
- Le query Supabase lato client passano da `../lib/supabaseClient.ts`

## Modello dati (riferimento rapido)
- `profiles` — un utente, collegato a `auth.users`, con `household_id` opzionale
- `households` — nucleo familiare che collega due profili
- `household_invites` — codici di invito per collegare un partner
- `expenses` — spese, con `is_shared` per decidere cosa è visibile al partner
- `payslips` — analisi busta paga (lordo, netto, IRPEF, INPS, TFR, straordinari)

Row Level Security è già attiva su tutte le tabelle: ogni utente vede solo i propri
dati, o i dati condivisi (`is_shared = true`) del proprio nucleo familiare.

## Fasi di sviluppo
0. Setup progetto (Supabase + Vercel + env)
1. MVP: login, inserimento spesa manuale, dashboard personale
2. Import CSV/PDF + categorizzazione automatica (dizionario + fallback ML)
3. Analisi busta paga
4. Nucleo familiare (invito partner, dashboard aggregata)
5. Collegamento Google Drive (OAuth separato dal login + Vercel Cron)

Lavorare una fase alla volta, in sessioni separate quando possibile.
