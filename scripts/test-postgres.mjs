import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {mkdtemp,rm,readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {PostgresRepository} from '../server/postgres-repository.mjs'
import pg from 'pg'
import {createHmac} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {Repository} from '../server/repository.mjs'
import {createApplication} from '../server/http.mjs'
import {FiscalService} from '../server/fiscal-service.mjs'
import {protectTicket,readTicket,canonical} from '../server/fiscal-store.mjs'
import {exportPostgresCompany,readPostgresBackup,recoverPostgresBackup,importPostgresCompany} from '../server/postgres-backup.mjs'
import {exportSQLiteCompany,migrateSQLiteToPostgres} from '../server/sqlite-to-postgres.mjs'
import {fileDigest} from '../server/backup-integrity.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,saveCheque} from '../.server/domain/engine.js'
import {receiptPrintFixture} from './receipt-print-fixture.mjs'
import {today} from '../.server/domain/constants.js'
const databaseUrl=process.env.SICA_TEST_DATABASE_URL
if(!databaseUrl||!process.env.SICA_TEST_PG_DIRECTORY)throw new Error('Ejecutá la suite con el cluster PostgreSQL temporal, no contra una base de usuario.')
assert.equal(new URL(databaseUrl).searchParams.get('host'),join(process.env.SICA_TEST_PG_DIRECTORY,'socket'))
const directory=await mkdtemp(join(tmpdir(),'sica-pg-tests-')),password='Postgres-Only-Test-2026'
after(()=>rm(directory,{recursive:true,force:true}))
async function fixture(name){const repo=await PostgresRepository.open({databaseUrl,companyId:name,adminPassword:password,auditKeyFile:join(directory,name+'.audit-key')});return {repo,auth:await repo.login('admin',password,false,'pg-test')}}
function financialState(){return receiptPrintFixture({initialState,loadTextileDemo,createDocument,saveCheque}).state}
async function populated(name){const f=await fixture(name);await f.repo.mutate(f.auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:financialState()}},true);return f}
async function freshDatabase(name){assert.match(name,/^[a-z_]+$/);const pool=new pg.Pool({connectionString:databaseUrl});try{await pool.query('CREATE DATABASE sica_'+name)}finally{await pool.end()}const url=new URL(databaseUrl);url.pathname='/sica_'+name;return url.href}
async function note(repo,auth,id,revision){return repo.mutate(auth.token,{revision:revision??(await repo.read()).revision,requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id,name:id,text:'Ensayo PostgreSQL'}}})}
test('PostgreSQL initializes its real relational schema and authenticates without leaking credentials',async()=>{
 const {repo,auth}=await fixture('initialize')
 try{const view=await repo.publicState(auth.actor);assert.equal(view.revision,0);assert.ok(view.state.masters.users.every(u=>!u.passwordHash&&!u.salt));await repo.verifyAudit();assert.equal((await repo.query("SELECT count(*)::integer AS n FROM pg_tables WHERE schemaname='sica' AND tablename LIKE 'rel_%'")).rows[0].n,14)}finally{await repo.close()}
})
test('PostgreSQL persists exact financial state, nested receipts and original JSON property order after reopening',async()=>{
 const {repo}=await populated('roundtrip'),before=await repo.read()
 await repo.close();const reopened=await PostgresRepository.open({databaseUrl,companyId:'roundtrip',auditKeyFile:join(directory,'roundtrip.audit-key')})
 try{assert.deepEqual(await reopened.read(),before);assert.equal(JSON.stringify((await reopened.read()).state),JSON.stringify(before.state));assert.equal((await reopened.query('SELECT sum(amount) AS n FROM rel_document_allocations WHERE company_id=$1',['roundtrip'])).rows[0].n,'13000');await reopened.verifyAudit()}finally{await reopened.close()}
})
for(const [label,change] of [
 ['party',s=>s.documents[0].partyId='missing'],['party side',s=>s.documents[0].side='proveedor'],['branch',s=>s.documents[0].branchId='missing'],['product',s=>s.documents[0].lines[0].productId='missing'],['allocation',s=>s.documents.at(-1).allocations[0].documentId='missing'],['source',s=>s.documents[0].sourceId='missing'],['account',s=>s.entries[0].lines[0].accountId='missing'],['deposit',s=>s.stockMoves[0].depositId='missing'],['treasury',s=>s.treasuryMoves[0].treasuryId='missing']
])test(`PostgreSQL rejects a broken ${label} foreign key and rolls back the entire projection`,async()=>{
 const {repo}=await populated('fk_'+label.replaceAll(' ','_'))
 try{const before=await repo.read(),bad=structuredClone(before.state);change(bad);await assert.rejects(repo.transaction(()=>repo.query('UPDATE companies SET state=$1 WHERE id=$2',[JSON.stringify(bad),repo.companyId])),error=>error.code==='23503');assert.deepEqual(await repo.read(),before);await repo.verifyAudit()}finally{await repo.close()}
})
for(const [name,value] of [['fractional',1.5],['unsafe',Number.MAX_SAFE_INTEGER+1],['text','100'],['null',null]])test(`PostgreSQL rejects ${name} monetary values without rounding`,async()=>{
 const {repo}=await populated('money_'+name)
 try{const before=await repo.read(),bad=structuredClone(before.state);bad.documents[0].total=value;await assert.rejects(repo.transaction(()=>repo.query('UPDATE companies SET state=$1 WHERE id=$2',[JSON.stringify(bad),repo.companyId])));assert.deepEqual(await repo.read(),before)}finally{await repo.close()}
})
test('PostgreSQL SQL totals reconcile journal, treasury and stock with the operational state',async()=>{
 const {repo}=await populated('totals')
 try{const {state}=await repo.read(),accounts=(await repo.query('SELECT * FROM rel_account_totals WHERE company_id=$1',[repo.companyId])).rows;assert.equal(accounts.reduce((n,r)=>n+Number(r.balance),0),0);for(const row of (await repo.query('SELECT * FROM rel_treasury_balances WHERE company_id=$1',[repo.companyId])).rows)assert.equal(Number(row.amount),state.treasuryMoves.filter(m=>m.treasuryId===row.treasury_id).reduce((n,m)=>n+m.amount,0));for(const row of (await repo.query('SELECT * FROM rel_stock_balances WHERE company_id=$1',[repo.companyId])).rows)assert.equal(row.quantity,state.stockMoves.filter(m=>m.productId===row.product_id&&m.depositId===row.deposit_id).reduce((n,m)=>n+m.quantity,0))}finally{await repo.close()}
})
test('PostgreSQL commits one command and treats an identical retry as idempotent while rejecting changed payloads',async()=>{
 const {repo,auth}=await fixture('idempotent')
 try{const request={revision:0,requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id:'one',name:'Original',text:'ensayo'}}};await repo.mutate(auth.token,request);assert.equal((await repo.mutate(auth.token,request)).duplicate,true);await assert.rejects(repo.mutate(auth.token,{...request,command:{...request.command,item:{...request.command.item,name:'Distinto'}}}),error=>error.status===409);assert.equal((await repo.read()).revision,1);assert.equal((await repo.query('SELECT count(*)::integer AS n FROM requests WHERE company_id=$1',[repo.companyId])).rows[0].n,1);await repo.verifyAudit()}finally{await repo.close()}
})
test('PostgreSQL serializes four independent repositories and rejects stale writes without lost updates',async()=>{
 const {repo,auth}=await fixture('race'),others=await Promise.all(Array.from({length:3},()=>PostgresRepository.open({databaseUrl,companyId:'race',auditKeyFile:repo.auditKeyFile})))
 try{const outcomes=await Promise.allSettled([repo,...others].map((r,i)=>note(r,auth,'writer-'+i,0)));assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.ok(outcomes.filter(r=>r.status==='rejected').every(r=>r.reason.status===409));assert.equal((await repo.read()).revision,1);assert.equal((await repo.read()).state.masters.notes.length,1);await repo.verifyAudit()}finally{await Promise.all([repo,...others].map(r=>r.close()))}
})
test('PostgreSQL repeatable-read snapshots stay coherent while a second connection commits a command',async()=>{
 const {repo,auth}=await fixture('snapshot'),reader=await PostgresRepository.open({databaseUrl,companyId:'snapshot',auditKeyFile:repo.auditKeyFile});let release,ready
 const gate=new Promise(done=>release=done),started=new Promise(done=>ready=done)
 try{const reading=reader.transaction(async()=>{const before=await reader.read();ready();await gate;assert.deepEqual(await reader.read(),before)},{readOnly:true});await started;await note(repo,auth,'committed',0);release();await reading;assert.equal((await reader.read()).revision,1)}finally{release();await reader.close();await repo.close()}
})
test('PostgreSQL failure after projection and audit rolls back the state, audit event and idempotency key',async()=>{
 const {repo,auth}=await populated('rollback')
 try{const before=await repo.read(),events=(await repo.query('SELECT * FROM audit WHERE company_id=$1 ORDER BY id',[repo.companyId])).rows,requestId=crypto.randomUUID();await repo.query("CREATE FUNCTION sica.reject_test_request() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.company_id='rollback' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER reject_test_request BEFORE INSERT ON requests FOR EACH ROW EXECUTE FUNCTION sica.reject_test_request()")
 await assert.rejects(repo.mutate(auth.token,{revision:before.revision,requestId,command:{type:'master.save',key:'branches',item:{...before.state.masters.branches[0],name:'No confirmar'}}}),/injected failure/);assert.deepEqual(await repo.read(),before);assert.deepEqual((await repo.query('SELECT * FROM audit WHERE company_id=$1 ORDER BY id',[repo.companyId])).rows,events);assert.equal((await repo.query('SELECT count(*)::integer AS n FROM requests WHERE company_id=$1 AND request_id=$2',[repo.companyId,requestId])).rows[0].n,0)
 }finally{await repo.query('DROP TRIGGER reject_test_request ON requests;DROP FUNCTION sica.reject_test_request()');await repo.close()}
})
test('PostgreSQL company isolation prevents cross-company tokens, document references and leaked backups',async()=>{
 const a=await populated('company_a'),b=await fixture('company_b')
 try{await assert.rejects(b.repo.auth(a.auth.token),error=>error.status===401);const bad=initialState();bad.documents=[(await a.repo.read()).state.documents[0]];await assert.rejects(b.repo.transaction(()=>b.repo.query('UPDATE companies SET state=$1 WHERE id=$2',[JSON.stringify(bad),b.repo.companyId])),error=>error.code==='23503');const exportB=await exportPostgresCompany(b.repo);assert.equal(JSON.parse(exportB.company.state).documents.length,0);for(const rows of Object.values(exportB.tables))assert.ok(rows.every(r=>r.company_id==='company_b'))}finally{await a.repo.close();await b.repo.close()}
})
test('PostgreSQL permissions, password changes and session revocation remain effective after persistence',async()=>{
 const {repo,auth}=await fixture('permissions')
 try{await repo.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{type:'users.save',item:{id:'notes',name:'Notas',username:'notes',role:'Personalizado',permissions:'/herramientas/notas',active:true},password}});const restricted=await repo.login('notes',password,false,'restricted');await assert.rejects(repo.mutate(restricted.token,{revision:1,requestId:crypto.randomUUID(),command:{type:'settings.save',settings:(await repo.read()).state.settings}}),error=>error.status===403);const admin2=await repo.login('admin',password,false,'127.0.0.1','second');const sessions=await repo.activeSessions(auth.token),target=sessions.find(s=>s.terminal==='second');await repo.mutate(auth.token,{revision:1,requestId:crypto.randomUUID(),command:{type:'sessions.revoke',sessionId:target.id,reason:'Ensayo de revocación'}});await assert.rejects(repo.auth(admin2.token),error=>error.status===401);await repo.mutate(auth.token,{revision:2,requestId:crypto.randomUUID(),command:{type:'users.save',item:{id:'notes',name:'Notas',username:'notes',role:'Personalizado',permissions:'/herramientas/notas',active:true},password:'Changed-Only-Test-2026'}});await assert.rejects(repo.auth(restricted.token),error=>error.status===401)}finally{await repo.close()}
})
test('PostgreSQL login throttling persists and never exposes derived credentials',async()=>{
 const {repo}=await fixture('login_throttle')
 try{for(let i=0;i<10;i++)await assert.rejects(repo.login('admin','incorrect',false,'blocked'),error=>error.status===401);await assert.rejects(repo.login('admin',password,false,'blocked'),error=>error.status===429)}finally{await repo.close()}
})
test('PostgreSQL restores operational JSON under admin control while preserving credentials and receipt originals',async()=>{
 const {repo,auth}=await populated('json_restore')
 try{const before=await repo.read(),copy=structuredClone(before.state);copy.settings.name='Restauración controlada';copy.masters.users[0].passwordHash='a'.repeat(64);await repo.mutate(auth.token,{revision:before.revision,requestId:crypto.randomUUID(),command:{state:copy}},true);assert.equal((await repo.read()).state.masters.users[0].passwordHash,before.state.masters.users[0].passwordHash);const bad=structuredClone((await repo.read()).state);delete bad.documents.find(d=>d.receiptSnapshot).receiptSnapshot;await assert.rejects(repo.mutate(auth.token,{revision:2,requestId:crypto.randomUUID(),command:{state:bad}},true),error=>error.status===409);assert.equal((await repo.recoveries(auth.actor)).length,2);assert.deepEqual(await repo.recoveries(auth.actor,2),before.state)}finally{await repo.close()}
})
test('PostgreSQL backup recovers independently with original credentials and revokes all copied sessions',async()=>{
 const {repo}=await populated('backup'),before=await repo.read(),backup=await repo.backupFile(join(directory,'backups')),target=await freshDatabase('recovered'),key=join(directory,'restored.audit-key')
 await repo.close();const inspected=await readPostgresBackup({filename:backup});assert.equal(inspected.report.documents,before.state.documents.length)
 const report=await recoverPostgresBackup({filename:backup,databaseUrl:target,auditKeyFile:key,reason:'Ensayo independiente'}),restored=await PostgresRepository.open({databaseUrl:target,companyId:'backup',auditKeyFile:key})
 try{assert.equal(report.revokedSessions,1);assert.deepEqual((await restored.read()).state,before.state);assert.equal((await restored.read()).revision,before.revision+1);assert.equal((await restored.activeSessions((await restored.login('admin',password,false,'restored')).token)).length,1);await restored.verifyAudit();await assert.rejects(recoverPostgresBackup({filename:backup,databaseUrl:target,auditKeyFile:key,reason:'No reemplazar'}),/ya existe/)}finally{await restored.close()}
})
test('PostgreSQL backup verification rejects content, key and company tampering without connecting to ARCA',async()=>{
 const {repo}=await populated('tampering')
 try{const backup=await repo.backupFile(join(directory,'tamper-backups')),copy=join(directory,'tampered.sica-pg.json'),envelope=JSON.parse(await readFile(backup,'utf8'));envelope.payload=envelope.payload.replace('SICA Textil','Otro nombre');await writeFile(copy,JSON.stringify(envelope));await copyFile(backup+'.audit-key',copy+'.audit-key');await assert.rejects(readPostgresBackup({filename:copy}),/HMAC/);await assert.rejects(readPostgresBackup({filename:backup,expectedCompanyId:'another'}),/empresa indicada/);await writeFile(copy+'.audit-key',Buffer.alloc(32,7));await assert.rejects(readPostgresBackup({filename:copy}),/HMAC/)}finally{await repo.close()}
})
test('PostgreSQL backup rejects deliberately re-signed invalid domain state and broken audit chains',async()=>{
 const {repo}=await populated('resigned')
 try{const backup=await repo.backupFile(join(directory,'resigned-backups')),envelope=JSON.parse(await readFile(backup,'utf8')),bundle=JSON.parse(envelope.payload),state=JSON.parse(bundle.company.state);state.entries[0].lines[0].debit++;bundle.company.state=JSON.stringify(state);envelope.payload=JSON.stringify(bundle);envelope.signature=createHmac('sha256',repo.key).update('sica-postgres-backup:v1\n'+envelope.payload).digest('hex');const copy=join(directory,'resigned.sica-pg.json');await writeFile(copy,JSON.stringify(envelope));await copyFile(backup+'.audit-key',copy+'.audit-key');await assert.rejects(readPostgresBackup({filename:copy}),/asiento inválido|desbalanceado/)}finally{await repo.close()}
})
test('PostgreSQL startup detects missing keys, SQL drift and altered HMAC audit',async()=>{
 const f=await populated('integrity'),filename=f.repo.auditKeyFile
 try{await assert.rejects(PostgresRepository.open({databaseUrl,companyId:'integrity',auditKeyFile:join(directory,'missing.audit-key')}),/Falta la clave/);await f.repo.query("UPDATE rel_parties SET data=json_build_object('id',id,'side',side,'name','Alterado') WHERE company_id=$1 AND position=0",['integrity']);await assert.rejects(f.repo.read(),/no coinciden/);await f.repo.query('UPDATE companies SET state=state WHERE id=$1',['integrity']);await f.repo.query("UPDATE audit SET hash=$1 WHERE company_id=$2",['a'.repeat(64),'integrity']);await assert.rejects(PostgresRepository.open({databaseUrl,companyId:'integrity',auditKeyFile:filename}),/auditoría no es válida/)}finally{await f.repo.close()}
})
test('PostgreSQL HTTP routes report the backend, enforce CSRF and persist commands without exposing database credentials',async()=>{
 const origin='http://sica.test',app=await createApplication({backend:'postgres',databaseUrl,auditKeyFile:join(directory,'http.audit-key'),companyId:'http',adminPassword:password,origins:[origin]})
 await new Promise(done=>app.server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${app.server.address().port}/api/`
 try{assert.equal((await (await fetch(base+'health')).json()).storage,'postgres');assert.equal((await fetch(base+'state')).status,401);const response=await fetch(base+'login',{method:'POST',headers:{'Content-Type':'application/json','X-SICA-Client':'web',Origin:origin},body:JSON.stringify({username:'admin',password})}),snapshot=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];assert.equal(response.status,200);assert.ok(!JSON.stringify(snapshot).includes('passwordHash'));assert.ok(!JSON.stringify(snapshot).includes(databaseUrl));const payload={revision:0,requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id:'http-note',name:'HTTP',text:'Persistido en PG'}}};assert.equal((await fetch(base+'commands',{method:'POST',headers:{'Content-Type':'application/json','X-SICA-Client':'web',Origin:origin,Cookie:cookie},body:JSON.stringify(payload)})).status,403);assert.equal((await fetch(base+'commands',{method:'POST',headers:{'Content-Type':'application/json','X-SICA-Client':'web','X-SICA-CSRF':snapshot.csrf,Origin:origin,Cookie:cookie},body:JSON.stringify(payload)})).status,200);assert.equal((await app.repository.read()).state.masters.notes[0].id,'http-note');assert.equal((await fetch(base+'fiscal/status',{headers:{Cookie:cookie}})).status,200)}finally{await new Promise(done=>app.server.close(done));await app.close()}
})
function fiscalClient(){let sent=0;return {config:{cuit:'30712345671'},status:()=>({configured:true,environment:'homologacion',productionEnabled:false,simulated:true}),async last(){return 41},async authorize(){sent++;throw new Error('Timeout simulado')},async consult(){return {state:'aprobado',cae:'12345678901234',expires:'2026-12-31',messages:[]}},sent:()=>sent}}
test('PostgreSQL fiscal simulation conserves an uncertain reservation, locks its series and recovers without duplicate authorization',async()=>{
 const {repo,auth}=await fixture('fiscal'),state=initialState();loadTextileDemo(state);state.settings.cuit='30712345671';const product=state.products[0],party=state.parties.find(p=>p.side==='cliente'),base={side:'cliente',kind:'factura',letter:'A',date:today(),due:today(),branchId:'central',partyId:party.id,lines:[{productId:product.id,description:product.name,quantity:1,unit:product.unit,price:10000,tax:'21',discount:0}],payments:[],allocations:[],perceptions:0,sourceId:'',depositId:'principal',observations:'Ensayo ARCA ficticio',responsible:'Administrador',costCenter:'',official:false,valued:true,seller:'',priceList:'general'},invoice=createDocument(state,base,'Administrador General'),another=createDocument(state,base,'Administrador General')
 try{await repo.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true);const client=fiscalClient(),service=new FiscalService(repo,{mode:'homologacion',cuit:state.settings.cuit},{client}),preview=await service.preview(auth.token,invoice.id),input={documentId:invoice.id,revision:preview.reviewRevision,reviewRevision:preview.reviewRevision,options:{},action:'autorizar'};assert.equal((await service.operate(auth.token,input)).state,'incierto');assert.equal((await service.get(invoice.id)).number,42);const p=await service.preview(auth.token,another.id);await assert.rejects(service.operate(auth.token,{...input,documentId:another.id,revision:p.reviewRevision,reviewRevision:p.reviewRevision}),/sin resolver/);assert.equal((await service.operate(auth.token,{...input,action:'consultar'})).state,'aprobado');assert.equal(client.sent(),1);const view=await repo.publicState(auth.actor);assert.equal(view.state.documents.find(d=>d.id===invoice.id).fiscal.simulated,true);const bad=structuredClone((await repo.read()).state);bad.documents=bad.documents.filter(d=>d.id!==invoice.id);await assert.rejects(repo.mutate(auth.token,{revision:(await repo.read()).revision,requestId:crypto.randomUUID(),command:{state:bad}},true));await repo.verifyAudit()}finally{await repo.close()}
})
test('PostgreSQL fiscal advisory locks exclude a second instance for the same document',async()=>{
 const {repo}=await fixture('fiscal_lock'),other=await PostgresRepository.open({databaseUrl,companyId:'fiscal_lock',auditKeyFile:repo.auditKeyFile});let release,ready;const gate=new Promise(done=>release=done),started=new Promise(done=>ready=done)
 try{const held=repo.fiscalExclusive('homologacion','document',async()=>{ready();await gate});await started;await assert.rejects(other.fiscalExclusive('homologacion','document',async()=>{}),error=>error.status===409);release();await held;await other.fiscalExclusive('homologacion','document',async()=>{})}finally{release();await other.close();await repo.close()}
})
test('PostgreSQL encrypted fiscal tickets remain scoped to their issuer and environment after backup',async()=>{
 const {repo}=await populated('tickets'),issuer='30712345671',context=canonical(['tickets','homologacion',issuer,'wsfe']),ticket={token:'SYNTHETIC-TOKEN',sign:'SYNTHETIC-SIGN',expires:Date.now()+3600000}
 try{await repo.query('INSERT INTO fiscal_tickets(company_id,environment,issuer,secret) VALUES($1,$2,$3,$4)',['tickets','homologacion',issuer,protectTicket(repo.key,context,ticket)]);const backup=await repo.backupFile(join(directory,'ticket-backups')),{bundle,key}=await readPostgresBackup({filename:backup});assert.deepEqual(readTicket(key,context,bundle.tables.fiscal_tickets[0].secret),ticket);assert.throws(()=>readTicket(key,canonical(['tickets','produccion',issuer,'wsfe']),bundle.tables.fiscal_tickets[0].secret));assert.ok(!bundle.tables.fiscal_tickets[0].secret.includes('SYNTHETIC-TOKEN'))}finally{await repo.close()}
})
test('SQLite migration preserves the source bytes, financial state, audit prefix and credentials while revoking sessions',async()=>{
 const filename=join(directory,'migration.sqlite'),source=await Repository.open({filename,companyId:'migrated',adminPassword:password}),auth=await source.login('admin',password,false,'sqlite');await source.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:financialState()}},true);const before=source.read(),events=source.db.prepare('SELECT * FROM audit ORDER BY id').all();await source.close();const sha=await fileDigest(filename),report=await migrateSQLiteToPostgres({filename,companyId:'migrated',databaseUrl,auditKeyFile:join(directory,'migrated.audit-key')}),target=await PostgresRepository.open({databaseUrl,companyId:'migrated',auditKeyFile:join(directory,'migrated.audit-key')})
 try{assert.equal(await fileDigest(filename),sha);assert.deepEqual((await target.read()).state,before.state);assert.equal(report.revision,before.revision+1);assert.equal(report.revokedSessions,1);assert.ok((await target.login('admin',password,false,'migrated')).token);const migrated=(await target.query('SELECT * FROM audit WHERE company_id=$1 ORDER BY id',['migrated'])).rows;assert.deepEqual(migrated.slice(0,events.length).map(r=>r.record),events.map(r=>r.record));await target.verifyAudit();await assert.rejects(migrateSQLiteToPostgres({filename,companyId:'migrated',databaseUrl,auditKeyFile:target.auditKeyFile}),/ya existe/)}finally{await target.close()}
})
test('PostgreSQL writes to another company can commit while the first company holds a write transaction',async()=>{
 const a=await fixture('parallel_a'),b=await fixture('parallel_b');let release,ready;const gate=new Promise(done=>release=done),started=new Promise(done=>ready=done)
 try{const held=a.repo.transaction(async()=>{ready();await gate});await started;let timer;try{await Promise.race([note(b.repo,b.auth,'independent'),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('La segunda empresa quedó bloqueada.')),3000))])}finally{clearTimeout(timer)}release();await held;assert.equal((await b.repo.read()).revision,1);assert.equal((await a.repo.read()).revision,0)}finally{release();await a.repo.close();await b.repo.close()}
})
test('PostgreSQL terminates an uncommitted writer without losing the prior state or crashing the connection pool',async()=>{
 const {repo}=await populated('interrupted'),before=await repo.read(),control=new pg.Pool({connectionString:databaseUrl})
 try{await assert.rejects(repo.transaction(async()=>{const state=structuredClone(before.state);state.masters.branches[0].name='Cambio sin confirmar';await repo.query('UPDATE companies SET state=$1,revision=revision+1 WHERE id=$2',[JSON.stringify(state),repo.companyId]);const pid=(await repo.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;await control.query('SELECT pg_terminate_backend($1)',[pid]);await repo.query('SELECT 1')}));assert.deepEqual(await repo.read(),before);await repo.verifyAudit()}finally{await control.end();await repo.close()}
})
test('PostgreSQL migration checksum and disabled relational triggers cannot silently pass startup',async()=>{
 const {repo}=await fixture('schema_integrity'),key=repo.auditKeyFile
 try{
  const checksum=(await repo.query('SELECT checksum FROM sica_migrations WHERE version=1')).rows[0].checksum
  try{await repo.query("UPDATE sica_migrations SET checksum='changed' WHERE version=1");await assert.rejects(PostgresRepository.open({databaseUrl,companyId:repo.companyId,auditKeyFile:key}),/checksum.*incompatible/)}finally{await repo.query('UPDATE sica_migrations SET checksum=$1 WHERE version=1',[checksum])}
  try{await repo.query('ALTER TABLE companies DISABLE TRIGGER rel_companies_state');await assert.rejects(PostgresRepository.open({databaseUrl,companyId:repo.companyId,auditKeyFile:key}),/trigger.*habilitado/)}finally{await repo.query('ALTER TABLE companies ENABLE TRIGGER rel_companies_state')}
 }finally{await repo.close()}
})
test('PostgreSQL backup CLI verifies offline, exposes no credentials and rejects malformed arguments',async()=>{
 const {repo}=await populated('cli'),backup=await repo.backupFile(join(directory,'cli-backups')),env={...process.env,SICA_DATABASE_URL:'postgresql://unused@127.0.0.1:1/unused'};delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_WORKER_ID
 const run=promisify(execFile)
 try{const verified=JSON.parse((await run(process.execPath,['scripts/postgres-data.mjs','verify','--source',backup,'--company','cli'],{env})).stdout);assert.equal(verified.companyId,'cli');assert.ok(!JSON.stringify(verified).includes('passwordHash'));assert.ok(!JSON.stringify(verified).includes(password));for(const args of [['verify'],['verify','--source',backup,'--source',backup],['verify','--source',backup,'--unknown','x'],['verify','--source',backup,'--reason','No permitido']])await assert.rejects(run(process.execPath,['scripts/postgres-data.mjs',...args],{env}));assert.match((await run(process.execPath,['scripts/postgres-data.mjs','--help'],{env})).stdout,/No se realiza ninguna conexión a ARCA/)}finally{await repo.close()}
})

// Dedicated disposable databases let every historical file keep its original
// company ID, encryption context and signatures. No source company is renamed.
let historyTarget,historyRecovery
const historyChecks=[],historyFilesPassed=new Set(),historicalNames=(await readdir('var')).filter(name=>name.endsWith('.sqlite')).sort()
async function clearHistoryDatabase(url){const pool=new pg.Pool({connectionString:url});try{await pool.query('TRUNCATE sica.companies CASCADE')}finally{await pool.end()}}
for(const name of historicalNames)test(`historical SQLite → PostgreSQL → independent recovery: ${name}`,async()=>{
 if(!historyTarget){historyTarget=await freshDatabase('history');historyRecovery=await freshDatabase('history_recovery')}
 const filename=join('var',name),sourceSha256=await fileDigest(filename)
 const sourceDb=new (await import('node:sqlite')).DatabaseSync(filename,{readOnly:true});let ids
 try{ids=sourceDb.prepare('SELECT id FROM companies ORDER BY id').all().map(r=>r.id)}finally{sourceDb.close()}
 for(const companyId of ids){
  const {bundle,key}=await exportSQLiteCompany({filename,companyId}),auditKeyFile=join(directory,'history-'+name+'-'+companyId+'.audit-key'),migration=await importPostgresCompany({bundle,key,databaseUrl:historyTarget,auditKeyFile,reason:'Ensayo de migración histórica desde SQLite.',action:'Migrar empresa de SQLite a PostgreSQL'}),repo=await PostgresRepository.open({databaseUrl:historyTarget,companyId,auditKeyFile})
  try{
   const current=await repo.read();assert.equal(JSON.stringify(current.state),JSON.stringify(JSON.parse(bundle.company.state)));assert.equal(current.revision,Number(bundle.company.revision)+1);await repo.verifyAudit();await repo.assertFiscalState(current.state)
   const backup=await repo.backupFile(join(directory,'historical-backups')),restoredKey=join(directory,'recovered-'+name+'-'+companyId+'.audit-key'),recovery=await recoverPostgresBackup({filename:backup,databaseUrl:historyRecovery,auditKeyFile:restoredKey,reason:'Ensayo independiente del respaldo PostgreSQL.'}),restored=await PostgresRepository.open({databaseUrl:historyRecovery,companyId,auditKeyFile:restoredKey})
   try{
    assert.equal(JSON.stringify((await restored.read()).state),JSON.stringify(current.state));assert.equal((await restored.read()).revision,current.revision+1);assert.equal((await restored.query('SELECT count(*)::integer AS n FROM sessions WHERE company_id=$1',[companyId])).rows[0].n,0);await restored.verifyAudit();await restored.assertFiscalState(current.state)
    historyChecks.push({database:filename,companyId,sourceSha256,sourceRevision:Number(bundle.company.revision),migratedRevision:migration.revision,recoveredRevision:recovery.revision,documents:current.state.documents.length,entries:current.state.entries.length,fiscalJobs:bundle.tables.fiscal_jobs.length,fiscalTickets:bundle.tables.fiscal_tickets.length,audit:'HMAC validada',state:'Orden y contenido JSON conservados',recovery:'ok',sourceUnmodified:true})
   }finally{await restored.close()}
  }finally{await repo.close()}
  await clearHistoryDatabase(historyTarget);await clearHistoryDatabase(historyRecovery)
 }
 assert.equal(await fileDigest(filename),sourceSha256)
 historyFilesPassed.add(name)
})
after(async()=>{await mkdir('output/qa/postgres',{recursive:true,mode:0o700});await writeFile('output/qa/postgres/history.json',JSON.stringify({date:'2026-10-19',databases:historyChecks.length,filesPassed:historyFilesPassed.size,expected:historicalNames.length,ok:historyFilesPassed.size===historicalNames.length,checks:historyChecks},null,2)+'\n',{mode:0o600})})
