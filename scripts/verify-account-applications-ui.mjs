import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {accountsAging} from '../.server/domain/accounts-aging.js'
import {creditAvailable,targetAvailable} from '../.server/domain/account-applications.js'
const database='var/qa-account-applications.sqlite',repo=await Repository.open({filename:database})
let browser
try{
 const {state,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/account-applications-before.json','utf8')),copy=structuredClone(state)
 delete copy.accountApplications;delete before.accountApplications;assert.deepEqual(copy,before);assert.equal(revision,3)
 const [application,reversal]=state.accountApplications;assert.equal(state.accountApplications.length,2)
 assert.equal(application.preview.total,20000);assert.equal(reversal.preview.total,20000);assert.equal(reversal.preview.reversedId,application.id)
 assert.equal(application.preview.date,'2026-10-14');assert.equal(reversal.preview.date,'2026-10-15')
 for(const r of state.accountApplications)assert.equal(r.responsible,'Administrador')
 const original=accountsAging(state,'2026-10-13','all','cliente'),applied=accountsAging(state,'2026-10-14','all','cliente'),released=accountsAging(state,'2026-10-15','all','cliente')
 assert.deepEqual([original.pending,original.unapplied,original.balance],[121000,30000,91000]);assert.deepEqual([applied.pending,applied.unapplied,applied.balance],[101000,10000,91000]);assert.deepEqual([released.pending,released.unapplied,released.balance],[121000,30000,91000])
 assert.equal(creditAvailable(state,state.documents.find(d=>d.id===application.preview.credit.id)),30000);assert.equal(targetAvailable(state,state.documents.find(d=>d.id===application.preview.lines[0].document.id)),121000)
 assert.equal(state.documents.find(d=>d.kind==='factura').vat,21000);assert.equal(state.treasuryMoves.reduce((n,m)=>n+m.amount,0),30000)
 browser={database,revision,amount:20000,original:{pending:original.pending,unapplied:original.unapplied,balance:original.balance},applied:{pending:applied.pending,unapplied:applied.unapplied,balance:applied.balance},released:{pending:released.pending,unapplied:released.unapplied,balance:released.balance},allOriginalStatePreserved:true,vat:21000,cash:30000}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-accounts-aging-2026-10-14.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){
 const r=await Repository.open({filename:c.database,companyId:c.companyId||'sica'})
 try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');assert.equal(accountsAging(state,'2026-10-14').difference,0);checks.push({database:c.database,companyId:r.companyId,revision,integrity:'ok',audit:'HMAC validada',aging:'Conciliada con cuenta corriente',state:'Validación completa después de JSON'})}finally{await r.close()}
}
const transcriptPaths=['output/account-applications-review-2026-10-14.txt','output/account-applications-saved-2026-10-14.txt','output/account-applications-reversal-review-2026-10-14.txt','output/account-applications-historical-2026-10-14.txt','output/account-applications-final-2026-10-14.txt'],transcripts=await Promise.all(transcriptPaths.map(p=>readFile(p,'utf8')))
assert.match(transcripts[0],/Aplicación de \$ 200,00/);assert.match(transcripts[1],/\$ 1.010,00/);assert.match(transcripts[2],/textbox "Fecha de aplicación o reversión \*": 2026-10-15/);assert.match(transcripts[3],/\$ 1.010,00/);assert.match(transcripts[4],/REV-ENSAYO-01/);assert.match(transcripts[4],/\$ 1.210,00/)
const screenshot='output/account-applications-ui-2026-10-14.png';await access(screenshot)
const logs=['output/qa/account-applications-domain-final3.log','output/qa/account-applications-http.log','output/qa/account-applications-http-date-final.log']
for(const [i,path] of logs.entries()){const log=await readFile(path,'utf8');assert.ok(new RegExp(`(?:ℹ|#) pass ${[485,71,1][i]}\\s`).test(log),path);assert.ok(/(?:ℹ|#) fail 0\s/.test(log),path)}
const detailScreenshot='output/account-applications-detail-2026-10-14.png',detailTranscript='output/account-applications-detail-2026-10-14.txt';await access(detailScreenshot);assert.match(await readFile(detailTranscript,'utf8'),/Revierte INT-AC-00000001/)
const report={date:'2026-10-14',synthetic:true,tests:{domain:485,http:71,dateGuardRechecked:true,logs},browser,checks,transcripts:transcriptPaths,screenshot,detailScreenshot,detailTranscript,limits:['Aplicaciones posteriores y reversión completa de cada constancia, sin modificación de aplicaciones originales.','Misma contraparte, tipo y sucursal; no realiza compensaciones legales entre cuentas distintas.','No genera fondos, asientos, comisiones ni impuestos. Las otras ampliaciones del objetivo integral continúan abiertas.']}
await writeFile('output/verification-account-applications-2026-10-14.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
