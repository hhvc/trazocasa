import type {Furniture3DKind} from './furnitureHeights';
export type Triple=[number,number,number];
export type FurniturePart={shape:'box'|'cylinder'|'sphere'|'ring';position:Triple;scale:Triple;rotation?:Triple;color:string};
const wood='#bda789',cloth='#b6c5b7',light='#eeeade',white='#f1f0e8',metal='#74857e',dark='#45554e',glass='#9fbdb9',leaf='#94ad7b',soil='#82725c';
/** X/Z in [-.5,.5], Y in [0,1]. Front faces +Z, matching the 2D glyphs. */
export function furnitureParts(kind:Furniture3DKind):FurniturePart[]{
 const parts:FurniturePart[]=[];
 const part=(shape:FurniturePart['shape'],position:Triple,scale:Triple,color=light,rotation?:Triple)=>parts.push({shape,position,scale,color,...(rotation?{rotation}:{})});
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,color=light)=>part('box',[x,y,z],[w,h,d],color);
 const ball=(x:number,y:number,z:number,w:number,h:number,d:number,color=leaf)=>part('sphere',[x,y,z],[w,h,d],color);
 const cyl=(x:number,y:number,z:number,w:number,h:number,d:number,color=wood)=>part('cylinder',[x,y,z],[w,h,d],color);
 const ring=(x:number,y:number,z:number,w:number,h:number,d:number,color=white)=>part('ring',[x,y,z],[w,h,d],color);
 const legs=(top:number,x=.39,z=.39)=>{for(const a of [-x,x])for(const b of [-z,z])box(a,top/2,b,.08,top,.08,wood);};
 const handle=(x:number,y:number,z=.487,w=.22)=>box(x,y,z,w,.025,.025,metal);
 const basin=(x:number,y:number,z:number,w:number,d:number)=>{box(x,y-.055,z,w,.06,d,glass);ring(x,y,z,w,.09,d,white);};
 switch(kind){
 case 'person':{
  const shirt='#7297ab',skin='#d2b9a1',pants='#596961';
  for(const x of [-.17,.17]){box(x,.035,.1,.26,.07,.62,dark);cyl(x,.28,0,.22,.42,.45,pants);}
  box(0,.5,0,.62,.12,.65,pants);box(0,.65,0,.7,.28,.68,shirt);
  for(const x of [-.41,.41]){cyl(x,.67,0,.16,.2,.28,shirt);cyl(x,.49,0,.14,.18,.28,skin);ball(x,.4,0,.15,.07,.3,skin);}
  cyl(0,.81,0,.18,.08,.3,skin);ball(0,.91,0,.4,.18,.53,skin);ball(0,.96,-.02,.41,.08,.53,dark);
  ball(0,.91,.27,.08,.025,.08,skin);for(const x of [-.08,.08])ball(x,.93,.235,.035,.014,.035,dark);break;
 }

 case 'bed':case 'singleBed':{
  legs(.22);box(0,.27,.02,.95,.22,.94,wood);box(0,.47,.025,.94,.2,.93,white);box(0,.61,.18,.95,.09,.56,cloth);box(0,.5,-.465,1,1,.07,wood);
  const n=kind==='bed'?2:1;for(let i=0;i<n;i++)box((i-(n-1)/2)*.46,.61,-.29,.82/n,.1,.22,light);break;
 }
 case 'sofa':case 'sofa3':case 'armchair':{
  legs(.14);box(0,.27,0,.94,.26,.9,wood);box(0,.68,-.4,1,.64,.2,cloth);for(const x of [-.445,.445])box(x,.5,.04,.11,.55,.9,cloth);
  const n=kind==='sofa3'?3:kind==='sofa'?2:1;for(let i=0;i<n;i++){const x=(i-(n-1)/2)*.77/n;box(x,.48,.11,.75/n,.18,.7,light);box(x,.76,-.26,.75/n,.4,.08,light);}break;
 }
 case 'chair':legs(.49,.37,.37);box(0,.53,0,1,.1,1,wood);box(0,.8,-.445,.94,.4,.11,cloth);break;
 case 'table':case 'desk':legs(.9);box(0,.95,0,1,.1,1,wood);if(kind==='desk'){box(.29,.58,.02,.35,.62,.83,light);for(const y of [.38,.61,.83])handle(.29,y,.448,.16);}break;
 case 'roundCoffeeTable':legs(.88,.26,.26);cyl(0,.94,0,1,.12,1,wood);break;
 case 'nightstand':legs(.12);box(0,.54,0,.96,.84,.94,wood);box(0,.97,0,1,.06,1,light);for(const y of [.35,.74]){box(0,y,.478,.85,.34,.03,light);handle(0,y+.07,.487);}break;
 case 'wardrobe':box(0,.5,0,1,1,.94,wood);for(const x of [-.245,.245]){box(x,.5,.477,.475,.96,.026,light);box(x>0?.055:-.055,.5,.497,.02,.14,.006,metal);}break;
 case 'tv':box(0,.025,.08,.65,.05,.72,dark);box(0,.16,-.14,.07,.24,.12,metal);box(0,.61,-.24,1,.78,.2,dark);box(0,.61,-.135,.94,.69,.01,glass);break;
 case 'fridge':box(0,.5,-.02,1,1,.96,white);for(const [y,h] of [[.34,.64],[.84,.28]]){box(0,y,.473,.96,h,.035,light);box(.37,y,.497,.025,h*.45,.006,metal);}break;
 case 'washer':box(0,.49,-.02,1,.98,.96,white);box(0,.89,.477,.93,.15,.035,light);part('ring',[0,.44,.475],[.65,.045,.65],metal,[Math.PI/2,0,0]);part('cylinder',[0,.44,.481],[.42,.025,.42],glass,[Math.PI/2,0,0]);handle(.28,.9,.487,.12);break;
 case 'stove':box(0,.47,0,1,.94,1,white);box(0,.97,0,1,.06,1,metal);for(const x of [-.24,.24])for(const z of [-.24,.24])cyl(x,.995,z,.28,.01,.28,dark);box(0,.46,.493,.78,.5,.014,dark);handle(0,.76,.487,.7);break;
 case 'bathtub':box(0,.12,0,1,.24,1,white);for(const x of [-.44,.44])box(x,.59,0,.12,.82,1,white);for(const z of [-.45,.45])box(0,.59,z,.76,.82,.1,white);box(0,.25,0,.76,.03,.8,glass);cyl(0,.3,-.3,.07,.02,.05,metal);break;
 case 'bathroomSink':box(0,.4,0,.27,.8,.36,white);basin(0,.86,.04,.98,.85);cyl(0,.93,-.36,.045,.14,.055,metal);box(0,.99,-.3,.06,.02,.18,metal);break;
 case 'kitchenSink':box(0,.43,0,1,.86,1,wood);box(0,.89,0,1,.06,1,white);basin(-.12,.92,.04,.64,.7);cyl(0,.96,-.36,.04,.08,.05,metal);box(0,.99,-.3,.06,.02,.18,metal);for(const x of [-.24,.24]){box(x,.43,.485,.46,.78,.025,light);handle(x,.7,.487,.15);}break;
 case 'toilet':case 'bidet':{
  const toilet=kind==='toilet';ball(0,toilet?.22:.34,.06,.53,toilet?.44:.68,.63,white);basin(0,toilet?.54:.91,.13,.9,.7);
  if(toilet){box(0,.69,-.34,.92,.58,.28,white);box(0,.985,-.34,.96,.03,.3,light);box(.24,.9,-.192,.1,.025,.015,metal);}else{box(0,.89,-.32,.8,.16,.32,white);cyl(0,.975,-.3,.06,.05,.07,metal);}break;
 }
 case 'smallCar':case 'mediumCar':case 'pickup':{
  const pickup=kind==='pickup',compact=kind==='smallCar';box(0,.32,0,.82,.32,.96,cloth);box(0,.55,-.32,.8,.18,.3,light);
  for(const x of [-.445,.445])for(const z of [-.3,.29])part('cylinder',[x,.22,z],[.42,.11,.18],dark,[0,0,Math.PI/2]);
  const cz=pickup?-.08:compact?.04:.07,cd=pickup?.33:compact?.56:.49;box(0,.75,cz,.65,.42,cd,glass);box(0,.98,cz,.68,.04,cd,light);for(const x of [-.337,.337])box(x,.75,cz,.028,.44,.035,cloth);
  if(pickup){box(0,.49,.32,.7,.02,.3,dark);for(const x of [-.365,.365])box(x,.59,.32,.09,.2,.32,cloth);box(0,.59,.46,.68,.2,.04,cloth);}
  for(const x of [-.26,.26]){box(x,.48,-.485,.18,.075,.03,white);box(x,.46,.485,.17,.065,.03,'#b98571');}break;
 }
 case 'argentineGrill':{
  box(0,.07,0,1,.14,1,wood);for(const x of [-.455,.455])box(x,.5,0,.09,1,1,light);box(0,.5,-.455,.82,1,.09,light);box(0,.45,0,.82,.06,.82,wood);box(.19,.69,0,.06,.42,.82,light);
  for(let i=0;i<8;i++)box(-.13,.51,-.32+i*.09,.48,.018,.018,metal);for(let i=0;i<3;i++)box(.31,.5,-.2+i*.18,.12,.045,.04,soil);break;
 }
 case 'firePit':cyl(0,.05,0,.78,.1,.78,soil);ring(0,.5,0,1,1,1,metal);for(const angle of [-.7,.7])part('box',[0,.3,0],[.65,.15,.12],wood,[0,angle,0]);break;
 case 'tree':cyl(0,.26,0,.12,.52,.12,wood);ball(0,.69,0,1,.62,1);ball(-.23,.63,.1,.48,.51,.57,'#a8bc94');break;
 case 'palm':{
  cyl(0,.45,0,.1,.9,.1,wood);ball(0,.92,0,.18,.16,.18,leaf);for(let i=0;i<8;i++){const a=i*Math.PI/4;part('sphere',[Math.sin(a)*.25,.92,Math.cos(a)*.25],[.18,.1,.48],i%2?leaf:'#a6bc8f',[0,a,0]);}break;
 }
 case 'shrub':ball(0,.5,0,.9,1,.85);ball(-.24,.36,.18,.5,.72,.6,'#a8bc94');ball(.22,.35,-.18,.55,.7,.6,leaf);break;
 case 'pottedPlant':cyl(0,.22,0,.63,.44,.63,'#c6a58a');ring(0,.44,0,.7,.06,.7,wood);cyl(0,.49,0,.08,.2,.08,wood);ball(0,.75,0,.65,.5,.65);for(const x of [-.25,.25])ball(x,.67,.04,.45,.42,.7,'#a8bc94');break;
 }
 return parts;
}
