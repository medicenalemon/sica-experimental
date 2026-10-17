import {productionConversionFixture,reviewedProductionConversion} from './production-conversion-fixture.mjs'
import {createDocument} from '../.server/domain/engine.js'
import {prepareServiceAccounts,accrueService,previewServiceAccrual,serviceReview} from '../.server/domain/service-accruals.js'
import {postProductionCost} from '../.server/domain/production-costs.js'
import {previewProductionReestimate,productionCorrectionReview} from '../.server/domain/production-cost-corrections.js'
export function productionCorrectionFixture(){
 const f=productionConversionFixture({finished:false}),{state,actor}=f
 state.settings.name='SICA QA - REESTIMACION VINCULADA'
 state.entries=state.entries.filter(e=>e.id!==f.sources[1].id)
 prepareServiceAccounts(state,actor)
 const service={...state.products.find(p=>p.kind==='Servicio'),id:'pc-fixed-service',sku:'PC-FIJO',name:'Servicio fijo de fabricación',kind:'Servicio',parent:''};state.products.push(service)
 const supplier=state.parties.find(p=>p.side==='proveedor'),receipt=createDocument(state,{kind:'remito',side:'proveedor',letter:'X',date:'2026-10-02',due:'2026-10-02',branchId:'central',partyId:supplier.id,lines:[{productId:service.id,description:service.name,quantity:1,unit:service.unit,price:6000,tax:'21',discount:0}],payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Recepción sintética del servicio fijo',responsible:actor.name,costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'},actor.role),input={date:'2026-10-02',sourceId:receipt.id,reference:'Servicio fijo estimado QA',reason:'Estimación contractual sintética anterior a nueva información.',liabilityId:'2.1.7',lines:[{productId:service.id,value:6000,accountId:'pc-fixed'}]},accrual=accrueService(state,{...input,review:serviceReview(previewServiceAccrual(state,input))},actor)
 f.input={...f.input,date:'2026-10-03',to:'2026-10-03',pools:f.input.pools.map((p,i)=>i===1?{...p,sources:[{entryId:accrual.entryId,lineIndex:0,value:6000}]}:p)}
 const cost=postProductionCost(state,reviewedProductionConversion(f),actor)
 const correction={service:{date:'2026-10-12',accrualId:accrual.id,reference:'Nueva cotización del servicio fijo QA',reason:'Nueva información recibida: el servicio cuesta $30, conservando alcance y cantidades.',lines:[{productId:service.id,value:3000}]},reason:'Se mantiene la parte asignada y el reparto original: actividad real 3 horas frente a 10 horas normales; las órdenes siguen en proceso.',allocationConfirmed:true}
 return {...f,service,accrual,cost,correction}
}
export function reviewedProductionCorrection(f,input=f.correction){return {...input,review:productionCorrectionReview(previewProductionReestimate(f.state,input))}}
