import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Group,BoxGeometry,Mesh,MeshBasicMaterial,Vector3} from 'three';
async function moduleUrl(file,deps={}){let source=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;for(const [name,url] of Object.entries(deps))source=source.replaceAll(`'${name}'`,JSON.stringify(url));return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;}
const modelUrl=await moduleUrl('./model.ts'),heightsUrl=await moduleUrl('./furnitureHeights.ts');
const {emptyPlan,validatePlan,validateBuilding,buildingFromPlan,addFloor}=await import(modelUrl);
const volumesUrl=await moduleUrl('./model3d.ts',{'./model':modelUrl}),{buildingVolumes}=await import(volumesUrl);
const physicsUrl=await moduleUrl('./walkPhysics.ts',{'./furnitureHeights':heightsUrl}),{createWalkWorld,moveWalker,walkDelta}=await import(physicsUrl);
const {createWalkController}=await import(await moduleUrl('./WalkController.ts',{'three':import.meta.resolve('three'),'./walkPhysics':physicsUrl}));
const person=(extra={})=>({id:'person',kind:'person',x:3,y:1,width:.6,depth:.4,rotation:180,...extra});
const wall={id:'wall',a:{x:0,y:0},b:{x:6,y:0},thickness:.1};
const rectangle=(x,y,w,d)=>[{x,y},{x:x+w,y},{x:x+w,y:y+d},{x,y:y+d}];
function project(extra={},item=person()){return buildingFromPlan(validatePlan({...emptyPlan(),furniture:[item],...extra}));}
function world(building=project(),index=0){return createWalkWorld(buildingVolumes(building,{scope:'all',slabs:true,roofs:true,furniture:true}),{floorId:building.floors[index].id,elementId:'person'});}
function walk(w,from,dx,dz,n=40){let p={...from};for(let i=0;i<n;i++)p=moveWalker(w,p,dx,dz);return p;}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('a person walks through a fitting door but stops at solid walls, low lintels and windows',()=>{
 const base={walls:[wall]},door={id:'door',wallId:'wall',kind:'door',t:.5,width:.9,height:2.1};
 const clear=world(project({...base,openings:[door]}));assert.ok(walk(clear,clear.start,0,-.05).z<-.9);
 for(const openings of [[],[{...door,height:1.4}],[{...door,kind:'window',sill:0}]]){const w=world(project({...base,openings}));assert.ok(walk(w,w.start,0,-.05).z>=w.radius+.049,JSON.stringify(openings));}
 // A round body can enter partway into a narrow opening before touching its jambs.
 const narrow=world(project({...base,openings:[{...door,width:.4}]})),stop=walk(narrow,narrow.start,0,-.05),contact=.05+Math.sqrt(narrow.radius**2-.2**2);
 assert.ok(stop.z>=contact-.001&&stop.z<contact+.026);assert.ok(narrow.canOccupy(stop));assert.ok(!narrow.canOccupy({x:3,z:0}));
});
test('thin rotated walls block large moves and allow sliding without penetrating corners',()=>{
 const w=world(project({walls:[{...wall,a:{x:2,y:-4},b:{x:2,y:4}}]}));
 const stopped=walk(w,w.start,-1,0,10);assert.ok(stopped.x>=2+w.radius+.049);
 const slid=walk(w,w.start,-.04,.04,40);assert.ok(slid.z>2);assert.ok(slid.x>=2+w.radius+.049);assert.ok(w.canOccupy(slid));
});
test('furniture bounds block passage and only the selected person is excluded',()=>{
 const b=project({furniture:[person(),{...person(),id:'other',x:3,y:-.3}]});const w=world(b);assert.ok(w.canOccupy(w.start));assert.ok(walk(w,w.start,0,-.05).z>-.3);
 const elevated=world(project({furniture:[person(),{...person(),id:'shelf',kind:'wardrobe',x:3,y:0,elevation:2.2,height:.5}]}));assert.ok(walk(elevated,elevated.start,0,-.05).z<0);
 const rotated=world(project({furniture:[person(),{id:'desk',kind:'desk',x:3,y:0,width:2,depth:.6,rotation:45,height:.75}]}));assert.ok(walk(rotated,rotated.start,0,-.05).z>0);
});
test('upper floors need slab support and stop at slab boundaries and small holes',()=>{
 const slab={id:'slab',name:'Piso',points:rectangle(0,0,6,6),slab:{thickness:.2},holes:[{id:'hole',name:'Hueco',target:'slab',points:rectangle(2.9,2.9,.2,.2)}]};
 let b=addFloor(project({surfaces:[slab]},person({y:1})),'Alta','copy');b=validateBuilding({...b,floors:b.floors.map((f,i)=>i?{...f,elevation:3.2}:f)});
 const w=world(b,1);assert.ok(w.canOccupy(w.start));assert.ok(!w.canOccupy({x:3,z:3}));assert.ok(!w.canOccupy({x:.1,z:1}));assert.ok(!w.canOccupy({x:7,z:1}));
 assert.ok(walk(w,w.start,0,.05,80).z<2.9-w.radius+.03);
 const noSlab={...b,floors:b.floors.map((f,i)=>i?{...f,plan:{...f.plan,surfaces:[]}}:f)};assert.ok(!world(noSlab,1).canOccupy(w.start));
 assert.ok(!world(b).canOccupy({x:3,z:3}));assert.ok(world(b).canOccupy({x:7,z:1}));
});
test('connected slab support, elevation and headroom are evaluated at the body level',()=>{
 const surfaces=[{id:'a',name:'A',points:rectangle(0,0,3,6),slab:{thickness:.2}},{id:'b',name:'B',points:rectangle(3,0,3,6),slab:{thickness:.2}}];
 const b=addFloor(project({surfaces}),'Alta','copy'),w=world(b,1);assert.ok(w.canOccupy({x:3,z:2}));
 assert.ok(!world(project({},person({elevation:1}))).canOccupy({x:3,z:1}));
 const low=world(project({surfaces:[{id:'r',name:'Techo',points:rectangle(0,-3,6,6),roof:{thickness:.2,height:1.4}}]}));assert.ok(!low.canOccupy(low.start));
 const high=world(project({surfaces:[{id:'r',name:'Techo',points:rectangle(0,-3,6,6),roof:{thickness:.2,height:2.8}}]}));assert.ok(high.canOccupy(high.start));
});
test('movement is frame-rate independent, normalized diagonally and caps long pauses',()=>{
 close(Math.hypot(...Object.values(walkDelta(0,1,0,.02))),Math.hypot(...Object.values(walkDelta(0,1,1,.02))));
 close(walkDelta(0,1,0,1).z,.07);close(walkDelta(0,1,0,-1).z,0);close(walkDelta(Math.PI/2,1,0,.02).x,-.028);
 const w=world(),one=walk(w,w.start,0,.028,50),two=walk(w,w.start,0,.014,100);close(one.z,two.z);
});
test('collision construction and temporary motion do not change the saved plan',()=>{
 const b=project({walls:[wall]}),before=JSON.stringify(b),w=world(b);walk(w,w.start,.05,0);assert.equal(JSON.stringify(b),before);assert.throws(()=>createWalkWorld([], {floorId:'missing',elementId:'person'}));
});
function target(){const events=new Map();return {events,addEventListener(name,fn){const set=events.get(name)??new Set();set.add(fn);events.set(name,set);},removeEventListener(name,fn){events.get(name)?.delete(fn);},fire(name,props={}){const e={preventDefault(){this.prevented=true;},...props};for(const fn of events.get(name)??[])fn(e);return e;},count(){return [...events.values()].reduce((n,s)=>n+s.size,0);}};}
function harness(obstacles=[]){
 const win=target(),doc={...target(),defaultView:win},canvas={...target(),ownerDocument:doc,style:{cursor:'default'},focus(){},setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}};
 let callback,id=0;const clock={request(cb){callback=cb;return ++id;},cancel(){callback=undefined;}};
 const avatar={root:new Group(),poses:[],pose(d,m){this.poses.push([d,m]);}},reports=[];
 const w=world(project({},person({x:0,y:0,rotation:0}))),controller=createWalkController(canvas,w,avatar,obstacles,()=>{},p=>reports.push(p),clock);
 return {win,doc,canvas,avatar,reports,controller,tick(t){const next=callback;callback=undefined;next?.(t);},get queued(){return !!callback;}};
}
test('keyboard walking, reset, camera toggle and animation preserve the original spawn',()=>{
 const h=harness();h.controller.setMode('first');h.tick(0);h.canvas.fire('keydown',{code:'KeyW'});h.tick(50);h.tick(100);close(h.controller.camera.position.z,.14);assert.ok(h.avatar.poses.at(-1)[1]);
 h.win.fire('keyup',{code:'KeyW'});h.tick(150);close(h.controller.camera.position.z,.14);assert.equal(h.avatar.poses.at(-1)[1],false);
 h.controller.setMode('third');assert.ok(h.avatar.root.visible);h.controller.reset();close(h.avatar.root.position.z,0);assert.equal(h.reports.at(-1).distance,0);h.controller.dispose();
});
test('focus loss, hidden tabs and disposal release all held movement and scheduled frames',()=>{
 const h=harness();h.tick(0);h.canvas.fire('keydown',{code:'KeyW'});h.tick(50);h.win.fire('blur');h.tick(100);h.tick(150);close(h.avatar.root.position.z,.07);
 h.controller.input('forward',true);h.tick(200);h.doc.fire('visibilitychange');h.tick(250);h.tick(300);close(h.avatar.root.position.z,.14);
 h.canvas.fire('keydown',{code:'KeyW',ctrlKey:true});h.tick(350);close(h.avatar.root.position.z,.14);
 h.controller.dispose();assert.equal(h.queued,false);assert.equal(h.canvas.count()+h.win.count()+h.doc.count(),0);assert.equal(h.canvas.style.cursor,'default');
});
test('touch movement combines with looking and stops when its button is released',()=>{
 const h=harness();h.controller.setMode('first');h.tick(0);h.controller.look(Math.PI/2,0);h.controller.input('forward',true);h.tick(50);close(h.avatar.root.position.x,-.07);h.controller.input('forward',false);h.tick(100);close(h.avatar.root.position.x,-.07);h.controller.dispose();
});
test('third person camera retracts before a wall instead of crossing it',()=>{
 const mesh=new Mesh(new BoxGeometry(6,4,.2),new MeshBasicMaterial());mesh.position.set(0,2,-1.2);mesh.updateMatrixWorld();const h=harness([mesh]);h.tick(0);assert.ok(h.controller.camera.position.z>-1.1);h.controller.setMode('first');close(h.controller.camera.position.z,0);assert.equal(h.avatar.root.visible,false);h.controller.dispose();mesh.geometry.dispose();mesh.material.dispose();
});
