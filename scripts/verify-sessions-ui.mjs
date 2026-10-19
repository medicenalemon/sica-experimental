import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
const database='var/qa-sessions.sqlite',r=await Repository.open({filename:database})
let browser
try{
 const {state,revision}=r.read(),before=JSON.parse(await readFile('output/qa/sessions-before.json','utf8'))
 assert.equal(revision,2);assert.equal(r.db.prepare('SELECT public_id FROM sessions WHERE public_id=?').get(before.target),undefined)
 for(const key of Object.keys(before.financial))assert.deepEqual(state[key],before.financial[key])
 assert.deepEqual(state.masters.users.map(({id,name,username,role,active})=>({id,name,username,role,active})),before.users)
 const audit=r.db.prepare('SELECT record FROM audit WHERE company_id=? ORDER BY id DESC LIMIT 1').get('sica'),record=JSON.parse(audit.record)
 assert.equal(record.action,'Cerrar sesión de otra terminal');assert.equal(record.user,'Administrador');assert.match(record.detail,/Caja de ensayo.*sesión sintética/)
 const current=r.db.prepare("SELECT created,expires,public_id FROM sessions WHERE company_id='sica' AND client_name='Administración de ensayo' AND expires>?").all(Date.now())
 assert.equal(current.length,1);assert.ok(Number(current[0].expires)-Number(current[0].created)<=8*60*60*1000)
 browser={database,revision,currentTerminal:'Administración de ensayo',closedTerminal:'Caja de ensayo',preservedOperations:true,format:'24 horas, America/Argentina/Tucuman',screenshot:'output/sessions-review-2026-10-13.jpg',transcript:'output/sessions-browser-2026-10-13.txt'}
}finally{await r.close()}
const previous=JSON.parse(await readFile('output/verification-bank-csv-2026-10-13.json','utf8')),checks=[]
for(const filename of [database,...previous.checks.map(c=>c.database)]){
 const repo=await Repository.open({filename})
 try{const {state,revision}=repo.read();validateState(JSON.parse(JSON.stringify(state)));repo.verifyAudit();assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok');assert.ok(repo.db.prepare('PRAGMA table_info(sessions)').all().some(c=>c.name==='public_id'));checks.push({database:filename,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON',sessionMetadata:'Esquema actualizado'})}finally{await repo.close()}
}
for(const file of [browser.screenshot,browser.transcript])await access(file)
const report={date:'2026-10-13',synthetic:true,tests:{domain:437,http:62,fiscal:22,logs:['output/qa/sessions-domain.log','output/qa/sessions-http-final.log','output/qa/sessions-fiscal.log']},browser,checks,limits:['Sesiones de servidor con nombres declarados; no identifican máquinas físicas.','Licencias, activación, cantidades contratadas y cobro del abono del PPTX permanecen pendientes.']}
await writeFile('output/verification-sessions-2026-10-13.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browser},null,2))
