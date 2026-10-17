import type { State, Document } from './types'
import { lineTotals, suggestedLetter, validCuit } from './engine'
import { provinces } from './constants'
import { issuerRegistration } from './fiscal-registration'

export type FiscalEnvironment='homologacion'|'produccion'
export interface FiscalConnection {configured:boolean;environment:FiscalEnvironment;productionEnabled:boolean;simulated?:true}
export interface FiscalOptions { saleTerms?:string;serviceFrom?:string; serviceTo?:string; perception?:{base:number;rate:number;jurisdiction:string;reference:string}; nationalIndirect?:{amount:number;reference:string} }
export interface FiscalReference { point:number;type:number;number:number;issuer:string;date:string;receiver:string }
export interface FiscalRequest {
 environment?:FiscalEnvironment;reviewRevision?:number; issuer:string; point:number; type:number; letter:Document['letter']; documentId:string;
 detail:{Concepto:number;DocTipo:number;DocNro:string;CbteDesde?:number;CbteHasta?:number;CbteFch:string;ImpTotal:number;ImpTotConc:number;ImpNeto:number;ImpOpEx:number;ImpTrib:number;ImpIVA:number;MonId:string;MonCotiz:number;CondicionIVAReceptorId:number;FchServDesde?:string;FchServHasta?:string;FchVtoPago?:string};
 iva:{Id:number;BaseImp:number;Importe:number}[];
 tributes:{Id:number;Desc:string;BaseImp:number;Alic:number;Importe:number}[];
 associated:{Tipo:number;PtoVta:number;Nro:number;Cuit:string;CbteFch:string}[];
 snapshot:{saleTerms?:string;issuer:{name:string;cuit:string;address:string;iva:string;iibbRegistration?:string;activityStart?:string};receiver:{name:string;cuit:string;address:string;iva:string};lines:Document['lines'];branchName:string;nationalIndirect?:{amount:number;reference:string}};
}
export interface FiscalRecord {environment:FiscalEnvironment;simulated?:true;state:'enviando'|'incierto'|'aprobado'|'rechazado'|'conflicto';point:number;type:number;number:number;cae?:string;expires?:string;messages:string[];updated:string;options?:FiscalOptions}
const ivaIds:Record<string,number>={'0':3,'10.5':4,'21':5,'27':6,'5':8,'2.5':9}
const conditions:Record<string,number>={'Responsable Inscripto':1,'Exento':4,'Consumidor Final':5,'Responsable Monotributo':6,'Liberado (Tierra del Fuego)':10}
const types:Record<string,number>={'factura-A':1,'debito-A':2,'credito-A':3,'factura-B':6,'debito-B':7,'credito-B':8,'factura-C':11,'debito-C':12,'credito-C':13}
const compact=(date:string)=>date.replaceAll('-','')
function validDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date}
export function buildFiscalRequest(state:State,documentId:string,options:FiscalOptions={},associated?:FiscalReference):FiscalRequest {
 const d=state.documents.find(d=>d.id===documentId),issuer=state.settings.cuit.replace(/[-\s]/g,'')
 if(!d||d.side!=='cliente'||!['factura','debito','credito'].includes(d.kind)||d.letter==='X'||d.accountOnly)throw new Error('Sólo facturas y notas A, B o C de venta admiten autorización WSFE.')
 if(!validCuit(issuer))throw new Error('Configurá el CUIT válido del emisor antes de preparar una solicitud ARCA.')
 const p=state.parties.find(p=>p.id===d.partyId),b=state.masters.branches.find(b=>b.id===d.branchId&&b.active)
 if(!p||!validCuit(p.cuit)||!b||!/^\d{1,5}$/.test(String(b.point))||Number(b.point)<1)throw new Error('Verificá cliente, CUIT y punto de venta activo.')
 if(d.letter!==suggestedLetter(state.settings.iva,p.iva)||!Object.hasOwn(conditions,p.iva)||!['Responsable Inscripto','Responsable Monotributo','Exento'].includes(state.settings.iva))throw new Error('La combinación de condiciones fiscales no admite esta clase de comprobante.')
 if(!validDate(d.date)||!Number.isSafeInteger(d.total)||d.total<=0||d.total>999999999999999)throw new Error('Fecha o importe del comprobante inválidos.')
 const registration=issuerRegistration(state.settings,b,d.date)
 const kinds=d.lines.map(l=>state.products.find(p=>p.id===l.productId)?.kind)
 if(!kinds.length||kinds.some(k=>!['Producto','Servicio'].includes(k||'')))throw new Error('El detalle requiere artículos y servicios identificados.')
 const concept=kinds.every(k=>k==='Producto')?1:kinds.every(k=>k==='Servicio')?2:3
 const detail:FiscalRequest['detail']={Concepto:concept,DocTipo:80,DocNro:p.cuit.replace(/[-\s]/g,''),CbteFch:compact(d.date),ImpTotal:d.total,ImpTotConc:0,ImpNeto:0,ImpOpEx:0,ImpTrib:d.perceptions,ImpIVA:0,MonId:'PES',MonCotiz:1,CondicionIVAReceptorId:conditions[p.iva]}
 if(concept!==1){const from=options.serviceFrom||'',to=options.serviceTo||'';if(!validDate(from)||!validDate(to)||to<from||!validDate(d.due)||d.due<d.date)throw new Error('Servicios: indicá período de prestación y vencimiento válidos.');detail.FchServDesde=compact(from);detail.FchServHasta=compact(to);detail.FchVtoPago=compact(d.due)}
 const grouped=new Map<string,{Id:number;BaseImp:number;Importe:number}>()
 for(const l of d.lines){const t=lineTotals(l,d.letter);if(d.letter==='C')detail.ImpNeto+=t.total;else if(l.tax==='Exento')detail.ImpOpEx+=t.net;else if(l.tax==='No gravado')detail.ImpTotConc+=t.net;else{if(!Object.hasOwn(ivaIds,l.tax))throw new Error('Alícuota sin correspondencia WSFE.');detail.ImpNeto+=t.net;detail.ImpIVA+=t.vat;const item=grouped.get(l.tax)||{Id:ivaIds[l.tax],BaseImp:0,Importe:0};item.BaseImp+=t.net;item.Importe+=t.vat;grouped.set(l.tax,item)}}
 const tributes:FiscalRequest['tributes']=[]
 if(d.perceptions){const t=options.perception;if(!t||!Number.isSafeInteger(t.base)||t.base<=0||!Number.isFinite(t.rate)||t.rate<=0||t.rate>100||Math.round(t.base*t.rate/100)!==d.perceptions||!provinces.includes(t.jurisdiction)||!t.reference.trim())throw new Error('La percepción requiere base, alícuota, jurisdicción y referencia; su cálculo debe coincidir con el importe registrado.');tributes.push({Id:2,Desc:`Percepción IIBB ${t.jurisdiction} · ${t.reference}`.slice(0,80),BaseImp:t.base,Alic:t.rate,Importe:d.perceptions})}
 if(detail.ImpTotal!==detail.ImpNeto+detail.ImpTotConc+detail.ImpOpEx+detail.ImpIVA+detail.ImpTrib||d.vat!==detail.ImpIVA)throw new Error('Los importes del comprobante no concilian con su detalle fiscal.')
 const related:FiscalRequest['associated']=[]
 if(d.kind!=='factura'){const source=state.documents.find(s=>s.id===d.sourceId);if(!source||source.kind!=='factura'||source.letter!==d.letter||source.partyId!==d.partyId||!associated||associated.issuer!==issuer||associated.type!==types['factura-'+d.letter]||associated.receiver!==detail.DocNro)throw new Error('La nota requiere una factura asociada autorizada en el mismo ambiente y emisor.');related.push({Tipo:associated.type,PtoVta:associated.point,Nro:associated.number,Cuit:issuer,CbteFch:compact(associated.date)})}
 const saleTerms=options.saleTerms
 if(saleTerms!==undefined&&(typeof saleTerms!=='string'||!saleTerms.trim()||saleTerms.trim().length>200))throw new Error('La condición de venta debe ser un texto de hasta 200 caracteres.')
 const nationalIndirect=options.nationalIndirect
 if(nationalIndirect!==undefined&&(!nationalIndirect||d.letter!=='B'||!Number.isSafeInteger(nationalIndirect.amount)||nationalIndirect.amount<0||nationalIndirect.amount>d.total-detail.ImpIVA-detail.ImpTrib||typeof nationalIndirect.reference!=='string'||!nationalIndirect.reference.trim()||nationalIndirect.reference.length>200))throw new Error('La declaración de impuestos nacionales indirectos requiere importe contenido no negativo y referencia; sólo se aplica a comprobantes B.')
 return {issuer,point:Number(b.point),type:types[d.kind+'-'+d.letter],letter:d.letter,documentId,detail,iva:[...grouped.values()],tributes,associated:related,snapshot:{...(saleTerms?{saleTerms:saleTerms.trim()}:{}),issuer:{name:state.settings.name,cuit:issuer,...registration,iva:state.settings.iva},receiver:{name:p.name,cuit:detail.DocNro,address:p.address,iva:p.iva},lines:structuredClone(d.lines),branchName:String(b.name),...(nationalIndirect?{nationalIndirect:{amount:nationalIndirect.amount,reference:nationalIndirect.reference.trim()}}:{})}}
}
export function numberedRequest(request:FiscalRequest,number:number):FiscalRequest {if(!Number.isSafeInteger(number)||number<1||number>99999999)throw new Error('Número fiscal fuera de rango.');return {...request,detail:{...request.detail,CbteDesde:number,CbteHasta:number}}}

export function fiscalRecordLabel(record?:FiscalRecord){if(!record)return 'Sin CAE · registro de trabajo';if(record.state==='aprobado')return record.environment==='produccion'?(record.simulated?'CAE simulado · sin validez fiscal':'CAE de producción'):'CAE de homologación · prueba';return ({enviando:'ARCA: solicitud en curso',incierto:'ARCA: resultado sin confirmar',rechazado:'ARCA: solicitud rechazada',conflicto:'ARCA: requiere revisión'} as const)[record.state]}
