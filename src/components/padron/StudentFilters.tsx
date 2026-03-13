'use client';

import { useEffect, useRef } from 'react';

interface StudentFiltersProps {
  search: string;
  sede: string;
  career: string;
  onSearchChange: (value: string) => void;
  onSedeChange: (value: string) => void;
  onCareerChange: (value: string) => void;
  sedes: string[];
  careers: string[];
}

export default function StudentFilters({
  search,
  sede,
  career,
  onSearchChange,
  onSedeChange,
  onCareerChange,
  sedes,
  careers,
}: StudentFiltersProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSearchInput = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  return (
    <div className="padron-toolbar">
      <div className="padron-toolbar-left">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Buscar por carnet, nombre o correo..."
          defaultValue={search}
          onChange={(e) => handleSearchInput(e.target.value)}
        />
      </div>
      <div className="padron-toolbar-right">
        <select
          className="input"
          style={{ width: 'auto', paddingRight: '2rem' }}
          value={sede}
          onChange={(e) => onSedeChange(e.target.value)}
        >
          <option value="">Todas las sedes</option>
          {sedes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: 'auto', paddingRight: '2rem' }}
          value={career}
          onChange={(e) => onCareerChange(e.target.value)}
        >
          <option value="">Todas las carreras</option>
          {careers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
