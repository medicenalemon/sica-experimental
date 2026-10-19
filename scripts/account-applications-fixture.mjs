import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
export function accountApplicationsFixture({original=false}={}){
 const state=initialState();loadTextileDemo(state);state.settings.name=original?'SICA Textil · Aplicaciones originales de ensayo':'SICA Textil · Aplicaciones de ensayo'
 const customer=state.parties.find(p=>p.side==='cliente');customer.commission=0
 const product=state.products.find(p=>p.sku==='REM-M-NEG'),base={side:'cliente',partyId:customer.id,branchId:'central',date:'2026-10-01',due:'2026-10-05',letter:'A',sourceId:'',depositId:'principal',perceptions:0,observations:'Ensayo sintético de aplicación posterior',responsible:'Administrador',costCenter:'',official:false,valued:false,seller:'',priceList:'',lines:[],payments:[],allocations:[]}
 const invoice=createDocument(state,{...base,kind:'factura',lines:[{productId:product.id,description:product.name,quantity:2,unit:product.unit,price:50000,tax:'21',discount:0}]},'Administrador General')
 const credit=createDocument(state,{...base,kind:'cobro',letter:'X',date:'2026-10-02',due:'2026-10-02',payments:[{method:'Efectivo',amount:30000,treasuryId:'caja-principal',reference:'ANTICIPO-ENSAYO'}],allocations:original?[{documentId:invoice.id,amount:20000}]:[]},'Administrador General')
 const input={date:'2026-10-14',creditId:credit.id,reference:original?'LIB-ENSAYO-01':'AP-ENSAYO-01',reason:'Asignación acordada del anticipo a la factura pendiente.',lines:[{documentId:invoice.id,amount:original?15000:20000}]}
 return {state,customer,invoice,credit,input}
}
