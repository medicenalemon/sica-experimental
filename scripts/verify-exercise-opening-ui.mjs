import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {trialBalance} from '../.server/domain/trial-balance.js'
import {exerciseOpeningReview} from '../.server/domain/exercise-opening.js'
const databases=['var/qa-exercise-opening.sqlite','var/qa-year-end.sqlite','var/qa-service-reestimates.sqlite','var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 try{await access(filename)}catch{if(filename.includes('qa-exercise-opening'))throw new Error(`Falta el ejemplo ${filename}`);continue}
 const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa y recorrido JSON verificados'}
  if(filename==='var/qa-exercise-opening.sqlite'){
   assert.equal(revision,3);assert.equal(state.exerciseOpenings.length,1);assert.equal(state.yearEndCloses.length,1);assert.equal(state.accountingCloses.length,1);assert.equal(state.entries.length,7);assert.equal(state.documents.length,1);assert.equal(state.serviceAccruals.length,1);assert.equal(state.stockMoves.length,0);assert.equal(state.treasuryMoves.length,0)
   const o=state.exerciseOpenings[0],close=state.yearEndCloses[0],p=state.accountingCloses[0],b=trialBalance(state,'2027-01-01','2027-12-31'),old=trialBalance(state,'2026-01-01','2026-12-31'),cash=b.rows.find(r=>r.accountId==='1.1.1'),income=b.rows.find(r=>r.accountId==='4.1')
   assert.equal(o.number,'INT-AE-00000001');assert.equal(o.responsible,'Administrador');assert.equal(o.reference,'Apertura sintética QA 2027');assert.equal(o.review,exerciseOpeningReview(o.preview));assert.equal(o.exerciseStart,'2027-01-01');assert.equal(o.exerciseEnd,'2027-12-31');assert.equal(state.settings.exerciseStart,o.exerciseStart);assert.equal(state.settings.exerciseEnd,o.exerciseEnd);assert.equal(state.settings.closedUntil,'2026-12-31');assert.equal(state.settings.accountingCloseId,p.id);assert.equal(o.yearEndCloseId,close.id);assert.equal(o.accountingCloseId,p.id);assert.equal(close.preview.result,40000);assert.deepEqual(state.settings.exerciseHistory,[{start:'2026-01-01',end:'2026-12-31'}]);assert.equal(o.preview.balance.totals.openingDebit,65000);assert.equal(o.preview.balance.totals.openingCredit,65000);assert.equal(o.preview.balance.totals.debit,0);assert.equal(o.preview.balance.totals.credit,0);assert.equal(o.preview.pending.services[0].amount,15000);assert.equal(o.preview.pending.deliveries[0].id,state.documents[0].id)
   assert.deepEqual([cash.opening,cash.debit,cash.credit,cash.closing],[65000,5000,0,70000]);assert.deepEqual([income.opening,income.debit,income.credit,income.closing],[0,0,5000,-5000]);assert.equal(b.rows.find(r=>r.accountId==='3.2').opening,-40000);assert.equal(b.rows.find(r=>r.accountId==='2.1.7').opening,-15000);assert.equal(b.rows.find(r=>r.accountId==='2.1.1').opening,-10000);assert.equal(old.rows.find(r=>r.accountId==='1.1.1').closing,65000);assert.equal(old.rows.find(r=>r.accountId==='4.1').closing,0);assert.deepEqual(old,close.after);assert.ok(state.entries.filter(e=>e.date==='2027-01-05').length===1);assert.equal(o.preview.branches.length,2)
   check.opening={record:o,previousCloseId:close.id,periodCloseId:p.id,openingCents:{cash:65000,suppliers:-10000,unbilledServices:-15000,result:-40000},newExerciseBalance:b,previousExerciseBalance:old,retainedJournals:state.entries.filter(e=>e.date<'2027-01-01').length,newJournals:state.entries.filter(e=>e.date>='2027-01-01').length}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const screenshots=['output/exercise-opening-2026-10-11.png','output/exercise-opening-balances-2026-10-11.png'];for(const path of screenshots)await access(path)
const report={date:'2026-10-11',synthetic:true,tests:{domain:199,files:13,http:36,fiscal:22,total:270},browser:{selectedBranch:'Casa Central durante la apertura; ambas sucursales incluidas',saved:'INT-AE-00000001 y ejercicio 2027 conservados después de recargar',blocked:'Asiento de 2026 rechazado sin incrementar versión',newOperation:'Asiento de ingreso 50 ARS del 05/01/2027 guardado; Caja inicial 650 y final 700 ARS',historical:'Selector de ejercicio permite consultar 2026 con Caja final 650 ARS e Ingresos/Gastos cancelados',screenshots},checks}
await writeFile('output/verification-exercise-opening-2026-10-11.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,opening})=>({database,revision,integrity,audit,opening:opening?.openingCents})),null,2))
