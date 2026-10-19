import type {Session,State} from './types'
import {today,uid} from './constants'
import {exerciseRanges} from './exercise-calendar'
import {canAccess} from './permissions'
import {validCuit} from './engine'
import {purchaseCandidates,previousVatPurchases,vatPurchasesOutdated,vatPurchasesPath} from './vat-purchases'

export interface VatAnnualInput {
 from:string;to:string;previousId:string;reference:string;reason:string;taxable:number;exempt:number;untaxed:number;basisReference:string;nominalConfirmed:boolean;completeConfirmed:boolean;
 months:{period:string;preparationId:string;applied:number;reference:string;reason:string;noCommonConfirmed:boolean}[];
 returns:{documentId:string;commonReturned:number;commonRestored:number;reference:string;reason:string}[];review?:string;
}
interface Sources {company:{name:string;cuit:string;iva:string};exercises:{start:string;end:string}[];names:{id:string;name:string}[];documentIds:string[];originalIds:string[];purchaseIds:string[]}
export interface VatAnnualPreview {
 input:Omit<VatAnnualInput,'review'>;source:Sources;period:string;
 months:{period:string;preparationId:string;number:string;mode:string;documents:number;common:number;prepared:number;applied:number;difference:number;internalX:number}[];
 returns:{documentId:string;number:string;originId:string;originNumber:string;originDate:string;currentExercise:boolean;vat:number;restored:number;commonReturned:number;commonRestored:number}[];
 totals:{commonGross:number;commonReturned:number;commonNet:number;prepared:number;appliedGross:number;commonRestored:number;appliedNet:number;basisTotal:number;annualCredit:number;adjustment:number;inFavorOfCompany:number;inFavorOfArca:number;previousAdjustment:number;changeFromPrevious:number};
 warnings:string[];status:'Preparación de ajuste anual · sin presentación ARCA';
}
export interface VatAnnualRecord {id:string;number:string;responsible:string;createdAt:string;review:string;preview:VatAnnualPreview}
const records=(s:State)=>s.vatAnnual||[]
const iso=(v:string)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v
const amount=(n:number)=>Number.isSafeInteger(n)&&n>=0
const text=(v:string,label:string,max:number)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
const sum=(values:number[])=>{const n=values.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(n))throw new Error('Los importes del ajuste anual exceden la precisión segura.');return n}
export function annualMonths(from:string,to:string){
 if(!iso(from)||!iso(to)||from.slice(8)!=='01'||new Date(Date.UTC(Number(to.slice(0,4)),Number(to.slice(5,7)),0)).toISOString().slice(0,10)!==to||from>to||from<'1992-04-01')throw new Error('Seleccioná un ejercicio nominal desde 1992, con inicio y fin de meses completos.')
 const result:string[]=[];let year=Number(from.slice(0,4)),month=Number(from.slice(5,7));while(`${year}-${String(month).padStart(2,'0')}`<=to.slice(0,7)){result.push(`${year}-${String(month).padStart(2,'0')}`);if(result.length>12)throw new Error('El ajuste anual admite hasta doce meses; revisá el ejercicio.');if(++month===13){year++;month=1}}
 return result
}
export function previousVatAnnual(s:State,from:string,to:string){return records(s).filter(r=>r.preview.input.from===from&&r.preview.input.to===to).at(-1)}
export function annualCandidates(s:State,from:string,to:string){
 const periods=annualMonths(from,to),months=periods.map(period=>{const preparation=previousVatPurchases(s,period),docs=purchaseCandidates(s,period);return {period,preparation,documents:docs.filter(d=>d.letter!=='X').length,internalX:docs.filter(d=>d.letter==='X').length,common:preparation?.preview.proration?.common||0,prepared:preparation?.preview.proration?.prorated||0}})
 const returns=s.documents.filter(d=>d.side==='proveedor'&&d.kind==='credito'&&d.letter!=='X'&&d.date>=from&&d.date<=to).map(d=>{const origin=s.documents.find(o=>o.id===d.sourceId),month=months.find(m=>m.period===d.date.slice(0,7)),row=month?.preparation?.preview.rows.find(r=>r.document.id===d.id),originMonth=months.find(m=>m.period===origin?.date.slice(0,7)),common=originMonth?.preparation?.preview.proration?.items.find(i=>i.documentId===origin?.id)?.common||0;return {document:d,origin,currentExercise:!!origin&&origin.date>=from&&origin.date<=to,originCommon:common,restored:month?.preparation?.preview.input.credits.find(c=>c.documentId===d.id)?.amount||0,vat:row?.vat??(d.letter==='A'?d.vat:0)}})
 return {months,returns}
}
function sourceFor(s:State):Sources{return structuredClone({company:{name:s.settings.name,cuit:s.settings.cuit,iva:s.settings.iva},exercises:exerciseRanges(s),names:s.parties.filter(p=>p.side==='proveedor').map(p=>({id:p.id,name:p.name})),documentIds:s.documents.map(d=>d.id),originalIds:(s.supplierOriginals||[]).map(r=>r.id),purchaseIds:(s.vatPurchases||[]).map(r=>r.id)})}
export function previewVatAnnual(s:State,input:VatAnnualInput):VatAnnualPreview{
 const periods=annualMonths(input.from,input.to)
 if(!validCuit(s.settings.cuit)||s.settings.iva!=='Responsable Inscripto'||!s.settings.name.trim())throw new Error('El ajuste anual requiere una empresa responsable inscripta con denominación y CUIT válido.')
 if(!exerciseRanges(s).some(r=>r.start===input.from&&r.end===input.to))throw new Error('El ajuste anual debe corresponder a un ejercicio conservado completo.')
 if(input.to>today())throw new Error('El ejercicio todavía no terminó. No se confirma un ajuste anual con meses futuros.')
 if(input.nominalConfirmed!==true||input.completeConfirmed!==true)throw new Error('Confirmá el criterio nominal y la revisión del ejercicio completo, las estimaciones computadas y las devoluciones.')
 if(![input.taxable,input.exempt,input.untaxed].every(amount))throw new Error('Las bases anuales deben ser importes netos no negativos en centavos.')
 const previous=previousVatAnnual(s,input.from,input.to);if(input.previousId!==(previous?.id||''))throw new Error('Cambió la preparación anual anterior. Actualizá la revisión.')
 const reference=text(input.reference,'Referencia anual',200),reason=text(input.reason,'Fundamento anual',3000),basisReference=text(input.basisReference,'Referencia de las bases anuales',300)
 if(records(s).some(r=>r.preview.input.reference.toLocaleLowerCase()===reference.toLocaleLowerCase()))throw new Error('La referencia anual ya fue utilizada.')
 if(!Array.isArray(input.months)||input.months.length!==periods.length||new Set(input.months.map(m=>m.period)).size!==periods.length||input.months.some(m=>!periods.includes(m.period)))throw new Error('Revisá todos los meses del ejercicio, sin omitir ni repetir períodos.')
 const candidates=annualCandidates(s,input.from,input.to),normalizedMonths:VatAnnualInput['months']=[],months:VatAnnualPreview['months']=[]
 for(const m of candidates.months){const i=input.months.find(i=>i.period===m.period)!,p=m.preparation
  if(i.preparationId!==(p?.id||''))throw new Error(`${m.period}: seleccioná la última preparación mensual conservada.`)
  if(m.documents&&(!p||vatPurchasesOutdated(s,p)))throw new Error(`${m.period}: falta una preparación mensual actual y completa; revisá sus originales y fuentes.`)
  if(p?.preview.proration&&(p.preview.source.exercise?.start!==input.from||p.preview.source.exercise?.end!==input.to))throw new Error(`${m.period}: la estimación mensual usa otro ejercicio; prepará su versión correcta.`)
  if(!p?.preview.proration&&i.noCommonConfirmed!==true)throw new Error(`${m.period}: confirmá que no hay compras ordinarias o que la apropiación fue directa, sin IVA común omitido.`)
  if(!amount(i.applied)||i.applied>m.common)throw new Error(`${m.period}: el crédito prorrateado computado declarado debe estar entre cero y el IVA común conservado. Conciliá diferencias de clasificación antes del ajuste.`)
  const monthReference=text(i.reference,`Referencia del mes ${m.period}`,300),monthReason=typeof i.reason==='string'?i.reason.trim():'';if(monthReason.length>1000||i.applied!==m.prepared&&!monthReason)throw new Error(`${m.period}: justificá la diferencia entre el crédito preparado y el computado declarado.`)
  normalizedMonths.push({period:m.period,preparationId:i.preparationId,applied:i.applied,reference:monthReference,reason:monthReason,noCommonConfirmed:!p?.preview.proration})
  months.push({period:m.period,preparationId:p?.id||'',number:p?.number||'Sin compras ordinarias · confirmado',mode:p?.preview.input.mode||'Sin compras ordinarias',documents:m.documents,common:m.common,prepared:m.prepared,applied:i.applied,difference:i.applied-m.prepared,internalX:m.internalX})
 }
 if(!Array.isArray(input.returns)||input.returns.length!==candidates.returns.length||new Set(input.returns.map(r=>r.documentId)).size!==input.returns.length||input.returns.some(r=>!candidates.returns.some(c=>c.document.id===r.documentId)))throw new Error('Revisá todas las notas de crédito de compras del ejercicio.')
 const normalizedReturns:VatAnnualInput['returns']=[],returns:VatAnnualPreview['returns']=[],returnedByOrigin=new Map<string,number>(),restoredByMonth=new Map<string,number>()
 for(const c of candidates.returns){const i=input.returns.find(i=>i.documentId===c.document.id)!,o=c.origin
  if(!o||o.kind!=='factura'||o.date>c.document.date)throw new Error(`${c.document.number}: falta una factura de origen válida para revisar la devolución.`)
  if(![i.commonReturned,i.commonRestored].every(amount)||i.commonReturned>c.vat||i.commonRestored>Math.min(i.commonReturned,c.restored)||!c.currentExercise&&(i.commonReturned||i.commonRestored))throw new Error(`${c.document.number}: revisá el IVA común devuelto de este ejercicio y su restitución histórica. Las devoluciones de ejercicios anteriores no recortan este IVA común.`)
  const returned=sum([returnedByOrigin.get(o.id)||0,i.commonReturned]);if(returned>c.originCommon)throw new Error(`${c.document.number}: las devoluciones superan el IVA común conservado de la factura original.`);returnedByOrigin.set(o.id,returned)
  if(i.commonRestored){const period=o.date.slice(0,7),restored=sum([restoredByMonth.get(period)||0,i.commonRestored]),applied=months.find(m=>m.period===period)?.applied||0;if(restored>applied)throw new Error(`${c.document.number}: la restitución del IVA común supera el crédito computado declarado del mes de origen.`);restoredByMonth.set(period,restored)}
  normalizedReturns.push({documentId:i.documentId,commonReturned:i.commonReturned,commonRestored:i.commonRestored,reference:text(i.reference,'Referencia de la devolución',300),reason:text(i.reason,'Fundamento de la devolución',1000)})
  returns.push({documentId:c.document.id,number:c.document.number,originId:o.id,originNumber:o.number,originDate:o.date,currentExercise:c.currentExercise,vat:c.vat,restored:c.restored,commonReturned:i.commonReturned,commonRestored:i.commonRestored})
 }
 const commonGross=sum(months.map(m=>m.common)),commonReturned=sum(returns.map(r=>r.commonReturned)),commonNet=commonGross-commonReturned,prepared=sum(months.map(m=>m.prepared)),appliedGross=sum(months.map(m=>m.applied)),commonRestored=sum(returns.map(r=>r.commonRestored)),appliedNet=appliedGross-commonRestored,basisTotal=sum([input.taxable,input.exempt,input.untaxed])
 if(commonNet<0||appliedNet<0||commonNet&&!basisTotal)throw new Error('El IVA común neto requiere bases anuales documentadas mayores que cero y restituciones conciliadas.')
 const annualCredit=basisTotal?Number((2n*BigInt(commonNet)*BigInt(input.taxable)+BigInt(basisTotal))/(2n*BigInt(basisTotal))):0,adjustment=annualCredit-appliedNet,previousAdjustment=previous?.preview.totals.adjustment||0,changeFromPrevious=adjustment-previousAdjustment
 if(![annualCredit,adjustment,changeFromPrevious].every(Number.isSafeInteger))throw new Error('El ajuste anual excede la precisión segura.')
 const totals={commonGross,commonReturned,commonNet,prepared,appliedGross,commonRestored,appliedNet,basisTotal,annualCredit,adjustment,inFavorOfCompany:Math.max(0,adjustment),inFavorOfArca:Math.max(0,-adjustment),previousAdjustment,changeFromPrevious}
 const warnings=['Preparación nominal de compras ordinarias en ARS. Las bases, destinos, importes computados y restituciones son datos declarados sujetos a revisión profesional.','Una preparación mensual no acredita una declaración presentada. Se compara el cómputo prorrateado declarado por el responsable, con referencia por mes.','Las devoluciones de IVA común del mismo ejercicio reducen el conjunto anual y su restitución histórica reduce el crédito computado comparado. No se aplica el coeficiente anual a devoluciones de ejercicios anteriores.','El ajuste se revisa en el período de cierre. No se modifica el crédito directo ni se reescriben TXT, se registran asientos o se presenta una declaración.','Una nueva versión conserva el ajuste total para revisar; no es un importe incremental ni una rectificativa presentada.']
 if(months.some(m=>m.internalX))warnings.push('Hay comprobantes internos X excluidos. Revisá que no representen originales fiscales omitidos.')
 return {input:{from:input.from,to:input.to,previousId:input.previousId,reference,reason,taxable:input.taxable,exempt:input.exempt,untaxed:input.untaxed,basisReference,nominalConfirmed:true,completeConfirmed:true,months:normalizedMonths,returns:normalizedReturns},source:sourceFor(s),period:input.to.slice(0,7),months,returns,totals,warnings,status:'Preparación de ajuste anual · sin presentación ARCA'}
}
export const vatAnnualReview=(p:VatAnnualPreview)=>JSON.stringify(p)
export function preserveVatAnnual(s:State,input:VatAnnualInput,actor:Session){if(!canAccess(actor,vatPurchasesPath))throw new Error('Tu perfil no permite conservar ajustes anuales de IVA.');const preview=previewVatAnnual(s,input);if(input.review!==vatAnnualReview(preview))throw new Error('La revisión anual cambió. Preparala nuevamente.');const r:VatAnnualRecord={id:uid(),number:`INT-IA-${String(records(s).length+1).padStart(8,'0')}`,responsible:actor.name,createdAt:new Date().toISOString(),review:vatAnnualReview(preview),preview:structuredClone(preview)};(s.vatAnnual??=[]).push(r);return r}
function frozenState(s:State,source:Sources){
 for(const [collection,ids]of [[s.documents,source?.documentIds],[s.supplierOriginals||[],source?.originalIds],[s.vatPurchases||[],source?.purchaseIds]] as const)if(!Array.isArray(ids)||JSON.stringify(collection.slice(0,ids.length).map(r=>r.id))!==JSON.stringify(ids))throw new Error('No se conservan las fuentes del ajuste anual.')
 if(!Array.isArray(source.exercises)||!source.exercises.length||!Array.isArray(source.names))throw new Error('No se conservan el ejercicio y los nombres del ajuste anual.')
 const current=source.exercises.at(-1)!
 return {...s,settings:{...s.settings,...source.company,exerciseStart:current.start,exerciseEnd:current.end,exerciseHistory:source.exercises.slice(0,-1)},parties:s.parties.filter(p=>p.side!=='proveedor'||source.names.some(n=>n.id===p.id)).map(p=>({...p,name:source.names.find(n=>n.id===p.id)?.name||p.name})),documents:s.documents.slice(0,source.documentIds.length),supplierOriginals:(s.supplierOriginals||[]).slice(0,source.originalIds.length),vatPurchases:(s.vatPurchases||[]).slice(0,source.purchaseIds.length)}
}
export function validateVatAnnual(s:State){if(s.vatAnnual!==undefined&&!Array.isArray(s.vatAnnual))throw new Error('Los ajustes anuales de IVA deben ser una lista.');const ids=new Set<string>();for(const [i,r]of records(s).entries()){if(!r.id||ids.has(r.id)||r.number!==`INT-IA-${String(i+1).padStart(8,'0')}`||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||!r.preview)throw new Error('Constancia anual de IVA inválida.');ids.add(r.id);const view={...frozenState(s,r.preview.source),vatAnnual:records(s).slice(0,i)},p=previewVatAnnual(view,r.preview.input);if(r.review!==vatAnnualReview(p)||r.review!==vatAnnualReview(r.preview))throw new Error('Cambió la revisión anual, las fuentes, devoluciones o importes declarados.')}}
export function vatAnnualOutdated(s:State,r:VatAnnualRecord){try{const index=records(s).findIndex(v=>v.id===r.id),p=previewVatAnnual({...s,vatAnnual:records(s).slice(0,index)},r.preview.input);return JSON.stringify({source:p.source,totals:p.totals})!==JSON.stringify({source:r.preview.source,totals:r.preview.totals})}catch{return true}}
export function vatAnnualFile(r:VatAnnualRecord){if(r.review!==vatAnnualReview(r.preview))throw new Error('La revisión anual conservada no coincide.');return {name:`SICA_AJUSTE_ANUAL_IVA_${r.preview.input.to}_${r.number}.json`,bytes:new TextEncoder().encode(JSON.stringify({kind:'Papel de trabajo SICA · no es un archivo oficial de importación ARCA',number:r.number,responsible:r.responsible,createdAt:r.createdAt,preview:r.preview},null,2)+'\n')}}
