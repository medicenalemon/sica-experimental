import type { Settings, Master } from './types'

export const legalForms=['Sociedad comercial · forma por definir','SRL','SAS','SA','Persona humana','Otra forma jurídica'] as const
export function validateLegalForm(value:unknown){if(value!==undefined&&value!==''&&(typeof value!=='string'||!legalForms.some(f=>f===value)))throw new Error('La forma jurídica debe ser una de las opciones admitidas o quedar sin especificar.')}

export function registrationDate(value:unknown) {
 if(value===undefined||value==='')return ''
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value)throw new Error('La fecha de inicio de actividades debe ser una fecha válida.')
 return value
}
export function registrationText(value:unknown) {
 if(value===undefined||value==='')return ''
 if(typeof value!=='string'||value.length>120||Array.from(value).some(c=>c<' '))throw new Error('La inscripción o condición en Ingresos Brutos debe ser un texto de hasta 120 caracteres.')
 return value.trim()
}
export function validateRegistration(settings:Settings,branches:Master[]=[]){validateLegalForm(settings.legalForm);registrationText(settings.iibbRegistration);registrationDate(settings.activityStart);for(const branch of branches)registrationDate(branch.activityStart)}
export function issuerRegistration(settings:Settings,branch:Master,emission:string){
 validateRegistration(settings,[branch]);const activityStart=registrationDate(branch.activityStart)||registrationDate(settings.activityStart)
 if(activityStart&&activityStart>emission)throw new Error('La emisión es anterior al inicio de actividades del establecimiento.')
 return {iibbRegistration:registrationText(settings.iibbRegistration),activityStart,address:String(branch.address||settings.address)}
}
