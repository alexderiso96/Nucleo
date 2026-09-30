'use client';

import { useState, useEffect } from 'react';

interface Props { month: string }

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export default function AiObservation({ month }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lsKey = `obs:${month}:${todayKey()}`;
    const cached = localStorage.getItem(lsKey);
    if (cached) {
      setText(cached);
      setLoading(false);
      return;
    }
    fetch(`/api/observation?month=${month}`)
      .then(r => r.json())
      .then((d: { text: string | null }) => {
        if (d.text) {
          localStorage.setItem(lsKey, d.text);
          setText(d.text);
        } else {
          setText(null);
        }
      })
      .catch(() => setText(null))
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) {
    return (
      <div
        style={{
          height: '20px',
          borderRadius: '8px',
          background: 'var(--surface-2)',
          animation: 'pulse 1.5s infinite',
          width: '100%',
        }}
      />
    );
  }

  if (!text) return null;

  return (
    <p className="text-sm flex items-start gap-2" style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>
      <span className="shrink-0 mt-0.5">✨</span>
      <span>{text}</span>
    </p>
  );
}
