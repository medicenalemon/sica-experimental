import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {saveMaster} from '../.server/domain/engine.js'
import {today} from '../.server/domain/constants.js'
export function productionShiftsFixture(){
 const state=initialState(),actor={userId:'admin',name:'Administrador',role:'Administrador General',permissions:[]},date=today()
 loadTextileDemo(state);state.settings.name='SICA Textil · Turnos de producción de ensayo'
 const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1)
 const raw=state.products.find(p=>p.sku==='REM-M-NEG'),finished=state.products.find(p=>p.sku==='PANT-42-AZ')
 const center={id:'shifts-center',name:'Taller con jornada dividida',branchId:'central',startTime:'08:00',hours:8,capacity:1,workDays:'1,2,3,4,5,6,7'}
 saveMaster(state,'workCenters',center,actor.role)
 saveMaster(state,'routes',{id:'shifts-route',name:'Fabricación de seis horas',steps:'Fabricar',workCenterId:center.id,hours:6},actor.role)
 const order={id:'shifts-order',name:'Lote textil de seis horas',branchId:'central',productId:finished.id,quantity:2,start:date,end:next.toISOString().slice(0,10),workCenterId:center.id,routeId:'shifts-route',status:'Planificada',cost:0,actualCost:0}
 saveMaster(state,'production',order,actor.role)
 saveMaster(state,'materials',{id:'shifts-material',name:'Insumo del lote',orderId:order.id,productId:raw.id,depositId:'principal',quantity:3,unit:raw.unit},actor.role)
 return {state,actor,date,order,center,raw,finished}
}
