import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
if(Number(process.versions.node.split('.')[0])<24)throw new Error('Las pruebas completas requieren Node.js 24 o superior.')
const directory=resolve('output/qa/relational'),guard=resolve('scripts/test-offline-guard.mjs')
await mkdir(directory,{recursive:true,mode:0o700})
const startedAt=new Date().toISOString(),results=[]
async function run(name,script,testing=true,nodeHarness=true){
 console.log(`Ejecutando ${name}…`)
 const child=spawn(process.execPath,[...(testing&&nodeHarness?['--import',guard,'--test','--test-reporter=tap']:[]),script],{env:{...process.env,SICA_ARCA_MODE:'disabled'},stdio:['ignore','pipe','pipe']})
 let output=''
 for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk.toString()})
 const status=await new Promise((done,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>done({code,signal}))})
 const log=resolve(directory,`${name}.log`);await writeFile(log,output,{mode:0o600})
 const metric=name=>Number(output.match(new RegExp(`^# ${name} (\\d+)$`,'m'))?.[1]??NaN)
 const result={name,log,exitCode:status.code,signal:status.signal,...(testing?{tests:metric('tests'),passed:metric('pass'),failed:metric('fail'),skipped:metric('skipped'),cancelled:metric('cancelled'),todo:metric('todo')}:{} )}
 result.ok=status.code===0&&(!testing||Number.isInteger(result.tests)&&result.tests>0&&result.tests===result.passed&&[result.failed,result.skipped,result.cancelled,result.todo].every(n=>n===0))
 results.push(result);console.log(`${name}: ${result.ok?'OK':'FALLÓ'}${testing?` (${result.passed}/${result.tests})`:''} — ${log}`)
 return result.ok
}
if(await run('build-server','scripts/build-server.mjs',false)){
 for(const [name,script] of [['domain','scripts/test-domain.mjs'],['files','scripts/test-files.mjs'],['fiscal','scripts/test-fiscal.mjs'],['http','scripts/test-server.mjs'],['recovery','scripts/test-recovery.mjs'],['database','scripts/test-database.mjs']])await run(name,script)
 await run('postgres','scripts/postgres-test-cluster.mjs',true,false)
 await run('cloud','scripts/test-cloud.mjs')
}
const report={startedAt,finishedAt:new Date().toISOString(),node:process.version,arca:'Simulada; fetch y http/https restringidos a loopback',ok:results.length===9&&results.every(r=>r.ok),total:results.reduce((n,r)=>n+(r.tests||0),0),passed:results.reduce((n,r)=>n+(r.passed||0),0),results}
await writeFile(resolve(directory,'tests.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600})
console.log(JSON.stringify({ok:report.ok,tests:report.total,passed:report.passed,report:resolve(directory,'tests.json')}))
if(!report.ok)process.exitCode=1
