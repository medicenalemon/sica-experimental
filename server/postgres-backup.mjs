import {Buffer} from 'node:buffer'
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto'
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {syncFile,readAuditKey} from './backup-integrity.mjs'
import {assertFiscalRows} from './fiscal-integrity.mjs'
import {canonical,readTicket} from './fiscal-store.mjs'
import {validateState} from '../.server/domain/validation.js'
import {PostgresRepository} from './postgres-repository.mjs'

export const pgExportTables={
 sessions:['company_id','token','user_id','csrf','expires','auth_hash','public_id','created','last_seen','client_name'],
 requests:['company_id','user_id','request_id','command_hash','revision'],
 audit:['company_id','id','record','previous_hash','hash'],
 recovery:['company_id','id','revision','state','created'],
 fiscal_jobs:['company_id','environment','document_id','issuer','point','type','number','state','request','options','signature','result','updated'],
 fiscal_tickets:['company_id','environment','issuer','secret']
}
const safeEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'))
export function validateCompanyBundle(bundle,key){
 if(!bundle||bundle.version!==1||!bundle.company||!bundle.tables||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(bundle.company.id))throw new Error('Formato de copia de empresa inválido.')
 const {company,tables}=bundle,revision=Number(company.revision),state=JSON.parse(company.state)
 if(!Number.isSafeInteger(revision)||revision<0||!Number.isSafeInteger(revision+1))throw new Error('Revisión de empresa inválida.')
 validateState(state)
 for(const user of state.masters.users)if(!/^[a-f0-9]{64}$/i.test(String(user.passwordHash))||typeof user.salt!=='string'||!user.salt||!Number.isSafeInteger(Number(user.passwordIterations||150000))||Number(user.passwordIterations||150000)<150000||Number(user.passwordIterations||150000)>1000000)throw new Error('Credenciales de servidor inválidas en la copia.')
 for(const [table,columns] of Object.entries(pgExportTables)){
  if(!Array.isArray(tables[table]))throw new Error(`Falta la tabla de respaldo ${table}.`)
  for(const row of tables[table])if(!row||row.company_id!==company.id||columns.some(column=>row[column]===undefined||row[column]===null))throw new Error(`Referencia o columnas inválidas en ${table}.`)
 }
 let previous='',lastId=0
 for(const row of tables.audit){
  const id=Number(row.id)
  if(!Number.isSafeInteger(id)||id<=lastId)throw new Error('Orden de auditoría inválido.')
  if(row.previous_hash!==previous||!safeEqual(row.hash,createHmac('sha256',key).update(previous+'\n'+row.record).digest('hex')))throw new Error('La cadena HMAC de auditoría no corresponde a la copia y su clave.')
  JSON.parse(row.record);previous=row.hash;lastId=id
 }
 for(const row of tables.recovery)JSON.parse(row.state)
 assertFiscalRows(tables.fiscal_jobs,state)
 for(const ticket of tables.fiscal_tickets)readTicket(key,canonical([company.id,ticket.environment,ticket.issuer,'wsfe']),ticket.secret)
 return {companyId:company.id,revision,documents:state.documents.length,entries:state.entries.length,auditEvents:tables.audit.length,requests:tables.requests.length,fiscalJobs:tables.fiscal_jobs.length,fiscalTickets:tables.fiscal_tickets.length,sessions:tables.sessions.length}
}
export async function exportPostgresCompany(repository){
 return repository.transaction(async()=>{
  const company=(await repository.query('SELECT id,revision,state FROM companies WHERE id=$1',[repository.companyId])).rows[0],tables={}
  await repository.read();await repository.verifyAudit()
  for(const [table,columns] of Object.entries(pgExportTables))tables[table]=(await repository.query(`SELECT ${columns.join(',')} FROM ${table} WHERE company_id=$1${['audit','recovery'].includes(table)?' ORDER BY id':''}`,[repository.companyId])).rows
  const bundle={version:1,createdAt:new Date().toISOString(),company,tables};validateCompanyBundle(bundle,repository.key);return bundle
 },{readOnly:true})
}
export async function backupPostgres(repository,directory){
 const bundle=await exportPostgresCompany(repository),payload=JSON.stringify(bundle),signature=createHmac('sha256',repository.key).update('sica-postgres-backup:v1\n'+payload).digest('hex'),filename=resolve(directory,`sica-${repository.companyId}-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.sica-pg.json`)
 await mkdir(directory,{recursive:true,mode:0o700})
 await writeFile(filename+'.audit-key',repository.key,{mode:0o600,flag:'wx'});await syncFile(filename+'.audit-key')
 await writeFile(filename,JSON.stringify({format:'sica-postgres-backup',version:1,payload,signature})+'\n',{mode:0o600,flag:'wx'});await syncFile(filename)
 return filename
}
export async function readPostgresBackup({filename,keyFilename,expectedCompanyId}){
 if((await stat(filename)).size>256*1024*1024)throw new Error('El respaldo supera el límite de 256 MiB.')
 const key=await readAuditKey(keyFilename||filename+'.audit-key'),envelope=JSON.parse(await readFile(filename,'utf8'))
 if(envelope.format!=='sica-postgres-backup'||envelope.version!==1||typeof envelope.payload!=='string')throw new Error('Formato de respaldo PostgreSQL inválido.')
 if(!safeEqual(envelope.signature,createHmac('sha256',key).update('sica-postgres-backup:v1\n'+envelope.payload).digest('hex')))throw new Error('El sello HMAC del respaldo PostgreSQL no corresponde al archivo y su clave.')
 const bundle=JSON.parse(envelope.payload),report=validateCompanyBundle(bundle,key)
 if(expectedCompanyId&&expectedCompanyId!==report.companyId)throw new Error('La copia no corresponde a la empresa indicada.')
 return {bundle,key,report}
}
export async function importPostgresCompany({bundle,key,databaseUrl,auditKeyFile,operator='Operador de migración',reason,action='Recuperar empresa desde respaldo PostgreSQL'}){
 const report=validateCompanyBundle(bundle,key)
 if(typeof operator!=='string'||!operator.trim()||operator.length>120||typeof reason!=='string'||!reason.trim()||reason.length>500||[operator,reason].some(s=>Array.from(s).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)))throw new Error('Indicá operador y motivo de recuperación en una línea.')
 const repository=await PostgresRepository.open({databaseUrl,companyId:report.companyId,auditKeyFile,initialize:false,importKey:key})
 try{
  await repository.transaction(async()=>{
   if((await repository.query('SELECT id FROM companies WHERE id=$1',[report.companyId])).rowCount)throw new Error('La empresa de destino ya existe. No se reemplazan datos; elegí una base o código original aún vacío.')
   await repository.query('INSERT INTO companies(id,revision,state) VALUES($1,$2,$3)',[report.companyId,report.revision,bundle.company.state])
   for(const [table,columns] of Object.entries(pgExportTables)){
    if(table==='sessions')continue // Copied cookies never regain access.
    for(const row of bundle.tables[table])await repository.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_,i)=>'$'+(i+1)).join(',')})`,columns.map(column=>row[column]))
   }
   await repository.audit({id:randomUUID(),at:new Date().toISOString(),user:operator.trim(),action,detail:reason.trim(),revision:report.revision+1})
   await repository.query('UPDATE companies SET revision=revision+1 WHERE id=$1',[report.companyId])
   await repository.read();await repository.verifyAudit();await repository.assertFiscalState(JSON.parse(bundle.company.state))
  })
  return {...report,revision:report.revision+1,sourceRevision:report.revision,revokedSessions:report.sessions,engine:'postgres',audit:'HMAC validada',relationalTables:14}
 }finally{await repository.close()}
}
export async function recoverPostgresBackup(options){const {bundle,key}=await readPostgresBackup(options);return importPostgresCompany({...options,bundle,key})}
