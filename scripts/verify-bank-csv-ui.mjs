import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {parseBankStatementCsv} from '../.server/domain/bank-statement-csv.js'
import {parseStatementRows} from '../.server/domain/bank-reconciliation.js'
const database='var/qa-bank-csv.sqlite',repo=await Repository.open({filename:database})
let browser
try{
 const {state,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/bank-csv-before.json','utf8')),s=state.bankStatements[0]
 assert.equal(revision,2);assert.equal(state.bankStatements.length,1);assert.equal(s.name,'CSV de ensayo con separadores entre comillas');assert.equal(s.importedBy,'Administrador');assert.equal(s.closing,590000);assert.equal(s.opening,0)
 assert.deepEqual(s.lines.map(l=>l.amount),[200000,400000,-10000]);assert.deepEqual(s.lines.map(l=>l.description),['Primera parte, ensayo','Segunda parte; ensayo','Cargo pendiente']);assert.ok(s.lines.every(l=>!l.treasuryMoveIds.length))
 for(const key of Object.keys(before))assert.deepEqual(state[key],before[key])
 const csv=parseStatementRows(parseBankStatementCsv(await readFile('output/qa/extracto-bancario-valido.csv','utf8')).rows)
 assert.deepEqual(csv.errors,[]);assert.deepEqual(s.lines.map(({date,reference,description,amount})=>({date,reference,description,amount})),csv.lines)
 browser={database,revision,rows:3,net:590000,preservedFinancialOperations:true,screenshot:'output/bank-csv-review-2026-10-13.jpg',errorScreenshot:'output/bank-csv-error-2026-10-13.jpg',transcript:'output/bank-csv-browser-2026-10-13.txt'}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-bank-groups-2026-10-13.json','utf8')),checks=[]
for(const filename of [database,...previous.checks.map(c=>c.database)]){
 const r=await Repository.open({filename})
 try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:filename,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await r.close()}
}
for(const file of [browser.screenshot,browser.errorScreenshot,browser.transcript])await access(file)
const transcript=await readFile(browser.transcript,'utf8');assert.match(transcript,/CSV: falta cerrar una celda/);assert.match(transcript,/Guardar extracto revisado.*disabled/)
const report={date:'2026-10-13',synthetic:true,tests:{domain:437,log:'output/qa/bank-csv-domain-final.log'},browser,checks,limits:['CSV UTF-8 con las cuatro columnas normalizadas del modelo, hasta 10 MB y 5000 movimientos.','PDF/OFX, formatos específicos de bancos, conexión bancaria y otras ampliaciones del objetivo permanecen pendientes.']}
await writeFile('output/verification-bank-csv-2026-10-13.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
