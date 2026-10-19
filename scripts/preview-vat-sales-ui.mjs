import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {buildFiscalRequest,numberedRequest} from '../.server/domain/fiscal.js'
import {vatSalesFixture} from './vat-sales-fixture.mjs'
import {simulatedFiscalClient} from './fiscal-production-fixture.mjs'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.50',port=3055,password='Sica-VAT-Sales-QA-2026';let repository
const instance=await createApplication({filename:'var/qa-vat-sales.sqlite',adminPassword:password,origins:[`http://${host}:${port}`],arca:{mode:'produccion',cuit:'30712345671'},arcaClient:simulatedFiscalClient({repository:()=>repository})});repository=instance.repository
if(repository.read().revision===0){const f=vatSalesFixture({initialState,loadTextileDemo,createDocument,buildFiscalRequest,numberedRequest}),auth=await repository.login('admin',password,false,'fixture');await repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:f.state}},true);for(const a of f.authorizations){const options={saleTerms:a.request.snapshot.saleTerms,...(a.request.snapshot.nationalIndirect?{nationalIndirect:a.request.snapshot.nationalIndirect}:{})},p=repository.fiscal.preview(auth.token,a.documentId,options);await repository.fiscal.operate(auth.token,{documentId:a.documentId,revision:p.reviewRevision,reviewRevision:p.reviewRevision,environment:'produccion',options})}repository.logout(auth.token);await writeFile('output/qa/vat-sales-before.json',JSON.stringify(repository.read(),null,2)+'\n');await writeFile('output/qa/vat-sales-fiscal-preserved.json',JSON.stringify(repository.db.prepare('SELECT * FROM fiscal_jobs ORDER BY document_id').all(),null,2)+'\n')}
await new Promise(resolve=>instance.server.listen(port,host,resolve));console.log(`IVA ventas, ensayo local: http://${host}:${port}/finanzas/impuestos`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>instance.server.close(resolve));await instance.close();process.exit(0)})
