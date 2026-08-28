import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ApplicationStatusBadge, {
  FormStatusBadge,
} from '@/components/postulaciones/ApplicationStatusBadge';
import type { ApplicationStatus } from '@/types/postulaciones';

/**
 * El cliente pidió los tres colores del semáforo de forma explícita:
 * Aprobado verde, Condicionado amarillo, Denegado rojo.
 */
describe('ApplicationStatusBadge', () => {
  const cases: Array<[ApplicationStatus, string, string]> = [
    ['APPROVED', 'Aprobado', 'bg-emerald-700'],
    ['CONDITIONED', 'Condicionado', 'bg-amber-600'],
    ['REJECTED', 'Denegado', 'bg-red-700'],
  ];

  it.each(cases)('%s se muestra como "%s" con la clase %s', (status, label, colorClass) => {
    const { container } = render(<ApplicationStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(`.${colorClass}`)).not.toBeNull();
  });

  it('distingue borrador de enviada', () => {
    const { rerender } = render(<ApplicationStatusBadge status="DRAFT" />);
    expect(screen.getByText('Borrador')).toBeInTheDocument();

    rerender(<ApplicationStatusBadge status="SUBMITTED" />);
    expect(screen.getByText('Enviada')).toBeInTheDocument();
  });

  it('no capitaliza automáticamente para respetar las etiquetas en español', () => {
    const { container } = render(<ApplicationStatusBadge status="APPROVED" />);
    expect(container.querySelector('.capitalize')).toBeNull();
  });
});

describe('FormStatusBadge', () => {
  it('traduce los estados del formulario', () => {
    const { rerender } = render(<FormStatusBadge status="OPEN" />);
    expect(screen.getByText('Abierto')).toBeInTheDocument();

    rerender(<FormStatusBadge status="CLOSED" />);
    expect(screen.getByText('Cerrado')).toBeInTheDocument();

    rerender(<FormStatusBadge status="DRAFT" />);
    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });
});
