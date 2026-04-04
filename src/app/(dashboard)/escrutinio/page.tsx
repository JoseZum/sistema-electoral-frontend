'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Election } from '@/types/elections';
import type { User } from '@/types/auth';


function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function escrutinio() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(false);
  //const [loadingElections, setLoadingElections] = useState(true);
  //const [electionsError, setElectionsError] = useState<string | null>(null);
  //const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  //const [tokenFormat, setTokenFormat] = useState("0");
  //const [autoSend, setAutoSend] = useState(false);
  //const [generating, setGenerating] = useState(false);
  //const [progress, setProgress] = useState(0);
  //const [generated, setGenerated] = useState(false);
  //const [generatedKeys, setGeneratedKeys] = useState([]);

  // Load elections on component mount
  const fetchElections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient<Election[]>('/api/elections');
      const filtered = data.filter((election) => (election.status === 'SCRUTINIZED' || election.status === 'CLOSED'));
      setElections(filtered);
      
    } catch (err) {
      console.error('Error fetching elections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchElections()
  }, [fetchElections])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="w-16 h-1 bg-red-600 mb-4"></div>
        <h2 className="text-3xl font-serif font-normal mb-2">Escrutinio</h2>
        <p className="text-gray-600 text-sm">
          Comprobacion de tipos.
        </p>
      </div>
    
    {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--muted)' }}>Cargando votaciones...</div>
      ) : elections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--muted)' }}>
          <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: '0.5rem' }}>Sin votaciones</h3>
          <p>No hay votaciones para realizar escrutinio.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Titulo</th>
                <th>Elegibles</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {elections.map((election, index) => {
                const participation = election.total_voters > 0
                  ? Math.round((election.votes_cast / election.total_voters) * 100)
                  : 0;

                return (
                  <tr key={election.id} className="table-row-enter" style={{ animationDelay: `${0.05 * (index + 1)}s` }}>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{election.title}</td>
                    {/* 
                    <td>
                      <span className={`badge badge-dot ${STATUS_BADGE[election.status]}`}>
                        {STATUS_LABELS[election.status]}
                      </span>
                    </td>
                    */}
                    <td>{election.total_voters.toLocaleString()}</td>
                    {/* 
                    <td>
                      {election.status === 'DRAFT' || election.status === 'SCHEDULED' ? (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>-</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar" style={{ width: 80, height: 6 }}>
                            <div className={`progress-bar-fill ${participation >= 70 ? 'success' : 'accent'}`} style={{ width: `${participation}%` }} />
                          </div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{participation}%</span>
                        </div>
                      )}
                    </td>
                    */}
                    <td style={{ fontSize: '0.8125rem' }}>{formatDate(election.start_time || election.created_at)}</td>
                    <td>
                      <a  href={`/escrutinio/subir?data=${encodeURIComponent(JSON.stringify({id: election.id}))}`}
                        className = "btn btn-ghost btn-sm">
                        Agregar llave
                      </a>
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