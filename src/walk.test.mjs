import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Group,BoxGeometry,Mesh,MeshBasicMaterial,Vector3} from 'three';
async function moduleUrl(file,deps={}){let source=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;for(const [name,url] of Object.entries(deps))source=source.replaceAll(`'${name}'`,JSON.stringify(url));return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;}
const modelUrl=await moduleUrl('./model.ts'),heightsUrl=await moduleUrl('./furnitureHeights.ts');
const {emptyPlan,validatePlan,validateBuilding,buildingFromPlan,addFloor}=await import(modelUrl);
const volumesUrl=await moduleUrl('./model3d.ts',{'./model':modelUrl}),{buildingVolumes}=await import(volumesUrl);
const climbUrl=await moduleUrl('./climb.ts'),{findClimbAction,climbMotion,containsClimbSurface,selectedClimb}=await import(climbUrl);
const physicsUrl=await moduleUrl('./walkPhysics.ts',{'./climb':climbUrl,'./furnitureHeights':heightsUrl,'./stairGeometry':await moduleUrl('./stairGeometry.ts')}),{createWalkWorld,moveWalker,walkDelta}=await import(physicsUrl);
const motionUrl=await moduleUrl('./walkMotion.ts',{'./climb':climbUrl,'./walkPhysics':physicsUrl});
const {advanceWalk,initialMotion,toggleCrouch,jump,verticalStep,bodyHeight}=await import(motionUrl);
const vehicleUrl=await moduleUrl('./vehicle.ts'),{vehicleCandidate,vehicleEntryReason,advanceVehicle,vehicleExit,vehicleItem}=await import(vehicleUrl);
const {createWalkController}=await import(await moduleUrl('./WalkController.ts',{'./vehicle':vehicleUrl,'./climb':climbUrl,'three':import.meta.resolve('three'),'./walkPhysics':physicsUrl,'./walkMotion':motionUrl}));
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
function harness(obstacles=[],useDefaultClock=false,overrideWorld,onVehicle){
 const win=target(),doc={...target(),defaultView:win},canvas={...target(),ownerDocument:doc,style:{cursor:'default'},focus(){},setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}};
 let callback,id=0;const clock={request(cb){callback=cb;return ++id;},cancel(){callback=undefined;}};
 const avatar={root:new Group(),poses:[],pose(d,m){this.poses.push([d,m]);}},reports=[];
 const w=overrideWorld??world(project({},person({x:0,y:0,rotation:0}))),controller=createWalkController(canvas,w,avatar,obstacles,()=>{},p=>reports.push(p),useDefaultClock?undefined:clock,onVehicle);
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

test('browser frame methods retain their native receiver rather than the clock wrapper',()=>{
 const oldRequest=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;let requested=0,cancelled=0;
 globalThis.requestAnimationFrame=function(){assert.ok(this===undefined||this===globalThis);requested++;return 42;};
 globalThis.cancelAnimationFrame=function(id){assert.ok(this===undefined||this===globalThis);assert.equal(id,42);cancelled++;};
 try{const h=harness([],true);assert.equal(requested,1);h.controller.dispose();assert.equal(cancelled,1);}finally{if(oldRequest)globalThis.requestAnimationFrame=oldRequest;else delete globalThis.requestAnimationFrame;if(oldCancel)globalThis.cancelAnimationFrame=oldCancel;else delete globalThis.cancelAnimationFrame;}
});

test('crouching fits under a low lintel, cannot stand beneath it, and keeps the plan unchanged',()=>{
 const b=project({walls:[wall],openings:[{id:'door',kind:'door',wallId:'wall',t:.5,width:.9,height:1.35}]}),before=JSON.stringify(b),w=world(b);
 let m=toggleCrouch(w,initialMotion(w));assert.ok(m.crouched);close(bodyHeight(w,m),1.19);
 for(let i=0;i<20;i++)m=advanceWalk(w,m,0,-.05,.05).motion;
 assert.ok(Math.abs(m.position.z)<.03);m=toggleCrouch(w,m);assert.ok(m.crouched&&m.standBlocked);
 for(let i=0;i<20;i++)m=advanceWalk(w,m,0,-.05,.05).motion;
 assert.ok(!m.standBlocked);m=toggleCrouch(w,m);assert.ok(!m.crouched);assert.equal(JSON.stringify(b),before);
});
test('jump reaches its intended apex and lands on the same floor at different frame rates',()=>{
 for(const dt of [.01,.025,.05]){const w=world();let m=jump(initialMotion(w)),peak=0;for(let i=0;i<Math.ceil(1.2/dt);i++){m=advanceWalk(w,m,0,0,dt).motion;peak=Math.max(peak,m.feet);}assert.ok(Math.abs(peak-w.base-.55)<.002);assert.ok(m.grounded);close(m.feet,w.base);close(m.velocity,0);}
});
test('a held jump cannot double-jump and crouching prevents takeoff',()=>{
 const w=world(),start=initialMotion(w),up=jump(start);assert.equal(jump(up),up);const crouched=toggleCrouch(w,start);assert.equal(jump(crouched),crouched);
 const paused=advanceWalk(w,up,0,0,0).motion;assert.equal(paused.velocity,up.velocity);assert.equal(paused.grounded,false);
});
test('thin ceilings stop upward motion without tunneling and the person lands afterward',()=>{
 const w=world(project({surfaces:[{id:'roof',name:'Techo',points:rectangle(0,-3,6,6),roof:{height:1.85,thickness:.05}}]}));let m=jump(initialMotion(w)),peak=0;
 for(let i=0;i<30;i++){m=advanceWalk(w,m,0,0,.05).motion;peak=Math.max(peak,m.feet);}assert.ok(peak<=.151);assert.ok(m.grounded);close(m.feet,w.base);
 const sweep=verticalStep(w,w.start,0,1.7,5);assert.ok(sweep.ceiling);close(sweep.feet,.15);
});
test('jump can land on low furniture and stepping off returns to the floor',()=>{
 const p=person({x:0,y:0,rotation:0}),w=world(project({furniture:[p,{id:'box',kind:'nightstand',x:0,y:.8,width:1,depth:.4,rotation:0,height:.25}]},p));let m=jump(initialMotion(w));
 for(let i=0;i<25;i++)m=advanceWalk(w,m,0,.04,.025).motion;
 for(let i=0;i<25;i++)m=advanceWalk(w,m,0,0,.025).motion;
 assert.ok(m.grounded);close(m.feet,.25);
 for(let i=0;i<60;i++)m=advanceWalk(w,m,.05,0,.025).motion;
 assert.ok(m.grounded);close(m.feet,0);
});
test('jumping still respects upper floor edges and slab holes',()=>{
 const b=addFloor(project({surfaces:[{id:'slab',name:'Piso',points:rectangle(0,0,6,6),slab:{thickness:.2}}]},person({x:.4,y:2})),'Alta','copy'),w=world(b,1);let m=jump(initialMotion(w));
 for(let i=0;i<50;i++)m=advanceWalk(w,m,-.05,0,.025).motion;assert.ok(m.position.x>=w.radius-.001);assert.ok(m.grounded);close(m.feet,w.base);
});
test('keyboard and touch abilities change posture and eye height, reject repeats and reset cleanly',()=>{
 const h=harness();h.controller.setMode('first');h.tick(0);h.canvas.fire('keydown',{code:'KeyC'});h.tick(25);assert.ok(h.reports.at(-1).crouched);close(h.controller.camera.position.y,1.7*.63);
 h.canvas.fire('keydown',{code:'KeyC',repeat:true});assert.ok(h.reports.at(-1).crouched);h.controller.act('jump');assert.ok(h.reports.at(-1).grounded);
 h.controller.act('crouch');h.canvas.fire('keydown',{code:'Space'});h.tick(50);assert.ok(!h.reports.at(-1).grounded);assert.ok(h.controller.camera.position.y>1.7*.93);
 h.controller.reset();h.tick(75);assert.ok(h.reports.at(-1).grounded&&!h.reports.at(-1).crouched);close(h.controller.camera.position.y,1.7*.93);h.controller.dispose();
});
test('crouched movement is slower and focus loss preserves a safe crouched posture',()=>{
 const h=harness();h.tick(0);h.controller.act('crouch');h.controller.input('forward',true);h.tick(50);close(h.avatar.root.position.z,.035);h.win.fire('blur');h.tick(100);h.tick(150);close(h.avatar.root.position.z,.035);assert.ok(h.reports.at(-1).crouched);h.controller.dispose();
});

test('a resting grounded figure avoids repeated collision queries',()=>{const w=world();let queries=0;const original=w.verticalIntervals;w.verticalIntervals=p=>{queries++;return original(p);};let m=initialMotion(w);for(let i=0;i<60;i++)m=advanceWalk(w,m,0,0,1/60).motion;assert.equal(queries,0);close(m.feet,w.base);});

const flight=(extra={})=>({id:'stairs',kind:'stairs',x:0,y:0,width:1.2,depth:6,rotation:0,height:3,elevation:0,...extra});
function stairProject({hole=true,startAbove=false,rotation=0,upper=true}={}){
 const rotate=({x,y})=>({x:x*Math.cos(rotation*Math.PI/180)-y*Math.sin(rotation*Math.PI/180),y:x*Math.sin(rotation*Math.PI/180)+y*Math.cos(rotation*Math.PI/180)});
 const p=person({...rotate({x:0,y:startAbove?-4:4}),rotation:(180+rotation)%360});
 const lower=validatePlan({...emptyPlan(),furniture:[flight({rotation}),...(!startAbove?[p]:[])]});
 const top=validatePlan({...emptyPlan(),furniture:startAbove?[p]:[],surfaces:[{id:'upper',name:'Planta alta',points:rectangle(-5,-5,10,10),slab:{thickness:.2},holes:hole?[{id:'opening',name:'Escalera',target:'slab',points:rectangle(-.8,-2.99,1.6,7).map(rotate)}]:[]}]});
 const b=buildingFromPlan(lower);
 return validateBuilding({...b,floors:[{...b.floors[0],elevation:0},...(upper?[{id:'upper-floor',name:'Planta alta',elevation:3,plan:top}]:[])]});
}
function advanceTo(w,m,x,z,dt=.025){
 for(let n=0;n<1500&&Math.hypot(x-m.position.x,z-m.position.z)>.003;n++){const d=Math.hypot(x-m.position.x,z-m.position.z),s=Math.min(d,1.4*dt);m=advanceWalk(w,m,(x-m.position.x)/d*s,(z-m.position.z)/d*s,dt).motion;}
 return m;
}
test('straight stair connects two floors in both directions, including oblique rotations',()=>{
 for(const rotation of [0,30,45,90,180,270])for(const dt of [.016,.05]){
  const b=stairProject({rotation}),before=JSON.stringify(b),w=world(b),a=rotation*Math.PI/180;
  let m=advanceTo(w,initialMotion(w),4*Math.sin(a),-4*Math.cos(a),dt);
  assert.ok(Math.hypot(m.position.x-4*Math.sin(a),m.position.z+4*Math.cos(a))<.01,JSON.stringify({rotation,m}));close(m.feet,3);assert.ok(m.grounded);
  m=advanceTo(w,m,-4*Math.sin(a),4*Math.cos(a),dt);close(m.feet,0);assert.ok(m.grounded);assert.equal(JSON.stringify(b),before);
 }
});
test('a tour can start upstairs and descend below its original spawn floor',()=>{
 const w=world(stairProject({startAbove:true}),1),m=advanceTo(w,initialMotion(w),0,4);close(m.feet,0);assert.ok(m.position.z>3.9);assert.ok(m.grounded);
});
test('an uncut upper slab blocks ascent and a disconnected stair cannot leave its top',()=>{
 const blocked=world(stairProject({hole:false})),m=advanceTo(blocked,initialMotion(blocked),0,-4);assert.ok(m.feet+blocked.height<=2.801);assert.ok(m.position.z>-.5);
 const w=world(stairProject({upper:false})),top=advanceTo(w,initialMotion(w),0,-4);assert.ok(top.position.z>=-3+w.radius-.001);assert.ok(top.feet>2.7);assert.ok(top.grounded);
 const side=advanceTo(w,top,3,top.position.z);assert.ok(side.position.x<=.6-w.radius+.001);assert.ok(side.grounded);
});
test('nearby furniture cannot be climbed automatically and stair headroom respects crouching',()=>{
 const p=person({x:0,y:1}),w=world(project({furniture:[p,{id:'box',kind:'nightstand',x:0,y:0,width:1.2,depth:1,height:.15,rotation:0}]},p));
 const stop=advanceTo(w,initialMotion(w),0,-1);close(stop.feet,0);assert.ok(stop.position.z>=.5+w.radius-.001);
 const b=stairProject({hole:false}),low=world(b),standing=advanceTo(low,initialMotion(low),0,-4),crouched=advanceTo(low,toggleCrouch(low,initialMotion(low)),0,-4);
 assert.ok(crouched.feet>standing.feet+.3);assert.ok(crouched.feet+bodyHeight(low,crouched)<=2.801);
});
test('jumping and resetting on stairs preserve support without passing the upper slab',()=>{
 const b=stairProject(),w=world(b);let m=advanceTo(w,initialMotion(w),0,1);const feet=m.feet;
 m=jump(m);for(let n=0;n<70;n++)m=advanceWalk(w,m,0,0,.02).motion;close(m.feet,feet);assert.ok(m.grounded);
 const h=harness([],false,w);h.tick(0);h.controller.input('forward',true);for(let n=1;n<130;n++)h.tick(n*50);assert.ok(h.avatar.root.position.y>1);h.controller.reset();close(h.avatar.root.position.y,0);close(h.avatar.root.position.z,4);h.controller.dispose();
});
const groupsUrl=await moduleUrl('./groups.ts',{'./model':modelUrl});
const {staircasePieces}=await import(await moduleUrl('./stairs.ts',{'./model':modelUrl,'./groups':groupsUrl}));
test('L and U flights join through their landings, including mirrored and rotated layouts',()=>{
 for(const shape of ['L','U'])for(const side of ['left','right'])for(const rotation of [0,90,180,270]){
  const pieces=staircasePieces({shape,side,rotation,width:1.2,firstLength:3,secondLength:3,landingDepth:1.4,gap:.4,rise:3},{x:0,y:0});
  const [first,landing,last]=pieces,point=(item,d)=>({x:item.x-d*Math.sin(item.rotation*Math.PI/180),y:item.y+d*Math.cos(item.rotation*Math.PI/180)}),start=point(first,first.depth/2+.6),end=point(last,-last.depth/2+.35);
  const p=person({...start}),w=world(project({furniture:[p,...pieces]},p));let m=initialMotion(w);
  const onLanding=point(first,-first.depth/2-landing.depth/2);
  m=advanceTo(w,m,onLanding.x,onLanding.y);assert.ok(Math.abs(m.feet-1.5)<.001,JSON.stringify({shape,side,rotation,m}));
  const lastStart=point(last,last.depth/2+.5);m=advanceTo(w,m,lastStart.x,lastStart.y);m=advanceTo(w,m,end.x,end.y);assert.ok(m.feet>=2.8,JSON.stringify({shape,side,rotation,m}));
  m=advanceTo(w,m,lastStart.x,lastStart.y);m=advanceTo(w,m,onLanding.x,onLanding.y);m=advanceTo(w,m,start.x,start.y);close(m.feet,0);assert.ok(Math.hypot(m.position.x-start.x,m.position.z-start.y)<.01);
 }
});

const climbTable=(extra={})=>({id:'table',kind:'table',x:0,y:0,width:1.6,depth:1.2,rotation:0,height:.75,...extra});
function climbProject(item=climbTable(),extra={}){const p=person({x:0,y:-1.1,rotation:0});return project({furniture:[p,item],...extra},p);}
test('climbing a low tabletop validates the entire path and leaves the saved building unchanged',()=>{
 const b=climbProject(),before=JSON.stringify(b),w=world(b),start=initialMotion(w),action=findClimbAction(w,start,0);assert.ok(action);assert.equal(action.kind,'up');
 for(let i=0;i<=100;i++){const m=climbMotion(action,action.duration*i/100);assert.ok(w.isClear(m.position,{base:m.feet,height:w.height}),i);assert.ok(m.feet>=0&&m.feet<=.771);}
 const finish=climbMotion(action,action.duration);close(finish.feet,.75);assert.ok(finish.grounded);assert.ok(containsClimbSurface(w.climbSurfaces[0],finish.position,w.radius));assert.ok(finish.platform);assert.equal(JSON.stringify(b),before);
 const down=findClimbAction(w,finish,0);assert.equal(down.kind,'down');const landed=climbMotion(down,down.duration);close(landed.feet,0);assert.ok(landed.grounded);assert.equal(landed.platform,undefined);assert.ok(w.canOccupy(landed.position));
});
test('contextual climb requires facing, proximity, standing posture and reachable height',()=>{
 const w=world(climbProject()),m=initialMotion(w);assert.equal(findClimbAction(w,m,Math.PI),null);assert.equal(findClimbAction(w,{...m,position:{x:0,z:-3}},0),null);
 assert.equal(findClimbAction(w,toggleCrouch(w,m),0),null);assert.equal(findClimbAction(w,jump(m),0),null);
 assert.equal(findClimbAction(world(climbProject(climbTable({height:1.1}))),m,0),null);
 const child=climbProject();child.floors[0].plan.furniture[0].height=.5;const small=world(child);assert.equal(findClimbAction(small,initialMotion(small),0),null);
});
test('small, curved or unsupported objects do not offer an invalid foothold',()=>{
 for(const item of [climbTable({width:.4}),climbTable({kind:'tree'}),climbTable({kind:'chair'}),climbTable({kind:'bathtub'}),climbTable({kind:'sofa'})]){const w=world(climbProject(item));assert.equal(findClimbAction(w,initialMotion(w),0),null,item.kind);}
 const w=world(climbProject(climbTable({kind:'roundCoffeeTable',width:1.2,depth:1.2,height:.42}))),action=findClimbAction(w,initialMotion(w),0);assert.ok(action);assert.ok(containsClimbSurface(w.climbSurfaces[0],action.to.position,w.radius));
 assert.equal(containsClimbSurface(w.climbSurfaces[0],{x:.4,z:.4},w.radius),false);
});
test('walls and low ceilings along the transfer block climbing even when the destination is clear',()=>{
 const wallBlock={...wall,a:{x:-2,y:-.75},b:{x:2,y:-.75},height:3};
 const roof={id:'roof',name:'Techo bajo',points:rectangle(-.5,-1.5,1,.5),roof:{height:2.1,thickness:.1}};
 for(const extra of [{walls:[wallBlock]},{surfaces:[roof]}]){const w=world(climbProject(climbTable(),extra)),m=initialMotion(w);assert.ok(w.canOccupy(m.position));assert.ok(w.isClear({x:0,z:-.305},{base:.75,height:w.height}));assert.equal(findClimbAction(w,m,0),null);}
});
test('rotated tabletops and second-floor elevations produce matching safe landings',()=>{
 for(const rotation of [30,90,180,270]){
  const a=rotation*Math.PI/180,b=climbProject(climbTable({rotation}));Object.assign(b.floors[0].plan.furniture[0],{x:1.1*Math.sin(a),y:-1.1*Math.cos(a),rotation});
  const w=world(b),action=findClimbAction(w,initialMotion(w),a);assert.ok(action,rotation);close(action.to.feet,.75);assert.ok(containsClimbSurface(w.climbSurfaces[0],action.to.position,w.radius));
 }
 let b=climbProject(climbTable(),{surfaces:[{id:'floor',name:'Piso',points:rectangle(-3,-3,6,6),slab:{thickness:.2}}]});b=addFloor(b,'Alta','copy');const w=world(b,1),action=findClimbAction(w,initialMotion(w),0);assert.ok(action);close(action.to.feet,w.base+.75);const down=findClimbAction(w,action.to,0);assert.ok(down);close(down.to.feet,w.base);
});
test('climbed objects retain a full footprint and require a safe descent instead of falling off',()=>{
 const w=world(climbProject()),action=findClimbAction(w,initialMotion(w),0);let m=action.to;
 for(let i=0;i<70;i++)m=advanceWalk(w,m,.05,0,.025).motion;
 assert.ok(containsClimbSurface(w.climbSurfaces[0],m.position,w.radius));close(m.feet,.75);assert.ok(m.grounded);
 m=jump(m);for(let i=0;i<70;i++)m=advanceWalk(w,m,.05,0,.025).motion;assert.ok(containsClimbSurface(w.climbSurfaces[0],m.position,w.radius));close(m.feet,.75);
});
test('descent cannot land in slab holes or outside an upper floor',()=>{
 const b=climbProject(climbTable(),{surfaces:[{id:'floor',name:'Piso',points:rectangle(-3,-3,6,6),slab:{thickness:.2},holes:[{id:'hole',name:'Patio',target:'slab',points:rectangle(-2,-2,4,4)}]}]}),w=world(b);
 const onTop={...initialMotion(w),position:{x:0,z:0},feet:.75,navigation:.75,platform:w.climbSurfaces[0].key};assert.equal(findClimbAction(w,onTop,0),null);
 const above=addFloor(climbProject(),'Alta','copy'),upper=world(above,1),onUpper={...initialMotion(upper),position:{x:0,z:0},feet:upper.base+.75,navigation:upper.base+.75,platform:upper.climbSurfaces[0].key};assert.equal(findClimbAction(upper,onUpper,0),null);
});
test('keyboard E and touch actions animate without double triggering or changing the spawn',()=>{
 const w=world(climbProject()),h=harness([],false,w);h.tick(0);assert.equal(h.reports.at(-1).climb.kind,'up');h.canvas.fire('keydown',{code:'KeyE'});assert.ok(h.reports.at(-1).climb.active);
 h.canvas.fire('keydown',{code:'KeyE',repeat:true});h.controller.input('forward',true);h.controller.act('jump');h.controller.act('crouch');
 for(let i=1;i<=30;i++)h.tick(i*50);close(h.avatar.root.position.y,.75);assert.equal(h.reports.at(-1).climb.kind,'down');assert.ok(!h.reports.at(-1).climb.active);assert.ok(!h.reports.at(-1).crouched);
 h.controller.act('climb');for(let i=31;i<=60;i++)h.tick(i*50);close(h.avatar.root.position.y,0);h.controller.reset();close(h.avatar.root.position.z,-1.1);assert.equal(h.reports.at(-1).distance,0);h.controller.dispose();
});
test('blur, camera changes and disposal interrupt transfers at their original safe position',()=>{
 for(const cancel of [h=>h.win.fire('blur'),h=>h.doc.fire('visibilitychange'),h=>h.controller.setMode('first')]){
  const h=harness([],false,world(climbProject()));h.tick(0);h.controller.act('climb');for(let i=1;i<=13;i++)h.tick(i*50);assert.ok(h.avatar.root.position.y>0);cancel(h);close(h.avatar.root.position.y,0);close(h.avatar.root.position.z,-1.1);assert.ok(!h.reports.at(-1).climb.active);assert.equal(h.reports.at(-1).distance,0);h.controller.dispose();assert.equal(h.queued,false);
 }
 const h=harness([],false,world(climbProject()));h.tick(0);h.controller.act('climb');h.tick(10000);assert.ok(h.reports.at(-1).climb.active);h.controller.dispose();assert.equal(h.queued,false);assert.equal(h.canvas.count()+h.win.count()+h.doc.count(),0);
});

test('explicit object selection removes facing requirements but preserves reach and collision checks',()=>{
 const w=world(climbProject()),m=initialMotion(w),target={key:w.climbSurfaces[0].key,name:'Mesa',kind:'table'};
 assert.equal(findClimbAction(w,m,Math.PI),null);assert.ok(selectedClimb(w,m,Math.PI,target).action);
 assert.match(selectedClimb(w,{...m,position:{x:0,z:-4}},0,target).reason,/Acercate/);
 const blocked=world(climbProject(climbTable(),{walls:[{...wall,a:{x:-2,y:-.75},b:{x:2,y:-.75},height:3}]}));
 assert.equal(selectedClimb(blocked,initialMotion(blocked),0,{...target,key:blocked.climbSurfaces[0].key}).action,null);
});
test('selected objects explain small surfaces, height, posture and unavailable vehicles',()=>{
 for(const [item,reason] of [[climbTable({kind:'nightstand',width:.5,depth:.4,height:.55}),/pequeña/],[climbTable({height:1.2}),/altura máxima/]]){
  const w=world(climbProject(item));assert.match(selectedClimb(w,initialMotion(w),0,{key:w.climbSurfaces[0].key,name:'Objeto',kind:item.kind}).reason,reason);
 }
 const w=world(climbProject()),target={key:w.climbSurfaces[0].key,name:'Mesa',kind:'table'};
 assert.match(selectedClimb(w,toggleCrouch(w,initialMotion(w)),0,target).reason,/Levantate/);
 assert.match(selectedClimb(w,initialMotion(w),0,{key:'car',name:'Auto',kind:'smallCar'}).reason,/vehículos/);
});
test('selected target never falls back to another nearby furniture action and updates after moving',()=>{
 const w=world(climbProject()),h=harness([],false,w),target={key:w.climbSurfaces[0].key,name:'Mesa',kind:'table'};
 h.controller.selectTarget({key:'car',name:'Auto',kind:'smallCar'});assert.equal(h.reports.at(-1).climb,null);h.controller.act('climb');assert.equal(h.reports.at(-1).climb,null);
 h.controller.look(Math.PI,0);h.controller.selectTarget(target);assert.equal(h.reports.at(-1).climb.kind,'up');assert.equal(h.reports.at(-1).interaction.name,'Mesa');
 h.controller.act('climb');h.controller.selectTarget(null);assert.equal(h.reports.at(-1).interaction.name,'Mesa');
 h.win.fire('blur');close(h.avatar.root.position.y,0);assert.equal(h.reports.at(-1).climb.active,false);
 h.controller.act('clearSelection');assert.equal(h.reports.at(-1).interaction,null);assert.equal(h.reports.at(-1).climb.kind,'up');
 h.controller.selectTarget(target);h.controller.reset();assert.equal(h.reports.at(-1).interaction,null);h.controller.dispose();
});

test('selected object feedback changes from too far to an available action while approaching',()=>{
 const b=climbProject();b.floors[0].plan.furniture[0].y=-2.5;
 const w=world(b),before=JSON.stringify(b),h=harness([],false,w);
 h.controller.selectTarget({key:w.climbSurfaces[0].key,name:'Mesa',kind:'table'});
 assert.match(h.reports.at(-1).interaction.reason,/Acercate/);assert.equal(h.reports.at(-1).climb,null);
 h.tick(0);h.controller.input('forward',true);for(let i=1;i<=20;i++)h.tick(i*50);h.controller.input('forward',false);h.tick(1100);
 assert.equal(h.reports.at(-1).interaction.reason,'');assert.equal(h.reports.at(-1).climb.kind,'up');
 assert.equal(JSON.stringify(b),before);h.controller.dispose();
});

const carItem=(extra={})=>({id:'car',kind:'smallCar',x:0,y:0,width:1.7,depth:3.8,rotation:0,...extra});
function carProject(extra={},car=carItem()){const p=person({x:-1.45,y:0,rotation:270});return project({furniture:[p,car],...extra},p);}
const carIn=w=>vehicleCandidate(w,JSON.stringify([w.model[0].id,'car']));
test('car entry requires a nearby side door, upright person, ground floor and no intervening wall',()=>{
 const w=world(carProject()),car=carIn(w),m=initialMotion(w);assert.equal(vehicleEntryReason(w,m,car),'');
 assert.match(vehicleEntryReason(w,{...m,position:{x:0,z:-3}},car),/laterales/);
 assert.match(vehicleEntryReason(w,{...m,crouched:true},car),/de pie/);
 assert.match(vehicleEntryReason(w,{...m,feet:3},car),/planta baja/);
 assert.match(vehicleEntryReason(w,m,{...car,floorId:'upper'}),/planta baja/);
 assert.match(vehicleEntryReason(w,m,{...car,item:{...car.item,kind:'pickup'}}),/auto chico/);
 const blocked=world(carProject({walls:[{...wall,a:{x:-1.2,y:-2},b:{x:-1.2,y:2},thickness:.05}]}));assert.notEqual(vehicleEntryReason(blocked,initialMotion(blocked),carIn(blocked)),'');
});
test('car acceleration, steering, reversing and braking stay bounded and independent of frame rate',()=>{
 const w=world(carProject());let results=[];
 for(const rate of [30,60,120]){let car=carIn(w);for(let i=0;i<rate*2;i++)car=advanceVehicle(w,car,1,0,false,1/rate).car;results.push(car);assert.ok(car.speed<=4&&car.position.z<-4);}
 assert.ok(Math.abs(results[0].position.z-results[2].position.z)<.03);
 let car=results[0];for(let i=0;i<100;i++)car=advanceVehicle(w,car,-1,1,false,.05).car;assert.ok(car.speed<0&&car.speed>=-2);assert.ok(Math.abs(car.yaw)>.1);
 for(let i=0;i<20;i++)car=advanceVehicle(w,car,1,0,true,.05).car;close(car.speed,0);
 const paused=advanceVehicle(w,car,1,0,false,100);assert.ok(paused.distance<.02);
});
test('full car footprint blocks thin walls, furniture, low roofs, stairs and small slab holes',()=>{
 const wallAhead={...wall,a:{x:-5,y:-3},b:{x:5,y:-3},thickness:.05};
 const w=world(carProject({walls:[wallAhead]}));let car=carIn(w);for(let i=0;i<200;i++)car=advanceVehicle(w,car,1,0,false,.05).car;assert.ok(car.position.z>-1.1);close(car.speed,0);
 const fixtures=[{furniture:[person({x:-1.45,y:0}),carItem(),{...climbTable({x:0,y:-3})}]},{surfaces:[{id:'roof',name:'Techo',points:rectangle(-2,-4,4,8),roof:{height:1.2,thickness:.1}}]},{surfaces:[{id:'floor',name:'Piso',points:rectangle(-5,-5,10,10),slab:{thickness:.2},holes:[{id:'hole',name:'Hueco',target:'slab',points:rectangle(.1,.1,.1,.1)}]}]},{furniture:[person({x:-1.45,y:0}),carItem(),{id:'stair',kind:'stairs',x:0,y:0,width:1,depth:3,height:1,rotation:0}]}];
 for(const extra of fixtures){const bad=world(carProject(extra));assert.equal(bad.vehicleClear(carIn(bad).key,{x:0,z:extra.furniture?.some(i=>i.kind==='table')?-1:0},0,1.7,3.8,1.45),false);}
 const side=world(carProject({walls:[{...wall,a:{x:1.1,y:-5},b:{x:1.1,y:5},thickness:.05}]}));assert.ok(side.vehicleClear(carIn(side).key,{x:0,z:0},0,1.7,3.8,1.45));assert.equal(side.vehicleClear(carIn(side).key,{x:0,z:0},Math.PI/4,1.7,3.8,1.45),false);
});
test('car exits choose an open side and refuse both blocked doors or a moving vehicle',()=>{
 const left={...wall,a:{x:-1.25,y:-3},b:{x:-1.25,y:3},thickness:.05},right={...left,id:'right',a:{x:1.25,y:-3},b:{x:1.25,y:3}};
 const w=world(carProject({walls:[left]})),car=carIn(w);assert.ok(vehicleExit(w,car).x>0);assert.equal(vehicleExit(w,{...car,speed:1}),null);
 const blocked=world(carProject({walls:[left,right]}));assert.equal(vehicleExit(blocked,carIn(blocked)),null);
});
test('E enters, keyboard drives and brakes, focus loss stops, exit uses moved collision geometry, reset restores',()=>{
 const b=carProject(),before=JSON.stringify(b),w=world(b),changes=[],h=harness([],false,w,c=>changes.push(c));
 h.controller.selectTarget({key:carIn(w).key,name:'Auto chico',kind:'smallCar'});assert.ok(h.reports.at(-1).vehicle.canEnter);
 h.canvas.fire('keydown',{code:'KeyE'});assert.ok(h.reports.at(-1).vehicle.active);assert.equal(h.avatar.root.visible,false);
 h.tick(0);h.canvas.fire('keydown',{code:'KeyW'});for(let i=1;i<=40;i++)h.tick(i*50);assert.ok(changes.at(-1).item.y<-4);assert.ok(h.reports.at(-1).vehicle.speed>0);
 h.controller.act('climb');assert.ok(h.reports.at(-1).vehicle.active);h.canvas.fire('keydown',{code:'Space'});for(let i=41;i<=55;i++)h.tick(i*50);close(h.reports.at(-1).vehicle.speed,0);
 h.win.fire('blur');h.controller.act('climb');assert.ok(!h.reports.at(-1).vehicle?.active);assert.ok(h.avatar.root.visible);assert.ok(h.avatar.root.position.z<-4);close(h.avatar.root.position.y,0);
 h.controller.reset();assert.deepEqual(changes.at(-1).item,carItem());close(h.avatar.root.position.x,-1.45);assert.equal(JSON.stringify(b),before);h.controller.dispose();assert.equal(h.queued,false);
});
test('touch driving stops on blur and disposal restores the saved vehicle',()=>{
 const w=world(carProject()),changes=[],h=harness([],false,w,c=>changes.push(c));h.controller.selectTarget({key:carIn(w).key,name:'Auto',kind:'smallCar'});h.controller.act('climb');h.tick(0);h.controller.input('forward',true);h.controller.input('right',true);for(let i=1;i<=20;i++)h.tick(i*50);
 assert.ok(changes.at(-1).item.rotation>0);h.win.fire('blur');close(h.reports.at(-1).vehicle.speed,0);const stop=JSON.stringify(changes.at(-1));h.tick(1050);h.tick(1100);assert.equal(JSON.stringify(changes.at(-1)),stop);h.controller.dispose();assert.deepEqual(changes.at(-1).item,carItem());assert.equal(h.canvas.count()+h.win.count()+h.doc.count(),0);
});
