import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
import {prepareRevenueAccount,previewRevenueAccrual,revenueReview} from '../.server/domain/revenue-accruals.js'
import {prepareInventoryAccounts,inventoryAccountDefaults,inventoryOpeningBalances,previewInventoryCost,inventoryCostReview,postInventoryCost} from '../.server/domain/inventory-costing.js'
export function revenueAccrualFixture(actor){
 const state=initialState();loadTextileDemo(state);state.settings.exerciseStart='2026-01-01';state.settings.exerciseEnd='2026-12-31';state.settings.name='SICA QA - INGRESOS DEVENGADOS'
 prepareRevenueAccount(state,actor);prepareInventoryAccounts(state,actor)
 state.masters.accounts.push({id:'4.2',code:'4.2',name:'Ventas de entregas aceptadas',group:'Ingresos',postable:true})
 const product=state.products.find(p=>p.sku==='REM-M-NEG'),client=state.parties.find(p=>p.side==='cliente'),accounts=inventoryAccountDefaults(state)
 state.stockMoves=[{id:'revenue-opening-stock',date:'2026-10-01',productId:product.id,depositId:'principal',quantity:10,reason:'Apertura sintética de ingresos',documentId:'',branchId:'central'}]
 const post=input=>postInventoryCost(state,{...input,review:inventoryCostReview(previewInventoryCost(state,input,state.inventoryCostBatches?.at(-1)))},actor)
 post({date:'2026-10-01',reference:'Apertura CPP sintética',accounts,opening:inventoryOpeningBalances(state,'2026-10-01').map(b=>({...b,value:b.quantity*1000}))})
 const document={kind:'remito',side:'cliente',letter:'X',date:'2026-10-03',due:'2026-10-03',branchId:'central',partyId:client.id,lines:[{productId:product.id,description:product.name,quantity:5,unit:product.unit,price:2000,tax:'21',discount:0}],payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Entrega textil sintética aceptada',responsible:actor.name,costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const receipt=createDocument(state,document,actor.role)
 post({date:'2026-10-03',reference:'Costo de entrega sintética',accounts})
 const accrual={date:receipt.date,sourceId:receipt.id,reference:'Entrega aceptada según contrato sintético',reason:'Bienes entregados y aceptados, precio fijo acordado y control transferido al cliente.',fiscalReason:'Operación sintética gravada al 21%; entrega y nacimiento de IVA en la fecha del remito, sin anticipos.',assetId:'1.1.12',vatAccountId:'2.1.2',lines:[{productId:product.id,value:10000,accountId:'4.2',tax:'21',recognition:'Entrega aceptada',evidence:'Acta sintética de recepción aceptada QA-003; contrato de precio fijo por cinco unidades.'}]}
 const reviewed=()=>({...accrual,review:revenueReview(previewRevenueAccrual(state,accrual))})
 const invoice=(date='2026-10-05',price=2200,letter='A')=>createDocument(state,{...document,kind:'factura',letter,date,due:date,sourceId:receipt.id,lines:document.lines.map(l=>({...l,price}))},actor.role)
 return {state,receipt,accrual,reviewed,invoice,product,client,accounts,post}
}
