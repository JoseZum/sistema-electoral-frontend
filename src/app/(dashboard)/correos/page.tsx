'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';


export default function CorreosMasivosPage() {
    const [selectedTemplate, setSelectedTemplate] = useState<string>('token');
    const [customMessage, setCustomMessage] = useState('');

    const [elections, setElections] = useState<any[]>([]);
    const [selectedElectionId, setSelectedElectionId] = useState<string>('');
    const [selectedElection, setSelectedElection] = useState<any | null>(null);

    useEffect(() => {
        async function fetchElections() {
            try {
                const data = await apiClient('/api/elections');
                setElections(data);
            } catch (err) {
                console.error('Error cargando elecciones', err);
            }
        }

        fetchElections();
    }, []);

    // TODO: estos valores vendrán del backend según la votación seleccionada
    const electionName = selectedElection?.title || '___';
    const electionClosingDate = selectedElection?.end_time
        ? new Date(selectedElection.end_time).toLocaleDateString('es-CR')
        : '___';

    const updateEmailRecipients = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedElectionId(id);

        const election = elections.find((el) => el.id === id);
        setSelectedElection(election);
    };

    const selectEmailTemplate = (type: string) => {
        setSelectedTemplate(type);
    };

    const sendEmails = () => {
        // TODO: conectar con backend
        console.log({
            template: selectedTemplate,
            message: customMessage,
        });
    };

    return (
        <div className="view-enter" style={{ maxWidth: '780px', margin: '0 auto' }}>

            {/* HEADER */}
            <div style={{ marginBottom: '2rem' }}>
                <div className="swiss-bar" />
                <h2
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.5rem',
                        fontWeight: 500,
                        margin: 0,
                    }}
                >
                    Correos masivos
                </h2>

                <p
                    style={{
                        color: 'var(--muted)',
                        fontSize: '0.875rem',
                        marginTop: '0.25rem',
                    }}
                >
                    Enviá tokens de acceso, recordatorios o notificaciones a los votantes
                    elegibles de una votación.
                </p>
            </div>

            {/* STEP 1 */}
            <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
                <div className="label" style={{ marginBottom: '1rem' }}>
                    1 — Seleccionar votación
                </div>

                <select
                    className="input"
                    id="email-election-select"
                    onChange={updateEmailRecipients}
                >
                    <option value="">Elegir una votación...</option>

                    {elections.map((election) => (
                        <option key={election.id} value={election.id}>
                            {election.title}
                        </option>
                    ))}
                </select>

                <div
                    id="email-recipient-count"
                    style={{
                        marginTop: '0.75rem',
                        fontSize: '0.875rem',
                        color: 'var(--muted)',
                    }}
                >
                    {selectedElection
                        ? `Votación seleccionada: ${selectedElection.title}`
                        : 'Seleccioná una votación'}
                </div>
            </div>

            {/* STEP 2 */}
            <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
                <div className="label" style={{ marginBottom: '1rem' }}>
                    2 — Tipo de correo
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2,1fr)',
                        gap: '0.75rem',
                    }}
                >

                    <div
                        className={`type-card ${selectedTemplate === 'token' ? 'selected' : ''}`}
                        onClick={() => selectEmailTemplate('token')}
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            Enviar token de acceso
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            Token único + link para votar
                        </div>
                    </div>

                    <div
                        className={`type-card ${selectedTemplate === 'reminder' ? 'selected' : ''}`}
                        onClick={() => selectEmailTemplate('reminder')}
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            Recordatorio de votación
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            Recordar que la votación sigue abierta
                        </div>
                    </div>

                    <div
                        className={`type-card ${selectedTemplate === 'opening' ? 'selected' : ''}`}
                        onClick={() => selectEmailTemplate('opening')}
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            Notificación de apertura
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            Avisar que la votación ya abrió
                        </div>
                    </div>

                    <div
                        className={`type-card ${selectedTemplate === 'custom' ? 'selected' : ''}`}
                        onClick={() => selectEmailTemplate('custom')}
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            Personalizado
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            Redactar mensaje libre
                        </div>
                    </div>
                </div>

                {/* MENSAJE PERSONALIZADO */}
                {selectedTemplate === 'custom' && (
                    <div style={{ marginTop: '1rem' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                marginBottom: '0.5rem',
                            }}
                        >
                            Mensaje personalizado
                        </label>

                        <textarea
                            className="input"
                            rows={5}
                            placeholder="Escriba aquí el mensaje que desea enviar..."
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            style={{ width: '100%', resize: 'vertical' }}
                        />
                    </div>
                )}
            </div>

            {/* STEP 3 PREVIEW */}
            <div
                className="card"
                style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}
            >
                <div
                    style={{
                        padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                    }}
                >
                    <div className="label">3 — Vista previa del correo</div>

                    <span className="badge badge-dot badge-draft">Borrador</span>
                </div>

                <div style={{ padding: '1.5rem', fontSize: '0.875rem' }}>
                    <div
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1.25rem',
                            fontSize: '0.8125rem',
                            color: 'var(--ink-soft)',
                            lineHeight: 1.7,
                        }}
                    >
                        {/* TOKEN */}
                        {selectedTemplate === 'token' && (
                            <>
                                <p>Estimado/a <strong>{'{{nombre}}'}</strong>,</p>

                                <br />

                                <p>
                                    Tu token de acceso para la votación <strong>{electionName}</strong> es:
                                </p>

                                <br />

                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '1rem',
                                        background: 'var(--surface-raised)',
                                        border: '1px dashed var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                    }}
                                >
                                    <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                        {'{{TOKEN}}'}
                                    </span>
                                </div>

                                <br />

                                <p>
                                    Ingresá a <strong>votacion.tee.estudiantec.cr</strong> con tu carnet y este token para emitir tu voto.
                                </p>
                            </>
                        )}

                        {/* RECORDATORIO */}
                        {selectedTemplate === 'reminder' && (
                            <>
                                <p>Estimado/a <strong>{'{{nombre}}'}</strong>,</p>

                                <br />

                                <p>
                                    Te recordamos que la votación <strong>{electionName}</strong> se encuentra actualmente abierta.
                                </p>

                                <br />

                                <p>
                                    La votación se cerrará el <strong>{electionClosingDate}</strong>.
                                </p>

                                <br />

                                <p>
                                    Si aún no has emitido tu voto, te invitamos a hacerlo antes de la fecha de cierre.
                                </p>
                            </>
                        )}

                        {/* APERTURA */}
                        {selectedTemplate === 'opening' && (
                            <>
                                <p>Estimado/a <strong>{'{{nombre}}'}</strong>,</p>

                                <br />

                                <p>
                                    La votación <strong>{electionName}</strong> ha sido oficialmente abierta.
                                </p>

                                <br />

                                <p>
                                    Ya podés ingresar al sistema de votación para emitir tu voto.
                                </p>

                                <br />

                                <p>
                                    Accedé a <strong>votacion.tee.estudiantec.cr</strong> utilizando tu carnet y token.
                                </p>
                            </>
                        )}

                        {/* PERSONALIZADO */}
                        {selectedTemplate === 'custom' && (
                            <p>{customMessage || 'Aquí se mostrará el mensaje personalizado.'}</p>
                        )}

                        <br />

                        <p style={{ color: 'var(--muted)' }}>
                            — Tribunal Electoral Estudiantil, TEC
                        </p>
                    </div>
                </div>
            </div>

            {/* SEND */}
            <div className="card" style={{ padding: '1.25rem' }}>
                <button
                    className="btn btn-accent btn-lg"
                    onClick={sendEmails}
                >
                    Enviar correos
                </button>
            </div>

            {/* HISTORIAL */}
            <div style={{ marginTop: '2rem' }}>
                <h3
                    style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                        fontSize: '1rem',
                        marginBottom: '1rem',
                    }}
                >
                    Envíos recientes
                </h3>

                {/* TODO: conectar con backend */}

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Votación</th>
                                <th>Tipo</th>
                                <th>Destinatarios</th>
                                <th>Estado</th>
                            </tr>
                        </thead>

                        <tbody>
                            {/* TODO: render dinámico */}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}