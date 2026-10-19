import type {Master} from './types'
import {provinces} from './constants'

function date(value:unknown,label:string,optional=false):string {
 if(optional&&(value===undefined||value===''))return ''
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'0001-01-01'||value>'9999-12-31'||Number.isNaN(Date.parse(value))||new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value)throw new Error(`${label}: indicá una fecha calendario válida.`)
 return value
}
function text(value:unknown,label:string,max:number){if(typeof value!=='string'||!value.trim()||value.length>max||Array.from(value).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw new Error(`${label}: indicá un texto de hasta ${max} caracteres sin controles.`)}
export function validateTaxRule(rule:Master){
 if(!rule||typeof rule!=='object')throw new Error('El régimen impositivo debe ser un registro.')
 text(rule.id,'Identificador del régimen',200);text(rule.name,'Nombre del régimen',200)
 if(!['Retención','Percepción'].includes(String(rule.type)))throw new Error('El régimen debe ser de Retención o Percepción.')
 if(!['Ingresos Brutos','Ganancias','IVA','Seguridad Social'].includes(String(rule.tax)))throw new Error('Seleccioná un impuesto válido para el régimen.')
 if(rule.tax==='Ingresos Brutos'&&!provinces.includes(String(rule.jurisdiction)))throw new Error('Ingresos Brutos requiere una jurisdicción del catálogo.')
 if(rule.jurisdiction!==undefined&&rule.jurisdiction!==''&&!provinces.includes(String(rule.jurisdiction)))throw new Error('La jurisdicción del régimen no pertenece al catálogo.')
 if(!['number','string'].includes(typeof rule.rate)||String(rule.rate).trim()===''||!Number.isFinite(Number(rule.rate))||Number(rule.rate)<0||Number(rule.rate)>100)throw new Error('La alícuota del régimen debe ser un número entre 0 y 100.')
 const from=date(rule.validFrom,'Vigente desde'),until=date(rule.validUntil,'Vigente hasta',true)
 if(until&&until<from)throw new Error('La vigencia final del régimen no puede preceder a su inicio.')
 text(rule.norm,'Norma aplicable al régimen',1000)
}
export function validateTaxRules(rules:Master[]){
 if(!Array.isArray(rules))throw new Error('El catálogo de regímenes impositivos debe ser una lista.')
 const ids=new Set<string>();for(const rule of rules){validateTaxRule(rule);if(ids.has(rule.id))throw new Error('El catálogo repite un identificador de régimen impositivo.');ids.add(rule.id)}
}
export function taxRuleStatus(rule:Master,asOf:string){
 try{validateTaxRule(rule)}catch{return 'Revisar configuración'}
 date(asOf,'Fecha de consulta')
 if(String(rule.validFrom)>asOf)return 'Próximo según fechas'
 if(rule.validUntil&&String(rule.validUntil)<asOf)return 'Vencido según fechas'
 return 'Vigente según fechas'
}
