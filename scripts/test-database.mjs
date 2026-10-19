import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {DatabaseSync} from 'node:sqlite'
import {mkdtemp,rm,copyFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import https from 'node:https'
import {Repository} from '../server/repository.mjs'
import {migrateRelationalStore,readRelationalState,assertRelationalStore,relationalTables} from '../server/relational-store.mjs'
import {inspectBackup,recoverBackup} from '../server/recovery.mjs'
import {sealBackup} from '../server/backup-integrity.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,saveCheque} from '../.server/domain/engine.js'
import {receiptPrintFixture} from './receipt-print-fixture.mjs'
import {assertLocalUrl} from './test-offline-guard.mjs'

const directory=await mkdtemp(join(tmpdir(),'sica-relational-tests-')),password='Relational-Only-Test-2026'
after(()=>rm(directory,{recursive:true,force:true}))
function memory(state=initialState()){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;CREATE TABLE companies(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,state TEXT NOT NULL)')
 db.prepare('INSERT INTO companies VALUES(?,0,?)').run('textil',JSON.stringify(state));migrateRelationalStore(db);return db
}
function fixture(){return receiptPrintFixture({initialState,loadTextileDemo,createDocument,saveCheque}).state}
async function repository(name){const repo=await Repository.open({filename:join(directory,name+'.sqlite'),companyId:'textil',adminPassword:password});const auth=await repo.login('admin',password,false,'ensayo');await repo.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:fixture()}},true);return {repo,auth}}

test('relational migration preserves all nested receipt metadata, arrays, order and cent amounts exactly',()=>{
 const state=fixture(),db=memory(state)
 try{assertRelationalStore(db,'textil',state);assert.deepEqual(readRelationalState(db,'textil',structuredClone(state)),state);assert.equal(JSON.stringify(readRelationalState(db,'textil',structuredClone(state))),JSON.stringify(state));assert.equal(db.prepare('SELECT count(*) AS n FROM rel_document_payments').get().n,8);assert.equal(db.prepare('SELECT sum(amount) AS n FROM rel_document_allocations').get().n,13000);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok')}finally{db.close()}
})
test('migration is idempotent and does not change company revisions or install duplicate rows',()=>{
 const db=memory(fixture());try{const before=db.prepare('SELECT * FROM companies').all(),counts=relationalTables.map(t=>db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n);migrateRelationalStore(db);assert.deepEqual(db.prepare('SELECT * FROM companies').all(),before);assert.deepEqual(relationalTables.map(t=>db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n),counts);assert.equal(db.prepare('SELECT count(*) AS n FROM sica_migrations').get().n,1)}finally{db.close()}
})
test('failed migration rolls back its schema and leaves an invalid historical source untouched',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;CREATE TABLE companies(id TEXT PRIMARY KEY,state TEXT NOT NULL)');const state=fixture();state.documents[0].partyId='absent';const raw=JSON.stringify(state);db.prepare('INSERT INTO companies VALUES(?,?)').run('textil',raw)
 try{assert.throws(()=>migrateRelationalStore(db),/relaciones inválidas|FOREIGN KEY/);assert.equal(db.prepare('SELECT state FROM companies').get().state,raw);assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'rel_%' OR name='sica_migrations'").get().n,0)}finally{db.close()}
})
test('an unknown migration version is rejected without changing its ledger or business state',()=>{
 const db=memory();try{db.prepare('UPDATE sica_migrations SET version=999').run();const before=db.prepare('SELECT * FROM companies').all();assert.throws(()=>migrateRelationalStore(db),/no compatible/);assert.deepEqual(db.prepare('SELECT * FROM companies').all(),before);assert.equal(db.prepare('SELECT version FROM sica_migrations').get().version,999)}finally{db.close()}
})
for(const [name,change] of [
 ['counterparty',s=>s.documents[0].partyId='missing'],
 ['source document',s=>s.documents[0].sourceId='missing'],
 ['product in a line',s=>s.documents[0].lines[0].productId='missing'],
 ['allocation destination',s=>s.documents.at(-1).allocations[0].documentId='missing'],
 ['ledger account',s=>s.entries[0].lines[0].accountId='missing'],
 ['stock deposit',s=>s.stockMoves[0].depositId='missing'],
 ['treasury account',s=>s.treasuryMoves[0].treasuryId='missing'],
 ['branch',s=>s.documents[0].branchId='missing'],
 ['counterparty on the wrong side',s=>s.documents[0].side='proveedor']
])test(`foreign keys reject a missing ${name} and roll back the snapshot and every SQL relation`,()=>{
 const state=fixture(),db=memory(state),bad=structuredClone(state);change(bad)
 try{assert.throws(()=>db.prepare('UPDATE companies SET state=?').run(JSON.stringify(bad)),/FOREIGN KEY/);assert.deepEqual(JSON.parse(db.prepare('SELECT state FROM companies').get().state),state);assertRelationalStore(db,'textil',state);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])}finally{db.close()}
})
for(const [name,value] of [['fractional cent',1.5],['unsafe amount',Number.MAX_SAFE_INTEGER+1],['numeric text','100'],['null amount',null]])test(`SQL monetary constraints reject ${name} without rounding or coercion`,()=>{
 const state=fixture(),db=memory(state),bad=structuredClone(state);bad.documents[0].total=value
 try{assert.throws(()=>db.prepare('UPDATE companies SET state=?').run(JSON.stringify(bad)));assertRelationalStore(db,'textil',state)}finally{db.close()}
})
test('negative opening balances and historical zero allocations survive unchanged',()=>{
 const state=fixture(),original=state.documents[0];state.documents.push({...original,id:'negative-opening',number:'INT-SALDO-X-HIST',kind:'saldo',letter:'X',lines:[],payments:[],allocations:[],net:-501,vat:0,perceptions:0,total:-501});state.documents.at(-2).allocations[0].amount=0
 const db=memory(state);try{assertRelationalStore(db,'textil',state);assert.equal(db.prepare("SELECT total FROM rel_documents WHERE id='negative-opening'").get().total,-501);assert.equal(db.prepare('SELECT count(*) AS n FROM rel_document_allocations WHERE amount=0').get().n,1)}finally{db.close()}
})
test('polymorphic accounting origins retain cheque and internal-operation IDs without inventing invoices',()=>{
 const state=fixture();state.entries[0].documentId='internal-valuation';state.treasuryMoves[0].documentId='internal-transfer';const db=memory(state)
 try{assertRelationalStore(db,'textil',state);assert.equal(db.prepare("SELECT origin_id FROM rel_entries WHERE position=0").get().origin_id,'internal-valuation')}finally{db.close()}
})
test('SQL stock, treasury and ledger totals reconcile with the original operational movements',()=>{
 const state=fixture(),db=memory(state)
 try{const rows=db.prepare('SELECT * FROM rel_account_totals').all();assert.equal(rows.reduce((n,r)=>n+r.balance,0),0);assert.equal(rows.reduce((n,r)=>n+r.debit,0),state.entries.flatMap(e=>e.lines).reduce((n,l)=>n+l.debit,0));for(const r of db.prepare('SELECT * FROM rel_stock_balances').all())assert.equal(r.quantity,state.stockMoves.filter(m=>m.productId===r.productId&&m.depositId===r.depositId).reduce((n,m)=>n+m.quantity,0));for(const r of db.prepare('SELECT * FROM rel_treasury_balances').all())assert.equal(r.amount,state.treasuryMoves.filter(m=>m.treasuryId===r.treasuryId).reduce((n,m)=>n+m.amount,0))}finally{db.close()}
})
test('company-qualified keys isolate identical IDs and refuse cross-company references',()=>{
 const state=fixture(),db=memory(state);try{db.prepare('INSERT INTO companies VALUES(?,0,?)').run('other',JSON.stringify(initialState()));assert.equal(db.prepare("SELECT count(*) AS n FROM rel_branches WHERE id='central'").get().n,2);const bad=initialState();bad.documents=[state.documents[0]];assert.throws(()=>db.prepare("UPDATE companies SET state=? WHERE id='other'").run(JSON.stringify(bad)),/FOREIGN KEY/);assertRelationalStore(db,'textil',state)}finally{db.close()}
})
test('transactions, idempotency and stale-revision conflicts preserve relational state and audit together',async()=>{
 const {repo,auth}=await repository('atomic');try{const before=repo.read(),id=crypto.randomUUID(),command={type:'master.save',key:'notes',item:{id:'once',name:'Una sola escritura',text:'ensayo'}};await repo.mutate(auth.token,{revision:before.revision,requestId:id,command});const once=repo.read(),audit=repo.db.prepare('SELECT * FROM audit').all();assert.equal((await repo.mutate(auth.token,{revision:before.revision,requestId:id,command})).duplicate,true);await assert.rejects(repo.mutate(auth.token,{revision:before.revision,requestId:crypto.randomUUID(),command}),/cambiaron/);assert.deepEqual(repo.read(),once);assert.deepEqual(repo.db.prepare('SELECT * FROM audit').all(),audit);assertRelationalStore(repo.db,'textil',once.state);repo.verifyAudit()}finally{await repo.close()}
})
test('a failure after SQL projection and audit insertion rolls back state, relations, audit and request ID',async()=>{
 const {repo,auth}=await repository('late-failure');try{const before=repo.read(),audit=repo.db.prepare('SELECT * FROM audit').all(),id=crypto.randomUUID(),branch=before.state.masters.branches[0];repo.db.exec("CREATE TRIGGER fail_request BEFORE INSERT ON requests BEGIN SELECT RAISE(ABORT,'injected failure'); END");await assert.rejects(repo.mutate(auth.token,{revision:before.revision,requestId:id,command:{type:'master.save',key:'branches',item:{...branch,name:'Cambio que debe revertirse'}}}),/injected failure/);assert.deepEqual(repo.read(),before);assertRelationalStore(repo.db,'textil',before.state);assert.deepEqual(repo.db.prepare('SELECT * FROM audit').all(),audit);assert.equal(repo.db.prepare('SELECT count(*) AS n FROM requests WHERE request_id=?').get(id).n,0)}finally{await repo.close()}
})
test('two repository connections reject lost updates and preserve exactly one accepted revision',async()=>{
 const {repo,auth}=await repository('connections'),other=await Repository.open({filename:repo.filename,companyId:'textil'});try{const before=repo.read(),request={revision:before.revision,requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id:'winner',name:'Primer escritor',text:'ensayo'}}};await repo.mutate(auth.token,request);await assert.rejects(other.mutate(auth.token,{...request,requestId:crypto.randomUUID()}),/cambiaron/);assert.deepEqual(other.read(),repo.read());assert.equal(repo.read().revision,before.revision+1);assertRelationalStore(repo.db,'textil',repo.read().state)}finally{await other.close();await repo.close()}
})
test('sealed backup and independent recovery preserve relational tables, credentials and original audit',async()=>{
 const {repo}=await repository('backup');let restored;try{const before=repo.read(),backup=await repo.backupFile(join(directory,'sealed'));await inspectBackup({filename:backup});const result=await recoverBackup({filename:backup,destination:join(directory,'recovered'),reason:'Ensayo de relaciones SQL'});restored=await Repository.open({filename:result.database,companyId:'textil'});assert.deepEqual(restored.read().state,before.state);assert.equal(restored.read().revision,before.revision+1);assertRelationalStore(restored.db,'textil',before.state);assert.equal(restored.db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);restored.verifyAudit();assert.ok((await restored.login('admin',password,false,'restored')).token)}finally{if(restored)await restored.close();await repo.close()}
})
test('startup and recovery reject SQL data drift even if an operator regenerated the backup seal',async()=>{
 const {repo}=await repository('drift')
 try{
  const backup=await repo.backupFile(join(directory,'drift-sealed')),copy=join(directory,'drift-tampered.sqlite'),before=repo.read()
  for(const suffix of ['','.audit-key','.backup.json'])await copyFile(backup+suffix,copy+suffix)
  const db=new DatabaseSync(copy)
  try{db.exec('PRAGMA journal_mode=DELETE');db.prepare("UPDATE rel_parties SET data=json_set(data,'$.name','Alterado') WHERE position=0").run()}finally{db.close()}
  await sealBackup(copy,repo.key,{replace:true});const digest=createHash('sha256').update(await readFile(copy)).digest('hex')
  await assert.rejects(inspectBackup({filename:copy}),/no coinciden/)
  assert.equal(createHash('sha256').update(await readFile(copy)).digest('hex'),digest)
  await assert.rejects(Repository.open({filename:copy,companyId:'textil'}),/no coinciden/)
  const inspect=new DatabaseSync(copy,{readOnly:true})
  try{assert.deepEqual(JSON.parse(inspect.prepare('SELECT state FROM companies').get().state),before.state);assert.equal(inspect.prepare('SELECT revision FROM companies').get().revision,before.revision);assert.equal(inspect.prepare('SELECT name FROM rel_parties WHERE position=0').get().name,'Alterado')}finally{inspect.close()}
  assert.deepEqual(repo.read(),before)
 }finally{await repo.close()}
})
test('missing relational triggers or a missing migration ledger cannot silently pass backup verification',()=>{
 for(const statement of ['DROP TRIGGER rel_companies_update','DROP TABLE sica_migrations']){const state=fixture(),db=memory(state);try{db.exec(statement);assert.throws(()=>assertRelationalStore(db,'textil',state),/incompleto/)}finally{db.close()}}
})
test('an interrupted writer rolls back snapshot, SQL relations and audit while readers retain their prior snapshot',async()=>{
 const {repo}=await repository('crash'),before=repo.read(),audit=repo.db.prepare('SELECT * FROM audit').all()
 const child=spawn(process.execPath,['scripts/database-test-worker.mjs','crash',repo.filename,'textil'],{stdio:['ignore','pipe','pipe']})
 const exited=new Promise((done,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>done({code,signal}))})
 try{
  await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(new Error('El escritor no confirmó su transacción.')),15000);child.stdout.once('data',data=>{clearTimeout(timer);if(data.toString().includes('READY'))done();else reject(new Error('Confirmación inesperada.'))});child.once('error',error=>{clearTimeout(timer);reject(error)});child.once('exit',()=>{clearTimeout(timer);reject(new Error('El escritor terminó antes de la interrupción.'))})})
  assert.deepEqual(repo.read(),before);child.kill('SIGKILL');assert.equal((await exited).signal,'SIGKILL');assert.deepEqual(repo.read(),before);assert.deepEqual(repo.db.prepare('SELECT * FROM audit').all(),audit);assertRelationalStore(repo.db,'textil',before.state);repo.verifyAudit()
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited}await repo.close()}
})
test('four independent writer processes accept one revision and reject three stale commands without losing data',async()=>{
 const {repo,auth}=await repository('process-race'),before=repo.read()
 try{
  const outcomes=await Promise.all(Array.from({length:4},(_,index)=>new Promise((done,reject)=>{
   const child=spawn(process.execPath,['scripts/database-test-worker.mjs','race',repo.filename,'textil',String(before.revision),String(index)],{env:{...process.env,SICA_TEST_TOKEN:auth.token},stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);child.on('error',reject);child.on('exit',code=>{if(code!==0)return reject(new Error(errors||'Falló un escritor.'));try{done(JSON.parse(output))}catch(error){reject(error)}})
  })))
  assert.deepEqual(outcomes.map(o=>o.status).sort(),[200,409,409,409]);assert.equal(repo.read().revision,before.revision+1);assert.equal(repo.read().state.masters.notes.filter(n=>n.id.startsWith('process-writer-')).length,1);assertRelationalStore(repo.db,'textil',repo.read().state);repo.verifyAudit()
 }finally{await repo.close()}
})
test('offline test guard rejects real ARCA, arbitrary hosts and protocol tricks before any network request',()=>{
 for(const url of ['https://wsaa.arca.gov.ar/ws/services/LoginCms','https://servicios1.afip.gov.ar/wsfev1/service.asmx','https://wswhomo.afip.gov.ar/wsfev1/service.asmx','https://example.com','http://127.0.0.1.example.com','file:///tmp/no-network'])assert.throws(()=>assertLocalUrl(url),/no permiten/)
 assert.throws(()=>fetch('https://wsaa.arca.gov.ar'),/no permiten/);assert.throws(()=>https.request('https://wsaa.homo.arca.gov.ar'),/no permiten/);for(const url of ['http://127.0.0.1:1234','http://localhost:1234','http://[::1]:1234'])assert.ok(assertLocalUrl(url))
})
