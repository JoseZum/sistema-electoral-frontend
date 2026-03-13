'use client';

import { useRef, useState, DragEvent } from 'react';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function DropZone({ onFileSelected, disabled }: DropZoneProps) {
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragover(true);
  };

  const handleDragLeave = () => {
    setDragover(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = () => {
    const file = inputRef.current?.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div
      className={`drop-zone ${dragover ? 'dragover' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className="drop-zone-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
        Arrastra el archivo aqui o haz clic para seleccionar
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
        Formato aceptado: .xlsx
      </div>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--muted-light)',
          marginTop: '0.75rem',
        }}
      >
        Columnas esperadas:{' '}
        <span className="mono" style={{ fontSize: '0.6875rem' }}>
          carnet &middot; nombre &middot; correo &middot; sede &middot; carrera &middot; grado
        </span>
      </div>
    </div>
  );
}
