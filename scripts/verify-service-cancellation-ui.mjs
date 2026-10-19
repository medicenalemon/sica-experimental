import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {trialBalance} from '../.server/domain/trial-balance.js'
import {serviceReview,serviceEstimate,serviceAccrualActive} from '../.server/domain/service-accruals.js'
const databases=['var/qa-service-cancellation.sqlite','var/qa-journal-reversal.sqlite','var/qa-revenue-accrual.sqlite','var/qa-exercise-opening.sqlite','var/qa-year-end.sqlite','var/qa-service-reestimates.sqlite','var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 await access(filename);const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa después del recorrido JSON'}
  if(filename==='var/qa-service-cancellation.sqlite'){
   assert.equal(revision,3);assert.equal(state.entries.length,4);assert.equal(state.serviceAccruals.length,2);assert.equal(state.serviceReestimates.length,1);assert.equal(state.serviceCancellations.length,1);assert.equal(state.serviceSettlements.length,0);assert.equal(state.documents.length,1);assert.equal(state.stockMoves.length,0);assert.equal(state.treasuryMoves.length,0)
   const [original,corrected]=state.serviceAccruals,c=state.serviceCancellations[0],r=state.serviceReestimates[0],receipt=state.documents[0],entry=state.entries.find(e=>e.id===c.entryId)
   assert.equal(original.number,'INT-DS-00000001');assert.equal(original.preview.total,15000);assert.equal(original.date,'2026-10-03');assert.equal(original.sourceId,receipt.id);assert.equal(r.preview.total,16000);assert.equal(r.date,'2026-10-04');assert.equal(c.number,'INT-AS-00000001');assert.equal(c.date,'2026-10-05');assert.equal(c.reference,'Anulación sintética QA 2026');assert.equal(c.responsible,'Administrador');assert.equal(c.accrualId,original.id);assert.equal(c.review,serviceReview(c.preview));assert.equal(c.preview.accrualReview,original.review);assert.deepEqual(c.preview.reestimates.map(x=>x.id),[r.id]);assert.equal(c.preview.total,16000);assert.deepEqual(c.preview.lines.map(l=>l.value),[13000,3000]);assert.deepEqual(entry.lines,[{accountId:'2.1.7',debit:16000,credit:0},{accountId:'5.8',debit:0,credit:13000},{accountId:'5.1',debit:0,credit:3000}])
   assert.equal(corrected.number,'INT-DS-00000002');assert.equal(corrected.date,'2026-10-06');assert.equal(corrected.reference,'Devengamiento correcto QA 2026');assert.equal(corrected.sourceId,original.sourceId);assert.deepEqual(corrected.lines.map(l=>l.value),[11000,4000]);assert.equal(serviceEstimate(state,original,'2026-10-04').total,16000);assert.equal(serviceEstimate(state,original,'2026-10-05').total,0);assert.equal(serviceAccrualActive(state,original.id),false);assert.equal(serviceAccrualActive(state,corrected.id),true)
   const balance=trialBalance(state,'2026-01-01','2026-12-31'),value=id=>balance.rows.find(r=>r.accountId===id).closing,at=date=>trialBalance(state,'2026-01-01',date).rows.find(r=>r.accountId==='2.1.7').closing
   assert.equal(value('5.8'),11000);assert.equal(value('5.1'),4000);assert.equal(value('2.1.7'),-15000);assert.equal(value('1.1.4'),0);assert.equal(value('2.1.1'),0);assert.equal(at('2026-10-04'),-16000);assert.equal(at('2026-10-05'),0);assert.equal(state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.debit,0),49000);assert.equal(state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.credit,0),49000)
   check.services={original,reestimate:r,cancellation:c,corrected,balance,balancesCents:{cleaning:11000,repair:4000,unbilledServices:-15000,vat:0,suppliers:0,debit:49000,credit:49000}}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const screenshots=['output/service-cancellation-2026-10-11.png','output/service-cancellation-detail-2026-10-11.png'];for(const path of [...screenshots,'output/service-cancellation-browser-2026-10-11.txt'])await access(path)
const report={date:'2026-10-11',synthetic:true,tests:{domain:225,files:13,http:39,fiscal:22,total:299},browser:{result:'Anulación 160 ARS de la estimación vigente; original y reestimación conservados. Nueva carga 110 ARS de limpieza y 40 ARS de reparación, pasivo 150 ARS. Recorrido recargado desde SQLite en versión 3 y constancia recuperada.',screenshots,transcript:'output/service-cancellation-browser-2026-10-11.txt'},checks}
await writeFile('output/verification-service-cancellation-2026-10-11.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,services})=>({database,revision,integrity,audit,services:services?.balancesCents})),null,2))
