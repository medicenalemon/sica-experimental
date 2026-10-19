import {createApplication} from '../server/http.mjs'
import {simulatedFiscalClient} from './fiscal-production-fixture.mjs'
import {prepareSalesLedgerExample} from './prepare-vat-sales-ledger-qa.mjs'
import {writeFile} from 'node:fs/promises'
const host='127.0.0.51',port=3056,password='Sica-VAT-Sales-Ledger-QA-2026';let repository
const instance=await createApplication({filename:'var/qa-vat-sales-ledger.sqlite',adminPassword:password,origins:[`http://${host}:${port}`],arca:{mode:'produccion',cuit:'30712345671'},arcaClient:simulatedFiscalClient({repository:()=>repository})});repository=instance.repository
if(repository.read().revision===0){const context=await prepareSalesLedgerExample(repository,password);await writeFile('output/qa/vat-sales-ledger-context.json',JSON.stringify(context,null,2)+'\n');await writeFile('output/qa/vat-sales-ledger-before.json',JSON.stringify(repository.read(),null,2)+'\n');await writeFile('output/qa/vat-sales-ledger-fiscal-preserved.json',JSON.stringify(repository.db.prepare('SELECT * FROM fiscal_jobs ORDER BY document_id').all(),null,2)+'\n')}
await new Promise(resolve=>instance.server.listen(port,host,resolve));console.log(`Conciliación IVA ventas, ensayo local: http://${host}:${port}/contabilidad/conciliacion-iva-ventas`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>instance.server.close(resolve));await instance.close();process.exit(0)})
