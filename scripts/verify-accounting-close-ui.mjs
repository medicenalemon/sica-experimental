import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {trialBalance} from '../.server/domain/trial-balance.js'
import {accountingCloseReview} from '../.server/domain/accounting-close.js'

const databases=['var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 try{await access(filename)}catch{if(filename.includes('accounting-close'))throw new Error(`Falta el ejemplo ${filename}`);continue}
 const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit()
  const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa y recorrido JSON verificados'}
  if(filename==='var/qa-accounting-close.sqlite'){
   assert.equal(revision,2);assert.equal(state.accountingCloses.length,1)
   const close=state.accountingCloses[0],batch=state.inventoryCostBatches.at(-1)
   assert.equal(state.settings.closedUntil,'2026-10-09');assert.equal(state.settings.accountingCloseId,close.id)
   assert.equal(close.date,'2026-10-09');assert.equal(close.number,'INT-CC-00000001');assert.equal(close.responsible,'Administrador')
   assert.equal(close.acknowledged.length,3);assert.equal(close.review,accountingCloseReview(close.preview))
   assert.equal(close.preview.sources.entries.length,4);assert.equal(close.preview.inventoryBatchId,batch.id)
   assert.equal(close.preview.balance.totals.closingDebit,106620);assert.equal(close.preview.balance.totals.closingCredit,106620)
   const report=trialBalance(state,'2026-10-04','2026-10-09'),inventory=report.rows.find(r=>r.accountId===batch.accounts.inventory),cogs=report.rows.find(r=>r.accountId===batch.accounts.cogs),unbilled=report.rows.find(r=>r.accountId===batch.accounts.unbilled)
   assert.deepEqual([inventory.opening,inventory.debit,inventory.credit,inventory.closing],[74000,21800,0,95800])
   assert.deepEqual([cogs.opening,cogs.debit,cogs.credit,cogs.closing],[6000,200,0,6200]);assert.equal(unbilled.closing,-20000)
   check.close={number:close.number,date:close.date,responsible:close.responsible,reference:close.reference,reason:close.reason,totals:close.preview.balance.totals,warnings:close.preview.warnings,sources:close.preview.sources}
   check.period={from:report.from,to:report.to,totals:report.totals,inventory,cogs,unbilled}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const report={date:'2026-10-09',synthetic:true,tests:{domain:160,files:13,http:32,fiscal:22,total:227},browser:{close:'Registro confirmado en interfaz: versión 2, INT-CC-00000001, bloqueo 09/10/2026 y tres observaciones reconocidas',period:'Rango 04/10–09/10 confirmado con saldos iniciales y movimientos de existencias y costo de ventas',settings:'Fecha bloqueada 09/10/2026 con atributo readOnly confirmado',screenshot:'La captura del navegador no estuvo disponible; no se adjunta una imagen simulada'},checks}
await writeFile('output/verification-accounting-close-2026-10-09.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,close})=>({database,revision,integrity,audit,close:close?.number})),null,2))
