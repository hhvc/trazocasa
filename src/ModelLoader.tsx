import {useEffect,useState} from 'react';
import type {ComponentType} from 'react';
import type {ModelPanelProps} from './ModelPanel';
export function ModelLoader(props:ModelPanelProps){
 const [Panel,setPanel]=useState<ComponentType<ModelPanelProps>|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;void import('./ModelPanel').then(m=>{if(active)setPanel(()=>m.default);}).catch(()=>{if(active)setFailed(true);});return ()=>{active=false;};},[]);
 return Panel?<Panel {...props}/>:<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Cargar modelo 3D"><p role="status">{failed?'No se pudo cargar el visor 3D. Revisá la conexión y volvé a intentarlo.':'Preparando el visor 3D…'}</p><button autoFocus onClick={props.onClose}>Volver a la planta</button></section></div>;
}
