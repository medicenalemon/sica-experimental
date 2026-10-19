import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {trialBalance} from '../.server/domain/trial-balance.js'
import {depreciationRows,fixedAssetReview} from '../.server/domain/fixed-assets.js'
const databases=['var/qa-fixed-assets.sqlite','var/qa-service-cancellation.sqlite','var/qa-journal-reversal.sqlite','var/qa-revenue-accrual.sqlite','var/qa-exercise-opening.sqlite','var/qa-year-end.sqlite','var/qa-service-reestimates.sqlite','var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 await access(filename);const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa después del recorrido JSON'}
  if(filename==='var/qa-fixed-assets.sqlite'){
   assert.equal(revision,3);assert.equal(state.entries.length,3);assert.equal(state.fixedAssets.length,1);assert.equal(state.depreciationBatches.length,1);assert.equal(state.assetCommissions.length,0);assert.equal(state.documents.length,2);assert.equal(state.stockMoves.length,0);assert.equal(state.treasuryMoves.length,0)
   const a=state.fixedAssets[0],d=state.depreciationBatches[0],invoice=state.documents.find(d=>d.kind==='factura'),receipt=state.documents.find(d=>d.kind==='remito')
   assert.equal(a.number,'INT-BU-00000001');assert.equal(a.date,'2026-10-01');assert.equal(a.reference,'Alta sintética QA 2026');assert.equal(a.responsible,'Administrador');assert.equal(a.preview.cost,100000);assert.equal(a.preview.receipt.id,receipt.id);assert.equal(a.preview.invoice.id,invoice.id);assert.equal(a.review,fixedAssetReview(a.preview));assert.equal(a.commissionedOn,'2026-10-01');assert.equal(a.usefulLifeEnd,'2026-10-31');assert.equal(a.residual,10000);assert.equal(invoice.net,100000);assert.equal(invoice.vat,21000);assert.equal(invoice.total,121000)
   assert.equal(d.number,'INT-DP-00000001');assert.equal(d.date,'2026-10-10');assert.equal(d.reference,'Depreciación sintética QA 2026');assert.equal(d.review,fixedAssetReview(d.preview));assert.equal(d.preview.total,30000);assert.equal(d.preview.rows[0].assetId,a.id);assert.equal(d.preview.rows[0].assetReview,a.review);assert.equal(d.preview.rows[0].totalDays,30);assert.equal(d.preview.rows[0].elapsedDays,10);assert.equal(d.preview.rows[0].previous,0);assert.equal(d.preview.rows[0].accumulated,30000);assert.equal(d.preview.rows[0].bookValue,70000);assert.equal(depreciationRows(state,'2026-10-10')[0].charge,0);assert.equal(depreciationRows(state,'2026-10-11')[0].charge,3000)
   assert.deepEqual(state.entries.find(e=>e.id===a.entryId).lines,[{accountId:'1.2.1',debit:100000,credit:0},{accountId:'5.1',debit:0,credit:100000}]);assert.deepEqual(state.entries.find(e=>e.id===d.entryIds[0]).lines,[{accountId:'5.9',debit:30000,credit:0},{accountId:'1.2.2',debit:0,credit:30000}])
   const balance=trialBalance(state,'2026-01-01','2026-10-10'),value=id=>balance.rows.find(r=>r.accountId===id).closing
   assert.equal(value('1.2.1'),100000);assert.equal(value('1.2.2'),-30000);assert.equal(value('5.9'),30000);assert.equal(value('5.1'),0);assert.equal(value('1.1.4'),21000);assert.equal(value('2.1.1'),-121000);assert.equal(state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.debit,0),251000);assert.equal(state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.credit,0),251000)
   check.fixedAssets={asset:a,depreciation:d,balance,balancesCents:{cost:100000,accumulated:-30000,expense:30000,net:70000,purchases:0,vat:21000,suppliers:-121000,debit:251000,credit:251000}}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const screenshots=['output/fixed-assets-2026-10-11.png','output/fixed-assets-detail-2026-10-11.png'];for(const path of [...screenshots,'output/fixed-assets-browser-2026-10-11.txt'])await access(path)
const report={date:'2026-10-11',synthetic:true,tests:{domain:236,files:13,http:40,fiscal:22,total:311},browser:{result:'Alta de equipo textil por 1000 ARS y depreciación de 300 ARS al 10/10: neto 700 ARS; IVA 210 ARS y deuda 1210 ARS conservados. Registros revisados y recuperados desde SQLite en versión 3.',screenshots,transcript:'output/fixed-assets-browser-2026-10-11.txt'},checks}
await writeFile('output/verification-fixed-assets-2026-10-11.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,fixedAssets})=>({database,revision,integrity,audit,fixedAssets:fixedAssets?.balancesCents})),null,2))
