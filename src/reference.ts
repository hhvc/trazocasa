import type {Point} from './model';
export function calibratedWidth(a:Point,b:Point,ratio:number,metres:number){
 const fraction=Math.hypot(b.x-a.x,(b.y-a.y)*ratio);
 if(![a.x,a.y,b.x,b.y,ratio,metres].every(Number.isFinite)||ratio<=0||metres<=0||fraction<.01)throw new Error('Marcá dos puntos separados e ingresá una distancia mayor que cero.');
 const width=metres/fraction,height=width*ratio;
 if(width<.1||height<.1||width>100||height>100)throw new Error('La imagen calibrada debe medir entre 0,10 y 100 m por lado.');
 return width;
}
