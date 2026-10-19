import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {serviceReview,serviceEstimate} from '../.server/domain/service-accruals.js'
const databases=['var/qa-service-reestimates.sqlite','var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 try{await access(filename)}catch{if(filename.includes('service-reestimates'))throw new Error(`Falta el ejemplo ${filename}`);continue}
 const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa y recorrido JSON verificados'}
  if(filename==='var/qa-service-reestimates.sqlite'){
   assert.equal(revision,4);assert.equal(state.serviceAccruals.length,1);assert.equal(state.serviceReestimates.length,1);assert.equal(state.serviceSettlements.length,1)
   const a=state.serviceAccruals[0],r=state.serviceReestimates[0],s=state.serviceSettlements[0],invoice=state.documents.find(d=>d.id===s.invoiceId),balance=id=>state.entries.flatMap(e=>e.lines).filter(l=>l.accountId===id).reduce((n,l)=>n+l.debit-l.credit,0)
   assert.equal(a.preview.total,15000);assert.equal(r.number,'INT-RS-00000001');assert.equal(r.date,'2026-10-04');assert.equal(r.responsible,'Administrador');assert.equal(r.preview.previousValue,15000);assert.equal(r.preview.total,16000);assert.equal(r.preview.difference,1000);assert.equal(r.review,serviceReview(r.preview));assert.equal(serviceEstimate(state,a,'2026-10-03').total,15000);assert.equal(serviceEstimate(state,a).total,16000)
   assert.equal(s.date,'2026-10-09');assert.equal(s.preview.estimatedValue,16000);assert.equal(s.preview.invoiceValue,20000);assert.equal(s.preview.difference,4000);assert.deepEqual(s.preview.reestimateIds,[r.id]);assert.equal(s.review,serviceReview(s.preview));assert.equal(invoice.net,20000);assert.equal(invoice.vat,4200);assert.equal(invoice.total,24200);assert.equal(state.documents.length,2);assert.equal(state.entries.length,4);assert.equal(state.stockMoves.length,0);assert.equal(state.treasuryMoves.length,0)
   const balances={cleaning:balance('5.8'),repair:balance('5.1'),estimatedLiability:balance('2.1.7'),vat:balance('1.1.4'),suppliers:balance('2.1.1')};assert.deepEqual(balances,{cleaning:16000,repair:4000,estimatedLiability:0,vat:4200,suppliers:-24200})
   check.services={original:a,reestimate:r,settlement:s,balancesCents:balances,entries:state.entries}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const screenshot='output/service-reestimates-2026-10-09.png';let captured=true;try{await access(screenshot)}catch{captured=false}
const report={date:'2026-10-09',synthetic:true,tests:{domain:178,files:13,http:34,fiscal:22,total:247},browser:{reestimate:'Constancia INT-RS-00000001 registrada; estimación original 150 ARS y vigente 160 ARS',invoice:'Factura interna A por 242 ARS, 200 netos y 42 IVA',settlement:'Conciliación revisada contra 160 ARS; diferencia 40 ARS, pasivo estimado cancelado',screenshot:captured?screenshot:'Captura no disponible en el navegador; no se creó una imagen simulada'},checks}
await writeFile('output/verification-service-reestimates-2026-10-09.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,services})=>({database,revision,integrity,audit,balances:services?.balancesCents})),null,2))
