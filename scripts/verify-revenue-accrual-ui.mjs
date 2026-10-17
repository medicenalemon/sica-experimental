import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {trialBalance} from '../.server/domain/trial-balance.js'
import {revenueReview,revenueTaxWork} from '../.server/domain/revenue-accruals.js'
const databases=['var/qa-revenue-accrual.sqlite','var/qa-exercise-opening.sqlite','var/qa-year-end.sqlite','var/qa-service-reestimates.sqlite','var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 await access(filename);const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa y recorrido JSON verificados'}
  if(filename==='var/qa-revenue-accrual.sqlite'){
   assert.equal(revision,4);assert.equal(state.revenueAccruals.length,1);assert.equal(state.revenueSettlements.length,1);assert.equal(state.documents.length,2);assert.equal(state.entries.length,5);assert.equal(state.inventoryCostBatches.length,2);assert.equal(state.stockMoves.length,2);assert.equal(state.treasuryMoves.length,0)
   const a=state.revenueAccruals[0],s=state.revenueSettlements[0],source=state.documents.find(d=>d.id===a.sourceId),invoice=state.documents.find(d=>d.id===s.invoiceId),balance=trialBalance(state,'2026-01-01','2026-12-31'),value=id=>balance.rows.find(r=>r.accountId===id).closing
   assert.equal(a.number,'INT-DI-00000001');assert.equal(a.reference,'Entrega textil aceptada QA 2026');assert.equal(a.responsible,'Administrador');assert.equal(a.review,revenueReview(a.preview));assert.deepEqual([a.preview.net,a.preview.vat,a.preview.total],[10000,2100,12100]);assert.equal(a.preview.lines[0].recognition,'Entrega aceptada');assert.ok(a.preview.lines[0].evidence.includes('QA-003'));assert.equal(a.date,source.date);assert.equal(a.date,'2026-10-03');assert.equal(a.preview.lines[0].quantity,5)
   assert.equal(s.number,'INT-CI-00000001');assert.equal(s.accrualId,a.id);assert.equal(s.reference,'Factura de entrega conciliada QA 2026');assert.equal(s.responsible,'Administrador');assert.equal(s.review,revenueReview(s.preview));assert.deepEqual([s.preview.invoiceNet,s.preview.invoiceVat,s.preview.difference,s.preview.vatDifference],[11000,2310,1000,210]);assert.equal(s.date,'2026-10-05');assert.equal(s.preview.salesAccountId,'4.1');assert.equal(s.preview.invoiceVatAccountId,'2.1.2');assert.equal(invoice.sourceId,source.id);assert.equal(invoice.date,'2026-10-05');assert.equal(invoice.total,13310);assert.ok(!invoice.fiscal?.cae)
   assert.equal(value('1.1.12'),0);assert.equal(value('4.2'),-11000);assert.equal(value('4.1'),0);assert.equal(value('2.1.2'),-2310);assert.equal(value('1.1.3'),13310);assert.equal(value(state.settings.accountMap.cogs),5000);assert.equal(value(state.settings.accountMap.inventory),5000);assert.equal(state.stockMoves.reduce((n,m)=>n+m.quantity,0),5)
   const before=revenueTaxWork(state,'2026-01-01','2026-10-03'),after=revenueTaxWork(state,'2026-01-01','2026-10-05');assert.equal(before.length,1);assert.equal(before[0].vat,2100);assert.equal(after.length,2);assert.equal(after.reduce((n,r)=>n+r.vat,0)+invoice.vat,2310);assert.equal(after.reduce((n,r)=>n+r.net,0)+invoice.net,11000)
   check.revenue={accrual:a,settlement:s,invoiceId:invoice.id,balancesCents:{unbilledAsset:0,income:-11000,vat:-2310,customers:13310,inventory:5000,cogs:5000},balance,taxWorkingPaper:{before,after,vatBeforeInvoice:2100,vatAfterSettlement:2310}}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const screenshots=['output/revenue-settlement-2026-10-11.png','output/revenue-vat-work-2026-10-11.png'];for(const path of screenshots)await access(path)
const report={date:'2026-10-11',synthetic:true,tests:{domain:213,files:13,http:37,fiscal:22,total:285},browser:{accrual:'Cinco unidades aceptadas: neto 100 ARS, IVA 21 y activo sin facturar 121',invoice:'Factura interna A del 05/10/2026: neto 110 ARS, IVA 23,10 y saldo de cliente 133,10; sin CAE',settlement:'INT-CI-00000001 conservada después de recargar; activo pendiente cero, diferencias neta 10 e IVA 2,10',taxWorkingPaper:'Al corte 03/10, IVA 21 ARS sin factura; al corte 05/10, IVA 23,10 con devengamiento y descuento separados',screenshots},checks}
await writeFile('output/verification-revenue-accrual-2026-10-11.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,revenue})=>({database,revision,integrity,audit,revenue:revenue?.balancesCents})),null,2))
