import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {vatPurchaseFiles} from '../.server/domain/vat-purchases.js'
import {vatAnnualOutdated,vatAnnualFile} from '../.server/domain/vat-annual.js'
const reportPath='output/verification-vat-annual-2026-10-17.json',domainLog='output/qa/vat-annual-domain-final.log',httpLog='output/qa/vat-annual-http-final.log'
async function tests(includeHttp){const checks=[];for(const [i,path]of (includeHttp?[domainLog,httpLog]:[domainLog]).entries()){const log=await readFile(path,'utf8'),count=i?77:531;assert.match(log,new RegExp(`(?:#|ℹ) pass ${count}\\s`));assert.match(log,/(?:#|ℹ) fail 0\s/);checks.push({path,passed:count})}return checks}
if(process.argv.includes('--results-only')){const report=JSON.parse(await readFile(reportPath,'utf8'));report.tests=await tests(true);await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({databases:report.checks.length,tests:report.tests},null,2));process.exit(0)}
const database='var/qa-vat-annual.sqlite',repo=await Repository.open({filename:database}),exports=[];let browser
try{
 const {state,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/vat-annual-before.json','utf8')),firstProof=JSON.parse(await readFile('output/qa/vat-annual-first-preserved.json','utf8'))
 assert.equal(revision,3);assert.equal(state.vatAnnual.length,2);const [first,second]=state.vatAnnual
 assert.deepEqual(first,firstProof);const original=structuredClone(before),current=structuredClone(state);delete original.vatAnnual;delete current.vatAnnual;assert.deepEqual(current,original)
 assert.deepEqual(state.vatPurchases.map(vatPurchaseFiles),before.vatPurchases.map(vatPurchaseFiles));assert.equal(state.documents.length,4);assert.equal(state.entries.length,4)
 assert.equal(second.preview.input.previousId,first.id);assert.equal(first.preview.input.from,'2025-01-01');assert.equal(first.preview.input.to,'2025-12-31');assert.equal(second.preview.input.to,'2025-12-31');assert.equal(vatAnnualOutdated(state,second),false)
 const dir='output/vat-annual-2026-10-17';await mkdir(dir,{recursive:true})
 for(const [i,r]of state.vatAnnual.entries()){
  const p=r.preview,t=p.totals;assert.equal(p.months.length,12);assert.equal(p.returns.length,1);assert.equal(p.returns[0].currentExercise,true);assert.equal(p.returns[0].commonReturned,210);assert.equal(p.returns[0].commonRestored,100)
  for(const [key,value]of Object.entries({commonGross:6300,commonReturned:210,commonNet:6090,prepared:4305,appliedGross:4305,commonRestored:100,appliedNet:4205,basisTotal:1000000}))assert.equal(t[key],value,key)
  const target=Number((2n*BigInt(t.commonNet)*BigInt(p.input.taxable)+BigInt(t.basisTotal))/(2n*BigInt(t.basisTotal)));assert.equal(t.annualCredit,target);assert.equal(t.adjustment,target-4205);assert.equal(t.annualCredit,[4872,1218][i]);assert.equal(t.adjustment,[667,-2987][i]);assert.equal(t.inFavorOfCompany,[667,0][i]);assert.equal(t.inFavorOfArca,[0,2987][i]);assert.equal(t.changeFromPrevious,[667,-3654][i]);assert.equal(t.previousAdjustment,[0,667][i])
  assert.deepEqual(p.months.map(m=>m.applied),[1050,0,0,0,0,1575,0,0,0,0,0,1680]);assert.equal(p.input.months.filter(m=>m.noCommonConfirmed).length,9)
  const file=vatAnnualFile(r),work=JSON.parse(new TextDecoder().decode(file.bytes));assert.match(work.kind,/no es un archivo oficial/);assert.deepEqual(work.preview,p);const path=`${dir}/${file.name}`;await writeFile(path,Buffer.from(file.bytes));exports.push(path)
 }
 const download=JSON.parse(await readFile('output/qa/vat-annual-download-observation.json','utf8'));assert.equal(download.observed,false)
 browser={database,revision,first:first.number,second:second.number,documents:4,journals:4,monthlyPreparations:3,monthlyAndFinancialStatePreserved:true,firstReviewUnchanged:true,exercise:'2025',firstRatio:'80 %',secondRatio:'20 %',commonGross:6300,currentYearCommonReturned:210,commonNet:6090,appliedGross:4305,historicalCommonRestored:100,appliedNet:4205,firstAnnualCredit:4872,firstAdjustment:667,secondAnnualCredit:1218,secondAdjustment:-2987,changeFromPrevious:-3654,downloadEventObserved:false}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-vat-proration-2026-10-17.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){const r=await Repository.open({filename:c.database,companyId:c.companyId||'sica'});try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:c.database,companyId:r.companyId,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await r.close()}}
const transcripts=['output/vat-annual-first-saved-2026-10-17.txt','output/vat-annual-saved-2026-10-17.txt','output/vat-annual-history-2026-10-17.txt'],texts=await Promise.all(transcripts.map(p=>readFile(p,'utf8')))
assert.match(texts[0],/80 %/);assert.match(texts[0],/6,67/);assert.match(texts[1],/29,87/);assert.match(texts[1],/36,54/);assert.match(texts[1],/Descargar papel de ajuste anual JSON/);assert.match(texts[2],/INT-IA-00000002/);assert.match(texts[2],/Versión anterior/)
const screenshots=['output/vat-annual-positive-review-2026-10-17.png','output/vat-annual-saved-2026-10-17.png','output/vat-annual-history-2026-10-17.png'];for(const path of screenshots)await access(path)
const report={date:'2026-10-17',synthetic:true,tests:await tests(!process.argv.includes('--data-only')),browser,checks,transcripts,screenshots,exports,limits:['Preparación nominal declarada para compras ordinarias; no constata bases fiscales ni declaraciones externas.','Las devoluciones comunes del mismo ejercicio y sus restituciones se clasifican manualmente con respaldo. No se aplica la proporción actual a compras de ejercicios anteriores.','No presenta una declaración ni registra asientos. El JSON es un papel de trabajo SICA, no un diseño oficial de importación ARCA.','No se observó un evento nativo de descarga; los bytes exportados se verificaron desde las constancias efectivamente guardadas.','Regímenes especiales, cambios posteriores de destino, períodos históricos con actualización y demás ampliaciones del PPTX siguen pendientes.']}
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
