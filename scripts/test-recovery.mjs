import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {mkdtemp,readFile,writeFile,copyFile,rm,readdir,mkdir,stat,rename} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {execFileSync} from 'node:child_process'
import {Repository} from '../server/repository.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {fileDigest,sealBackup,verifyBackupSeal} from '../server/backup-integrity.mjs'
import {protectTicket,canonical,fingerprint,readTicket} from '../server/fiscal-store.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {validateState} from '../.server/domain/validation.js'
import {today} from '../.server/domain/constants.js'
const dir=await mkdtemp(join(tmpdir(),'sica-independent-recovery-')),password='Sica-Independent-Recovery-Test-2026'
after(()=>rm(dir,{recursive:true,force:true}))
async function fixture(name){
 const filename=join(dir,name+'.sqlite'),repo=await Repository.open({filename,companyId:'textil',adminPassword:password})
 const auth=await repo.login('admin',password,true,'Terminal de ensayo'),state=initialState();loadTextileDemo(state)
 const p=state.products.find(p=>p.sku==='REM-M-NEG'),party=state.parties.find(p=>p.side==='cliente')
 const invoice=createDocument(state,{side:'cliente',kind:'factura',letter:'A',partyId:party.id,branchId:'central',date:today(),due:today(),reference:'Factura sintética',sourceId:'',depositId:'principal',lines:[{productId:p.id,description:p.name,quantity:2,unit:p.unit,price:50000,tax:'21',discount:0}],payments:[],allocations:[],perceptions:0,observations:'Ensayo de recuperación',responsible:'Administrador'},'Administrador General')
 await repo.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
 const backup=await repo.backupFile(join(dir,name+'-backups'))
 return {repo,filename,auth,backup,invoice}
}
async function clone(backup,name){const path=join(dir,name+'.sqlite');for(const suffix of ['','.audit-key','.backup.json'])await copyFile(backup+suffix,path+suffix);return path}
async function edit(filename,operation){const db=new DatabaseSync(filename);try{db.exec('PRAGMA journal_mode=DELETE');operation(db)}finally{db.close()}}

test('sealed SQLite backup verifies the full file, every company, financial state and original audit without changing source bytes',async()=>{
 const f=await fixture('verified');try{const before=await Promise.all(['','.audit-key','.backup.json'].map(s=>fileDigest(f.backup+s))),report=await inspectBackup({filename:f.backup,expectedCompanyId:'textil'});assert.equal(report.integrity,'ok');assert.equal(report.companies[0].documents,1);assert.equal(report.companies[0].entries,1);assert.equal(report.companies[0].revision,1);assert.equal(report.companies[0].sessions,1);assert.match(report.seal,/sello HMAC/);assert.deepEqual(await Promise.all(['','.audit-key','.backup.json'].map(s=>fileDigest(f.backup+s))),before);assert.equal((await verifyBackupSeal(f.backup,f.repo.key)).companies[0].id,'textil')}finally{await f.repo.close()}
})
test('independent recovery preserves users, operations, request history and audit prefix, revokes sessions and permits original credentials',async()=>{
 const f=await fixture('recovered');try{
  const original=f.repo.read(),audit=f.repo.db.prepare('SELECT * FROM audit').all(),requests=f.repo.db.prepare('SELECT * FROM requests').all(),sourceHash=await fileDigest(f.backup),destination=join(dir,'complete-recovery')
  const result=await recoverBackup({filename:f.backup,destination,reason:'Recuperar el ensayo después de una falla de equipo.',operator:'Operador de ensayo',expectedCompanyId:'textil'})
  assert.equal(result.revokedSessions,1);assert.equal(result.companies[0].sessions,0);assert.equal(result.companies[0].revision,2);assert.equal(await fileDigest(f.backup),sourceHash)
  const restored=await Repository.open({filename:result.database,companyId:'textil'})
  try{assert.deepEqual(restored.read().state,original.state);assert.deepEqual(restored.db.prepare('SELECT * FROM audit ORDER BY id').all().slice(0,audit.length),audit);assert.deepEqual(restored.db.prepare('SELECT * FROM requests').all(),requests);assert.throws(()=>restored.auth(f.auth.token));const auth=await restored.login('admin',password,false,'Terminal recuperada');assert.equal(auth.actor.userId,'admin');restored.verifyAudit();validateState(restored.read().state);assert.equal(JSON.parse(restored.db.prepare('SELECT record FROM audit ORDER BY id DESC LIMIT 1').get().record).user,'Operador de ensayo')}finally{await restored.close()}
  assert.ok((await readdir(destination)).includes('recovery-report.json'));assert.equal((await stat(result.database)).mode&0o777,0o600);assert.equal((await stat(destination)).mode&0o777,0o700)
 }finally{await f.repo.close()}
})
test('recovery refuses existing destinations, wrong company, missing reason and duplicate invocation without overwriting files',async()=>{
 const f=await fixture('refusals');try{const destination=join(dir,'existing-destination');await mkdir(destination);await writeFile(join(destination,'keep.txt'),'Conservar');await assert.rejects(recoverBackup({filename:f.backup,destination,reason:'Motivo'}),/ya existe/);assert.equal(await readFile(join(destination,'keep.txt'),'utf8'),'Conservar');await assert.rejects(inspectBackup({filename:f.backup,expectedCompanyId:'servicios'}),/empresa indicada/);await assert.rejects(recoverBackup({filename:f.backup,destination:join(dir,'no-reason')}),/motivo/);const target=join(dir,'once');await recoverBackup({filename:f.backup,destination:target,reason:'Una recuperación'});const before=await fileDigest(join(target,'sica.sqlite'));await assert.rejects(recoverBackup({filename:f.backup,destination:target,reason:'Otra recuperación'}),/ya existe/);assert.equal(await fileDigest(join(target,'sica.sqlite')),before)}finally{await f.repo.close()}
})
test('full-file seal detects valid-looking financial tampering, altered manifest and an unrelated audit key',async()=>{
 const f=await fixture('tampering');try{
  const altered=await clone(f.backup,'altered-state');await edit(altered,db=>{const row=db.prepare('SELECT state FROM companies').get(),s=JSON.parse(row.state);s.settings.name='Nombre alterado válido';db.prepare('UPDATE companies SET state=?').run(JSON.stringify(s))});await assert.rejects(inspectBackup({filename:altered}),/cambió/)
  const manifest=await clone(f.backup,'altered-manifest'),m=JSON.parse(await readFile(manifest+'.backup.json','utf8'));m.createdAt='2030-01-01';await writeFile(manifest+'.backup.json',JSON.stringify(m));await assert.rejects(inspectBackup({filename:manifest}),/sello HMAC/)
  const key=await clone(f.backup,'unrelated-key');await writeFile(key+'.audit-key',Buffer.alloc(32,7));await assert.rejects(inspectBackup({filename:key}),/sello HMAC/)
 }finally{await f.repo.close()}
})
test('domain and audit validation reject a deliberately re-sealed invalid source before creating its destination',async()=>{
 const f=await fixture('invalid-source');try{
  for(const [name,operation] of [['unbalanced',db=>{const row=db.prepare('SELECT state FROM companies').get(),s=JSON.parse(row.state);s.entries[0].lines[0].debit++;db.prepare('UPDATE companies SET state=?').run(JSON.stringify(s))}],['bad-audit',db=>db.prepare('UPDATE audit SET hash=?').run('a'.repeat(64))]]){const path=await clone(f.backup,name);await edit(path,operation);await sealBackup(path,f.repo.key,{replace:true});const target=join(dir,name+'-target');await assert.rejects(recoverBackup({filename:path,destination:target,reason:'Rechazar copia inválida'}));await assert.rejects(stat(target),{code:'ENOENT'})}
 }finally{await f.repo.close()}
})
test('legacy backups require explicit consent and still validate domain, audit and credentials without inventing a full-file seal',async()=>{
 const f=await fixture('legacy');try{const path=await clone(f.backup,'legacy-copy');await rm(path+'.backup.json');await assert.rejects(inspectBackup({filename:path}),/--legacy/);const report=await inspectBackup({filename:path,allowLegacy:true});assert.equal(report.warnings.length,1);assert.match(report.seal,/sin sello/);const restored=await recoverBackup({filename:path,allowLegacy:true,destination:join(dir,'legacy-restored'),reason:'Recuperar una copia anterior revisada.'});assert.match(restored.sourceSeal,/sin sello/);assert.match((await inspectBackup({filename:restored.database})).seal,/sello HMAC/)}finally{await f.repo.close()}
})
test('encrypted fiscal tickets and uncertain requests retain their original issuer, fingerprint, payload and decryption context',async()=>{
 const f=await fixture('fiscal-preservation');try{
  const state=f.repo.read().state,d=state.documents[0],issuer=state.settings.cuit.replace(/[-\s]/g,''),ticket={token:'token-sintético',sign:'firma-sintética',expires:Date.parse('2026-12-31T23:59:59Z')}
  const secret=protectTicket(f.repo.key,canonical(['textil','homologacion',issuer,'wsfe']),ticket)
  f.repo.db.prepare('INSERT INTO fiscal_tickets VALUES(?,?,?,?)').run('textil','homologacion',issuer,secret)
  f.repo.db.prepare('INSERT INTO fiscal_jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('textil','homologacion',d.id,issuer,Number(state.masters.branches.find(b=>b.id===d.branchId).point),1,0,'incierto',JSON.stringify({original:'Solicitud sintética conservada'}),'{}',fingerprint(d),'{}',new Date().toISOString())
  const backup=await f.repo.backupFile(join(dir,'fiscal-sealed')),jobs=f.repo.db.prepare('SELECT * FROM fiscal_jobs').all(),tickets=f.repo.db.prepare('SELECT * FROM fiscal_tickets').all()
  const restored=await recoverBackup({filename:backup,destination:join(dir,'fiscal-recovered'),reason:'Conservar solicitudes pendientes.'}),repo=await Repository.open({filename:restored.database,companyId:'textil'})
  try{assert.deepEqual(repo.db.prepare('SELECT * FROM fiscal_jobs').all(),jobs);assert.deepEqual(repo.db.prepare('SELECT * FROM fiscal_tickets').all(),tickets);assert.deepEqual(readTicket(repo.key,canonical(['textil','homologacion',issuer,'wsfe']),tickets[0].secret),ticket)}finally{await repo.close()}
 }finally{await f.repo.close()}
})
test('a nonempty source WAL and an incomplete recovery marker cannot be used to start an installation',async()=>{
 const f=await fixture('incomplete');try{const wal=await clone(f.backup,'source-with-wal');await writeFile(wal+'-wal','No es un respaldo independiente');await assert.rejects(inspectBackup({filename:wal}),/WAL/);const target=join(dir,'incomplete-target.sqlite');await writeFile(target+'.recovering','Incompleto');await assert.rejects(Repository.open({filename:target,companyId:'textil',adminPassword:password}),/incompleta/);await assert.rejects(stat(target),{code:'ENOENT'})}finally{await f.repo.close()}
})
test('CLI verifies and recovers without the original server, prints no credentials and rejects malformed arguments',async()=>{
 const f=await fixture('cli');try{await f.repo.close();await rename(f.filename,f.filename+'.parked');await rename(f.filename+'.audit-key',f.filename+'.parked.audit-key');const cliEnvironment={...process.env};delete cliEnvironment.NODE_TEST_CONTEXT;delete cliEnvironment.NODE_TEST_WORKER_ID;const run=args=>execFileSync(process.execPath,[resolve('scripts/recover-server.mjs'),...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:cliEnvironment});const verified=JSON.parse(run(['verify','--source',f.backup,'--company','textil']));assert.equal(verified.companies[0].revision,1);const recovered=JSON.parse(run(['recover','--source',f.backup,'--company','textil','--destination',join(dir,'cli-target'),'--operator','Operador CLI','--reason','Ensayo CLI sin servidor original.']));assert.equal(recovered.revokedSessions,1);assert.ok(!JSON.stringify(recovered).includes(password));assert.ok(!JSON.stringify(recovered).includes('passwordHash'));for(const args of [['verify'],['verify','--source',f.backup,'--source',f.backup],['verify','--source',f.backup,'--unknown','x'],['verify','--source',f.backup,'--destination','x']])assert.throws(()=>run(args));assert.match(run(['--help']),/CARPETA_NUEVA/)}finally{if(f.repo.db.isOpen)await f.repo.close()}
})

test('a historical SQLite file with two company namespaces recovers both without mixing state or audit and rejects a single-company claim',async()=>{
 const f=await fixture('historical-tenants'),other=await Repository.open({filename:f.filename,companyId:'servicios',adminPassword:password})
 try{const auth=await other.login('admin',password,false,'Otro espacio');await other.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id:'only-services',name:'Sólo Servicios',text:'Estado separado.'}}});const originalA=f.repo.read(),originalB=other.read(),backup=await f.repo.backupFile(join(dir,'mixed-backups'));assert.equal((await inspectBackup({filename:backup})).companies.length,2);await assert.rejects(inspectBackup({filename:backup,expectedCompanyId:'textil'}),/exclusivamente/);const recovered=await recoverBackup({filename:backup,destination:join(dir,'mixed-recovered'),reason:'Conservar un archivo histórico con dos espacios.'});assert.equal(recovered.revokedSessions,2);for(const [companyId,original] of [['textil',originalA],['servicios',originalB]]){const repo=await Repository.open({filename:recovered.database,companyId});try{assert.deepEqual(repo.read().state,original.state);assert.equal(repo.read().revision,original.revision+1);repo.verifyAudit()}finally{await repo.close()}}}finally{await other.close();await f.repo.close()}
})
test('corrupt encrypted fiscal cache is rejected even when a full-file seal was deliberately regenerated',async()=>{
 const f=await fixture('corrupt-ticket');try{const path=await clone(f.backup,'corrupt-ticket-copy');await edit(path,db=>db.prepare('INSERT INTO fiscal_tickets VALUES(?,?,?,?)').run('textil','homologacion','20329642330',JSON.stringify({iv:'incorrecto',ciphertext:'incorrecto',tag:'incorrecto'})));await sealBackup(path,f.repo.key,{replace:true});await assert.rejects(inspectBackup({filename:path}),/ticket WSAA/)}finally{await f.repo.close()}
})
