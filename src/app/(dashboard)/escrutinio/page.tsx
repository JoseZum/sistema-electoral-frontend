'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Election } from '@/types/elections';
import Loader from '@/components/Loader';

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';

  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function EscrutinioPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pendingScrutiny = useMemo(
    () => elections.filter((election) => election.requires_keys && election.status === 'CLOSED'),
    [elections]
  );

  const fetchElections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient<Election[]>('/api/elections');
      setElections(data);
    } catch (err) {
      console.error('Error fetching elections:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar elecciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchElections();
  }, [fetchElections]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="w-16 h-1 bg-red-600 mb-4"></div>
        <h2 className="text-3xl font-serif font-normal mb-2">Escrutinio</h2>
        <p className="text-gray-600 text-sm">
          Canje de llaves para elecciones cerradas que requieren escrutinio y aún no están finalizadas.
        </p>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      ) : pendingScrutiny.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16 px-6 text-gray-600">
          <h3 className="font-semibold mb-2 text-gray-900">Sin escrutinios pendientes</h3>
          <p>No hay elecciones cerradas con llaves pendientes de canje.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Titulo</th>
                <th>Elegibles</th>
                <th>Participacion</th>
                <th>Llaves minimas</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingScrutiny.map((election, index) => {
                const participation = election.total_voters > 0
                  ? Math.round((election.votes_cast / election.total_voters) * 100)
                  : 0;

                return (
                  <tr key={election.id} className="table-row-enter" style={{ animationDelay: `${0.05 * (index + 1)}s` }}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{election.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                        Requiere escrutinio por llaves
                      </div>
                    </td>
                    <td>{election.total_voters.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="progress-bar" style={{ width: 80, height: 6 }}>
                          <div
                            className={`progress-bar-fill ${participation >= 70 ? 'success' : 'accent'}`}
                            style={{ width: `${participation}%` }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{participation}%</span>
                      </div>
                    </td>
                    <td>{election.min_keys.toLocaleString()}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{formatDate(election.end_time || election.start_time || election.created_at)}</td>
                    <td>
                      <Link
                        href={`/escrutinio/subir?id=${encodeURIComponent(election.id)}`}
                        className="btn btn-ghost btn-sm"
                      >
                        Canjear llave
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
