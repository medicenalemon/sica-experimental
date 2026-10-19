import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Repository} from '../server/repository.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {validateState} from '../.server/domain/validation.js'
import {taxMovementRows,summarizeTaxMovements} from '../.server/domain/tax-movements.js'
import {taxCertificateFile,taxCertificateOutdated} from '../.server/domain/tax-certificates.js'

const date='2026-10-18',database='var/qa-tax-certificates.sqlite'
const source=await Repository.open({filename:database})
const temporary=await mkdtemp(join(tmpdir(),'sica-tax-certificates-recovery-'))
let browser,recovery
const exports=[]
try{
 const before=JSON.parse(await readFile('output/qa/tax-certificates-before.json','utf8'))
 const preservedFirst=JSON.parse(await readFile('output/qa/tax-certificates-first-saved.json','utf8'))
 const {revision,state:s}=source.read()
 assert.equal(before.revision,1);assert.equal(revision,3)
 const unchanged=structuredClone(s)
 if(Object.hasOwn(before.state,'taxCertificates'))unchanged.taxCertificates=before.state.taxCertificates
 else delete unchanged.taxCertificates
 assert.deepEqual(unchanged,before.state)
 assert.deepEqual([s.documents.length,s.entries.length,s.stockMoves.length,s.cardSettlements.length],[12,13,2,1])
 assert.equal(source.db.prepare('SELECT count(*) AS count FROM fiscal_jobs').get().count,0)
 assert.equal(s.taxCertificates.length,2)
 const [first,second]=s.taxCertificates
 assert.deepEqual(first,preservedFirst)
 assert.equal(first.number,'INT-CCF-00000001');assert.equal(second.number,'INT-CCF-00000002')
 assert.equal(first.rootId,first.id);assert.equal(second.rootId,first.id)
 assert.equal(first.preview.input.previousId,'');assert.equal(second.preview.input.previousId,first.id)
 assert.deepEqual(first.preview.totals,{registered:100,external:250,difference:-150})
 assert.deepEqual(second.preview.totals,{registered:250,external:250,difference:0})
 assert.equal(first.preview.status,'Con diferencia de importe');assert.equal(second.preview.status,'Sin diferencia aritmética')
 assert.equal(first.preview.linked.length,1);assert.equal(first.preview.unselectedReferenceIds.length,1)
 assert.equal(second.preview.linked.length,2);assert.equal(second.preview.unselectedReferenceIds.length,0)
 assert.deepEqual(first.preview.input.evidence,second.preview.input.evidence)
 const evidencePath='output/qa/certificate-evidence-ui.txt'
 const sha256=createHash('sha256').update(await readFile(evidencePath)).digest('hex')
 assert.equal(sha256,'5ddd05b6fb564024da09ad78b5e19006065e7e8c6639b7828d2d7e7ae4b9fefe')
 const directory=`output/tax-certificates-${date}`;await mkdir(directory,{recursive:true})
 for(const [index,record]of s.taxCertificates.entries()){
  const {input}=record.preview
  assert.equal(input.reference,`CERT-COMP-UI-${index+1}`)
  assert.equal(input.from,'2026-01-01');assert.equal(input.to,date);assert.equal(input.reviewedOn,date)
  assert.equal(input.evidence.date,date);assert.equal(input.evidence.fileName,'certificate-evidence-ui.txt')
  assert.equal(input.evidence.sha256,sha256);assert.equal(input.evidence.agentCuit,'20123456786')
  assert.equal(input.evidence.subjectCuit,'30712345671');assert.equal(input.evidence.number,'CERT-SHARED')
  assert.equal(input.confirmed,true);assert.equal(taxCertificateOutdated(s,record),false)
  const file=taxCertificateFile(record),path=join(directory,file.name)
  await writeFile(path,file.bytes)
  assert.deepEqual(await readFile(path),Buffer.from(file.bytes))
  const parsed=JSON.parse(await readFile(path,'utf8'))
  assert.deepEqual(parsed.preview,record.preview);assert.match(parsed.kind,/no es certificado oficial/)
  exports.push({path,sha256:createHash('sha256').update(file.bytes).digest('hex'),bytes:file.bytes.length})
 }
 validateState(JSON.parse(JSON.stringify(s)));source.verifyAudit();source.assertFiscalState(s)
 const rows=taxMovementRows(s)
 browser={database,revision,synthetic:true,comparisons:2,firstUnchanged:true,totals:s.taxCertificates.map(r=>r.preview.totals),linked:[1,2],sharedUnselected:[1,0],fileName:'certificate-evidence-ui.txt',sha256,evidencePath,fileContentStored:false,documents:12,journals:13,stockMoves:2,cardSettlements:1,financialStatePreserved:true,externalRequests:0}
 const backup=await source.backupFile(join(temporary,'backup'))
 const inspection=await inspectBackup({filename:backup,expectedCompanyId:'sica'})
 assert.match(inspection.seal,/sello HMAC/)
 const restored=await recoverBackup({filename:backup,destination:join(temporary,'restored'),reason:'Verificar versiones, respaldo declarado y fuentes impositivas con estado y credenciales conservados.',operator:'Operador de ensayo',expectedCompanyId:'sica'})
 const repo=await Repository.open({filename:restored.database})
 try{
  const after=repo.read();assert.equal(after.revision,4);assert.deepEqual(after.state,s)
  assert.deepEqual(taxMovementRows(after.state),rows)
  for(const [index,record]of after.state.taxCertificates.entries())assert.deepEqual(Buffer.from(taxCertificateFile(record).bytes),await readFile(exports[index].path))
  assert.equal(repo.db.prepare('SELECT count(*) AS count FROM sessions').get().count,0)
  assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok')
  repo.verifyAudit();repo.assertFiscalState(after.state)
  recovery={sourceRevision:3,recoveredRevision:4,sourceSha256:inspection.sha256,seal:inspection.seal,stateAndCredentialsPreserved:true,comparisonsPreserved:2,jsonFilesByteIdentical:true,taxRowsPreserved:rows.length,revokedSessions:restored.revokedSessions,recoveredSessions:0,audit:'HMAC validada'}
 }finally{await repo.close()}
}finally{await source.close();await rm(temporary,{recursive:true,force:true})}
recovery.temporaryCopyRemovedAfterCheck=true

const previous=JSON.parse(await readFile('output/verification-tax-movements-2026-10-17.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){
 const repo=await Repository.open({filename:c.database,companyId:c.companyId||'sica'})
 try{
  const current=repo.read();validateState(JSON.parse(JSON.stringify(current.state)))
  repo.verifyAudit();repo.assertFiscalState(current.state)
  assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok')
  const rows=taxMovementRows(current.state);summarizeTaxMovements(rows)
  checks.push({database:c.database,companyId:repo.companyId,revision:current.revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON',fiscalSources:'Verificadas',taxRows:rows.length,taxComparisons:current.state.taxCertificates?.length||0})
 }finally{await repo.close()}
}
assert.equal(checks.length,60)
const transcripts=['pending','first','history','recovered'].map(n=>`output/tax-certificates-${n}-${date}.txt`)
const texts=await Promise.all(transcripts.map(p=>readFile(p,'utf8')))
assert.match(texts[0],/Con diferencia de importe/);assert.match(texts[0],/1\s+movimiento\(s\)/)
assert.match(texts[1],/Versión 2/);assert.match(texts[1],/INT-CCF-00000001/);assert.match(texts[1],/-\$\s+1,50/)
for(const value of ['Versión 3','CERT-COMP-UI-1','CERT-COMP-UI-2','Versión anterior','Última revisión'])assert.ok(texts[2].includes(value),value)
for(const value of ['Versión 3','INT-CCF-00000002','Sin diferencia aritmética',browser.sha256,'18/10/2026'])assert.ok(texts[3].includes(value),value)
const screenshots=['first','recovered'].map(n=>`output/tax-certificates-${n}-${date}.png`)
for(const path of screenshots)assert.ok((await readFile(path)).length>10000)
const tests=[]
for(const [kind,count]of [['domain',587],['http',84],['fiscal',32],['files',36]]){
 const path=`output/qa/tax-certificates-${kind}-final.log`,log=await readFile(path,'utf8')
 assert.match(log,new RegExp(`(?:#|ℹ) pass ${count}\\s`));assert.match(log,/(?:#|ℹ) fail 0\s/)
 assert.doesNotMatch(log,/✖|not ok/);tests.push({path,passed:count})
}
assert.match(await readFile('output/qa/tax-certificates-build-final.log','utf8'),/built in/)
assert.doesNotMatch(await readFile('output/qa/tax-certificates-lint-final.log','utf8'),/warning|error/i)
const report={date,tests,browser,recovery,checks,exports,transcripts,screenshots,limits:['Datos externos transcritos por el operador; sin constatación, emisión, presentación ni determinación del cómputo fiscal.','La huella es declarada y el contenido del archivo debe conservarse fuera de SICA.','Importes ordinarios en ARS; las identidades históricas faltantes permanecen pendientes.','Se verificaron los bytes JSON; no el evento de descarga ni las exportaciones XLSX/PDF de la tabla en el navegador.','El objetivo integral del PPTX permanece abierto.']}
await writeFile(`output/verification-tax-certificates-${date}.json`,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({tests,browser,recovery,databases:checks.length,exports},null,2))
