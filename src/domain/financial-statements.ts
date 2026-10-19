import {validateLegalForm} from './fiscal-registration'
import type {Entry, Session, State} from './types'
import {uid} from './constants'
import {canAccess} from './permissions'
import {exerciseRanges} from './exercise-calendar'
import {accountingDate, accountingSum, trialBalance} from './trial-balance'

export const statementsPath='/contabilidad/estados'
type Section='Activo corriente'|'Activo no corriente'|'Pasivo corriente'|'Pasivo no corriente'|'Patrimonio neto'|'Ingresos'|'Gastos'
export interface StatementRubric {id:string;name:string;section:Section}
const assetRubrics=[['cash','Caja y bancos'],['investments','Inversiones financieras'],['customers','Cuentas por cobrar y derechos a facturar'],['other-credits','Otros créditos'],['inventory','Bienes de cambio'],['fixed','Bienes de uso'],['intangibles','Activos intangibles'],['investment-property','Propiedades de inversión'],['participations','Participaciones permanentes'],['other-assets','Otros activos'],['deferred-tax','Activo por impuesto diferido']]
const liabilityRubrics=[['suppliers','Deudas comerciales'],['loans','Préstamos y otros pasivos financieros'],['tax','Deudas fiscales'],['payroll','Deudas laborales y previsionales'],['other-debts','Otras deudas'],['provisions','Previsiones'],['deferred-tax','Pasivo por impuesto diferido']]
export const statementRubrics:StatementRubric[]=[
 ...assetRubrics.flatMap(([id,name])=>[{id:`ac-${id}`,name,section:'Activo corriente' as const},{id:`an-${id}`,name,section:'Activo no corriente' as const}]),
 ...liabilityRubrics.flatMap(([id,name])=>[{id:`pc-${id}`,name,section:'Pasivo corriente' as const},{id:`pn-${id}`,name,section:'Pasivo no corriente' as const}]),
 ...[['capital','Capital suscripto'],['capital-adjustment','Ajuste del capital'],['irrevocable','Aportes irrevocables'],['premium','Primas de emisión'],['reserves','Ganancias reservadas'],['unassigned','Resultados no asignados'],['deferred','Resultados diferidos']].map(([id,name])=>({id:`eq-${id}`,name,section:'Patrimonio neto' as const})),
 ...[['inventory-recovery','Reversiones de desvalorización de inventario'],['sales','Ventas y servicios'],['other-income','Otros ingresos'],['financial-income','Resultados financieros y de tenencia positivos'],['discontinued-income','Resultado positivo de operaciones discontinuadas']].map(([id,name])=>({id:`in-${id}`,name,section:'Ingresos' as const})),
 ...[['inventory-loss','Pérdidas por desvalorización de inventario'],['cogs','Costo de ventas'],['selling','Gastos de comercialización'],['administration','Gastos de administración'],['other-expenses','Otros gastos'],['financial-expenses','Resultados financieros y de tenencia negativos'],['tax','Impuesto a las ganancias'],['discontinued-expenses','Resultado negativo de operaciones discontinuadas']].map(([id,name])=>({id:`ex-${id}`,name,section:'Gastos' as const})),
]
export const cashFlowCategories=[
 {id:'op-customers',name:'Cobros a clientes',activity:'Operativas',sign:1},
 {id:'op-suppliers',name:'Pagos a proveedores',activity:'Operativas',sign:-1},
 {id:'op-payroll',name:'Pagos laborales y previsionales',activity:'Operativas',sign:-1},
 {id:'op-tax',name:'Pagos de impuestos y tasas',activity:'Operativas',sign:-1},
 {id:'op-income-tax',name:'Pago o recuperación de impuesto a las ganancias',activity:'Operativas',sign:0},
 {id:'op-other-receipts',name:'Otros cobros operativos',activity:'Operativas',sign:1},
 {id:'op-other-payments',name:'Otros pagos operativos',activity:'Operativas',sign:-1},
 {id:'inv-receipts',name:'Cobros de inversión',activity:'Inversión',sign:1},
 {id:'inv-payments',name:'Pagos de inversión',activity:'Inversión',sign:-1},
 {id:'fin-receipts',name:'Cobros de financiación',activity:'Financiación',sign:1},
 {id:'fin-payments',name:'Pagos de financiación',activity:'Financiación',sign:-1},
 {id:'cash-effects',name:'Resultados y otros efectos sobre efectivo',activity:'Efectos sobre efectivo',sign:0},
 {id:'transfer',name:'Transferencia entre efectivo y equivalentes',activity:'Transferencias internas',sign:0},
] as const
export const equityMovementCategories=['Aportes','Retiros y distribuciones','Asignaciones y transferencias','Ajustes de períodos anteriores','Resultados diferidos','Otras variaciones'] as const
export const requiredStatementNotes=[{id:'entity',title:'Entidad, actividad y marco de preparación'},{id:'criteria',title:'Bases de medición, rubros y políticas contables'},{id:'equity',title:'Patrimonio y decisiones de propietarios'},{id:'cash',title:'Efectivo, equivalentes y operaciones sin efectivo'},{id:'events',title:'Contingencias y hechos posteriores'}]
export function statementNoteLabel(notes:{id:string}[],id:string){const core=requiredStatementNotes.findIndex(n=>n.id===id),extra=notes.filter(n=>!requiredStatementNotes.some(r=>r.id===n.id)).sort((a,b)=>a.id.localeCompare(b.id)).findIndex(n=>n.id===id);return `Nota ${core>=0?core+1:extra+requiredStatementNotes.length+1}`}
export interface StatementInput {
 from:string;to:string;reference:string;reason:string;classificationConfirmed:boolean;cashConfirmed:boolean;nominalConfirmed:boolean;
 allocations:{accountId:string;items:{rubricId:string;amount:number;noteId:string}[]}[];
 cashAccounts:string[];cashBasis:string;
 cashLines:{entryId:string;lineIndex:number;parts:{category:string;amount:number;noteId:string;reason:string}[]}[];
 equityEntries:{entryId:string;category:string;noteId:string;reason:string}[];
 notes:{id:string;title:string;body:string}[];
 priorPositionId:string;priorPeriodId:string;comparativeReason:string;review?:string;
}
export interface StatementSource {identity:{legalForm?:string;name:string;cuit:string;address:string;province:string;industry:string;accountingStandard:string};accounts:{id:string;code:string;name:string;group:string}[];entries:Entry[];journalPrefixIds:string[]}
interface RubricValue extends StatementRubric {amount:number;noteIds:string[];accounts:{id:string;amount:number}[]}
interface EquityRow {id:string;label:string;noteId:string;reason:string;values:Record<string,number>;total:number}
interface CashRow {entryId:string;date:string;concept:string;lineIndex:number;accountId:string;category:string;activity:string;amount:number;noteId:string;reason:string}
export interface StatementPreview {
 from:string;to:string;reference:string;reason:string;basis:'Papel de trabajo nominal'|'Papel de trabajo en moneda de cierre';source:StatementSource;
 position:{rows:RubricValue[];currentAssets:number;nonCurrentAssets:number;assets:number;currentLiabilities:number;nonCurrentLiabilities:number;liabilities:number;equity:number;difference:number};
 results:{rows:RubricValue[];income:number;expenses:number;profit:number;openingResults:number};
 equity:{components:StatementRubric[];rows:EquityRow[];opening:number;closing:number;difference:number};
 cash:{accountIds:string[];basis:string;opening:number;closing:number;variation:number;rows:CashRow[];totals:{activity:string;amount:number}[];difference:number};
 notes:StatementInput['notes'];classifications:Pick<StatementInput,'allocations'|'cashLines'|'equityEntries'>;
 comparative:{position:{id:string;number:string;from:string;to:string;value:StatementPreview['position'];notes:StatementInput['notes']}|null;period:{id:string;number:string;from:string;to:string;results:StatementPreview['results'];equity:StatementPreview['equity'];cash:StatementPreview['cash'];notes:StatementInput['notes']}|null;reason:string};
 warnings:string[];
}
export interface StatementRecord extends StatementInput {id:string;number:string;responsible:string;createdAt:string;preview:StatementPreview}
const sum=(values:number[])=>values.reduce(accountingSum,0)
const text=(value:string,label:string,max=2000)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return value.trim()}
const resultGroup=(group:string)=>group==='Ingresos'||group==='Gastos'
function sourceFor(state:State,from:string,to:string):StatementSource {
 const range=exerciseRanges(state).find(r=>r.start===from&&to>=r.start&&to<=r.end)
 if(!range)throw new Error('El expediente debe comenzar al inicio de un ejercicio conservado y terminar dentro de él.')
 const excluded=new Set((state.yearEndCloses||[]).filter(c=>c.exerciseStart===from).map(c=>c.id))
 const entries=state.entries.filter(e=>e.date<=to&&(!e.yearEndCloseId||!excluded.has(e.yearEndCloseId))).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
 const used=new Set(entries.flatMap(e=>e.lines.map(l=>l.accountId)))
 const accounts=state.masters.accounts.filter(a=>used.has(a.id)).map(a=>({id:a.id,code:String(a.code),name:String(a.name),group:String(a.group)})).sort((a,b)=>a.id.localeCompare(b.id))
 const {name,cuit,address,province,industry,accountingStandard,legalForm}=state.settings
 validateLegalForm(legalForm)
 return structuredClone({identity:{name,cuit,address,province,industry,accountingStandard,...(legalForm?{legalForm}:{})},accounts,entries,journalPrefixIds:state.entries.map(e=>e.id)})
}
function sourceState(state:State,source:StatementSource):State {return {...state,entries:source.entries,masters:{...state.masters,accounts:source.accounts}}}
export function statementSources(state:State,from:string,to:string){
 accountingDate(from);accountingDate(to);const source=sourceFor(state,from,to),balance=trialBalance(sourceState(state,source),from,to)
 const accounts=balance.rows.map(r=>({...r,amount:resultGroup(r.group)?r.closing-r.opening:r.closing})).filter(r=>r.amount||r.group==='Patrimonio neto'&&(r.opening||r.debit||r.credit))
 return {source,balance,accounts,periodEntries:source.entries.filter(e=>e.date>=from)}
}
export function allowedStatementRubrics(group:string){return statementRubrics.filter(r=>group==='Activo'||group==='Pasivo'?r.section.startsWith('Activo')||r.section.startsWith('Pasivo'):group==='Patrimonio neto'?r.section==='Patrimonio neto':resultGroup(group)?resultGroup(r.section):false)}
export function suggestedStatementRubric(id:string,group:string){
 const known:Record<string,string>={'3.90.1':'eq-capital','3.90.2':'eq-capital-adjustment','3.90.3':'eq-irrevocable','3.90.4':'eq-premium','3.90.5':'eq-reserves','3.90.6':'eq-unassigned','3.90.7':'eq-deferred','4.90':'in-financial-income','5.90':'ex-financial-expenses','4.91':'in-financial-income','5.91':'ex-financial-expenses','1.1.1':'ac-cash','1.1.2':'ac-cash','1.1.3':'ac-customers','1.1.4':'ac-other-credits','1.1.5':'ac-other-credits','1.1.6':'ac-other-credits','1.1.7':'ac-other-credits','1.1.8':'ac-customers','1.2.1':'an-fixed','1.2.2':'an-fixed','1.2.3':'an-fixed','2.1.1':'pc-suppliers','2.1.2':'pc-tax','3.1':'eq-capital','3.2':'eq-unassigned','4.1':'in-sales','4.9':'in-other-income','4.10':'in-other-income','5.1':'ex-other-expenses','5.2':'ex-selling','5.3':'ex-financial-expenses','5.9':'ex-other-expenses','5.10':'ex-other-expenses','5.11':'ex-other-expenses'}
 return known[id]||({Activo:'ac-other-assets',Pasivo:'pc-other-debts','Patrimonio neto':'eq-unassigned',Ingresos:'in-other-income',Gastos:'ex-other-expenses'}[group]||'')
}
export const statementReview=(preview:StatementPreview)=>JSON.stringify(preview)
function previousYear(date:string){const [year,month,day]=date.split('-').map(Number),d=new Date(Date.UTC(year-1,month-1,day));if(d.getUTCMonth()!==month-1)d.setUTCDate(0);return d.toISOString().slice(0,10)}

export function previewStatements(state:State,input:StatementInput,frozenSource?:StatementSource):StatementPreview {
 accountingDate(input.from);accountingDate(input.to)
 const source=frozenSource?structuredClone(frozenSource):sourceFor(state,input.from,input.to),working=sourceState(state,source),balance=trialBalance(working,input.from,input.to)
 if(!exerciseRanges(state).some(r=>r.start===input.from&&input.to>=r.start&&input.to<=r.end))throw new Error('El expediente debe comenzar al inicio de un ejercicio conservado.')
 const reference=text(input.reference,'Referencia',200),reason=text(input.reason,'Fundamento de preparación'),cashBasis=text(input.cashBasis,'Criterio de efectivo y equivalentes')
 if(input.classificationConfirmed!==true||input.cashConfirmed!==true||input.nominalConfirmed!==true)throw new Error('Confirmá las clasificaciones revisadas, el alcance de efectivo y la base nominal pendiente de reexpresión.')
 if(!Array.isArray(input.notes)||input.notes.length>100||new Set(input.notes.map(n=>n.id)).size!==input.notes.length)throw new Error('Las notas deben tener identificadores únicos y hasta cien registros.')
 const notes=input.notes.map(n=>({id:text(n.id,'Identificación de nota',60),title:text(n.title,'Título de nota',200),body:text(n.body,'Contenido de nota',10000)})).sort((a,b)=>a.id.localeCompare(b.id)),noteIds=new Set(notes.map(n=>n.id))
 if(requiredStatementNotes.some(n=>!noteIds.has(n.id)))throw new Error('Completá las notas de entidad, criterios, patrimonio, efectivo y hechos posteriores.')
 const note=(id:string)=>{if(!noteIds.has(id))throw new Error('La referencia a nota no existe en el expediente.');return id}
 if(!Array.isArray(input.allocations)||new Set(input.allocations.map(a=>a.accountId)).size!==input.allocations.length)throw new Error('Asigná cada cuenta una sola vez, con su distribución completa.')
 const relevant=balance.rows.map(r=>({...r,amount:resultGroup(r.group)?r.closing-r.opening:r.closing})).filter(r=>r.amount||r.group==='Patrimonio neto'&&(r.opening||r.debit||r.credit))
 if(input.allocations.length!==relevant.length)throw new Error('Distribuí todas las cuentas con saldo o variación patrimonial; no agregues cuentas ajenas.')
 const rubricMap=new Map(statementRubrics.map(r=>[r.id,{...r,amount:0,noteIds:[] as string[],accounts:[] as {id:string;amount:number}[]}])),allocations:StatementInput['allocations']=[]
 const accountRubric=new Map<string,string>()
 for(const a of input.allocations){
  const r=relevant.find(r=>r.accountId===a.accountId),allowed=r&&allowedStatementRubrics(r.group)
  if(!r||!Array.isArray(a.items)||!a.items.length||new Set(a.items.map(p=>p.rubricId)).size!==a.items.length)throw new Error('La distribución contiene una cuenta o rubros inválidos o repetidos.')
  if(r.group==='Patrimonio neto'&&a.items.length!==1)throw new Error('Cada cuenta patrimonial debe conservar un componente único para conciliar su evolución; separá componentes en el diario.')
  if(a.items.some(p=>!Number.isSafeInteger(p.amount)||!allowed?.some(r=>r.id===p.rubricId)||p.amount&&Math.sign(p.amount)!==Math.sign(r.amount)||!p.amount&&r.amount!==0)||sum(a.items.map(p=>p.amount))!==r.amount)throw new Error('La distribución debe conservar el saldo deudor/acreedor completo, sin compensaciones inventadas.')
  const items=a.items.map(p=>({...p,noteId:note(p.noteId)})).sort((a,b)=>a.rubricId.localeCompare(b.rubricId));allocations.push({accountId:a.accountId,items})
  for(const p of items){const rub=rubricMap.get(p.rubricId)!;const value=(rub.section.startsWith('Activo')||rub.section==='Gastos'?1:-1)*p.amount;rub.amount=accountingSum(rub.amount,value);rub.accounts.push({id:r.accountId,amount:value});if(!rub.noteIds.includes(p.noteId))rub.noteIds.push(p.noteId)}
  if(r.group==='Patrimonio neto')accountRubric.set(r.accountId,items[0].rubricId)
 }
 for(const r of rubricMap.values()){r.accounts.sort((a,b)=>a.id.localeCompare(b.id));r.noteIds.sort()}
 allocations.sort((a,b)=>a.accountId.localeCompare(b.accountId))
 const values=[...rubricMap.values()],section=(name:Section)=>sum(values.filter(r=>r.section===name).map(r=>r.amount)),income=section('Ingresos'),expenses=section('Gastos'),profit=income-expenses,openingResults=sum(balance.rows.filter(r=>resultGroup(r.group)).map(r=>r.opening))
 if(balance.rows.some(r=>resultGroup(r.group)&&r.opening))throw new Error('Las cuentas de resultados tienen apertura pendiente de cierre; conciliá el ejercicio anterior antes de preparar estados.')
 const currentAssets=section('Activo corriente'),nonCurrentAssets=section('Activo no corriente'),assets=accountingSum(currentAssets,nonCurrentAssets),currentLiabilities=section('Pasivo corriente'),nonCurrentLiabilities=section('Pasivo no corriente'),liabilities=accountingSum(currentLiabilities,nonCurrentLiabilities),equity=accountingSum(section('Patrimonio neto'),profit)
 const position={rows:values.filter(r=>!resultGroup(r.section)&&r.section!=='Patrimonio neto'&&r.accounts.length),currentAssets,nonCurrentAssets,assets,currentLiabilities,nonCurrentLiabilities,liabilities,equity,difference:assets-liabilities-equity},results={rows:values.filter(r=>resultGroup(r.section)&&r.accounts.length),income,expenses,profit,openingResults}
 const components=statementRubrics.filter(r=>r.section==='Patrimonio neto'),equityRows:EquityRow[]=[],emptyValues=()=>Object.fromEntries(components.map(c=>[c.id,0])),openingValues=emptyValues()
 for(const r of relevant.filter(r=>r.group==='Patrimonio neto'))openingValues[accountRubric.get(r.accountId)!]=accountingSum(openingValues[accountRubric.get(r.accountId)!],-r.opening)
 equityRows.push({id:'opening',label:'Saldo inicial',noteId:'equity',reason:'Saldos contables anteriores al inicio del ejercicio',values:openingValues,total:sum(Object.values(openingValues))})
 const periodEntries=source.entries.filter(e=>e.date>=input.from),equitySources=periodEntries.filter(e=>e.lines.some(l=>source.accounts.find(a=>a.id===l.accountId)?.group==='Patrimonio neto'))
 if(!Array.isArray(input.equityEntries)||input.equityEntries.length!==equitySources.length||new Set(input.equityEntries.map(c=>c.entryId)).size!==input.equityEntries.length)throw new Error('Clasificá todas las variaciones patrimoniales del período, incluidas transferencias sin cambio total.')
 const equityEntries:StatementInput['equityEntries']=[]
 for(const e of equitySources){const c=input.equityEntries.find(c=>c.entryId===e.id);if(!c||!equityMovementCategories.includes(c.category as typeof equityMovementCategories[number]))throw new Error('Revisá el origen de cada variación patrimonial.');const normalized={...c,noteId:note(c.noteId),reason:text(c.reason,'Fundamento de variación patrimonial')};equityEntries.push(normalized);const vals=emptyValues();for(const l of e.lines)if(accountRubric.has(l.accountId)){const id=accountRubric.get(l.accountId)!;vals[id]=accountingSum(vals[id],l.credit-l.debit)}equityRows.push({id:e.id,label:`${c.category} · ${e.date} · ${e.concept}`,noteId:c.noteId,reason:normalized.reason,values:vals,total:sum(Object.values(vals))})}
 const resultValues=emptyValues();resultValues['eq-unassigned']=profit;equityRows.push({id:'result',label:'Resultado del período',noteId:'criteria',reason:'Resultado conciliado con el estado de resultados, antes de su asiento de cierre',values:resultValues,total:profit})
 const finalValues=emptyValues();for(const r of equityRows)for(const c of components)finalValues[c.id]=accountingSum(finalValues[c.id],r.values[c.id]);equityRows.push({id:'closing',label:'Saldo final',noteId:'equity',reason:'Saldos iniciales más variaciones y resultado del período',values:finalValues,total:sum(Object.values(finalValues))})
 if(!Array.isArray(input.cashAccounts)||!input.cashAccounts.length||new Set(input.cashAccounts).size!==input.cashAccounts.length||input.cashAccounts.some(id=>!state.masters.accounts.some(a=>a.id===id&&a.group==='Activo')))throw new Error('Seleccioná cuentas de activo distintas para el efectivo y equivalentes revisados.')
 const cashAccounts=[...input.cashAccounts].sort(),cashSet=new Set(cashAccounts),cashSources=periodEntries.flatMap(e=>e.lines.flatMap((l,lineIndex)=>cashSet.has(l.accountId)?[{entry:e,lineIndex,line:l}]:[])),cashRows:CashRow[]=[],cashLines:StatementInput['cashLines']=[]
 if(!Array.isArray(input.cashLines)||input.cashLines.length!==cashSources.length||new Set(input.cashLines.map(c=>`${c.entryId}:${c.lineIndex}`)).size!==input.cashLines.length)throw new Error('Clasificá cada línea de efectivo del período, sin omisiones ni duplicados.')
 for(const s of cashSources){const c=input.cashLines.find(c=>c.entryId===s.entry.id&&c.lineIndex===s.lineIndex),amount=s.line.debit-s.line.credit;if(!c||!Array.isArray(c.parts)||!c.parts.length||c.parts.some(p=>!Number.isSafeInteger(p.amount)||!p.amount||Math.sign(p.amount)!==Math.sign(amount))||sum(c.parts.map(p=>p.amount))!==amount)throw new Error('El reparto de efectivo debe conservar cada entrada o salida bruta, sin netear flujos ajenos.')
  const parts=c.parts.map(p=>{const category=cashFlowCategories.find(k=>k.id===p.category);if(!category||category.sign&&Math.sign(p.amount)!==category.sign)throw new Error('La categoría elegida no corresponde al sentido de cobro o pago.');const pureCash=s.entry.lines.every(l=>cashSet.has(l.accountId));if(pureCash&&category.id!=='transfer')throw new Error('Las transferencias internas comprenden sólo efectivo y equivalentes y no se presentan como cobros o pagos externos.');const part={...p,noteId:note(p.noteId),reason:text(p.reason,'Fundamento del flujo')};cashRows.push({entryId:s.entry.id,date:s.entry.date,concept:s.entry.concept,lineIndex:s.lineIndex,accountId:s.line.accountId,category:category.id,activity:category.activity,amount:p.amount,noteId:part.noteId,reason:part.reason});return part});cashLines.push({entryId:c.entryId,lineIndex:c.lineIndex,parts})
 }
 for(const e of periodEntries){const internal=cashRows.filter(r=>r.entryId===e.id&&r.category==='transfer');if(internal.length&&sum(internal.map(r=>r.amount)))throw new Error('Cada transferencia interna debe cancelar dentro de su propio asiento; dividí cargos y otros flujos externos sin compensar operaciones distintas.')}
 const opening=sum(balance.rows.filter(r=>cashSet.has(r.accountId)).map(r=>r.opening)),closing=sum(balance.rows.filter(r=>cashSet.has(r.accountId)).map(r=>r.closing)),variation=closing-opening,activities=['Operativas','Inversión','Financiación','Efectos sobre efectivo','Transferencias internas'],totals=activities.map(activity=>({activity,amount:sum(cashRows.filter(r=>r.activity===activity).map(r=>r.amount))}))
 if(totals.find(t=>t.activity==='Transferencias internas')!.amount)throw new Error('Las transferencias entre efectivo y equivalentes deben cancelar entre sí.')
 const cash={accountIds:cashAccounts,basis:cashBasis,opening,closing,variation,rows:cashRows,totals,difference:variation-sum(totals.map(t=>t.amount))}
 if(position.difference||cash.difference||equityRows.at(-1)!.total!==equity)throw new Error('Los estados no concilian situación, resultado, patrimonio y efectivo.')
 const priorRange=exerciseRanges(state).find(r=>r.end<input.from&&r.start===previousYear(input.from)),findPrior=(id:string)=>{if(typeof id!=='string')throw new Error('Revisá la identificación del comparativo.');const p=id&&(state.financialStatements||[]).find(r=>r.id===id);if(id&&!p)throw new Error('El expediente comparativo no existe.');return p||null},p=findPrior(input.priorPositionId),q=findPrior(input.priorPeriodId)
 if(p&&(!priorRange||p.from!==priorRange.start||p.to!==priorRange.end)||q&&(!priorRange||q.from!==priorRange.start||q.to!==previousYear(input.to)))throw new Error('El comparativo patrimonial debe ser el cierre anterior; los otros estados requieren el período equivalente previo.')
 if([p,q].some(c=>c&&c.preview.source.identity.cuit.replace(/[-\s]/g,'')!==source.identity.cuit.replace(/[-\s]/g,'')))throw new Error('Los comparativos deben corresponder a la misma entidad y CUIT del expediente.')
 const comparativeReason=!p||!q?text(input.comparativeReason,'Fundamento del comparativo pendiente'):typeof input.comparativeReason==='string'?input.comparativeReason.trim():''
 const comparative={position:p?{id:p.id,number:p.number,from:p.from,to:p.to,value:structuredClone(p.preview.position),notes:structuredClone(p.preview.notes)}:null,period:q?{id:q.id,number:q.number,from:q.from,to:q.to,results:structuredClone(q.preview.results),equity:structuredClone(q.preview.equity),cash:structuredClone(q.preview.cash),notes:structuredClone(q.preview.notes)}:null,reason:comparativeReason}
 const warnings=['Cifras nominales: pendiente reexpresión en moneda de cierre, incluidos comparativos, patrimonio y flujos.','Expediente de preparación: no acredita estados contables normativos emitidos ni certificación profesional.'];if(!p||!q)warnings.push('Información comparativa pendiente de incorporar o justificar conforme al caso de la entidad.');if(balance.rows.filter(r=>cashSet.has(r.accountId)).some(r=>r.opening<0||r.closing<0))warnings.push('Hay efectivo con saldo acreedor: revisar sobregiros, presentación y alcance.');if(cashRows.some(r=>r.category==='cash-effects'))warnings.push('Revisar los efectos sobre efectivo y su presentación separada, sin tratarlos como cobros o pagos.');
 return {from:input.from,to:input.to,reference,reason,basis:'Papel de trabajo nominal',source,position,results,equity:{components,rows:equityRows,opening:equityRows[0].total,closing:equityRows.at(-1)!.total,difference:equityRows.at(-1)!.total-equity},cash,notes,classifications:{allocations,cashLines,equityEntries},comparative,warnings}
}
export function preserveStatements(state:State,input:StatementInput,actor:Session):StatementRecord {
 if(!canAccess(actor,statementsPath))throw new Error('Sin permiso para preparar estados contables.')
 const preview=previewStatements(state,input);if(input.review!==statementReview(preview))throw new Error('La revisión de estados cambió; preparala nuevamente.')
 if(state.financialStatements?.some(r=>r.reference===preview.reference))throw new Error('La referencia del expediente ya existe.')
 const record:StatementRecord={...input,...preview.classifications,notes:preview.notes,reference:preview.reference,reason:preview.reason,cashBasis:preview.cash.basis,comparativeReason:preview.comparative.reason,id:uid(),number:`INT-EC-${String((state.financialStatements?.length||0)+1).padStart(8,'0')}`,responsible:actor.name,createdAt:new Date().toISOString(),preview};state.financialStatements=[...(state.financialStatements||[]),record];return record
}
export function validateStatements(state:State){
 const records=state.financialStatements??[];if(!Array.isArray(records)||state.financialStatements===null)throw new Error('Los expedientes de estados deben ser una lista.')
 const ids=new Set<string>(),references=new Set<string>()
 for(const [i,r]of records.entries()){
  if(typeof r.id!=='string'||!r.id||ids.has(r.id)||r.number!==`INT-EC-${String(i+1).padStart(8,'0')}`||references.has(r.reference)||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||!r.preview?.source)throw new Error('Constancia de preparación de estados inválida.')
  ids.add(r.id);references.add(r.reference);const source=r.preview.source
  if(!Array.isArray(source.entries)||!Array.isArray(source.accounts)||!source.identity||!Array.isArray(source.journalPrefixIds)||JSON.stringify(state.entries.slice(0,source.journalPrefixIds.length).map(e=>e.id))!==JSON.stringify(source.journalPrefixIds)||source.entries.some(e=>e.date>r.to||JSON.stringify(state.entries.find(s=>s.id===e.id))!==JSON.stringify(e))||source.accounts.some(a=>!state.masters.accounts.some(s=>s.id===a.id&&s.group===a.group)))throw new Error('No se conservaron las fuentes del expediente de estados.')
  validateLegalForm(source.identity.legalForm)
  const original=sourceFor({...state,entries:state.entries.slice(0,source.journalPrefixIds.length)},r.from,r.to)
  if(JSON.stringify(original.entries)!==JSON.stringify(source.entries)||JSON.stringify(original.accounts.map(a=>[a.id,a.group]))!==JSON.stringify(source.accounts.map(a=>[a.id,a.group])))throw new Error('El expediente no conserva todas las fuentes del diario disponibles al prepararlo.')
  const expected=previewStatements({...state,financialStatements:records.slice(0,i)},r,source)
  if(r.review!==statementReview(expected)||r.review!==statementReview(r.preview))throw new Error('Cambió la revisión, distribución, notas o conciliación de los estados.')
 }
}
export function statementOutdated(state:State,record:StatementRecord){const current=sourceFor(state,record.from,record.to),financial=({identity,accounts,entries}:StatementSource)=>({identity,accounts,entries});return JSON.stringify(financial(current))!==JSON.stringify(financial(record.preview.source))}
