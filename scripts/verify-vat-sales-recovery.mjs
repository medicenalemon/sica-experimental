import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Repository} from '../server/repository.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {vatSalesFiles} from '../.server/domain/vat-sales.js'
const directory=await mkdtemp(join(tmpdir(),'sica-vat-sales-recovery-')),source=await Repository.open({filename:'var/qa-vat-sales.sqlite'});let result
try{
 const before=source.read();assert.equal(before.revision,15);assert.equal(before.state.vatSales.length,2);const jobs=source.db.prepare('SELECT * FROM fiscal_jobs ORDER BY document_id').all(),backup=await source.backupFile(join(directory,'backups')),inspection=await inspectBackup({filename:backup,expectedCompanyId:'sica'});assert.match(inspection.seal,/sello HMAC/)
 const restored=await recoverBackup({filename:backup,destination:join(directory,'restored'),reason:'Verificar recuperación independiente de las preparaciones de ventas y de sus autorizaciones originales.',operator:'Operador de ensayo',expectedCompanyId:'sica'}),repo=await Repository.open({filename:restored.database})
 try{const after=repo.read();assert.equal(after.revision,16);assert.deepEqual(after.state,before.state);assert.deepEqual(repo.db.prepare('SELECT * FROM fiscal_jobs ORDER BY document_id').all(),jobs);assert.equal(repo.db.prepare('SELECT count(*) AS count FROM sessions').get().count,0);repo.verifyAudit();repo.assertFiscalState(after.state);for(const [i,r]of after.state.vatSales.entries())assert.deepEqual(vatSalesFiles(r),vatSalesFiles(before.state.vatSales[i]));result={sourceDatabase:'var/qa-vat-sales.sqlite',sourceRevision:15,recoveredRevision:16,sourceSha256:inspection.sha256,seal:inspection.seal,temporaryCopyValidated:true,temporaryCopyRemovedAfterCheck:true,statePreserved:true,credentialsPreserved:true,fiscalAuthorizationsPreserved:jobs.length,preparationsPreserved:2,filesPreserved:true,recoveredSessions:0,audit:'HMAC validada',fiscalSources:'Coinciden con las autorizaciones originales'}}finally{await repo.close()}
}finally{await source.close();await rm(directory,{recursive:true,force:true})}
await writeFile('output/qa/vat-sales-independent-recovery.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
