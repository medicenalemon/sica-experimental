import {assertReceiptSnapshotContinuity} from '@/domain/receipt-print'
import {previewTaxCertificate as localTaxCertificatePreview} from '@/domain/tax-certificates'
import {buildFiscalRequest} from '@/domain/fiscal'
import type {FiscalOptions,FiscalRequest} from '@/domain/fiscal'
import { useRef, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { State, Session } from '@/domain/types'
import type { Command } from '@/domain/commands'
import { executeCommand } from '@/domain/commands'
import { derivePassword } from '@/domain/auth'
import { initialState } from '@/domain/seed'
import { uid } from '@/domain/constants'
import { validateState } from '@/domain/validation'
import type {CompanyChoice} from './context'
import { Context } from './context'

const STORAGE='sica.data.v1',SESSION='sica.session.v1'
const COMPANY='sica.company.v1'
const remoteBase=String(import.meta.env.VITE_SICA_API_URL||'').replace(/\/$/,'')
const edgeRegion=String(import.meta.env.VITE_SICA_EDGE_REGION||'')
if(edgeRegion&&!/^[a-z]{2}-[a-z]+-\d$/.test(edgeRegion))throw new Error('VITE_SICA_EDGE_REGION no es una región válida.')
if(remoteBase){const url=new URL(remoteBase);if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('VITE_SICA_API_URL requiere una URL HTTPS válida.')}
const tokenKey=(company:string)=>`sica.remote-token.v1:${remoteBase}:${company}`
function remoteToken(company:string){if(!remoteBase)return '';try{return sessionStorage.getItem(tokenKey(company))||localStorage.getItem(tokenKey(company))||''}catch{return ''}}
function clearRemoteToken(company:string){if(!remoteBase)return;try{sessionStorage.removeItem(tokenKey(company));localStorage.removeItem(tokenKey(company))}catch{/* Token remains absent in memory. */}}
function saveRemoteToken(company:string,token:string,remember:boolean){clearRemoteToken(company);(remember?localStorage:sessionStorage).setItem(tokenKey(company),token)}
function savedCompany(){try{return sessionStorage.getItem(COMPANY)||''}catch{return ''}}
const mode=import.meta.env.VITE_SICA_MODE==='local'?'local':'server'
interface Snapshot {company:CompanyChoice;state:State;revision:number;session:Session;csrf:string;signedOut?:boolean}
class NetworkError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status}}
function readState():{data:State;error:string} {
 try{const raw=localStorage.getItem(STORAGE);if(!raw)return {data:initialState(),error:''};const data=JSON.parse(raw);validateState(data);return {data,error:''}}
 catch{return {data:initialState(),error:'No se pudo leer la base local. Se bloquearon los cambios para preservar los datos existentes. Exportá la copia de recuperación desde Configuración.'}}
}
function readSession():Session|null {try{return JSON.parse(sessionStorage.getItem(SESSION)||localStorage.getItem(SESSION)||'null')}catch{return null}}
export function StoreProvider({children}:{children:ReactNode}) {
 const [initial]=useState(()=>mode==='local'?readState():{data:initialState(),error:''})
 const [data,setData]=useState(initial.data),[error,setError]=useState(initial.error),[storedSession,setSession]=useState<Session|null>(()=>mode==='local'?readSession():null),[remoteSession,setRemote]=useState<Session|null>(null),[branch,setBranch]=useState('all'),[notice,notify]=useState(''),[ready,setReady]=useState(mode==='local'),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
 const [companies,setCompanies]=useState<CompanyChoice[]>([]),[companyId,setCompany]=useState(savedCompany)
 const companyRef=useRef(companyId)
 const epoch=useRef(0)
 const dataRef=useRef(data),revisionRef=useRef(0),csrfRef=useRef(''),pending=useRef(false),remoteRef=useRef<Session|null>(null)
 const currentUser=data.masters.users.find(u=>u.id===storedSession?.userId&&u.active)
 const session=mode==='server'?remoteSession:currentUser&&storedSession?{userId:currentUser.id,name:String(currentUser.name),role:currentUser.role as Session['role'],permissions:String(currentUser.permissions||'').split(',').map(p=>p.trim()).filter(Boolean)}:null
 function accept(snapshot:Snapshot) {if(snapshot.company.id!==companyRef.current)throw new NetworkError(409,'La respuesta pertenece a otra empresa. Volvé a ingresar.');if(snapshot.revision<revisionRef.current)return;dataRef.current=snapshot.state;revisionRef.current=snapshot.revision;setData(snapshot.state);setRevision(snapshot.revision);csrfRef.current=snapshot.csrf;remoteRef.current=snapshot.signedOut?null:snapshot.session;setRemote(remoteRef.current);setError('')}
 async function api<T>(path:string,input?:unknown,retry=false,companyOverride?:string):Promise<T> {
  const serialized=input===undefined?undefined:JSON.stringify(input),target=companyOverride??companyRef.current,base=target?`/api/company/${encodeURIComponent(target)}`:'/api',csrf=csrfRef.current,token=remoteToken(target)
  for(let attempt=0;attempt<(retry?2:1);attempt++) {
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000)
   try{const response=await fetch(`${remoteBase}${base}/${path}${remoteBase&&edgeRegion?'?forceFunctionRegion='+encodeURIComponent(edgeRegion):''}`,{method:input===undefined?'GET':'POST',credentials:remoteBase?'omit':'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-SICA-Client':'web',...(csrf?{'X-SICA-CSRF':csrf}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:serialized});const value=await response.json();if(!response.ok){if(response.status===401)clearRemoteToken(target);throw new NetworkError(response.status,String(value.error||'No se pudo completar la operación.'))}if(remoteBase&&path==='login'&&typeof value.token==='string'){saveRemoteToken(target,value.token,Boolean((input as {remember?:boolean})?.remember));delete value.token}if(path==='logout'||value.signedOut)clearRemoteToken(target);return value as T}
   catch(e){if(e instanceof NetworkError||attempt===(retry?1:0))throw e}
   finally{clearTimeout(timer)}
  }
  throw new Error('No se pudo contactar al servidor.')
 }
 function selectCompany(id:string){
  if(mode!=='server'||pending.current||remoteRef.current||!companies.some(c=>c.id===id))return false
  changeCompany(id);return true
 }
 function changeCompany(id:string){
  epoch.current++;companyRef.current=id;setCompany(id);try{sessionStorage.setItem(COMPANY,id)}catch{ /* The company can still be selected for this tab. */ }
  csrfRef.current='';remoteRef.current=null;setRemote(null);revisionRef.current=0;setRevision(0);setBranch('all');dataRef.current=initialState();setData(dataRef.current);setError('');notify('')
 }
 async function reload() {if(mode==='local'){const result=readState();dataRef.current=result.data;setData(result.data);setError(result.error);return}const generation=epoch.current;try{const snapshot=await api<Snapshot>('state');if(generation===epoch.current)accept(snapshot)}catch(e){if(generation!==epoch.current)return;if(e instanceof NetworkError&&e.status===401){setRemote(null);remoteRef.current=null;csrfRef.current=''}else setError('No se pudo actualizar la base del servidor. Los cambios requieren conexión.')}}
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>notify(''),6000);return()=>clearTimeout(timer)},[notice])
 useEffect(()=>{
  if(mode==='local'){const sync=(event:StorageEvent)=>{if(event.key===STORAGE){const result=readState();if(!result.error){dataRef.current=result.data;setData(result.data)}}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)}
  let active=true
  void (async()=>{
   const registry=await api<{defaultId:string;companies:CompanyChoice[]}>('companies',undefined,false,'')
   if(!active)return
   if(!registry.companies.some(c=>c.id===registry.defaultId))throw new Error('Configuración de empresas inválida.')
   const stored=companyRef.current,known=registry.companies.some(c=>c.id===stored)
   setCompanies(registry.companies);changeCompany(known?stored:registry.defaultId)
   if(stored&&!known){setError('La empresa seleccionada ya no está disponible. Elegí una empresa e ingresá nuevamente.');return}
   const generation=epoch.current,snapshot=await api<Snapshot>('session')
   if(active&&generation===epoch.current)accept(snapshot)
  })().catch(e=>{if(active&&!(e instanceof NetworkError&&e.status===401))setError('No se pudo conectar con la instalación compartida. Revisá el servidor y reintentá.')}).finally(()=>{if(active)setReady(true)})
  const timer=setInterval(()=>{if(active&&!pending.current&&remoteRef.current&&document.visibilityState==='visible')void reload()},15000)
  return()=>{active=false;clearInterval(timer)}
  // Bootstrap is tied to the configured transport; request functions read refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[])
 function commit(next:State){localStorage.setItem(STORAGE,JSON.stringify(next));dataRef.current=next;setData(next)}
 async function transact(_path:string,_action:string,_detail:string,command:Command) {
  if(pending.current){notify('Hay una operación en curso. Esperá a que termine.');return false}
  pending.current=true;setBusy(true)
  try{
   if(!ready||!session)throw new Error('Iniciá sesión para registrar operaciones.')
   if(mode==='server'){const snapshot=await api<Snapshot>('commands',{revision:revisionRef.current,requestId:uid(),command},true);accept(snapshot);notify('Operación guardada en el servidor.');return true}
   if(error)throw new Error(error)
   const latest=readState();if(latest.error)throw new Error(latest.error)
   if(JSON.stringify(latest.data)!==JSON.stringify(dataRef.current)&&localStorage.getItem(STORAGE)){dataRef.current=latest.data;setData(latest.data);throw new Error('Los datos cambiaron en otra pestaña. Revisá y repetí la operación.')}
   const original=JSON.stringify(dataRef.current),next=structuredClone(dataRef.current),meta=await executeCommand(next,session,command);if(localStorage.getItem(STORAGE)&&JSON.stringify(readState().data)!==original){await reload();throw new Error('Los datos cambiaron en otra pestaña. Revisá y repetí la operación.')}validateState(next);next.audit.push({id:uid(),at:new Date().toISOString(),user:session.name,action:meta.action,detail:meta.detail});commit(next);notify(`${meta.action}: operación guardada.`);return true
  }catch(e){if(e instanceof NetworkError&&[401,409].includes(e.status))await reload();notify(`Error: ${e instanceof Error?e.message:'No se pudo guardar.'}`);return false}
  finally{pending.current=false;setBusy(false)}
 }
 async function login(username:string,password:string,remember:boolean,terminalName='Navegador') {
  if(mode==='server'){if(pending.current)return false;pending.current=true;setBusy(true);const generation=++epoch.current;try{const snapshot=await api<Snapshot>('login',{username,password,remember,terminalName});if(generation!==epoch.current)return false;revisionRef.current=0;setBranch('all');accept(snapshot);setReady(true);return true}catch(e){if(e instanceof NetworkError&&e.status===401)return false;throw e}finally{pending.current=false;setBusy(false)}}
  const user=dataRef.current.masters.users.find(u=>String(u.username).toLowerCase()===username.trim().toLowerCase()&&u.active);if(!user)return false
  const matches=user.passwordHash&&user.salt?await derivePassword(password,String(user.salt),Number(user.passwordIterations||150000))===user.passwordHash:user.id==='admin'&&password==='admin123';if(!matches)return false
  const next:Session={userId:user.id,name:String(user.name),role:user.role as Session['role'],permissions:String(user.permissions||'').split(',').filter(Boolean)};localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION);(remember?localStorage:sessionStorage).setItem(SESSION,JSON.stringify(next));setSession(next);return true
 }
 async function restore(value:unknown) {
  if(pending.current){notify('Hay una operación en curso.');return false}pending.current=true;setBusy(true)
  try{if(session?.role!=='Administrador General')throw new Error('La restauración requiere Administrador General.');validateState(value)
   if(mode==='server'){accept(await api<Snapshot>('restore',{revision:revisionRef.current,requestId:uid(),command:{state:value}},true));notify('Copia restaurada en el servidor; usuarios y recuperación preservados.');return true}
   assertReceiptSnapshotContinuity(dataRef.current,value)
   const previous=localStorage.getItem(STORAGE);if(previous)localStorage.setItem('sica.restore.previous',previous);const next=structuredClone(value);next.audit.push({id:uid(),at:new Date().toISOString(),user:session.name,action:'Restaurar copia de seguridad',detail:'Se preservó la base anterior como recuperación local.'});commit(next);setError('');notify('Copia restaurada.');return true
  }catch(e){if(e instanceof NetworkError&&[401,409].includes(e.status))await reload();notify(`Error: ${e instanceof Error?e.message:'No se pudo restaurar.'}`);return false}finally{pending.current=false;setBusy(false)}
 }
 async function logout(){if(pending.current){notify('Esperá a que termine la operación antes de cerrar sesión.');return false}if(mode==='server'){try{await api('logout',{})}catch(e){if(!(e instanceof NetworkError&&e.status===401)){notify('No se pudo cerrar la sesión del servidor. Reintentá al recuperar conexión.');return false}}epoch.current++;setRemote(null);remoteRef.current=null;csrfRef.current='';revisionRef.current=0;setRevision(0);dataRef.current=initialState();setData(dataRef.current)}else{localStorage.removeItem(SESSION);sessionStorage.removeItem(SESSION);localStorage.removeItem('sica_isAuthenticated');setSession(null)}return true}
 // api reads the current company and CSRF refs; keep this reader stable across polling snapshots.
 const fiscalConnection=useCallback(async():Promise<import('@/domain/fiscal').FiscalConnection>=>mode==='server'?api<import('@/domain/fiscal').FiscalConnection>('fiscal/status'):{configured:false,environment:'homologacion',productionEnabled:false},[])
 async function previewTaxCertificate(input:import('@/domain/tax-certificates').TaxCertificateInput){return mode==='server'?api<import('@/domain/tax-certificates').TaxCertificatePreview>('tax-certificates/preview',input):localTaxCertificatePreview(dataRef.current,input)}
 async function previewVatSales(input:import('@/domain/vat-sales').VatSalesInput){if(mode!=='server')throw new Error('La preparación de ventas requiere las fuentes fiscales conservadas en el servidor.');return api<import('@/domain/vat-sales').VatSalesPreview>('fiscal/vat-sales-preview',input)}
 async function previewFiscal(id:string,options:FiscalOptions,environment?:import('@/domain/fiscal').FiscalEnvironment){return mode==='server'?api<FiscalRequest>('fiscal/preview',{documentId:id,options,environment}):buildFiscalRequest(dataRef.current,id,options)}
 async function operateFiscal(id:string,options:FiscalOptions,action:'autorizar'|'consultar',reviewRevision?:number,environment?:import('@/domain/fiscal').FiscalEnvironment){
  if(mode!=='server'){notify('La autorización ARCA requiere el servidor.');return false}if(pending.current){notify('Esperá a que termine la operación en curso.');return false}
  pending.current=true;setBusy(true)
  try{accept(await api<Snapshot>('fiscal/operate',{documentId:id,revision:revisionRef.current,options,action,reviewRevision,environment},true));notify('Estado fiscal actualizado. Revisá el resultado del comprobante.');return true}catch(e){await reload();notify(`Error: ${e instanceof Error?e.message:'No se pudo consultar ARCA.'}`);return false}finally{pending.current=false;setBusy(false)}
 }
 async function activeSessions(){if(mode!=='server')throw new Error('La gestión de sesiones requiere el modo compartido.');return api<import('./context').ActiveSession[]>('sessions')}
 async function exportBackup(){return mode==='server'?api<State>('backup'):structuredClone(dataRef.current)}
 async function cloudBackup(){await api('server-backup',{});notify('Respaldo completo guardado en Supabase.')}
 async function recoveries(){return api<{id:number;revision:number;created:string;name:string;documents:number}[]>('recovery')}
 async function recoveryCopy(id:number){return api<State>(`recovery/${id}`)}
 function localCopy(){const raw=localStorage.getItem(STORAGE);if(!raw)throw new Error('No hay una base local para migrar.');const value=JSON.parse(raw);validateState(value);return value}
 return <Context.Provider value={{companies,companyId,selectCompany,data,session,branch,setBranch,error,notice,notify,transact,login,activeSessions,logout,restore,mode,ready,busy,revision,reload,exportBackup,cloudBackup:mode==='server'&&remoteBase?cloudBackup:null,localCopy,recoveries,recoveryCopy,previewTaxCertificate,previewVatSales,previewFiscal,operateFiscal,fiscalConnection}}>{children}</Context.Provider>
}
