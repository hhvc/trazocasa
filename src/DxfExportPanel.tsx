import { useEffect, useState } from 'react';
import { createFloorDxf, dxfNotices } from './dxf';
import { floorLevels } from './model';
import type { Building } from './model';
import './dxf.css';

export function DxfExportPanel({ building, onClose }: { building: Building; onClose: () => void }) {
  const [floorId, setFloorId] = useState(building.activeFloorId);
  const [message, setMessage] = useState('');
  const levels = floorLevels(building), floor = building.floors.find(f => f.id === floorId)!;
  useEffect(() => {
    const trigger = document.querySelector<HTMLElement>('.project-menu-trigger');
    return () => { requestAnimationFrame(() => trigger?.focus()); };
  }, []);
  function download() {
    try {
      const result = createFloorDxf(building, floorId);
      const url = URL.createObjectURL(new Blob([result.content], { type: 'application/dxf' }));
      const a = document.createElement('a');
      a.href = url; a.download = result.filename;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`DXF de ${floor.name} descargado. Podés elegir otra planta para exportarla.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo generar el DXF.'); }
  }
  return <div className="modal-backdrop"><section className="modal dxf-modal" role="dialog" aria-modal="true" aria-labelledby="dxf-title" onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'Tab') {
      const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),select'));
      if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
    }
  }}>
    <button autoFocus className="modal-close" aria-label="Cerrar exportación DXF" onClick={onClose}>×</button>
    <h2 id="dxf-title">Exportar plano CAD</h2>
    <p>Descargá un archivo DXF editable por planta, con capas para muros, aberturas, cotas, textos, superficies y mobiliario.</p>
    <label htmlFor="dxf-floor">Planta</label>
    <select id="dxf-floor" value={floorId} onChange={e => { setFloorId(e.target.value); setMessage(''); }}>
      {building.floors.map((f, i) => <option key={f.id} value={f.id}>{f.name} · nivel {levels[i].toFixed(2)} m</option>)}
    </select>
    <ul>{dxfNotices(building, floorId).map(notice => <li key={notice}>{notice}</li>)}</ul>
    <p className="modal-note">Cada plano se dibuja en Z = 0 y conserva el nivel de la planta como dato. No incluye el modelo 3D. La edición disponible depende del programa CAD receptor; revisá medidas y textos al abrirlo.</p>
    <button className="primary" onClick={download}>Descargar DXF de esta planta</button>
    <p role="status" aria-live="polite">{message}</p>
  </section></div>;
}
