'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { TagStudent } from '@/types/tags';

interface StudentsResponse {
  students: TagStudent[];
  total: number;
}

interface StudentCatalogResponse {
  sedes: string[];
  careers: string[];
}

interface TagMembersEditorProps {
  value: TagStudent[];
  onChange: (members: TagStudent[]) => void;
}

const RESULT_LIMIT = 18;
const SEARCH_MIN_LENGTH = 2;

export default function TagMembersEditor({ value, onChange }: TagMembersEditorProps) {
  const [search, setSearch] = useState('');
  const [sede, setSede] = useState('');
  const [career, setCareer] = useState('');
  const [results, setResults] = useState<TagStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalog, setCatalog] = useState<StudentCatalogResponse>({ sedes: [], careers: [] });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCatalog() {
      try {
        const response = await apiClient<StudentCatalogResponse>('/api/users/students/catalog');
        if (!cancelled) {
          setCatalog({
            sedes: response.sedes || [],
            careers: response.careers || [],
          });
        }
      } catch (error) {
        console.error('Error loading student catalog for tags:', error);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    fetchCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmedSearch = search.trim();
    const hasSearch = trimmedSearch.length >= SEARCH_MIN_LENGTH;
    const hasFilters = Boolean(sede || career);

    if (!hasSearch && !hasFilters) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams();
        params.set('limit', String(RESULT_LIMIT));
        if (hasSearch) params.set('search', trimmedSearch);
        if (sede) params.set('sede', sede);
        if (career) params.set('career', career);

        const response = await apiClient<StudentsResponse>(`/api/users/students?${params.toString()}`);
        const selectedIds = new Set(value.map((student) => student.id));

        if (!cancelled) {
          setResults((response.students || []).filter((student) => !selectedIds.has(student.id)));
        }
      } catch (error) {
        console.error('Error searching students:', error);
        if (!cancelled) {
          setResults([]);
          setSearchError(error instanceof Error ? error.message : 'No se pudieron cargar estudiantes');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [career, search, sede, value]);

  function addMember(student: TagStudent) {
    if (value.some((current) => current.id === student.id)) return;
    onChange([...value, student]);
  }

  function removeMember(studentId: string) {
    onChange(value.filter((student) => student.id !== studentId));
  }

  function clearFilters() {
    setSede('');
    setCareer('');
  }

  const trimmedSearch = search.trim();
  const hasSearchCriteria = trimmedSearch.length >= SEARCH_MIN_LENGTH;
  const hasActiveFilters = Boolean(sede || career);
  const canSearch = hasSearchCriteria || hasActiveFilters;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div className="input-group">
          <label>Buscar personas del padron</label>
          <input
            type="text"
            className="input"
            placeholder="Nombre o carnet..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
            Busca por nombre o carnet. Tambien puedes filtrar por sede y carrera como en la creacion de votaciones.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
          <div className="input-group">
            <label>Sede</label>
            <select
              className="input"
              value={sede}
              onChange={(event) => setSede(event.target.value)}
              disabled={catalogLoading}
            >
              <option value="">Todas las sedes</option>
              {catalog.sedes.map((catalogSede) => (
                <option key={catalogSede} value={catalogSede}>
                  {catalogSede}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Carrera</label>
            <select
              className="input"
              value={career}
              onChange={(event) => setCareer(event.target.value)}
              disabled={catalogLoading}
            >
              <option value="">Todas las carreras</option>
              {catalog.careers.map((catalogCareer) => (
                <option key={catalogCareer} value={catalogCareer}>
                  {catalogCareer}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              style={{ width: '100%' }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Resultados</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Personas encontradas</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{results.length}</div>
          </div>

          <div style={{ minHeight: 220, maxHeight: 340, overflowY: 'auto' }}>
            {!canSearch ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                Escribe al menos 2 caracteres o aplica filtros para buscar
              </div>
            ) : searchError ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--error)', fontSize: '0.875rem' }}>
                {searchError}
              </div>
            ) : searching ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                Buscando...
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                No se encontraron estudiantes con esos filtros
              </div>
            ) : (
              results.map((student) => (
                <div
                  key={student.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.875rem 1.25rem',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{student.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{student.carnet}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                      {student.sede} - {student.career}
                    </div>
                  </div>
                  <button type="button" className="btn btn-accent btn-sm" onClick={() => addMember(student)}>
                    Agregar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Seleccionadas</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Personas incluidas en la tag</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{value.length}</div>
          </div>

          <div style={{ minHeight: 220, maxHeight: 340, overflowY: 'auto' }}>
            {value.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                Todavia no has agregado personas a la tag
              </div>
            ) : (
              value.map((student) => (
                <div
                  key={student.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.875rem 1.25rem',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{student.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{student.carnet}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                      {student.sede} - {student.career}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeMember(student.id)}
                    style={{ color: 'var(--error)' }}
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
