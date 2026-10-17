import {createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {existsSync} from 'node:fs'
import {companyOptions} from './companies.mjs'
import { FiscalService } from './fiscal-service.mjs'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { Repository, ApiError } from './repository.mjs'

export async function createApplication(options={}) {
 const {companies,defaultId}=companyOptions(options),contexts=new Map(),origins=new Set(options.origins||['http://127.0.0.1:3001','http://localhost:3001','http://127.0.0.1:5174','http://localhost:5174']),secureCookie=Boolean(options.secureCookie),root=resolve(options.staticRoot||'dist')
 if(companies.length>1)for(const c of companies)if(existsSync(c.filename)){const db=new DatabaseSync(c.filename,{readOnly:true});try{if(db.prepare("SELECT name FROM sqlite_master WHERE name='companies'").get()){const ids=db.prepare('SELECT id FROM companies').all();if(ids.length&&(ids.length!==1||ids[0].id!==c.id))throw new Error('La instalación multiempresa requiere un archivo exclusivo por empresa. Separá las bases antes de habilitar el selector.')}}finally{db.close()}}
 try{for(const c of companies){const repository=await Repository.open(c);try{if(companies.length>1&&repository.db.prepare('SELECT COUNT(*) AS count FROM companies').get().count!==1)throw new Error('La instalación multiempresa requiere un archivo exclusivo por empresa. Separá las bases antes de habilitar el selector.');const fiscal=new FiscalService(repository,c.arca||{mode:'disabled'},{client:c.arcaClient});contexts.set(c.id,{repository,fiscal,label:c.label})}catch(e){await repository.close();throw e}}}catch(e){for(const c of contexts.values())await c.repository.close();throw e}
 const cookieName=id=>id===defaultId?'sica_session':`sica_session_${createHash('sha256').update(id).digest('hex').slice(0,24)}`
 const token=(req,id)=>{const match=(req.headers.cookie||'').match(new RegExp(`(?:^|;\\s*)${cookieName(id)}=([a-f0-9]{64})(?:;|$)`));return match?.[1]||''}
 const cookie=(id,value,maxAge)=>`${cookieName(id)}=${value}; HttpOnly; SameSite=Strict; Path=${id===defaultId?'/api':`/api/company/${id}`}${secureCookie?'; Secure':''}${maxAge!==undefined?`; Max-Age=${maxAge}`:''}`
 const identity=id=>({id,label:contexts.get(id).label})
 const snapshot=(repository,value)=>({...value,company:identity(repository.companyId)})
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value))}
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new ApiError(415,'Se requiere JSON.');let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>20*1024*1024)throw new ApiError(413,'La operación supera 20 MB.');parts.push(chunk)}try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value}catch{throw new ApiError(400,'JSON inválido.')}}
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY')
  try{
   const url=new URL(req.url,'http://localhost'),rawPath=url.pathname
   let path=rawPath,companyId=defaultId
   if(rawPath.startsWith('/api/company/')){const match=rawPath.match(/^\/api\/company\/([a-z0-9][a-z0-9_-]{0,63})(\/.*)$/);if(!match||!contexts.has(match[1]))throw new ApiError(404,'Empresa o recurso no disponible.');companyId=match[1];path='/api'+match[2]}
   const {repository,fiscal}=contexts.get(companyId)
   if(path.startsWith('/api/')) {
    if(req.method==='GET'&&rawPath==='/api/companies')return json(res,200,{defaultId,companies:companies.map(c=>({id:c.id,label:c.label}))})
    if(req.method==='GET'&&path==='/api/health')return json(res,200,{ok:true,storage:'sqlite'})
    if(!['GET','POST'].includes(req.method))throw new ApiError(405,'Método no permitido.')
    if(req.method==='POST'&&(!origins.has(req.headers.origin)||req.headers['x-sica-client']!=='web'))throw new ApiError(403,'Origen de la operación no autorizado.')
    if(path==='/api/login'&&req.method==='POST'){const input=await body(req),auth=await repository.login(input.username,input.password,Boolean(input.remember),req.socket.remoteAddress||'',input.terminalName??'Navegador');res.setHeader('Set-Cookie',cookie(companyId,auth.token,input.remember?auth.duration:undefined));return json(res,200,snapshot(repository,{...repository.publicState(auth.actor),csrf:auth.csrf}))}
    const auth=repository.auth(token(req,companyId))
    if(req.method==='POST'&&req.headers['x-sica-csrf']!==auth.csrf)throw new ApiError(403,'La sesión de la operación no coincide.')
    if(req.method==='GET'&&['/api/session','/api/state'].includes(path))return json(res,200,snapshot(repository,{...repository.publicState(auth.actor),csrf:auth.csrf}))
    if(req.method==='GET'&&path==='/api/sessions')return json(res,200,repository.activeSessions(token(req,companyId)))
    if(req.method==='POST'&&path==='/api/logout'){repository.logout(token(req,companyId));res.setHeader('Set-Cookie',cookie(companyId,'',0));return json(res,200,{ok:true})}
    if(req.method==='POST'&&['/api/commands','/api/restore'].includes(path)){const payload=await body(req);return json(res,200,snapshot(repository,{...await repository.mutate(token(req,companyId),payload,path==='/api/restore'),csrf:auth.csrf}))}
    if(req.method==='GET'&&path==='/api/fiscal/status')return json(res,200,fiscal.client.status())
    if(req.method==='POST'&&path==='/api/fiscal/vat-sales-preview'){const input=await body(req);return json(res,200,fiscal.salesPreview(token(req,companyId),input))}
    if(req.method==='POST'&&path==='/api/fiscal/preview'){const input=await body(req);return json(res,200,fiscal.preview(token(req,companyId),input.documentId,input.options,input.environment))}
    if(req.method==='POST'&&path==='/api/fiscal/operate'){const input=await body(req);await fiscal.operate(token(req,companyId),input);const fresh=repository.auth(token(req,companyId));return json(res,200,snapshot(repository,{...repository.publicState(fresh.actor),csrf:fresh.csrf}))}
    if(req.method==='GET'&&path==='/api/recovery')return json(res,200,repository.recoveries(auth.actor))
    if(req.method==='GET'&&/^\/api\/recovery\/\d+$/.test(path))return json(res,200,repository.recoveries(auth.actor,Number(path.split('/').at(-1))))
    if(req.method==='GET'&&path==='/api/backup'){res.setHeader('Content-Disposition',`attachment; filename="SICA-${companyId}-copia-${new Date().toISOString().slice(0,10)}.json"`);return json(res,200,repository.backupState(auth.actor))}
    throw new ApiError(404,'Recurso no encontrado.')
   }
   if(req.method!=='GET'&&req.method!=='HEAD')throw new ApiError(405,'Método no permitido.')
   const decoded=decodeURIComponent(path);if(decoded.split('/').some(p=>p.startsWith('.')))throw new ApiError(404,'Recurso no encontrado.')
   let file=resolve(root,'.'+decoded);if(file!==root&&!file.startsWith(root+sep))throw new ApiError(404,'Recurso no encontrado.')
   try{if(!(await stat(file)).isFile())file=resolve(root,'index.html')}catch{if(extname(decoded))throw new ApiError(404,'Recurso no encontrado.');file=resolve(root,'index.html')}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'}
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'")
   const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes)
  }catch(error){if(res.headersSent){res.destroy();return}const internal=error?.code?.startsWith('ERR_SQLITE')||error?.code==='ENOENT';json(res,internal?500:error instanceof ApiError?error.status:400,{error:internal?'No se pudo completar la operación en el servidor.':error instanceof TypeError?'Datos de operación inválidos.':error instanceof Error?error.message:'No se pudo completar la operación.'})}
 })
 server.requestTimeout=30000;server.headersTimeout=15000
 return {server,repository:contexts.get(defaultId).repository,repositories:new Map([...contexts].map(([id,c])=>[id,c.repository])),async backupFiles(){const results=await Promise.allSettled([...contexts].map(async([id,c])=>({companyId:id,filename:await c.repository.backupFile()})));if(results.some(r=>r.status==='rejected'))throw new AggregateError(results.filter(r=>r.status==='rejected').map(r=>r.reason),'No se pudieron completar todas las copias de empresas.');return results.map(r=>r.value)},async close(){for(const c of contexts.values()){await c.fiscal.queue;await c.repository.close()}}}
}
