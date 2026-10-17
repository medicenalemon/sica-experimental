import type {State,FixedAsset} from './types'
import {accountingSum} from './trial-balance'
import {nextInventoryDate} from './inventory-dates'

export function assetInflationRows(state:State,assetId:string,to:string,inclusive=true){return (state.assetInflations||[]).filter(r=>inclusive?r.date<=to:r.date<to).flatMap(record=>record.preview.assets.filter(a=>a.assetId===assetId).map(row=>({record,row})))}
export function latestAssetInflation(state:State,assetId:string,to:string,inclusive=true){return assetInflationRows(state,assetId,to,inclusive).at(-1)}
export function assetBookCost(state:State,a:FixedAsset,to:string,inclusive=true){return assetInflationRows(state,a.id,to,inclusive).reduce((n,v)=>accountingSum(n,v.row.costDifference),a.preview.cost)}
export function assetPostedAccumulated(state:State,assetId:string,to:string,inclusive=true){return accountingSum((state.depreciationBatches||[]).filter(b=>b.date<=to).reduce((n,b)=>accountingSum(n,b.preview.rows.find(r=>r.assetId===assetId)?.charge||0),0),assetInflationRows(state,assetId,to,inclusive).reduce((n,v)=>accountingSum(n,v.row.accumulatedDifference),0))}
export function assetInflationReferences(state:State,assetId:string,to:string,inclusive=true){return assetInflationRows(state,assetId,to,inclusive).map(({record,row})=>({id:record.id,number:record.number,date:record.date,review:record.review!,postingId:record.postingId,cost:row.afterCost,accumulated:row.afterAccumulated,allowance:row.afterAllowance,residual:row.afterResidual,counterfactualAccumulated:row.afterCounterfactual}))}
export function assertAssetInflationReady(state:State,assetIds:string[],to:string){
 for(const p of state.reexpressionPostings||[]){if(p.preview.date>=to)continue;const affected=(state.fixedAssets||[]).filter(a=>assetIds.includes(a.id)&&a.date<=p.preview.date&&!state.assetDisposals?.some(d=>d.assetId===a.id&&d.date<=p.preview.date));if(affected.some(a=>!state.assetInflations?.some(r=>r.postingId===p.id&&r.preview.assets.some(row=>row.assetId===a.id))))throw new Error(`Conciliá primero el ajuste ${p.number} por bien de uso; sus importes todavía no están incorporados al subregistro.`)}
}
export function reconciledAssetPosting(state:State,postingId:string|undefined,assetId:string){return !!postingId&&!!state.assetInflations?.some(r=>r.postingId===postingId&&r.preview.assets.some(a=>a.assetId===assetId))}
const days=(date:string)=>Date.parse(date+'T00:00:00Z')/86400000
const previousDay=(date:string)=>new Date((days(date)-1)*86400000).toISOString().slice(0,10)
const charge=(base:number,elapsed:number,total:number)=>total>0?Number((BigInt(base)*BigInt(Math.min(total,Math.max(0,elapsed)))*2n+BigInt(total))/(2n*BigInt(total))):0
export interface InflationSchedule {cost:number;previous:number;accumulated:number;charge:number;bookValue:number;residual:number;baseDate:string;baseAccumulated:number;baseBookValue:number;totalDays:number;elapsedDays:number;allowance:number;counterfactual:number}
/** The closing layer becomes a new basis for consumption after its cut. Original cuts retain their proof. */
export function inflationSchedule(state:State,a:FixedAsset,to:string,life:{commissionedOn:string;usefulLifeEnd:string;residual:number},allowance:number,inclusive=true):InflationSchedule|undefined {
 const layers=assetInflationRows(state,a.id,to,inclusive);if(!layers.length)return undefined
 const latest=layers.at(-1)!,cost=assetBookCost(state,a,to,inclusive),previous=assetPostedAccumulated(state,a.id,to,inclusive),events:{date:string;rank:number;prior:number;value:number;residual:number}[]=layers.map(v=>({date:nextInventoryDate(v.record.date),rank:2,prior:v.row.afterAccumulated,value:v.row.afterValue,residual:v.row.afterResidual}))
 for(const r of state.assetReestimates||[])if(r.assetId===a.id&&r.date<=to&&r.date>layers[0].record.date)events.push({date:r.date,rank:3,prior:r.preview.accumulated,value:r.preview.bookValue,residual:r.residual})
 for(const c of state.assetImpairments||[]){const row=c.preview.rows.find(r=>r.assetId===a.id);if(row&&c.date<to&&c.date>=layers[0].record.date&&row.difference)events.push({date:nextInventoryDate(c.date),rank:1,prior:row.accumulated,value:row.afterValue,residual:row.residual})}
 const commission=state.assetCommissions?.find(c=>c.assetId===a.id&&c.date<=to&&c.date>layers[0].record.date)
 if(commission){const priorAllowance=state.assetImpairments?.findLast(c=>c.date>latest.record.date&&c.date<commission.commissionedOn&&c.preview.rows.some(r=>r.assetId===a.id))?.preview.rows.find(r=>r.assetId===a.id)?.afterAllowance??latest.row.afterAllowance;events.push({date:commission.commissionedOn,rank:3,prior:0,value:assetBookCost(state,a,commission.commissionedOn,false)-priorAllowance,residual:commission.residual})}
 const event=events.sort((a,b)=>a.date.localeCompare(b.date)||a.rank-b.rank).at(-1)!,start=life.commissionedOn?event.date>life.commissionedOn?event.date:life.commissionedOn:'',totalDays=start?Math.max(0,days(life.usefulLifeEnd)-days(start)):0,elapsedDays=totalDays?Math.min(totalDays,Math.max(0,days(to)+1-days(start))):0
 const accumulated=a.method==='No depreciable'?event.prior:accountingSum(event.prior,charge(Math.max(0,event.value-life.residual),elapsedDays,totalDays))
 // At the closing cut no additional consumption occurs beyond the layer's recorded balance.
 const atCut=latest.record.date===to,closingAccumulated=atCut?latest.row.afterAccumulated:accumulated
 return {cost,previous,accumulated:closingAccumulated,charge:closingAccumulated-previous,bookValue:cost-closingAccumulated-allowance,residual:life.residual,baseDate:start,baseAccumulated:event.prior,baseBookValue:event.value,totalDays,elapsedDays,allowance,counterfactual:inflationCounterfactual(state,a,to,inclusive)!}
}
/** Counterfactual schedule in the same currency, ignoring impairment but preserving life/residual revisions. */
export function inflationCounterfactual(state:State,a:FixedAsset,to:string,inclusive=true):number|undefined {
 const layers=assetInflationRows(state,a.id,to,inclusive);if(!layers.length)return undefined
 const layer=layers.at(-1)!,commission=state.assetCommissions?.find(c=>c.assetId===a.id&&c.date<=to),reestimate=state.assetReestimates?.findLast(r=>r.assetId===a.id&&r.date<=to&&r.date>layer.record.date)
 let start=nextInventoryDate(layer.record.date),prior=layer.row.afterCounterfactual,residual=layer.row.afterResidual,end=layer.row.usefulLifeEnd,cost=layer.row.afterCost
 if(reestimate){prior=inflationCounterfactual(state,a,previousDay(reestimate.date),true)!;start=reestimate.date;residual=reestimate.residual;end=reestimate.usefulLifeEnd;cost=assetBookCost(state,a,reestimate.date,false)}
 else if(commission&&commission.date>layer.record.date){start=commission.commissionedOn;end=commission.usefulLifeEnd;residual=commission.residual;prior=0}
 else if(!layer.row.commissionedOn||a.method==='No depreciable')return prior
 if(layer.record.date===to)return layer.row.afterCounterfactual
 return accountingSum(prior,charge(Math.max(0,cost-prior-residual),days(to)+1-days(start),Math.max(0,days(end)-days(start))))
}
