import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {partyBalance} from '../.server/domain/engine.js'
import {cardClaimRemaining,cardLossRecoverable} from '../.server/domain/card-disputes.js'

const database='var/qa-card-disputes.sqlite',repo=await Repository.open({filename:database})
let browser
try{
 const {state:s,revision}=repo.read(),before=JSON.parse(await readFile('output/qa/card-disputes-before.json','utf8'))
 assert.equal(revision,4)
 for(const key of ['documents','stockMoves','cardSettlements'])assert.deepEqual(s[key],before[key])
 assert.deepEqual(s.entries.slice(0,before.entries.length),before.entries)
 assert.deepEqual(s.treasuryMoves.slice(0,before.treasuryMoves.length),before.treasuryMoves)
 const [claim,refund,closure]=s.cardDisputes
 assert.equal(s.cardDisputes.length,3);assert.equal(claim.preview.input.treatment,'Reclamo contingente')
 assert.equal(claim.preview.input.amount,40000);assert.equal(refund.preview.input.amount,25000);assert.equal(closure.preview.input.amount,15000)
 assert.equal(refund.preview.input.outcome,'Reintegrado');assert.equal(closure.preview.input.outcome,'Pérdida')
 for(const r of s.cardDisputes)assert.equal(r.responsible,'Administrador')
 assert.equal(closure.entryId,undefined);assert.equal(closure.treasuryMoveId,undefined)
 assert.equal(s.entries.length,before.entries.length+2);assert.equal(s.treasuryMoves.length,before.treasuryMoves.length+2)
 const balance=id=>s.entries.flatMap(e=>e.lines).filter(l=>l.accountId===id).reduce((n,l)=>n+l.debit-l.credit,0)
 assert.equal(balance('card-dispute-asset'),0);assert.equal(balance('card-dispute-loss'),40000);assert.equal(balance('card-dispute-recovery'),-25000)
 assert.equal(s.treasuryMoves.filter(m=>m.treasuryId===claim.preview.treasuryId).reduce((n,m)=>n+m.amount,0),80000)
 assert.equal(cardClaimRemaining(s,claim.id),0);assert.equal(cardLossRecoverable(s,claim.id),15000)
 const invoice=s.documents.find(d=>d.kind==='factura'&&d.side==='cliente')
 assert.equal(partyBalance(s,invoice.partyId),21000)
 validateState(JSON.parse(JSON.stringify(s)));repo.verifyAudit()
 browser={database,revision,chargeback:40000,refund:25000,closedLoss:15000,pending:0,bank:80000,customerBalance:21000,claimAsset:0,preservedDocumentsStockTaxAndOriginalSettlements:true,closureWithoutDuplicateExpense:true}
}finally{await repo.close()}
const previous=JSON.parse(await readFile('output/verification-multi-company-2026-10-13.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){
 const r=await Repository.open({filename:c.database,companyId:c.companyId||'sica'})
 try{const {state,revision}=r.read();validateState(JSON.parse(JSON.stringify(state)));r.verifyAudit();assert.equal(Object.values(r.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:c.database,companyId:r.companyId,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await r.close()}
}
const transcript='output/card-disputes-browser-2026-10-14.txt',closure='output/card-disputes-closure-2026-10-14.txt'
assert.match(await readFile(transcript,'utf8'),/CB-ENSAYO-01/);assert.match(await readFile(transcript,'utf8'),/CIE-CB-ENSAYO Pérdida \$ 150,00/)
assert.match(await readFile(closure,'utf8'),/no genera otro asiento ni movimiento bancario/)
for(const [path,pass] of [['output/qa/card-disputes-domain-final.log',467],['output/qa/card-disputes-http.log',69]]){const log=await readFile(path,'utf8');assert.ok(new RegExp(`(?:ℹ|#) pass ${pass}\\s`).test(log),`${path}: cantidad de pruebas`);assert.ok(/(?:ℹ|#) fail 0\s/.test(log),`${path}: sin fallos`)}
const report={date:'2026-10-14',synthetic:true,tests:{domain:467,http:69},browser,transcript,closure,visual:'La captura nativa no estuvo disponible; se verificaron DOM, revisión y persistencia.',checks,limits:['Importes ARS, sin conexión con procesadoras ni transferencia real.','Un reclamo contingente se controla sin activar un derecho incierto. El crédito cierto requiere evidencia y revisión del operador.','Sin reapertura automática de deuda del cliente ni cambios de IVA, cargos, retenciones o comisiones originales.','La cobertura global del PPTX continúa parcial.']}
await writeFile('output/verification-card-disputes-2026-10-14.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
