import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {serviceReview} from '../.server/domain/service-accruals.js'
const databases=['var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 try{await access(filename)}catch{if(filename.includes('service-accruals'))throw new Error(`Falta el ejemplo ${filename}`);continue}
 const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa y recorrido JSON verificados'}
  if(filename==='var/qa-service-accruals.sqlite'){
   assert.equal(revision,4);assert.equal(state.serviceAccruals.length,1);assert.equal(state.serviceSettlements.length,1)
   const accrual=state.serviceAccruals[0],settlement=state.serviceSettlements[0],invoice=state.documents.find(d=>d.id===settlement.invoiceId),balance=id=>state.entries.flatMap(e=>e.lines).filter(l=>l.accountId===id).reduce((n,l)=>n+l.debit-l.credit,0)
   assert.equal(accrual.number,'INT-DS-00000001');assert.equal(accrual.date,'2026-10-03');assert.equal(accrual.preview.total,15000);assert.equal(accrual.responsible,'Administrador');assert.equal(accrual.review,serviceReview(accrual.preview))
   assert.equal(settlement.number,'INT-CS-00000001');assert.equal(settlement.date,'2026-10-09');assert.equal(settlement.preview.invoiceValue,16000);assert.equal(settlement.preview.difference,1000);assert.equal(settlement.responsible,'Administrador');assert.equal(settlement.review,serviceReview(settlement.preview))
   assert.equal(invoice.date,'2026-10-09');assert.equal(invoice.total,19360);assert.equal(invoice.vat,3360);assert.equal(state.documents.length,2);assert.equal(state.stockMoves.length,0);assert.equal(state.treasuryMoves.length,0);assert.equal(state.entries.length,3)
   const balances={expenseCleaning:balance('5.8'),expenseRepair:balance('5.1'),estimatedLiability:balance('2.1.7'),vatReference:balance('1.1.4'),suppliers:balance('2.1.1')};assert.deepEqual(balances,{expenseCleaning:12000,expenseRepair:4000,estimatedLiability:0,vatReference:3360,suppliers:-19360})
   check.services={accrual:{number:accrual.number,date:accrual.date,reference:accrual.reference,reason:accrual.reason,preview:accrual.preview},settlement:{number:settlement.number,date:settlement.date,reference:settlement.reference,reason:settlement.reason,preview:settlement.preview},balancesCents:balances,entries:state.entries}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const report={date:'2026-10-09',synthetic:true,tests:{domain:171,files:13,http:33,fiscal:22,total:239},browser:{accrual:'Estimación 150 ARS, limpieza/reparación y cuentas revisadas antes de registrar',invoice:'Factura interna A por 193,60 ARS registrada desde su recepción; 160 netos y 33,60 IVA',settlement:'Constancia y asiento revisados; diferencia de 10 ARS y estado Conciliado confirmados',screenshot:'output/service-accruals-2026-10-09.png'},checks}
await writeFile('output/verification-services-2026-10-09.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,services})=>({database,revision,integrity,audit,balances:services?.balancesCents})),null,2))
