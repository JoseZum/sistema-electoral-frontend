'use client';

import { useState } from 'react';
import { apiUpload } from '@/lib/api-client';
import DropZone from '@/components/padron/DropZone';
import UploadProgress from '@/components/padron/UploadProgress';
import ImportResult from '@/components/padron/ImportResult';

interface ImportResponse {
  total: number;
  new: number;
  updated: number;
  reactivated: number;
  deactivated: number;
}

export default function CargarPadronPage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiUpload<ImportResponse>(
        '/api/users/students/import',
        formData
      );

      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setUploading(false);
  };

  return (
    <div className="view-enter" style={{ maxWidth: '780px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div className="swiss-bar" />
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 500,
            margin: 0,
          }}
        >
          Cargar padron estudiantil
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            fontSize: '0.875rem',
            marginTop: '0.25rem',
          }}
        >
          Importa el archivo Excel del DAR para actualizar el padron. El sistema
          hace merge inteligente.
        </p>
      </div>

      {/* Drop Zone */}
      {!result && <DropZone onFileSelected={handleFile} disabled={uploading} />}

      {/* Upload Progress */}
      <UploadProgress isUploading={uploading} />

      {/* Error */}
      {error && (
        <div
          className="card"
          style={{
            marginTop: '1rem',
            borderColor: 'var(--error)',
            background: 'var(--error-light)',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--error)"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--error)' }}>
                Error al importar
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--ink-soft)', marginTop: '0.25rem' }}>
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && <ImportResult summary={result} onReset={handleReset} />}

      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--muted-light)',
          marginTop: '2rem',
          textAlign: 'center',
        }}
      >
        El padron anterior no se borra — los registros se marcan como inactivos
        para preservar el historial de votaciones.
      </p>
    </div>
  );
}
