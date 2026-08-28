'use client';

import { DragEvent, KeyboardEvent, useRef, useState } from 'react';
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_BYTES,
  formatFileSize,
} from '@/lib/postulaciones-fields';
import type { ApplicationFileMeta } from '@/types/postulaciones';

interface FileFieldProps {
  label: string;
  hint: string;
  /** Archivos ya subidos para este campo. */
  files: ApplicationFileMeta[];
  /** false cuando el campo está bloqueado (postulación en revisión o resuelta). */
  editable: boolean;
  multiple?: boolean;
  required?: boolean;
  uploading?: boolean;
  error?: string | null;
  onUpload: (file: File) => void;
  onRemove: (fileId: string) => void;
  onView: (file: ApplicationFileMeta) => void;
}

const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 1 1 8 0v3" />
  </svg>
);

const FileIcon = ({ mime }: { mime: string }) =>
  mime === 'application/pdf' ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );

export default function FileField({
  label,
  hint,
  files,
  editable,
  multiple = false,
  required = true,
  uploading = false,
  error,
  onUpload,
  onRemove,
  onView,
}: FileFieldProps) {
  const [dragover, setDragover] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAddMore = editable && (multiple || files.length === 0);

  // Se valida el tamaño antes de subir para no gastar una petición que el
  // servidor va a rechazar igual.
  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setLocalError(`"${file.name}" pesa ${formatFileSize(file.size)}; el máximo es 4 MB`);
      return;
    }
    setLocalError(null);
    onUpload(file);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragover(false);
    if (!canAddMore || uploading) return;
    handleFile(event.dataTransfer.files[0]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canAddMore || uploading) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const shownError = error || localError;

  return (
    <div className="postulacion-file-field">
      <div className="postulacion-file-head">
        <span className="postulacion-file-label">
          {label}
          {required && <span aria-hidden="true" style={{ color: 'var(--accent)' }}> *</span>}
        </span>
        {!editable && (
          <span className="postulacion-locked-chip">
            <LockIcon />
            Bloqueado
          </span>
        )}
      </div>

      {files.map((file) => (
        <div key={file.id} className="postulacion-file-chip">
          <span className="postulacion-file-chip-icon">
            <FileIcon mime={file.mime_type} />
          </span>
          <span className="postulacion-file-chip-name" title={file.file_name}>
            {file.file_name}
          </span>
          <span className="postulacion-file-chip-size">{formatFileSize(file.size_bytes)}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onView(file)}>
            Ver
          </button>
          {editable && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onRemove(file.id)}
              disabled={uploading}
            >
              Eliminar
            </button>
          )}
        </div>
      ))}

      {canAddMore && (
        <div
          className={`postulacion-drop ${dragover ? 'dragover' : ''}`}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragover(true);
          }}
          onDragLeave={() => setDragover(false)}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label={`Subir ${label}`}
          aria-disabled={uploading}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            style={{ display: 'none' }}
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          {uploading ? (
            <span className="postulacion-drop-text">Subiendo…</span>
          ) : (
            <>
              <span className="postulacion-drop-text">
                {files.length > 0 ? 'Añadir otro archivo' : 'Arrastra el archivo o haz clic'}
              </span>
              <span className="postulacion-drop-hint">{hint} · máx. 4 MB</span>
            </>
          )}
        </div>
      )}

      {!editable && files.length === 0 && (
        <div className="postulacion-file-empty">Sin archivo adjunto</div>
      )}

      {shownError && <div className="postulacion-field-error">{shownError}</div>}
    </div>
  );
}
