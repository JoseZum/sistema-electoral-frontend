'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Election } from '@/types/elections';
import { useAuth } from '@/lib/auth-context';
import Loader from '@/components/Loader';

interface GeneratedKey {
  electionTitle: string;
  carnet: string;
  nombre: string;
  token: string;
}

interface AssignMembersResponse {
  result: unknown;
  keys: string[] | string;
}

function getResponseKey(keys: string[] | string): string {
  return Array.isArray(keys) ? keys[0] ?? '' : keys;
}

export default function GenerarLlavesPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loadingElections, setLoadingElections] = useState(true);
  const [electionsError, setElectionsError] = useState<string | null>(null);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const { user } = useAuth();

  const eligibleElections = useMemo(
    () => elections.filter((election) => election.requires_keys && election.status === 'CLOSED'),
    [elections]
  );

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
    const election = eligibleElections.find((item) => item.id === electionId) || null;
    setSelectedElection(election);
    setGeneratedKey(null);
    setGenerationError(null);
    setGenerationMessage(null);
  };

  const getElectionType = (election: Election): string => {
    if (election.voter_source === 'FULL_PADRON') return 'Electoral masiva';
    if (election.voter_source === 'FILTERED') return 'Filtrada';
    if (election.voter_source === 'TAG') return 'Por tag';
    return 'Manual';
  };

  const getVoterSource = (election: Election): string => {
    if (election.voter_source === 'FULL_PADRON') return 'Padrón completo';
    if (election.voter_source === 'FILTERED') return 'Filtro personalizado';
    if (election.voter_source === 'TAG') return election.tag_name ? `Tag: ${election.tag_name}` : 'Tag';
    return 'Lista manual';
  };

  const generateKey = async () => {
    if (!selectedElection) return;

    if (!user?.studentId) {
      setGenerationError('No se pudo identificar al usuario administrador autenticado.');
      return;
    }

    setGenerating(true);
    setGeneratedKey(null);
    setGenerationError(null);
    setGenerationMessage(null);

    try {
      const response = await apiClient<AssignMembersResponse>(
        `/api/scrutiny/${selectedElection.id}/assign-members`,
        {
          method: 'POST',
          body: JSON.stringify({
            option: '0',
            students_id: [user.studentId],
          }),
        }
      );

      const token = getResponseKey(response.keys);
      if (!token) {
        throw new Error('El servidor no devolvió la llave generada.');
      }

      setGeneratedKey({
        electionTitle: selectedElection.title,
        carnet: user.carnet,
        nombre: user.fullName,
        token,
      });
      setGenerationMessage('Llave generada. Guárdala ahora; por seguridad solo se muestra en este momento.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al generar la llave';
      setGenerationError(
        message.toLowerCase().includes('duplic')
          ? 'Ya existe una llave asignada para este usuario en esta elección. No es posible volver a mostrarla.'
          : message
      );
    } finally {
      setGenerating(false);
    }
  };

  const copyGeneratedKey = async () => {
    if (!generatedKey) return;

    try {
      await navigator.clipboard.writeText(generatedKey.token);
      setGenerationMessage('Llave copiada al portapapeles.');
      setGenerationError(null);
    } catch {
      setGenerationError('No se pudo copiar la llave automáticamente.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="w-16 h-1 bg-red-600 mb-4"></div>
        <h2 className="text-3xl font-serif font-normal mb-2">Generar llave de escrutinio</h2>
        <p className="text-gray-600 text-sm">
          Genera una llave para el administrador autenticado en elecciones cerradas que requieren escrutinio.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          Eleccion pendiente de escrutinio
        </div>

        {loadingElections ? (
          <Loader />
        ) : electionsError ? (
          <div className="text-center py-4 text-red-600">{electionsError}</div>
        ) : eligibleElections.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            No hay elecciones cerradas que requieran llaves de escrutinio.
          </div>
        ) : (
          <>
            <label htmlFor="scrutiny-election-select" className="block text-sm font-medium text-gray-700 mb-2">
              Selecciona la eleccion a escrutar
            </label>
            <select
              id="scrutiny-election-select"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              value={selectedElection?.id || ''}
              onChange={(event) => handleElectionChange(event.target.value)}
            >
              <option value="">Elegir una eleccion...</option>
              {eligibleElections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.title}
                </option>
              ))}
            </select>
          </>
        )}

        {selectedElection && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</div>
                <div className="font-semibold text-sm mt-1">{getElectionType(selectedElection)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Origen votantes</div>
                <div className="font-semibold text-sm mt-1">{getVoterSource(selectedElection)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Minimo llaves</div>
                <div className="text-2xl font-medium mt-0.5 text-red-600 font-serif">
                  {selectedElection.min_keys.toLocaleString()}
                </div>
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

      {selectedElection && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Administrador autenticado
              </div>
              <div className="font-semibold text-gray-900">{user?.fullName || 'Usuario no disponible'}</div>
              <div className="text-sm text-gray-600 font-mono">{user?.carnet || user?.studentId || '-'}</div>
            </div>

            <button
              type="button"
              className="bg-red-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={generateKey}
              disabled={generating || !user?.studentId}
            >
              {generating ? (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              )}
              {generating ? 'Generando...' : 'Generar mi llave'}
            </button>
          </div>
        </div>
      )}

      {generationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
          {generationError}
        </div>
      )}

      {generationMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm text-green-800">
          {generationMessage}
        </div>
      )}

      {generatedKey && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Llave generada
            </div>
            <div className="font-semibold text-gray-900 mt-1">{generatedKey.electionTitle}</div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nombre</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{generatedKey.nombre}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Carnet</div>
                <div className="text-sm font-mono text-gray-900 mt-1">{generatedKey.carnet}</div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Tu llave
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <code className="flex-1 text-2xl font-mono font-semibold text-gray-900 break-all">
                  {generatedKey.token}
                </code>
                <button
                  type="button"
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-white transition-colors"
                  onClick={copyGeneratedKey}
                >
                  Copiar
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Esta llave se canjea en el flujo de escrutinio. No se envía por correo ni se muestra en otro listado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
