import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {unmatchBankLine,statementSummary} from '../.server/domain/bank-reconciliation.js'
const database='var/qa-bank-groups.sqlite',source=await Repository.open({filename:database})
let browser
try{
 const {state,revision}=source.read(),s=state.bankStatements[0],g=s.groups[0],move=state.treasuryMoves.find(m=>m.id===g.moveIds[0]),summary=statementSummary(state,s)
 assert.equal(s.groups.length,1);assert.equal(g.lineIds.length,2);assert.equal(g.moveIds.length,1)
 assert.equal(move.amount,600000);assert.equal(move.reconciled,true)
 assert.deepEqual(g.lineIds.map(id=>s.lines.find(l=>l.id===id).amount),[200000,400000])
 assert.equal(s.events.at(-1).user,'Administrador');assert.equal(summary.matched,2);assert.equal(summary.pendingBank,-10000);assert.equal(summary.pendingLedger,0);assert.equal(summary.difference,-10000);assert.equal(summary.unexplained,0)
 assert.equal(s.lines[2].treasuryMoveIds.length,0)
 const copy=structuredClone(state),actor={userId:'admin',name:'Administrador',role:'Administrador General',permissions:[]}
 unmatchBankLine(copy,s.id,g.lineIds[1],'Verificación de reversión del grupo sin guardar.',actor)
 assert.equal(copy.bankStatements[0].groups.length,0);assert.ok(copy.bankStatements[0].lines.every(l=>!l.treasuryMoveIds.length));assert.equal(copy.treasuryMoves.find(m=>m.id===move.id).reconciled,false)
 for(const key of ['entries','documents','stockMoves'])assert.deepEqual(copy[key],state[key])
 assert.deepEqual(copy.treasuryMoves.map(m=>m.amount),state.treasuryMoves.map(m=>m.amount));validateState(JSON.parse(JSON.stringify(copy)))
 browser={database,revision,bankRows:[200000,400000],ledgerMovement:600000,matched:2,pendingBank:-10000,ledger:600000,unexplained:0,screenshot:'output/bank-groups-review-2026-10-13.jpg',transcript:'output/bank-groups-browser-2026-10-13.txt'}
}finally{await source.close()}
const previous=JSON.parse(await readFile('output/verification-production-current-closing-2026-10-13.json','utf8')),checks=[]
for(const filename of [database,...previous.checks.map(c=>c.database)]){
 const repo=await Repository.open({filename})
 try{const {state,revision}=repo.read();validateState(JSON.parse(JSON.stringify(state)));repo.verifyAudit();assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:filename,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await repo.close()}
}
for(const file of [browser.screenshot,browser.transcript])await access(file)
const report={date:'2026-10-13',synthetic:true,tests:{domain:{passed:432,log:'output/qa/bank-groups-domain-final.log'},http:{covered:60,regressionPassed:59,newCasePassed:1,logs:['output/qa/bank-groups-http-final.log','output/qa/bank-groups-http-targeted.log'],note:'El primer ensayo del caso nuevo falló por no esperar la preparación asíncrona de datos; el caso corregido pasó en su repetición.'}},browser,checks,limitations:['ARS, mismo extracto, cuenta, sucursal y signo; sin reparto parcial ni compensación de signos.','Formatos bancarios adicionales, conexión bancaria, multimoneda y registro asistido de cargos permanecen pendientes.']}
await writeFile('output/verification-bank-groups-2026-10-13.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,browser,tests:report.tests},null,2))
