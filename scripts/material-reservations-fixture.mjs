import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {saveMaster} from '../.server/domain/engine.js'
import {prepareProduction} from '../.server/domain/production-workflow.js'
import {today} from '../.server/domain/constants.js'
export function materialReservationsFixture(){
 const state=initialState(),actor={userId:'admin',name:'Administrador',role:'Administrador General',permissions:[]},date=today()
 loadTextileDemo(state);state.settings.name='SICA Textil · Reserva de materiales de ensayo'
 const raw=state.products.find(p=>p.sku==='REM-M-NEG'),finished=state.products.find(p=>p.sku==='PANT-42-AZ')
 saveMaster(state,'workCenters',{id:'reserved-center',name:'Taller de ensayo',branchId:'central',hours:8,capacity:1,workDays:'1,2,3,4,5,6,7'},actor.role)
 saveMaster(state,'routes',{id:'reserved-route',name:'Fabricación de ensayo',steps:'Fabricar',workCenterId:'reserved-center',hours:2},actor.role)
 const order={id:'reserved-order',name:'Lote de ensayo con tres insumos',branchId:'central',productId:finished.id,quantity:2,start:date,end:date,workCenterId:'reserved-center',routeId:'reserved-route',status:'Planificada',cost:0,actualCost:0}
 saveMaster(state,'production',order,actor.role)
 saveMaster(state,'materials',{id:'reserved-material',name:'Insumo de ensayo',orderId:order.id,productId:raw.id,depositId:'principal',quantity:3,unit:raw.unit},actor.role)
 const plan=prepareProduction(state,order.id,actor)
 return {state,actor,date,order,raw,finished,plan,input:{orderId:order.id,date,reason:'Apartar todos los insumos del lote completo de ensayo.'}}
}
