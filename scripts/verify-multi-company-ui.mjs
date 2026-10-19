import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {validateState} from '../.server/domain/validation.js'
import {multiCompanyConfigs} from './multi-company-fixture.mjs'
const browsers=[]
for(const c of multiCompanyConfigs){
 const repo=await Repository.open({filename:c.filename,companyId:c.id})
 try{
  const {state:s,revision}=repo.read(),before=JSON.parse(await readFile(`output/qa/multi-company-${c.id}-before.json`,'utf8'))
  assert.equal(revision,c.id==='textil'?1:2)
  for(const key of ['documents','entries','stockMoves','treasuryMoves'])assert.deepEqual(s[key],before[key])
  for(const [key,rows] of Object.entries(before.masters))if(key!=='notes')assert.deepEqual(s.masters[key],rows)
  assert.deepEqual(s.masters.notes[0],before.masters.notes[0]);assert.equal(s.masters.notes.length,c.id==='textil'?1:2)
  if(c.id==='servicios')assert.equal(s.masters.notes[1].name,'Nota agregada sólo en Servicios')
  assert.equal(repo.db.prepare("SELECT count(*) AS count FROM sessions WHERE client_name='Administración Textil'").get().count,0)
  assert.ok(repo.db.prepare('SELECT count(*) AS count FROM sessions WHERE client_name=?').get(c.id==='textil'?'Textil en segunda pestaña':'Administración Servicios').count>0)
  validateState(JSON.parse(JSON.stringify(s)));repo.verifyAudit()
  browsers.push({companyId:c.id,database:c.filename,revision,notes:s.masters.notes.map(n=>n.name),preservedFinancialOperations:true})
 }finally{await repo.close()}
}
const previous=JSON.parse(await readFile('output/verification-production-shifts-2026-10-13.json','utf8')),checks=[]
for(const entry of [...multiCompanyConfigs.map(c=>({database:c.filename,companyId:c.id})),...previous.checks]){
 const repo=await Repository.open({filename:entry.database,companyId:entry.companyId||'sica'})
 try{const {state,revision}=repo.read();validateState(JSON.parse(JSON.stringify(state)));repo.verifyAudit();assert.equal(Object.values(repo.db.prepare('PRAGMA integrity_check').get())[0],'ok');checks.push({database:entry.database,companyId:repo.companyId,revision,integrity:'ok',audit:'HMAC validada',state:'Validación completa después de JSON'})}finally{await repo.close()}
}
const transcriptPath='output/multi-company-browser-2026-10-13.txt',transcript=await readFile(transcriptPath,'utf8')
const service=transcript.split('SERVICIOS FINAL\n')[1]?.split('TEXTIL SEGUNDA PESTAÑA\n')[0]
assert.ok(service);assert.match(service,/Nota agregada sólo en Servicios/);assert.doesNotMatch(service,/Nota exclusiva de Textil/)
const textile=transcript.split('TEXTIL SEGUNDA PESTAÑA\n')[1];assert.ok(textile);assert.match(textile,/Nota exclusiva de Textil/);assert.doesNotMatch(textile,/Nota exclusiva de Servicios|Nota agregada sólo en Servicios/)
const screenshots=['output/multi-company-selector-2026-10-13.jpg','output/multi-company-textil-2026-10-13.jpg']
for(const path of screenshots)await access(path)
assert.match(await readFile('output/qa/multi-company-http-final2.log','utf8'),/ℹ pass 68\s/);assert.match(await readFile('output/qa/multi-company-http-final2.log','utf8'),/ℹ fail 0\s/)
const report={date:'2026-10-13',synthetic:true,tests:{http:68,domainBaseline:456,domainBaselineLog:'output/qa/production-shifts-domain-final4.log'},browsers,simultaneousTabs:true,previousTextileSessionRevoked:true,visual:{captured:['selector','textil-before-switch'],finalCapture:'La captura final del navegador no estuvo disponible; las dos pestañas se verificaron por DOM y datos persistentes.'},screenshots,transcript:transcriptPath,checks,limits:['El selector publica únicamente códigos y nombres de la configuración; cada empresa tiene sus propios usuarios y permisos.','El cambio dentro de una pestaña cierra su sesión anterior; las pestañas pueden usar empresas distintas.','Configuración de empresas realizada por el operador del servidor, con archivos exclusivos y credenciales por empresa.','Sin consolidación contable entre empresas; homologación/productivo y demás ampliaciones generales mantienen sus límites.']}
await writeFile('output/verification-multi-company-2026-10-13.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({databases:checks.length,tests:report.tests,browsers,simultaneousTabs:report.simultaneousTabs},null,2))
