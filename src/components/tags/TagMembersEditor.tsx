'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { TagStudent } from '@/types/tags';

interface StudentsResponse {
  students: TagStudent[];
  total: number;
}

interface TagMembersEditorProps {
  value: TagStudent[];
  onChange: (members: TagStudent[]) => void;
}

export default function TagMembersEditor({ value, onChange }: TagMembersEditorProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<TagStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (search.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        params.set('search', search.trim());
        params.set('limit', '12');

        const response = await apiClient<StudentsResponse>(`/api/users/students?${params.toString()}`);
        const selectedIds = new Set(value.map((student) => student.id));
        if (!cancelled) {
          setResults((response.students || []).filter((student) => !selectedIds.has(student.id)));
        }
      } catch (error) {
        console.error('Error searching students:', error);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search, value]);

  function addMember(student: TagStudent) {
    if (value.some((current) => current.id === student.id)) return;
    onChange([...value, student]);
  }

  function removeMember(studentId: string) {
    onChange(value.filter((student) => student.id !== studentId));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
          Busca personas activas del padrón y agrégalas al grupo.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Resultados</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Personas encontradas</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{results.length}</div>
          </div>
          <div style={{ minHeight: 220, maxHeight: 340, overflowY: 'auto' }}>
            {search.trim().length < 2 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                Escribe al menos 2 caracteres para buscar
              </div>
            ) : searching ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                Buscando...
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                No se encontraron estudiantes
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
                      {student.sede} · {student.career}
                    </div>
                  </div>
                  <button className="btn btn-accent btn-sm" onClick={() => addMember(student)}>
                    Agregar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Seleccionadas</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Personas incluidas en la tag</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{value.length}</div>
          </div>
          <div style={{ minHeight: 220, maxHeight: 340, overflowY: 'auto' }}>
            {value.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                Todavia no has agregado personas
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
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeMember(student.id)} style={{ color: 'var(--error)' }}>
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
