import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {Repository} from '../server/repository.mjs'
import {receiptPrintModel} from '../.server/domain/receipt-print.js'
import {buildReceiptPdf} from '../.server/domain/receipt-pdf.js'
import {createDocument} from '../.server/domain/engine.js'
const source=await Repository.open({filename:'var/qa-receipt-print.sqlite'})
const fonts={regular:new Uint8Array(await readFile('public/fonts/DejaVuSans.ttf')),bold:new Uint8Array(await readFile('public/fonts/DejaVuSans-Bold.ttf'))},output=[]
try{
 const s=source.read().state,receipt=s.documents.find(d=>d.kind==='cobro'),payment=s.documents.find(d=>d.kind==='pago')
 assert.ok(receipt?.receiptSnapshot&&payment?.receiptSnapshot)
 await mkdir('output/pdf',{recursive:true})
 const clone=structuredClone(s),long=createDocument(clone,{...structuredClone(receipt),payments:Array.from({length:22},(_,i)=>({method:'Efectivo',amount:100,treasuryId:'caja-principal',reference:`MEDIO-${String(i+1).padStart(2,'0')}-`+'referencia-'.repeat(16)})),allocations:[{documentId:receipt.allocations[0].documentId,amount:1500}],observations:'Detalle sintético Ñandú, José y Peña para comprobar la continuidad de las observaciones. '.repeat(85)+'FIN-OBSERVACIONES-COMPLETAS'},'Administrador General')
 for(const [state,document,name]of [[s,receipt,'recibo-cobro-interno-ensayo.pdf'],[s,payment,'orden-pago-interna-ensayo.pdf'],[clone,long,'constancia-extensa-ensayo.pdf']]){
  const model=receiptPrintModel(state,document.id),pdf=await buildReceiptPdf(model,fonts),bytes=Buffer.from(pdf.output('arraybuffer')),path='output/pdf/'+name
  await writeFile(path,bytes);output.push({path,pages:pdf.getNumberOfPages(),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,model})
 }
 assert.deepEqual(source.read().state,s)
 await writeFile('output/qa/receipt-print-pdfs.json',JSON.stringify({sourceUnchanged:true,synthetic:true,files:output},null,2)+'\n')
 console.log(JSON.stringify(output.map(({path,pages,bytes,sha256})=>({path,pages,bytes,sha256})),null,2))
}finally{await source.close()}
