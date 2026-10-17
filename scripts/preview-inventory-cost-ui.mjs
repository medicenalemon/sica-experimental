import {createApplication} from '../server/http.mjs'
import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
const port=3006,app=await createApplication({filename:'var/qa-inventory-cost.sqlite',adminPassword:'Sica-Cost-UI-QA-2026',origins:[`http://127.0.0.1:${port}`]})
// Datos sintéticos. Se conserva la base al reiniciar; no se inicializa una base con operaciones.
if(app.repository.read().revision===0){
 const auth=await app.repository.login('admin','Sica-Cost-UI-QA-2026',false,'fixture'),state=initialState();loadTextileDemo(state);state.settings.name='SICA QA - COSTOS SINTÉTICOS';state.stockMoves.forEach(m=>m.date='2026-10-01')
 const product=state.products.find(p=>p.sku==='REM-M-NEG'),supplier=state.parties.find(p=>p.side==='proveedor'),customer=state.parties.find(p=>p.side==='cliente')
 const input={kind:'remito',side:'proveedor',letter:'A',date:'2026-10-02',due:'2026-10-02',branchId:'central',partyId:supplier.id,lines:[{productId:product.id,description:product.name,quantity:10,unit:product.unit,price:2000,tax:'21',discount:0}],payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Compra sintética para valuación',responsible:'Administrador',costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const receipt=createDocument(state,input,'Administrador General');createDocument(state,{...input,kind:'factura',sourceId:receipt.id},'Administrador General')
 createDocument(state,{...input,side:'cliente',partyId:customer.id,date:'2026-10-03',due:'2026-10-03',lines:input.lines.map(l=>({...l,quantity:5,price:10000})),observations:'Entrega sintética para costo de ventas'},'Administrador General')
 await app.repository.mutate(auth.token,{revision:0,requestId:crypto.randomUUID(),command:{state}},true)
}
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));console.log(`Costos sintéticos: http://127.0.0.1:${port}/contabilidad/inventario`)
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await new Promise(resolve=>app.server.close(resolve));await app.repository.close();process.exit(0)})
