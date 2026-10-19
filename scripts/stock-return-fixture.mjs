import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {prepareInventoryAccounts,inventoryAccountDefaults,inventoryOpeningBalances,previewInventoryCost,inventoryCostReview,postInventoryCost} from '../.server/domain/inventory-costing.js'
// Datos exclusivamente sintéticos para pruebas y revisión local.
export function stockReturnFixture(actor){
 const s=initialState();loadTextileDemo(s);s.settings.name='SICA QA - DEVOLUCIONES FÍSICAS';s.stockMoves.forEach(m=>m.date='2026-10-01');prepareInventoryAccounts(s,actor)
 const p=s.products.find(p=>p.sku==='REM-M-NEG'),supplier=s.parties.find(p=>p.side==='proveedor'),customer=s.parties.find(p=>p.side==='cliente'),accounts=inventoryAccountDefaults(s)
 const doc={kind:'remito',side:'proveedor',letter:'A',date:'2026-10-02',due:'2026-10-02',branchId:'central',partyId:supplier.id,lines:[{productId:p.id,description:p.name,quantity:10,unit:p.unit,price:2000,tax:'21',discount:0}],payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Compra sintética',responsible:actor.name,costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const post=input=>postInventoryCost(s,{...input,review:inventoryCostReview(previewInventoryCost(s,input,s.inventoryCostBatches?.at(-1)))},actor)
 post({date:'2026-10-01',reference:'Apertura sintética',accounts,opening:inventoryOpeningBalances(s,'2026-10-01').map(b=>({...b,value:Math.round(b.quantity*1000)}))})
 const purchaseReceipt=createDocument(s,doc,'Administrador General'),purchase=createDocument(s,{...doc,kind:'factura',sourceId:purchaseReceipt.id},'Administrador General')
 const customerDoc={...doc,side:'cliente',partyId:customer.id,date:'2026-10-03',due:'2026-10-03',lines:doc.lines.map(l=>({...l,quantity:5,price:10000})),observations:'Entrega sintética'}
 const delivery=createDocument(s,customerDoc,'Administrador General'),sale=createDocument(s,{...customerDoc,kind:'factura',sourceId:delivery.id},'Administrador General')
 post({date:'2026-10-03',reference:'Compra y venta previas a devoluciones',accounts})
 const customerCredit=createDocument(s,{...sale,kind:'credito',sourceId:sale.id,date:'2026-10-04',due:'2026-10-04',lines:sale.lines.map(l=>({...l,quantity:2})),observations:'Dos unidades devueltas; pendiente de registro físico'},'Administrador General')
 const supplierCredit=createDocument(s,{...purchase,kind:'credito',sourceId:purchase.id,date:'2026-10-05',due:'2026-10-05',lines:purchase.lines.map(l=>({...l,quantity:2})),observations:'Dos unidades enviadas al proveedor; pendiente de registro físico'},'Administrador General')
 return {state:s,accounts,product:p,delivery,purchaseReceipt,customerCredit,supplierCredit}
}
