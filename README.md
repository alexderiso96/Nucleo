# Nucleo

App di analisi finanziaria personale e di coppia: spese, busta paga, nucleo familiare collegato.

## Stack

- **Frontend + API + Cron**: Next.js (TypeScript), hostato su Vercel
- **Database + Auth + Storage**: Supabase (Postgres)

## Setup locale

```bash
npm install
cp .env.example .env.local   # inserisci le chiavi Supabase
npm run dev
```

## Struttura

```
app/               # pagine e route Next.js
lib/               # client Supabase, tipi, logica di categorizzazione
supabase/schema.sql # schema del database (tabelle + RLS)
vercel.json        # configurazione dei cron job
```

## Fasi di sviluppo

Vedi il piano di sviluppo condiviso in chat: Fase 0 (setup) → Fase 1 (MVP singolo utente) →
Fase 2 (import + categorizzazione) → Fase 3 (analisi busta paga) → Fase 4 (nucleo familiare) →
Fase 5 (collegamento Google Drive).
