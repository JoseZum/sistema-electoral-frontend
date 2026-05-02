'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import StudentFilters from '@/components/padron/StudentFilters';
import StudentTable from '@/components/padron/StudentTable';
import Pagination from '@/components/padron/Pagination';
import Loader from '@/components/Loader';

interface Student {
  id: string;
  carnet: string;
  full_name: string;
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

  const handleExport = () => {
    const headers = ['Carnet', 'Nombre', 'Sede', 'Carrera', 'Grado'];
    const rows = students.map((student) => [
      student.carnet,
      student.full_name,
      student.sede,
      student.career,
      student.degree_level,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `padron_estudiantil_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
          <button className="btn btn-accent btn-sm" onClick={handleExport}>
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
            Exportar
          </button>
        </div>
      </div>

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

      {loading ? (
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
