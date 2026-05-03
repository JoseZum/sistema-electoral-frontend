'use client';

import { KeyboardEvent, useEffect, useState } from 'react';
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
  copy?: Partial<TagMembersEditorCopy>;
}

const RESULT_LIMIT = 50;
const BULK_LIMIT = 10000;

type TagMembersEditorCopy = {
  searchLabel: string;
  searchPlaceholder: string;
  helperText: string;
  resultsTitle: string;
  resultsSubtitle: string;
  selectedTitle: string;
  selectedSubtitle: string;
  searchPrompt: string;
  noResults: string;
  allResultsSelected: string;
  selectedEmpty: string;
  addAllTitle: string;
};

const DEFAULT_COPY: TagMembersEditorCopy = {
  searchLabel: 'Buscar personas del padrón',
  searchPlaceholder: 'Nombre o carnet...',
  helperText: 'Busca por nombre o carnet, o filtra por sede y carrera. Presiona Enter o el botón Buscar.',
  resultsTitle: 'Resultados',
  resultsSubtitle: 'Personas encontradas',
  selectedTitle: 'Seleccionadas',
  selectedSubtitle: 'Personas incluidas en la tag',
  searchPrompt: 'Aplica filtros y presiona Buscar para ver personas del padrón',
  noResults: 'No se encontraron estudiantes con esos filtros',
  allResultsSelected: 'Todos los resultados ya están agregados',
  selectedEmpty: 'Todavía no has agregado personas a la tag',
  addAllTitle: 'Agrega todas las personas que cumplen con los filtros actuales',
};

export default function TagMembersEditor({ value, onChange, copy }: TagMembersEditorProps) {
  const text = { ...DEFAULT_COPY, ...copy };
  const [search, setSearch] = useState('');
  const [sede, setSede] = useState('');
  const [career, setCareer] = useState('');
  const [results, setResults] = useState<TagStudent[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searching, setSearching] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalog, setCatalog] = useState<StudentCatalogResponse>({ sedes: [], careers: [] });

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

  function buildParams(limit: number) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    const trimmed = search.trim();
    if (trimmed.length > 0) params.set('search', trimmed);
    if (sede) params.set('sede', sede);
    if (career) params.set('career', career);
    return params;
  }

  async function performSearch() {
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const params = buildParams(RESULT_LIMIT);
      const response = await apiClient<StudentsResponse>(`/api/users/students?${params.toString()}`);
      const selectedIds = new Set(value.map((student) => student.id));
      const filteredResults = (response.students || []).filter((student) => !selectedIds.has(student.id));
      setResults(filteredResults);
      setTotalResults(response.total || 0);
    } catch (error) {
      console.error('Error searching students:', error);
      setResults([]);
      setTotalResults(0);
      setSearchError(error instanceof Error ? error.message : 'No se pudieron cargar estudiantes');
    } finally {
      setSearching(false);
    }
  }

  async function addAllMatching() {
    setBulkAdding(true);
    setSearchError(null);

    try {
      const params = buildParams(BULK_LIMIT);
      const response = await apiClient<StudentsResponse>(`/api/users/students?${params.toString()}`);
      const selectedIds = new Set(value.map((student) => student.id));
      const newMembers = (response.students || []).filter((student) => !selectedIds.has(student.id));
      if (newMembers.length === 0) return;
      onChange([...value, ...newMembers]);
      setResults([]);
      setTotalResults(response.total || 0);
    } catch (error) {
      console.error('Error adding all matching students:', error);
      setSearchError(error instanceof Error ? error.message : 'No se pudieron agregar los estudiantes');
    } finally {
      setBulkAdding(false);
    }
  }

  function addMember(student: TagStudent) {
    if (value.some((current) => current.id === student.id)) return;
    onChange([...value, student]);
    setResults((prev) => prev.filter((current) => current.id !== student.id));
  }

  function removeMember(studentId: string) {
    onChange(value.filter((student) => student.id !== studentId));
  }

  function clearFilters() {
    setSede('');
    setCareer('');
    setSearch('');
    setResults([]);
    setTotalResults(0);
    setHasSearched(false);
    setSearchError(null);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      performSearch();
    }
  }

  const hasActiveFilters = Boolean(sede || career || search.trim());
  const filterDescriptionParts: string[] = [];
  if (sede) filterDescriptionParts.push(sede);
  if (career) filterDescriptionParts.push(career);
  if (search.trim()) filterDescriptionParts.push(`"${search.trim()}"`);
  const filterDescription = filterDescriptionParts.join(' - ');

  const visibleResults = results.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div className="input-group">
          <label>{text.searchLabel}</label>
          <input
            type="text"
            className="input"
            placeholder={text.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
            {text.helperText}
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
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={performSearch}
            disabled={searching || bulkAdding}
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={clearFilters}
            disabled={!hasActiveFilters && !hasSearched}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{text.resultsTitle}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {hasSearched
                    ? totalResults === 0
                      ? 'Ninguna coincidencia'
                      : `Mostrando ${visibleResults} de ${totalResults} coincidencia${totalResults === 1 ? '' : 's'}`
                    : text.resultsSubtitle}
                </div>
                {filterDescription && hasSearched && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted-light)', marginTop: '0.2rem' }}>
                    Filtros: {filterDescription}
                  </div>
                )}
              </div>
              {hasSearched && totalResults > 0 && (
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={addAllMatching}
                  disabled={bulkAdding || searching}
                  title={text.addAllTitle}
                >
                  {bulkAdding ? 'Agregando...' : `Agregar todos (${totalResults})`}
                </button>
              )}
            </div>
          </div>

          <div style={{ minHeight: 220, maxHeight: 340, overflowY: 'auto' }}>
            {searchError ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--error)', fontSize: '0.875rem' }}>
                {searchError}
              </div>
            ) : !hasSearched ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                {text.searchPrompt}
              </div>
            ) : searching ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                Buscando...
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                {totalResults === 0
                  ? text.noResults
                  : text.allResultsSelected}
              </div>
            ) : (
              <>
                {results.map((student) => (
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
                ))}
                {totalResults > visibleResults && (
                  <div
                    style={{
                      padding: '0.875rem 1.25rem',
                      fontSize: '0.75rem',
                      color: 'var(--muted)',
                      textAlign: 'center',
                    }}
                  >
                    Hay {totalResults - visibleResults} más. Refina los filtros o usa &quot;Agregar todos&quot;.
                  </div>
                )}
              </>
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
              <div style={{ fontWeight: 600 }}>{text.selectedTitle}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{text.selectedSubtitle}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{value.length}</div>
              {value.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onChange([])}
                  style={{ color: 'var(--error)' }}
                >
                  Quitar todas
                </button>
              )}
            </div>
          </div>

          <div style={{ minHeight: 220, maxHeight: 340, overflowY: 'auto' }}>
            {value.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                {text.selectedEmpty}
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
