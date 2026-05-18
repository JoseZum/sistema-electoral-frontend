/**
 * Suite objetivo: src/components/Loader.tsx
 *
 * Casos de prueba:
 * - render del indicador de carga
 * - clases base y accesibilidad minima
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Loader from '../../../src/components/Loader';

describe('Loader', () => {
	it('renders the loading indicator with the default container styles', () => {
		const { container } = render(<Loader />);

		const outer = container.firstElementChild as HTMLElement;
		const indicator = container.querySelector('.loader');

		expect(indicator).toBeTruthy();
		expect(outer).toBeTruthy();
		expect(outer).toHaveStyle({
			padding: '4rem',
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
		});
	});

	it('renders the fullscreen container when fullscreen is enabled', () => {
		const { container } = render(<Loader fullscreen />);

		const outer = container.firstElementChild as HTMLElement;
		const indicator = container.querySelector('.loader');

		expect(indicator).toBeTruthy();
		expect(outer).toHaveStyle({
			minHeight: '100vh',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		});
	});
});
