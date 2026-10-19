import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
const database='var/qa-production-shifts.sqlite',repo=await Repository.open({filename:database})
let browser
try{
 const {state:s,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/production-shifts-before.json','utf8')),p=s.productionPlans[0],center=s.masters.workCenters.find(c=>c.id==='shifts-center')
 assert.equal(revision,3);assert.equal(s.productionPlans.length,1);assert.equal(p.scheduleVersion,3);assert.equal(p.preparedBy,'Administrador');assert.equal(center.hours,8)
 const shifts=[{name:'Mañana',startHour:8,endHour:12},{name:'Tarde',startHour:14,endHour:18}]
 assert.deepEqual(JSON.parse(center.shifts),shifts);assert.deepEqual(p.operations[0].calendar.shifts,shifts)
 assert.deepEqual(p.operations[0].bookings,[{date:s.masters.production[0].start,hours:4,startHour:8},{date:s.masters.production[0].start,hours:2,startHour:14}])
 for(const key of Object.keys(before))assert.deepEqual(s[key],before[key])
 validateState(JSON.parse(JSON.stringify(s)));repo.verifyAudit()
 browser={database,revision,scheduleVersion:3,dailyHours:8,plannedHours:6,shifts,bookings:p.operations[0].bookings,preservedFinancialOperations:true,screenshot:'output/production-shifts-plan-2026-10-13.jpg',transcript:'output/production-shifts-browser-2026-10-13.txt'}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-material-reservations-2026-10-13.json','utf8')),checks=[]
for(const filename of [database,...previous.checks.map(c=>c.database)]){
 const r=await Repository.open({filename})
 try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:filename,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await r.close()}
}
for(const path of [browser.screenshot,browser.transcript,'output/production-shifts-editor-2026-10-13.jpg'])await access(path)
assert.match(await readFile(browser.transcript,'utf8'),/14:00 a 16:00/)
for(const [path,count] of [['output/qa/production-shifts-domain-final4.log',456],['output/qa/production-shifts-http-final.log',64]]){const log=await readFile(path,'utf8');assert.match(log,new RegExp(`(?:# |ℹ )pass ${count}(?:\\s|$)`));assert.match(log,/(?:# |ℹ )fail 0(?:\s|$)/)}
const report={date:'2026-10-13',synthetic:true,tests:{domain:456,http:64},browser,checks,limits:['Los turnos se repiten en los mismos días laborables del centro, con cierres por fecha; sin calendario diferente por turno.','No se mide capacidad simultánea por máquina/persona ni se reprograma la ejecución real.','Un turno nocturno se expresa en dos franjas dentro del día; no conserva una agrupación nocturna entre fechas.','Producción parcial, mermas y demás ampliaciones del objetivo siguen pendientes.']}
await writeFile('output/verification-production-shifts-2026-10-13.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
