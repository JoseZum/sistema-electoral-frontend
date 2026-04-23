'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Election } from '@/types/elections';
import { useAuth } from '@/lib/auth-context';
import type { User } from '@/types/auth';
import Loader from '@/components/Loader';

interface GeneratedKey {
  id: string;
  carnet: string;
  nombre: string;
  token: string;
  result: any;
}

export default function GenerarLlavesPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loadingElections, setLoadingElections] = useState(true);
  const [electionsError, setElectionsError] = useState<string | null>(null);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [tokenFormat, setTokenFormat] = useState("0");
  const [autoSend, setAutoSend] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);
  const { user } = useAuth();

  // Load elections on component mount
  useEffect(() => {
    const loadElections = async () => {
      try {
        setLoadingElections(true);
        setElectionsError(null);
        const data = await apiClient<Election[]>('/api/elections');
        setElections(data);
      } catch (error) {
        console.error('Error loading elections:', error);
        setElectionsError(error instanceof Error ? error.message : 'Error al cargar elecciones');
      } finally {
        setLoadingElections(false);
      }
    };

    loadElections();
  }, []);

  const handleElectionChange = (electionId: string) => {
    const election = elections.find(e => e.id === electionId) || null;
    setSelectedElection(election);
    setGenerated(false);
    setGeneratedKeys([]);
  };

  const getElectionType = (election: Election): string => {
    if (election.voter_source === 'FULL_PADRON') return 'Electoral Masiva';
    if (election.voter_source === 'FILTERED') return 'Filtrada';
    return 'Manual';
  };

  const getVoterSource = (election: Election): string => {
    if (election.voter_source === 'FULL_PADRON') return 'Padrón completo';
    if (election.voter_source === 'FILTERED') return 'Filtrado personalizado';
    return 'Lista manual';
  };

  const generateKeys = async () => {
      console.log(user);
    if (!selectedElection || !user) return;

    setGenerating(true);
    setProgress(0);
    try{
      const payload: { option: string; students_id: string[] } = {
        option: tokenFormat,
        students_id: [user.studentId]
      };

      const response = await apiClient<{result: any, keys: string}>(`/api/scrutiny/${selectedElection.id}/assign-members`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const userResult: GeneratedKey = {
        id: user.studentId,
        carnet: user.carnet,
        nombre: user.fullName,
        token: response.keys,
        result: response.result
      }

      setProgress(100);
      setGeneratedKeys([userResult]);
      setGenerated(true);
    }catch(error){
      alert('Error al generar llaves');
    }finally{
      setGenerating(false);
    }
  };


  const exportCSV = () => {
    // Implement CSV export
    console.log('Exporting CSV...');
  };

  const sendEmails = () => {
    // Implement email sending
    console.log('Sending emails...');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="w-16 h-1 bg-red-600 mb-4"></div>
        <h2 className="text-3xl font-serif font-normal mb-2">Generar llaves de votación</h2>
        <p className="text-gray-600 text-sm">
          Generá tokens de acceso únicos para cada votante elegible de una votación específica. Cada token permite votar una sola vez.
        </p>
      </div>

      {/* Select Election */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          Seleccionar votación
        </div>
        {loadingElections ? (
          <Loader />
        ) : electionsError ? (
          <div className="text-center py-4 text-red-600">{electionsError}</div>
        ) : (
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            value={selectedElection?.id || ''}
            onChange={(e) => handleElectionChange(e.target.value)}
          >
            <option value="">Elegir una votación...</option>
            {elections.filter(election => election.status === "CLOSED" && !election.requires_keys).map(election => (
              <option key={election.id} value={election.id}>
                {election.title}
              </option>
            ))}
          </select>
        )}

        {/* Election info (shown on selection) */}
        {selectedElection && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</div>
                <div className="font-semibold text-sm mt-1">{getElectionType(selectedElection)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Origen votantes</div>
                <div className="font-semibold text-sm mt-1">{getVoterSource(selectedElection)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Elegibles</div>
                <div className="text-2xl font-medium mt-0.5 text-red-600 font-serif">
                  {selectedElection.total_voters.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Config */}
      {selectedElection && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-5">
            Configuración de tokens
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Formato del token
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  value={tokenFormat}
                  onChange={(e) => setTokenFormat(e.target.value)}
                >
                  <option value="0">6 dígitos numéricos (ej: 847291)</option>
                  <option value="1">8 caracteres alfanuméricos (ej: aX7k9mP2)</option>
                  <option value="2">UUID corto (ej: f47ac10b)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Expiración
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  value="Igual al cierre de la votación"
                  disabled
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                className="accent-red-600"
                checked={autoSend}
                onChange={(e) => setAutoSend(e.target.checked)}
                disabled = {true}
              />
              Enviar tokens por correo automáticamente al generar
            </label>
          </div>
        </div>
      )}

      {/* Generate Button */}
      {selectedElection && (
        <div className="text-center py-4">
          <button
            className="bg-red-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
            onClick={generateKeys}
            disabled={generating}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            {generating ? 'Generando tokens...' : 'Generar tokens'}
          </button>

          {/* Progress */}
          {generating && (
            <div className="mt-6 max-w-md mx-auto">
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Generando tokens...</span>
                  <span className="font-semibold text-red-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {generated && (
        <div>
          {/* Success Card */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-4">
            <div className="flex items-center gap-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div>
                <div className="font-semibold text-green-800">
                   Tokens generados exitosamente
                </div>
                <div className="text-sm text-green-600">
                  Formato: {tokenFormat === '0' ? '6 dígitos numéricos' : tokenFormat === '1' ? '8 caracteres alfanuméricos' : 'UUID corto'}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            <button
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              onClick={exportCSV}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Exportar CSV
            </button>
            <button
              className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
              onClick={sendEmails}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Enviar por correo
            </button>
          </div>

          {/* Preview Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Carnet</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Token</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {generatedKeys.map((key, index) => (
                  <tr key={key.id} className="hover:bg-red-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{key.carnet}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{key.nombre}</td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{key.token}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {"Creado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <button className="text-gray-400 hover:text-gray-600">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-700">
                Mostrando 1–{generatedKeys.length} de {selectedElection?.total_voters.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">‹</button>
                <button className="px-3 py-1 text-sm bg-red-600 text-white border border-red-600 rounded">1</button>
                <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">2</button>
                <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">3</button>
                <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">…</button>
                <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">›</button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Los tokens son de uso único. Cada token solo permite votar una vez en esta votación. Si se regeneran, los anteriores se invalidan.
          </p>
        </div>
      )}
    </div>
  );
}
