import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {partyBalance} from '../.server/domain/engine.js'
import {supplierOriginal} from '../.server/domain/supplier-originals.js'
const reportPath='output/verification-supplier-originals-2026-10-15.json',domainLog='output/qa/supplier-originals-domain-final.log',httpLog='output/qa/supplier-originals-http-final2.log'
async function verifyTests(includeHttp){const logs=includeHttp?[domainLog,httpLog]:[domainLog];for(const [i,path] of logs.entries()){const log=await readFile(path,'utf8');assert.ok(new RegExp(`(?:ℹ|#) pass ${i?73:501}\\s`).test(log),path);assert.ok(/(?:ℹ|#) fail 0\s/.test(log),path)}return {domain:501,http:includeHttp?73:null,logs}}
if(process.argv.includes('--results-only')){const report=JSON.parse(await readFile(reportPath,'utf8'));report.tests=await verifyTests(true);await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({databases:report.checks.length,tests:report.tests},null,2));process.exit(0)}
const dataOnly=process.argv.includes('--data-only')
const database='var/qa-supplier-originals.sqlite',repo=await Repository.open({filename:database})
let browser
try{
 const {state,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/supplier-originals-before.json','utf8')),duplicate=JSON.parse(await readFile('output/qa/supplier-originals-after-duplicate.json','utf8'))
 assert.equal(duplicate.revision,3);assert.equal(duplicate.state.documents.length,2);assert.equal(duplicate.state.entries.length,2)
 const withoutIdentity=structuredClone(duplicate.state);delete withoutIdentity.supplierOriginals;delete before.supplierOriginals;assert.deepEqual(withoutIdentity,before)
 assert.equal(revision,4);assert.equal(state.documents.length,3);assert.equal(state.entries.length,3);assert.equal(state.supplierOriginals.length,3)
 assert.deepEqual(state.documents.slice(0,2),before.documents);assert.deepEqual(state.entries.slice(0,2),before.entries)
 const preserved=structuredClone(state);delete preserved.supplierOriginals;preserved.documents=preserved.documents.slice(0,2);preserved.entries=preserved.entries.slice(0,2);assert.deepEqual(preserved,before)
 const [first,correction,combined]=state.supplierOriginals
 assert.equal(first.preview.input.number,42);assert.equal(correction.preview.input.number,43);assert.equal(correction.preview.input.previousId,first.id);assert.deepEqual(first.preview.source,correction.preview.source)
 for(const r of state.supplierOriginals){assert.equal(r.responsible,'Administrador');assert.equal(r.preview.status,'Datos declarados · sin constatación ARCA')}
 assert.deepEqual(state.supplierOriginals.slice(0,2),duplicate.state.supplierOriginals)
 const created=state.documents[2];assert.equal(created.total,12100);assert.equal(created.net,10000);assert.equal(created.vat,2100);assert.equal(combined.preview.source.id,created.id);assert.equal(combined.preview.input.number,44)
 assert.equal(supplierOriginal(state,state.documents[0].id).preview.input.number,43);assert.equal(supplierOriginal(state,state.documents[1].id),undefined)
 const balance=partyBalance(state,created.partyId),vat=state.documents.reduce((n,d)=>n+d.vat,0);assert.equal(balance,169400);assert.equal(vat,29400)
 browser={database,revision,original:42,corrected:43,newPurchaseOriginal:44,duplicate:{revision:3,documents:2,entries:2,unchangedFinancialState:true},newPurchase:{total:12100,net:10000,vat:2100,postedWithOriginal:true},supplierBalance:balance,vatTotal:vat,allPriorDocumentsAndEntriesPreserved:true,oneUnidentifiedPurchase:true}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-original-applications-2026-10-14.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){
 const r=await Repository.open({filename:c.database,companyId:c.companyId||'sica'})
 try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:c.database,companyId:r.companyId,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await r.close()}
}
const transcripts=['output/supplier-originals-review-2026-10-15.txt','output/supplier-originals-corrected-2026-10-15.txt','output/supplier-originals-duplicate-2026-10-15.txt','output/supplier-originals-created-2026-10-15.txt','output/supplier-originals-history-2026-10-15.txt','output/supplier-originals-vat-2026-10-15.txt']
const texts=await Promise.all(transcripts.map(p=>readFile(p,'utf8')))
assert.match(texts[0],/sin constatación ARCA/);assert.match(texts[1],/00004-00000043/);assert.match(texts[2],/Número original del comprobante \*/);assert.match(texts[2],/"43"/);assert.match(texts[2],/Guardar operación/);assert.match(texts[3],/00004-00000044/);assert.match(texts[4],/INT-CO-00000001/);assert.match(texts[4],/INT-CO-00000002/);assert.match(texts[5],/Falta identificar original/);assert.match(texts[5],/00004-00000044/)
const screenshot='output/supplier-originals-list-2026-10-15.png';await access(screenshot)
const tests=await verifyTests(!dataOnly)
const report={date:'2026-10-15',synthetic:true,tests,browser,checks,transcripts,screenshot,limits:['Identificación manual de facturas y notas ordinarias A/B/C en ARS, sin constatación automática ARCA.','Las cargas internas sin original permanecen pendientes; la carga conjunta rechaza duplicados antes de contabilizar.','El DOM del intento duplicado conserva el formulario; el mensaje transitorio de error no quedó capturado. El rechazo se verifica en la instantánea sin cambios y en la prueba HTTP.','Sin envío de IVA Simple ni cómputo automático del crédito fiscal computable. Los demás pendientes del objetivo integral continúan abiertos.']}
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
