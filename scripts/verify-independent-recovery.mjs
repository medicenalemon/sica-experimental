import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {Repository} from '../server/repository.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {fileDigest} from '../server/backup-integrity.mjs'
import {validateState} from '../.server/domain/validation.js'
const baseline=JSON.parse(await readFile('output/verification-multi-company-2026-10-13.json','utf8'))
const run='var/qa-independent-recovery-2026-10-14',checks=[]
await mkdir(run,{recursive:true,mode:0o700})
for(const [index,entry] of baseline.checks.entries()){
 const companyId=entry.companyId||'sica',directory=join(run,String(index+1).padStart(2,'0')),reportPath=join(directory,'result.json')
 await mkdir(directory,{recursive:true,mode:0o700})
 let prior;try{prior=JSON.parse(await readFile(reportPath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const source=await Repository.open({filename:entry.database,companyId})
 let archive
 try{source.verifyAudit();validateState(source.read().state);archive=prior?.archive||await source.backupFile(join(directory,'archive'))}finally{await source.close()}
 const sourceHash=await fileDigest(archive),inspection=await inspectBackup({filename:archive,expectedCompanyId:companyId})
 let original,audit,requests,fiscalJobs,fiscalTickets
 const originalDb=new DatabaseSync(archive,{readOnly:true})
 try{original=JSON.parse(originalDb.prepare('SELECT state FROM companies WHERE id=?').get(companyId).state);audit=originalDb.prepare('SELECT * FROM audit ORDER BY id').all();requests=originalDb.prepare('SELECT * FROM requests ORDER BY request_id').all();fiscalJobs=originalDb.prepare('SELECT * FROM fiscal_jobs ORDER BY document_id').all();fiscalTickets=originalDb.prepare('SELECT * FROM fiscal_tickets ORDER BY issuer').all()}finally{originalDb.close()}
 const recovery=prior?.recovery||await recoverBackup({filename:archive,destination:join(directory,'restored'),expectedCompanyId:companyId,operator:'Verificación de recuperación SICA',reason:'Ensayo independiente de la base sintética; conservar operaciones, usuarios y solicitudes.'})
 const restored=await Repository.open({filename:recovery.database,companyId})
 try{
  const {state,revision}=restored.read();assert.deepEqual(state,original);assert.equal(revision,inspection.companies[0].revision+1);validateState(JSON.parse(JSON.stringify(state)));restored.verifyAudit()
  assert.equal(restored.db.prepare('SELECT count(*) AS count FROM sessions').get().count,0)
  assert.deepEqual(restored.db.prepare('SELECT * FROM audit ORDER BY id').all().slice(0,audit.length),audit)
  assert.deepEqual(restored.db.prepare('SELECT * FROM requests ORDER BY request_id').all(),requests)
  assert.deepEqual(restored.db.prepare('SELECT * FROM fiscal_jobs ORDER BY document_id').all(),fiscalJobs)
  assert.deepEqual(restored.db.prepare('SELECT * FROM fiscal_tickets ORDER BY issuer').all(),fiscalTickets)
  assert.equal(Object.values(restored.db.prepare('PRAGMA integrity_check').get())[0],'ok')
  assert.equal((await stat(recovery.database+'.audit-key')).mode&0o777,0o600)
 }finally{await restored.close()}
 assert.equal(await fileDigest(archive),sourceHash)
 const result={source:entry.database,companyId,archive:resolve(archive),sha256:sourceHash,recovery,unchangedOperationsAndUsers:true,unchangedFiscalHistory:true,unchangedAuditPrefix:true}
 await writeFile(reportPath,JSON.stringify(result,null,2)+'\n',{mode:0o600})
 checks.push({source:entry.database,companyId,archive:resolve(archive),recoveredDatabase:recovery.database,fromRevision:inspection.companies[0].revision,toRevision:recovery.companies[0].revision,revokedSessions:recovery.revokedSessions,financialState:'Conservado íntegramente',fiscal:'Solicitudes y tickets conservados',audit:'Prefijo original y nueva constancia HMAC verificados',integrity:'ok'})
}
const report={date:'2026-10-14',synthetic:true,recoveries:checks.length,archiveSeal:'SHA-256 y HMAC',allUsersAndOperationsPreserved:true,oldSessionsRevoked:true,checks}
await writeFile('output/verification-independent-recovery-2026-10-14.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({recoveries:checks.length,archiveSeal:report.archiveSeal,allUsersAndOperationsPreserved:true,oldSessionsRevoked:true},null,2))
