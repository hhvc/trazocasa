import { createExport } from './export';
import type { Plan } from './model';

/** A separate, printable document; all user content is assigned as text. */
export async function printPlan(source: SVGSVGElement, plan: Plan, floorName: string): Promise<void> {
  const preview = window.open('about:blank', '_blank');
  if (!preview) throw new Error('Permití abrir ventanas para preparar la impresión. También podés exportar SVG.');
  preview.opener = null;
  const doc = preview.document;
  doc.title = `${plan.name} — ${floorName}`;
  doc.documentElement.lang = 'es';
  const style = doc.createElement('style');
  style.textContent = `
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #26382f; font: 14px Arial, sans-serif; background: white; }
    main { max-width: 273mm; margin: 20px auto; padding: 16px; }
    h1 { margin: 0 0 6px; font-size: 22px; overflow-wrap: anywhere; }
    p { margin: 6px 0; overflow-wrap: anywhere; }
    img { display: block; width: 100%; height: 135mm; object-fit: contain; margin: 8px 0; }
    footer { font-size: 11px; }
    button { padding: 10px 18px; margin: 12px 0; cursor: pointer; }
    @media print { main { margin: 0; padding: 0; } button, .instructions { display: none; } }
  `;
  doc.head.append(style);
  const main = doc.createElement('main');
  const heading = doc.createElement('h1'); heading.textContent = plan.name;
  const subtitle = doc.createElement('p'); subtitle.textContent = `Planta: ${floorName}`;
  const instructions = doc.createElement('p'); instructions.className = 'instructions';
  instructions.textContent = 'Elegí Imprimir y seleccioná tu impresora o Guardar como PDF. Para la hoja preparada usá A4 horizontal y desactivá los encabezados y pies del navegador. El dibujo se ajusta a la hoja; no tiene escala técnica fija.';
  const button = doc.createElement('button'); button.textContent = 'Preparando plano…'; button.disabled = true;
  button.addEventListener('click', () => preview.print());
  const image = doc.createElement('img'); image.alt = `Bosquejo de ${floorName}`;
  const footer = doc.createElement('footer'); footer.textContent = 'TrazoCasa · Bosquejo ajustado a la hoja, sin escala técnica fija. No constituye documentación de obra.';
  main.append(heading, subtitle, instructions, button, image, footer); doc.body.append(main);
  const url = URL.createObjectURL(createExport(source, plan).blob);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No se pudo preparar el plano para imprimir. Probá exportar SVG.'));
      image.src = url;
    });
    button.textContent = 'Imprimir / Guardar PDF'; button.disabled = false;
  } catch (error) {
    button.textContent = 'No se pudo preparar la impresión';
    throw error;
  } finally { URL.revokeObjectURL(url); }
}
