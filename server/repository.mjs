import {projectState} from './public-state.mjs'
import {assertReceiptSnapshotContinuity} from '../.server/domain/receipt-print.js'
import {migrateRelationalStore,readRelationalState,assertRelationalStore} from './relational-store.mjs'
import {sealBackup,syncFile} from './backup-integrity.mjs'
import {assertFiscalSources} from './fiscal-integrity.mjs'
import { fiscalSchema } from './fiscal-store.mjs'
import { DatabaseSync, backup } from 'node:sqlite'
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { initialState } from '../.server/domain/seed.js'
import { executeCommand, commandPath } from '../.server/domain/commands.js'
import { validateState } from '../.server/domain/validation.js'
import { canAccess } from '../.server/domain/permissions.js'
import { derivePassword } from '../.server/domain/auth.js'

export class ApiError extends Error {constructor(status,message){super(message);this.status=status}}
const digest=value=>createHash('sha256').update(value).digest('hex')
const constantEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
export class Repository {
 static async open({filename,companyId='sica',adminPassword}) {
  const repository=new Repository(filename,companyId)
  if(!repository.db.prepare('SELECT id FROM companies WHERE id=?').get(companyId)) {
   if(typeof adminPassword!=='string'||adminPassword.length<12||adminPassword.length>1024){repository.db.close();throw new Error('La primera ejecución requiere SICA_ADMIN_PASSWORD de al menos 12 caracteres.')}
   const state=initialState(),user=state.masters.users[0];user.salt=randomBytes(24).toString('hex');user.passwordIterations=600000;user.passwordHash=await derivePassword(adminPassword,user.salt,600000)
   repository.db.prepare('INSERT INTO companies(id,revision,state) VALUES(?,0,?)').run(companyId,JSON.stringify(state))
  }
  try{repository.verifyAudit();return repository}catch(error){repository.db.close();throw error}
 }
 constructor(filename,companyId) {
  this.filename=resolve(filename);this.companyId=companyId;this.queue=Promise.resolve()
  if(existsSync(this.filename+'.recovering'))throw new Error('La recuperación SQLite está incompleta. Revisá el informe de recuperación antes de iniciar el servidor.')
  mkdirSync(dirname(this.filename),{recursive:true,mode:0o700})
  const keyPath=this.filename+'.audit-key'
  if(!existsSync(keyPath)&&existsSync(this.filename))throw new Error('Falta la clave de auditoría correspondiente a la base. Restaurá el archivo .audit-key del mismo respaldo.');if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'})
  this.key=readFileSync(keyPath);if(this.key.length!==32)throw new Error('Clave de auditoría inválida.')
  this.db=new DatabaseSync(this.filename,{timeout:5000});chmodSync(this.filename,0o600)
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,state TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,company_id TEXT NOT NULL,user_id TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL,auth_hash TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS requests(company_id TEXT NOT NULL,user_id TEXT NOT NULL,request_id TEXT NOT NULL,command_hash TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(company_id,user_id,request_id));
   CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,company_id TEXT NOT NULL,record TEXT NOT NULL,previous_hash TEXT NOT NULL,hash TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS recovery(id INTEGER PRIMARY KEY AUTOINCREMENT,company_id TEXT NOT NULL,revision INTEGER NOT NULL,state TEXT NOT NULL,created TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset INTEGER NOT NULL);${fiscalSchema}`)
  this.db.exec('BEGIN IMMEDIATE')
  try{
   const columns=new Set(this.db.prepare('PRAGMA table_info(sessions)').all().map(c=>c.name))
   for(const [name,type] of [['public_id',"TEXT NOT NULL DEFAULT ''"],['created','INTEGER NOT NULL DEFAULT 0'],['last_seen','INTEGER NOT NULL DEFAULT 0'],['client_name',"TEXT NOT NULL DEFAULT 'Sesión anterior'"]])if(!columns.has(name))this.db.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`)
   for(const row of this.db.prepare("SELECT token FROM sessions WHERE public_id='' ").all())this.db.prepare('UPDATE sessions SET public_id=? WHERE token=?').run(crypto.randomUUID(),row.token)
   this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_public_id ON sessions(public_id); COMMIT')
  }catch(error){this.db.exec('ROLLBACK');this.db.close();throw error}
  try{
   migrateRelationalStore(this.db)
   for(const row of this.db.prepare('SELECT id,state FROM companies').all())assertRelationalStore(this.db,row.id,JSON.parse(row.state))
  }catch(error){this.db.close();throw error}
 }
 read(){
  const ownTransaction=!this.db.isTransaction
  if(ownTransaction)this.db.exec('BEGIN')
  try{
   const row=this.db.prepare('SELECT revision,state FROM companies WHERE id=?').get(this.companyId)
   if(!row)throw new ApiError(503,'Empresa no inicializada.')
   const result={revision:Number(row.revision),state:readRelationalState(this.db,this.companyId,JSON.parse(row.state))}
   if(ownTransaction)this.db.exec('COMMIT')
   return result
  }catch(error){if(ownTransaction&&this.db.isTransaction)this.db.exec('ROLLBACK');throw error}
 }
 actor(user){return {userId:user.id,name:String(user.name),role:user.role,permissions:String(user.permissions||'').split(',').map(s=>s.trim()).filter(Boolean)}}
 auth(token){const record=this.db.prepare('SELECT * FROM sessions WHERE token=? AND company_id=? AND expires>?').get(digest(token||''),this.companyId,Date.now());if(!record)throw new ApiError(401,'Iniciá sesión nuevamente.');const {state}=this.read(),user=state.masters.users.find(u=>u.id===record.user_id&&u.active);if(!user||record.auth_hash!==digest(String(user.passwordHash))){this.db.prepare('DELETE FROM sessions WHERE token=?').run(record.token);throw new ApiError(401,'La sesión dejó de ser válida.')}if(Number(record.last_seen)<Date.now()-60000)this.db.prepare('UPDATE sessions SET last_seen=? WHERE token=?').run(Date.now(),record.token);return {actor:this.actor(user),csrf:record.csrf}}
 limitLogin(username,ip){const now=Date.now();for(const [key,maximum] of [[digest('ip:'+ip),60],[digest('user:'+ip+':'+username.toLowerCase()),10]]) {let row=this.db.prepare('SELECT * FROM login_attempts WHERE key=?').get(key);if(row&&Number(row.reset)>now&&Number(row.count)>=maximum)throw new ApiError(429,'Demasiados intentos. Esperá quince minutos.');if(!row||Number(row.reset)<=now)row={count:0,reset:now+15*60*1000};this.db.prepare('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)').run(key,Number(row.count)+1,Number(row.reset))}this.db.prepare('DELETE FROM login_attempts WHERE reset<?').run(now)}
 async login(username,password,remember,ip,clientName='Navegador'){if(typeof clientName!=='string'||clientName.length>80||Array.from(clientName).some(c=>c.charCodeAt(0)<32))throw new ApiError(400,'El nombre de terminal admite hasta 80 caracteres en una línea.');clientName=clientName.trim()||'Navegador';if(typeof username!=='string'||username.length>100||typeof password!=='string'||password.length>1024)throw new ApiError(400,'Datos de ingreso inválidos.');username=username.trim();this.limitLogin(username,ip);const {state}=this.read(),user=state.masters.users.find(u=>String(u.username).toLowerCase()===username.toLowerCase()&&u.active);const computed=await derivePassword(password,String(user?.salt||'sica-invalid-user'),user?Number(user.passwordIterations||150000):600000);if(!user||!constantEqual(computed,user.passwordHash))throw new ApiError(401,'Usuario o contraseña incorrectos.');const fresh=this.read().state.masters.users.find(u=>u.id===user.id&&u.active&&u.passwordHash===user.passwordHash);if(!fresh)throw new ApiError(401,'La sesión dejó de ser válida.');const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex'),duration=remember?30*24*60*60:8*60*60;this.db.prepare('INSERT INTO sessions(token,company_id,user_id,csrf,expires,auth_hash,public_id,created,last_seen,client_name) VALUES(?,?,?,?,?,?,?,?,?,?)').run(digest(token),this.companyId,user.id,csrf,Date.now()+duration*1000,digest(String(user.passwordHash)),crypto.randomUUID(),Date.now(),Date.now(),clientName);this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());this.db.prepare('DELETE FROM login_attempts WHERE key=?').run(digest('user:'+ip+':'+username.toLowerCase()));return {token,csrf,duration,actor:this.actor(fresh)}}
 logout(token){this.db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token||''))}
 activeSessions(token){
  const {actor}=this.auth(token)
  if(actor.role!=='Administrador General')throw new ApiError(403,'La gestión de sesiones requiere Administrador General.')
  const users=new Map(this.read().state.masters.users.map(u=>[u.id,u]))
  return this.db.prepare('SELECT * FROM sessions WHERE company_id=? AND expires>? ORDER BY last_seen DESC,created DESC').all(this.companyId,Date.now()).filter(r=>{const u=users.get(r.user_id);return u?.active&&r.auth_hash===digest(String(u.passwordHash))}).map(r=>{const u=users.get(r.user_id);return {id:r.public_id,userId:u.id,name:String(u.name),username:String(u.username),role:u.role,terminal:r.client_name,created:r.created?new Date(Number(r.created)).toISOString():null,lastSeen:r.last_seen?new Date(Number(r.last_seen)).toISOString():null,expires:new Date(Number(r.expires)).toISOString(),current:r.token===digest(token)}})
 }
 publicState(actor){return projectState(this.read(),actor,{auditRecords:()=>this.db.prepare('SELECT record FROM audit WHERE company_id=? ORDER BY id').all(this.companyId).map(r=>JSON.parse(r.record)),decorate:state=>this.fiscal?.decorate(state)})}

 sign(record,previous){return createHmac('sha256',this.key).update(previous+'\n'+record).digest('hex')}
 audit(record){const previous=this.db.prepare('SELECT hash FROM audit WHERE company_id=? ORDER BY id DESC LIMIT 1').get(this.companyId)?.hash||'';const raw=JSON.stringify(record);this.db.prepare('INSERT INTO audit(company_id,record,previous_hash,hash) VALUES(?,?,?,?)').run(this.companyId,raw,previous,this.sign(raw,previous))}
 verifyAudit(){let previous='';for(const row of this.db.prepare('SELECT record,previous_hash,hash FROM audit WHERE company_id=? ORDER BY id').all(this.companyId)){if(row.previous_hash!==previous||!constantEqual(row.hash,this.sign(row.record,previous)))throw new Error('La cadena de auditoría no es válida. Se requiere revisar la base antes de operar.');previous=row.hash}}
 exclusive(callback){const operation=this.queue.then(callback);this.queue=operation.catch(()=>{});return operation}
 async mutate(token,{revision,requestId,command},restore=false) {if(!Number.isSafeInteger(revision)||!/^[-a-f0-9]{36}$/.test(requestId||''))throw new ApiError(400,'Versión o identificador de solicitud inválido.');const commandHash=digest((restore?'restore:':'command:')+JSON.stringify(command));return this.exclusive(async()=>{
  this.db.exec('BEGIN IMMEDIATE')
  try{
   const {actor}=this.auth(token),prior=this.db.prepare('SELECT command_hash FROM requests WHERE company_id=? AND user_id=? AND request_id=?').get(this.companyId,actor.userId,requestId)
   if(prior){if(prior.command_hash!==commandHash)throw new ApiError(409,'La solicitud repetida contiene otra operación.');this.db.exec('COMMIT');return {...this.publicState(actor),duplicate:true}}
   const current=this.read();if(current.revision!==revision)throw new ApiError(409,'Los datos cambiaron en otra sesión. Actualizá y repetí la operación.')
   let next=structuredClone(current.state),meta
   if(restore){if(actor.role!=='Administrador General')throw new ApiError(403,'La restauración requiere Administrador General.');validateState(command.state);try{assertReceiptSnapshotContinuity(current.state,command.state)}catch(e){throw new ApiError(409,e.message)}next=structuredClone(command.state);next.masters.users=current.state.masters.users;next.audit=[];meta={action:'Restaurar copia de seguridad',detail:'Se preservaron los usuarios del servidor y una copia de recuperación.'};this.db.prepare('INSERT INTO recovery(company_id,revision,state,created) VALUES(?,?,?,?)').run(this.companyId,revision,JSON.stringify(current.state),new Date().toISOString())}
   else {if(command.type==='sessions.revoke'){if(actor.role!=='Administrador General')throw new ApiError(403,'La gestión de sesiones requiere Administrador General.');if(typeof command.sessionId!=='string'||!/^[-a-f0-9]{36}$/.test(command.sessionId)||typeof command.reason!=='string'||!command.reason.trim()||command.reason.length>500)throw new ApiError(400,'Seleccioná una sesión e indicá un motivo de hasta 500 caracteres.');const target=this.db.prepare('SELECT * FROM sessions WHERE public_id=? AND company_id=? AND expires>?').get(command.sessionId,this.companyId,Date.now());if(!target)throw new ApiError(409,'La sesión ya no está activa. Actualizá la lista.');if(target.token===digest(token))throw new ApiError(400,'Usá Cerrar sesión para salir de tu sesión actual.');const user=next.masters.users.find(u=>u.id===target.user_id);this.db.prepare('DELETE FROM sessions WHERE token=? AND company_id=?').run(target.token,this.companyId);meta={action:'Cerrar sesión de otra terminal',detail:`${user?.name||'Usuario anterior'} · ${target.client_name}: ${command.reason.trim()}`}}else{if(['production.cost','production.reestimate','production.inflation','production.recovery','production.recovery-accounts'].includes(command.type)&&actor.role!=='Administrador General')throw new ApiError(403,'La imputación contable de producción requiere Administrador General.');if(command.type==='inventory.recovery'&&command.assessment?.closing&&actor.role!=='Administrador General')throw new ApiError(403,'El VNR actual posterior al ajuste anual requiere Administrador General.');if(!canAccess(actor,commandPath(command)))throw new ApiError(403,'Tu perfil no tiene permiso para esta operación.');meta=await executeCommand(next,actor,command,command.type==='vat.sales'?{salesAuthorizations:this.fiscal?.salesSources(next,command.preparation.period,command.preparation.environment)}:{})}}
   validateState(next);this.assertFiscalState(next);for(const d of next.documents){delete d.fiscal;delete d.fiscalHistory}next.audit=[]
   const updated=revision+1;this.db.prepare('UPDATE companies SET revision=?,state=? WHERE id=? AND revision=?').run(updated,JSON.stringify(next),this.companyId,revision)
   this.audit({id:crypto.randomUUID(),at:new Date().toISOString(),user:actor.name,action:meta.action,detail:meta.detail,revision:updated,requestId})
   this.db.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run(this.companyId,actor.userId,requestId,commandHash,updated)
   this.db.exec('COMMIT');const fresh=next.masters.users.find(u=>u.id===actor.userId&&u.active),old=current.state.masters.users.find(u=>u.id===actor.userId),signedOut=!fresh||fresh.passwordHash!==old.passwordHash;if(signedOut)this.logout(token);return {...this.publicState(fresh?this.actor(fresh):actor),signedOut}
  }catch(error){if(this.db.isTransaction)this.db.exec('ROLLBACK');throw error}
 })}
 recoveries(actor,id){if(actor.role!=='Administrador General')throw new ApiError(403,'La recuperación requiere Administrador General.');if(id!==undefined){const row=this.db.prepare('SELECT state FROM recovery WHERE company_id=? AND id=?').get(this.companyId,id);if(!row)throw new ApiError(404,'Copia de recuperación no encontrada.');return JSON.parse(row.state)}return this.db.prepare('SELECT id,revision,created,state FROM recovery WHERE company_id=? ORDER BY id DESC').all(this.companyId).map(r=>{const s=JSON.parse(r.state);return {id:Number(r.id),revision:Number(r.revision),created:r.created,name:s.settings.name,documents:s.documents.length}})}
 assertFiscalState(next){try{assertFiscalSources(this.db,this.companyId,next)}catch(error){throw new ApiError(409,error.message)}}
 backupState(actor){if(actor.role!=='Administrador General')throw new ApiError(403,'La copia completa requiere Administrador General.');const {state}=this.read();state.audit=this.db.prepare('SELECT record FROM audit WHERE company_id=? ORDER BY id').all(this.companyId).map(r=>JSON.parse(r.record));return state}
 async backupFile(directory=resolve(dirname(this.filename),'backups')){await this.queue;mkdirSync(directory,{recursive:true,mode:0o700});const destination=resolve(directory,`sica-${new Date().toISOString().replaceAll(':','-')}-${crypto.randomUUID().slice(0,8)}.sqlite`);await backup(this.db,destination);chmodSync(destination,0o600);writeFileSync(destination+'.audit-key',this.key,{mode:0o600,flag:'wx'});await syncFile(destination+'.audit-key');await sealBackup(destination,this.key);return destination}
 async close(){await this.queue;this.db.close()}
}
