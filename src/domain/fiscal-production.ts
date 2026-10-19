import type {FiscalRequest} from './fiscal'
import {registrationDate,registrationText} from './fiscal-registration'
export const monotributoCreditLegend='El crédito fiscal discriminado en el presente comprobante, sólo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618.'
export function fiscalLegends(request:FiscalRequest){return request.detail.CbteFch>='20210701'&&request.letter==='A'&&request.snapshot.receiver.iva==='Responsable Monotributo'?[monotributoCreditLegend]:[]}
function printableText(value:unknown,label:string,max:number){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${label}: completá hasta ${max} caracteres antes de emitir en producción.`);if(Array.from(value.normalize('NFC').replace(/[–—]/g,'-')).some(c=>c.charCodeAt(0)>255||c<' '||c.charCodeAt(0)>=127&&c.charCodeAt(0)<160))throw new Error(`${label}: la representación PDF actual requiere una sola línea con caracteres de su tipografía latina. Revisá el texto antes de emitir.`)}
export function assertProductionRequest(request:FiscalRequest){
 const issuer=request.snapshot.issuer,receiver=request.snapshot.receiver,emission=`${request.detail.CbteFch.slice(0,4)}-${request.detail.CbteFch.slice(4,6)}-${request.detail.CbteFch.slice(6,8)}`
 printableText(issuer.name,'Denominación del emisor',300);printableText(issuer.address,'Domicilio comercial del emisor',500);printableText(receiver.name,'Denominación del receptor',300);printableText(receiver.address,'Domicilio del receptor',500)
 if(!registrationText(issuer.iibbRegistration)||!registrationDate(issuer.activityStart)||(issuer.activityStart||'')>emission)throw new Error('Producción requiere inscripción o condición de Ingresos Brutos e inicio de actividades conservados, no posterior a la emisión.')
 printableText(request.snapshot.saleTerms,'Condición de venta',200)
 printableText(issuer.iibbRegistration,'Inscripción o condición de Ingresos Brutos',120)
 if(request.letter==='B'&&!request.snapshot.nationalIndirect)throw new Error('Producción B requiere declarar los otros impuestos nacionales indirectos contenidos, incluso importe cero con su referencia.')
 for(const line of request.snapshot.lines){printableText(line.description,'Descripción de línea',1000);printableText(line.unit,'Unidad de línea',80)}
}
