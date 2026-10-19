import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {createApplication} from '../server/http.mjs'
import {validateState} from '../.server/domain/validation.js'
import {materialAvailable,reservedMaterialQuantity} from '../.server/domain/production-reservations.js'
const database='var/qa-material-reservations.sqlite',finishedDatabase='var/qa-material-reservations-finished.sqlite',password='Sica-Material-Reservations-QA-2026',repo=await Repository.open({filename:database})
let source,raw,finished,browser
try{
 source=repo.read();assert.equal(source.revision,2)
 const s=source.state,before=JSON.parse(await readFile('output/qa/material-reservations-before.json','utf8')),r=s.productionReservations[0]
 raw=s.products.find(p=>p.sku==='REM-M-NEG');finished=s.products.find(p=>p.sku==='PANT-42-AZ')
 for(const key of Object.keys(before))assert.deepEqual(s[key],before[key])
 assert.equal(s.productionReservations.length,1);assert.equal(r.number,'INT-RM-00000001');assert.equal(r.responsible,'Administrador');assert.equal(r.release,undefined)
 assert.equal(reservedMaterialQuantity(s,raw.id,'principal',r.preview.date),3);assert.equal(materialAvailable(s,raw.id,'principal',r.preview.date),37)
 validateState(JSON.parse(JSON.stringify(s)));repo.verifyAudit()
 browser={database,revision:2,physical:40,reserved:3,available:37,failedOutflow:38,preservedFinancialOperations:true,screenshot:'output/material-reservations-inventory-2026-10-13.jpg',transcript:'output/material-reservations-browser-2026-10-13.txt'}
}finally{await repo.close()}
const app=await createApplication({filename:finishedDatabase,adminPassword:password}),r=app.repository
try{
 if(r.read().revision===0){
  const auth=await r.login('admin',password,false,'fixture'),invoke=command=>r.mutate(auth.token,{revision:r.read().revision,requestId:crypto.randomUUID(),command}),reservation=source.state.productionReservations[0],plan=source.state.productionPlans.find(p=>p.orderId===reservation.preview.orderId)
  await r.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:source.state}},true)
  for(const op of plan.operations){await invoke({type:'production.step',orderId:plan.orderId,operationId:op.id,action:'iniciar',date:reservation.preview.date});await invoke({type:'production.step',orderId:plan.orderId,operationId:op.id,action:'completar',date:reservation.preview.date,actualHours:op.plannedHours})}
  await invoke({type:'production.finish',orderId:plan.orderId,depositId:'principal',date:reservation.preview.date})
 }
 const {state,revision}=r.read(),reservation=state.productionReservations[0]
 assert.equal(revision,4);assert.equal(reservation.release.kind,'Consumida');assert.equal(reservation.release.by,'Administrador');assert.deepEqual(reservation.preview,source.state.productionReservations[0].preview)
 const quantity=id=>state.stockMoves.filter(m=>m.productId===id&&m.depositId==='principal').reduce((n,m)=>n+m.quantity,0)
 assert.equal(quantity(raw.id),37);assert.equal(quantity(finished.id),22);assert.equal(reservedMaterialQuantity(state,raw.id,'principal',reservation.release.date),0);assert.equal(materialAvailable(state,raw.id,'principal',reservation.release.date),37)
 assert.deepEqual(state.documents,source.state.documents);assert.deepEqual(state.entries,source.state.entries);assert.deepEqual(state.stockMoves.slice(0,source.state.stockMoves.length),source.state.stockMoves)
 validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit()
}finally{await r.close()}
const previous=JSON.parse(await readFile('output/verification-sessions-2026-10-13.json','utf8')),checks=[]
for(const filename of [database,finishedDatabase,...previous.checks.map(c=>c.database)]){
 const r=await Repository.open({filename})
 try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:filename,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await r.close()}
}
for(const f of [browser.screenshot,browser.transcript,'output/material-reservations-blocked-2026-10-13.jpg'])await access(f)
const transcript=await readFile(browser.transcript,'utf8');assert.match(transcript,/Material reservado de REM-M-NEG/)
const report={date:'2026-10-13',synthetic:true,tests:{domain:446,http:63,logs:['output/qa/material-reservations-domain-final3.log','output/qa/material-reservations-http-final.log']},browser,finished:{database:finishedDatabase,raw:37,output:22,reserved:0,immutableOriginalReview:true},checks,limits:['Reserva del lote completo y liberación completa; sin consumos parciales, mermas ni replanificación.','Reserva operativa sin asiento; el costo se revisa en INT-PC y CPP. Las restantes ampliaciones del objetivo siguen pendientes.']}
await writeFile('output/verification-material-reservations-2026-10-13.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser,finished:report.finished},null,2))
