import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {Repository} from '../server/repository.mjs'
import {FiscalService} from '../server/fiscal-service.mjs'
import {buildFiscalPdf} from '../.server/domain/fiscal-pdf.js'
const repository=await Repository.open({filename:'var/qa-fiscal-production.sqlite'})
try{
 const fiscal=new FiscalService(repository,{mode:'disabled'}),row=repository.db.prepare("SELECT * FROM fiscal_jobs WHERE company_id=? AND environment='produccion' AND type=1").get(repository.companyId)
 assert.equal(row.state,'aprobado');const request={...JSON.parse(row.request),environment:'produccion'},record=fiscal.record(row);assert.equal(record.simulated,true)
 const {doc,model}=await buildFiscalPdf(request,record),path='output/pdf/sica-produccion-simulada.pdf';await mkdir('output/pdf',{recursive:true});await writeFile(path,Buffer.from(doc.output('arraybuffer')))
 const proof={path,pages:doc.getNumberOfPages(),environment:'produccion',simulated:true,total:request.detail.ImpTotal,number:record.number,qrUrl:model.qrUrl,qrPayload:model.payload};await writeFile('output/qa/fiscal-production-pdf.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2))
}finally{await repository.close()}
