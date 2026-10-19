import type {State,TaxIdentity,TaxPerson} from './types'
import {withholdingEvidenceIssue,validatePerceptionEvidence,taxIdentityIssues} from './tax-evidence'

export const taxMovementsPath='/reportes/retenciones-percepciones'
export interface TaxMovementRow {
 identitySource?:TaxIdentity['origin'];recordedCompany?:TaxPerson;identityIssues?:string[];
 id:string;date:string;branchId:string;branchName:string;source:string;sourceNumber:string;type:'Retención'|'Percepción';effect:'Sufrida'|'Practicada';
 partyKey:string;partyName:string;partyCuit:string;tax:string;jurisdiction:string;reference:string;amount:number;internal:boolean;status:string;
}
const declared='Referencia informada · sin constatación externa'
function identity(value:TaxIdentity|undefined){return value?{partyName:value.counterparty.name||'Agente sin identificar',partyCuit:value.counterparty.cuit,identitySource:value.origin,recordedCompany:structuredClone(value.company),identityIssues:taxIdentityIssues(value)}:{}}
function amount(value:number){if(!Number.isSafeInteger(value)||value<=0)throw new Error('El reporte encontró un importe impositivo inválido. Revisá el registro de origen.');return value}
export function taxMovementRows(state:State):TaxMovementRow[]{
 const rows:TaxMovementRow[]=[],branch=(id:string)=>String(state.masters.branches.find(b=>b.id===id)?.name||id)
 for(const d of state.documents){
  const p=state.parties.find(p=>p.id===d.partyId),context={date:d.date,branchId:d.branchId,branchName:branch(d.branchId),sourceNumber:d.number,partyKey:`party:${d.partyId}`,partyName:p?.name||'Contraparte sin identificar',partyCuit:p?.cuit||'',...identity(d.taxIdentity)}
  if(['cobro','pago'].includes(d.kind))for(const [index,w]of d.payments.entries())if(w.method==='Retención')rows.push({...context,id:`document:${d.id}:withholding:${index}`,source:d.kind==='cobro'?'Cobro':'Pago',type:'Retención',effect:d.kind==='cobro'?'Sufrida':'Practicada',tax:String(w.tax||'Sin identificar'),jurisdiction:String(w.jurisdiction||''),reference:String(w.reference||''),amount:amount(w.amount),internal:false,status:withholdingEvidenceIssue(w)||declared})
  if(['factura','credito','debito'].includes(d.kind)&&!d.accountOnly&&d.perceptions>0){let issue='';try{validatePerceptionEvidence(d)}catch(e){issue=(e as Error).message}
   rows.push({...context,id:`document:${d.id}:perception`,source:'Factura / nota',type:'Percepción',effect:d.side==='proveedor'?'Sufrida':'Practicada',tax:'Ingresos Brutos',jurisdiction:d.perceptionEvidence?.jurisdiction||'',reference:d.perceptionEvidence?.reference||'',amount:amount(d.perceptions)*(d.kind==='credito'?-1:1),internal:d.letter==='X',status:issue||(d.perceptionEvidence?declared:'Sin referencia estructurada · revisar origen')})
  }
 }
 for(const settlement of state.cardSettlements||[])for(const [index,w]of settlement.withholdings.entries()){
  const card=state.masters.cards.find(c=>c.id===settlement.cardId)
  rows.push({id:`settlement:${settlement.id}:withholding:${index}`,date:settlement.date,branchId:settlement.branchId,branchName:branch(settlement.branchId),source:'Liquidación de tarjeta',sourceNumber:settlement.reference,type:'Retención',effect:'Sufrida',partyKey:`card:${settlement.cardId}`,partyName:String(card?.name||settlement.cardId),partyCuit:'',...identity(w.taxIdentity),tax:String(w.tax||'Sin identificar'),jurisdiction:String(w.jurisdiction||''),reference:String(w.reference||''),amount:amount(w.amount),internal:false,status:withholdingEvidenceIssue(w)||declared})
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
}
export function summarizeTaxMovements(rows:TaxMovementRow[]){
 const totals={withheldSuffered:0,withheldPracticed:0,perceivedSuffered:0,perceivedPracticed:0},references=new Map<string,number>()
 function key(r:TaxMovementRow){return JSON.stringify([r.effect,r.identitySource?JSON.stringify([r.recordedCompany?.cuit,r.partyCuit||r.partyKey]):r.partyKey,r.tax,r.jurisdiction,r.reference.trim().normalize('NFC').toLocaleUpperCase('es')])}
 for(const r of rows){if(!Number.isSafeInteger(r.amount))throw new Error('Importe impositivo fuera de precisión segura.');const name=r.type==='Retención'?(r.effect==='Sufrida'?'withheldSuffered':'withheldPracticed'):(r.effect==='Sufrida'?'perceivedSuffered':'perceivedPracticed');totals[name]+=r.amount;if(!Number.isSafeInteger(totals[name]))throw new Error('El total impositivo excede la precisión segura.');if(r.type==='Retención'&&r.reference.trim()&&r.status===declared)references.set(key(r),(references.get(key(r))||0)+1)}
 const result=rows.map(r=>({...r,sharedReference:r.type==='Retención'?(references.get(key(r))||0):0}))
 return {totals,rows:result,pending:result.filter(r=>r.status!==declared||r.identityIssues?.length).length,shared:result.filter(r=>r.sharedReference>1).length}
}
