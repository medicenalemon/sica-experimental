import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {trialBalance} from '../.server/domain/trial-balance.js'
import {journalReversalReview} from '../.server/domain/journal-reversals.js'
const databases=['var/qa-journal-reversal.sqlite','var/qa-revenue-accrual.sqlite','var/qa-exercise-opening.sqlite','var/qa-year-end.sqlite','var/qa-service-reestimates.sqlite','var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 await access(filename);const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa después del recorrido JSON'}
  if(filename==='var/qa-journal-reversal.sqlite'){
   assert.equal(revision,3);assert.equal(state.entries.length,3);assert.equal(state.journalReversals.length,1);assert.equal(state.documents.length,0);assert.equal(state.stockMoves.length,0);assert.equal(state.treasuryMoves.length,0)
   const r=state.journalReversals[0],source=state.entries.find(e=>e.id===r.entryId),reversal=state.entries.find(e=>e.id===r.reversalEntryId),corrected=state.entries.find(e=>e.concept==='Gasto corregido QA 2026')
   assert.equal(r.number,'INT-RA-00000001');assert.equal(r.reference,'Reversión sintética QA 2026');assert.equal(r.responsible,'Administrador');assert.equal(r.date,'2026-10-04');assert.equal(r.review,journalReversalReview(r.preview));assert.deepEqual(source,r.preview.source);assert.equal(source.concept,'Gasto sintético duplicado QA');assert.equal(source.date,'2026-10-03');assert.equal(source.manual,true);assert.equal(corrected.manual,true);assert.equal(corrected.date,'2026-10-04')
   assert.deepEqual(source.lines,[{accountId:'5.1',debit:15000,credit:0},{accountId:'2.1.1',debit:0,credit:15000}]);assert.deepEqual(reversal.lines,source.lines.map(l=>({accountId:l.accountId,debit:l.credit,credit:l.debit})));assert.deepEqual(corrected.lines,[{accountId:'5.1',debit:10000,credit:0},{accountId:'2.1.1',debit:0,credit:10000}])
   const balance=trialBalance(state,'2026-01-01','2026-12-31'),value=id=>balance.rows.find(r=>r.accountId===id).closing
   assert.equal(value('5.1'),10000);assert.equal(value('2.1.1'),-10000);assert.equal(state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.debit,0),40000);assert.equal(state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.credit,0),40000)
   check.reversal={record:r,original:source,counterpart:reversal,corrected,balance,balancesCents:{expense:10000,suppliers:-10000,debit:40000,credit:40000}}
  }
  checks.push(check)
 }finally{await repository.close()}
}
await access('output/journal-reversal-browser-2026-10-11.txt')
const report={date:'2026-10-11',synthetic:true,tests:{domain:218,files:13,http:38,fiscal:22,total:291},browser:{result:'Original 150 ARS conservado, reversión 150 ARS y asiento correcto 100 ARS; constancia consultada después de recargar, versión 3',transcript:'output/journal-reversal-browser-2026-10-11.txt',screenshot:'Las API documentadas de captura devolvieron Unable to capture screenshot; no se generó una imagen de evidencia.'},checks}
await writeFile('output/verification-journal-reversal-2026-10-11.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,reversal})=>({database,revision,integrity,audit,reversal:reversal?.balancesCents})),null,2))
