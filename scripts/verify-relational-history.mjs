import assert from 'node:assert/strict'
import {DatabaseSync,backup} from 'node:sqlite'
import {readdir,mkdtemp,rm,copyFile,mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {Repository} from '../server/repository.mjs'
import {assertRelationalStore,relationalTables} from '../server/relational-store.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {validateState} from '../.server/domain/validation.js'
import {fileDigest} from '../server/backup-integrity.mjs'

// Every source stays read-only. The migration and recovery operate on copies.
const temporary=await mkdtemp(join(tmpdir(),'sica-history-relational-')),checks=[],startedAt=new Date().toISOString()
await mkdir('output/qa/relational',{recursive:true,mode:0o700})
try{
 const names=(await readdir('var')).filter(name=>name.endsWith('.sqlite')).sort()
 assert.ok(names.length,'No se encontraron bases históricas para verificar.')
 for(const [index,name] of names.entries()){
  const source=resolve('var',name),filename=join(temporary,name),sourceDigest=await fileDigest(source),db=new DatabaseSync(source,{readOnly:true})
  let original,audit,jobs,tickets
  try{
   db.exec('BEGIN');original=db.prepare('SELECT id,revision,state FROM companies ORDER BY id').all();audit=db.prepare('SELECT * FROM audit ORDER BY id').all();jobs=db.prepare('SELECT * FROM fiscal_jobs ORDER BY company_id,environment,document_id').all();tickets=db.prepare('SELECT * FROM fiscal_tickets ORDER BY company_id,environment,issuer').all()
   await backup(db,filename);db.exec('COMMIT')
  }finally{db.close()}
  await copyFile(source+'.audit-key',filename+'.audit-key')
  for(const company of original){
   const repo=await Repository.open({filename,companyId:company.id})
   try{
    const state=JSON.parse(company.state),current=repo.read();assert.equal(current.revision,company.revision);assert.deepEqual(current.state,state);validateState(current.state);assertRelationalStore(repo.db,company.id,state);repo.verifyAudit();repo.assertFiscalState(state)
    assert.deepEqual(repo.db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(repo.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(repo.db.prepare('SELECT * FROM audit ORDER BY id').all(),audit);assert.deepEqual(repo.db.prepare('SELECT * FROM fiscal_jobs ORDER BY company_id,environment,document_id').all(),jobs);assert.deepEqual(repo.db.prepare('SELECT * FROM fiscal_tickets ORDER BY company_id,environment,issuer').all(),tickets)
    const sealed=await repo.backupFile(join(temporary,'backups')),inspection=await inspectBackup({filename:sealed}),recovered=await recoverBackup({filename:sealed,destination:join(temporary,`recovered-${index}-${company.id}`),reason:'Ensayo de migración relacional y recuperación independiente.'}),restored=await Repository.open({filename:recovered.database,companyId:company.id})
    try{
     assert.deepEqual(restored.read().state,state);assert.equal(restored.read().revision,company.revision+1);assertRelationalStore(restored.db,company.id,state);restored.verifyAudit();restored.assertFiscalState(state);assert.equal(restored.db.prepare('SELECT count(*) AS n FROM sessions').get().n,0)
     checks.push({database:source,companyId:company.id,revision:Number(company.revision),sourceSha256:sourceDigest,migration:'ok; estado y revisión conservados',relationalTables:relationalTables.length,documents:state.documents.length,entries:state.entries.length,stockMoves:state.stockMoves.length,treasuryMoves:state.treasuryMoves.length,legacyZeroAllocations:state.documents.flatMap(d=>d.allocations).filter(a=>a.amount===0).length,integrity:inspection.integrity,audit:inspection.audit,fiscalJobs:jobs.filter(r=>r.company_id===company.id).length,recovery:'ok; estado conservado, sesiones revocadas'})
    }finally{await restored.close()}
   }finally{await repo.close()}
  }
  assert.equal(await fileDigest(source),sourceDigest,'La base de origen cambió durante el ensayo.')
  console.log(`${index+1}/${names.length}: ${name} — migración, integridad, auditoría y recuperación OK`)
 }
 const report={startedAt,finishedAt:new Date().toISOString(),node:process.version,ok:true,sourceFilesUnmodified:true,arca:'Sin conexiones externas',databases:checks.length,checks}
 await writeFile('output/qa/relational/history.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(`Verificadas ${checks.length} bases; informe: output/qa/relational/history.json`)
}finally{await rm(temporary,{recursive:true,force:true})}
