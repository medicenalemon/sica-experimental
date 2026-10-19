import pg from 'pg'
import {AsyncLocalStorage} from 'node:async_hooks'
import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {ApiError} from './repository.mjs'
import {projectState} from './public-state.mjs'
import {migratePostgres,pgEntities,pgChildren} from './postgres-schema.mjs'
import {assertFiscalRows} from './fiscal-integrity.mjs'
import {fiscalRecord} from './fiscal-store.mjs'
import {initialState} from '../.server/domain/seed.js'
import {derivePassword} from '../.server/domain/auth.js'
import {executeCommand,commandPath} from '../.server/domain/commands.js'
import {canAccess} from '../.server/domain/permissions.js'
import {validateState} from '../.server/domain/validation.js'
import {assertReceiptSnapshotContinuity} from '../.server/domain/receipt-print.js'
import {syncFile} from './backup-integrity.mjs'
import {postgresConnectionConfig,initializePostgresSession} from './postgres-connection.mjs'

const digest=value=>createHash('sha256').update(value).digest('hex')
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
export class PostgresRepository {
 static async open({databaseUrl,companyId='sica',adminPassword,auditKeyFile,initialize=true,importKey,poolSize,backupDirectory,sslCa,sslCaFile}){
  const connectionConfig=postgresConnectionConfig({databaseUrl,poolSize,sslCa,sslCaFile})
  if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(companyId))throw new Error('Código de empresa PostgreSQL inválido.')
  const repository=new PostgresRepository({databaseUrl:connectionConfig.connectionString,companyId,auditKeyFile,connectionConfig,backupDirectory})
  try{
   await repository.connection(client=>migratePostgres(client))
   const existing=(await repository.query('SELECT id FROM companies WHERE id=$1',[companyId])).rowCount>0
   repository.key=await repository.loadKey(existing,importKey)
   if(initialize){
    await repository.transaction(async()=>{
     if((await repository.query('SELECT id FROM companies WHERE id=$1',[companyId])).rowCount)return
     if(typeof adminPassword!=='string'||adminPassword.length<12||adminPassword.length>1024)throw new Error('La primera ejecución requiere SICA_ADMIN_PASSWORD de al menos 12 caracteres.')
     const state=initialState(),user=state.masters.users[0];user.salt=randomBytes(24).toString('hex');user.passwordIterations=600000;user.passwordHash=await derivePassword(adminPassword,user.salt,600000)
     await repository.query('INSERT INTO companies(id,revision,state) VALUES($1,0,$2)',[companyId,JSON.stringify(state)])
    })
   }
   if(existing||initialize){await repository.transaction(async()=>{const current=await repository.read();validateState(current.state);await repository.verifyAudit();await repository.assertFiscalState(current.state)},{readOnly:true})}
   return repository
  }catch(error){await repository.close();throw error}
 }
 constructor({databaseUrl,companyId,auditKeyFile,connectionConfig,backupDirectory}){
  this.backend='postgres';this.companyId=companyId;this.databaseUrl=databaseUrl;this.auditKeyFile=resolve(auditKeyFile||`var/postgres/${companyId}.audit-key`);this.backupDirectory=resolve(backupDirectory||dirname(this.auditKeyFile)+'/backups');this.context=new AsyncLocalStorage()
  this.pool=new pg.Pool(connectionConfig)
  this.pool.on('error',()=>{}) // Active requests surface failures; do not log credentials.
 }
 async loadKey(existing,importKey){
  let bytes
  try{const info=await stat(this.auditKeyFile);if(process.platform!=='win32'&&(info.mode&0o077))throw new Error('La clave de auditoría PostgreSQL requiere permisos privados (600).');bytes=await readFile(this.auditKeyFile)}catch(error){
   if(error.code!=='ENOENT')throw error
   if(existing)throw new Error('Falta la clave de auditoría PostgreSQL. Restaurá la clave original antes de iniciar.')
   bytes=importKey||randomBytes(32);if(bytes.length!==32)throw new Error('Clave de importación inválida.')
   await mkdir(dirname(this.auditKeyFile),{recursive:true,mode:0o700})
   try{await writeFile(this.auditKeyFile,bytes,{mode:0o600,flag:'wx'})}catch(error){if(error.code!=='EEXIST')throw error;bytes=await readFile(this.auditKeyFile)}
  }
  if(bytes.length!==32||importKey&&!timingSafeEqual(bytes,importKey))throw new Error('La clave PostgreSQL no coincide con la clave original de la importación.')
  await syncFile(this.auditKeyFile)
  return bytes
 }
 async connection(callback){
  const context=this.context.getStore()
  if(context)return callback(context.client)
  const client=await this.pool.connect()
  let connectionError
  const onError=error=>{connectionError=error}
  client.on('error',onError)
  try{try{await initializePostgresSession(client)}catch(error){connectionError=error;throw error}return await this.context.run({client,transaction:false},()=>callback(client))}finally{client.removeListener('error',onError);client.release(connectionError)}
 }
 query(sql,parameters=[]){const client=this.context.getStore()?.client;return client?client.query(sql,parameters):this.connection(c=>c.query(sql,parameters))}
 async transaction(callback,{readOnly=false}={}){
  const current=this.context.getStore()
  if(current?.transaction)return callback()
  return this.connection(async client=>{
   await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN')
   try{
    if(!readOnly){
     await client.query('SET LOCAL synchronous_commit=on')
     await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['sica:company:'+this.companyId])
     await client.query('SELECT id FROM companies WHERE id=$1 FOR UPDATE',[this.companyId])
    }
    const result=await this.context.run({client,transaction:true,readOnly},callback)
    await client.query('COMMIT');return result
   }catch(error){try{await client.query('ROLLBACK')}catch{}if(['40001','40P01','55P03'].includes(error.code))throw new ApiError(409,'Otra operación está modificando la empresa. Actualizá y reintentá.');throw error}
  })
 }
 exclusive(callback){return this.transaction(callback)}
 async fiscalExclusive(environment,documentId,callback){
  return this.connection(async client=>{
   const name=`sica:fiscal:${this.companyId}:${environment}:${documentId}`
   const locked=(await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[name])).rows[0].locked
   if(!locked)throw new ApiError(409,'Otra terminal está procesando este comprobante fiscal. Consultá su estado antes de reintentar.')
   try{return await callback()}finally{await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[name])}
  })
 }
 async read(){
  return this.transaction(async()=>{
   const row=(await this.query('SELECT revision,state FROM companies WHERE id=$1',[this.companyId])).rows[0]
   if(!row)throw new ApiError(503,'Empresa no inicializada.')
   const state=JSON.parse(row.state),original=JSON.stringify(state)
   for(const entity of pgEntities){
    const objects=(await this.query(`SELECT data FROM ${entity.table} WHERE company_id=$1 ORDER BY position`,[this.companyId])).rows.map(r=>r.data),byId=new Map(objects.map(o=>[o.id,o]))
    for(const child of pgChildren.filter(c=>c.parent===entity.table)){
     for(const object of objects)object[child.collection]=[]
     for(const detail of (await this.query(`SELECT parent_id,data FROM ${child.table} WHERE company_id=$1 ORDER BY parent_id,position`,[this.companyId])).rows){const parent=byId.get(detail.parent_id);if(!parent)throw new ApiError(503,'Detalle relacional sin cabecera.');parent[child.collection].push(detail.data)}
    }
    if(entity.path.length===2)state.masters[entity.path[1]]=objects;else state[entity.path[0]]=objects
   }
   if(JSON.stringify(state)!==original)throw new ApiError(503,'Las tablas PostgreSQL no coinciden con el estado conservado. Se requiere revisar la base.')
   return {revision:Number(row.revision),state}
  },{readOnly:true})
 }
 actor(user){return {userId:user.id,name:String(user.name),role:user.role,permissions:String(user.permissions||'').split(',').map(s=>s.trim()).filter(Boolean)}}
 async auth(token){
  const record=(await this.query('SELECT * FROM sessions WHERE company_id=$1 AND token=$2 AND expires>$3',[this.companyId,digest(token||''),Date.now()])).rows[0]
  if(!record)throw new ApiError(401,'Iniciá sesión nuevamente.')
  const {state}=await this.read(),user=state.masters.users.find(u=>u.id===record.user_id&&u.active)
  if(!user||record.auth_hash!==digest(String(user.passwordHash))){await this.logout(token);throw new ApiError(401,'La sesión dejó de ser válida.')}
  if(Number(record.last_seen)<Date.now()-60000)await this.query('UPDATE sessions SET last_seen=$1 WHERE company_id=$2 AND token=$3',[Date.now(),this.companyId,record.token])
  return {actor:this.actor(user),csrf:record.csrf}
 }
 async limitLogin(username,ip){
  const now=Date.now()
  for(const [key,maximum] of [[digest('ip:'+ip),60],[digest('user:'+ip+':'+username.toLowerCase()),10]]){
   const row=(await this.query('INSERT INTO login_attempts(company_id,key,count,reset) VALUES($1,$2,1,$3) ON CONFLICT(company_id,key) DO UPDATE SET count=CASE WHEN login_attempts.reset<=$4 THEN 1 ELSE login_attempts.count+1 END,reset=CASE WHEN login_attempts.reset<=$4 THEN excluded.reset ELSE login_attempts.reset END RETURNING count',[this.companyId,key,now+15*60*1000,now])).rows[0]
   if(row.count>maximum)throw new ApiError(429,'Demasiados intentos. Esperá quince minutos.')
  }
  await this.query('DELETE FROM login_attempts WHERE company_id=$1 AND reset<$2',[this.companyId,now])
 }
 async login(username,password,remember,ip,clientName='Navegador'){
  if(typeof clientName!=='string'||clientName.length>80||Array.from(clientName).some(c=>c.charCodeAt(0)<32))throw new ApiError(400,'El nombre de terminal admite hasta 80 caracteres en una línea.')
  if(typeof username!=='string'||username.length>100||typeof password!=='string'||password.length>1024)throw new ApiError(400,'Datos de ingreso inválidos.')
  username=username.trim();clientName=clientName.trim()||'Navegador';await this.limitLogin(username,ip)
  const user=(await this.read()).state.masters.users.find(u=>String(u.username).toLowerCase()===username.toLowerCase()&&u.active),computed=await derivePassword(password,String(user?.salt||'sica-invalid-user'),user?Number(user.passwordIterations||150000):600000)
  if(!user||!equal(computed,user.passwordHash))throw new ApiError(401,'Usuario o contraseña incorrectos.')
  return this.transaction(async()=>{
   const fresh=(await this.read()).state.masters.users.find(u=>u.id===user.id&&u.active&&u.passwordHash===user.passwordHash)
   if(!fresh)throw new ApiError(401,'La sesión dejó de ser válida.')
   const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex'),duration=remember?30*24*60*60:8*60*60,now=Date.now()
   await this.query('INSERT INTO sessions(company_id,token,user_id,csrf,expires,auth_hash,public_id,created,last_seen,client_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9)',[this.companyId,digest(token),user.id,csrf,now+duration*1000,digest(String(user.passwordHash)),crypto.randomUUID(),now,clientName])
   await this.query('DELETE FROM sessions WHERE company_id=$1 AND expires<$2',[this.companyId,now]);await this.query('DELETE FROM login_attempts WHERE company_id=$1 AND key=$2',[this.companyId,digest('user:'+ip+':'+username.toLowerCase())])
   return {token,csrf,duration,actor:this.actor(fresh)}
  })
 }
 async logout(token){await this.query('DELETE FROM sessions WHERE company_id=$1 AND token=$2',[this.companyId,digest(token||'')])}
 async activeSessions(token){
  const {actor}=await this.auth(token)
  if(actor.role!=='Administrador General')throw new ApiError(403,'La gestión de sesiones requiere Administrador General.')
  const users=new Map((await this.read()).state.masters.users.map(u=>[u.id,u]))
  return (await this.query('SELECT * FROM sessions WHERE company_id=$1 AND expires>$2 ORDER BY last_seen DESC,created DESC',[this.companyId,Date.now()])).rows.filter(r=>{const u=users.get(r.user_id);return u?.active&&r.auth_hash===digest(String(u.passwordHash))}).map(r=>{const u=users.get(r.user_id);return {id:r.public_id,userId:u.id,name:String(u.name),username:String(u.username),role:u.role,terminal:r.client_name,created:new Date(Number(r.created)).toISOString(),lastSeen:new Date(Number(r.last_seen)).toISOString(),expires:new Date(Number(r.expires)).toISOString(),current:r.token===digest(token)}})
 }
 async fiscalRows(){return (await this.query('SELECT * FROM fiscal_jobs WHERE company_id=$1 ORDER BY environment,document_id',[this.companyId])).rows}
 async publicState(actor){
  return this.transaction(async()=>{
   const snapshot=await this.read(),user=snapshot.state.masters.users.find(u=>u.id===actor.userId&&u.active)
   if(!user)throw new ApiError(401,'La sesión dejó de ser válida.')
   actor=this.actor(user)
   const auditRecords=canAccess(actor,'/administracion/auditoria')?(await this.query('SELECT record FROM audit WHERE company_id=$1 ORDER BY id',[this.companyId])).rows.map(r=>JSON.parse(r.record)):[],fiscal=await this.fiscalRows()
   return projectState(snapshot,actor,{auditRecords:()=>auditRecords,decorate:state=>{for(const d of state.documents){delete d.fiscal;delete d.fiscalHistory;const rows=fiscal.filter(r=>r.document_id===d.id);if(rows.length){d.fiscalHistory=rows.map(fiscalRecord);d.fiscal=fiscalRecord(rows.find(r=>r.environment===this.fiscal?.environment)||rows.at(-1))}}}})
  },{readOnly:true})
 }
 sign(record,previous){return createHmac('sha256',this.key).update(previous+'\n'+record).digest('hex')}
 async audit(record){
  const previous=(await this.query('SELECT id,hash FROM audit WHERE company_id=$1 ORDER BY id DESC LIMIT 1',[this.companyId])).rows[0],raw=JSON.stringify(record)
  await this.query('INSERT INTO audit(company_id,id,record,previous_hash,hash) VALUES($1,$2,$3,$4,$5)',[this.companyId,Number(previous?.id||0)+1,raw,previous?.hash||'',this.sign(raw,previous?.hash||'')])
 }
 async verifyAudit(){let previous='';for(const row of (await this.query('SELECT record,previous_hash,hash FROM audit WHERE company_id=$1 ORDER BY id',[this.companyId])).rows){if(row.previous_hash!==previous||!equal(row.hash,this.sign(row.record,previous)))throw new Error('La cadena de auditoría no es válida. Se requiere revisar la base antes de operar.');previous=row.hash}}
 async assertFiscalState(next){try{assertFiscalRows(await this.fiscalRows(),next)}catch(error){throw new ApiError(409,error.message)}}
 async mutate(token,{revision,requestId,command},restore=false){
  if(!Number.isSafeInteger(revision)||!/^[-a-f0-9]{36}$/.test(requestId||''))throw new ApiError(400,'Versión o identificador de solicitud inválido.')
  const commandHash=digest((restore?'restore:':'command:')+JSON.stringify(command))
  const result=await this.transaction(async()=>{
   const {actor}=await this.auth(token),prior=(await this.query('SELECT command_hash FROM requests WHERE company_id=$1 AND user_id=$2 AND request_id=$3',[this.companyId,actor.userId,requestId])).rows[0]
   if(prior){if(prior.command_hash!==commandHash)throw new ApiError(409,'La solicitud repetida contiene otra operación.');return {actor,duplicate:true}}
   const current=await this.read();if(current.revision!==revision)throw new ApiError(409,'Los datos cambiaron en otra sesión. Actualizá y repetí la operación.')
   let next=structuredClone(current.state),meta
   if(restore){
    if(actor.role!=='Administrador General')throw new ApiError(403,'La restauración requiere Administrador General.')
    validateState(command.state);try{assertReceiptSnapshotContinuity(current.state,command.state)}catch(error){throw new ApiError(409,error.message)}
    next=structuredClone(command.state);next.masters.users=current.state.masters.users;next.audit=[];meta={action:'Restaurar copia de seguridad',detail:'Se preservaron los usuarios del servidor y una copia de recuperación.'}
    await this.query('INSERT INTO recovery(company_id,id,revision,state,created) SELECT $1,coalesce(max(id),0)+1,$2,$3,$4 FROM recovery WHERE company_id=$1',[this.companyId,revision,JSON.stringify(current.state),new Date().toISOString()])
   }else if(command.type==='sessions.revoke'){
    if(actor.role!=='Administrador General')throw new ApiError(403,'La gestión de sesiones requiere Administrador General.')
    if(typeof command.sessionId!=='string'||!/^[-a-f0-9]{36}$/.test(command.sessionId)||typeof command.reason!=='string'||!command.reason.trim()||command.reason.length>500)throw new ApiError(400,'Seleccioná una sesión e indicá un motivo de hasta 500 caracteres.')
    const target=(await this.query('SELECT * FROM sessions WHERE public_id=$1 AND company_id=$2 AND expires>$3',[command.sessionId,this.companyId,Date.now()])).rows[0]
    if(!target)throw new ApiError(409,'La sesión ya no está activa. Actualizá la lista.')
    if(target.token===digest(token))throw new ApiError(400,'Usá Cerrar sesión para salir de tu sesión actual.')
    await this.query('DELETE FROM sessions WHERE company_id=$1 AND token=$2',[this.companyId,target.token]);const user=next.masters.users.find(u=>u.id===target.user_id);meta={action:'Cerrar sesión de otra terminal',detail:`${user?.name||'Usuario anterior'} · ${target.client_name}: ${command.reason.trim()}`}
   }else{
    if(['production.cost','production.reestimate','production.inflation','production.recovery','production.recovery-accounts'].includes(command.type)&&actor.role!=='Administrador General')throw new ApiError(403,'La imputación contable de producción requiere Administrador General.')
    if(command.type==='inventory.recovery'&&command.assessment?.closing&&actor.role!=='Administrador General')throw new ApiError(403,'El VNR actual posterior al ajuste anual requiere Administrador General.')
    if(!canAccess(actor,commandPath(command)))throw new ApiError(403,'Tu perfil no tiene permiso para esta operación.')
    meta=await executeCommand(next,actor,command,command.type==='vat.sales'?{salesAuthorizations:await this.fiscal?.salesSources(next,command.preparation.period,command.preparation.environment)}:{})
   }
   validateState(next);await this.assertFiscalState(next);for(const d of next.documents){delete d.fiscal;delete d.fiscalHistory}next.audit=[]
   await this.query('UPDATE companies SET revision=$1,state=$2 WHERE id=$3 AND revision=$4',[revision+1,JSON.stringify(next),this.companyId,revision])
   await this.audit({id:crypto.randomUUID(),at:new Date().toISOString(),user:actor.name,action:meta.action,detail:meta.detail,revision:revision+1,requestId})
   await this.query('INSERT INTO requests(company_id,user_id,request_id,command_hash,revision) VALUES($1,$2,$3,$4,$5)',[this.companyId,actor.userId,requestId,commandHash,revision+1])
   const fresh=next.masters.users.find(u=>u.id===actor.userId&&u.active),old=current.state.masters.users.find(u=>u.id===actor.userId),signedOut=!fresh||fresh.passwordHash!==old.passwordHash
   if(signedOut)await this.logout(token)
   return {actor:fresh?this.actor(fresh):actor,signedOut}
  })
  // Match SQLite's response even if the command disabled the current user.
  const snapshot=result.signedOut?projectState(await this.read(),result.actor):await this.publicState(result.actor)
  return {...snapshot,...(result.duplicate?{duplicate:true}:{signedOut:result.signedOut})}
 }
 async recoveries(actor,id){
  if(actor.role!=='Administrador General')throw new ApiError(403,'La recuperación requiere Administrador General.')
  if(id!==undefined){const row=(await this.query('SELECT state FROM recovery WHERE company_id=$1 AND id=$2',[this.companyId,id])).rows[0];if(!row)throw new ApiError(404,'Copia de recuperación no encontrada.');return JSON.parse(row.state)}
  return (await this.query('SELECT id,revision,created,state FROM recovery WHERE company_id=$1 ORDER BY id DESC',[this.companyId])).rows.map(r=>{const s=JSON.parse(r.state);return {id:Number(r.id),revision:Number(r.revision),created:r.created,name:s.settings.name,documents:s.documents.length}})
 }
 async backupState(actor){if(actor.role!=='Administrador General')throw new ApiError(403,'La copia completa requiere Administrador General.');return this.transaction(async()=>{const {state}=await this.read();state.audit=(await this.query('SELECT record FROM audit WHERE company_id=$1 ORDER BY id',[this.companyId])).rows.map(r=>JSON.parse(r.record));return state},{readOnly:true})}
 async backupFile(directory=this.backupDirectory){const {backupPostgres}=await import('./postgres-backup.mjs');return backupPostgres(this,directory)}
 async close(){await this.pool.end()}
}
