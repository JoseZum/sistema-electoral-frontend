'use client';

import { useEffect, useState } from 'react';

interface UploadProgressProps {
  isUploading: boolean;
}

const stages = [
  { label: 'Procesando archivo...', threshold: 40 },
  { label: 'Validando registros...', threshold: 70 },
  { label: 'Calculando diferencias...', threshold: 90 },
  { label: 'Generando resumen...', threshold: 100 },
];

export default function UploadProgress({ isUploading }: UploadProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isUploading) {
      setProgress(0);
      return;
    }

    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 8 + 2;
      if (current >= 95) {
        current = 95;
        clearInterval(interval);
      }
      setProgress(Math.min(current, 95));
    }, 200);

    return () => clearInterval(interval);
  }, [isUploading]);

  // Determine current stage label
  const stageLabel =
    stages.find((s) => progress < s.threshold)?.label ?? stages[stages.length - 1].label;

  if (!isUploading && progress === 0) return null;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div className="card" style={{ padding: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--success)"
              strokeWidth="2"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{stageLabel}</span>
          </div>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--accent)',
            }}
          >
            {Math.round(progress)}%
          </span>
        </div>
        <div className="progress-bar" style={{ height: '6px' }}>
          <div
            className="progress-bar-fill accent"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function completeProgress(setProgress: (v: number) => void) {
  setProgress(100);
}
