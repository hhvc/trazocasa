import type { Point } from './model';
export type RoomOptions = { mode: 'corners' | 'dimensions'; width: string; depth: string; name: string };
export function roomEnd(origin: Point, options: RoomOptions): Point | null {
  const width = Number(options.width.replace(',', '.')), depth = Number(options.depth.replace(',', '.'));
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width < .5 || width > 100 || depth < .5 || depth > 100) return null;
  return { x: origin.x + width, y: origin.y + depth };
}
export function RoomTool({ options, onChange, onCancel, started }: { options: RoomOptions; onChange: (next: RoomOptions) => void; onCancel: () => void; started: boolean }) {
  return <div className="room-tool"><span className="eyebrow">HABITACIÓN RECTANGULAR</span><div className="room-modes"><button aria-pressed={options.mode === 'corners'} onClick={() => { onCancel(); onChange({ ...options, mode: 'corners' }); }}>Dos esquinas</button><button aria-pressed={options.mode === 'dimensions'} onClick={() => { onCancel(); onChange({ ...options, mode: 'dimensions' }); }}>Medidas exactas</button></div><label>Nombre<input aria-label="Nombre de la nueva habitación" maxLength={80} value={options.name} onChange={e => onChange({ ...options, name: e.target.value })}/></label>{options.mode === 'dimensions' && <div className="room-fields"><label>Ancho (m)<input aria-label="Ancho de la habitación" inputMode="decimal" value={options.width} onChange={e => onChange({ ...options, width: e.target.value })}/></label><label>Fondo (m)<input aria-label="Fondo de la habitación" inputMode="decimal" value={options.depth} onChange={e => onChange({ ...options, depth: e.target.value })}/></label></div>}<p>{options.mode === 'corners' ? started ? 'Ahora tocá la esquina opuesta.' : 'Tocá dos esquinas opuestas en el plano.' : 'Tocá el plano para ubicar la esquina superior izquierda.'}</p><small>Medidas entre ejes de paredes. Se crean cuatro lados y un nombre, editables por separado.</small>{started && <button className="room-cancel" onClick={onCancel}>Cancelar trazado</button>}</div>;
}
export function RoomPreview({ a, b }: { a: Point; b: Point }) {
  const width = Math.abs(b.x - a.x), depth = Math.abs(b.y - a.y);
  return <g data-editor="true" pointerEvents="none"><rect x={Math.min(a.x,b.x)} y={Math.min(a.y,b.y)} width={width} height={depth} fill="#bac8a930" stroke="#b97c49" strokeWidth=".045" strokeDasharray=".12 .08"/><circle cx={a.x} cy={a.y} r=".07" fill="#b97c49"/><text x={(a.x+b.x)/2} y={Math.min(a.y,b.y)-.18} fontSize=".19" fill="#9b663b" textAnchor="middle">{width.toFixed(2)} × {depth.toFixed(2)} m</text></g>;
}
