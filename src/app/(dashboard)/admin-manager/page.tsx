'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface AdminWithStudent {
  id: string;
  students_id: string;
  position_title: string;
  role: string;
  carnet: string;
  full_name: string;
  email: string;
  sede: string;
  career: string;
}

interface Student {
  id: string;
  carnet: string;
  full_name: string;
  email: string;
  sede: string;
  career: string;
}

interface StudentsResponse {
  students: Student[];
  total: number;
}

export default function AdminManagerPage() {
  const [admins, setAdmins] = useState<AdminWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / search state
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const data = await apiClient<AdminWithStudent[]>('/api/users/admins');
      setAdmins(data);
    } catch (err) {
      console.error('Error fetching admins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Focus input when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [modalOpen]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient<StudentsResponse>(
          `/api/users/students?search=${encodeURIComponent(value)}&limit=10`
        );
        const adminStudentIds = new Set(admins.map((a) => a.students_id));
        setSearchResults(
          (res.students || []).filter((s) => !adminStudentIds.has(s.id))
        );
      } catch (err) {
        console.error('Error searching students:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleAddAdmin = async (student: Student) => {
    setAdding(student.id);
    try {
      await apiClient('/api/users/admins', {
        method: 'POST',
        body: JSON.stringify({
          students_id: student.id,
          position_title: 'Miembro TEE',
          role: 'admin',
        }),
      });
      await fetchAdmins();
      setSearchQuery('');
      setSearchResults([]);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error adding admin:', err);
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    setRemoving(adminId);
    try {
      await apiClient(`/api/users/admins/${adminId}`, { method: 'DELETE' });
      await fetchAdmins();
    } catch (err) {
      console.error('Error removing admin:', err);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="view-enter" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="swiss-bar" />
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 500,
              margin: 0,
            }}
          >
            Admin Manager
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {admins.length} administrador{admins.length !== 1 ? 'es' : ''} activo
            {admins.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="btn btn-accent btn-sm"
          onClick={() => setModalOpen(true)}
          style={{ gap: '0.5rem' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Agregar administrador
        </button>
      </div>

      {/* Admin list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          Cargando...
        </div>
      ) : admins.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--surface-sunken)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No hay administradores</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Agrega estudiantes del padron como administradores del sistema
          </p>
          <button className="btn btn-accent btn-sm" onClick={() => setModalOpen(true)}>
            Agregar primer administrador
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Carnet</th>
                <th>Correo</th>
                <th>Sede</th>
                <th>Cargo</th>
                <th style={{ width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin, i) => (
                <tr
                  key={admin.id}
                  className="table-row-enter"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'var(--accent-light)',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.6875rem',
                          flexShrink: 0,
                        }}
                      >
                        {admin.full_name
                          .split(' ')
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{admin.full_name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{admin.carnet}</td>
                  <td>{admin.email}</td>
                  <td>{admin.sede}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: 'var(--accent-light)',
                        color: 'var(--accent)',
                      }}
                    >
                      {admin.position_title}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0.25rem 0.5rem', color: 'var(--error)' }}
                      onClick={() => handleRemoveAdmin(admin.id)}
                      disabled={removing === admin.id}
                      title="Revocar acceso"
                    >
                      {removing === admin.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal overlay ── */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'viewFadeIn 0.2s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeInUp 0.3s var(--ease-out)',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>Agregar administrador</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.125rem' }}>
                  Busca un estudiante del padron para darle permisos
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setModalOpen(false)}
                style={{ padding: '0.25rem' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Search input */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="2"
                  style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  className="input"
                  placeholder="Nombre, carnet o correo..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '2.5rem' }}
                />
                {searching && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      animation: 'spin 1s linear infinite',
                    }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
              </div>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: '200px', maxHeight: '400px' }}>
              {searchQuery.trim().length < 2 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem 1rem',
                    color: 'var(--muted)',
                  }}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--border-strong)"
                    strokeWidth="1.5"
                    style={{ marginBottom: '0.75rem' }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <p style={{ fontSize: '0.875rem' }}>Escribe al menos 2 caracteres para buscar</p>
                </div>
              ) : searchResults.length === 0 && !searching ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem 1rem',
                    color: 'var(--muted)',
                  }}
                >
                  <p style={{ fontSize: '0.875rem' }}>No se encontraron estudiantes</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-light)' }}>
                    Verifica el nombre o sube el padron primero
                  </p>
                </div>
              ) : (
                searchResults.map((student) => (
                  <div
                    key={student.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1.5rem',
                      borderBottom: '1px solid var(--border)',
                      gap: '0.75rem',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-glow)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: 'var(--surface-sunken)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.6875rem',
                          color: 'var(--ink-soft)',
                          flexShrink: 0,
                        }}
                      >
                        {student.full_name
                          .split(' ')
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {student.full_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {student.carnet} &middot; {student.email} &middot; {student.sede}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-accent btn-sm"
                      onClick={() => handleAddAdmin(student)}
                      disabled={adding === student.id}
                      style={{ flexShrink: 0 }}
                    >
                      {adding === student.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Agregar
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
