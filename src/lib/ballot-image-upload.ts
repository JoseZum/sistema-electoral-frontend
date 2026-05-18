'use client';

const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_DIMENSION = 1400;
const JPEG_OUTPUT_QUALITY = 0.82;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('No se pudo leer la imagen seleccionada'));
    };

    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada'));
    image.src = dataUrl;
  });
}

function scaleDimensions(width: number, height: number) {
  if (width <= MAX_OUTPUT_DIMENSION && height <= MAX_OUTPUT_DIMENSION) {
    return { width, height };
  }

  if (width >= height) {
    return {
      width: MAX_OUTPUT_DIMENSION,
      height: Math.max(1, Math.round((height / width) * MAX_OUTPUT_DIMENSION)),
    };
  }

  return {
    width: Math.max(1, Math.round((width / height) * MAX_OUTPUT_DIMENSION)),
    height: MAX_OUTPUT_DIMENSION,
  };
}

function getOutputMimeType(file: File) {
  return file.type === 'image/png' ? 'image/png' : 'image/jpeg';
}

export async function prepareBallotImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido');
  }

  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new Error('La imagen supera el máximo permitido de 10 MB');
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const { width, height } = scaleDimensions(image.naturalWidth, image.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo preparar la imagen seleccionada');
  }

  const outputMimeType = getOutputMimeType(file);
  if (outputMimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);

  return outputMimeType === 'image/png'
    ? canvas.toDataURL(outputMimeType)
    : canvas.toDataURL(outputMimeType, JPEG_OUTPUT_QUALITY);
}

export function isStoredImageDataUrl(value: string) {
  return value.startsWith('data:image/');
}
