import type {Document,Payment,State} from './types'
import {sumMoney} from './treasury-model'

interface Identity {name:string;cuit:string;iva:string;address:string;province:string}
interface ReceiptPayment {payment:Payment;treasury?:{id:string;name:string;type:string};card?:{id:string;name:string};cheque?:{id:string;number:string;type:string;holder:string;issued:string;due:string;bankId:string;bankName:string;amount:number}}
export interface ReceiptSnapshot {
 version:1;
 document:Pick<Document,'id'|'number'|'kind'|'side'|'letter'|'date'|'partyId'|'branchId'|'total'|'responsible'|'observations'>;
 company:Identity&{legalForm:string};party:Identity&{id:string;code:string};branch:{id:string;name:string;point:string;address:string};
 payments:ReceiptPayment[];
 allocations:{documentId:string;number:string;date:string;kind:string;total:number;amount:number}[];
 totals:{total:number;cashMethods:number;cheques:number;cards:number;withheld:number;applied:number;unapplied:number};
}
export interface ReceiptPrintModel extends ReceiptSnapshot {provenance:'Datos conservados al registrar'|'Catálogo actual - histórico sin datos de impresión conservados';warnings:string[]}
const isReceipt=(d:Document)=>d.kind==='cobro'||d.kind==='pago'
const cardMethod=(p:Payment)=>p.method==='Tarjeta de crédito'||p.method==='Tarjeta de débito'
const value=(v:unknown)=>String(v??'').trim()
const day=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v
function header(d:Document):ReceiptSnapshot['document'] {return {id:d.id,number:d.number,kind:d.kind,side:d.side,letter:d.letter,date:d.date,partyId:d.partyId,branchId:d.branchId,total:d.total,responsible:d.responsible,observations:d.observations}}
function canonical(v:unknown):string {return JSON.stringify(v,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b))):item)}
function text(v:unknown,multiline=false){if(typeof v!=='string'||Array.from(v).some(c=>c.charCodeAt(0)<32&&!(multiline&&['\n','\r','\t'].includes(c))||c.charCodeAt(0)===127))throw new Error('Los datos de impresión contienen texto inválido.');}
function keys(v:unknown,required:string[],optional:string[]=[]):asserts v is Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||required.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>![...required,...optional].includes(k)))throw new Error('Estructura de datos de impresión inválida.')}
function identity(v:unknown,extra:string[]){keys(v,['name','cuit','iva','address','province',...extra]);Object.values(v).forEach(x=>text(x))}
function calculated(d:Document):ReceiptSnapshot['totals']{
 const withheld=sumMoney(d.payments.filter(p=>p.method==='Retención').map(p=>p.amount)),cheques=sumMoney(d.payments.filter(p=>p.method==='Cheque').map(p=>p.amount)),cards=sumMoney(d.payments.filter(p=>d.kind==='cobro'&&cardMethod(p)).map(p=>p.amount)),applied=sumMoney(d.allocations.map(a=>a.amount))
 return {total:d.total,cashMethods:d.total-withheld-cheques-cards,cheques,cards,withheld,applied,unapplied:d.total-applied}
}
export function captureReceiptSnapshot(s:State,d:Document):ReceiptSnapshot{
 if(!isReceipt(d))throw new Error('La constancia de medios y aplicaciones corresponde a un cobro o pago.')
 text(d.responsible);text(d.observations,true)
 const p=s.parties.find(p=>p.id===d.partyId),b=s.masters.branches.find(b=>b.id===d.branchId)
 const result:ReceiptSnapshot={version:1,document:header(d),company:{name:value(s.settings.name),cuit:value(s.settings.cuit),iva:value(s.settings.iva),address:value(s.settings.address),province:value(s.settings.province),legalForm:value(s.settings.legalForm)},party:{id:d.partyId,code:value(p?.code),name:value(p?.name),cuit:value(p?.cuit),iva:value(p?.iva),address:value(p?.address),province:value(p?.province)},branch:{id:d.branchId,name:value(b?.name),point:value(b?.point),address:value(b?.address)},payments:d.payments.map(payment=>{
  const row:ReceiptPayment={payment:structuredClone(payment)}
  if(payment.method==='Cheque'){
   const c=s.cheques.find(c=>c.id===payment.chequeId)
   if(!c)throw new Error('No se dispone del cheque para conservar sus datos de impresión.')
   row.cheque={id:c.id,number:c.number,type:c.type,holder:c.holder,issued:c.issued,due:c.due,bankId:c.bank,bankName:value(s.masters.banks.find(b=>b.id===c.bank)?.name)||c.bank,amount:c.amount}
  }else if(d.kind==='cobro'&&cardMethod(payment)&&payment.cardId){row.card={id:payment.cardId,name:value(s.masters.cards.find(c=>c.id===payment.cardId)?.name)}}
  else if(payment.method!=='Retención'&&payment.treasuryId){const t=s.masters.treasury.find(t=>t.id===payment.treasuryId);row.treasury={id:payment.treasuryId,name:value(t?.name),type:value(t?.type)}}
  return row
 }),allocations:d.allocations.map(a=>{const target=s.documents.find(t=>t.id===a.documentId);if(!target)throw new Error('Falta un cargo de la aplicación original.');return {documentId:target.id,number:target.number,date:target.date,kind:target.kind,total:target.total,amount:a.amount}}),totals:calculated(d)}
 validateReceiptSnapshot(s,{...d,receiptSnapshot:result});return structuredClone(result)
}
export function validateReceiptSnapshot(s:State,d:Document){
 const r=d.receiptSnapshot;if(r===undefined)return
 if(!isReceipt(d))throw new Error('Los datos de impresión de cobro/pago no corresponden al comprobante.')
 keys(r,['version','document','company','party','branch','payments','allocations','totals']);if(r.version!==1)throw new Error('Versión de datos de impresión no admitida.')
 if(canonical(r.document)!==canonical(header(d)))throw new Error('Los datos de impresión no coinciden con el comprobante conservado.')
 text(r.document.responsible);text(r.document.observations,true)
 identity(r.company,['legalForm']);identity(r.party,['id','code']);keys(r.branch,['id','name','point','address']);Object.values(r.branch).forEach(x=>text(x))
 if(r.party.id!==d.partyId||r.branch.id!==d.branchId)throw new Error('Contraparte o sucursal de impresión inválida.')
 if(!Array.isArray(r.payments)||r.payments.length!==d.payments.length||!Array.isArray(r.allocations)||r.allocations.length!==d.allocations.length)throw new Error('Los medios y aplicaciones de impresión no corresponden al original.')
 r.payments.forEach((row,i)=>{
  keys(row,['payment'],['treasury','card','cheque']);if(canonical(row.payment)!==canonical(d.payments[i]))throw new Error('El medio de pago impreso difiere del original.')
  const p=d.payments[i]
  if(row.cheque!==undefined){keys(row.cheque,['id','number','type','holder','issued','due','bankId','bankName','amount']);for(const [k,v]of Object.entries(row.cheque))if(k!=='amount')text(v);if(p.method!=='Cheque'||row.cheque.id!==p.chequeId||row.cheque.amount!==p.amount||!day(row.cheque.issued)||!day(row.cheque.due)||row.cheque.due<row.cheque.issued)throw new Error('El cheque impreso no corresponde al medio original.')}
  if(row.card!==undefined){keys(row.card,['id','name']);text(row.card.id);text(row.card.name);if(d.kind!=='cobro'||!cardMethod(p)||row.card.id!==p.cardId||p.cardDue&&!day(p.cardDue))throw new Error('La tarjeta impresa no corresponde al cupón original.')}
  if(row.treasury!==undefined){keys(row.treasury,['id','name','type']);Object.values(row.treasury).forEach(v=>text(v));if(p.method==='Retención'||p.method==='Cheque'||d.kind==='cobro'&&cardMethod(p)&&p.cardId||row.treasury.id!==p.treasuryId)throw new Error('La cuenta impresa no corresponde al medio original.')}
  if(p.method==='Cheque'&&!row.cheque||d.kind==='cobro'&&cardMethod(p)&&p.cardId&&!row.card||p.method!=='Retención'&&p.method!=='Cheque'&&!(d.kind==='cobro'&&cardMethod(p)&&p.cardId)&&p.treasuryId&&!row.treasury)throw new Error('Faltan datos conservados de un medio de pago.')
 })
 for(const [i,a]of r.allocations.entries()){
  keys(a,['documentId','number','date','kind','total','amount']);const original=d.allocations[i],target=s.documents.find(t=>t.id===original.documentId)
  if(!target||canonical(a)!==canonical({documentId:target.id,number:target.number,date:target.date,kind:target.kind,total:target.total,amount:original.amount}))throw new Error('El cargo impreso no coincide con la aplicación original conservada.')
 }
 if(canonical(r.totals)!==canonical(calculated(d)))throw new Error('Los totales de impresión no concilian con medios y aplicaciones.')
 if(d.taxIdentity){const compact=(v:string)=>v.replace(/[-\s]/g,'');if(d.taxIdentity.company.name!==r.company.name||d.taxIdentity.counterparty.name!==r.party.name||compact(d.taxIdentity.company.cuit)!==compact(r.company.cuit)||compact(d.taxIdentity.counterparty.cuit)!==compact(r.party.cuit))throw new Error('La identidad impositiva y los datos de impresión del origen difieren.')}
}
export function receiptPrintModel(s:State,documentId:string):ReceiptPrintModel{
 const d=s.documents.find(d=>d.id===documentId)
 if(!d||!isReceipt(d))throw new Error('Seleccioná un recibo de cobro u orden de pago conservado.')
 const original=d.receiptSnapshot!==undefined
 if(original)validateReceiptSnapshot(s,d)
 const snapshot=structuredClone(d.receiptSnapshot||captureReceiptSnapshot(s,{...d,taxIdentity:undefined}))
 const warnings=['Constancia de gestión interna en ARS. No es factura ni certificado impositivo y no acredita autorización fiscal.','Registra medios y aplicaciones originales; no prueba ejecución de pagos, cobro de cheques ni acreditación de tarjetas.','Las aplicaciones y liberaciones posteriores se consultan en la cuenta corriente; no reescriben esta distribución.']
 if(!original)warnings.push('Histórico sin datos completos de impresión conservados: los nombres, domicilios y datos auxiliares corresponden al catálogo actual, no al momento original.')
 if(!snapshot.company.cuit||!snapshot.party.cuit)warnings.push('Hay CUIT no informados en los datos de esta constancia.')
 return {...snapshot,provenance:original?'Datos conservados al registrar':'Catálogo actual - histórico sin datos de impresión conservados',warnings}
}

export function assertReceiptSnapshotContinuity(current:State,next:State){
 for(const d of current.documents){if(d.receiptSnapshot===undefined)continue;const retained=next.documents.find(n=>n.id===d.id);if(retained&&canonical(retained.receiptSnapshot)!==canonical(d.receiptSnapshot))throw new Error('La restauración no puede quitar ni reescribir los datos de impresión originales de un cobro o pago que conserva. Elegí una copia con su contexto original.')}
}
