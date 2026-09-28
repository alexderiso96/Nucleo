'use client';

import { useState } from 'react';

interface Props {
  isConnected: boolean;
  hasFolderId: boolean;
  lastSyncedAt: string | null;
}

export default function DriveStatus({ isConnected, hasFolderId, lastSyncedAt }: Props) {
  const [folderUrl, setFolderUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(hasFolderId);
  const [err, setErr] = useState('');

  function extractFolderId(url: string): string | null {
    const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{10,}$/.test(url.trim())) return url.trim();
    return null;
  }

  async function handleSave() {
    const folderId = extractFolderId(folderUrl.trim());
    if (!folderId) { setErr('URL non valido — incolla il link della cartella Drive'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/profile/drive-folder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setErr('Errore nel salvataggio');
  }

  async function handleDisconnect() {
    await fetch('/api/profile/drive-folder', { method: 'DELETE' });
    window.location.reload();
  }

  if (!isConnected) {
    return (
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-300">Sincronizzazione automatica</p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Collega Google Drive per importare le buste paga in automatico
          </p>
        </div>
        <a
          href="/api/auth/google/drive"
          className="btn-primary px-3 py-2 text-xs shrink-0 ml-4"
        >
          Connetti Drive
        </a>
      </div>
    );
  }

  if (!saved) {
    return (
      <div className="card p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-300">Drive connesso — scegli la cartella</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Incolla il link della cartella Google Drive con le tue buste paga PDF
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderUrl}
            onChange={e => setFolderUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="input flex-1 px-3 py-2 text-xs"
          />
          <button
            onClick={handleSave}
            disabled={saving || !folderUrl.trim()}
            className="btn-primary px-3 py-2 text-xs shrink-0"
          >
            {saving ? '...' : 'Salva'}
          </button>
        </div>
        {err && <p className="text-[10px] text-red-400">{err}</p>}
      </div>
    );
  }

  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-300">
          <span className="mr-1.5" style={{ color: 'var(--brand)' }}>●</span>
          Drive sincronizzato
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">
          {lastSyncedAt
            ? `Ultima sync: ${new Date(lastSyncedAt).toLocaleDateString('it-IT')}`
            : 'Prima sincronizzazione in attesa'}
        </p>
      </div>
      <button
        onClick={handleDisconnect}
        className="text-[10px] text-slate-500 hover:text-red-400 transition-colors ml-4"
      >
        Disconnetti
      </button>
    </div>
  );
}
