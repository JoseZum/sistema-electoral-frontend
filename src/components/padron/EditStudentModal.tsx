'use client';

import { useState } from 'react';

interface Student {
  id: string;
  carnet: string;
  full_name: string;
  email: string;
  sede: string;
  career: string;
  degree_level: string;
}

interface EditStudentModalProps {
  student: Student;
  onSave: (id: string, data: Partial<Student>) => Promise<void>;
  onCancel: () => void;
}

export default function EditStudentModal({
  student,
  onSave,
  onCancel,
}: EditStudentModalProps) {
  const [form, setForm] = useState({
    full_name: student.full_name,
    sede: student.sede,
    career: student.career,
    degree_level: student.degree_level,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(student.id, form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <td style={{ padding: '0.5rem' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {student.carnet}
        </span>
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          className="input"
          style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
          {student.email}
        </span>
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          className="input"
          style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
          value={form.sede}
          onChange={(e) => setForm((f) => ({ ...f, sede: e.target.value }))}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          className="input"
          style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
          value={form.career}
          onChange={(e) => setForm((f) => ({ ...f, career: e.target.value }))}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <input
          className="input"
          style={{ width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
          value={form.degree_level}
          onChange={(e) => setForm((f) => ({ ...f, degree_level: e.target.value }))}
        />
      </td>
      <td style={{ padding: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            className="btn btn-accent btn-sm"
            onClick={handleSubmit}
            disabled={saving}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            {saving ? '...' : 'OK'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={onCancel}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            X
          </button>
        </div>
      </td>
    </>
  );
}
