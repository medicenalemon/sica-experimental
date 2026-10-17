import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
export function accountsAgingFixture(){
 const state=initialState();loadTextileDemo(state);state.settings.name='SICA Textil · Vencimientos de ensayo'
 const customer=state.parties.find(p=>p.side==='cliente'),supplier=state.parties.find(p=>p.side==='proveedor'),base={side:'cliente',partyId:customer.id,branchId:'central',date:'2026-01-01',due:'',kind:'saldo',letter:'X',sourceId:'',depositId:'principal',perceptions:0,observations:'Saldo sintético para probar vencimientos',responsible:'Administrador',costCenter:'',official:false,valued:false,seller:'',priceList:'',lines:[],payments:[],allocations:[]}
 const charges=[]
 for(const [total,due] of [[10000,'2026-10-14'],[20000,'2026-10-15'],[30000,'2026-09-30'],[40000,'2026-08-31'],[50000,'2026-07-31'],[60000,'2026-06-30'],[70000,'']])charges.push(createDocument(state,{...base,total,due},'Administrador General'))
 createDocument(state,{...base,kind:'cobro',date:'2026-10-01',due:'2026-10-01',payments:[{method:'Efectivo',amount:15000,treasuryId:'caja-principal',reference:'COBRO-PARCIAL-ENSAYO'}],allocations:[{documentId:charges[2].id,amount:10000}]},'Administrador General')
 createDocument(state,{...base,kind:'cobro',date:'2026-10-20',due:'2026-10-20',payments:[{method:'Efectivo',amount:20000,treasuryId:'caja-principal',reference:'COBRO-POSTERIOR-AL-CORTE'}],allocations:[{documentId:charges[2].id,amount:20000}]},'Administrador General')
 createDocument(state,{...base,side:'proveedor',partyId:supplier.id,total:80000,due:'2026-09-01'},'Administrador General')
 return {state,date:'2026-10-14',customer,supplier}
}
