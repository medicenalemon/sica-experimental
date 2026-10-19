import type {Document,Payment,State} from './types'
import {paymentMethods,taxRates} from './constants'
import {totals} from './engine'
import {applicationAmount} from './account-applications'

type Input=Omit<Document,'id'|'number'|'net'|'vat'|'total'|'fiscalStatus'>&{total?:number}
const kinds=['factura','credito','debito','cobro','pago','pedido','remito','orden-compra','saldo']
const receipt=(d:Pick<Document,'kind'>)=>d.kind==='cobro'||d.kind==='pago'
const invoice=(d:Pick<Document,'kind'>)=>['factura','credito','debito'].includes(d.kind)
function calendar(day:unknown){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day}
function money(value:unknown,zero=false):asserts value is number{if(!Number.isSafeInteger(value)||(value as number)<(zero?0:1))throw new Error('El importe debe expresarse en centavos enteros seguros y positivos.')}
function sum(values:number[]){let total=0n;for(const value of values){if(!Number.isSafeInteger(value))throw new Error('Importe fuera de precisión segura.');total+=BigInt(value)}if(total>BigInt(Number.MAX_SAFE_INTEGER)||total<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('El total supera la precisión segura en centavos.');return Number(total)}
export function assertDocumentSide(d:Pick<Document,'kind'|'side'>){
 if(!d||!kinds.includes(d.kind)||!['cliente','proveedor'].includes(d.side))throw new Error('Tipo o cuenta de comprobante inválidos.')
 if(['cobro','pedido'].includes(d.kind)&&d.side!=='cliente'||['pago','orden-compra'].includes(d.kind)&&d.side!=='proveedor')throw new Error('Cobros y pedidos corresponden a clientes; pagos y órdenes de compra, a proveedores.')
}
export function normalizeDocumentPayments(payments:Payment[],kind:Document['kind']):Payment[]{
 if(!Array.isArray(payments))throw new Error('Las formas de pago deben ser una lista.')
 return payments.map(p=>{
  if(!p||!paymentMethods.includes(p.method))throw new Error('Forma de pago no reconocida.')
  if(typeof p.reference!=='string'||p.reference.length>200||Array.from(p.reference).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw new Error('Revisá la forma de pago y su referencia de hasta 200 caracteres.')
  money(p.amount)
  const result:Payment={method:p.method,amount:p.amount,treasuryId:typeof p.treasuryId==='string'?p.treasuryId:'',reference:p.reference.trim()}
  if(p.method==='Retención'){result.treasuryId='';result.tax=p.tax;result.jurisdiction=p.jurisdiction}
  else if(p.method==='Cheque'){result.treasuryId='';result.chequeId=p.chequeId}
  else if(kind==='cobro'&&['Tarjeta de crédito','Tarjeta de débito'].includes(p.method)){result.treasuryId='';result.cardId=p.cardId}
  return result
 })
}
function envelope(d:Input|Document){
 assertDocumentSide(d)
 if(!calendar(d.date)||typeof d.due!=='string'||d.due&&(!calendar(d.due)||d.due<d.date))throw new Error('La fecha y el vencimiento deben ser fechas calendario válidas; el vencimiento no puede ser anterior.')
 if(!['A','B','C','X'].includes(d.letter)||typeof d.sourceId!=='string'||!Array.isArray(d.lines)||!Array.isArray(d.payments)||!Array.isArray(d.allocations))throw new Error('Revisá clase, origen y listas del comprobante.')
 if(receipt(d)&&d.lines.length)throw new Error('Cobros y pagos no admiten líneas de artículos o servicios.')
 if(!receipt(d)&&d.payments.length)throw new Error('Las formas de cobro o pago se registran en su recibo u orden de pago, no en este comprobante.')
 if(!['credito','cobro','pago'].includes(d.kind)&&!(d.kind==='saldo'&&typeof d.total==='number'&&d.total<0)&&d.allocations.length)throw new Error('Sólo una nota de crédito, cobro, pago o saldo inicial negativo puede aplicar su importe a cargos existentes.')
 money(d.perceptions,true)
 if(!invoice(d)&&d.perceptions)throw new Error('Las percepciones sólo corresponden a facturas o notas.')
 if(d.kind==='saldo'&&(d.lines.length||d.sourceId))throw new Error('El saldo inicial no admite detalle ni documento de origen.')
 if(d.sourceId&&!['remito','factura','credito','debito'].includes(d.kind))throw new Error('Este tipo de comprobante no admite un documento de origen.')
}
export function assertDocumentInput(d:Input){
 envelope(d)
 for(const line of d.lines){if(!line||!Number.isFinite(line.quantity)||line.quantity<=0||!Number.isSafeInteger(line.price)||line.price<0||!Number.isFinite(line.discount)||line.discount<0||line.discount>100||!taxRates.includes(line.tax))throw new Error('Revisá cantidades positivas, precios en centavos, descuentos y alícuotas de las líneas.')}
 for(const a of d.allocations){if(!a||typeof a.documentId!=='string'||!a.documentId)throw new Error('Seleccioná el cargo al que se aplica el importe.');money(a.amount)}
}
export function assertDocumentSource(s:State,d:Input|Document){
 if(!d.sourceId){if(['credito','debito'].includes(d.kind)&&d.letter!=='X')throw new Error('La nota debe asociarse a una factura de la misma clase.');return}
 const source=s.documents.find(x=>x.id===d.sourceId)
 const expected=d.kind==='factura'?'remito':d.kind==='remito'?(d.side==='cliente'?'pedido':'orden-compra'):'factura'
 if(!source||source.kind!==expected||source.partyId!==d.partyId||source.side!==d.side||source.branchId!==d.branchId)throw new Error('El documento de origen debe ser del tipo esperado y de la misma contraparte y sucursal.')
 if(d.kind==='factura'&&(d.lines.length!==source.lines.length||d.lines.some(line=>!source.lines.some(original=>original.productId===line.productId&&original.quantity===line.quantity))))throw new Error('La factura debe conservar los productos y cantidades del remito.')
 if(['credito','debito'].includes(d.kind)&&d.letter!=='X'&&source.letter!==d.letter)throw new Error('La nota debe conservar la clase de la factura asociada.')
 if(['credito','debito','remito'].includes(d.kind)&&source.date>d.date)throw new Error('La nota o remito no puede preceder al documento de origen.')
}
export function assertAllocationTarget(d:Input|Document,target:Document|undefined){
 if(!target||!['factura','debito','saldo'].includes(target.kind)||target.total<=0||target.partyId!==d.partyId||target.side!==d.side||target.branchId!==d.branchId)throw new Error('La aplicación necesita un cargo positivo de la misma contraparte, cuenta y sucursal.')
 if(target.date>d.date)throw new Error('La aplicación no puede preceder a la fecha del cargo. Conservá el anticipo sin aplicar y vinculalo después.')
}
function derived(s:State,d:Document){
 if(s.masters.commissions.some(c=>c.name===d.number&&c.sellerId===d.partyId&&c.branchId===d.branchId&&c.amount===d.total&&s.documents.some(r=>r.id===c.receiptId&&r.kind==='cobro'&&r.date===d.date)))return d.kind==='debito'&&d.side==='proveedor'&&d.letter==='X'
 return d.accountOnly===true&&d.kind==='debito'&&d.letter==='X'&&s.cheques.some(c=>c.amount===d.total&&c.branchId===d.branchId&&(
  d.number===`INT-ND-X-CH-${c.number}`&&s.documents.some(r=>r.id===c.receiptId&&r.partyId===d.partyId&&r.side===d.side&&r.payments.some(p=>p.method==='Cheque'&&p.chequeId===c.id))||
  d.number===`INT-ND-X-CH-PROV-${c.number}`&&s.documents.some(r=>r.id===c.paymentId&&r.partyId===d.partyId&&r.side===d.side&&r.payments.some(p=>p.method==='Cheque'&&p.chequeId===c.id))
 ))
}
export function validateCommercialDocuments(s:State){
 const destinations=new Map<string,number[]>()
 for(const d of s.documents){
  envelope(d)
  const p=s.parties.find(p=>p.id===d.partyId)
  if(p?.side!==d.side)throw new Error('La cuenta del comprobante no corresponde al cliente o proveedor conservado.')
  assertDocumentSource(s,d)
  if(invoice(d)&&d.total<=0)throw new Error('El total de la factura o nota debe ser positivo.')
  if(d.accountOnly&&!derived(s,d))throw new Error('La marca de cuenta interna sólo corresponde a un rechazo de cheque conservado.')
  if(new Set(d.lines.map(l=>l.productId)).size!==d.lines.length)throw new Error('Agrupá cada artículo en una sola línea del comprobante.')
  if(new Set(d.allocations.map(a=>a.documentId)).size!==d.allocations.length)throw new Error('La aplicación contiene destinos repetidos.')
  for(const a of d.allocations){money(a.amount,true);assertAllocationTarget(d,s.documents.find(t=>t.id===a.documentId));const amounts=destinations.get(a.documentId)||[];amounts.push(a.amount);destinations.set(a.documentId,amounts)}
  if(sum(d.allocations.map(a=>a.amount))>Math.abs(d.total))throw new Error('Las aplicaciones superan el importe del crédito, cobro o pago.')
  if(receipt(d)){
   if(!d.payments.length)throw new Error('El cobro o pago debe conservar sus medios.')
   for(const payment of d.payments){money(payment.amount);if(!paymentMethods.includes(payment.method))throw new Error('Forma de pago conservada inválida.')}
   if(sum(d.payments.map(p=>p.amount))!==d.total||d.net!==d.total||d.vat!==0||d.perceptions!==0)throw new Error('El total del cobro o pago no coincide con sus medios.')
  }else if(d.kind==='saldo'){
   if(!d.total||d.net!==d.total||d.vat!==0||d.perceptions!==0)throw new Error('Los importes del saldo inicial no concilian.')
  }else if(!d.lines.length){
   if(!derived(s,d)||d.net!==d.total||d.vat!==0||d.perceptions!==0||d.total<=0||d.sourceId)throw new Error('Un comprobante sin detalle debe corresponder a una comisión o rechazo de cheque conservado.')
  }else{
   for(const line of d.lines)if(!Number.isFinite(line.quantity)||line.quantity<=0||!Number.isSafeInteger(line.price)||line.price<0||!Number.isFinite(line.discount)||line.discount<0||line.discount>100||!taxRates.includes(line.tax))throw new Error('Detalle de comprobante inválido.')
   const calculated=totals(d.lines,d.letter,d.perceptions)
   if(![calculated.net,calculated.vat,calculated.total].every(Number.isSafeInteger)||calculated.net!==d.net||calculated.vat!==d.vat||calculated.total!==d.total)throw new Error('Los importes del comprobante no concilian con sus líneas, IVA y percepciones.')
  }
 }
 for(const [id,amounts]of destinations){const target=s.documents.find(d=>d.id===id)!;const available=BigInt(target.total)-amounts.reduce((n,a)=>n+BigInt(a),0n)-BigInt(applicationAmount(s,id,'target'));if(available<0n)throw new Error('Las aplicaciones originales y posteriores superan el cargo conservado.')}
}
