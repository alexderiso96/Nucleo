'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  imported: number;
  files: number;
}

export default function DriveSyncBanner({ imported, files }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs anim-slide-up"
      style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}
    >
      <RefreshCw size={13} className="shrink-0" />
      <span>
        Drive sincronizzato — {imported} nuov{imported === 1 ? 'a voce importata' : 'e voci importate'} da {files} file{files !== 1 ? '' : ''}
      </span>
      <button
        onClick={() => setVisible(false)}
        className="ml-auto text-emerald-600 hover:text-emerald-400 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
