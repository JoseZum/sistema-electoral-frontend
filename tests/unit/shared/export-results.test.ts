/**
 * Suite objetivo: src/lib/export-results.ts
 *
 * Casos de prueba:
 * - formato de nombres de archivo
 * - generacion de HTML para PDF y DOCX
 * - tratamiento de elecciones anonimas y no anonimas
 * - calculo de secciones visibles del reporte
 * - replica visual de la papeleta (normal y con subvotaciones)
 * - reglas de impresion y manejo del logo institucional
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportResultsToDOCX, exportResultsToPDF } from '@/lib/export-results';
import type { ElectionResults } from '@/types/elections';

const originalBlob = globalThis.Blob;

class TestBlob {
	readonly parts: BlobPart[];
	readonly type: string;

	constructor(parts: BlobPart[], options: BlobPropertyBag = {}) {
		this.parts = parts;
		this.type = options.type ?? '';
	}

	async text() {
		return this.parts.map((part) => String(part)).join('');
	}
}

function createBaseResults(overrides: Partial<ElectionResults> = {}): ElectionResults {
	return {
		election: {
			id: 'election-1',
			title: 'Elección <General> / 2026: Ingeniería & Diseño',
			description: 'Proceso para <representación> estudiantil',
			status: 'OPEN',
			is_anonymous: false,
			auth_method: 'MICROSOFT',
			requires_keys: false,
			min_keys: 0,
			voter_source: 'FULL_PADRON',
			voter_filter: null,
			tag_id: null,
			tag_name: null,
			tag_color: null,
			tag_description: null,
			tag_member_count: null,
			starts_immediately: false,
			immediate_minutes: null,
			start_time: '2026-05-01T08:00:00.000Z',
			end_time: '2026-05-01T16:00:00.000Z',
			created_by: null,
			created_at: '2026-05-01T07:00:00.000Z',
			updated_at: '2026-05-01T07:30:00.000Z',
			total_voters: 3,
			votes_cast: 2,
			options_count: 4,
			allow_suboptions: true,
		},
		options: [
			{
				id: 'opt-1',
				label: 'Plan A',
				option_type: 'NORMAL',
				vote_count: 10,
				percentage: 50,
			},
			{
				id: 'opt-2',
				label: 'Plan B',
				option_type: 'NORMAL',
				vote_count: 8,
				percentage: 40,
			},
			{
				id: 'opt-3',
				label: 'Voto en blanco',
				option_type: 'BLANK',
				vote_count: 1,
				percentage: 5,
			},
			{
				id: 'opt-4',
				label: 'Voto nulo',
				option_type: 'NULL_VOTE',
				vote_count: 1,
				percentage: 5,
			},
		],
		total_votes: 20,
		total_eligible: 21,
		participation_rate: 95.24,
		voters: [
			{
				full_name: 'Ana Pérez',
				carnet: 'A001',
				has_voted: true,
				selected_option_label: 'Plan A',
			},
			{
				full_name: 'Bruno Gómez',
				carnet: 'B002',
				has_voted: false,
				selected_option_label: null,
			},
		],
		...overrides,
	};
}

describe('export-results', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		// Logo fetch is stubbed to fail by default so the report falls back to the text logo.
		// Tests that want to verify the embedded <img> can override this stub.
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response),
		);
		Object.defineProperty(globalThis, 'Blob', {
			value: TestBlob,
			configurable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(globalThis, 'Blob', {
			value: originalBlob,
			configurable: true,
		});
		vi.unstubAllGlobals();
	});

	function installBlobUrlMocks(blobUrl: string) {
		const createObjectUrlMock = vi.fn((blob: Blob) => {
			void blob;
			return blobUrl;
		});
		const revokeObjectUrlMock = vi.fn();

		Object.defineProperty(URL, 'createObjectURL', {
			value: createObjectUrlMock,
			configurable: true,
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			value: revokeObjectUrlMock,
			configurable: true,
		});

		return { createObjectUrlMock, revokeObjectUrlMock };
	}

	it('generates a printable PDF preview with escaped content and public participation details', async () => {
		const results = createBaseResults({
			options: [
				{
					id: 'group-1',
					label: 'Mesa directiva',
					option_type: 'NORMAL',
					vote_count: 0,
					percentage: 0,
					suboptions: [
						{
							id: 'sub-1',
							label: 'Presidencia',
							option_type: 'NORMAL',
							parent_option_id: 'group-1',
							vote_count: 7,
							percentage: 70,
						},
						{
							id: 'sub-2',
							label: 'Vicepresidencia',
							option_type: 'NORMAL',
							parent_option_id: 'group-1',
							vote_count: 3,
							percentage: 30,
						},
					],
				},
			],
			voters: [
				{
					full_name: 'Ana Pérez',
					carnet: 'A001',
					has_voted: true,
					selected_option_label: 'Mesa <directiva>',
				},
				{
					full_name: 'Bruno Gómez',
					carnet: 'B002',
					has_voted: false,
					selected_option_label: null,
				},
			],
			total_votes: 10,
			total_eligible: 12,
			participation_rate: 83.33,
		});

		const { createObjectUrlMock } = installBlobUrlMocks('blob:preview-url');
		let loadHandler: (() => void) | undefined;
		const previewWindow = {
			addEventListener: vi.fn((event: string, handler: () => void) => {
				if (event === 'load') {
					loadHandler = handler;
				}
			}),
			print: vi.fn(),
		};
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(previewWindow as unknown as WindowProxy);

		await exportResultsToPDF(results);

		expect(openSpy).toHaveBeenCalledWith('blob:preview-url', '_blank');
		expect(previewWindow.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));

		const html = await createObjectUrlMock.mock.calls[0][0].text();
		expect(html).toContain('Informe de resultados');
		expect(html).toContain('Elección &lt;General&gt; / 2026: Ingeniería &amp; Diseño');
		expect(html).toContain('Proceso para &lt;representación&gt; estudiantil');
		expect(html).toContain('Mesa directiva');
		expect(html).toContain('Presidencia');
		expect(html).toContain('Vicepresidencia');
		expect(html).toContain('Abstencionismo detectado: 1');
		expect(html).toContain('Opción elegida');
		expect(html).toContain('Mesa &lt;directiva&gt;');

		loadHandler?.();
		expect(previewWindow.print).toHaveBeenCalledTimes(1);
	});

	it('uses Montserrat for regular report text while preserving legacy display fonts', async () => {
		const { createObjectUrlMock } = installBlobUrlMocks('blob:fonts-url');
		const anchor = {
			click: vi.fn(),
			href: '',
			download: '',
		} as unknown as HTMLAnchorElement;
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
			if (tagName.toLowerCase() === 'a') {
				return anchor;
			}

			return originalCreateElement(tagName);
		});

		await exportResultsToDOCX(createBaseResults());

		const html = await createObjectUrlMock.mock.calls[0][0].text();
		expect(html).toContain('family=Montserrat');
		expect(html).toContain('font-family: "Montserrat", "Segoe UI", Arial, sans-serif;');
		expect(html).toContain('.section-kicker {');
		expect(html).toContain('.metric-label {');
		expect(html).toContain('.ballot-replica-title {');
		expect(html).toContain('font-family: Georgia, "Times New Roman", serif;');
	});

	it('downloads a DOCX report with a sanitized filename and anonymous participation labels', async () => {
		const results = createBaseResults({
			election: {
				...createBaseResults().election,
				title: 'Primaria 2026 / Consejo Estudiantil',
				description: null,
				is_anonymous: true,
				status: 'CLOSED',
			},
			voters: [
				{
					full_name: 'Ana Pérez',
					carnet: 'A001',
					has_voted: true,
					selected_option_label: 'Detalle privado',
				},
				{
					full_name: 'Bruno Gómez',
					carnet: 'B002',
					has_voted: false,
					selected_option_label: null,
				},
			],
		});

		const { createObjectUrlMock } = installBlobUrlMocks('blob:download-url');
		const clickSpy = vi.fn();
		const anchor = {
			click: clickSpy,
			href: '',
			download: '',
		} as unknown as HTMLAnchorElement;
		const originalCreateElement = document.createElement.bind(document);
		const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
			if (tagName.toLowerCase() === 'a') {
				return anchor;
			}

			return originalCreateElement(tagName);
		});

		await exportResultsToDOCX(results);

		expect(createElementSpy).toHaveBeenCalledWith('a');
		expect(clickSpy).toHaveBeenCalledTimes(1);
		expect(anchor.download).toBe('resultados_primaria_2026_consejo_estudiantil.doc');

		const html = await createObjectUrlMock.mock.calls[0][0].text();
		expect(html.startsWith('﻿')).toBe(true);
		expect(html).toContain('Sufragio por papeleta');
		expect(html).toContain('Voto emitido');
		expect(html).toContain('Sí');
		expect(html).toContain('No');
		expect(html).not.toContain('Detalle privado');
		expect(html).toContain('La opción elegida no se revela por persona; solo se informa si participó o no.');
	});

	it('renders the empty-state section when there are no eligible voters', async () => {
		const results = createBaseResults({
			voters: [],
			total_eligible: 0,
			participation_rate: 0,
			total_votes: 0,
		});

		const { createObjectUrlMock } = installBlobUrlMocks('blob:empty-url');
		const anchor = {
			click: vi.fn(),
			href: '',
			download: '',
		} as unknown as HTMLAnchorElement;
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
			if (tagName.toLowerCase() === 'a') {
				return anchor;
			}

			return originalCreateElement(tagName);
		});

		await exportResultsToDOCX(results);

		const html = await createObjectUrlMock.mock.calls[0][0].text();
		expect(html).toContain('No hay personas elegibles registradas para esta votación.');
		expect(html).toContain('Estadísticas generales');
		expect(html).toContain('Total de votos');
		expect(html).toContain('Participación');
		expect(html).not.toContain('Nombre completo');
	});

	it('renders the ballot replica with eyebrow, empty checkboxes and candidate photo for plain elections', async () => {
		const photoDataUrl = 'data:image/png;base64,AAAA';
		const results = createBaseResults({
			election: {
				...createBaseResults().election,
				is_anonymous: false,
				allow_suboptions: false,
				title: 'Elección Presidencial',
				description: null,
			},
			options: [
				{
					id: 'opt-a',
					label: 'Helou',
					option_type: 'NORMAL',
					image_url: photoDataUrl,
					vote_count: 5,
					percentage: 50,
				},
				{
					id: 'opt-b',
					label: 'Da',
					option_type: 'NORMAL',
					vote_count: 3,
					percentage: 30,
				},
				{
					id: 'opt-c',
					label: 'EE',
					option_type: 'NORMAL',
					vote_count: 2,
					percentage: 20,
				},
				{
					id: 'opt-blank',
					label: 'Voto en blanco',
					option_type: 'BLANK',
					vote_count: 0,
					percentage: 0,
				},
				{
					id: 'opt-null',
					label: 'Voto nulo',
					option_type: 'NULL_VOTE',
					vote_count: 0,
					percentage: 0,
				},
			],
		});

		const { createObjectUrlMock } = installBlobUrlMocks('blob:replica-plain');
		const anchor = { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tagName: string) =>
			tagName.toLowerCase() === 'a' ? anchor : originalCreateElement(tagName),
		);

		await exportResultsToDOCX(results);
		const html = await createObjectUrlMock.mock.calls[0][0].text();

		expect(html).toContain('Réplica de la papeleta de voto');
		expect(html).toContain('SUFRAGIO PÚBLICO');
		expect(html).toContain('Selecciona una opción para emitir tu voto');
		expect(html).toContain('ballot-replica-choice-box');
		expect(html).toContain('ballot-replica-special-box');
		expect(html).toContain(`src="${photoDataUrl}"`);
		// Voto en blanco / nulo deben aparecer al pie de la papeleta como opciones especiales.
		expect(html).toContain('Voto en blanco');
		expect(html).toContain('Voto nulo');
	});

	it('renders the ballot replica with Roman numerals and section headers for suboption elections', async () => {
		const results = createBaseResults({
			election: {
				...createBaseResults().election,
				is_anonymous: false,
				allow_suboptions: true,
				title: 'Mesa directiva 2026',
				description: null,
			},
			options: [
				{
					id: 'parent-1',
					label: 'Candidatura Azul',
					option_type: 'NORMAL',
					vote_count: 0,
					percentage: 0,
					suboptions: [
						{ id: 'p1-a', label: 'Presidencia', option_type: 'NORMAL', parent_option_id: 'parent-1', vote_count: 4, percentage: 40 },
						{ id: 'p1-b', label: 'Vicepresidencia', option_type: 'NORMAL', parent_option_id: 'parent-1', vote_count: 2, percentage: 20 },
					],
				},
				{
					id: 'parent-2',
					label: 'Candidatura Roja',
					option_type: 'NORMAL',
					vote_count: 0,
					percentage: 0,
					suboptions: [
						{ id: 'p2-a', label: 'Presidencia', option_type: 'NORMAL', parent_option_id: 'parent-2', vote_count: 3, percentage: 30 },
						{ id: 'p2-b', label: 'Voto en blanco', option_type: 'BLANK', parent_option_id: 'parent-2', vote_count: 1, percentage: 10 },
					],
				},
			],
		});

		const { createObjectUrlMock } = installBlobUrlMocks('blob:replica-sub');
		const anchor = { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tagName: string) =>
			tagName.toLowerCase() === 'a' ? anchor : originalCreateElement(tagName),
		);

		await exportResultsToDOCX(results);
		const html = await createObjectUrlMock.mock.calls[0][0].text();

		expect(html).toContain('Selecciona una opción por cada candidatura para emitir tu voto');
		expect(html).toContain('ballot-replica-section-roman');
		// Hay dos secciones, por lo que ambos numerales romanos deben aparecer.
		expect(html).toMatch(/ballot-replica-section-roman[^>]*>\s*I\s*</);
		expect(html).toMatch(/ballot-replica-section-roman[^>]*>\s*II\s*</);
		expect(html).toContain('Candidatura Azul');
		expect(html).toContain('Candidatura Roja');
		// El voto en blanco asociado al grupo Rojo debe quedar al pie de su sección.
		expect(html).toContain('Voto en blanco');
	});

	it('emits print-safe CSS rules so tables and panels do not split across pages', async () => {
		const results = createBaseResults();

		const { createObjectUrlMock } = installBlobUrlMocks('blob:print-rules');
		const anchor = { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tagName: string) =>
			tagName.toLowerCase() === 'a' ? anchor : originalCreateElement(tagName),
		);

		await exportResultsToDOCX(results);
		const html = await createObjectUrlMock.mock.calls[0][0].text();

		expect(html).toContain('@page');
		expect(html).toContain('margin: 18mm 16mm 22mm 16mm');
		expect(html).toContain('counter(page)');
		expect(html).toContain('page-break-inside: avoid');
		expect(html).toContain('table-header-group');
	});

	it('embeds the institutional logo as a data URL when the asset is reachable', async () => {
		// Reset the cached logo from prior tests by reloading the module under a fresh fetch stub.
		vi.resetModules();

		const fakeBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
		const fakeBlob = {
			arrayBuffer: async () => fakeBytes.buffer,
			size: fakeBytes.byteLength,
			type: 'image/png',
		} as unknown as Blob;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				blob: async () => fakeBlob,
			} as unknown as Response),
		);

		// Force FileReader to resolve to a known data URL.
		const originalFileReader = globalThis.FileReader;
		class StubFileReader {
			public onloadend: (() => void) | null = null;
			public onerror: (() => void) | null = null;
			public result: string | null = null;
			readAsDataURL(_blob: Blob) {
				void _blob;
				this.result = 'data:image/png;base64,iVBORw0KGgo=';
				queueMicrotask(() => this.onloadend?.());
			}
		}
		Object.defineProperty(globalThis, 'FileReader', {
			value: StubFileReader,
			configurable: true,
		});

		try {
			const mod = await import('@/lib/export-results');

			const { createObjectUrlMock } = installBlobUrlMocks('blob:logo-url');
			const anchor = { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;
			const originalCreateElement = document.createElement.bind(document);
			vi.spyOn(document, 'createElement').mockImplementation((tagName: string) =>
				tagName.toLowerCase() === 'a' ? anchor : originalCreateElement(tagName),
			);

			await mod.exportResultsToDOCX(createBaseResults());
			const html = await createObjectUrlMock.mock.calls[0][0].text();

			expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
			expect(html).toContain('class="tribunal-logo"');
		} finally {
			Object.defineProperty(globalThis, 'FileReader', {
				value: originalFileReader,
				configurable: true,
			});
		}
	});
});
