'use client';

import { useState } from 'react';
import EditStudentModal from './EditStudentModal';

interface Student {
  id: string;
  carnet: string;
  full_name: string;
  email: string;
  sede: string;
  career: string;
  degree_level: string;
}

type SortKey = 'carnet' | 'full_name' | 'email' | 'sede' | 'career' | 'degree_level';
type SortDir = 'asc' | 'desc';

interface StudentTableProps {
  students: Student[];
  onSaveStudent: (id: string, data: Partial<Student>) => Promise<void>;
}

export default function StudentTable({ students, onSaveStudent }: StudentTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('carnet');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...(students || [])].sort((a, b) => {
    const valA = (a[sortKey] ?? '').toLowerCase();
    const valB = (b[sortKey] ?? '').toLowerCase();
    const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const columns: { key: SortKey; label: string }[] = [
    { key: 'carnet', label: 'Carnet' },
    { key: 'full_name', label: 'Nombre' },
    { key: 'email', label: 'Correo' },
    { key: 'sede', label: 'Sede' },
    { key: 'career', label: 'Carrera' },
    { key: 'degree_level', label: 'Grado' },
  ];

  const handleSave = async (id: string, data: Partial<Student>) => {
    await onSaveStudent(id, data);
    setEditingId(null);
  };

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={sortKey === col.key ? 'sorted' : ''}
                onClick={() => handleSort(col.key)}
              >
                {col.label}{' '}
                <span className="sort-icon">
                  {sortKey === col.key ? (sortDir === 'asc' ? '\u2193' : '\u2191') : '\u2195'}
                </span>
              </th>
            ))}
            <th style={{ width: '60px' }}></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((student, index) => (
            <tr
              key={student.id}
              className="table-row-enter"
              style={{ animationDelay: `${index * 0.02}s` }}
            >
              {editingId === student.id ? (
                <EditStudentModal
                  student={student}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <td>{student.carnet}</td>
                  <td>{student.full_name}</td>
                  <td>{student.email}</td>
                  <td>{student.sede}</td>
                  <td>{student.career}</td>
                  <td>{student.degree_level}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0.25rem 0.5rem' }}
                      onClick={() => setEditingId(student.id)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                No se encontraron estudiantes
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
