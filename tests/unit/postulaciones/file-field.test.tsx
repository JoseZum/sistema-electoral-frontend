import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileField from '@/components/postulaciones/FileField';
import type { ApplicationFileMeta } from '@/types/postulaciones';

function buildFile(overrides: Partial<ApplicationFileMeta> = {}): ApplicationFileMeta {
  return {
    id: 'file-1',
    application_id: 'app-1',
    field_key: 'id_copy',
    file_name: 'cedula.pdf',
    mime_type: 'application/pdf',
    size_bytes: 2048,
    uploaded_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

const baseProps = {
  label: 'Copia de la identificación',
  hint: 'PDF o imagen',
  onUpload: vi.fn(),
  onRemove: vi.fn(),
  onView: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FileField editable', () => {
  it('ofrece subir cuando no hay archivo', () => {
    render(<FileField {...baseProps} files={[]} editable />);

    expect(screen.getByText('Arrastra el archivo o haz clic')).toBeInTheDocument();
    expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument();
  });

  it('muestra el archivo subido con acciones de ver y eliminar', () => {
    render(<FileField {...baseProps} files={[buildFile()]} editable />);

    expect(screen.getByText('cedula.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('en un campo de archivo único no deja añadir un segundo', () => {
    render(<FileField {...baseProps} files={[buildFile()]} editable />);

    expect(screen.queryByText('Añadir otro archivo')).not.toBeInTheDocument();
  });

  it('en un campo múltiple sí permite añadir más', () => {
    render(<FileField {...baseProps} files={[buildFile()]} editable multiple />);

    expect(screen.getByText('Añadir otro archivo')).toBeInTheDocument();
  });

  it('rechaza en el cliente un archivo de más de 4 MB sin llamar al servidor', () => {
    render(<FileField {...baseProps} files={[]} editable />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(['x'], 'gordo.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 5 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(baseProps.onUpload).not.toHaveBeenCalled();
    expect(screen.getByText(/el máximo es 4 MB/i)).toBeInTheDocument();
  });

  it('sube un archivo de tamaño válido', () => {
    render(<FileField {...baseProps} files={[]} editable />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'ok.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    fireEvent.change(input, { target: { files: [file] } });

    expect(baseProps.onUpload).toHaveBeenCalledWith(file);
  });

  it('solo acepta PDF e imágenes', () => {
    render(<FileField {...baseProps} files={[]} editable />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('application/pdf,image/jpeg,image/png,image/webp');
  });
});

describe('FileField bloqueado', () => {
  it('marca el campo como bloqueado y esconde las acciones de escritura', () => {
    render(<FileField {...baseProps} files={[buildFile()]} editable={false} />);

    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(screen.queryByText('Arrastra el archivo o haz clic')).not.toBeInTheDocument();
  });

  it('deja consultar el archivo aunque no se pueda modificar', () => {
    render(<FileField {...baseProps} files={[buildFile()]} editable={false} />);

    const file = buildFile();
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));

    expect(baseProps.onView).toHaveBeenCalledWith(expect.objectContaining({ id: file.id }));
  });

  it('avisa cuando el campo bloqueado no tiene archivo', () => {
    render(<FileField {...baseProps} files={[]} editable={false} />);

    expect(screen.getByText('Sin archivo adjunto')).toBeInTheDocument();
  });
});
