import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {accountsAging} from '../.server/domain/accounts-aging.js'
import {creditAvailable,originalApplicationAvailable} from '../.server/domain/account-applications.js'
const database='var/qa-original-applications.sqlite',repo=await Repository.open({filename:database})
let browser
try{
 const {state,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/original-applications-before.json','utf8')),copy=structuredClone(state)
 delete copy.accountApplications;delete before.accountApplications;assert.deepEqual(copy,before);assert.equal(revision,3)
 const [release,reapply]=state.accountApplications;assert.equal(state.accountApplications.length,2)
 assert.equal(release.preview.kind,'Liberación original');assert.equal(release.preview.total,15000);assert.equal(reapply.preview.kind,'Aplicación');assert.equal(reapply.preview.total,10000)
 for(const r of state.accountApplications)assert.equal(r.responsible,'Administrador')
 const credit=state.documents.find(d=>d.id===release.preview.credit.id);assert.equal(credit.allocations[0].amount,20000);assert.equal(originalApplicationAvailable(state,credit),5000);assert.equal(creditAvailable(state,credit),15000)
 const original=accountsAging(state,'2026-10-13','all','cliente'),released=accountsAging(state,'2026-10-14','all','cliente'),reassigned=accountsAging(state,'2026-10-15','all','cliente')
 assert.deepEqual([original.pending,original.unapplied,original.balance],[101000,10000,91000]);assert.deepEqual([released.pending,released.unapplied,released.balance],[116000,25000,91000]);assert.deepEqual([reassigned.pending,reassigned.unapplied,reassigned.balance],[106000,15000,91000])
 assert.equal(state.documents.find(d=>d.kind==='factura').vat,21000);assert.equal(state.treasuryMoves.reduce((n,m)=>n+m.amount,0),30000)
 browser={database,revision,release:15000,reassigned:10000,originalAllocationPreserved:20000,originalStillReleasable:5000,original:{pending:original.pending,unapplied:original.unapplied,balance:original.balance},released:{pending:released.pending,unapplied:released.unapplied,balance:released.balance},final:{pending:reassigned.pending,unapplied:reassigned.unapplied,balance:reassigned.balance},allOriginalStatePreserved:true,vat:21000,cash:30000}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-account-applications-2026-10-14.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){
 const r=await Repository.open({filename:c.database,companyId:c.companyId||'sica'})
 try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');assert.equal(accountsAging(state,'2026-10-14').difference,0);checks.push({database:c.database,companyId:r.companyId,revision,integrity:'ok',audit:'HMAC validada',aging:'Conciliada con cuenta corriente',state:'Validación completa después de JSON'})}finally{await r.close()}
}
const transcripts=['output/original-applications-review-2026-10-14.txt','output/original-applications-released-2026-10-14.txt','output/original-applications-historical-2026-10-14.txt','output/original-applications-final-2026-10-14.txt','output/original-applications-detail-2026-10-14.txt']
for(const [index,path] of transcripts.entries()){const text=await readFile(path,'utf8');assert.match(text,index===0?/Liberación original de \$ 150,00/:index===1||index===2?/\$ 1.160,00/:index===3?/\$ 1.060,00/:/Liberación original/)}
const screenshot='output/original-applications-detail-2026-10-14.png';await access(screenshot)
const logs=['output/qa/original-applications-domain-final.log','output/qa/original-applications-http.log']
for(const [i,path] of logs.entries()){const log=await readFile(path,'utf8');assert.ok(new RegExp(`(?:ℹ|#) pass ${i?72:493}\\s`).test(log),path);assert.ok(/(?:ℹ|#) fail 0\s/.test(log),path)}
const report={date:'2026-10-14',synthetic:true,tests:{domain:493,http:72,logs},browser,checks,transcripts,screenshot,limits:['La liberación modifica únicamente la asignación efectiva; el comprobante y su aplicación original permanecen conservados.','Para recuperar una asignación liberada se registra una nueva aplicación revisada; no se borra la liberación.','Sin compensaciones entre contrapartes o sucursales, convenios, intereses ni evaluación de recuperabilidad. La cobertura integral continúa abierta.']}
await writeFile('output/verification-original-applications-2026-10-14.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
