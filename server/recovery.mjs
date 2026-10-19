import {DatabaseSync} from 'node:sqlite'
import {assertRelationalStore} from './relational-store.mjs'
import {createHmac,randomUUID} from 'node:crypto'
import {constants} from 'node:fs'
import {copyFile,writeFile,stat,mkdtemp,mkdir,rm,chmod,unlink} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {validateState} from '../.server/domain/validation.js'
import {canonical,readTicket} from './fiscal-store.mjs'
import {assertFiscalSources} from './fiscal-integrity.mjs'
import {sameDigest,fileDigest,readAuditKey,verifyBackupSeal,sealBackup,syncFile} from './backup-integrity.mjs'

async function exists(path){try{await stat(path);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
function json(value,label){try{return JSON.parse(value)}catch{throw new Error(`${label}: JSON inválido.`)}}
function inspectDatabase(filename,key,manifest,expectedCompanyId){
 const db=new DatabaseSync(filename,{readOnly:true})
 try{
  if(db.prepare('PRAGMA integrity_check').all().some(row=>Object.values(row)[0]!=='ok')||db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('La integridad SQLite del respaldo no es válida.')
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t=>t.name))
  for(const table of ['companies','sessions','requests','audit'])if(!tables.has(table))throw new Error(`Falta la tabla SICA ${table}.`)
  const rows=db.prepare('SELECT id,revision,state FROM companies ORDER BY id').all()
  if(!rows.length)throw new Error('La copia no contiene empresas.')
  if(expectedCompanyId&&(rows.length!==1||rows[0].id!==expectedCompanyId))throw new Error('La copia no corresponde exclusivamente a la empresa indicada.')
  if(manifest&&canonical(rows.map(c=>({id:c.id,revision:Number(c.revision)})))!==canonical(manifest.companies))throw new Error('Las empresas o versiones no coinciden con el sello del respaldo.')
  const ids=new Set(rows.map(c=>c.id))
  for(const table of ['sessions','requests','audit','recovery','fiscal_jobs','fiscal_tickets'])if(tables.has(table))for(const row of db.prepare(`SELECT DISTINCT company_id FROM ${table}`).all())if(!ids.has(row.company_id))throw new Error(`La tabla ${table} contiene referencias a una empresa ausente.`)
  const companies=rows.map(row=>{
   const revision=Number(row.revision)
   if(typeof row.id!=='string'||!row.id||!Number.isSafeInteger(revision)||revision<0)throw new Error('Empresa o versión inválida en la copia.')
   const state=json(row.state,'Estado de empresa');validateState(state);assertRelationalStore(db,row.id,state)
   for(const u of state.masters.users)if(!/^[a-f0-9]{64}$/i.test(String(u.passwordHash))||typeof u.salt!=='string'||!u.salt||!Number.isSafeInteger(Number(u.passwordIterations||150000))||Number(u.passwordIterations||150000)<150000||Number(u.passwordIterations||150000)>1000000)throw new Error('La copia contiene credenciales de usuario incompatibles con el servidor.')
   let previous='',events=0
   for(const audit of db.prepare('SELECT record,previous_hash,hash FROM audit WHERE company_id=? ORDER BY id').all(row.id)){
    const expected=createHmac('sha256',key).update(previous+'\n'+audit.record).digest('hex')
    if(audit.previous_hash!==previous||!sameDigest(audit.hash,expected))throw new Error('La cadena HMAC de auditoría no es válida para la clave recibida.')
    json(audit.record,'Evento de auditoría');previous=audit.hash;events++
   }
   if(tables.has('fiscal_jobs'))assertFiscalSources(db,row.id,state)
   for(const r of tables.has('recovery')?db.prepare('SELECT state FROM recovery WHERE company_id=?').all(row.id):[])json(r.state,'Copia histórica de recuperación')
   const count=table=>tables.has(table)?Number(db.prepare(`SELECT count(*) AS count FROM ${table} WHERE company_id=?`).get(row.id).count):0
   return {id:row.id,revision,users:state.masters.users.length,documents:state.documents.length,entries:state.entries.length,stockMoves:state.stockMoves.length,auditEvents:events,sessions:count('sessions'),requests:count('requests'),recoveryCopies:count('recovery'),fiscalJobs:count('fiscal_jobs'),fiscalTickets:count('fiscal_tickets')}
  })
  if(tables.has('fiscal_tickets'))for(const t of db.prepare('SELECT * FROM fiscal_tickets').all())readTicket(key,canonical([t.company_id,t.environment,t.issuer,'wsfe']),t.secret)
  return {companies,integrity:'ok',audit:'HMAC validada',fiscal:'Fuentes conservadas y tickets descifrables',seal:manifest?'Archivo SHA-256 con sello HMAC':'Copia anterior sin sello del archivo',warnings:manifest?[]:['La clave HMAC sólo verifica los eventos existentes y los tickets cifrados; no acredita el contenido completo de una copia antigua sin sello.']}
 }finally{db.close()}
}

async function stagedSource(options,operation){
 const filename=resolve(options.filename),keyFilename=resolve(options.keyFilename||filename+'.audit-key')
 if(!(await stat(filename)).isFile())throw new Error('Seleccioná un archivo SQLite de respaldo.')
 if(await exists(filename+'-wal')&&(await stat(filename+'-wal')).size)throw new Error('La fuente tiene un WAL con datos. Usá un respaldo SQLite independiente, no una base en uso.')
 const key=await readAuditKey(keyFilename),hasSeal=await exists(filename+'.backup.json')
 if(!hasSeal&&!options.allowLegacy)throw new Error('Falta el sello .backup.json. Una copia anterior requiere la opción explícita --legacy.')
 const originalManifest=hasSeal?await verifyBackupSeal(filename,key):undefined,sha256=await fileDigest(filename)
 const directory=await mkdtemp(join(tmpdir(),'sica-recovery-'))
 try{
  const staged=join(directory,'sica.sqlite');await copyFile(filename,staged,constants.COPYFILE_EXCL);await chmod(staged,0o600)
  if(!sameDigest(await fileDigest(staged),sha256)||!sameDigest(await fileDigest(filename),sha256))throw new Error('La fuente cambió mientras se copiaba. Revisá el respaldo y repetí la operación.')
  if(await exists(filename+'-wal')&&(await stat(filename+'-wal')).size)throw new Error('La fuente empezó a escribir un WAL durante la verificación.')
  if(hasSeal){await copyFile(filename+'.backup.json',staged+'.backup.json',constants.COPYFILE_EXCL);await verifyBackupSeal(staged,key)}
  const report=inspectDatabase(staged,key,originalManifest,options.expectedCompanyId)
  return await operation({staged,key,sha256,report})
 }finally{await rm(directory,{recursive:true,force:true})}
}
export async function inspectBackup(options){return stagedSource(options,async({sha256,report})=>({...report,sha256}))}

export async function recoverBackup(options){
 const operator=options.operator||'Operador de recuperación',reason=options.reason
 if(typeof operator!=='string'||!operator.trim()||operator.length>120||typeof reason!=='string'||!reason.trim()||reason.length>500||[operator,reason].some(s=>Array.from(s).some(c=>c.charCodeAt(0)<32)))throw new Error('Indicá operador y motivo en una línea, de hasta 120 y 500 caracteres respectivamente.')
 if(typeof options.destination!=='string'||!options.destination.trim())throw new Error('Indicá una carpeta de destino nueva.')
 const destination=resolve(options.destination)
 if(await exists(destination))throw new Error('El destino ya existe. Elegí una carpeta nueva; no se reemplazan archivos.')
 return stagedSource(options,async({staged,key,sha256,report})=>{
  const db=new DatabaseSync(staged)
  let revokedSessions
  try{
   db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; BEGIN IMMEDIATE')
   revokedSessions=Number(db.prepare('SELECT count(*) AS count FROM sessions').get().count);db.exec('DELETE FROM sessions')
   if(db.prepare("SELECT name FROM sqlite_master WHERE name='login_attempts'").get())db.exec('DELETE FROM login_attempts')
   for(const c of report.companies){
    if(!Number.isSafeInteger(c.revision+1))throw new Error('La versión de empresa no admite otro incremento seguro.')
    const previous=db.prepare('SELECT hash FROM audit WHERE company_id=? ORDER BY id DESC LIMIT 1').get(c.id)?.hash||''
    const record=JSON.stringify({id:randomUUID(),at:new Date().toISOString(),user:operator.trim(),action:'Recuperar servidor desde respaldo SQLite',detail:`Origen SHA-256 ${sha256}; versión ${c.revision}. ${reason.trim()}`,revision:c.revision+1})
    const hash=createHmac('sha256',key).update(previous+'\n'+record).digest('hex')
    db.prepare('INSERT INTO audit(company_id,record,previous_hash,hash) VALUES(?,?,?,?)').run(c.id,record,previous,hash)
    db.prepare('UPDATE companies SET revision=? WHERE id=?').run(c.revision+1,c.id)
   }
   db.exec('COMMIT')
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}finally{db.close()}
  const manifest=await sealBackup(staged,key,{replace:true}),verified=inspectDatabase(staged,key,manifest,options.expectedCompanyId)
  await mkdir(destination,{mode:0o700})
  const database=join(destination,'sica.sqlite'),marker=database+'.recovering'
  try{
   await writeFile(marker,'Recuperación sin publicar. No iniciar el servidor.\n',{mode:0o600,flag:'wx'})
   await copyFile(staged,database,constants.COPYFILE_EXCL);await chmod(database,0o600)
   await writeFile(database+'.audit-key',key,{mode:0o600,flag:'wx'})
   await copyFile(staged+'.backup.json',database+'.backup.json',constants.COPYFILE_EXCL);await chmod(database+'.backup.json',0o600)
   const result={format:'sica-recovery-report',version:1,createdAt:new Date().toISOString(),database,operator:operator.trim(),reason:reason.trim(),sourceSha256:sha256,sourceSeal:report.seal,revokedSessions,...verified}
   await writeFile(join(destination,'recovery-report.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'})
   for(const path of [database,database+'.audit-key',database+'.backup.json',join(destination,'recovery-report.json')])await syncFile(path)
   await unlink(marker)
   return result
  }catch(error){throw new Error(`La recuperación no se completó. Conservá el destino para revisión y elegí otra carpeta para reintentar. ${error.message}`)}
 })
}
