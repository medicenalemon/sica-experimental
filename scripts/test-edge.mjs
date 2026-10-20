import assert from 'node:assert/strict'
import {test} from 'node:test'
import pg from 'pg'
import {createHmac} from 'node:crypto'
import {startTestPostgres} from './postgres-test-cluster.mjs'
import {postgresBootstrapSql} from '../server/postgres-schema.mjs'
import {createEdgeHandler} from '../server/edge-handler.mjs'
import {createApplication} from '../server/http.mjs'
import {edgeStorage} from '../server/edge-storage.mjs'
import {validateCompanyBundle} from '../server/postgres-backup.mjs'

test('Storage handles Supabase missing-object and duplicate-object responses without replacing audit keys',async()=>{
 const objects=new Map(),storage=edgeStorage({url:'https://test.invalid',key:'sb_secret_test',fetch:async(url,options)=>{
  assert.equal(options.headers.apikey,'sb_secret_test');const path=new URL(url).pathname
  if(options.method==='POST'){if(objects.has(path))return Response.json({statusCode:'409',error:'Duplicate'},{status:400});objects.set(path,options.body);return Response.json({})}
  return objects.has(path)?new Response(objects.get(path)):Response.json({statusCode:'404',error:'not_found'},{status:400})
 }})
 assert.equal(await storage.get('missing'),null)
 await assert.rejects(storage.auditKey({companyId:'existing',existing:true}),/original/)
 const key=await storage.auditKey({companyId:'sica',existing:false})
 assert.equal(key.length,32);assert.deepEqual(await storage.auditKey({companyId:'sica',existing:true}),key)
 assert.equal(await storage.put('keys/sica.audit-key','replacement'),false)
})

test('Fetch runtime preserves SICA authentication, transactions, recovery and sealed cloud backups',async t=>{
 const cluster=await startTestPostgres({tls:true}),objects=new Map(),applications=[]
 const {readFile}=await import('node:fs/promises'),ca=await readFile(cluster.caFile,'utf8')
 const pool=new pg.Pool({connectionString:cluster.databaseUrl})
 try{
  await pool.query('BEGIN;'+postgresBootstrapSql()+'COMMIT;')
  const storage=edgeStorage({url:'https://test.invalid',key:'sb_secret_test',fetch:async(input,options)=>{
   const path=decodeURIComponent(new URL(input).pathname.split('/sica-private/')[1])
   if(options.method==='POST'){if(objects.has(path))return Response.json({statusCode:'409'},{status:400});objects.set(path,typeof options.body==='string'?new TextEncoder().encode(options.body):new Uint8Array(options.body));return Response.json({})}
   return objects.has(path)?new Response(objects.get(path)):Response.json({statusCode:'404'},{status:400})
  }})
  const settings={databaseUrl:cluster.tlsDatabaseUrl,url:'https://test.invalid',sslCa:ca,secretKeys:['private-test-key'],storage,async createApp(options){const app=await createApplication(options);applications.push(app);return app}}
  let handler=createEdgeHandler(settings),token,csrf,revision
  const invoke=(path,{method='GET',body,origin='https://sica.example.com',authorize=true,withCsrf=true,...extra}={})=>handler(new Request('https://edge.example.com/functions/v1/sica-api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json','X-SICA-Client':'web',...(authorize&&token?{Authorization:'Bearer '+token}:{}),...(withCsrf&&csrf?{'X-SICA-CSRF':csrf}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}))
  await t.test('Setup requires the server secret and is single-use',async()=>{
   assert.equal((await invoke('/setup',{method:'POST',body:{}})).status,401)
   const response=await invoke('/setup',{method:'POST',body:{adminPassword:'Edge-Only-Test-Password',origins:['https://sica.example.com']},'X-SICA-Setup-Key':'private-test-key'})
   assert.equal(response.status,200,await response.text())
   assert.equal((await invoke('/setup',{method:'POST',body:{},'X-SICA-Setup-Key':'private-test-key'})).status,409)
  })
  await t.test('CORS accepts only configured origins and protects private routes',async()=>{
   assert.equal((await invoke('/api/health',{method:'OPTIONS'})).status,204)
   assert.equal((await invoke('/api/health',{origin:'https://foreign.example'})).status,403)
   assert.equal((await invoke('/api/state')).status,401)
   assert.equal((await invoke('/api/login',{method:'POST',body:{username:'admin',password:'incorrect'}})).status,401)
  })
  await t.test('Login uses opaque tokens and a cold isolate reads the same private key',async()=>{
   const response=await invoke('/api/login',{method:'POST',body:{username:'admin',password:'Edge-Only-Test-Password'}})
   assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null)
   const snapshot=await response.json();({token,csrf,revision}=snapshot);assert.match(token,/^[a-f0-9]{64}$/)
   handler=createEdgeHandler(settings)
   const state=await invoke('/api/state');assert.equal(state.status,200);assert.equal((await state.json()).revision,revision)
   assert.equal(state.headers.get('Access-Control-Allow-Origin'),'https://sica.example.com')
  })
  await t.test('CSRF, idempotency and stale revision checks survive the Fetch transport',async()=>{
   const body={revision,requestId:crypto.randomUUID(),command:{type:'master.save',key:'notes',item:{id:'edge-note',name:'Edge persisted',text:'Test'}}}
   assert.equal((await invoke('/api/commands',{method:'POST',body,withCsrf:false})).status,403)
   const response=await invoke('/api/commands',{method:'POST',body});assert.equal(response.status,200,await response.clone().text());revision=(await response.json()).revision
   assert.ok([...objects.keys()].some(path=>path.includes('/daily/')))
   const backupCount=[...objects.keys()].filter(path=>path.endsWith('.sica-pg.json')).length
   const repeated=await invoke('/api/commands',{method:'POST',body});assert.equal(repeated.status,200);assert.equal((await repeated.json()).revision,revision)
   assert.equal([...objects.keys()].filter(path=>path.endsWith('.sica-pg.json')).length,backupCount)
   assert.equal((await invoke('/api/commands',{method:'POST',body:{...body,requestId:crypto.randomUUID()}})).status,409)
   assert.equal((await invoke('/api/company/other/state')).status,404)
  })
  await t.test('Restore preserves the previous state, cloud backups verify and logout revokes the token',async()=>{
   const state=await (await invoke('/api/backup')).json()
   const restored=await invoke('/api/restore',{method:'POST',body:{revision,requestId:crypto.randomUUID(),command:{state}}});assert.equal(restored.status,200)
   assert.equal((await (await invoke('/api/recovery')).json()).length,1)
   const backup=await invoke('/api/server-backup',{method:'POST',body:{}});assert.equal(backup.status,200)
   const {path}=await backup.json(),envelope=JSON.parse(new TextDecoder().decode(objects.get(path))),key=objects.get(path+'.audit-key')
   validateCompanyBundle(JSON.parse(envelope.payload),key)
   assert.equal(envelope.signature,createHmac('sha256',key).update('sica-postgres-backup:v1\n'+envelope.payload).digest('hex'))
   assert.equal((await invoke('/api/logout',{method:'POST',body:{}})).status,200)
   assert.equal((await invoke('/api/state')).status,401)
  })
 }finally{for(const app of applications)await app.close().catch(()=>{});await pool.end();await cluster.stop()}
})
