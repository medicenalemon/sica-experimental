import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,saveProduct} from '../.server/domain/engine.js'
import {prepareServiceAccounts,previewServiceAccrual,serviceReview} from '../.server/domain/service-accruals.js'
export function serviceAccrualFixture(actor){
 const state=initialState();loadTextileDemo(state);state.stockMoves=[];state.settings.exerciseStart='2026-01-01';state.settings.exerciseEnd='2026-12-31';state.settings.name='SICA QA - SERVICIOS DEVENGADOS'
 prepareServiceAccounts(state,actor);state.masters.accounts.push({id:'5.8',code:'5.8',name:'Servicios de limpieza',group:'Gastos',postable:true})
 const base=state.products.find(p=>p.sku==='REM-M-NEG'),services=[{...base,id:'service-clean',sku:'SERV-LIMP',name:'Servicio de limpieza',kind:'Servicio',parent:'',unit:'Unidad'},{...base,id:'service-repair',sku:'SERV-REP',name:'Servicio de reparación',kind:'Servicio',parent:'',unit:'Unidad'}];services.forEach(p=>saveProduct(state,p))
 const supplier=state.parties.find(p=>p.side==='proveedor'),lines=services.map((p,i)=>({productId:p.id,description:p.name,quantity:i?1:2,unit:p.unit,price:i?2000:5000,tax:'21',discount:0}))
 const document={kind:'remito',side:'proveedor',letter:'X',date:'2026-10-01',due:'2026-10-01',branchId:'central',partyId:supplier.id,lines,payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Servicios recibidos para prueba sintética',responsible:actor.name,costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const receipt=createDocument(state,document,actor.role),accrual={date:'2026-10-03',sourceId:receipt.id,reference:'Estimación sintética según contrato',reason:'Servicios recibidos y consumidos; estimación respaldada por contrato de prueba, sin crédito fiscal.',liabilityId:'2.1.7',lines:services.map((p,i)=>({productId:p.id,value:i?5000:10000,accountId:i?'5.1':'5.8'}))}
 const reviewed=()=>({...accrual,review:serviceReview(previewServiceAccrual(state,accrual))})
 const invoice=(date='2026-10-05',prices=[6000,4000],letter='A')=>createDocument(state,{...document,kind:'factura',letter,date,due:date,sourceId:receipt.id,lines:lines.map((l,i)=>({...l,price:prices[i]}))},actor.role)
 return {state,receipt,accrual,reviewed,invoice,services,supplier}
}
