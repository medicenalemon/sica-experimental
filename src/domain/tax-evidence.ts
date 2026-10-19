import type {Document,Payment,State,TaxIdentity,TaxPerson} from './types'
import {provinces,taxTypes} from './constants'
import {validCuit} from './engine'

function identityText(value:unknown,max:number,required=false){if(typeof value!=='string'||value!==value.trim()||value.length>max||required&&!value||Array.from(value).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw new Error('Revisá los datos de identidad impositiva conservada.');return value}
function person(value:TaxPerson){if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='cuit,name')throw new Error('Identidad impositiva inválida.');identityText(value.name,300);identityText(value.cuit,30);if(value.cuit!==value.cuit.replace(/[-\s]/g,''))throw new Error('El CUIT conservado debe estar normalizado.')}
const catalogPerson=(name:string,cuit:string):TaxPerson=>({name:String(name||'').trim(),cuit:String(cuit||'').replace(/[-\s]/g,'')})
export function documentTaxIdentity(s:State,partyId:string):TaxIdentity{const p=s.parties.find(p=>p.id===partyId)!;const result:TaxIdentity={version:1,origin:'Catálogo al registrar',company:catalogPerson(s.settings.name,s.settings.cuit),counterparty:catalogPerson(p.name,p.cuit),unknownReason:''};validateTaxIdentity(result);return result}
export function cardTaxIdentity(s:State,p:Payment):TaxIdentity{
 if(p.agentUnknownReason!==undefined&&typeof p.agentUnknownReason!=='string')throw new Error('El motivo de agente pendiente debe ser texto.')
 const reason=typeof p.agentUnknownReason==='string'?p.agentUnknownReason.trim():p.agentUnknownReason
 let counterparty:TaxPerson,origin:TaxIdentity['origin']
 if(p.agent!==undefined){
  if(reason)throw new Error('Elegí identificar al agente o explicar por qué no se identifica, sin combinar ambas opciones.')
  if(!p.agent||typeof p.agent.name!=='string'||typeof p.agent.cuit!=='string')throw new Error('Indicá nombre y CUIT del agente según el certificado de la liquidación.')
  counterparty=catalogPerson(p.agent.name,p.agent.cuit);person(counterparty)
  if(!counterparty.name||!validCuit(counterparty.cuit))throw new Error('Indicá nombre y CUIT válido del agente según el certificado de la liquidación.')
  if(validCuit(s.settings.cuit)&&counterparty.cuit===s.settings.cuit.replace(/[-\s]/g,''))throw new Error('El agente de la retención sufrida debe tener un CUIT diferente del sujeto.')
  origin='Agente declarado en liquidación'
 }else{
  identityText(reason,1000,true);counterparty={name:'',cuit:''};origin='Agente sin identificar'
 }
 const result:TaxIdentity={version:1,origin,company:catalogPerson(s.settings.name,s.settings.cuit),counterparty,unknownReason:reason||''};validateTaxIdentity(result);return result
}
export function validateTaxIdentity(value:TaxIdentity){
 if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='company,counterparty,origin,unknownReason,version'||value.version!==1||!['Catálogo al registrar','Agente declarado en liquidación','Agente sin identificar'].includes(value.origin))throw new Error('Identidad impositiva conservada inválida.')
 person(value.company);person(value.counterparty);identityText(value.unknownReason,1000)
 if(value.origin==='Agente sin identificar'){if(value.counterparty.name||value.counterparty.cuit||!value.unknownReason)throw new Error('La identidad pendiente necesita un motivo y no presume un agente.')}
 else if(value.unknownReason)throw new Error('La identidad identificada no admite motivo de agente pendiente.')
 if(value.origin==='Agente declarado en liquidación'&&(!value.counterparty.name||!validCuit(value.counterparty.cuit)||value.counterparty.cuit===value.company.cuit))throw new Error('La liquidación necesita la identidad declarada del agente distinta del sujeto.')
}
export function taxIdentityIssues(value:TaxIdentity){validateTaxIdentity(value);const issues:string[]=[];if(!value.company.name||!validCuit(value.company.cuit))issues.push('Identidad de la empresa incompleta al registrar');if(!value.counterparty.name||!validCuit(value.counterparty.cuit))issues.push('Identidad de contraparte incompleta al registrar');if(value.origin==='Agente sin identificar')issues.push(`Agente no identificado: ${value.unknownReason}`);if(value.company.cuit&&value.company.cuit===value.counterparty.cuit)issues.push('CUIT de empresa y contraparte coincidentes · revisar');return issues}
export function validateDocumentTaxIdentity(d:Document){
 if(d.taxIdentity!==undefined){validateTaxIdentity(d.taxIdentity);if(d.taxIdentity.origin!=='Catálogo al registrar'||!(['cobro','pago'].includes(d.kind)&&d.payments.some(p=>p.method==='Retención')||['factura','credito','debito'].includes(d.kind)&&!d.accountOnly&&d.perceptions>0))throw new Error('La identidad impositiva no corresponde al comprobante.')}
 for(const p of d.payments)if(p.taxIdentity!==undefined||p.agent!==undefined||p.agentUnknownReason!==undefined)throw new Error('La identidad del agente de tarjeta sólo corresponde a la liquidación, no al medio del comprobante.')
}

function reference(value:unknown){return typeof value==='string'&&!!value.trim()&&value.length<=200&&!Array.from(value).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)}
export function perceptionEvidence(jurisdiction:unknown,value:unknown):NonNullable<Document['perceptionEvidence']>{
 if(typeof jurisdiction!=='string'||!provinces.includes(jurisdiction)||!reference(value))throw new Error('La percepción requiere referencia de hasta 200 caracteres y jurisdicción del catálogo.')
 return {tax:'Ingresos Brutos',jurisdiction,reference:(value as string).trim()}
}
export function validatePerceptionEvidence(d:Pick<Document,'perceptions'|'kind'|'perceptionEvidence'>){
 if(d.perceptionEvidence===undefined)return
 const e=d.perceptionEvidence
 if(!e||typeof e!=='object'||e.tax!=='Ingresos Brutos'||!['factura','credito','debito'].includes(d.kind)||!Number.isSafeInteger(d.perceptions)||d.perceptions<=0||Object.keys(e).some(k=>!['tax','jurisdiction','reference'].includes(k)))throw new Error('La identificación de percepción necesita una factura o nota con importe positivo.')
 const normalized=perceptionEvidence(e.jurisdiction,e.reference)
 if(normalized.reference!==e.reference)throw new Error('La referencia de percepción debe conservarse sin espacios exteriores.')
}
export function withholdingEvidenceIssue(p:Pick<Payment,'reference'|'tax'|'jurisdiction'>){
 if(!reference(p.reference))return 'Falta referencia válida de certificado'
 if(!taxTypes.includes(p.tax||''))return 'Impuesto por revisar'
 if(p.tax==='Ingresos Brutos'&&!provinces.includes(p.jurisdiction||''))return 'Jurisdicción IIBB por revisar'
 if(p.jurisdiction&&!provinces.includes(p.jurisdiction))return 'Jurisdicción por revisar'
 return ''
}
