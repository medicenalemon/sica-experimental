import {createHash,timingSafeEqual} from 'node:crypto'
import {createApplication} from './http.mjs'
import {handleFetch} from './fetch-adapter.mjs'
import {edgeStorage} from './edge-storage.mjs'

const equal=(left,right)=>timingSafeEqual(createHash('sha256').update(left).digest(),createHash('sha256').update(right).digest())
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
export function createEdgeHandler({databaseUrl,url,secretKeys,sslCa,prefix='/sica-api',createApp=createApplication,storage=edgeStorage({url,key:secretKeys[0]}),waitUntil}){
 let application,opening,configuration
 const configPath='configuration/sica.json'
 async function config(){if(configuration)return configuration;const bytes=await storage.get(configPath);if(!bytes)return null;configuration=JSON.parse(new TextDecoder().decode(bytes));return configuration}
 async function open(adminPassword){
  if(application)return application
  if(opening)return opening
  opening=(async()=>{
   const settings=await config()
   if(!settings&&!adminPassword)throw new Error('Instalación pendiente.')
   application=await createApp({backend:'postgres',databaseUrl,sslCa,poolSize:1,migrate:false,companyId:'sica',companyLabel:'SICA Experimental',adminPassword,auditKeyProvider:input=>storage.auditKey(input),fetchOnly:true,bearerSessions:true,origins:settings?.origins||[],arca:{mode:'disabled'},cloudBackup:repository=>storage.backup(repository)})
   return application
  })()
  try{return await opening}finally{opening=undefined}
 }
 return async request=>{
  const requestUrl=new URL(request.url)
  if(requestUrl.pathname.startsWith('/functions/v1/')){requestUrl.pathname=requestUrl.pathname.slice('/functions/v1'.length);request=new Request(requestUrl,request)}
  const path=new URL(request.url).pathname
  // Setup uses the server API key, never a publishable key or a user session.
  if(path===prefix+'/setup'){
   const supplied=request.headers.get('X-SICA-Setup-Key')||''
   if(request.method!=='POST'||!secretKeys.some(key=>equal(key,supplied)))return json({error:'Acceso no autorizado.'},401)
   try{
    if(await config())return json({error:'La instalación ya está configurada.'},409)
    const input=await request.json()
    if(typeof input.adminPassword!=='string'||input.adminPassword.length<12||input.adminPassword.length>1024||!Array.isArray(input.origins)||!input.origins.length||input.origins.length>20) return json({error:'Configuración inicial inválida.'},400)
    for(const origin of input.origins){const parsed=new URL(origin);if(parsed.origin!==origin||!(parsed.protocol==='https:'||parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname)))return json({error:'Origen inválido.'},400)}
    const app=await open(input.adminPassword)
    if(!await storage.put(configPath,JSON.stringify({origins:input.origins}),'application/json'))return json({error:'La instalación ya está configurada.'},409)
    configuration=undefined
    // Reopen with the persisted origin allowlist; no password is stored.
    await app.close();application=undefined
    return json({ok:true,companyId:'sica',username:'admin'})
   }catch(error){console.error('SICA setup:',error?.code||error?.name||'Error');let detail=String(error?.message||'Error');for(const value of [databaseUrl,...secretKeys])if(value)detail=detail.replaceAll(value,'[privado]');return json({error:'No se pudo inicializar SICA. Revisá conexión, TLS y Storage privado.',code:error?.code||error?.name,detail:detail.slice(0,500)},503)}
  }
  let settings
  try{settings=await config()}catch{return json({error:'No se pudo consultar la configuración privada.'},503)}
  const origin=request.headers.get('Origin'),allowed=Boolean(origin&&settings?.origins.includes(origin))
  const cors= response=>{if(allowed){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Expose-Headers','Content-Disposition')}return response}
  if(request.method==='OPTIONS'){
   if(!allowed)return json({error:'Origen no autorizado.'},403)
   return cors(new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-SICA-Client, X-SICA-CSRF','Access-Control-Max-Age':'600'}}))
  }
  if(origin&&!allowed)return json({error:'Origen no autorizado.'},403)
  if(!settings)return json({error:'Instalación pendiente de configuración.'},503)
  try{
   const app=await open()
   // Supabase's trusted gateway supplies the client address. Do not trust an
   // arbitrary forwarded-for chain when grouping login attempts.
   const response=await handleFetch(app,request,{prefix,remoteAddress:request.headers.get('x-real-ip')||'edge'})
   if(response.ok&&request.method==='POST'&&/\/(commands|restore)$/.test(path)){
    const backup=storage.backup(app.repository,{daily:true}).catch(()=>console.error('SICA: falló el respaldo diario privado; se reintentará en la próxima escritura.'))
    if(waitUntil)waitUntil(backup);else await backup
   }
   return cors(response)
  }catch(error){console.error('SICA request:',error?.code||error?.name||'Error');return cors(json({error:'No se pudo completar la operación en el servidor.'},503))}
 }
}
