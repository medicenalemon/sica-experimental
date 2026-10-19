import type {State,Session,Settings} from './types'
import type {TaxMovementRow} from './tax-movements'
import {taxMovementRows} from './tax-movements'
import {today,uid,taxTypes,provinces} from './constants'
import {validCuit} from './engine'
import {canAccess} from './permissions'
import {accountingDate,accountingSum} from './trial-balance'
import {exerciseRanges} from './exercise-calendar'

export const taxCertificatePath='/finanzas/conciliacion-certificados'
export interface TaxCertificateEvidence {
 origin:'Certificado recibido'|'Consulta de organismo'|'Documento que incluye percepción';number:string;date:string;regime:string;
 type:'Retención'|'Percepción';effect:'Sufrida'|'Practicada';tax:string;jurisdiction:string;
 agentCuit:string;agentName:string;subjectCuit:string;subjectName:string;amount:number;state:'Informado como vigente'|'Informado como anulado';sourceReference:string;fileName:string;sha256:string;
}
export interface TaxCertificateInput {from:string;to:string;reviewedOn:string;previousId:string;reference:string;reason:string;evidence:TaxCertificateEvidence;links:{rowId:string;reason:string}[];confirmed:boolean;review?:string}
interface Context {company:Pick<Settings,'name'|'cuit'|'legalForm'|'province'|'iva'>;exercises:{start:string;end:string}[];documentIds:string[];settlementIds:string[];parties:{id:string;name:string;cuit:string}[];branches:{id:string;name:string}[];cards:{id:string;name:string}[];relevantRows:TaxMovementRow[]}
export interface TaxCertificatePreview {version:1;input:Omit<TaxCertificateInput,'review'>;source:Context;linked:{row:TaxMovementRow;reason:string;issues:string[]}[];unselectedReferenceIds:string[];releasedRowIds:string[];totals:{registered:number;external:number;difference:number};status:string;warnings:string[]}
export interface TaxCertificateRecord {id:string;rootId:string;number:string;responsible:string;createdAt:string;review:string;preview:TaxCertificatePreview}
const records=(s:State)=>s.taxCertificates||[]
const compact=(v:string)=>v.replace(/[-\s]/g,'')
const normalized=(v:string)=>v.trim().normalize('NFC').toLocaleUpperCase('es')
function text(value:unknown,label:string,max:number,required=true,multiline=false){if(typeof value!=='string'||(required&&!value.trim())||value.length>max||Array.from(value).some(c=>(c.charCodeAt(0)<32&&!(multiline&&['\n','\r','\t'].includes(c)))||c.charCodeAt(0)===127))throw new Error(`${label}: revisá el texto de hasta ${max} caracteres.`);return value.trim()}
function evidenceOf(input:TaxCertificateEvidence):TaxCertificateEvidence {
 if(!input||!['Certificado recibido','Consulta de organismo','Documento que incluye percepción'].includes(input.origin)||!['Retención','Percepción'].includes(input.type)||!['Sufrida','Practicada'].includes(input.effect)||!taxTypes.includes(input.tax)||!['Informado como vigente','Informado como anulado'].includes(input.state))throw new Error('Elegí origen, concepto, sentido, impuesto y estado declarado del respaldo.')
 accountingDate(input.date);if(input.date>today())throw new Error('La fecha del respaldo no puede ser futura.')
 if(typeof input.jurisdiction!=='string'||input.tax==='Ingresos Brutos'&&!provinces.includes(input.jurisdiction)||input.jurisdiction&&!provinces.includes(input.jurisdiction))throw new Error('Revisá la jurisdicción del respaldo; es obligatoria para IIBB.')
 const agentCuit=compact(text(input.agentCuit,'CUIT del agente',30)),subjectCuit=compact(text(input.subjectCuit,'CUIT del sujeto',30))
 if(!validCuit(agentCuit)||!validCuit(subjectCuit)||agentCuit===subjectCuit)throw new Error('Indicá CUIT válidos y distintos para agente y sujeto en esta comparación ordinaria.')
 if(!Number.isSafeInteger(input.amount))throw new Error('El importe transcripto del respaldo debe ser seguro en centavos.')
 const fileName=text(input.fileName,'Nombre del archivo',200,false),sha256=text(input.sha256,'Huella SHA-256',64,false).toLowerCase()
 if(!!fileName!==!!sha256||sha256&&!/^[a-f0-9]{64}$/.test(sha256))throw new Error('El nombre y la huella declarada del archivo deben completarse juntos; la huella debe ser SHA-256.')
 return {origin:input.origin,number:text(input.number,'Número o identificación externa',200),date:input.date,regime:text(input.regime,'Régimen declarado',200),type:input.type,effect:input.effect,tax:input.tax,jurisdiction:input.jurisdiction,agentCuit,agentName:text(input.agentName,'Nombre del agente según respaldo',300),subjectCuit,subjectName:text(input.subjectName,'Nombre del sujeto según respaldo',300),amount:input.amount,state:input.state,sourceReference:text(input.sourceReference,'Localización o referencia del respaldo',1000,true,true),fileName,sha256}
}
function certificateKey(e:TaxCertificateEvidence){return JSON.stringify([e.type,e.effect,e.tax,e.jurisdiction,normalized(e.regime),e.agentCuit,e.subjectCuit,normalized(e.number)])}
export function latestTaxCertificates(s:State){return [...new Map(records(s).map(r=>[r.rootId,r])).values()]}
function candidates(rows:TaxMovementRow[],input:Pick<TaxCertificateInput,'from'|'to'|'evidence'>){const e=input.evidence;return rows.filter(r=>!r.internal&&r.date>=input.from&&r.date<=input.to&&r.type===e.type&&r.effect===e.effect&&r.tax===e.tax&&(!r.jurisdiction||r.jurisdiction===e.jurisdiction))}
export function taxCertificateCandidates(rows:TaxMovementRow[],input:Pick<TaxCertificateInput,'from'|'to'|'evidence'>){return candidates(rows,input)}
function sourceFor(s:State,relevantRows:TaxMovementRow[]):Context {
 const partyIds=new Set(relevantRows.filter(r=>r.partyKey.startsWith('party:')).map(r=>r.partyKey.slice(6))),cardIds=new Set(relevantRows.filter(r=>r.partyKey.startsWith('card:')).map(r=>r.partyKey.slice(5))),branchIds=new Set(relevantRows.map(r=>r.branchId))
 return structuredClone({company:{name:s.settings.name,cuit:s.settings.cuit,legalForm:s.settings.legalForm||'',province:s.settings.province,iva:s.settings.iva},exercises:exerciseRanges(s),documentIds:s.documents.map(d=>d.id),settlementIds:(s.cardSettlements||[]).map(r=>r.id),parties:s.parties.filter(p=>partyIds.has(p.id)).map(p=>({id:p.id,name:p.name,cuit:p.cuit})),branches:s.masters.branches.filter(b=>branchIds.has(b.id)).map(b=>({id:b.id,name:String(b.name)})),cards:s.masters.cards.filter(c=>cardIds.has(c.id)).map(c=>({id:c.id,name:String(c.name)})),relevantRows})
}
function coveredRange(s:State,from:string,to:string){let cursor=from;for(const range of [...exerciseRanges(s)].sort((a,b)=>a.start.localeCompare(b.start))){if(range.end<cursor)continue;if(range.start>cursor)return false;if(range.end>=to)return true;const next=new Date(range.end+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);cursor=next.toISOString().slice(0,10)}return false}
export function previewTaxCertificate(s:State,input:TaxCertificateInput,providedRows?:TaxMovementRow[]):TaxCertificatePreview {
 accountingDate(input.from);accountingDate(input.to);accountingDate(input.reviewedOn)
 if(input.from>input.to||input.to>input.reviewedOn||input.reviewedOn>today()||!coveredRange(s,input.from,input.to))throw new Error('Revisá un rango operativo cubierto por los ejercicios conservados, sin fechas futuras y anterior o igual a la revisión.')
 const evidence=evidenceOf(input.evidence),company=compact(s.settings.cuit)
 if(!validCuit(company)||(evidence.effect==='Sufrida'?evidence.subjectCuit:evidence.agentCuit)!==company)throw new Error('El CUIT de la empresa debe coincidir con el sujeto de la retención/percepción sufrida o con el agente de la practicada.')
 if(evidence.date>input.reviewedOn)throw new Error('La revisión no puede preceder al respaldo indicado.')
 const previous=input.previousId?records(s).find(r=>r.id===input.previousId):undefined,latest=latestTaxCertificates(s)
 if(input.previousId&&(!previous||latest.find(r=>r.rootId===previous.rootId)?.id!==previous.id))throw new Error('Seleccioná la última versión del antecedente para corregirlo.')
 if(latest.some(r=>r.rootId!==previous?.rootId&&certificateKey(r.preview.input.evidence)===certificateKey(evidence)))throw new Error('El respaldo ya tiene una comparación. Continuá desde su última versión.')
 const reference=text(input.reference,'Referencia de revisión',200),reason=text(input.reason,'Fundamento de revisión',3000,true,true)
 if(records(s).some(r=>normalized(r.preview.input.reference)===normalized(reference)))throw new Error('La referencia de revisión ya se utilizó.')
 if(input.confirmed!==true)throw new Error('Confirmá el respaldo declarado, los vínculos y el alcance de la comparación.')
 if(!Array.isArray(input.links)||input.links.length>100||input.links.some(l=>!l||typeof l.rowId!=='string')||new Set(input.links.map(l=>l.rowId)).size!==input.links.length)throw new Error('Vinculá hasta cien movimientos diferentes; también podés conservar un respaldo sin movimientos coincidentes.')
 const rows=providedRows??taxMovementRows(s),eligible=candidates(rows,{from:input.from,to:input.to,evidence}),counterparty=evidence.effect==='Sufrida'?evidence.agentCuit:evidence.subjectCuit
 const linked=input.links.map(link=>{const row=eligible.find(r=>r.id===link.rowId);if(!row)throw new Error('Un movimiento está fuera del rango, concepto, sentido, impuesto o jurisdicción del respaldo, o es un interno X.')
  if(latest.some(r=>r.rootId!==previous?.rootId&&r.preview.linked.some(l=>l.row.id===row.id)))throw new Error('Un movimiento ya respalda otra comparación vigente. Revisá su antecedente antes de volver a vincularlo.')
  const issues:string[]=[...(row.identityIssues||[])]
  if(row.recordedCompany&&compact(row.recordedCompany.cuit)!==company)issues.push('El CUIT de la empresa conservado en el origen difiere del respaldo actual.')
  if(!validCuit(compact(row.partyCuit))||compact(row.partyCuit)!==counterparty)issues.push(row.identitySource?'El CUIT conservado en el origen no identifica al agente o sujeto indicado en el respaldo.':'El CUIT del catálogo no identifica al agente o sujeto indicado en el respaldo.')
  if(row.tax==='Ingresos Brutos'&&!row.jurisdiction)issues.push('El movimiento no conserva jurisdicción IIBB.')
  if(row.type==='Retención'&&normalized(row.reference)!==normalized(evidence.number))issues.push('La referencia de retención no coincide con el número o identificación externa.')
  if(row.status!=='Referencia informada · sin constatación externa')issues.push(row.status)
  const reason=text(link.reason,'Fundamento del vínculo',1000,issues.length>0,true)
  return {row:structuredClone(row),reason,issues}
 }).sort((a,b)=>a.row.id.localeCompare(b.row.id))
 const relevantRows=eligible.filter(r=>linked.some(l=>l.row.id===r.id)||(evidence.type==='Retención'&&normalized(r.reference)===normalized(evidence.number))).sort((a,b)=>a.id.localeCompare(b.id))
 const unselectedReferenceIds=evidence.type==='Retención'?relevantRows.filter(r=>!linked.some(l=>l.row.id===r.id)&&(!validCuit(compact(r.partyCuit))||compact(r.partyCuit)===counterparty)).map(r=>r.id):[]
 const registered=linked.reduce((n,l)=>accountingSum(n,l.row.amount),0),external=evidence.state==='Informado como anulado'?0:evidence.amount,difference=accountingSum(registered,-external),releasedRowIds=previous?previous.preview.linked.filter(l=>!linked.some(n=>n.row.id===l.row.id)).map(l=>l.row.id):[]
 const status=evidence.state==='Informado como anulado'?'Respaldo declarado anulado · revisar':!linked.length?'Sin movimientos vinculados':linked.some(l=>l.issues.length)?'Identificación pendiente':difference?'Con diferencia de importe':unselectedReferenceIds.length?'Referencia compartida por revisar':'Sin diferencia aritmética'
 const warnings=['En percepciones, la referencia registrada puede indicar un régimen: no se contrasta automáticamente como número de certificado.','Comparación manual con datos declarados del respaldo; no constata autenticidad, vigencia legal, cómputo fiscal ni presentación.','El rango selecciona fechas operativas y no asigna por sí mismo el período fiscal de cómputo.','No modifica documentos, certificados ni asientos; una igualdad aritmética no resuelve identificaciones pendientes.',linked.some(l=>l.row.identitySource)?'Los renglones indican identidad conservada al registrar o agente declarado en liquidación; no acreditan constatación externa. El contexto actual del catálogo se conserva por separado.':'Los nombres y CUIT de catálogo se conservan como contexto de esta revisión; los datos del agente y sujeto se transcriben del respaldo.','La huella del archivo es declarada por el operador. El contenido del archivo no se guarda: debe conservarse el original.']
 if(evidence.date<input.from||evidence.date>input.to)warnings.push('La fecha del respaldo está fuera del rango operativo elegido; revisá la relación y la imputación fiscal por separado.')
 if(unselectedReferenceIds.length)warnings.push(`${unselectedReferenceIds.length} movimiento(s) del rango comparten la referencia externa y no están vinculados; revisá si forman parte del mismo certificado.`)
 if(releasedRowIds.length)warnings.push('Esta versión deja de vincular movimientos del antecedente. Se conserva su revisión anterior y el fundamento actual; no se revierten operaciones.')
 return {version:1,input:{from:input.from,to:input.to,reviewedOn:input.reviewedOn,previousId:input.previousId,reference,reason,evidence,links:linked.map(l=>({rowId:l.row.id,reason:l.reason})),confirmed:true},source:sourceFor(s,relevantRows),linked,unselectedReferenceIds,releasedRowIds,totals:{registered,external,difference},status,warnings}
}
export const taxCertificateReview=(p:TaxCertificatePreview)=>JSON.stringify(p)
export function preserveTaxCertificate(s:State,input:TaxCertificateInput,actor:Session){
 if(!canAccess(actor,taxCertificatePath))throw new Error('Tu perfil no permite conservar comparaciones de certificados.')
 const preview=previewTaxCertificate(s,input);if(input.review!==taxCertificateReview(preview))throw new Error('La comparación o sus fuentes cambiaron. Revisala nuevamente.')
 const previous=records(s).find(r=>r.id===input.previousId),id=uid(),record:TaxCertificateRecord={id,rootId:previous?.rootId||id,number:`INT-CCF-${String(records(s).length+1).padStart(8,'0')}`,responsible:actor.name,createdAt:new Date().toISOString(),review:taxCertificateReview(preview),preview:structuredClone(preview)}
 ;(s.taxCertificates??=[]).push(record);return record
}
function frozenState(s:State,source:Context):State {
 if(!source||!Array.isArray(source.exercises)||!source.exercises.length||!Array.isArray(source.parties)||!Array.isArray(source.branches)||!Array.isArray(source.cards)||!Array.isArray(source.relevantRows))throw new Error('Falta el contexto conservado de la comparación de certificados.')
 for(const [collection,ids]of [[s.documents,source.documentIds],[s.cardSettlements||[],source.settlementIds]] as const)if(!Array.isArray(ids)||JSON.stringify(collection.slice(0,ids.length).map(r=>r.id))!==JSON.stringify(ids))throw new Error('No se conserva la secuencia de fuentes de la comparación de certificados.')
 const current=source.exercises.at(-1)!
 return {...s,settings:{...s.settings,...source.company,exerciseStart:current.start,exerciseEnd:current.end,exerciseHistory:source.exercises.slice(0,-1)},documents:s.documents.slice(0,source.documentIds.length),cardSettlements:(s.cardSettlements||[]).slice(0,source.settlementIds.length),parties:s.parties.map(p=>({...p,...source.parties.find(old=>old.id===p.id)})),masters:{...s.masters,branches:s.masters.branches.map(b=>({...b,...source.branches.find(old=>old.id===b.id)})),cards:s.masters.cards.map(c=>({...c,...source.cards.find(old=>old.id===c.id)}))}}
}
export function validateTaxCertificates(s:State){
 if(s.taxCertificates!==undefined&&!Array.isArray(s.taxCertificates))throw new Error('Las comparaciones de certificados deben ser una lista.')
 const ids=new Set<string>()
 for(const [index,r]of records(s).entries()){
  if(!r.id||ids.has(r.id)||r.number!==`INT-CCF-${String(index+1).padStart(8,'0')}`||typeof r.responsible!=='string'||!r.responsible.trim()||typeof r.createdAt!=='string'||Number.isNaN(Date.parse(r.createdAt))||r.preview?.version!==1)throw new Error('Constancia de comparación de certificado inválida.')
  ids.add(r.id);const previous=records(s).slice(0,index).find(p=>p.id===r.preview.input.previousId)
  if(r.rootId!==(previous?.rootId||r.id))throw new Error('El antecedente de comparación no conserva su cadena de versiones.')
  const preview=previewTaxCertificate({...frozenState(s,r.preview.source),taxCertificates:records(s).slice(0,index)},r.preview.input)
  if(r.review!==taxCertificateReview(preview)||r.review!==taxCertificateReview(r.preview))throw new Error('Cambió una fuente, vínculo o revisión conservada de certificados.')
 }
}
export function taxCertificateOutdated(s:State,r:TaxCertificateRecord,providedRows?:TaxMovementRow[]){try{const rows=providedRows??taxMovementRows(s),eligible=candidates(rows,r.preview.input),relevant=eligible.filter(row=>r.preview.linked.some(l=>l.row.id===row.id)||(r.preview.input.evidence.type==='Retención'&&normalized(row.reference)===normalized(r.preview.input.evidence.number))).sort((a,b)=>a.id.localeCompare(b.id));return JSON.stringify(relevant)!==JSON.stringify(r.preview.source.relevantRows)||JSON.stringify(sourceFor(s,relevant).company)!==JSON.stringify(r.preview.source.company)}catch{return true}}
export function taxCertificateFile(r:TaxCertificateRecord){if(r.review!==taxCertificateReview(r.preview))throw new Error('La comparación conservada no coincide con su revisión.');return {name:`SICA_COMPARACION_CERTIFICADO_${r.preview.input.reviewedOn}_${r.number}.json`,bytes:new TextEncoder().encode(JSON.stringify({kind:'Papel de comparación manual SICA; no es certificado oficial, declaración ni acreditación de cómputo fiscal',number:r.number,responsible:r.responsible,createdAt:r.createdAt,rootId:r.rootId,preview:r.preview},null,2)+'\n')}}
