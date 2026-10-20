import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
import {readPostgresBackup} from '../server/postgres-backup.mjs'

process.umask(0o077)
const base=process.env.VITE_SICA_API_URL
if(!base?.startsWith('https://')||!process.env.SUPABASE_SECRET_KEY)throw new Error('Configurá .env con URL y clave privada de Supabase.')
const credentialFile='var/supabase-admin.local.json'
await mkdir('var',{recursive:true,mode:0o700});await chmod('.env',0o600)
let credentials
try{credentials=JSON.parse(await readFile(credentialFile,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error;credentials={url:base,username:'admin',password:randomBytes(24).toString('base64url')};await writeFile(credentialFile,JSON.stringify(credentials,null,2)+'\n',{mode:0o600,flag:'wx'})}
const origin=process.env.SICA_TEST_ORIGIN||'http://127.0.0.1:5174'
let token,csrf
async function invoke(path,input,{privateSetup=false,authorize=true,origin:requestOrigin=origin,csrf:withCsrf=true}={}){
 return fetch(base+path+'?forceFunctionRegion='+encodeURIComponent(process.env.VITE_SICA_EDGE_REGION||'us-west-2'),{method:input===undefined?'GET':'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SICA-Client':'web',...(privateSetup?{'X-SICA-Setup-Key':process.env.SUPABASE_SECRET_KEY}:{}),...(authorize&&token?{Authorization:'Bearer '+token}:{}),...(withCsrf&&csrf?{'X-SICA-CSRF':csrf}:{})},...(input===undefined?{}:{body:JSON.stringify(input)}),signal:AbortSignal.timeout(45000)})
}
const checks=[]
async function check(name,callback){await callback();checks.push(name);console.log('OK '+name)}
await check('Configuración inicial privada',async()=>{
 const response=await invoke('/setup',{adminPassword:credentials.password,origins:['http://127.0.0.1:5174','http://localhost:5174','http://127.0.0.1:4173','http://localhost:4173']},{privateSetup:true})
 assert.ok([200,409].includes(response.status),'Setup HTTP '+response.status+': '+await response.text())
})
await check('PostgreSQL remoto saludable',async()=>{const response=await invoke('/api/health');assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).storage,'postgres')})
await check('Acceso anónimo bloqueado',async()=>assert.equal((await invoke('/api/state',undefined,{authorize:false})).status,401))
await check('Origen externo bloqueado',async()=>assert.equal((await invoke('/api/health',undefined,{origin:'https://unauthorized.invalid'})).status,403))
await check('Inicio de sesión real',async()=>{
 const response=await invoke('/api/login',{username:credentials.username,password:credentials.password});assert.equal(response.status,200,await response.clone().text())
 const body=await response.json();({token,csrf}=body);assert.match(token,/^[a-f0-9]{64}$/);assert.ok(csrf);assert.equal(body.company.id,'sica')
})
let revision
try{
 await check('Sesión y lectura persistente',async()=>{const response=await invoke('/api/state');assert.equal(response.status,200);revision=(await response.json()).revision})
 await check('CSRF obligatorio',async()=>assert.equal((await invoke('/api/commands',{},{csrf:false})).status,403))
 await check('Escritura, idempotencia y revisión',async()=>{
  const request={revision,requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id:'supabase-deployment-check',name:'Conexión con Supabase verificada',text:'Verificación técnica del despliegue Edge y PostgreSQL.'}}}
  const first=await invoke('/api/commands',request);assert.equal(first.status,200,await first.clone().text());const changed=await first.json();assert.equal(changed.revision,revision+1)
  const repeated=await invoke('/api/commands',request);assert.equal(repeated.status,200);assert.equal((await repeated.json()).revision,changed.revision)
  const conflict=await invoke('/api/commands',{...request,requestId:crypto.randomUUID()});assert.equal(conflict.status,409)
  revision=changed.revision
 })
 await check('Respaldo completo en Storage privado',async()=>{
  const response=await invoke('/api/server-backup',{});assert.equal(response.status,200,await response.clone().text());const result=await response.json();assert.equal(result.bucket,'sica-private');assert.ok(result.path.endsWith('.sica-pg.json'))
  await mkdir('var/supabase-verification-backup',{recursive:true,mode:0o700})
  const filename='var/supabase-verification-backup/'+result.path.split('/').at(-1)
  for(const suffix of ['', '.audit-key']){const stored=await fetch(process.env.SUPABASE_URL+'/storage/v1/object/sica-private/'+result.path+suffix,{headers:{apikey:process.env.SUPABASE_SECRET_KEY},signal:AbortSignal.timeout(30000)});assert.equal(stored.status,200);await writeFile(filename+suffix,new Uint8Array(await stored.arrayBuffer()),{mode:0o600})}
  const {report}=await readPostgresBackup({filename,expectedCompanyId:'sica'});assert.equal(report.revision,revision)
 })
 await check('Cierre y revocación de sesión',async()=>{assert.equal((await invoke('/api/logout',{})).status,200);assert.equal((await invoke('/api/state')).status,401);token=undefined})
}finally{if(token)await invoke('/api/logout',{}).catch(()=>{})}
await writeFile('output/supabase-live-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),project:'dudraffygijvufwhqvza',api:base,checks,revision,credentialsFile:credentialFile},null,2)+'\n')
console.log('Verificación remota completa. Credenciales privadas: '+credentialFile)
