import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {accountsAging,agingBuckets} from '../.server/domain/accounts-aging.js'
import {buildPdf,buildXlsx,readXlsx} from '../.server/domain/files.js'
import {money} from '../.server/domain/constants.js'
const database='var/qa-accounts-aging.sqlite',repo=await Repository.open({filename:database})
let browser,rows
try{
 const {state,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/accounts-aging-before.json','utf8'))
 assert.equal(revision,1);assert.deepEqual(state,before)
 const initial=accountsAging(state,'2026-10-14','all','cliente'),later=accountsAging(state,'2026-10-20','all','cliente'),supplier=accountsAging(state,'2026-10-20','all','proveedor')
 assert.deepEqual([initial.pending,initial.overdue,initial.unapplied,initial.balance,initial.difference],[270000,170000,5000,265000,0])
 assert.deepEqual([later.pending,later.overdue,later.unapplied,later.balance,later.difference],[250000,180000,5000,245000,0])
 assert.equal(supplier.balance,81050);assert.equal(supplier.overdue,80450)
 rows=initial.groups.map(g=>({Tipo:g.side==='cliente'?'A cobrar':'A pagar',Código:g.code,Contraparte:g.name,Sucursal:g.branchName,...Object.fromEntries(g.buckets.map((v,i)=>[agingBuckets[i].replaceAll('–','-'),money(v)])),'A favor sin aplicar':money(g.unapplied),'Saldo neto':money(g.balance)}))
 browser={database,revision,initial:{pending:initial.pending,overdue:initial.overdue,unapplied:initial.unapplied,balance:initial.balance},later:{pending:later.pending,overdue:later.overdue,unapplied:later.unapplied,balance:later.balance},supplier:{balance:supplier.balance,overdue:supplier.overdue},allOperationsUnchanged:true}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-card-disputes-2026-10-14.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){
 const r=await Repository.open({filename:c.database,companyId:c.companyId||'sica'})
 try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');const aging=accountsAging(state,'2026-10-14');assert.equal(aging.difference,0);checks.push({database:c.database,companyId:r.companyId,revision,integrity:'ok',audit:'HMAC validada',aging:'Conciliada con cuenta corriente',state:'Validación completa después de JSON'})}finally{await r.close()}
}
const transcripts=['output/accounts-aging-cutoff-2026-10-14.txt','output/accounts-aging-later-2026-10-14.txt','output/accounts-aging-supplier-2026-10-14.txt']
for(const [index,path] of transcripts.entries()){const text=await readFile(path,'utf8');assert.match(text,index===0?/\$ 2.650,00/:index===1?/\$ 2.450,00/:/\$ 810,50/);assert.match(text,/Diferencia de conciliación/)}
const accountTranscript='output/accounts-aging-current-account-2026-10-14.txt',accountText=await readFile(accountTranscript,'utf8')
assert.match(accountText,/textbox "Hasta": 2026-10-14/);assert.match(accountText,/\$ 2.650,00/)
const logs=['output/qa/accounts-aging-domain.log','output/qa/accounts-aging-http.log']
for(const [i,path] of logs.entries()){const log=await readFile(path,'utf8');assert.ok(new RegExp(`(?:ℹ|#) pass ${i?70:474}\\s`).test(log),path);assert.ok(/(?:ℹ|#) fail 0\s/.test(log),path)}
const xlsx='output/accounts-aging-2026-10-14.xlsx',pdf='output/pdf/accounts-aging-2026-10-14.pdf',bytes=await buildXlsx(rows)
await writeFile(xlsx,bytes);const workbook=await readXlsx({size:bytes.length,arrayBuffer:async()=>bytes.buffer});assert.equal(workbook.rows[0]['Saldo neto'],money(265000))
const doc=await buildPdf('Antigüedad de cuentas al 2026-10-14',rows);await writeFile(pdf,Buffer.from(doc.output('arraybuffer')))
const report={date:'2026-10-14',synthetic:true,tests:{domain:474,http:70,logs},browser,checks,transcripts,accountTranscript,exports:{xlsx,pdf,pages:doc.getNumberOfPages()},visual:'Captura nativa no disponible; recorrido DOM y datos persistentes comprobados.',limits:['Las aplicaciones se respetan por fecha, sin compensación automática de anticipos ni entre sucursales.','No mide incobrabilidad ni genera asientos, deuda o impuestos.','La cobertura integral del PPTX continúa abierta.']}
await writeFile('output/verification-accounts-aging-2026-10-14.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,browser,exports:report.exports},null,2))
