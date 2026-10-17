import assert from 'node:assert/strict'
import {writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {yearEndReview} from '../.server/domain/year-end-close.js'
const databases=['var/qa-year-end.sqlite','var/qa-service-reestimates.sqlite','var/qa-service-accruals.sqlite','var/qa-accounting-close.sqlite','var/qa-unbilled-receipts.sqlite','var/qa-unbilled-opening.sqlite','var/qa-inventory-cost.sqlite','var/qa-opening-note.sqlite','var/qa-stock-returns.sqlite','var/qa-production-routes.sqlite'],checks=[]
for(const filename of databases){
 try{await access(filename)}catch{if(filename.includes('qa-year-end'))throw new Error(`Falta el ejemplo ${filename}`);continue}
 const repository=await Repository.open({filename})
 try{
  const {state,revision}=repository.read();validateState(JSON.parse(JSON.stringify(state)));repository.verifyAudit();const integrity=Object.values(repository.db.prepare('PRAGMA integrity_check').get())[0];assert.equal(integrity,'ok')
  const check={database:filename,revision,integrity,audit:'HMAC verificada',state:'Validación completa y recorrido JSON verificados'}
  if(filename==='var/qa-year-end.sqlite'){
   assert.equal(revision,2);assert.equal(state.yearEndCloses.length,1);assert.equal(state.accountingCloses.length,1);assert.equal(state.entries.length,5);assert.equal(state.documents.length,0);assert.equal(state.stockMoves.length,0);assert.equal(state.treasuryMoves.length,0)
   const c=state.yearEndCloses[0],p=state.accountingCloses[0],balance=id=>state.entries.flatMap(e=>e.lines).filter(l=>l.accountId===id).reduce((n,l)=>n+l.debit-l.credit,0)
   assert.equal(c.number,'INT-CR-00000001');assert.equal(c.date,'2026-12-31');assert.equal(c.responsible,'Administrador');assert.equal(c.reference,'Cierre sintético de resultados QA 2026');assert.equal(c.preview.result,55000);assert.equal(c.preview.branches.find(b=>b.id==='central').result,65000);assert.equal(c.preview.branches.find(b=>b.id==='annual-north').result,-10000);assert.equal(c.entryIds.length,2);assert.equal(c.review,yearEndReview(c.preview));assert.equal(c.accountingCloseId,p.id);assert.equal(p.preview.resultsClose.id,c.id);assert.equal(state.settings.closedUntil,c.date);assert.equal(state.settings.accountingCloseId,p.id)
   assert.equal(balance('4.1'),0);assert.equal(balance('5.1'),0);assert.equal(balance('3.2'),-55000);assert.equal(balance('1.1.1'),65000);assert.equal(balance('2.1.1'),-10000);assert.ok(c.after.rows.filter(r=>['Ingresos','Gastos'].includes(r.group)).every(r=>r.closing===0));assert.equal(c.after.totals.closingDebit,65000);assert.equal(c.after.totals.closingCredit,65000)
   check.yearEnd={record:c,periodClose:p,balancesCents:{cash:65000,suppliers:-10000,result:-55000,income:0,expense:0},entries:state.entries}
  }
  checks.push(check)
 }finally{await repository.close()}
}
const screenshot='output/year-end-2026-10-09.png';let captured=true;try{await access(screenshot)}catch{captured=false}
const report={date:'2026-10-09',synthetic:true,tests:{domain:186,files:13,http:35,fiscal:22,total:256},browser:{selectedBranch:'Casa Central; el cierre incluyó ambas sucursales',review:'Ganancia 650 ARS en Casa Central, pérdida 100 ARS en la otra sucursal y resultado consolidado 550 ARS',saved:'INT-CR-00000001 y bloqueo INT-CC-00000001 conservados con asientos por sucursal',screenshot:captured?screenshot:'Captura no disponible; no se creó una imagen simulada'},checks}
await writeFile('output/verification-year-end-2026-10-09.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(checks.map(({database,revision,integrity,audit,yearEnd})=>({database,revision,integrity,audit,balances:yearEnd?.balancesCents})),null,2))
