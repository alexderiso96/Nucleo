# Piano di sviluppo — Nucleo

App di analisi finanziaria personale e di coppia: spese, busta paga, nucleo
familiare collegato.

## Stack tecnico

- **Frontend + API + logica applicativa**: Next.js 14 (App Router) + TypeScript, su Vercel
- **Database + Auth + Storage**: Supabase (Postgres)
- **Nessun servizio terzo per job periodici** — vedi Fase 5, Opzione A

## Decisioni chiave (perché così)

- **Vercel + Supabase, non tre servizi**: inizialmente si era considerato anche
  Railway per i job periodici, ma è stato eliminato — meno servizi da gestire,
  più adatto a un progetto sviluppato con Claude Code in sessioni singole.
- **Autenticazione app vs autorizzazione Drive sono due cose separate**: il
  login (Supabase Auth) e il consenso OAuth per leggere Google Drive hanno
  scope diversi e vanno implementati come due flussi indipendenti, non uno
  dentro l'altro.
- **Niente cron esterno per la sincronizzazione Drive (Opzione A)**: invece di
  un vero scheduler, la sincronizzazione si attiva quando l'utente apre la
  dashboard, se sono passati più di 30 minuti dall'ultima volta. Vedi
  `lib/driveSync.ts` nello scheletro del progetto.
- **Dizionario esercenti costruito nel tempo, non un'API esterna**: parte
  vuoto o pre-seminato a mano, si arricchisce con le correzioni dell'utente.
  Un modello linguistico fa da fallback per gli esercenti nuovi.

---

## Fase 0 — Setup — ✅ COMPLETATA

- [x] Progetto Supabase creato
- [x] Schema applicato (`supabase/schema.sql`), incluse le colonne
      `drive_file_url` e `drive_last_synced_at` su `profiles`
- [x] Chiavi Supabase recuperate (Settings → Data API / API Keys)
- [x] Account GitHub collegato a Vercel, repository importato
- [x] File minimi Next.js (`app/layout.tsx`, `app/page.tsx`, `tsconfig.json`,
      `next.config.js`) aggiunti — la build passa
- [x] Deploy su Vercel funzionante

**Da tenere a mente per dopo**: login con Google su Supabase Auth non ancora
configurato (opzionale, si può fare quando si arriva al login in Fase 1).

---

## Fase 1 — MVP: uso singolo, inserimento manuale

**Obiettivo**: un'app che usi davvero, anche minimale.

- [x] Pagina di login/registrazione (Supabase Auth — email/password)
- [x] Middleware/redirect: utente non loggato → pagina di login
- [x] Form di inserimento spesa manuale: importo, categoria (lista fissa),
      data, descrizione → salva in `expenses`
- [x] Lista spese del mese corrente
- [x] Dashboard base: totale spese del mese, conteggio transazioni
- [ ] Deploy e verifica reale con dati tuoi

**Sessioni Claude Code consigliate**: separare "autenticazione" da "form +
lista spese" da "dashboard" — non chiedere tutto insieme.

**Traguardo di fase**: puoi inserire una spesa vera e vederla nella dashboard.

---

## Fase 2 — Import e categorizzazione automatica

- [ ] Parser CSV per estratto conto (mapping colonne configurabile, il
      formato varia da banca a banca)
- [ ] Estrazione dati da PDF busta paga (probabilmente la parte più delicata:
      formati diversi tra software HR/aziende — prevedere un fallback
      manuale se il parsing fallisce)
- [ ] Dizionario esercenti: tabella `merchant_rules` (nome/pattern →
      categoria), con match su testo normalizzato (minuscolo, rimozione
      codici città/POS)
- [ ] Fallback: chiamata a un modello linguistico per gli esercenti non
      trovati nel dizionario
- [ ] UI per correggere una categoria assegnata male → la correzione
      aggiorna/crea una riga nel dizionario

**Sessioni Claude Code consigliate**: "parser CSV", "parser PDF",
"categorizzazione" come tre sessioni distinte — sono logiche indipendenti.

**Traguardo di fase**: importi un CSV reale e la maggior parte delle spese
viene categorizzata correttamente senza intervento manuale.

---

## Fase 3 — Analisi busta paga

- [ ] Schermata dedicata: lordo, netto, IRPEF, contributi INPS, addizionali
- [ ] TFR: accantonato nel mese, totale accumulato
- [ ] Voci variabili: straordinari (ore + importo), buoni pasto
- [ ] Trend mese su mese (grafico o confronto semplice)
- [ ] Alert automatico su variazioni significative rispetto al mese
      precedente (es. "netto calato del 4%")

**Traguardo di fase**: carichi una busta paga in PDF e vedi la scomposizione
completa, non solo lordo/netto.

---

## Fase 4 — Nucleo familiare

- [ ] Generazione codice di invito (`household_invites`), con scadenza
- [ ] Il partner, già loggato con account proprio, inserisce il codice →
      i due `profiles` vengono collegati allo stesso `household_id`
- [ ] Dashboard aggregata: reddito familiare, spese condivise, risparmio
      combinato
- [ ] Gestione privacy per singola spesa: toggle `is_shared` (visibile al
      partner o no)

**Dipendenza**: richiede che ognuno abbia già un account popolato di dati
propri (Fasi 1-3) — non ha senso "collegare il vuoto".

**Traguardo di fase**: tu e il partner vedete entrambi la stessa dashboard
di coppia, ognuno con i propri dati privati intatti.

---

## Fase 5 — Collegamento Google Drive

- [ ] Flusso OAuth separato dal login (scope `drive.readonly` o
      `drive.file`), richiesto in una schermata dedicata nelle impostazioni
- [ ] Salvataggio del refresh token (non solo l'access token, che scade
      dopo un'ora)
- [ ] Lettura del file Drive collegato (CSV o Google Sheet via API Sheets)
- [ ] **Sincronizzazione — Opzione A**: nessun cron esterno. All'apertura
      della dashboard, `lib/driveSync.ts` controlla `drive_last_synced_at`
      e rilancia la sincronizzazione se sono passati più di 30 minuti
- [ ] Deduplicazione: evitare di importare due volte la stessa spesa se
      arriva sia da Drive sia da import manuale/CSV

**Traguardo di fase**: colleghi il tuo Google Drive una volta, e da lì in
poi le spese nuove compaiono da sole aprendo l'app, senza reimportare nulla
a mano.

---

## Note per le sessioni con Claude Code

- Il file `CLAUDE.md` nella root del progetto contiene già stack,
  convenzioni e modello dati — Claude Code lo legge automaticamente a inizio
  sessione.
- Lavorare una fase alla volta, e dentro ogni fase preferire sessioni brevi e
  mirate a un singolo pezzo (es. "solo il form di inserimento spesa") invece
  di un unico prompt con tutta la fase.
- Dopo ogni sessione: commit, push, verifica che il deploy su Vercel passi,
  prima di iniziare la sessione successiva.
