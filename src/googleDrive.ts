import { DriveApi, DriveError } from './driveApi';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const driveConfig={clientId:import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()||'',apiKey:import.meta.env.VITE_GOOGLE_API_KEY?.trim()||'',appId:import.meta.env.VITE_GOOGLE_APP_ID?.trim()||''};
export const driveConfigured=!!driveConfig.clientId&&!!driveConfig.apiKey&&/^\d+$/.test(driveConfig.appId);
type TokenResponse={access_token?:string;expires_in?:number;scope?:string;error?:string};
type PickerView={setMode:(mode:string)=>PickerView;setIncludeFolders:(value:boolean)=>PickerView};
type Picker={setVisible:(visible:boolean)=>void};
type PickerBuilder={setDeveloperKey:(key:string)=>PickerBuilder;setAppId:(id:string)=>PickerBuilder;setOAuthToken:(token:string)=>PickerBuilder;setOrigin:(origin:string)=>PickerBuilder;setLocale:(locale:string)=>PickerBuilder;setTitle:(title:string)=>PickerBuilder;setSize:(w:number,h:number)=>PickerBuilder;addView:(view:PickerView)=>PickerBuilder;setCallback:(cb:(data:{action:string;docs?:{id?:string}[]})=>void)=>PickerBuilder;build:()=>Picker};
type GoogleSdk={accounts:{oauth2:{initTokenClient:(options:{client_id:string;scope:string;include_granted_scopes:boolean;callback:(r:TokenResponse)=>void;error_callback:()=>void})=>{requestAccessToken:(o:{prompt:string})=>void};hasGrantedAllScopes:(r:TokenResponse,scope:string)=>boolean}};picker:{DocsView:new()=>PickerView;DocsViewMode:{LIST:string};PickerBuilder:new()=>PickerBuilder;Action:{PICKED:string;CANCEL:string}}};
const sdk=()=> (window as unknown as {google:GoogleSdk}).google;
let session:{token:string;expires:number;account:{id:string;label:string}|null}|null=null;
export function driveAccount(){return session&&session.expires>Date.now()?session.account:null;}
export function disconnectDrive(){session=null;}
export function driveToken(){if(!session||session.expires<=Date.now())throw new DriveError('La conexión con Google venció. Volvé a conectar Drive.','auth');return session.token;}
export const driveApi=new DriveApi(driveToken);
let prepared:Promise<void>|null=null;
function loadScript(id:string,src:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const existing=document.getElementById(id) as HTMLScriptElement|null;
  if(existing?.dataset.ready==='true'){resolve();return;}
  const script=existing??document.createElement('script');script.id=id;script.src=src;script.async=true;
  const timer=setTimeout(fail,20_000);
  function fail(){clearTimeout(timer);script.remove();reject(new Error('No pudimos cargar Google. Revisá la conexión o los bloqueadores del navegador.'));}
  script.onload=()=>{clearTimeout(timer);script.dataset.ready='true';resolve();};script.onerror=fail;
  if(!existing)document.head.append(script);
 });
}
export function prepareDrive():Promise<void>{
 if(!driveConfigured)return Promise.reject(new Error('Google Drive todavía no está habilitado en este sitio.'));
 if(!prepared)prepared=Promise.all([loadScript('google-drive-identity','https://accounts.google.com/gsi/client'),loadScript('google-drive-picker','https://apis.google.com/js/api.js')]).then(()=>new Promise<void>((resolve,reject)=>{
  const gapi=(window as unknown as {gapi:{load:(name:string,options:{callback:()=>void;onerror:()=>void;timeout:number;ontimeout:()=>void})=>void}}).gapi;
  const failed=()=>reject(new Error('No pudimos cargar el selector de Drive. Intentá nuevamente.'));
  gapi.load('picker',{callback:resolve,onerror:failed,timeout:20_000,ontimeout:failed});
 })).catch(error=>{prepared=null;throw error;});
 return prepared;
}
/** Invoke directly from a click once prepareDrive has resolved, to preserve the popup gesture. */
export function connectDrive():Promise<{id:string;label:string}>{
 return new Promise<TokenResponse>((resolve,reject)=>{
  let settled=false;
  const timer=setTimeout(()=>finish(new Error('La conexión no se completó. Volvé a intentarlo.')),120_000);
  function finish(error?:Error,response?:TokenResponse){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(response!);}
  try{
   const client=sdk().accounts.oauth2.initTokenClient({client_id:driveConfig.clientId,scope:DRIVE_SCOPE,include_granted_scopes:false,
    callback:response=>{
     if(response.error||!response.access_token||!sdk().accounts.oauth2.hasGrantedAllScopes(response,DRIVE_SCOPE))finish(new Error('No se autorizó el acceso a los archivos de TrazoCasa. Podés seguir trabajando localmente.'));
     else finish(undefined,response);
    },error_callback:()=>finish(new Error('Se cerró o bloqueó la ventana de Google. Permití las ventanas emergentes e intentá nuevamente.'))});
   client.requestAccessToken({prompt:'select_account'});
  }catch{finish(new Error('Google no está listo. Cerrá este panel y volvé a abrirlo.'));}
 }).then(async response=>{
  const seconds=Number(response.expires_in);if(!Number.isFinite(seconds)||seconds<=30)throw new Error('Google no devolvió una sesión válida.');
  session={token:response.access_token!,expires:Date.now()+(seconds-30)*1000,account:null};
  try{const account=await driveApi.account();session.account=account;return account;}catch(error){disconnectDrive();throw error;}
 });
}
export function pickDriveFile():Promise<string|null>{
 const token=driveToken();
 return new Promise((resolve,reject)=>{
  try{
   const google=sdk();
   const view=new google.picker.DocsView().setMode(google.picker.DocsViewMode.LIST).setIncludeFolders(true);
   const picker=new google.picker.PickerBuilder().setDeveloperKey(driveConfig.apiKey).setAppId(driveConfig.appId).setOAuthToken(token).setOrigin(window.location.origin).setLocale('es').setTitle('Abrir proyecto TrazoCasa').setSize(Math.max(280,Math.min(900,window.innerWidth-24)),Math.max(350,Math.min(650,window.innerHeight-40))).addView(view).setCallback(data=>{
    if(data.action===google.picker.Action.CANCEL){picker.setVisible(false);resolve(null);}
    if(data.action===google.picker.Action.PICKED){picker.setVisible(false);const id=data.docs?.[0]?.id;if(id)resolve(id);else reject(new Error('No se seleccionó un archivo válido.'));}
   }).build();
   picker.setVisible(true);
  }catch(error){reject(error);}
 });
}
