import {createApplication} from '../server/http.mjs'
import {FiscalService} from '../server/fiscal-service.mjs'
import {writeFile,readFile} from 'node:fs/promises'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {today} from '../.server/domain/constants.js'
import {fiscalProductionFixture,simulatedFiscalClient} from './fiscal-production-fixture.mjs'
const host='127.0.0.49',port=3054,password='Sica-Fiscal-Production-QA-2026',filename='var/qa-fiscal-production.sqlite';let repository
const events=JSON.parse(await readFile('output/qa/fiscal-production-network.json','utf8').catch(()=>'[]')),trace=async event=>{events.push({...event,simulated:true});await writeFile('output/qa/fiscal-production-network.json',JSON.stringify(events,null,2)+'\n')},client=simulatedFiscalClient({repository:()=>repository,timeoutFirst:true,trace}),app=await createApplication({filename,adminPassword:password,origins:[`http://${host}:${port}`],arca:{mode:'produccion',cuit:'30712345671'},arcaClient:client});repository=app.repository
if(repository.read().revision===0){const f=fiscalProductionFixture({initialState,loadTextileDemo,createDocument,today}),auth=await repository.login('admin',password,false,'fixture'),active=repository.fiscal;await repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);const hom=new FiscalService(repository,{mode:'homologacion',cuit:'30712345671'},{client:simulatedFiscalClient({repository:()=>repository,environment:'homologacion',trace})}),request=hom.preview(auth.token,f.invoice.id,f.options);await hom.operate(auth.token,{documentId:f.invoice.id,revision:request.reviewRevision,reviewRevision:request.reviewRevision,options:f.options,action:'autorizar',environment:'homologacion'});repository.fiscal=active;repository.logout(auth.token);await writeFile('output/qa/fiscal-production-before.json',JSON.stringify(repository.read().state,null,2)+'\n');await writeFile('output/qa/fiscal-production-homologation-preserved.json',JSON.stringify(repository.db.prepare("SELECT * FROM fiscal_jobs WHERE environment='homologacion'").get(),null,2)+'\n')}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Producción simulada: http://${host}:${port}/clientes/ventas`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.close();process.exit(0)})
