/**
 * Opzione A: nessun cron esterno. Ogni volta che l'utente apre la dashboard,
 * controlliamo quanto tempo è passato dall'ultima sincronizzazione con Drive.
 * Se è passato più del tempo minimo, la rilanciamo prima di mostrare i dati.
 *
 * Questo file contiene solo l'orchestrazione. La vera lettura del file Drive
 * (performDriveSync) verrà implementata in Fase 5, quando avremo anche il
 * flusso OAuth per ottenere il token di accesso dell'utente.
 */

const SYNC_INTERVAL_MINUTES = 30;

export function isSyncStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;

  const last = new Date(lastSyncedAt).getTime();
  const now = Date.now();
  const minutesSinceLastSync = (now - last) / 1000 / 60;

  return minutesSinceLastSync >= SYNC_INTERVAL_MINUTES;
}

/**
 * Da chiamare lato server (es. in un Server Component o Route Handler)
 * prima di renderizzare la dashboard. Non blocca il caricamento della pagina
 * se fallisce: la sincronizzazione è "best effort", i dati già salvati restano
 * comunque visibili .
 */
export async function syncDriveIfStale(userId: string): Promise<void> {
  // TODO Fase 5:
  // 1. Leggere drive_file_url e drive_last_synced_at dal profilo utente
  // 2. Se isSyncStale(...) === false, uscire subito
  // 3. Altrimenti chiamare performDriveSync(userId) e aggiornare
  //    drive_last_synced_at con il timestamp corrente
  return;
}
