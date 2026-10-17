import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {initialState} from '../.server/domain/seed.js'
import {previewStatements,statementReview,preserveStatements} from '../.server/domain/financial-statements.js'
import {buildStatementPdf,buildStatementXlsx} from '../.server/domain/statement-files.js'
import {statementsFixture,statementsInput} from './statements-fixture.mjs'
const path='output/verification-legal-form-2026-10-15.json'
async function tests(){const checks=[['output/qa/legal-form-domain.log',503],['output/qa/legal-form-http.log',74],['output/qa/legal-form-files-final.log',null]];const results=[];for(const [path,count]of checks){const log=await readFile(path,'utf8'),passed=Number(log.match(/(?:#|ℹ) pass (\d+)/)?.[1]);assert.ok(passed>0,path);if(count)assert.equal(passed,count,path);assert.match(log,/(?:#|ℹ) fail 0\s/);results.push({path,passed})}return results}
if(process.argv.includes('--results-only')){const report=JSON.parse(await readFile(path,'utf8'));report.tests=await tests();await writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({databases:report.checks.length,tests:report.tests},null,2));process.exit(0)}
const previous=JSON.parse(await readFile('output/verification-supplier-originals-2026-10-15.json','utf8')),checks=[]
for(const c of [{database:'var/qa-legal-form.sqlite',companyId:'sica'},...previous.checks]){const repo=await Repository.open({filename:c.database,companyId:c.companyId||'sica'});try{const {state,revision}=repo.read();validateState(JSON.parse(JSON.stringify(state)));repo.verifyAudit();assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok');if(c.database==='var/qa-legal-form.sqlite'){assert.equal(revision,3);assert.equal(state.settings.legalForm,'SAS');assert.equal(state.documents.length,0);assert.equal(state.entries.length,0)}checks.push({database:c.database,companyId:repo.companyId,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await repo.close()}}
const transcripts=['output/legal-form-initial-2026-10-15.txt','output/legal-form-srl-2026-10-15.txt','output/legal-form-sas-2026-10-15.txt'],texts=await Promise.all(transcripts.map(p=>readFile(p,'utf8')))
assert.match(texts[0],/Sociedad comercial · forma por definir.*\[selected\]/);assert.match(texts[1],/SRL.*\[selected\]/);assert.match(texts[2],/SAS.*\[selected\]/)
const {state,actor}=statementsFixture(initialState);state.settings.legalForm='SAS';const input=statementsInput(state,await import('../.server/domain/financial-statements.js'));input.review=statementReview(previewStatements(state,input));const record=preserveStatements(state,input,actor)
assert.equal(record.preview.source.identity.legalForm,'SAS');validateState(JSON.parse(JSON.stringify(state)))
const pdf='output/pdf/legal-form-statements-2026-10-15.pdf',xlsx='output/legal-form-statements-2026-10-15.xlsx';const doc=await buildStatementPdf(record);await writeFile(pdf,Buffer.from(doc.output('arraybuffer')));await writeFile(xlsx,Buffer.from(await buildStatementXlsx(record)))
const report={date:'2026-10-15',synthetic:true,tests:process.argv.includes('--data-only')?null:await tests(),checks,transcripts,exports:{pdf,xlsx,pages:doc.getNumberOfPages(),declaredLegalForm:record.preview.source.identity.legalForm},limits:['SRL y SAS se probaron en una empresa sintética; no se eligió la forma concreta de la empresa de los autores.','Dato declarado: no constata inscripción, libros habilitados ni altera impuestos automáticamente.','La captura nativa de esta pantalla no estuvo disponible; se conserva el recorrido DOM.','El objetivo integral sigue abierto.']}
await writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({databases:checks.length,exports:report.exports,tests:report.tests},null,2))
