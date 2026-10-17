import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {buildFiscalRequest,numberedRequest} from '../.server/domain/fiscal.js'
import {buildFiscalPdf} from '../.server/domain/fiscal-pdf.js'

// Sólo genera un ejemplo local. No consume WSAA/WSFE ni guarda solicitudes en una empresa.
const state=initialState();loadTextileDemo(state)
state.settings.name='SICA Textil - Ejemplo sintético'
state.settings.cuit='30712345671';state.settings.address='Domicilio de prueba, Tucumán'
state.settings.iibbRegistration='Inscripción sintética - sin valor registral';state.settings.activityStart='2020-01-01'
state.masters.branches.find(b=>b.id==='central').activityStart='2021-02-03'
const party=state.parties.find(p=>p.side==='cliente'),product=state.products[0],date='2026-10-08'
party.iva='Consumidor Final';party.name='Cliente de prueba - Datos sintéticos';party.address='Domicilio sintético del receptor'
for(let i=0;i<18;i++)state.products.push({...product,id:`pdf-product-${i}`,sku:`PDF-${i}`})
const document=createDocument(state,{kind:'factura',side:'cliente',letter:'B',date,due:date,branchId:'central',partyId:party.id,lines:Array.from({length:18},(_,i)=>({productId:`pdf-product-${i}`,description:`Prenda textil de prueba ${i+1}, talle y color de ejemplo`,quantity:2,unit:'Unidad',price:10000+i*100,tax:i%3===0?'10.5':'21',discount:i%4===0?5:0})),payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Datos sintéticos',responsible:'Administrador',costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'},'Administrador General')
const request=numberedRequest(buildFiscalRequest(state,document.id,{nationalIndirect:{amount:0,reference:'Ejemplo sintético sin otros impuestos nacionales indirectos'}}),42),record={environment:'homologacion',state:'aprobado',point:1,type:6,number:42,cae:'12345678901234',expires:'2026-10-18',messages:[],updated:new Date().toISOString()}
const {doc,model}=await buildFiscalPdf(request,record),directory=resolve('output/pdf');await mkdir(directory,{recursive:true})
const path=resolve(directory,'sica-comprobante-homologacion.pdf');await writeFile(path,Buffer.from(doc.output('arraybuffer')))
console.log(JSON.stringify({path,pages:doc.getNumberOfPages(),total:request.detail.ImpTotal,qrPayload:model.payload,synthetic:true}))
