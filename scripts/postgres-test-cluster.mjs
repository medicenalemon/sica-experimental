import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {randomBytes} from 'node:crypto'
import pg from 'pg'
import {createServer} from 'node:net'
const exec=promisify(execFile)
export async function startTestPostgres({tls=false}={}){
 const bin=process.env.SICA_PG_BIN||(await exec('pg_config',['--bindir'])).stdout.trim()
 const directory=await mkdtemp(join(tmpdir(),'sica-postgres-')),data=join(directory,'data'),socket=join(directory,'socket'),password=randomBytes(24).toString('hex'),passwordFile=join(directory,'password')
 let started=false
 try{
  await mkdir(socket,{mode:0o700});await writeFile(passwordFile,password,{mode:0o600})
  await exec(join(bin,'initdb'),['-D',data,'--username=sica_test','--pwfile='+passwordFile,'--auth-local=scram-sha-256','--auth-host=scram-sha-256','--encoding=UTF8','--locale=C'],{maxBuffer:1024*1024})
  let tlsOptions='',port
  if(tls){
   const listener=createServer();await new Promise((done,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',done)});port=listener.address().port;await new Promise(done=>listener.close(done))
   await exec('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'server.key'),'-out',join(directory,'server.crt'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'])
   const {chmod}=await import('node:fs/promises');await chmod(join(directory,'server.key'),0o600)
   tlsOptions=` -c listen_addresses=127.0.0.1 -p ${port} -c ssl=on -c ssl_cert_file=${join(directory,'server.crt')} -c ssl_key_file=${join(directory,'server.key')}`
  }
  await exec(join(bin,'pg_ctl'),['-D',data,'-l',join(directory,'postgres.log'),'-o',`-k ${socket} -c listen_addresses='' -c unix_socket_permissions=0700 -c fsync=on -c synchronous_commit=on${tlsOptions}`,'-w','start'],{maxBuffer:1024*1024});started=true
  const connection=`postgresql://sica_test:${password}@localhost${port?':'+port:''}/postgres?host=${encodeURIComponent(socket)}`
  const pool=new pg.Pool({connectionString:connection});try{await pool.query('CREATE DATABASE sica_test')}finally{await pool.end()}
  const databaseUrl=connection.replace('/postgres?','/sica_test?')
  return {databaseUrl,...(tls?{tlsDatabaseUrl:`postgresql://sica_test:${password}@127.0.0.1:${port}/sica_test?sslmode=verify-full`,caFile:join(directory,'server.crt')}:{}),directory,bin,data,async stop(){if(started){await exec(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop']);started=false}await rm(directory,{recursive:true,force:true})}}
 }catch(error){if(started)await exec(join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop']).catch(()=>{});await rm(directory,{recursive:true,force:true});throw error}
}
if(process.argv[1]===resolve('scripts/postgres-test-cluster.mjs')){
 const cluster=await startTestPostgres()
 try{
  const child=spawn(process.execPath,['--import',resolve('scripts/test-offline-guard.mjs'),'--test','--test-reporter=tap',resolve('scripts/test-postgres.mjs')],{env:{...process.env,SICA_TEST_DATABASE_URL:cluster.databaseUrl,SICA_TEST_PG_DIRECTORY:cluster.directory,SICA_ARCA_MODE:'disabled'},stdio:'inherit'})
  const code=await new Promise((done,reject)=>{child.on('error',reject);child.on('exit',done)});if(code!==0)process.exitCode=code||1
 }finally{await cluster.stop()}
}
