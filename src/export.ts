import { planBounds } from './model';
import type { Plan } from './model';

/** Clone just the drawing: no selection, grid, preview, zoom or editor controls. */
export function createExport(source: SVGSVGElement, plan: Plan) {
  const node = source.cloneNode(true) as SVGSVGElement;
  node.querySelectorAll('[data-editor]').forEach(e => e.remove());
  node.querySelectorAll('[data-selection-stroke]').forEach(e => e.setAttribute('stroke', 'none'));
  node.removeAttribute('class');
  const bounds = planBounds(plan);
  const scale = 2400 / Math.max(bounds.width, bounds.height);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  node.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
  node.setAttribute('width', String(width));
  node.setAttribute('height', String(height));
  node.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  node.style.cssText = 'background:#faf9f5;font-family:Arial,sans-serif';
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  for (const [key, value] of Object.entries(bounds)) background.setAttribute(key, String(value));
  background.setAttribute('fill', '#faf9f5');
  node.prepend(background);
  return { blob: new Blob([new XMLSerializer().serializeToString(node)], { type: 'image/svg+xml' }), width, height };
}

export async function renderPng(source: SVGSVGElement, plan: Plan): Promise<Blob> {
  const { blob, width, height } = createExport(source, plan);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('No se pudo preparar la imagen.')); image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Este navegador no permite exportar PNG. Podés descargar SVG.');
    context.fillStyle = '#faf9f5'; context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo generar el PNG.')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
