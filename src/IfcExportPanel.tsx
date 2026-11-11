import { useEffect, useRef, useState } from 'react';
import { createBuildingIfc, ifcSummary } from './ifc';
import type { Building } from './model';
import './ifc.css';

export function IfcExportPanel({ building, projectId, onClose }: { building: Building; projectId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const running = useRef(false), mounted = useRef(true);
  const { counts, notices } = ifcSummary(building);
  const elements = counts.walls + counts.slabs + counts.roofs + counts.doors + counts.windows;
  useEffect(() => {
    mounted.current = true;
    const trigger = document.querySelector<HTMLElement>('.project-menu-trigger');
    return () => { mounted.current = false; requestAnimationFrame(() => trigger?.focus()); };
  }, []);
  async function download() {
    if (running.current) return;
    running.current = true; setBusy(true); setMessage('Preparando el edificio IFC…');
    try {
      // Let the pending state paint before generating potentially large buildings.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (!mounted.current) return;
      const result = await createBuildingIfc(building, { projectId });
      if (!mounted.current) return;
      const url = URL.createObjectURL(new Blob([result.content], { type: 'application/x-step' }));
      const a = document.createElement('a'); a.href = url; a.download = result.filename;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Archivo IFC generado. La descarga se envió al navegador.');
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'No se pudo generar el archivo IFC.');
    } finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="modal ifc-modal" role="dialog" aria-modal="true" aria-labelledby="ifc-title" onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'Tab') {
      const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
    }
  }}>
    <button autoFocus className="modal-close" aria-label="Cerrar exportación IFC" onClick={onClose}>×</button>
    <h2 id="ifc-title">Exportar edificio BIM</h2>
    <p>Un archivo IFC4 con todas las plantas, elementos constructivos y aberturas relacionadas con sus muros, losas o cubiertas.</p>
    <dl className="ifc-counts">
      {([['Plantas', counts.floors], ['Muros', counts.walls], ['Losas', counts.slabs], ['Cubiertas', counts.roofs], ['Puertas', counts.doors], ['Ventanas', counts.windows]] as const).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}
    </dl>
    <ul>{notices.map(notice => <li key={notice}>{notice}</li>)}</ul>
    {!elements && <p>Este proyecto todavía no contiene elementos constructivos. El archivo incluirá solamente la organización del edificio y sus plantas.</p>}
    <p className="modal-note">Revisá el modelo en el programa BIM receptor. La edición y las propiedades disponibles dependen de esa aplicación; el archivo no equivale a documentación técnica de obra validada.</p>
    <button className="primary" disabled={busy} onClick={() => void download()}>{busy ? 'Generando IFC…' : 'Descargar edificio IFC'}</button>
    <p role="status" aria-live="polite">{message}</p>
  </section></div>;
}
