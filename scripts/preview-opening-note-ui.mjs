import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {prepareInventoryAccounts,inventoryAccountDefaults,inventoryOpeningBalances,previewInventoryCost,inventoryCostReview,postInventoryCost} from '../.server/domain/inventory-costing.js'
// Empresa sintética local; el reparto se ingresa y revisa en la interfaz.
const host='127.0.0.2',port=3007,app=await createApplication({filename:'var/qa-opening-note.sqlite',adminPassword:'Sica-Opening-UI-QA-2026',origins:[`http://${host}:${port}`]})
if(app.repository.read().revision===0){
 const auth=await app.repository.login('admin','Sica-Opening-UI-QA-2026',false,'fixture'),s=initialState();loadTextileDemo(s);s.settings.name='SICA QA - ASIGNACIÓN DE APERTURA';s.stockMoves.forEach(m=>m.date='2026-10-01');const actor=app.repository.auth(auth.token).actor;prepareInventoryAccounts(s,actor)
 const p=s.products.find(p=>p.sku==='REM-M-NEG'),supplier=s.parties.find(p=>p.side==='proveedor'),customer=s.parties.find(p=>p.side==='cliente'),doc={kind:'remito',side:'proveedor',letter:'A',date:'2026-10-01',due:'2026-10-01',branchId:'central',partyId:supplier.id,lines:[{productId:p.id,description:p.name,quantity:10,unit:p.unit,price:2000,tax:'21',discount:0}],payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Compra anterior a apertura, datos sintéticos',responsible:actor.name,costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const receipt=createDocument(s,doc,'Administrador General'),invoice=createDocument(s,{...doc,kind:'factura',sourceId:receipt.id},'Administrador General')
 // De 50 remeras se entregan 20 antes de la apertura; costo previo declarado: $12 por unidad.
 createDocument(s,{...doc,side:'cliente',partyId:customer.id,lines:doc.lines.map(l=>({...l,quantity:20,price:10000}))},'Administrador General')
 const accounts=inventoryAccountDefaults(s),post=input=>postInventoryCost(s,{...input,review:inventoryCostReview(previewInventoryCost(s,input,s.inventoryCostBatches?.at(-1)))},actor)
 post({date:'2026-10-01',reference:'Apertura sintética revisada',accounts,opening:inventoryOpeningBalances(s,'2026-10-01').map(b=>({productId:b.productId,depositId:b.depositId,quantity:b.quantity,value:Math.round(b.quantity*(b.productId===p.id?1200:1000))}))})
 createDocument(s,{...doc,side:'cliente',partyId:customer.id,date:'2026-10-02',due:'2026-10-02',lines:doc.lines.map(l=>({...l,quantity:5,price:10000}))},'Administrador General');post({date:'2026-10-02',reference:'Entrega posterior a apertura',accounts})
 createDocument(s,{...invoice,kind:'credito',sourceId:invoice.id,date:'2026-10-03',due:'2026-10-03',allocations:[],lines:invoice.lines.map(l=>({...l,quantity:1,price:2000})),observations:'Bonificación sintética de precio: $12 atribuibles a apertura y $8 a ventas anteriores; no modifica cantidades.'},'Administrador General')
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state:s}},true)
}
await new Promise(resolve=>app.server.listen(port,host,resolve));console.log(`Asignación sintética de apertura: http://${host}:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
