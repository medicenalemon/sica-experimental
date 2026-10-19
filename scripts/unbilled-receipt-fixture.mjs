import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {prepareInventoryAccounts,inventoryAccountDefaults,inventoryOpeningBalances,previewInventoryCost,inventoryCostReview,postInventoryCost} from '../.server/domain/inventory-costing.js'

// Operaciones sintéticas; los precios no representan valores comerciales reales.
export function unbilledReceiptFixture(actor,{openingReceipt=false,invoice=false,extraReceipt=false}={}){
 const state=initialState();loadTextileDemo(state);state.settings.name='SICA QA - RECEPCIONES SIN FACTURA';state.stockMoves.forEach(m=>m.date='2026-10-01');prepareInventoryAccounts(state,actor)
 const product=state.products.find(p=>p.sku==='REM-M-NEG'),supplier=state.parties.find(p=>p.side==='proveedor'),customer=state.parties.find(p=>p.side==='cliente'),accounts=inventoryAccountDefaults(state)
 const document={kind:'remito',side:'proveedor',letter:'A',date:openingReceipt?'2026-10-01':'2026-10-02',due:openingReceipt?'2026-10-01':'2026-10-02',branchId:'central',partyId:supplier.id,lines:[{productId:product.id,description:product.name,quantity:10,unit:product.unit,price:99999,tax:'21',discount:0}],payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Recepción sintética pendiente de factura',responsible:actor.name,costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const post=input=>postInventoryCost(state,{...input,review:inventoryCostReview(previewInventoryCost(state,input,state.inventoryCostBatches?.at(-1)))},actor)
 let receipt
 if(openingReceipt){receipt=createDocument(state,document,'Administrador General');createDocument(state,{...document,side:'cliente',partyId:customer.id,lines:document.lines.map(l=>({...l,quantity:20,price:10000}))},'Administrador General')}
 const estimate=r=>({receiptId:r.id,reference:'Orden de compra sintética: diez unidades a ARS 20 netos',lines:[{productId:product.id,value:20000}]})
 post({date:'2026-10-01',reference:'Apertura sintética revisada',accounts,opening:inventoryOpeningBalances(state,'2026-10-01').map(b=>({...b,value:Math.round(b.quantity*(openingReceipt&&b.productId===product.id?1200:1000))})),...(openingReceipt?{receiptCosts:[estimate(receipt)]}:{})})
 receipt ||= createDocument(state,document,'Administrador General')
 const delivery=createDocument(state,{...document,side:'cliente',partyId:customer.id,date:'2026-10-03',due:'2026-10-03',lines:document.lines.map(l=>({...l,quantity:5,price:10000}))},'Administrador General')
 post({date:'2026-10-03',reference:'Recepción estimada y venta sintéticas',accounts,...(openingReceipt?{}:{receiptCosts:[estimate(receipt)]})})
 const makeInvoice=()=>createDocument(state,{...document,kind:'factura',sourceId:receipt.id,lines:document.lines.map(l=>({...l,price:2200})),allocations:[],observations:'Factura sintética registrada después del corte'},'Administrador General')
 const bill=invoice?makeInvoice():undefined
 const pending=extraReceipt?createDocument(state,{...document,date:'2026-10-08',due:'2026-10-08',observations:'Segunda recepción sintética sin factura'},'Administrador General'):undefined
 return {state,accounts,product,receipt,delivery,invoice:bill,pending,estimate,makeInvoice}
}
