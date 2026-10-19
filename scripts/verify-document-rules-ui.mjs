import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Repository} from '../server/repository.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {validateState} from '../.server/domain/validation.js'
import {validateCommercialDocuments} from '../.server/domain/document-rules.js'
import {partyBalance,outstanding} from '../.server/domain/engine.js'
import {accountsAging} from '../.server/domain/accounts-aging.js'

const date='2026-10-18',database='var/qa-document-rules.sqlite'
const source=await Repository.open({filename:database}),temporary=await mkdtemp(join(tmpdir(),'sica-document-rules-recovery-'))
let browser,recovery
try{
 const before=JSON.parse(await readFile('output/qa/document-rules-before.json','utf8')),ids=JSON.parse(await readFile('output/qa/document-rules-context.json','utf8'))
 const {revision,state:s}=source.read();assert.equal(before.revision,1);assert.equal(revision,2)
 assert.equal(s.documents.length,4);assert.deepEqual(s.documents.slice(0,-1),before.state.documents)
 assert.equal(s.entries.length,4);assert.deepEqual(s.entries.slice(0,-1),before.state.entries)
 assert.equal(s.treasuryMoves.length,1);assert.deepEqual(before.state.treasuryMoves,[])
 const receipt=s.documents.at(-1)
 assert.equal(receipt.kind,'cobro');assert.equal(receipt.side,'cliente');assert.equal(receipt.partyId,ids.customerId)
 assert.equal(receipt.number,'INT-RC-X-00001-00000001');assert.equal(receipt.date,date)
 assert.deepEqual([receipt.net,receipt.vat,receipt.perceptions,receipt.total],[5000,0,0,5000])
 assert.deepEqual(receipt.lines,[]);assert.deepEqual(receipt.allocations,[{documentId:ids.invoiceId,amount:3000}])
 assert.deepEqual(receipt.payments,[{method:'Efectivo',amount:5000,treasuryId:'caja-principal',reference:'RC-COMMERCIAL-UI'}])
 assert.equal(receipt.responsible,'Administrador')
 const entry=s.entries.at(-1),cash=s.treasuryMoves[0]
 assert.equal(entry.documentId,receipt.id);assert.equal(cash.documentId,receipt.id);assert.equal(cash.amount,5000);assert.equal(cash.treasuryId,'caja-principal')
 assert.deepEqual(entry.lines,[{accountId:s.settings.accountMap.customers,debit:0,credit:5000},{accountId:s.settings.accountMap.cash,debit:5000,credit:0}])
 const original=structuredClone(s);original.documents=before.state.documents;original.entries=before.state.entries;original.treasuryMoves=before.state.treasuryMoves;assert.deepEqual(original,before.state)
 const current=accountsAging(s,date,'central','cliente',ids.customerId),future=accountsAging(s,'2026-10-20','central','cliente',ids.customerId)
 assert.deepEqual([current.pending,current.unapplied,current.balance,current.difference],[9100,2000,7100,0])
 assert.deepEqual([future.pending,future.unapplied,future.balance,future.difference],[15150,2000,13150,0])
 assert.equal(outstanding(s,s.documents.find(d=>d.id===ids.futureId)),6050)
 assert.equal(partyBalance(s,ids.customerId),13150);assert.equal(partyBalance(s,ids.supplierId),12100)
 assert.equal(source.db.prepare('SELECT count(*) AS count FROM fiscal_jobs').get().count,0)
 validateState(JSON.parse(JSON.stringify(s)));source.verifyAudit();source.assertFiscalState(s)
 browser={database,revision,synthetic:true,documentsPreserved:3,originalEntriesPreserved:3,stockMovesPreserved:2,newReceipt:1,newEntries:1,newTreasuryMoves:1,received:5000,applied:3000,unapplied:2000,futureChargeUntouched:6050,currentCut:{date,pending:9100,unapplied:2000,balance:7100,difference:0},futureCut:{date:'2026-10-20',pending:15150,unapplied:2000,balance:13150,difference:0},futureInputDisabled:true,backdatedApplicationBlocked:true,removalExplicit:true,originalSourcesPreserved:true,externalRequests:0}
 const backup=await source.backupFile(join(temporary,'backup')),inspection=await inspectBackup({filename:backup,expectedCompanyId:'sica'})
 assert.match(inspection.seal,/sello HMAC/)
 const restored=await recoverBackup({filename:backup,destination:join(temporary,'restored'),reason:'Verificar cobro parcial, anticipo y cargos originales con las reglas comerciales compartidas.',operator:'Operador de ensayo',expectedCompanyId:'sica'}),repo=await Repository.open({filename:restored.database})
 try{
  const after=repo.read();assert.equal(after.revision,3);assert.deepEqual(after.state,s)
  assert.deepEqual(accountsAging(after.state,date,'central','cliente',ids.customerId),current)
  assert.deepEqual(accountsAging(after.state,'2026-10-20','central','cliente',ids.customerId),future)
  assert.equal(repo.db.prepare('SELECT count(*) AS count FROM sessions').get().count,0)
  repo.verifyAudit();repo.assertFiscalState(after.state)
  recovery={sourceRevision:2,recoveredRevision:3,sourceSha256:inspection.sha256,seal:inspection.seal,stateAndCredentialsPreserved:true,originalChargesPreserved:3,receiptAndAdvancePreserved:true,agingCutsPreserved:2,revokedSessions:restored.revokedSessions,recoveredSessions:0,audit:'HMAC validada'}
 }finally{await repo.close()}
}finally{await source.close();await rm(temporary,{recursive:true,force:true})}
recovery.temporaryCopyRemovedAfterCheck=true
const previous=JSON.parse(await readFile('output/verification-tax-identity-2026-10-18.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){
 const repo=await Repository.open({filename:c.database,companyId:c.companyId||'sica'})
 try{const current=repo.read();validateState(JSON.parse(JSON.stringify(current.state)));validateCommercialDocuments(current.state);repo.verifyAudit();repo.assertFiscalState(current.state);assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:c.database,companyId:repo.companyId,revision:current.revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON',fiscalSources:'Verificadas',commercialDocuments:current.state.documents.length,legacyZeroAllocations:current.state.documents.reduce((n,d)=>n+d.allocations.filter(a=>a.amount===0).length,0)})}finally{await repo.close()}
}
assert.equal(checks.length,62);assert.equal(checks.reduce((n,c)=>n+c.legacyZeroAllocations,0),4)
const transcripts=['future','stale-date','cleared','recovered'].map(n=>`output/document-rules-${n}-${date}.txt`),texts=await Promise.all(transcripts.map(p=>readFile(p,'utf8')))
assert.match(texts[0],/stepper \(disabled[^\n]*Aplicar INT-FC-A-00001-00000002/)
assert.match(texts[0],/Cargo posterior:/)
assert.match(texts[1],/Value: 2026-10-17/);assert.match(texts[1],/Quitar aplicación futura/);assert.match(texts[1],/button \(disabled\) Guardar operación/)
assert.doesNotMatch(texts[2],/Quitar aplicación futura/);assert.match(texts[2],/button Guardar operación/)
for(const value of ['Versión 2','INT-RC-X-00001-00000001','Aplicaciones al registrar','INT-FC-A-00001-00000001','Importe sin aplicación al registrar:'])assert.ok(texts[3].includes(value),value)
for(const amount of ['50,00','30,00','20,00'])assert.ok(texts[3].includes(amount),amount)
const screenshots=['future','stale-date','recovered'].map(n=>`output/document-rules-${n}-${date}.png`);for(const path of screenshots)assert.ok((await readFile(path)).length>10000)
const tests=[]
for(const [kind,count]of [['domain',600],['fiscal',32],['files',36]]){const path=`output/qa/document-rules-${kind}-final.log`,log=await readFile(path,'utf8');assert.match(log,new RegExp(`(?:#|ℹ) pass ${count}\\s`));assert.match(log,/(?:#|ℹ) fail 0\s/);assert.doesNotMatch(log,/✖|not ok/);tests.push({path,passed:count})}
const selections=await Promise.all(['core','extended'].map(async section=>JSON.parse(await readFile(`output/qa/document-rules-http-${section}-selection.json`,'utf8'))))
const expectedNames=[...(await readFile('scripts/test-server.mjs','utf8')).matchAll(/test\('((?:\\.|[^'])*)'/g)].map(m=>m[1])
const selectedNames=selections.flatMap(selection=>selection.names)
assert.equal(expectedNames.length,86);assert.equal(new Set(selectedNames).size,86);assert.deepEqual([...selectedNames].sort(),[...expectedNames].sort())
const httpSections=[]
for(const selection of selections){const path=`output/qa/document-rules-http-${selection.section}-final.log`,log=await readFile(path,'utf8');assert.equal(selection.total,86);assert.equal(selection.selected,selection.names.length);assert.match(log,new RegExp(`(?:#|ℹ) pass ${selection.selected}\\s`));assert.match(log,/(?:#|ℹ) fail 0\s/);assert.doesNotMatch(log,/✖|not ok/);httpSections.push({path,passed:selection.selected,selection:`output/qa/document-rules-http-${selection.section}-selection.json`})}
tests.push({kind:'http',passed:86,sections:httpSections,coverage:'86 títulos distintos; partición completa sin duplicados'})
assert.match(await readFile('output/qa/document-rules-build-final.log','utf8'),/built in/)
assert.doesNotMatch(await readFile('output/qa/document-rules-lint-final.log','utf8'),/warning|error/i)
const finalHttpPath='output/qa/document-rules-http-focused-final.log',finalHttpLog=await readFile(finalHttpPath,'utf8');assert.match(finalHttpLog,/(?:#|ℹ) pass 4\s/);assert.match(finalHttpLog,/(?:#|ℹ) fail 0\s/);assert.doesNotMatch(finalHttpLog,/✖|not ok/)
const report={date,tests,finalChecks:{domain:'output/qa/document-rules-domain-final.log',http:{path:finalHttpPath,passed:4}},browser,recovery,checks,transcripts,screenshots,limits:['Controles de consistencia interna; no acreditan autenticidad, autorización o tratamiento fiscal de un documento.','Las aplicaciones antiguas de importe cero permanecen sin modificación; las nuevas cargas requieren importes positivos.','La factura recibida puede preceder al remito; las reglas de registro contable posterior a cortes conservan su propio circuito.','No se verificaron eventos de descarga ni exportaciones de las tablas del navegador.','No hubo emisión, presentación, transferencia ni pago real.','El objetivo integral del PPTX permanece abierto.']}
await writeFile(`output/verification-document-rules-${date}.json`,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({tests,browser,recovery,databases:checks.length,legacyZeroAllocationsPreserved:4},null,2))
