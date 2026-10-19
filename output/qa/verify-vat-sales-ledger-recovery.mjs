import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Repository} from '../../server/repository.mjs'
import {inspectBackup,recoverBackup} from '../../server/recovery.mjs'
import {vatSalesFiles} from '../../.server/domain/vat-sales.js'
import {vatSalesLedgerFile} from '../../.server/domain/vat-sales-ledger.js'
const directory=await mkdtemp(join(tmpdir(),'sica-vat-sales-ledger-recovery-')),source=await Repository.open({filename:'var/qa-vat-sales-ledger.sqlite'});let result
try{
 const before=source.read();assert.equal(before.revision,19);assert.equal(before.state.vatSalesLedger.length,2)
 const jobs=source.db.prepare('SELECT * FROM fiscal_jobs ORDER BY document_id').all(),backup=await source.backupFile(join(directory,'backups')),inspection=await inspectBackup({filename:backup,expectedCompanyId:'sica'});assert.match(inspection.seal,/sello HMAC/)
 const restored=await recoverBackup({filename:backup,destination:join(directory,'restored'),reason:'Verificar las conciliaciones contables, ingresos previos y autorizaciones fiscales conservadas.',operator:'Operador de ensayo',expectedCompanyId:'sica'}),repo=await Repository.open({filename:restored.database})
 try{
  const after=repo.read();assert.equal(after.revision,20);assert.deepEqual(after.state,before.state);assert.deepEqual(repo.db.prepare('SELECT * FROM fiscal_jobs ORDER BY document_id').all(),jobs);assert.equal(jobs.length,5);assert.equal(repo.db.prepare('SELECT count(*) AS count FROM sessions').get().count,0);repo.verifyAudit();repo.assertFiscalState(after.state)
  for(const [i,r]of after.state.vatSalesLedger.entries())assert.deepEqual(vatSalesLedgerFile(r),vatSalesLedgerFile(before.state.vatSalesLedger[i]))
  for(const [i,r]of after.state.vatSales.entries())assert.deepEqual(vatSalesFiles(r),vatSalesFiles(before.state.vatSales[i]))
  result={sourceDatabase:'var/qa-vat-sales-ledger.sqlite',sourceRevision:19,recoveredRevision:20,sourceSha256:inspection.sha256,seal:inspection.seal,temporaryCopyValidated:true,statePreserved:true,credentialsPreserved:true,filesPreserved:true,fiscalAuthorizationsPreserved:jobs.length,ledgerReviewsPreserved:2,salesPreparationsPreserved:1,revokedSessions:restored.revokedSessions,recoveredSessions:0,audit:'HMAC validada'}
 }finally{await repo.close()}
}finally{await source.close();await rm(directory,{recursive:true,force:true})}
result.temporaryCopyRemovedAfterCheck=true
await writeFile('output/qa/vat-sales-ledger-independent-recovery.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
