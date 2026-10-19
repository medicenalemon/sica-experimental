import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {vatPurchaseFiles,vatPurchasesOutdated} from '../.server/domain/vat-purchases.js'
const reportPath='output/verification-vat-proration-2026-10-17.json',domainLog='output/qa/vat-proration-domain-final.log',httpLog='output/qa/vat-proration-http-final.log'
async function tests(includeHttp){const paths=includeHttp?[domainLog,httpLog]:[domainLog],checks=[];for(const [i,path]of paths.entries()){const log=await readFile(path,'utf8'),count=i?76:521;assert.match(log,new RegExp(`(?:#|ℹ) pass ${count}\\s`));assert.match(log,/(?:#|ℹ) fail 0\s/);checks.push({path,passed:count})}return checks}
if(process.argv.includes('--results-only')){const report=JSON.parse(await readFile(reportPath,'utf8'));report.tests=await tests(true);await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({databases:report.checks.length,tests:report.tests},null,2));process.exit(0)}
const database='var/qa-vat-proration.sqlite',repo=await Repository.open({filename:database}),exports=[];let browser
try{
 const {state,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/vat-proration-before.json','utf8')),globalProof=JSON.parse(await readFile('output/qa/vat-proration-global-preserved.json','utf8'))
 assert.equal(revision,3);assert.equal(state.vatPurchases.length,3);const [legacy,global,mixed]=state.vatPurchases
 assert.deepEqual(legacy,before.vatPurchases[0]);assert.deepEqual(global,globalProof);const old=structuredClone(before),current=structuredClone(state);delete old.vatPurchases;delete current.vatPurchases;assert.deepEqual(current,old)
 assert.equal(legacy.preview.input.mode,'Asignación directa');assert.equal(global.preview.input.mode,'Prorrateo global');assert.equal(mixed.preview.input.mode,'Asignación directa y global');assert.equal(global.preview.input.previousId,legacy.id);assert.equal(mixed.preview.input.previousId,global.id)
 assert.equal(state.documents.length,6);assert.equal(state.entries.length,6);assert.equal(mixed.preview.input.proration.from,'2026-01-01');assert.equal(mixed.preview.input.proration.to,'2026-10-31');assert.deepEqual(mixed.preview.proration,global.preview.proration)
 const g=global.preview.proration;for(const [key,value]of Object.entries({basisTotal:1000000,ordinaryVat:4470,creditNoteVat:210,direct:1070,common:2100,excluded:1300,prorated:1575,computable:2645,nonComputable:1825,restitution:100,creditNet:2545,nonComputableNet:1715}))assert.equal(g[key],value,key)
 assert.equal(global.preview.totals.credit,2545);assert.equal(mixed.preview.totals.credit,2545);assert.equal(vatPurchasesOutdated(state,mixed),false)
 const legacyFiles=vatPurchaseFiles(legacy);assert.deepEqual(legacyFiles,vatPurchaseFiles(before.vatPurchases[0]));assert.equal(legacyFiles.length,2)
 const dir='output/vat-proration-2026-10-17';await mkdir(dir,{recursive:true})
 for(const [i,record]of state.vatPurchases.entries()){
  const files=vatPurchaseFiles(record),headers=Buffer.from(files[0].bytes).toString('latin1').split('\r\n').filter(Boolean),details=Buffer.from(files[1].bytes).toString('latin1').split('\r\n').filter(Boolean)
  assert.equal(headers.length,5);assert.equal(details.length,4);assert.equal(files[0].bytes.length,1635);assert.equal(files[1].bytes.length,344);assert.deepEqual(files[1].bytes,legacyFiles[1].bytes)
  let row=0,wireCredit=0,total=0
  for(const h of headers){assert.equal(h.length,325);assert.equal(h.slice(224,227),'PES');const sign=[3,8,13].includes(Number(h.slice(8,11)))?-1:1;total+=Number(h.slice(104,119))*sign;wireCredit+=Number(h.slice(239,254))*sign;for(let n=0;n<Number(h[237]);n++,row++){assert.equal(details[row].length,84);assert.equal(details[row].slice(0,28),h.slice(8,36));assert.equal(details[row].slice(28,50),h.slice(52,74))}}
  assert.equal(row,4);assert.equal(total,47620);assert.equal(wireCredit,[3100,0,970][i]);if(i){assert.equal(files.length,3);const work=JSON.parse(new TextDecoder().decode(files[2].bytes));assert.match(work.kind,/no importar/);assert.equal(work.proration.computable,2645);assert.equal(work.proration.restitution,100);assert.equal(work.proration.prorated,1575);assert.equal(work.proration.creditNet,2545);assert.equal(wireCredit+(i===1?2645-100:1575),2545)}
  for(const file of files){const path=`${dir}/${record.number}-${file.name}`;await writeFile(path,Buffer.from(file.bytes));exports.push(path)}
 }
 browser={database,revision,legacy:legacy.number,global:global.number,mixed:mixed.number,originalFinancialStatePreserved:true,legacyFilesUnchanged:true,globalReviewUnchanged:true,documents:6,journals:6,proportion:'75 %',direct:1070,common:2100,prorated:1575,computableGross:2645,nonComputableGross:1825,restitution:100,netCredit:2545,globalWireCredit:0,mixedWireCredit:970,downloadEventObserved:false}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-vat-purchases-2026-10-17.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){const r=await Repository.open({filename:c.database,companyId:c.companyId||'sica'});try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:c.database,companyId:r.companyId,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await r.close()}}
const transcripts=['output/vat-proration-global-review-2026-10-17.txt','output/vat-proration-mixed-review-2026-10-17.txt','output/vat-proration-history-2026-10-17.txt','output/vat-proration-mixed-saved-2026-10-17.txt'],texts=await Promise.all(transcripts.map(p=>readFile(p,'utf8')))
assert.match(texts[0],/75 %/);assert.match(texts[0],/15,75/);assert.match(texts[1],/Asignación directa y global/);assert.match(texts[1],/25,45/);assert.match(texts[2],/INT-IC-00000003/);assert.match(texts[2],/Versión anterior/);assert.match(texts[3],/Descargar papel de prorrateo JSON/)
const screenshot='output/vat-proration-history-2026-10-17.png';await access(screenshot)
const report={date:'2026-10-17',synthetic:true,tests:await tests(!process.argv.includes('--data-only')),browser,checks,transcripts,screenshot,exports,limits:['Bases fiscales y destinos declarados, sin verificación externa ni reconstrucción automática de ventas fiscales.','Estimación sobre IVA común; no incluye ajuste anual de estimaciones anteriores ni regímenes especiales.','El papel JSON no es un archivo oficial de importación ARCA. No se constató aceptación de los TXT ni presentación de una declaración.','No se observaron eventos nativos de descarga en este ensayo; los bytes se verificaron desde las constancias efectivamente guardadas.','El objetivo integral del PPTX continúa abierto.']}
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
