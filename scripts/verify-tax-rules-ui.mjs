import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Repository} from '../server/repository.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {validateState} from '../.server/domain/validation.js'
import {taxRuleStatus} from '../.server/domain/tax-rules.js'
const database='var/qa-tax-rules.sqlite',source=await Repository.open({filename:database}),temporary=await mkdtemp(join(tmpdir(),'sica-tax-rules-recovery-'));let browser,recovery
try{
 const before=JSON.parse(await readFile('output/qa/tax-rules-before.json','utf8')),current=source.read(),s=current.state;assert.equal(before.revision,5);assert.equal(current.revision,6);assert.equal(s.masters.taxRules.length,3)
 const actual=structuredClone(s);actual.masters.taxRules=before.state.masters.taxRules;assert.deepEqual(actual,before.state)
 const rule=s.masters.taxRules.find(r=>r.id==='tax-current');assert.equal(rule.rate,2.75);assert.equal(rule.norm,'Referencia de ensayo revisada desde la interfaz; sin aplicación fiscal real');assert.equal(rule.jurisdiction,'Tucumán');assert.deepEqual(s.masters.taxRules.filter(r=>r.id!=='tax-current'),before.state.masters.taxRules.filter(r=>r.id!=='tax-current'));assert.equal(rule.validFrom,'2026-01-01');assert.equal(rule.validUntil,'2026-12-31')
 const statuses=s.masters.taxRules.map(r=>taxRuleStatus(r,'2026-10-17'));assert.deepEqual(statuses,['Vigente según fechas','Vencido según fechas','Próximo según fechas']);validateState(JSON.parse(JSON.stringify(s)));source.verifyAudit();source.assertFiscalState(s)
 assert.equal(source.db.prepare('SELECT count(*) AS count FROM fiscal_jobs').get().count,0)
 browser={database,revision:6,synthetic:true,regimes:3,statuses,updatedRate:2.75,jurisdiction:'Tucumán',financialStatePreserved:true,documents:s.documents.length,journals:s.entries.length,stockMoves:s.stockMoves.length,automaticTaxCalculations:0,externalRequests:0}
 const backup=await source.backupFile(join(temporary,'backup')),inspection=await inspectBackup({filename:backup,expectedCompanyId:'sica'});assert.match(inspection.seal,/sello HMAC/)
 const restored=await recoverBackup({filename:backup,destination:join(temporary,'restored'),reason:'Verificar el catálogo declarado y la conservación de operaciones y credenciales del ensayo.',operator:'Operador de ensayo',expectedCompanyId:'sica'}),repo=await Repository.open({filename:restored.database})
 try{const after=repo.read();assert.equal(after.revision,7);assert.deepEqual(after.state,s);assert.equal(repo.db.prepare('SELECT count(*) AS count FROM sessions').get().count,0);repo.verifyAudit();repo.assertFiscalState(after.state);recovery={sourceRevision:6,recoveredRevision:7,sourceSha256:inspection.sha256,seal:inspection.seal,stateAndCredentialsPreserved:true,regimesPreserved:3,revokedSessions:restored.revokedSessions,recoveredSessions:0,audit:'HMAC validada'}}finally{await repo.close()}
}finally{await source.close();await rm(temporary,{recursive:true,force:true})}
recovery.temporaryCopyRemovedAfterCheck=true
const previous=JSON.parse(await readFile('output/verification-vat-sales-ledger-2026-10-17.json','utf8')),checks=[]
for(const c of [{database,companyId:'sica'},...previous.checks]){const repo=await Repository.open({filename:c.database,companyId:c.companyId||'sica'});try{const current=repo.read();validateState(JSON.parse(JSON.stringify(current.state)));repo.verifyAudit();repo.assertFiscalState(current.state);assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:c.database,companyId:repo.companyId,revision:current.revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON',fiscalSources:'Verificadas'})}finally{await repo.close()}}
assert.equal(checks.length,58)
const transcripts=['initial','invalid','recovered'].map(n=>`output/tax-rules-${n}-2026-10-17.txt`),texts=await Promise.all(transcripts.map(p=>readFile(p,'utf8')))
for(const status of browser.statuses)assert.ok(texts[0].includes(status),status)
assert.match(texts[1],/Ingresos Brutos requiere una jurisdicción del catálogo/);assert.match(texts[1],/Versión 5/);assert.match(texts[2],/Versión 6/);assert.match(texts[2],/Referencia de ensayo revisada desde la interfaz/);assert.match(texts[2],/2\.75|2,75/)
const screenshots=['output/tax-rules-invalid-2026-10-17.png','output/tax-rules-recovered-2026-10-17.png'];for(const p of screenshots)assert.ok((await readFile(p)).length>10000)
const tests=[];for(const [kind,count]of [['domain',570],['http',82]]){const path=`output/qa/tax-rules-${kind}-final.log`,log=await readFile(path,'utf8');assert.match(log,new RegExp(`(?:#|ℹ) pass ${count}\\s`));assert.match(log,/(?:#|ℹ) fail 0\s/);tests.push({path,passed:count})}
const build=await readFile('output/qa/tax-rules-build-final.log','utf8');assert.match(build,/built in/);const lint=await readFile('output/qa/tax-rules-lint-final.log','utf8');assert.doesNotMatch(lint,/warning|error/i)
const report={date:'2026-10-17',tests,browser,recovery,checks,transcripts,screenshots,limits:['El catálogo conserva datos declarados; no acredita vigencia legal, inscripción ni condición de agente.','No calcula impuestos, mínimos, padrones, exclusiones ni Convenio Multilateral.','El cambio administrativo queda auditado; la tasa anterior no es una versión independiente del catálogo.','Las referencias y alícuotas del ensayo son sintéticas. No hubo operaciones fiscales externas.','No se verificaron las exportaciones XLSX/PDF de esta tabla en el navegador.','El objetivo completo del PPTX continúa abierto.']};await writeFile('output/verification-tax-rules-2026-10-17.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({tests,browser,recovery,databases:checks.length},null,2))
