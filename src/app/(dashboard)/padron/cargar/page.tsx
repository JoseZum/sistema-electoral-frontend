'use client';

import { useState } from 'react';
import { ApiError, apiUpload } from '@/lib/api-client';
import DropZone from '@/components/padron/DropZone';
import UploadProgress from '@/components/padron/UploadProgress';
import ImportResult from '@/components/padron/ImportResult';
import ColumnMapper from '@/components/padron/ColumnMapper';
import type {
  ColumnMapping,
  ImportSummary,
  PadronAnalysis,
  PadronImportOptions,
} from '@/types/padron';

/**
 * La importación va en tres pasos: subir, revisar el mapeo y confirmar.
 *
 * El archivo se guarda en memoria y se reenvía en cada llamada: el backend corre
 * en serverless y no puede conservarlo entre peticiones.
 */
export default function CargarPadronPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PadronAnalysis | null>(null);
  /**
   * Cambia con cada analisis recibido y se usa como `key` de ColumnMapper.
   *
   * Ese componente guarda en estado local el mapeo que el admin edita y su
   * confirmacion de bajas. Sin remontarlo, ese estado sobrevive al analisis
   * siguiente: los desplegables seguirian mostrando el mapeo de la hoja
   * anterior mientras la vista previa muestra la nueva, y una confirmacion de
   * desactivacion masiva valdria para un diff que ya cambio.
   */
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildFormData(target: File, options?: PadronImportOptions) {
    const formData = new FormData();
    formData.append('file', target);
    if (options) {
      formData.append('options', JSON.stringify(options));
    }
    return formData;
  }

  const runAnalysis = async (target: File, options?: PadronImportOptions) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiUpload<PadronAnalysis>(
        '/api/users/students/import/analyze',
        buildFormData(target, options)
      );
      setAnalysis(res);
      setAnalysisVersion((version) => version + 1);
    } catch (err) {
      setAnalysis(null);
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (selected: File) => {
    setFile(selected);
    setResult(null);
    await runAnalysis(selected);
  };

  const handleRecalculate = async (options: {
    sheetIndex: number;
    headerRowIndex: number;
    mapping: ColumnMapping;
  }) => {
    if (!file) return;
    // Un mapeo vacío significa «volvé a detectarlo»: no se manda.
    const hasMapping = Object.keys(options.mapping).length > 0;
    await runAnalysis(file, {
      sheetIndex: options.sheetIndex,
      headerRowIndex: options.headerRowIndex,
      ...(hasMapping ? { mapping: options.mapping } : {}),
    });
  };

  const handleConfirm = async (options: {
    sheetIndex: number;
    headerRowIndex: number;
    mapping: ColumnMapping;
    confirmDeactivation: boolean;
  }) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiUpload<ImportSummary>(
        '/api/users/students/import',
        buildFormData(file, options),
        // El 409 de confirmación es parte del flujo, no un fallo que reportar.
        { suppressErrorDetailLog: true }
      );
      setResult(res);
      setAnalysis(null);
    } catch (err) {
      // Si el diff crecio entre el analisis y la confirmacion, el backend
      // vuelve a pedir el visto bueno con las cifras actualizadas. Eso no es un
      // fallo, asi que no se muestra el banner de error: se reabre la
      // advertencia con los numeros nuevos y el admin decide sobre ellos.
      const meta =
        err instanceof ApiError && err.code === 'PADRON_IMPORT_NEEDS_CONFIRMATION'
          ? (err.meta as unknown as (ImportSummary & { activeStudents: number }) | undefined)
          : undefined;

      if (meta) {
        setAnalysis((previous) =>
          previous
            ? {
                ...previous,
                diff: meta,
                activeStudents: meta.activeStudents,
                requiresConfirmation: true,
              }
            : previous
        );
        setAnalysisVersion((version) => version + 1);
        return;
      }

      setError(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setAnalysis(null);
    setResult(null);
    setError(null);
    setBusy(false);
  };

  return (
    <div className="view-enter" style={{ maxWidth: '860px', margin: '0 auto' }}>
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
          Cargar padrón estudiantil
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            fontSize: '0.875rem',
            marginTop: '0.25rem',
          }}
        >
          Suba el archivo Excel. Antes de aplicar nada podrá revisar cómo se leyó
          y qué cambios va a producir.
        </p>
      </div>

      {!analysis && !result && <DropZone onFileSelected={handleFile} disabled={busy} />}

      <UploadProgress isUploading={busy && !analysis} />

      {error && (
        <div
          className="card"
          role="alert"
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
                No se pudo importar
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--ink-soft)', marginTop: '0.25rem' }}>
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {analysis && !result && (
        <ColumnMapper
          key={analysisVersion}
          analysis={analysis}
          onRecalculate={handleRecalculate}
          onConfirm={handleConfirm}
          onCancel={handleReset}
          busy={busy}
        />
      )}

      {result && <ImportResult summary={result} onReset={handleReset} />}

      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--muted-light)',
          marginTop: '2rem',
          textAlign: 'center',
        }}
      >
        El padrón anterior NO se borra, los registros se marcan como inactivos para preservar el historial de votaciones.
      </p>
    </div>
  );
}
