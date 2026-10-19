import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {trialBalance} from '../.server/domain/trial-balance.js'
import {depreciationRows,assetNetValue,nominalAssetAccumulated} from '../.server/domain/fixed-assets.js'
import {assetImpairmentReview} from '../.server/domain/asset-impairments.js'
const databases=['var/qa-asset-impairment.sqlite','var/qa-asset-disposal.sqlite','var/qa-asset-reestimate.sqlite','var/qa-fixed-assets.sqlite','var/qa-service-cancellation.sqlite','var/qa-journal-reversal.sqlite','var/qa-revenue-accrual.sqlite','var/qa-exercise-opening.sqlite','var/qa-year-end.sqlite','var/qa-service-reestimates.sqlite','var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 await access(filename);const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok');const check={database:filename,revision,integrity,audit:'HMAC validada',state:'Validación completa después del recorrido JSON'}
  if(filename===databases[0]){
   assert.equal(revision,4);assert.equal(state.entries.length,7);assert.equal(state.documents.length,2);assert.equal(state.fixedAssets.length,1);assert.equal(state.depreciationBatches.length,3);assert.equal(state.assetImpairments.length,2);assert.equal(state.accountingCloses.length,1);assert.equal(state.stockMoves.length,0);assert.equal(state.treasuryMoves.length,0)
   const a=state.fixedAssets[0],[loss,recovery]=state.assetImpairments,[first,second,last]=state.depreciationBatches,old=state.accountingCloses[0],purchase=state.documents.find(d=>d.id===a.invoiceId)
   for(const m of [loss,recovery]){assert.equal(m.review,assetImpairmentReview(m.preview));assert.equal(m.responsible,'Administrador');assert.equal(m.entityClass,'Pequeña o mediana');assert.equal(m.level,'Global');assert.equal(m.entryIds.length,1);assert.equal(m.preview.rows[0].assetReview,a.review)}
   assert.equal(loss.number,'INT-VR-00000001');assert.equal(loss.date,'2026-10-10');assert.equal(loss.preview.carrying,70000);assert.equal(loss.preview.recoverable,40000);assert.equal(loss.preview.difference,30000);assert.equal(loss.preview.afterValue,40000);assert.equal(loss.preview.rows[0].nextBase,30000);assert.equal(loss.preview.rows[0].remainingDays,20)
   assert.equal(recovery.number,'INT-VR-00000002');assert.equal(recovery.date,'2026-10-20');assert.equal(recovery.preview.carrying,25000);assert.equal(recovery.preview.recoverable,90000);assert.equal(recovery.preview.ceiling,40000);assert.equal(recovery.preview.difference,-15000);assert.equal(recovery.preview.afterValue,40000);assert.equal(recovery.preview.unrecognizedRecovery,50000);assert.equal(recovery.preview.rows[0].afterAllowance,15000);assert.equal(recovery.preview.rows[0].nextBase,30000);assert.equal(recovery.preview.rows[0].remainingDays,10)
   assert.equal(first.preview.total,27000);assert.equal(second.preview.total,3000);assert.equal(first.preview.rows[0].impairmentId,undefined);assert.equal(second.preview.rows[0].impairmentId,undefined);assert.equal(last.preview.total,15000);assert.equal(last.preview.rows[0].impairmentId,loss.id);assert.equal(last.preview.rows[0].bookValue,25000)
   assert.equal(old.date,'2026-10-09');assert.equal(old.preview.fixedAssets.impairments,undefined);assert.equal(old.preview.fixedAssets.batches.length,1);assert.equal(old.preview.fixedAssets.batches[0].review,first.review);assert.equal(old.preview.balance.rows.find(r=>r.accountId==='1.2.1').closing,100000);assert.equal(old.preview.balance.rows.find(r=>r.accountId==='1.2.2').closing,-27000);assert.equal(state.settings.closedUntil,'2026-10-09');assert.equal(purchase.net,100000);assert.equal(purchase.vat,21000);assert.equal(purchase.total,121000)
   for(const [date,value]of [['2026-10-09',73000],['2026-10-10',40000],['2026-10-20',40000]])assert.equal(assetNetValue(state,depreciationRows(state,date)[0],date),value)
   assert.equal(nominalAssetAccumulated(state,a,'2026-10-20'),60000);assert.equal(depreciationRows(state,'2026-10-21')[0].charge,3000)
   const balance=trialBalance(state,'2026-01-01','2026-10-20'),value=id=>balance.rows.find(r=>r.accountId===id).closing
   for(const [id,expected]of [['1.2.1',100000],['1.2.2',-45000],['1.2.3',-15000],['5.9',45000],['5.11',30000],['4.10',-15000],['5.1',0],['1.1.4',21000],['2.1.1',-121000]])assert.equal(value(id),expected)
   assert.equal(state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.debit,0),311000);assert.equal(state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.credit,0),311000)
   check.impairment={asset:a,loss,recovery,originalDepreciations:[first,second],subsequentDepreciation:last,originalClose:old,balance,balancesCents:{cost:100000,accumulated:45000,allowance:15000,net:40000,loss:30000,reversal:15000,unrecognizedRecovery:50000,vatCredit:21000,suppliers:-121000,debit:311000,credit:311000}}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const screenshots=['output/asset-impairment-2026-10-11.png','output/asset-impairment-reversal-2026-10-11.png'];for(const path of [...screenshots,'output/asset-impairment-browser-2026-10-11.txt'])await access(path)
const report={date:'2026-10-11',synthetic:true,tests:{domain:279,files:13,http:44,fiscal:22,total:358},browser:{result:'Pérdida de 300 ARS, depreciación posterior de 150 y reversión limitada a 150 registradas desde la interfaz y recuperadas después de recargar. Neto final 400 ARS, costo y cierre previo conservados, sin modificar factura, IVA o deuda.',screenshots,transcript:'output/asset-impairment-browser-2026-10-11.txt'},checks}
await writeFile('output/verification-asset-impairment-2026-10-11.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,impairment})=>({database,revision,integrity,audit,impairment:impairment?.balancesCents})),null,2))
