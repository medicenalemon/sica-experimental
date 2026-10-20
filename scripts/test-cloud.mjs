import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFile,mkdtemp,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {execFile,spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {promisify} from 'node:util'
import pg from 'pg'
import {serverConfig} from '../server/config.mjs'
import {postgresConnectionConfig,initializePostgresSession} from '../server/postgres-connection.mjs'
import {hardenPostgresSchema} from '../server/postgres-security.mjs'
import {postgresBootstrapSql} from '../server/postgres-schema.mjs'
import {PostgresRepository} from '../server/postgres-repository.mjs'
import {startTestPostgres} from './postgres-test-cluster.mjs'
const exec=promisify(execFile),remote='postgresql://postgres.project:example@aws-0-region.pooler.supabase.com:5432/postgres'

test('Remote PostgreSQL always verifies TLS and ignores URL options that could disable verification',()=>{
 const config=postgresConnectionConfig({databaseUrl:remote+'?sslmode=require&ssl=false&uselibpqcompat=true&options=bad',poolSize:4})
 assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.max,4)
 for(const field of ['sslmode','ssl','uselibpqcompat','options'])assert.equal(new URL(config.connectionString).searchParams.has(field),false)
 assert.throws(()=>postgresConnectionConfig({databaseUrl:remote+'?sslmode=disable'}),/requiere TLS/)
 assert.throws(()=>postgresConnectionConfig({databaseUrl:remote+'?sslmode=no-verify'}),/verify-full/)
})
test('Transaction poolers are rejected before any connection; direct and session endpoints are accepted',()=>{
 for(const host of ['aws-0-region.pooler.supabase.com','db.project.supabase.co'])assert.throws(()=>postgresConnectionConfig({databaseUrl:`postgresql://user:example@${host}:6543/postgres`}),/Session pooler/)
 assert.equal(postgresConnectionConfig({databaseUrl:remote}).ssl.rejectUnauthorized,true)
 assert.equal(postgresConnectionConfig({databaseUrl:'postgresql://user:example@db.project.supabase.co/postgres'}).ssl.rejectUnauthorized,true)
})
test('Pool sizing, CA sources and local SQLite migration connections are validated',()=>{
 for(const size of [0,21,1.5,'invalid'])assert.throws(()=>postgresConnectionConfig({databaseUrl:remote,poolSize:size}),/POOL_SIZE/)
 assert.throws(()=>postgresConnectionConfig({databaseUrl:remote,sslCa:'invalid'}),/PEM/)
 assert.throws(()=>postgresConnectionConfig({databaseUrl:remote,sslCa:'a',sslCaFile:'b'}),/una sola/)
 assert.equal(postgresConnectionConfig({databaseUrl:'postgresql://user:example@localhost/db?host=%2Ftmp%2Fsocket'}).ssl,false)
 assert.equal(postgresConnectionConfig({databaseUrl:'postgresql://user:example@localhost/db?host=remote.example'}).ssl.rejectUnauthorized,true)
})
test('Public startup requires exact HTTPS origins, secure cookies and valid platform PORT',()=>{
 const env={SICA_HOST:'0.0.0.0',SICA_SECURE_COOKIE:'true',SICA_ORIGINS:'https://sica.example.com',PORT:'8080'}
 assert.equal(serverConfig(env).port,8080);assert.equal(serverConfig({...env,SICA_PORT:'3001'}).port,3001)
 for(const origin of ['https://','https://sica.example.com/path','https://user:secret@sica.example.com','https://sica.example.com/','*','http://sica.example.com',''])assert.throws(()=>serverConfig({...env,SICA_ORIGINS:origin}))
 assert.throws(()=>serverConfig({...env,SICA_SECURE_COOKIE:'false'}),/cookies seguras/)
 for(const port of ['0','65536','NaN','3.5'])assert.throws(()=>serverConfig({...env,PORT:port}),/puerto válido/)
})
test('Real PostgreSQL TLS, private schema, session reset and durable audit key work together',async t=>{
 const cluster=await startTestPostgres({tls:true}),directory=await mkdtemp(join(tmpdir(),'sica-cloud-tests-'))
 try{
  const ca=await readFile(cluster.caFile,'utf8'),options={databaseUrl:cluster.tlsDatabaseUrl,sslCa:ca,companyId:'cloud',auditKeyFile:join(directory,'cloud.audit-key'),adminPassword:'Cloud-Test-Only-2026',poolSize:1}
  await t.test('Exported bootstrap creates the runtime-compatible schema and refuses to replace an existing installation',async()=>{
   assert.equal(await readFile(resolve('deploy/supabase/bootstrap.sql'),'utf8'),postgresBootstrapSql())
   const pool=new pg.Pool(postgresConnectionConfig({databaseUrl:cluster.tlsDatabaseUrl,sslCa:ca})),client=await pool.connect()
   try{
    await client.query('BEGIN');await client.query(postgresBootstrapSql());await client.query('COMMIT')
    assert.equal((await client.query('SELECT count(*)::int AS count FROM sica.companies')).rows[0].count,0)
    await client.query('BEGIN')
    await assert.rejects(client.query(postgresBootstrapSql()),error=>error.code==='42P06')
    await client.query('ROLLBACK')
    assert.equal((await client.query('SELECT version FROM sica.sica_migrations')).rows[0].version,1)
   }finally{client.release();await pool.end()}
  })
  await t.test('A verified TLS connection authenticates, commits and persists across server restarts',async()=>{
   const repo=await PostgresRepository.open(options)
   try{
    assert.equal((await repo.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,true)
    const auth=await repo.login('admin',options.adminPassword,false,'test')
    await repo.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id:'cloud-note',name:'Compartida',text:'Persistente'}}})
    await repo.query("SET search_path=public; SET statement_timeout=0; SET lock_timeout=0")
    assert.equal((await repo.read()).state.masters.notes[0].name,'Compartida')
    const settings=await repo.query("SELECT current_setting('search_path') AS path,current_setting('statement_timeout') AS timeout")
    assert.equal(settings.rows[0].path,'sica,pg_catalog');assert.equal(settings.rows[0].timeout,'30s')
   }finally{await repo.close()}
   const reopened=await PostgresRepository.open({...options,adminPassword:undefined})
   try{assert.equal((await reopened.read()).revision,1);await reopened.login('admin',options.adminPassword,false,'other-user');await reopened.verifyAudit()}finally{await reopened.close()}
  })
  await t.test('Untrusted TLS certificates fail before creating a company',async()=>{
   await assert.rejects(PostgresRepository.open({...options,sslCa:undefined,sslCaFile:undefined,companyId:'untrusted'}),error=>/certificate|self.signed/i.test(error.message))
  })
  await t.test('Supabase API roles cannot access SICA even after accidental grants, while other schemas retain their grants',async()=>{
   const pool=new pg.Pool(postgresConnectionConfig({databaseUrl:cluster.tlsDatabaseUrl,sslCa:ca})),client=await pool.connect()
   try{
    await initializePostgresSession(client)
    await client.query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.keep_grants(id integer); GRANT SELECT ON public.keep_grants TO anon; GRANT USAGE ON SCHEMA sica TO anon,authenticated,service_role; GRANT SELECT ON ALL TABLES IN SCHEMA sica TO anon,authenticated,service_role')
    await hardenPostgresSchema(client)
    for(const role of ['anon','authenticated','service_role']){
     const grants=await client.query("SELECT has_schema_privilege($1,'sica','USAGE') AS schema_access,has_table_privilege($1,'sica.companies','SELECT') AS table_access,has_function_privilege($1,'sica.project_company_state()','EXECUTE') AS function_access",[role])
     assert.deepEqual(grants.rows[0],{schema_access:false,table_access:false,function_access:false})
    }
    assert.equal((await client.query("SELECT has_table_privilege('anon','public.keep_grants','SELECT') AS allowed")).rows[0].allowed,true)
    await client.query('SET ROLE anon')
    await assert.rejects(client.query('SELECT * FROM sica.companies'),error=>error.code==='42501')
    await client.query('RESET ROLE')
   }finally{client.release();await pool.end()}
  })
  await t.test('Provisioning command applies the same schema over verified TLS without initializing a company or disclosing credentials',async()=>{
   const result=await exec(process.execPath,[resolve('scripts/supabase-prepare.mjs')],{env:{...process.env,SICA_DATABASE_URL:cluster.tlsDatabaseUrl,SICA_DATABASE_SSL_CA:ca,SICA_DATABASE_SSL_CA_FILE:''}})
   const report=JSON.parse(result.stdout);assert.equal(report.ok,true);assert.equal(report.tls,true);assert.equal(report.companyInitialized,false);assert.ok(!result.stdout.includes(new URL(cluster.tlsDatabaseUrl).password))
  })
  await t.test('Manual cloud backup verifies offline and includes the original audit key',async()=>{
   const result=await exec(process.execPath,[resolve('scripts/postgres-data.mjs'),'backup'],{env:{...process.env,SICA_DATABASE_URL:cluster.tlsDatabaseUrl,SICA_DATABASE_SSL_CA:ca,SICA_DATABASE_SSL_CA_FILE:'',SICA_COMPANY_ID:'cloud',SICA_AUDIT_KEY_FILE:options.auditKeyFile}})
   const {filename}=JSON.parse(result.stdout)
   const verified=await exec(process.execPath,[resolve('scripts/postgres-data.mjs'),'verify','--source',filename,'--company','cloud'],{env:{...process.env,SICA_DATABASE_URL:'invalid-no-connection'}})
   assert.equal(JSON.parse(verified.stdout).seal,'HMAC verificado');assert.deepEqual(await readFile(filename+'.audit-key'),await readFile(options.auditKeyFile))
  })
  await t.test('The deployment entrypoint serves existing data with Secure cookies and a PostgreSQL healthcheck',async()=>{
   const listener=createServer();await new Promise(done=>listener.listen(0,'127.0.0.1',done));const port=listener.address().port;await new Promise(done=>listener.close(done))
   const env={...process.env,SICA_HOST:'127.0.0.1',SICA_PORT:'',PORT:String(port),SICA_SECURE_COOKIE:'true',SICA_ORIGINS:'https://sica.example.com',SICA_DATABASE_DRIVER:'postgres',SICA_COMPANIES_FILE:'',SICA_DATABASE_URL:cluster.tlsDatabaseUrl,SICA_DATABASE_SSL_CA:ca,SICA_DATABASE_SSL_CA_FILE:'',SICA_COMPANY_ID:'cloud',SICA_AUDIT_KEY_FILE:options.auditKeyFile,SICA_ARCA_MODE:'disabled'}
   const child=spawn(process.execPath,['--import',resolve('scripts/test-offline-guard.mjs'),resolve('server/start.mjs')],{env,stdio:['ignore','pipe','pipe']}),exited=new Promise(done=>child.once('exit',done))
   try{
    await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(new Error('Startup timeout')),15000);child.stdout.on('data',data=>{if(data.toString().includes('SICA servidor:')){clearTimeout(timer);done()}});child.once('error',error=>{clearTimeout(timer);reject(error)});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Startup exited: '+code))})})
    await exec(process.execPath,[resolve('scripts/healthcheck.mjs')],{env})
    const response=await fetch(`http://127.0.0.1:${port}/api/login`,{method:'POST',headers:{'Content-Type':'application/json','X-SICA-Client':'web',Origin:'https://sica.example.com'},body:JSON.stringify({username:'admin',password:options.adminPassword})})
    assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/; Secure/);const body=await response.json();assert.equal(body.revision,1);assert.ok(!JSON.stringify(body).includes(new URL(cluster.tlsDatabaseUrl).password))
   }finally{child.kill('SIGTERM');await exited}
  })
 }finally{await cluster.stop();await rm(directory,{recursive:true,force:true})}
})
