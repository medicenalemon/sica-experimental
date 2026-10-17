import {reexpressionFixture} from './reexpression-fixture.mjs'
export function inflationPostingFixture(initialState,statements,model,postingModel,{prepareAccounts=true}={}){
 const {state,actor,input}=reexpressionFixture(initialState,statements,model);state.settings.exerciseEnd='2026-10-11'
 input.review=model.reexpressionReview(model.previewReexpression(state,input));const record=model.preserveReexpression(state,input,actor)
 if(prepareAccounts)postingModel.prepareReexpressionPostingAccounts(state,actor)
 const posting=postingModel.reexpressionPostingDefaults(state,record.id);Object.assign(posting,{reference:'Ajuste anual QA 2026',reason:'Contabilización sintética revisada con mediciones, RECPAM, redondeo y continuidad; sin operaciones reales.',confirmed:true,syntheticConfirmed:true})
 posting.allocations=postingModel.reexpressionPostingTargets(state,record.id).map(t=>({targetId:t.id,parts:t.delta?[{branchId:'central',amount:t.delta,reason:'Reparto sintético revisado para la sucursal de origen.'}]:[]}))
 return {state,actor,record,posting}
}
