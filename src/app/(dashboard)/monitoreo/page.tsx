'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Election } from '@/types/elections';

// Interfaces para tipado
interface VotesByHour {
    hour: string;
    count: number;
}

interface VotersBySede {
    sede: string;
    total_voters: number;
    votes_cast: number;
}

interface MonitoringData {
    votesByHour: VotesByHour[],
    votersBySede?: VotersBySede[];
}

export default function MonitorPage() {
    const [elections, setElections] = useState<Election[]>([]);
    const [selectedElectionId, setSelectedElectionId] = useState('');
    const [selectedElection, setSelectedElection] = useState<Election | null>(null);
    const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingStats, setLoadingStats] = useState(false);

    // Cargar lista de elecciones inicial
    useEffect(() => {
        async function fetchElections() {
            try {
                const data = await apiClient<Election[]>('/api/elections');
                // IMPORTANTE: Aquí puedes filtrar o mostrar todas. 
                // Si syncAutomaticStatuses las cierra, asegúrate que el API las siga enviando.
                setElections(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchElections();
    }, []);

    // Cargar estadísticas cuando cambia la elección seleccionada
    useEffect(() => {
        if (!selectedElectionId) {
            setMonitoringData(null);
            return;
        }

        async function fetchStats() {
            setLoadingStats(true);
            try {
                const data = await apiClient<MonitoringData>(`/api/elections/${selectedElectionId}/monitoring`);
                console.log("DATOS RECIBIDOS:", data);
                setMonitoringData(data);
            } catch (err) {
                console.error("Error cargando estadísticas:", err);
            } finally {
                setLoadingStats(false);
            }
        }

        fetchStats();
        // Opcional: Podrías poner un setInterval aquí para que se actualice solo cada 30s
    }, [selectedElectionId]);

    const handleElectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedElectionId(id);
        const election = elections.find((el) => el.id === id);
        setSelectedElection(election || null);
    };

    const getParticipation = () => {
        if (!selectedElection) return 0;
        const total = selectedElection.total_voters || 0;
        const votes = selectedElection.votes_cast || 0;
        return total === 0 ? 0 : (votes / total) * 100;
    };

    const getTimeRemaining = (endTime: string | null | undefined) => {
        if (!endTime) return '—';
        const now = new Date();
        const end = new Date(endTime);
        const diffMs = end.getTime() - now.getTime();
        if (diffMs <= 0) return 'Finalizado';
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);
        return `${diffDays > 0 ? diffDays + 'd ' : ''}${diffHours}h ${diffMinutes}m`;
    };

    if (loading) return <div style={{ padding: '2rem' }}>Cargando sistema de monitoreo...</div>;

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>

            {/* HEADER */}
            <div style={headerStyle}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.3rem', color: '#1a1a1a' }}>
                        Monitoreo en vivo
                    </h1>
                    <select
                        value={selectedElectionId}
                        onChange={handleElectionChange}
                        style={selectStyle}
                    >
                        <option value="">Seleccionar elección para monitorear...</option>
                        {elections.map((e) => (
                            <option key={e.id} value={e.id}>
                                {e.title} ({e.status})
                            </option>
                        ))}
                    </select>
                </div>

                <div style={liveBadge}>
                    <span style={selectedElection?.status === 'OPEN' ? liveDot : deadDot}></span>
                    {selectedElection?.status === 'OPEN' ? 'MONITOREO ACTIVO' : 'SISTEMA EN PAUSA'}
                </div>
            </div>

            {!selectedElection ? (
                <div style={emptyState}>
                    <h2 style={{ marginBottom: '0.5rem' }}>Vista General</h2>
                    <p style={{ color: '#666' }}>Seleccione una votación para desplegar métricas de participación.</p>
                </div>
            ) : (
                <>
                    {/* CARD PRINCIPAL: PARTICIPACIÓN */}
                    <div style={{ ...cardStyle, marginBottom: '1rem', borderLeft: '6px solid #c62828' }}>
                        <p style={subtitle}>PARTICIPACIÓN TOTAL</p>
                        <h2 style={{ fontSize: '4rem', margin: '0.5rem 0', fontWeight: '800' }}>
                            {getParticipation().toFixed(1)}%
                        </h2>
                        <p style={{ color: '#666', fontWeight: '500' }}>
                            {selectedElection.votes_cast} votos registrados de un padrón de {selectedElection.total_voters}
                        </p>
                        <div style={progressBarBg}>
                            <div style={{ ...progressBarFill, width: `${getParticipation()}%` }} />
                        </div>
                    </div>

                    {/* GRID DE ESTADÍSTICAS COMPLEJAS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                            {/* VOTOS POR HORA */}
                            <div style={cardStyle}>
                                <p style={subtitle}>FLUJO DE VOTOS (POR HORA)</p>

                                {/* 🔒 Calcular maxVotes (blindado) */}
                                {(() => {
                                    const maxVotes = monitoringData?.votesByHour?.length
                                        ? Math.max(...monitoringData.votesByHour.map(v => v.count), 1)
                                        : 1;

                                    return (
                                        <div style={{ marginTop: '1rem' }}>
                                            {loadingStats ? (
                                                <p>Actualizando flujo...</p>
                                            ) : monitoringData?.votesByHour?.length ? (
                                                <div style={chartContainer}>
                                                    {monitoringData.votesByHour.map((item, idx) => (
                                                        <div key={idx} style={barWrapper}>
                                                            <div
                                                                style={{
                                                                    ...barStyle,
                                                                    height: `${(item.count / maxVotes) * 100}%`,
                                                                }}
                                                                title={`${item.count} votos`}
                                                            />
                                                            <span style={barLabel}>
                                                                {new Date(item.hour)
                                                                    .getHours()
                                                                    .toString()
                                                                    .padStart(2, '0')}
                                                                :00
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={placeholderChart}>
                                                    Sin actividad reciente
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* PARTICIPACIÓN POR SEDE (SIMPLIFICADO O REMOVIDO) */}
                            {/* VOTANTES POR SEDE */}
                            <div style={cardStyle}>
                                <p style={subtitle}>PARTICIPACIÓN POR SEDE</p>

                                <div style={{ marginTop: '1rem' }}>
                                    {selectedElection?.is_anonymous ? (
                                        <div style={placeholderChart}>
                                            No disponible en votaciones anónimas
                                        </div>
                                    ) : loadingStats ? (
                                        <p>Cargando sedes...</p>
                                    ) : monitoringData?.votersBySede?.length ? (
                                        monitoringData.votersBySede.map((sede, idx) => {
                                            const percent = sede.total_voters === 0
                                                ? 0
                                                : (sede.votes_cast / sede.total_voters) * 100;

                                            return (
                                                <div key={idx} style={{ marginBottom: '0.8rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ fontWeight: '500' }}>{sede.sede}</span>
                                                        <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                                            {sede.votes_cast}/{sede.total_voters}
                                                        </span>
                                                    </div>

                                                    <div style={{ fontSize: '0.85rem', color: '#444', marginTop: '2px' }}>
                                                        {percent.toFixed(1)}% participación
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div style={placeholderChart}>
                                            Sin datos por sede
                                        </div>
                                    )}
                                </div>
                            </div>
                    </div>

                    {/* INFO ADICIONAL */}
                    <div style={{ ...cardStyle, marginTop: '1rem', background: '#f8f9fa' }}>
                        <p style={subtitle}>DETALLES TÉCNICOS</p>
                        <div style={infoGrid}>
                            <Info label="Inicio" value={format(selectedElection.start_time)} />
                            <Info label="Cierre" value={format(selectedElection.end_time)} />
                            <Info label="Tiempo Restante" value={getTimeRemaining(selectedElection.end_time)} />
                            <Info label="Candidatos" value={selectedElection.options_count} />
                            <Info label="ID Sistema" value={selectedElection.id.split('-')[0]} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ================= COMPONENTES AUXILIARES =================

function Info({ label, value }: { label: string; value: any }) {
    return (
        <div>
            <p style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>{label}</p>
            <p style={{ fontWeight: '600', marginTop: '2px', fontSize: '0.9rem' }}>{value}</p>
        </div>
    );
}

function format(date: string | null | undefined) {
    return date ? new Date(date).toLocaleString() : '—';
}

// ================= ESTILOS ADICIONALES =================

const deadDot: React.CSSProperties = {
    width: '10px',
    height: '10px',
    background: '#9e9e9e',
    borderRadius: '50%'
};

const chartContainer: React.CSSProperties = {
    height: '150px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '10px 0',
    borderBottom: '1px solid #eee'
};

const barWrapper: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%'
};

const barStyle: React.CSSProperties = {
    width: '100%',
    background: '#c62828',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease'
};

const barLabel: React.CSSProperties = {
    fontSize: '0.6rem',
    color: '#999',
    marginTop: '4px',
    transform: 'rotate(-45deg)'
};

// ESTILOS GENERALES PARA LA PÁGINA DE MONITOREO
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' };
const selectStyle: React.CSSProperties = { padding: '0.6rem', borderRadius: '6px', border: '1px solid #ccc', marginTop: '0.5rem', minWidth: '300px' };
const liveBadge: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 'bold', color: '#444' };
const liveDot: React.CSSProperties = { width: '10px', height: '10px', background: '#2e7d32', borderRadius: '50%', boxShadow: '0 0 8px #2e7d32' };
const emptyState: React.CSSProperties = { textAlign: 'center', padding: '5rem 1rem', background: '#fdfdfd', borderRadius: '12px', border: '2px dashed #eee' };
const placeholderChart: React.CSSProperties = { height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', background: '#f9f9f9', borderRadius: '8px' };
const infoGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' };
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };
const subtitle: React.CSSProperties = { fontSize: '0.7rem', color: '#999', letterSpacing: '1.2px', fontWeight: 'bold' };
const progressBarBg: React.CSSProperties = { width: '100%', height: '10px', background: '#f0f0f0', borderRadius: '10px', marginTop: '15px', overflow: 'hidden' };
const progressBarFill: React.CSSProperties = { height: '100%', background: 'linear-gradient(90deg, #ef5350, #c62828)', borderRadius: '10px', transition: 'width 0.5s ease-out' };
