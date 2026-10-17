import {productionClosingRecords} from './production-closing-model'
import {inventoryClosingBalance,inventoryClosingStatement,inventoryClosingRecords} from './inventory-closing-model'
import type {State,Session} from './types'
import type {StatementPreview,StatementRecord,StatementInput} from './financial-statements'
import {statementOutdated,statementRubrics,requiredStatementNotes} from './financial-statements'
import {accountingDate,accountingSum,trialBalance} from './trial-balance'
import {canAccess} from './permissions'
import {uid,today} from './constants'

export const reexpressionPath='/contabilidad/moneda-cierre'
export const monetaryNatures=['Monetaria','Histórica','Valor de cierre'] as const
export const resultOrigins=['Transacción','Consumo de activos','Comparación de magnitudes','Resultado financiero'] as const
type Nature=typeof monetaryNatures[number]
export interface PriceIndex {month:string;value:string}
export interface IndexSeries {provider:'FACPCE'|'Ensayo';reference:string;url:string;accessedAt:string;confirmed:boolean;values:PriceIndex[]}
export interface AgingPart {amount:number;month:string;reason:string;rubricId?:string}
export interface AgingInput {id:string;kind:string;parts:AgingPart[]}
export interface ReexpressionInput {
 statementId:string;reference:string;reason:string;mode:'Primera aplicación o reanudación'|'Continuidad';openingId:string;
 indices:IndexSeries;policies:{accountId:string;nature:Nature;reason:string}[];aging:AgingInput[];
 notes:StatementInput['notes'];residualReason:string;comparativePositionId:string;comparativePeriodId:string;comparativeReason:string;
 confirmed:boolean;review?:string;
}
export interface AgingTarget {id:string;type:'Apertura'|'Cierre'|'Patrimonio inicial'|'Variación patrimonial'|'Resultados';label:string;amount:number;accountId:string;rubricId:string;componentId:string;noteId:string;month:string;maxMonth:string;category:string}
interface AgingCalculation extends AgingPart {targetId:string;type:AgingTarget['type'];label:string;kind:string;accountId:string;componentId:string;rubricId:string;targetMonth:string;coefficient:string;adjusted:number;adjustment:number}
interface Exposure {month:string;amount:number;coefficient:string;adjusted:number;result:number}
export interface ReexpressionPreview {
 statementId:string;statementNumber:string;sourceReview:string;reference:string;reason:string;mode:ReexpressionInput['mode'];openingId:string;
 indices:IndexSeries;policies:ReexpressionInput['policies'];aging:ReexpressionInput['aging'];calculations:AgingCalculation[];
 openingMonth:string;closingMonth:string;openingNetAssets:number;openingEquity:number;equityMovements:number;closingEquity:number;
 resultBeforeFinancial:number;globalResult:number;financialResidual:number;monetaryResult:number;otherResidual:number;residualReason:string;
 exposure:Exposure[];cashMonetaryResult:number;cashRounding:number;comparativeRounding:{state:string;amount:number}[];
 statement:StatementPreview;warnings:string[];
}
export interface ReexpressionRecord extends ReexpressionInput {id:string;number:string;responsible:string;createdAt:string;preview:ReexpressionPreview}
const sum=(v:number[])=>v.reduce(accountingSum,0)
const text=(v:string,label:string,max=2000)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
const month=(v:string)=>{if(typeof v!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)||v<'1900-01')throw new Error('El mes de origen o índice no es válido.');return v}
const before=(date:string)=>{accountingDate(date);const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
const resultGroup=(group:string)=>group==='Ingresos'||group==='Gastos'
const balanceGroup=(group:string)=>group==='Activo'||group==='Pasivo'
const SCALE=10n**12n
function decimal(v:string){if(typeof v!=='string'||!/^\d{1,15}(\.\d{1,12})?$/.test(v.trim()))throw new Error('Cada índice requiere un decimal positivo, sin separadores de miles ni exponentes.');const [a,b='']=v.trim().split('.'),n=BigInt(a)*SCALE+BigInt(b.padEnd(12,'0'));if(n<=0n)throw new Error('El índice debe ser positivo.');return n}
function roundRatio(amount:number,n:bigint,d:bigint){if(!Number.isSafeInteger(amount)||d<=0n||n<=0n)throw new Error('Importe o coeficiente fuera del rango seguro.');const a=BigInt(Math.abs(amount))*n,result=(a+d/2n)/d,value=Number(result)*(amount<0?-1:1);if(!Number.isSafeInteger(value))throw new Error('La reexpresión supera el rango seguro de centavos.');return value}
export function reexpressCents(amount:number,closingIndex:string,originIndex:string){return roundRatio(amount,decimal(closingIndex),decimal(originIndex))}
function coefficient(n:bigint,d:bigint){const v=(n*SCALE+d/2n)/d;return `${v/SCALE}.${String(v%SCALE).padStart(12,'0')}`}
export function parseIndexRows(value:string):PriceIndex[]{return value.split(/\r?\n/).filter(s=>s.trim()).map((line,i)=>{const parts=line.trim().split(/[;\t ]+/);if(parts.length!==2)throw new Error(`Fila ${i+1}: usá mes YYYY-MM e índice decimal separados por espacio, tabulación o punto y coma.`);month(parts[0]);const index=parts[1].replace(',','.');decimal(index);return {month:parts[0],value:index}})}
function series(input:IndexSeries,closingMonth:string){
 if(!input||!['FACPCE','Ensayo'].includes(input.provider)||input.confirmed!==true||!Array.isArray(input.values)||!input.values.length||input.values.length>2400)throw new Error('Revisá la procedencia y confirmá una serie mensual de hasta 2400 índices.')
 const reference=text(input.reference,'Referencia de la serie',200),url=text(input.url,'Fuente de la serie',1000),accessedAt=accountingDate(input.accessedAt)
 if(accessedAt>today())throw new Error('La consulta de índices no puede tener fecha futura.')
 const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('La fuente debe ser una URL de consulta sin credenciales.')
 if(input.provider==='FACPCE'&&(parsed.protocol!=='https:'||!['facpce.org.ar','www.facpce.org.ar'].includes(parsed.hostname)))throw new Error('La serie FACPCE requiere la fuente oficial de la Federación.')
 const values=input.values.map(v=>({month:month(v.month),value:v.value.trim()})).sort((a,b)=>a.month.localeCompare(b.month));for(const v of values)decimal(v.value)
 if(new Set(values.map(v=>v.month)).size!==values.length)throw new Error('La serie tiene meses repetidos.')
 if(values.some(v=>v.month>closingMonth))throw new Error('No incorpores índices posteriores al mes del cierre preparado.')
 if(input.provider==='FACPCE'&&values.some(v=>v.month>=accessedAt.slice(0,7)))throw new Error('El índice del mes en curso aún no corresponde a una publicación mensual completa; revisá el cierre y la fecha de consulta.')
 const map=new Map(values.map(v=>[v.month,decimal(v.value)]));if(!map.has(closingMonth))throw new Error(`Falta el índice de cierre ${closingMonth}; no se estima ni se reemplaza por el último disponible.`)
 return {normalized:{provider:input.provider,reference,url,accessedAt,confirmed:true,values},map}
}
function sourceBalance(state:State,r:StatementRecord){const p=r.preview;return trialBalance({...state,entries:p.source.entries,masters:{...state.masters,accounts:p.source.accounts}},p.from,p.to)}
export function reexpressionTargets(state:State,statementId:string,mode:ReexpressionInput['mode']):{statement:StatementRecord;targets:AgingTarget[];accounts:{id:string;code:string;name:string;opening:number;closing:number}[];openingMonth:string;closingMonth:string}{
 const r=state.financialStatements?.find(r=>r.id===statementId);if(!r)throw new Error('Seleccioná un expediente nominal de estados conservado.')
 if(!['Primera aplicación o reanudación','Continuidad'].includes(mode))throw new Error('Revisá el modo de ajuste.')
 const p=r.preview,b=sourceBalance(state,r),openingMonth=before(p.from).slice(0,7),closingMonth=p.to.slice(0,7),targets:AgingTarget[]=[]
 const add=(t:AgingTarget)=>targets.push(t),base={accountId:'',rubricId:'',componentId:'',category:''}
 const accounts=b.rows.filter(a=>balanceGroup(a.group)&&(a.opening||a.closing||a.debit||a.credit)).map(a=>({id:a.accountId,code:a.code,name:a.name,opening:a.opening,closing:a.closing}))
 if(mode==='Primera aplicación o reanudación'){
  for(const a of b.rows.filter(a=>balanceGroup(a.group)&&a.opening))add({...base,id:`open:${a.accountId}`,type:'Apertura',label:`Apertura · ${a.code} · ${a.name}`,amount:a.opening,accountId:a.accountId,noteId:'inflation',month:openingMonth,maxMonth:openingMonth})
  for(const c of p.equity.components.filter(c=>c.id!=='eq-unassigned')){const amount=p.equity.rows[0].values[c.id];if(amount)add({...base,id:`equity-open:${c.id}`,type:'Patrimonio inicial',label:`Patrimonio inicial · ${c.name}`,amount,componentId:c.id,noteId:'equity',month:openingMonth,maxMonth:openingMonth})}
 }
 for(const a of p.classifications.allocations){const account=p.source.accounts.find(s=>s.id===a.accountId)!;if(!balanceGroup(account.group))continue;for(const part of a.items)add({...base,id:`close:${a.accountId}:${part.rubricId}`,type:'Cierre',label:`Cierre · ${account.code} · ${account.name} · ${statementRubrics.find(r=>r.id===part.rubricId)!.name}`,amount:part.amount,accountId:a.accountId,rubricId:part.rubricId,noteId:part.noteId,month:closingMonth,maxMonth:closingMonth})}
 const components=new Map(p.classifications.allocations.filter(a=>p.source.accounts.find(s=>s.id===a.accountId)?.group==='Patrimonio neto').map(a=>[a.accountId,a.items[0].rubricId]))
 for(const e of p.source.entries.filter(e=>e.date>=p.from))for(const [lineIndex,l]of e.lines.entries()){
  const account=p.source.accounts.find(a=>a.id===l.accountId)!,raw=l.debit-l.credit
  if(resultGroup(account.group)){const rubric=p.classifications.allocations.find(a=>a.accountId===l.accountId)?.items[0]?.rubricId||(account.group==='Ingresos'?'in-other-income':'ex-other-expenses');add({...base,id:`result:${e.id}:${lineIndex}`,type:'Resultados',label:`${e.date} · ${e.concept} · ${account.name}`,amount:raw,accountId:l.accountId,rubricId:rubric,noteId:'criteria',month:e.date.slice(0,7),maxMonth:e.date.slice(0,7)})}
  if(components.has(l.accountId)){const category=p.classifications.equityEntries.find(c=>c.entryId===e.id)!.category;add({...base,id:`equity:${e.id}:${lineIndex}`,type:'Variación patrimonial',label:`${e.date} · ${e.concept} · ${account.name}`,amount:-raw,accountId:l.accountId,componentId:components.get(l.accountId)!,category,noteId:'equity',month:category==='Asignaciones y transferencias'?openingMonth:e.date.slice(0,7),maxMonth:e.date.slice(0,7)})}
 }
 return {statement:r,targets,accounts,openingMonth,closingMonth}
}
export const reexpressionReview=(p:ReexpressionPreview)=>JSON.stringify(p)
function componentCurrency(values:Record<string,number>,apply:(n:number)=>number){const v=Object.fromEntries(Object.entries(values).map(([id,n])=>[id,apply(n)])),capital=values['eq-capital']||0;v['eq-capital-adjustment']=accountingSum(v['eq-capital-adjustment']||0,(v['eq-capital']||0)-capital);v['eq-capital']=capital;return v}
function syntheticResult(id:string,name:string,profit:number){return {id,name,section:profit>=0?'Ingresos' as const:'Gastos' as const,amount:Math.abs(profit),noteIds:['inflation'],accounts:[]}}
function resultTotals(p:StatementPreview){p.results.income=sum(p.results.rows.filter(r=>r.section==='Ingresos').map(r=>r.amount));p.results.expenses=sum(p.results.rows.filter(r=>r.section==='Gastos').map(r=>r.amount));p.results.profit=p.results.income-p.results.expenses}
function positionTotals(p:StatementPreview){const total=(section:string)=>sum(p.position.rows.filter(r=>r.section===section).map(r=>r.amount));p.position.currentAssets=total('Activo corriente');p.position.nonCurrentAssets=total('Activo no corriente');p.position.assets=sum([p.position.currentAssets,p.position.nonCurrentAssets]);p.position.currentLiabilities=total('Pasivo corriente');p.position.nonCurrentLiabilities=total('Pasivo no corriente');p.position.liabilities=sum([p.position.currentLiabilities,p.position.nonCurrentLiabilities]);p.position.equity=p.position.assets-p.position.liabilities;p.position.difference=0}

export function previewReexpression(state:State,input:ReexpressionInput,historical=false):ReexpressionPreview{
 const {statement:r,targets,accounts,openingMonth,closingMonth}=reexpressionTargets(state,input.statementId,input.mode),source=r.preview
 if(!historical&&state.reexpressionPostings?.some(p=>p.preview.from===r.from&&p.preview.date>=r.to))throw new Error('El ejercicio ya tiene ajuste anual contabilizado; consultá la constancia y continuá en el ejercicio siguiente.')
 if(!historical&&statementOutdated(state,r))throw new Error('El expediente nominal tiene información posterior. Prepará una versión vigente antes de reexpresar.')
 if(input.confirmed!==true)throw new Error('Confirmá mediciones, antigüedades, clasificación monetaria y revisión del cálculo.')
 const reference=text(input.reference,'Referencia del ajuste',200),reason=text(input.reason,'Fundamento del ajuste'),{normalized:indices,map}=series(input.indices,closingMonth)
 const index=(m:string)=>{const v=map.get(month(m));if(!v)throw new Error(`Falta el índice ${m}; no se interpola ni se extrapola.`);return v},apply=(n:number,m:string,to=closingMonth)=>roundRatio(n,index(to),index(m)),coef=(m:string,to=closingMonth)=>coefficient(index(to),index(m))
 index(openingMonth)
 // Monthly provenance is required even for months with no nominal journal movement.
 for(let m=openingMonth;m<=closingMonth;){index(m);const d=new Date(`${m}-01T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+1);m=d.toISOString().slice(0,7)}
 if(!Array.isArray(input.policies)||input.policies.length!==accounts.length||new Set(input.policies.map(a=>a.accountId)).size!==accounts.length)throw new Error('Clasificá todas las cuentas de activo y pasivo con saldo o actividad, una sola vez.')
 const policies=input.policies.map(a=>{if(!accounts.some(s=>s.id===a.accountId)||!monetaryNatures.includes(a.nature))throw new Error('La naturaleza monetaria de una cuenta no es válida.');return {...a,reason:text(a.reason,'Fundamento de clasificación monetaria')}}).sort((a,b)=>a.accountId.localeCompare(b.accountId)),policy=new Map(policies.map(a=>[a.accountId,a.nature]))
 if(source.cash.accountIds.some(id=>policy.get(id)!=='Monetaria'&&accounts.some(a=>a.id===id)))throw new Error('El efectivo seleccionado debe clasificarse como monetario; revisá el alcance nominal de equivalentes.')
 if(!Array.isArray(input.notes)||input.notes.length>100||new Set(input.notes.map(n=>n.id)).size!==input.notes.length)throw new Error('Revisá las notas del ajuste y sus identificadores únicos.')
 const notes=input.notes.map(n=>({id:text(n.id,'Identificación de nota',60),title:text(n.title,'Título de nota',200),body:text(n.body,'Contenido de nota',10000)})).sort((a,b)=>a.id.localeCompare(b.id)),noteIds=new Set(notes.map(n=>n.id))
 if([...requiredStatementNotes.map(n=>n.id),'inflation',...source.notes.map(n=>n.id)].some(id=>!noteIds.has(id)))throw new Error('Conservá las referencias originales y completá la nota de ajuste por inflación.')
 if(!Array.isArray(input.aging)||input.aging.length!==targets.length||new Set(input.aging.map(a=>a.id)).size!==targets.length)throw new Error('Descomponé cada partida de apertura, cierre, patrimonio y resultados sin omisiones ni duplicados.')
 const calculations:AgingCalculation[]=[],aging:AgingInput[]=[],targetValues=new Map<string,number>(),resultAllocation=new Map<string,number>()
 for(const t of targets){const a=input.aging.find(a=>a.id===t.id);if(!a||!Array.isArray(a.parts)||!a.parts.length||a.parts.length>500||typeof a.kind!=='string')throw new Error(`Revisá la antigüedad de ${t.label}.`)
  const comparison=t.type==='Resultados'&&a.kind==='Comparación de magnitudes'||t.type==='Variación patrimonial'&&t.category==='Resultados diferidos'&&a.kind==='Comparación de magnitudes'
  if(t.type==='Resultados'&&!resultOrigins.includes(a.kind as typeof resultOrigins[number]))throw new Error('Clasificá el origen de cada resultado: transacción, consumo, comparación o financiero.')
  if(a.parts.some(p=>!Number.isSafeInteger(p.amount)||!p.amount||!comparison&&Math.sign(p.amount)!==Math.sign(t.amount))||sum(a.parts.map(p=>p.amount))!==t.amount)throw new Error(`La descomposición debe conservar el importe original de ${t.label}; sólo una comparación fundamentada admite magnitudes de signos opuestos.`)
  const parts=a.parts.map(part=>{const origin=month(part.month);if(origin>t.maxMonth)throw new Error(`El origen de ${t.label} es posterior a su medición.`);if(t.type==='Variación patrimonial'&&t.category==='Asignaciones y transferencias'&&origin!==openingMonth)throw new Error('Las asignaciones y transferencias de patrimonio utilizan la moneda del cierre anterior.')
   const nature=policy.get(t.accountId),atOpening=t.type==='Apertura'||t.type==='Patrimonio inicial',targetMonth=atOpening?openingMonth:closingMonth
   if((t.type==='Apertura'||t.type==='Cierre')&&nature!=='Histórica'&&origin!==targetMonth)throw new Error('Las partidas monetarias o medidas a valor de cierre conservan su moneda de medición, sin multiplicación adicional.')
   const normalized:AgingPart={amount:part.amount,month:origin,reason:text(part.reason,'Respaldo del origen'),...(t.type==='Resultados'?{rubricId:part.rubricId||t.rubricId}:{})}
   if(t.type==='Resultados'){const rubric=statementRubrics.find(s=>s.id===normalized.rubricId);if(!rubric||!resultGroup(rubric.section))throw new Error('La partida de resultados requiere un rubro de ingresos o gastos.');const key=JSON.stringify([t.accountId,rubric.id]);resultAllocation.set(key,accountingSum(resultAllocation.get(key)||0,part.amount))}
   const adjusted=apply(part.amount,origin,targetMonth);calculations.push({...normalized,targetId:t.id,type:t.type,label:t.label,kind:a.kind,accountId:t.accountId,componentId:t.componentId,rubricId:normalized.rubricId||t.rubricId,targetMonth,coefficient:coef(origin,targetMonth),adjusted,adjustment:adjusted-part.amount});return normalized
  });aging.push({id:t.id,kind:a.kind,parts});targetValues.set(t.id,sum(calculations.filter(c=>c.targetId===t.id).map(c=>c.adjusted)))
 }
 for(const a of source.classifications.allocations.filter(a=>resultGroup(source.source.accounts.find(s=>s.id===a.accountId)!.group)))for(const part of a.items)if((resultAllocation.get(JSON.stringify([a.accountId,part.rubricId]))||0)!==part.amount)throw new Error('El reparto de resultados por rubro debe conciliar con la distribución del expediente nominal.')
 for(const [key,value]of resultAllocation){const [id,rubric]=JSON.parse(key),original=source.classifications.allocations.find(a=>a.accountId===id)?.items.find(p=>p.rubricId===rubric)?.amount||0;if(value!==original)throw new Error('La distribución de cada resultado debe conservar los rubros y saldos nominales revisados.')}
 aging.sort((a,b)=>a.id.localeCompare(b.id))
 const p:StatementPreview=structuredClone(source);p.reference=reference;p.reason=reason;p.basis='Papel de trabajo en moneda de cierre';p.notes=notes;p.comparative={position:null,period:null,reason:''}
 for(const row of p.position.rows){row.accounts=row.accounts.map(a=>({...a,amount:(row.section.startsWith('Activo')?1:-1)*targetValues.get(`close:${a.id}:${row.id}`)!}));row.amount=sum(row.accounts.map(a=>a.amount))}positionTotals(p)
 const openingValues=Object.fromEntries(p.equity.components.map(c=>[c.id,0]));let openingNetAssets=0
 if(input.mode==='Continuidad'){
  const prior=state.reexpressions?.find(s=>s.id===input.openingId),old=prior&&state.financialStatements?.find(s=>s.id===prior.statementId)
  if(!prior||!old||old.to!==before(source.from)||old.preview.source.identity.cuit.replace(/[-\s]/g,'')!==source.source.identity.cuit.replace(/[-\s]/g,''))throw new Error('La continuidad requiere el expediente en moneda de cierre inmediatamente anterior de la misma entidad.')
  if(prior.indices.provider!==indices.provider)throw new Error('No mezcles índices de ensayo y FACPCE en la continuidad.')
  for(const v of prior.indices.values.filter(v=>map.has(v.month)))if(decimal(v.value)!==index(v.month))throw new Error('La serie difiere del índice usado en el cierre anterior; conciliá la publicación antes de continuar.')
  const posted=state.reexpressionPostings?.find(p=>p.reexpressionId===prior.id),previous=posted?inventoryClosingBalance(state,posted.id):sourceBalance(state,old),current=sourceBalance(state,r);for(const a of current.rows.filter(a=>balanceGroup(a.group)))if(a.opening!==(previous.rows.find(s=>s.accountId===a.accountId)?.closing||0))throw new Error('Los saldos nominales de apertura difieren del cierre anterior; conciliá correcciones y nuevos asientos antes de continuar.')
  for(const c of source.equity.components)if(source.equity.rows[0].values[c.id]!==(posted&&(inventoryClosingRecords(state,posted.id).length||productionClosingRecords(state,posted.id).length)?inventoryClosingStatement(state,posted.id):posted?prior.preview.statement:old.preview).equity.rows.at(-1)!.values[c.id])throw new Error('Los componentes nominales de apertura no concilian con el patrimonio anterior.')
  const priorStatement=posted&&(inventoryClosingRecords(state,posted.id).length||productionClosingRecords(state,posted.id).length)?inventoryClosingStatement(state,posted.id):prior.preview.statement;Object.assign(openingValues,priorStatement.equity.rows.at(-1)!.values);openingNetAssets=priorStatement.position.equity
 }else{
  if(input.openingId)throw new Error('La primera aplicación reconstruye saldos iniciales; no selecciona continuidad.')
  openingNetAssets=sum(targets.filter(t=>t.type==='Apertura').map(t=>targetValues.get(t.id)!))
  for(const t of targets.filter(t=>t.type==='Patrimonio inicial')){const value=targetValues.get(t.id)!;openingValues[t.componentId]=value;if(t.componentId==='eq-capital'){openingValues['eq-capital']=t.amount;openingValues['eq-capital-adjustment']=accountingSum(openingValues['eq-capital-adjustment'],value-t.amount)}}
  // Existing capital adjustment and the reexpression of legal capital must both be retained.
  const cap=targets.find(t=>t.id==='equity-open:eq-capital'),adjust=targets.find(t=>t.id==='equity-open:eq-capital-adjustment');if(cap&&adjust)openingValues['eq-capital-adjustment']=sum([targetValues.get(adjust.id)!,targetValues.get(cap.id)!-cap.amount])
  openingValues['eq-unassigned']=openingNetAssets-sum(Object.entries(openingValues).filter(([id])=>id!=='eq-unassigned').map(([,n])=>n))
 }
 const previousPosting=state.reexpressionPostings?.find(p=>p.preview.date===before(source.from)&&p.entryIds.every(id=>source.source.journalPrefixIds.includes(id)))
 if(previousPosting&&(input.mode!=='Continuidad'||input.openingId!==previousPosting.reexpressionId))throw new Error('La apertura ya incorpora un ajuste contabilizado: utilizá Continuidad con ese antecedente para no reexpresar dos veces.')
 const adjustedOpening=componentCurrency(openingValues,n=>apply(n,openingMonth)),equityRows:StatementPreview['equity']['rows']=[{...source.equity.rows[0],reason:`Patrimonio inicial en moneda ${openingMonth}, reexpresado a ${closingMonth}; capital nominal separado de su ajuste.`,values:adjustedOpening,total:sum(Object.values(adjustedOpening))}]
 for(const original of source.equity.rows.slice(1,-2)){const values=Object.fromEntries(p.equity.components.map(c=>[c.id,0])),entryTargets=targets.filter(t=>t.type==='Variación patrimonial'&&t.id.startsWith(`equity:${original.id}:`));for(const t of entryTargets){const adjusted=targetValues.get(t.id)!;values[t.componentId]=accountingSum(values[t.componentId],t.componentId==='eq-capital'?t.amount:adjusted);if(t.componentId==='eq-capital')values['eq-capital-adjustment']=accountingSum(values['eq-capital-adjustment'],adjusted-t.amount)}const total=sum(Object.values(values));if(original.total===0&&entryTargets.some(t=>t.category==='Asignaciones y transferencias')&&total)throw new Error('La variación patrimonial cualitativa debe conservar total cero también después de reexpresar.');equityRows.push({...original,values,total})}
 const openingEquity=equityRows[0].total,equityMovements=sum(equityRows.slice(1).map(r=>r.total)),closingEquity=p.position.equity,globalResult=closingEquity-openingEquity-equityMovements
 const resultRows=new Map<string,StatementPreview['results']['rows'][number]>()
 for(const c of calculations.filter(c=>c.type==='Resultados')){const rubric=statementRubrics.find(r=>r.id===c.rubricId)!;let row=resultRows.get(rubric.id);if(!row){row={...rubric,amount:0,noteIds:['criteria','inflation'],accounts:[]};resultRows.set(row.id,row)}const value=(rubric.section==='Gastos'?1:-1)*c.adjusted;row.amount=accountingSum(row.amount,value);const account=row.accounts.find(a=>a.id===c.accountId);if(account)account.amount=accountingSum(account.amount,value);else row.accounts.push({id:c.accountId,amount:value})}
 p.results.rows=[...resultRows.values()];resultTotals(p);const resultBeforeFinancial=p.results.profit,financialResidual=globalResult-resultBeforeFinancial
 const monetary=new Set(policies.filter(p=>p.nature==='Monetaria').map(p=>p.accountId)),b=sourceBalance(state,r),initialMonetary=sum(b.rows.filter(r=>monetary.has(r.accountId)).map(r=>r.opening)),movement=new Map<string,number>()
 for(const e of source.source.entries.filter(e=>e.date>=source.from))for(const l of e.lines)if(monetary.has(l.accountId))movement.set(e.date.slice(0,7),accountingSum(movement.get(e.date.slice(0,7))||0,l.debit-l.credit))
 const exposure:Exposure[]=[{month:openingMonth,amount:initialMonetary,coefficient:coef(openingMonth),adjusted:apply(initialMonetary,openingMonth),result:initialMonetary-apply(initialMonetary,openingMonth)},...[...movement].sort(([a],[b])=>a.localeCompare(b)).map(([month,amount])=>({month,amount,coefficient:coef(month),adjusted:apply(amount,month),result:amount-apply(amount,month)}))],monetaryResult=sum(exposure.map(e=>e.result)),otherResidual=financialResidual-monetaryResult
 const residualReason=otherResidual?text(input.residualReason,'Conciliación de otros resultados y redondeos'):typeof input.residualReason==='string'?input.residualReason.trim():''
 const financialRows=p.results.rows.filter(r=>['in-financial-income','ex-financial-expenses'].includes(r.id)),financialTotal=sum(financialRows.map(r=>(r.section==='Ingresos'?1:-1)*r.amount))+financialResidual
 p.results.rows=p.results.rows.filter(r=>!financialRows.includes(r));if(financialTotal)p.results.rows.push(syntheticResult('financial-real','Resultados financieros y por tenencia (incluido RECPAM)',financialTotal));resultTotals(p)
 if(p.results.profit!==globalResult)throw new Error('No concilia el resultado global con el estado de resultados reexpresado.')
 const resultValues=Object.fromEntries(p.equity.components.map(c=>[c.id,c.id==='eq-unassigned'?globalResult:0]));equityRows.push({...source.equity.rows.at(-2)!,values:resultValues,total:globalResult,noteId:'inflation',reason:'Resultado global: patrimonio final menos patrimonio inicial y variaciones reexpresados.'})
 const final=Object.fromEntries(p.equity.components.map(c=>[c.id,sum(equityRows.map(r=>r.values[c.id]))]));equityRows.push({...source.equity.rows.at(-1)!,values:final,total:sum(Object.values(final))});p.equity={...p.equity,rows:equityRows,opening:openingEquity,closing:closingEquity,difference:sum(Object.values(final))-closingEquity}
 p.cash.opening=apply(source.cash.opening,openingMonth);p.cash.closing=source.cash.closing;p.cash.variation=p.cash.closing-p.cash.opening;p.cash.rows=p.cash.rows.map(r=>({...r,amount:apply(r.amount,r.date.slice(0,7))}));const cashNet=new Map<string,number>();for(const e of source.source.entries.filter(e=>e.date>=source.from)){const net=sum(e.lines.filter(l=>source.cash.accountIds.includes(l.accountId)).map(l=>l.debit-l.credit));cashNet.set(e.date.slice(0,7),accountingSum(cashNet.get(e.date.slice(0,7))||0,net))}
 const cashMonetaryResult=sum([source.cash.opening-p.cash.opening,...[...cashNet].map(([m,n])=>n-apply(n,m))]),external=sum(p.cash.rows.filter(r=>r.category!=='transfer').map(r=>r.amount)),cashRounding=p.cash.variation-external-cashMonetaryResult
 if(cashMonetaryResult)p.cash.rows.push({entryId:'inflation-cash',date:p.to,concept:'Resultado por exposición del efectivo y equivalentes',lineIndex:-1,accountId:'',category:'cash-effects',activity:'Efectos sobre efectivo',amount:cashMonetaryResult,noteId:'inflation',reason:'Calculado desde saldo inicial y movimientos monetarios mensuales del efectivo.'})
 if(cashRounding)p.cash.rows.push({entryId:'rounding-cash',date:p.to,concept:'Diferencia de redondeo de flujos',lineIndex:-1,accountId:'',category:'cash-effects',activity:'Efectos sobre efectivo',amount:cashRounding,noteId:'inflation',reason:'Diferencia entre redondeo por flujo y agregado mensual; no representa cobro o pago.'})
 p.cash.totals=p.cash.totals.map(t=>({...t,amount:t.activity==='Transferencias internas'?0:sum(p.cash.rows.filter(r=>r.activity===t.activity).map(r=>r.amount))}));p.cash.difference=p.cash.variation-sum(p.cash.totals.map(t=>t.amount))
 const comparativeRounding:ReexpressionPreview['comparativeRounding']=[]
 function prior(id:string,kind:'position'|'period'){
  if(typeof id!=='string')throw new Error('Revisá la identificación del comparativo reexpresado.');if(!id)return null;const record=state.reexpressions?.find(s=>s.id===id),nominal=record&&state.financialStatements?.find(s=>s.id===record.statementId),previous=source.comparative[kind]
  if(!record||!nominal||!previous||nominal.id!==previous.id||nominal.preview.source.identity.cuit.replace(/[-\s]/g,'')!==source.source.identity.cuit.replace(/[-\s]/g,''))throw new Error('El comparativo requiere reexpresión conservada del mismo antecedente nominal y entidad.')
  if(record.indices.provider!==indices.provider)throw new Error('No mezcles índices de ensayo y FACPCE en una comparación.')
  // A revised historical index must be reconciled explicitly before combining conserved calculations.
  for(const v of record.indices.values.filter(v=>map.has(v.month)))if(decimal(v.value)!==index(v.month))throw new Error('La serie difiere del índice usado en el antecedente; prepará nuevamente la comparación con una serie coherente.')
  const value=scaleComparative(record.preview.statement,n=>apply(n,nominal.to.slice(0,7)),comparativeRounding,kind)
  return {id:record.id,number:record.number,from:nominal.from,to:nominal.to,value,notes:structuredClone(record.preview.statement.notes)}
 }
 const position=prior(input.comparativePositionId,'position'),period=prior(input.comparativePeriodId,'period'),comparativeReason=!position||!period?text(input.comparativeReason,'Fundamento del comparativo pendiente'):typeof input.comparativeReason==='string'?input.comparativeReason.trim():''
 p.comparative={position:position?{id:position.id,number:position.number,from:position.from,to:position.to,value:position.value.position,notes:position.notes}:null,period:period?{id:period.id,number:period.number,from:period.from,to:period.to,results:period.value.results,equity:period.value.equity,cash:period.value.cash,notes:period.notes}:null,reason:comparativeReason}
 const warnings=['Preparación en moneda de cierre con mediciones y orígenes revisados; faltan las restantes verificaciones y emisión profesional.','El ajuste contable no calcula el ajuste por inflación impositivo ni el impuesto diferido.','No se generan asientos: el diario conserva sus importes de origen. El cierre nominal no incorpora automáticamente esta preparación.'];if(indices.provider==='Ensayo')warnings.unshift('Índices sintéticos de ensayo: este expediente no debe usarse para una entidad real.');if(!position||!period)warnings.push('Comparativos en moneda de cierre pendientes; no se presentan cifras nominales como ajustadas.');if(otherResidual)warnings.push(`La conciliación financiera incluye diferencias a revisar por mediciones, tenencia o redondeo: ${otherResidual} centavos. ${residualReason}`);if(cashRounding)warnings.push(`Redondeo de efectivo expuesto por separado: ${cashRounding} centavos.`)
 p.warnings=warnings;if(p.position.difference||p.equity.difference||p.cash.difference)throw new Error('Los cuatro estados en moneda de cierre no concilian.')
 const preview={statementId:r.id,statementNumber:r.number,sourceReview:r.review!,reference,reason,mode:input.mode,openingId:input.openingId,indices,policies,aging,calculations,openingMonth,closingMonth,openingNetAssets,openingEquity,equityMovements,closingEquity,resultBeforeFinancial,globalResult,financialResidual,monetaryResult,otherResidual,residualReason,exposure,cashMonetaryResult,cashRounding,comparativeRounding,statement:p,warnings}
 function safe(value:unknown){if(typeof value==='number'&&!Number.isSafeInteger(value))throw new Error('Una cifra del ajuste supera el rango seguro de centavos.');if(value&&typeof value==='object')for(const child of Object.values(value))safe(child)}safe(preview)
 return preview
}

function scaleComparative(source:StatementPreview,apply:(n:number)=>number,rounding:ReexpressionPreview['comparativeRounding'],scope:string):StatementPreview{
 const p=structuredClone(source),noteId='inflation',empty=()=>Object.fromEntries(p.equity.components.map(c=>[c.id,0]))
 for(const row of p.position.rows){row.accounts=row.accounts.map(a=>({...a,amount:apply(a.amount)}));row.amount=row.accounts.length?sum(row.accounts.map(a=>a.amount)):apply(row.amount)}positionTotals(p)
 const targetEquity=apply(source.position.equity),positionDifference=targetEquity-p.position.equity;if(positionDifference){p.position.rows.push({id:'comparative-position-rounding',name:'Diferencia de redondeo comparativo',section:'Activo corriente',amount:positionDifference,noteIds:[noteId],accounts:[]});rounding.push({state:`${scope}: situación patrimonial`,amount:positionDifference});positionTotals(p)}
 for(const row of p.results.rows){row.accounts=row.accounts.map(a=>({...a,amount:apply(a.amount)}));row.amount=row.accounts.length?sum(row.accounts.map(a=>a.amount)):apply(row.amount)}resultTotals(p);const resultDifference=apply(source.results.profit)-p.results.profit;if(resultDifference){p.results.rows.push(syntheticResult('comparative-result-rounding','Diferencia de redondeo comparativo',resultDifference));rounding.push({state:`${scope}: resultados`,amount:resultDifference});resultTotals(p)}
 const rows=p.equity.rows.slice(0,-1).map(original=>{const values=componentCurrency(original.values,apply),total=apply(original.total),difference=total-sum(Object.values(values));values['eq-unassigned']=accountingSum(values['eq-unassigned'],difference);if(difference)rounding.push({state:`${scope}: patrimonio · ${original.label}`,amount:difference});return {...original,values,total}})
 const equityDifference=targetEquity-sum(rows.map(r=>r.total));if(equityDifference){const values=empty();values['eq-unassigned']=equityDifference;rows.push({id:'comparative-equity-rounding',label:'Diferencia de redondeo comparativo',noteId,reason:'Redondeo al centavo de cada variación y saldo del comparativo.',values,total:equityDifference});rounding.push({state:`${scope}: patrimonio final`,amount:equityDifference})}
 const values=empty();for(const row of rows)for(const c of p.equity.components)values[c.id]=accountingSum(values[c.id],row.values[c.id]);rows.push({...source.equity.rows.at(-1)!,values,total:sum(Object.values(values))});p.equity={...p.equity,rows,opening:rows[0].total,closing:targetEquity,difference:sum(Object.values(values))-targetEquity}
 p.cash.opening=apply(source.cash.opening);p.cash.closing=apply(source.cash.closing);p.cash.variation=p.cash.closing-p.cash.opening;p.cash.rows=p.cash.rows.map(r=>({...r,amount:apply(r.amount)}));p.cash.totals=p.cash.totals.map(t=>({...t,amount:t.activity==='Transferencias internas'?0:sum(p.cash.rows.filter(r=>r.activity===t.activity).map(r=>r.amount))}));const cashDifference=p.cash.variation-sum(p.cash.totals.map(t=>t.amount));if(cashDifference){p.cash.rows.push({entryId:'comparative-cash-rounding',date:p.to,concept:'Diferencia de redondeo comparativo',lineIndex:-1,accountId:'',category:'cash-effects',activity:'Efectos sobre efectivo',amount:cashDifference,noteId,reason:'Redondeo por flujo, saldo inicial y saldo final del comparativo.'});p.cash.totals.find(t=>t.activity==='Efectos sobre efectivo')!.amount=accountingSum(p.cash.totals.find(t=>t.activity==='Efectos sobre efectivo')!.amount,cashDifference);rounding.push({state:`${scope}: efectivo`,amount:cashDifference})}p.cash.difference=0
 return p
}
export function preserveReexpression(state:State,input:ReexpressionInput,actor:Session){
 if(!canAccess(actor,reexpressionPath))throw new Error('Sin permiso para preparar moneda de cierre.')
 const preview=previewReexpression(state,input);if(input.review!==reexpressionReview(preview))throw new Error('La revisión del ajuste cambió; preparala nuevamente.')
 if(state.reexpressions?.some(r=>r.reference===preview.reference))throw new Error('La referencia del ajuste ya existe.')
 const record:ReexpressionRecord={...input,reference:preview.reference,reason:preview.reason,indices:preview.indices,policies:preview.policies,aging:preview.aging,notes:preview.statement.notes,residualReason:preview.residualReason,comparativeReason:preview.statement.comparative.reason,id:uid(),number:`INT-MC-${String((state.reexpressions?.length||0)+1).padStart(8,'0')}`,responsible:actor.name,createdAt:new Date().toISOString(),preview};state.reexpressions=[...(state.reexpressions||[]),record];return record
}
export function validateReexpressions(state:State){
 const records=state.reexpressions??[];if(!Array.isArray(records)||state.reexpressions===null)throw new Error('Las preparaciones en moneda de cierre deben ser una lista.')
 const ids=new Set<string>(),refs=new Set<string>()
 for(const [i,r]of records.entries()){
  if(typeof r.id!=='string'||!r.id||ids.has(r.id)||r.number!==`INT-MC-${String(i+1).padStart(8,'0')}`||refs.has(r.reference)||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt)))throw new Error('Constancia en moneda de cierre inválida.')
  const preview=previewReexpression({...state,reexpressions:records.slice(0,i)},r,true);if(r.review!==reexpressionReview(preview)||r.review!==reexpressionReview(r.preview))throw new Error('Cambió el índice, origen, fuente, cálculo o conciliación de moneda de cierre.');ids.add(r.id);refs.add(r.reference)
 }
}
