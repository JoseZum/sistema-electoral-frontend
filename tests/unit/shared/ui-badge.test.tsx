/**
 * Suite objetivo: src/components/ui/Badge.tsx
 *
 * Casos de prueba:
 * - render del contenido
 * - variantes visuales
 * - clases condicionales
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '@/components/ui/Badge';

vi.mock('next/link', () => ({
	default: ({ children, href, className }: any) => (
		<a href={href} className={className}>
			{children}
		</a>
	),
}));

describe('Badge', () => {
	it('renders its content inside a span by default', () => {
		const { container } = render(<Badge>Estado</Badge>);

		const badge = container.firstElementChild as HTMLElement;

		expect(screen.getByText('Estado')).toBeInTheDocument();
		expect(badge.tagName).toBe('SPAN');
		expect(badge).toHaveClass('inline-flex');
		expect(badge).toHaveClass('capitalize');
		expect(badge).toHaveClass('bg-slate-700');
		expect(badge).toHaveClass('text-white');
		expect(badge).toHaveClass('h-6');
	});

	it('renders a link when href is provided and keeps the badge classes', () => {
		const { container } = render(
			<Badge href="/detalles" variant="blue" size="lg">
				Ver detalle
			</Badge>
		);

		const link = container.firstElementChild as HTMLAnchorElement;

		expect(link.tagName).toBe('A');
		expect(link).toHaveAttribute('href', '/detalles');
		expect(link).toHaveClass('!no-underline');
		expect(link).toHaveClass('bg-blue-700');
		expect(link).toHaveClass('text-white');
		expect(link).toHaveClass('h-8');
		expect(screen.getByText('Ver detalle')).toBeInTheDocument();
	});

	it('applies custom variant, size and className without capitalizing when disabled', () => {
		const { container } = render(
			<Badge variant="green-subtle" size="sm" capitalize={false} className="shadow-sm">
				activo
			</Badge>
		);

		const badge = container.firstElementChild as HTMLElement;

		expect(badge).toHaveClass('bg-emerald-100');
		expect(badge).toHaveClass('text-emerald-900');
		expect(badge).toHaveClass('h-5');
		expect(badge).toHaveClass('shadow-sm');
		expect(badge).not.toHaveClass('capitalize');
		expect(screen.getByText('activo')).toBeInTheDocument();
	});

	it('renders the icon in a sized wrapper before the label', () => {
		const { container } = render(
			<Badge icon={<span data-testid="badge-icon">i</span>} size="sm">
				Info
			</Badge>
		);

		const badge = container.firstElementChild as HTMLElement;
		const iconWrapper = container.querySelector('span span') as HTMLElement;

		expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
		expect(iconWrapper).toHaveClass('inline-flex');
		expect(iconWrapper).toHaveClass('h-[11px]');
		expect(iconWrapper).toHaveClass('w-[11px]');
		expect(badge).toHaveClass('gap-[3px]');
		expect(screen.getByText('Info')).toBeInTheDocument();
	});
});
