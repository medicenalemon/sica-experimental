import {yearEndFixture} from './year-end-fixture.mjs'
import {serviceAccrualFixture} from './service-accrual-fixture.mjs'
import {accrueService} from '../.server/domain/service-accruals.js'
import {closeYearEnd,previewYearEndClose,yearEndReview} from '../.server/domain/year-end-close.js'
export function exerciseOpeningFixture(actor){
 const state=yearEndFixture(actor),f=serviceAccrualFixture(actor)
 state.settings.name='SICA QA - APERTURA DE EJERCICIO'
 state.products=f.state.products;state.parties=f.state.parties;state.masters.accounts.push(...f.state.masters.accounts.filter(a=>!state.masters.accounts.some(x=>x.id===a.id)));state.documents=f.state.documents
 accrueService(state,f.reviewed(),actor)
 const input={reference:'Cierre sintético anterior a apertura 2027',reason:'Resultado nominal 400 ARS con servicios sin factura 150 ARS. Prueba sin presentación fiscal.',resultsAccountId:'3.2',acknowledged:[]},p=previewYearEndClose(state,input)
 closeYearEnd(state,{...input,acknowledged:p.before.warnings.map(w=>w.id),review:yearEndReview(p)},actor)
 return state
}
