import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const modelUrl=url(compile(await readFile(new URL('./model.ts',import.meta.url),'utf8')));
const {buildingFromPlan,emptyPlan,addFloor}=await import(modelUrl);
const apiUrl=url(compile(await readFile(new URL('./driveApi.ts',import.meta.url),'utf8')).replace("'./model'",JSON.stringify(modelUrl)));
const {DriveApi,DriveError,DRIVE_LIMIT,driveFilename}=await import(apiUrl);
const file=(version='1',extra={})=>({id:'file-123',name:'Casa.trazocasa',version,mimeType:'application/json',size:'200',capabilities:{canEdit:true,canDownload:true},...extra});
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
function harness(responses){const calls=[];const transport=async(url,init)=>{calls.push({url,init});const next=responses.shift();if(next instanceof Error)throw next;if(!next)throw Error('Unexpected request');return typeof next==='function'?next(url,init):next;};return {api:new DriveApi(()=>'test-only-token',transport),calls};}
const building=()=>addFloor(buildingFromPlan(emptyPlan()),'Planta alta','blank');
test('Drive reads and validates all floors between consistent version reads',async()=>{
 const b=building();const {api,calls}=harness([json(file()),json(b),json(file())]);const result=await api.open('file-123');
 assert.deepEqual(result.building,b);assert.equal(result.file.version,'1');assert.equal(calls.length,3);assert.ok(calls[1].url.includes('alt=media'));
 assert.equal(calls[0].init.headers.Authorization,'Bearer test-only-token');assert.equal(calls[0].init.cache,'no-store');
});
test('Drive refuses torn downloads, oversized files and invalid projects',async()=>{
 const b=building();await assert.rejects(harness([json(file()),json(b),json(file('2'))]).api.open('file-123'),e=>e.code==='conflict');
 const large=harness([json(file('1',{size:String(DRIVE_LIMIT+1)}))]);await assert.rejects(large.api.open('file-123'),/20 MB/);assert.equal(large.calls.length,1);
 await assert.rejects(harness([json(file()),json({hello:'world'})]).api.open('file-123'),/válido/);
 await assert.rejects(harness([json(file('1',{mimeType:'application/vnd.google-apps.document'}))]).api.open('file-123'),/documento/);
});
test('Drive rejects stream size overflow even if metadata claims a small file',async()=>{
 const response=new Response(new Uint8Array(DRIVE_LIMIT+1));
 await assert.rejects(harness([json(file()),response]).api.open('file-123'),/20 MB/);
});
test('new Drive file uploads complete validated project via a resumable session',async()=>{
 const b=building();b.name='Casa ñ';const {api,calls}=harness([new Response(null,{status:200,headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'}}),json(file('4'))]);
 const result=await api.save(b);assert.equal(calls[0].init.method,'POST');assert.equal(calls[1].init.method,'PUT');
 assert.equal(JSON.parse(calls[0].init.body).name,'Casa ñ.trazocasa');assert.deepEqual(JSON.parse(await calls[1].init.body.text()),b);
 assert.equal(result.snapshot,JSON.stringify(b));assert.equal(result.file.version,'4');
});
test('Drive update compares the remembered version before any write',async()=>{
 const conflict=harness([json(file('2'))]);await assert.rejects(conflict.api.save(building(),file('1')),e=>e.code==='conflict');assert.equal(conflict.calls.length,1);
 const ok=harness([json(file('1')),new Response(null,{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files/file-123?upload_id=test'}}),json(file('2'))]);
 await ok.api.save(building(),file('1'));assert.equal(ok.calls[1].init.method,'PATCH');assert.ok(ok.calls[1].url.includes('/file-123?'));
});
test('read-only or deleted remote files cannot be overwritten',async()=>{
 for(const extra of [{capabilities:{canEdit:false}},{trashed:true}]){const h=harness([json(file('1',extra))]);await assert.rejects(h.api.save(building(),file()));assert.equal(h.calls.length,1);}
 const h=harness([json(file('1',{capabilities:{canEdit:false,canDownload:true}})),json(building()),json(file('1',{capabilities:{canEdit:false,canDownload:true}}))]);assert.equal((await h.api.open('file-123')).file.capabilities.canEdit,false);
});
test('Drive auth, missing files and connection errors never report a save',async()=>{
 await assert.rejects(harness([json({},401)]).api.open('file-123'),e=>e.code==='auth');
 await assert.rejects(harness([json({},404)]).api.open('file-123'),/acceso/);
 await assert.rejects(harness([new Error('offline')]).api.save(building()),e=>e.code==='network');
 await assert.rejects(harness([new Response(null,{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'}}),new Error('offline')]).api.save(building()),e=>e.code==='network');
});
test('Drive refuses unknown upload destinations and invalid version metadata',async()=>{
 const h=harness([new Response(null,{headers:{Location:'https://example.org/steal'}})]);await assert.rejects(h.api.save(building()),/inesperado/);assert.equal(h.calls.length,1);
 await assert.rejects(harness([json(file(null))]).api.open('file-123'),/versión/);
 await assert.rejects(harness([]).api.open('../other'),/identificador/);
 assert.equal(driveFilename('Casa / Norte?'),'Casa  Norte.trazocasa');
});

// OAuth and Picker contracts are exercised without contacting Google or using real credentials.
let sdkFetch=async()=>{throw Error('Unexpected SDK network request');};
const originalFetch=globalThis.fetch;
globalThis.fetch=(...args)=>sdkFetch(...args);
let sdkSource=compile(await readFile(new URL('./googleDrive.ts',import.meta.url),'utf8')).replace("'./driveApi'",JSON.stringify(apiUrl));
sdkSource=sdkSource.replaceAll('import.meta.env.VITE_GOOGLE_CLIENT_ID',JSON.stringify('test-client.apps.googleusercontent.com')).replaceAll('import.meta.env.VITE_GOOGLE_API_KEY',JSON.stringify('test-public-key')).replaceAll('import.meta.env.VITE_GOOGLE_APP_ID',JSON.stringify('123456'));
const googleDrive=await import(url(sdkSource));globalThis.fetch=originalFetch;
function sdkWindow(t,response={access_token:'test-only-token',expires_in:3600,scope:googleDrive.DRIVE_SCOPE},popupError=false){
 const previous=globalThis.window;let requested=false,config;
 globalThis.window={google:{accounts:{oauth2:{initTokenClient(options){config=options;return {requestAccessToken(){requested=true;queueMicrotask(()=>popupError?options.error_callback():options.callback(response));}};},hasGrantedAllScopes(r,scope){return r.scope===scope;}}}}};
 sdkFetch=async()=>json({user:{permissionId:'account-A',emailAddress:'test@example.invalid'}});
 googleDrive.disconnectDrive();t.after(()=>{googleDrive.disconnectDrive();globalThis.window=previous;});
 return {requested:()=>requested,config:()=>config};
}
test('Google authorization starts directly on the click and requests only drive.file',async t=>{
 const fake=sdkWindow(t);const promise=googleDrive.connectDrive();assert.equal(fake.requested(),true);
 const account=await promise;assert.equal(account.id,'account-A');assert.equal(fake.config().scope,'https://www.googleapis.com/auth/drive.file');assert.equal(fake.config().include_granted_scopes,false);
 assert.equal(googleDrive.driveToken(),'test-only-token');googleDrive.disconnectDrive();assert.equal(googleDrive.driveAccount(),null);assert.throws(()=>googleDrive.driveToken(),e=>e.code==='auth');
});
test('Google denied consent and popup cancellation settle without establishing a session',async t=>{
 sdkWindow(t,{error:'access_denied'});await assert.rejects(googleDrive.connectDrive(),/autorizó/);assert.equal(googleDrive.driveAccount(),null);
 globalThis.window.google.accounts.oauth2.initTokenClient=options=>({requestAccessToken:()=>options.error_callback()});await assert.rejects(googleDrive.connectDrive(),/ventana/);
});
test('Google expired sessions cannot be used to read or upload files',async t=>{
 sdkWindow(t,{access_token:'test-only-token',expires_in:60,scope:googleDrive.DRIVE_SCOPE});await googleDrive.connectDrive();
 const now=Date.now;Date.now=()=>now()+31_000;try{assert.equal(googleDrive.driveAccount(),null);assert.throws(()=>googleDrive.driveToken(),e=>e.code==='auth');}finally{Date.now=now;}
});
test('Picker cancellation and selection resolve once using the authorized account',async t=>{
 sdkWindow(t);await googleDrive.connectDrive();let event={action:'cancel'},built;
 class View{setMode(){return this;}setIncludeFolders(){return this;}}
 class Builder{setDeveloperKey(){return this;}setAppId(id){this.appId=id;return this;}setOAuthToken(token){this.token=token;return this;}setOrigin(){return this;}setLocale(){return this;}setTitle(){return this;}setSize(){return this;}addView(){return this;}setCallback(cb){this.callback=cb;return this;}build(){built=this;return {setVisible:visible=>{if(visible)queueMicrotask(()=>this.callback(event));}};}}
 Object.assign(globalThis.window,{innerWidth:390,innerHeight:844,location:{origin:'https://example.invalid'}});
 globalThis.window.google.picker={DocsView:View,DocsViewMode:{LIST:'list'},PickerBuilder:Builder,Action:{PICKED:'picked',CANCEL:'cancel'}};
 assert.equal(await googleDrive.pickDriveFile(),null);event={action:'picked',docs:[{id:'chosen-file'}]};assert.equal(await googleDrive.pickDriveFile(),'chosen-file');assert.equal(built.appId,'123456');assert.equal(built.token,'test-only-token');
});
