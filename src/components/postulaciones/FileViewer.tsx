'use client';

import { useEffect, useState } from 'react';
import Loader from '@/components/Loader';
import { formatFileSize } from '@/lib/postulaciones-fields';
import type { ApplicationFileMeta } from '@/types/postulaciones';

interface FileViewerProps {
  file: ApplicationFileMeta | null;
  /** Descarga el binario con la sesión y devuelve un object URL. */
  loadUrl: (fileId: string) => Promise<string>;
  onClose: () => void;
}

/**
 * Visor de adjuntos: "una vista en la misma pestaña o que se abra una nueva
 * pestaña en el navegador" (especificación del cliente). Se ofrecen ambas.
 *
 * El endpoint exige cabecera `Authorization`, que un `<iframe src>` no envía,
 * así que el archivo se baja con fetch y se muestra desde un blob local.
 */
export default function FileViewer({ file, loadUrl, onClose }: FileViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let created: string | null = null;

    setObjectUrl(null);
    setError(null);

    loadUrl(file.id)
      .then((url) => {
        // Si el modal se cerró mientras descargaba, se libera de una vez para
        // no dejar el blob colgado en memoria.
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        setObjectUrl(url);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo');
        }
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [file, loadUrl]);

  useEffect(() => {
    if (!file) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;

  const isPdf = file.mime_type === 'application/pdf';

  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${file.file_name}`}
    >
      <div
        className="modal postulacion-viewer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="postulacion-viewer-head">
          <div style={{ minWidth: 0 }}>
            <div className="postulacion-viewer-title" title={file.file_name}>
              {file.file_name}
            </div>
            <div className="postulacion-viewer-meta">
              {isPdf ? 'PDF' : 'Imagen'} · {formatFileSize(file.size_bytes)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {objectUrl && (
              <a
                className="btn btn-outline btn-sm"
                href={objectUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en pestaña nueva
              </a>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <div className="postulacion-viewer-body">
          {error && <div className="postulacion-field-error">{error}</div>}
          {!error && !objectUrl && <Loader />}
          {objectUrl && isPdf && (
            <iframe src={objectUrl} title={file.file_name} className="postulacion-viewer-frame" />
          )}
          {objectUrl && !isPdf && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={objectUrl} alt={file.file_name} className="postulacion-viewer-image" />
          )}
        </div>
      </div>
    </div>
  );
}
