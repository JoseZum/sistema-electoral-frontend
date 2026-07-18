'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import StudentFilters from '@/components/padron/StudentFilters';
import StudentTable from '@/components/padron/StudentTable';
import Pagination from '@/components/padron/Pagination';
import Loader from '@/components/Loader';
import { buildPadronXlsxBlob } from '@/lib/padron-xlsx';

interface Student {
  id: string;
  carnet: string;
  full_name: string;
  email: string;
  sede: string;
  career: string;
  degree_level: string;
}

interface StudentsResponse {
  students: Student[];
  total: number;
}

interface StudentCatalogResponse {
  sedes: string[];
  careers: string[];
}

const PAGE_SIZE = 25;
// Límite alto para descargar el padrón completo (filtrado) en una sola consulta.
const EXPORT_MAX = 100000;

type ExportFormat = 'csv' | 'xlsx' | 'both';

// Encabezados alineados con la plantilla que espera el import del padrón
// (backend: getValueFromRow / makePadronWorkbook), para permitir el round-trip
// exportar → editar → reimportar en el XLSX.
const EXPORT_HEADERS = [
  'Carnet',
  'Nombre completo',
  'Correo',
  'Sede',
  'Carrera',
  'Grado',
] as const;

// Escapa un valor para CSV siguiendo la misma convención del módulo de auditoría:
// envuelve en comillas cuando hay separadores/saltos o un prefijo peligroso
// (mitigación de CSV-injection) y duplica las comillas internas.
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const needsQuote = /[",\n\r;]/.test(str) || /^[=+\-@]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function buildPadronCsv(students: Student[]): string {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const student of students) {
    lines.push(
      [
        student.carnet,
        student.full_name,
        student.email,
        student.sede,
        student.career,
        student.degree_level,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\r\n');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PadronPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [catalog, setCatalog] = useState<StudentCatalogResponse>({
    sedes: [],
    careers: [],
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sede, setSede] = useState('');
  const [career, setCareer] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await apiClient<StudentCatalogResponse>('/api/users/students/catalog');
      setCatalog({
        sedes: res?.sedes || [],
        careers: res?.careers || [],
      });
    } catch (err) {
      console.error('Error fetching student catalog:', err);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sede) params.set('sede', sede);
      if (career) params.set('career', career);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const res = await apiClient<StudentsResponse>(
        `/api/users/students?${params.toString()}`
      );
      setStudents(res?.students || []);
      setTotal(res?.total || 0);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  }, [search, sede, career, page]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSedeChange = (value: string) => {
    setSede(value);
    setPage(1);
  };

  const handleCareerChange = (value: string) => {
    setCareer(value);
    setPage(1);
  };

  const handleSaveStudent = async (id: string, data: Partial<Student>) => {
    await apiClient(`/api/users/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    await Promise.all([fetchStudents(), fetchCatalog()]);
  };

  // Descarga el padr\u00F3n COMPLETO que coincide con los filtros actuales, no solo
  // la p\u00E1gina visible. El backend pagina, as\u00ED que pedimos un l\u00EDmite alto.
  const fetchAllStudentsForExport = useCallback(async (): Promise<Student[]> => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (sede) params.set('sede', sede);
    if (career) params.set('career', career);
    params.set('page', '1');
    params.set('limit', String(EXPORT_MAX));

    const res = await apiClient<StudentsResponse>(
      `/api/users/students?${params.toString()}`
    );
    return res?.students ?? [];
  }, [search, sede, career]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const allStudents = await fetchAllStudentsForExport();
      const stamp = new Date().toISOString().slice(0, 10);
      const baseName = `padron_estudiantil_${stamp}`;

      if (exportFormat === 'csv' || exportFormat === 'both') {
        const csv = buildPadronCsv(allStudents);
        // BOM para que Excel detecte UTF-8.
        const blob = new Blob(['\uFEFF' + csv], {
          type: 'text/csv;charset=utf-8;',
        });
        triggerDownload(blob, `${baseName}.csv`);
      }

      if (exportFormat === 'xlsx' || exportFormat === 'both') {
        const blob = await buildPadronXlsxBlob(allStudents, {
          search,
          sede,
          career,
          generatedAt: new Date(),
        });
        triggerDownload(blob, `${baseName}.xlsx`);
      }
    } catch (err) {
      console.error('Error exporting padron:', err);
      setExportError(
        err instanceof Error ? err.message : 'No se pudo exportar el padr\u00F3n'
      );
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="view-enter">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 500,
              margin: 0,
            }}
          >
            Padrón Estudiantil
          </h2>
          <p
            style={{
              color: 'var(--muted)',
              fontSize: '0.875rem',
              marginTop: '0.25rem',
            }}
          >
            {total.toLocaleString()} estudiantes activos
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link href="/padron/cargar" className="btn btn-outline btn-sm">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Importar Excel
          </Link>
          <select
            className="input input-sm"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            disabled={exporting}
            aria-label="Formato de exportación"
            title="Formato de exportación"
          >
            <option value="csv">CSV (.csv)</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="both">Ambos (CSV + Excel)</option>
          </select>
          <button
            className="btn btn-accent btn-sm"
            onClick={handleExport}
            disabled={exporting}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {exporting ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          style={{
            marginBottom: '1rem',
            padding: '0.625rem 0.875rem',
            borderRadius: '0.5rem',
            background: 'var(--danger-soft, #fdecec)',
            color: 'var(--danger, #b42318)',
            fontSize: '0.8125rem',
          }}
        >
          {exportError}
        </div>
      )}

      <StudentFilters
        search={search}
        sede={sede}
        career={career}
        onSearchChange={handleSearchChange}
        onSedeChange={handleSedeChange}
        onCareerChange={handleCareerChange}
        sedes={catalog.sedes}
        careers={catalog.careers}
      />

      {loading && students.length === 0 ? (
        <Loader />
      ) : (
        <StudentTable
          students={students}
          onSaveStudent={handleSaveStudent}
          sedes={catalog.sedes}
          careers={catalog.careers}
        />
      )}

      {totalPages > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
