import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
const databases=['var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 try{await access(filename)}catch{if(filename.includes('unbilled'))throw new Error(`Falta el ejemplo ${filename}`);continue}
 const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const batch=state.inventoryCostBatches?.at(-1),entries=state.entries.filter(e=>e.inventoryBatchId===batch?.id),inventory=batch?.balances.reduce((n,b)=>n+b.value,0),balance=id=>state.entries.filter(e=>e.date<=batch.date).flatMap(e=>e.lines).filter(l=>l.accountId===id).reduce((n,l)=>n+l.debit-l.credit,0)
  if(filename==='var/qa-unbilled-receipts.sqlite'){assert.equal(revision,2);assert.equal(batch.date,'2026-10-09');assert.equal(inventory,95800);assert.equal(batch.settlements[0].difference,2000);assert.equal(balance(batch.accounts.unbilled),-20000);assert.equal(balance(batch.accounts.cogs),6200);assert.equal(batch.receiptCosts[0].lines[0].value,20000)}
  if(filename==='var/qa-unbilled-opening.sqlite'){assert.equal(revision,2);assert.equal(batch.date,'2026-10-09');assert.equal(inventory,51000);assert.equal(balance(batch.accounts.unbilled),0);assert.equal(balance(batch.accounts.cogs),7000);assert.deepEqual(batch.settlements[0].openingAssignment.lines.map(l=>l.value),[1200,800])}
  checks.push({database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa y recorrido JSON verificados',...(batch?{lastCut:{number:batch.number,date:batch.date,version:batch.costVersion,inventoryValueCents:inventory,unbilledLiabilityCents:batch.accounts.unbilled?-balance(batch.accounts.unbilled):0,receipts:batch.receipts||[],settlements:batch.settlements||[],entries}}:{})})
 }finally{await repository.close()}
}
const report={date:'2026-10-09',synthetic:true,tests:{domain:146,files:13,http:31,fiscal:22,total:212},browser:{receipt:'Estimación manual y conciliación de factura confirmadas en interfaz',opening:'Reparto manual 12/8 y contabilización confirmados en interfaz',screenshot:'La captura del navegador integrado no estuvo disponible; no se adjunta una imagen simulada'},checks}
await writeFile('output/verification-receipts-2026-10-09.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(c=>({database:c.database,revision:c.revision,integrity:c.integrity,audit:c.audit,inventory:c.lastCut?.inventoryValueCents,unbilled:c.lastCut?.unbilledLiabilityCents})),null,2))
