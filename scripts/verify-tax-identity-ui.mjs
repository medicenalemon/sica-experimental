import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Repository} from '../server/repository.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {validateState} from '../.server/domain/validation.js'
import {taxMovementRows,summarizeTaxMovements} from '../.server/domain/tax-movements.js'
import {previewTaxCertificate} from '../.server/domain/tax-certificates.js'

const date='2026-10-18',database='var/qa-tax-identity.sqlite'
const source=await Repository.open({filename:database}),temporary=await mkdtemp(join(tmpdir(),'sica-tax-identity-recovery-'))
let browser,recovery
try{
 const before=JSON.parse(await readFile('output/qa/tax-identity-before.json','utf8'))
 const ids=JSON.parse(await readFile('output/qa/tax-identity-context.json','utf8'))
 const invalid=JSON.parse(await readFile('output/qa/tax-identity-invalid-state.json','utf8'))
 assert.equal(invalid.revision,1);assert.equal(invalid.stateUnchanged,true)
 const {revision,state:s}=source.read();assert.equal(before.revision,1);assert.equal(revision,4)
 assert.equal(s.documents.length,4);assert.deepEqual(s.documents,before.state.documents)
 assert.equal(s.entries.length,before.state.entries.length+1);assert.deepEqual(s.entries.slice(0,-1),before.state.entries)
 assert.equal(s.treasuryMoves.length,before.state.treasuryMoves.length+1);assert.deepEqual(s.treasuryMoves.slice(0,-1),before.state.treasuryMoves)
 assert.equal(s.cardSettlements.length,1);const settlement=s.cardSettlements[0]
 assert.equal(settlement.reference,'LIQ-IDENTITY-UI');assert.equal(settlement.date,date)
 assert.deepEqual([settlement.gross,settlement.fee,settlement.net],[10000,100,9500])
 assert.deepEqual(settlement.items,[{receiptId:ids.couponId,paymentIndex:0,amount:10000}])
 assert.equal(s.entries.at(-1).documentId,settlement.id)
 assert.deepEqual(s.entries.at(-1).lines,[{accountId:s.settings.accountMap.bank,debit:9500,credit:0},{accountId:s.settings.accountMap.cardFees,debit:100,credit:0},{accountId:s.settings.accountMap.withholdingCredit,debit:400,credit:0},{accountId:s.settings.accountMap.cardReceivables,debit:0,credit:10000}])
 assert.equal(s.treasuryMoves.at(-1).documentId,settlement.id);assert.equal(s.treasuryMoves.at(-1).amount,9500)
 const [known,pending]=settlement.withholdings
 assert.deepEqual(known.taxIdentity,{version:1,origin:'Agente declarado en liquidación',company:{name:before.state.settings.name,cuit:'30712345671'},counterparty:{name:'Agente textil de ensayo',cuit:'20123456786'},unknownReason:''})
 assert.equal(known.reference,'CERT-KNOWN-UI');assert.equal(known.amount,250)
 assert.equal(pending.reference,'CERT-PENDING-UI');assert.equal(pending.amount,150)
 assert.equal(pending.taxIdentity.origin,'Agente sin identificar');assert.deepEqual(pending.taxIdentity.counterparty,{name:'',cuit:''})
 assert.equal(pending.taxIdentity.unknownReason,'El respaldo sintético no identifica al agente de esta deducción; se conserva pendiente de revisión.')
 for(const w of settlement.withholdings){assert.equal(w.agent,undefined);assert.equal(w.agentUnknownReason,undefined)}
 const customer=s.parties.find(p=>p.id===ids.customerId),card=s.masters.cards.find(c=>c.id==='visa')
 assert.equal(customer.name,'Cliente posterior de ensayo');assert.equal(customer.cuit,'20345678922');assert.equal(card.name,'Marca posterior de ensayo')
 const original=structuredClone(s)
 original.cardSettlements=before.state.cardSettlements;original.entries=before.state.entries;original.treasuryMoves=before.state.treasuryMoves
 const oldCustomer=before.state.parties.find(p=>p.id===ids.customerId),oldCard=before.state.masters.cards.find(c=>c.id==='visa')
 Object.assign(original.parties.find(p=>p.id===ids.customerId),{name:oldCustomer.name,cuit:oldCustomer.cuit})
 original.masters.cards.find(c=>c.id==='visa').name=oldCard.name
 assert.deepEqual(original,before.state)
 const rows=taxMovementRows(s),summary=summarizeTaxMovements(rows)
 assert.equal(rows.length,5);assert.deepEqual(summary.totals,{withheldSuffered:600,withheldPracticed:0,perceivedSuffered:50,perceivedPracticed:100})
 assert.equal(summary.pending,1)
 for(const row of rows.filter(r=>r.id.includes(ids.invoiceId)||r.id.includes(ids.receiptId))){assert.equal(row.partyName,oldCustomer.name);assert.equal(row.partyCuit,oldCustomer.cuit);assert.equal(row.identitySource,'Catálogo al registrar')}
 const legacy=rows.find(r=>r.id.includes(ids.legacyId));assert.equal(legacy.identitySource,undefined);assert.equal(legacy.recordedCompany,undefined)
 const knownRow=rows.find(r=>r.reference==='CERT-KNOWN-UI'),pendingRow=rows.find(r=>r.reference==='CERT-PENDING-UI')
 assert.equal(knownRow.partyName,'Agente textil de ensayo');assert.equal(knownRow.partyCuit,'20123456786');assert.deepEqual(knownRow.identityIssues,[])
 assert.equal(pendingRow.partyName,'Agente sin identificar');assert.equal(pendingRow.partyCuit,'');assert.ok(pendingRow.identityIssues.some(i=>i.includes('Agente no identificado')))
 const input={from:'2026-01-01',to:date,reviewedOn:date,previousId:'',reference:'PREVIEW-IDENTITY-UI',reason:'Ensayo de lectura con identidad conservada, sin guardar otra comparación.',confirmed:true,links:[{rowId:knownRow.id,reason:''}],evidence:{origin:'Certificado recibido',number:'CERT-KNOWN-UI',date,regime:'Régimen sintético de ensayo',type:'Retención',effect:'Sufrida',tax:'Ingresos Brutos',jurisdiction:'Tucumán',agentCuit:'20123456786',agentName:'Agente textil de ensayo',subjectCuit:s.settings.cuit,subjectName:s.settings.name,amount:250,state:'Informado como vigente',sourceReference:'Documento sintético de ensayo, sin constatación externa',fileName:'',sha256:''}}
 const comparison=previewTaxCertificate(s,input);assert.equal(comparison.status,'Sin diferencia aritmética');assert.equal(comparison.totals.difference,0)
 const pendingComparison=previewTaxCertificate(s,{...input,reference:'PREVIEW-PENDING-UI',links:[{rowId:pendingRow.id,reason:'El origen no identifica al agente; el respaldo requiere comprobación.'}],evidence:{...input.evidence,number:'CERT-PENDING-UI',amount:150}})
 assert.equal(pendingComparison.status,'Identificación pendiente');assert.equal(pendingComparison.totals.difference,0)
 assert.equal(source.db.prepare('SELECT count(*) AS count FROM fiscal_jobs').get().count,0)
 validateState(JSON.parse(JSON.stringify(s)));source.verifyAudit();source.assertFiscalState(s)
 browser={database,revision,synthetic:true,documentsPreserved:4,originalEntriesPreserved:before.state.entries.length,newSettlementEntries:1,stockMovesPreserved:s.stockMoves.length,newTreasuryMoves:1,gross:10000,fee:100,withheld:400,net:9500,knownAgents:1,pendingAgents:1,catalogueRenamed:true,sourceIdentityPreserved:true,legacyIdentityInvented:false,invalidCuitRejectedWithoutMutation:true,totals:summary.totals,taxRows:5,comparisonStatuses:[comparison.status,pendingComparison.status],externalRequests:0}
 const backup=await source.backupFile(join(temporary,'backup')),inspection=await inspectBackup({filename:backup,expectedCompanyId:'sica'})
 assert.match(inspection.seal,/sello HMAC/)
 const restored=await recoverBackup({filename:backup,destination:join(temporary,'restored'),reason:'Verificar identidad impositiva conservada, pendientes y fuentes después de editar catálogos.',operator:'Operador de ensayo',expectedCompanyId:'sica'}),repo=await Repository.open({filename:restored.database})
 try{
  const after=repo.read();assert.equal(after.revision,5);assert.deepEqual(after.state,s);assert.deepEqual(taxMovementRows(after.state),rows)
  assert.equal(repo.db.prepare('SELECT count(*) AS count FROM sessions').get().count,0)
  repo.verifyAudit();repo.assertFiscalState(after.state)
  recovery={sourceRevision:4,recoveredRevision:5,sourceSha256:inspection.sha256,seal:inspection.seal,stateAndCredentialsPreserved:true,taxRowsPreserved:5,declaredAgentPreserved:true,pendingReasonPreserved:true,revokedSessions:restored.revokedSessions,recoveredSessions:0,audit:'HMAC validada'}
 }finally{await repo.close()}
}finally{await source.close();await rm(temporary,{recursive:true,force:true})}
recovery.temporaryCopyRemovedAfterCheck=true
const previous=JSON.parse(await readFile('output/verification-tax-certificates-2026-10-18.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){
 const repo=await Repository.open({filename:c.database,companyId:c.companyId||'sica'})
 try{const current=repo.read();validateState(JSON.parse(JSON.stringify(current.state)));repo.verifyAudit();repo.assertFiscalState(current.state);assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok');const rows=taxMovementRows(current.state);summarizeTaxMovements(rows);checks.push({database:c.database,companyId:repo.companyId,revision:current.revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON',fiscalSources:'Verificadas',taxRows:rows.length})}finally{await repo.close()}
}
assert.equal(checks.length,61)
const transcripts=['invalid','settlement','catalogue','report','recovered'].map(n=>`output/tax-identity-${n}-${date}.txt`),texts=await Promise.all(transcripts.map(p=>readFile(p,'utf8')))
assert.match(texts[0],/CUIT válido del agente/);assert.match(texts[0],/Versión 1/)
for(const value of ['Versión 2','Agente textil de ensayo','20123456786','Agente sin identificar','CERT-KNOWN-UI','CERT-PENDING-UI'])assert.ok(texts[1].includes(value),value)
assert.match(texts[2],/Versión 4/);assert.match(texts[2],/Cliente posterior de ensayo/);assert.match(texts[2],/20345678922/)
for(const index of [3,4])for(const value of ['Versión 4','Cliente mayorista de prueba','20123456786','Catálogo al registrar','Agente declarado en liquidación','Catálogo actual · identidad histórica no conservada','Agente no identificado:','CERT-PENDING-UI'])assert.ok(texts[index].includes(value),value)
const screenshots=['settlement','report','recovered'].map(n=>`output/tax-identity-${n}-${date}.png`);for(const path of screenshots)assert.ok((await readFile(path)).length>10000)
const tests=[]
for(const [kind,count]of [['domain',593],['http',85],['fiscal',32],['files',36]]){const path=`output/qa/tax-identity-${kind}-final.log`,log=await readFile(path,'utf8');assert.match(log,new RegExp(`(?:#|ℹ) pass ${count}\\s`));assert.match(log,/(?:#|ℹ) fail 0\s/);assert.doesNotMatch(log,/✖|not ok/);tests.push({path,passed:count})}
const finalHttp=await readFile('output/qa/tax-identity-http-focused-final.log','utf8');assert.match(finalHttp,/(?:#|ℹ) pass 3\s/);assert.match(finalHttp,/(?:#|ℹ) fail 0\s/);assert.doesNotMatch(finalHttp,/✖|not ok/)
assert.match(await readFile('output/qa/tax-identity-build-final.log','utf8'),/built in/)
assert.doesNotMatch(await readFile('output/qa/tax-identity-lint-final.log','utf8'),/warning|error/i)
const report={date,tests,browser,recovery,checks,transcripts,screenshots,limits:['Identidad declarada en el catálogo o transcrita de un respaldo; sin validación de autenticidad, inscripción ni condición de agente.','Los históricos sin identidad conservada muestran el catálogo actual expresamente identificado; no se reconstruye retrospectivamente su identidad.','La identidad incompleta o del agente desconocido permanece pendiente aunque coincidan los importes.','No hubo consulta, emisión, presentación ni cómputo fiscal real.','No se verificaron eventos de descarga ni exportaciones de estas tablas en el navegador.','El objetivo integral del PPTX continúa abierto.']}
await writeFile(`output/verification-tax-identity-${date}.json`,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({tests,browser,recovery,databases:checks.length},null,2))
