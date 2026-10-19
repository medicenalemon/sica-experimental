import {SaxesParser} from 'saxes'
export const WSAA_NAMESPACE='http://wsaa.view.sua.dvadac.desein.afip.gov'
export const WSFE_NAMESPACE='http://ar.gov.afip.dif.FEV1/'
const SOAP_NAMESPACE='http://schemas.xmlsoap.org/soap/envelope/'
export class ArcaProtocolError extends Error {}
export const escapeXml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
export function parseXml(xml){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>2*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new ArcaProtocolError('Respuesta XML no admitida.')
 const parser=new SaxesParser({xmlns:true}),stack=[];let root,count=0
 parser.on('opentag',tag=>{if(++count>10000||stack.length>=40)throw new ArcaProtocolError('Respuesta XML demasiado compleja.');const n={name:tag.local,uri:tag.uri,text:'',children:[]};if(stack.length)stack.at(-1).children.push(n);else root=n;stack.push(n)})
 parser.on('text',text=>{if(stack.length)stack.at(-1).text+=text});parser.on('cdata',text=>{if(stack.length)stack.at(-1).text+=text});parser.on('closetag',()=>stack.pop())
 try{parser.write(xml).close()}catch{throw new ArcaProtocolError('Respuesta XML inválida.')}
 if(!root)throw new ArcaProtocolError('Respuesta XML vacía.');return root
}
export function one(node,name,required=true){const nodes=node?.children.filter(n=>n.name===name)||[];if(nodes.length>1||(!nodes.length&&required))throw new ArcaProtocolError('La respuesta de ARCA no tiene la estructura esperada.');return nodes[0]}
export const value=(node,name,required=true)=>one(node,name,required)?.text.trim()||''
export function soapResult(xml,operation){const envelope=parseXml(xml);if(envelope.name!=='Envelope'||envelope.uri!==SOAP_NAMESPACE)throw new ArcaProtocolError('Respuesta SOAP inesperada.');const body=one(envelope,'Body');if(one(body,'Fault',false))throw new ArcaProtocolError('ARCA devolvió un error SOAP. Revisá certificado, servicio y disponibilidad.');const response=one(body,operation+'Response');if(response.uri!==(operation==='loginCms'?WSAA_NAMESPACE:WSFE_NAMESPACE))throw new ArcaProtocolError('Servicio SOAP inesperado.');return one(response,operation==='loginCms'?'loginCmsReturn':operation+'Result')}
const centFields=new Set(['ImpTotal','ImpTotConc','ImpNeto','ImpOpEx','ImpTrib','ImpIVA','BaseImp','Importe'])
const xmlObject=object=>Object.entries(object).map(([key,v])=>`<${key}>${escapeXml(centFields.has(key)?(v/100).toFixed(2):v)}</${key}>`).join('')
export function wsfeEnvelope(operation,auth,payload=''){return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP_NAMESPACE}"><soap:Body><${operation} xmlns="${WSFE_NAMESPACE}"><Auth>${xmlObject(auth)}</Auth>${payload}</${operation}></soap:Body></soap:Envelope>`}
export function authorizeEnvelope(auth,request){const d=request.detail,arrays=(name,item,rows)=>rows.length?`<${name}>${rows.map(r=>`<${item}>${xmlObject(r)}</${item}>`).join('')}</${name}>`:'';return wsfeEnvelope('FECAESolicitar',auth,`<FeCAEReq><FeCabReq>${xmlObject({CantReg:1,PtoVta:request.point,CbteTipo:request.type})}</FeCabReq><FeDetReq><FECAEDetRequest>${xmlObject(Object.fromEntries(['Concepto','DocTipo','DocNro','CbteDesde','CbteHasta','CbteFch','ImpTotal','ImpTotConc','ImpNeto','ImpOpEx','ImpTrib','ImpIVA','FchServDesde','FchServHasta','FchVtoPago','MonId','MonCotiz','CondicionIVAReceptorId'].filter(k=>k in d).map(k=>[k,d[k]])))}${arrays('CbtesAsoc','CbteAsoc',request.associated)}${arrays('Tributos','Tributo',request.tributes)}${arrays('Iva','AlicIva',request.iva)}</FECAEDetRequest></FeDetReq></FeCAEReq>`)}
export const simplePayload=(name,object)=>`<${name}>${xmlObject(object)}</${name}>`
export function messages(node){return ['Errors','Observaciones','Events'].flatMap(group=>(one(node,group,false)?.children||[]).map(n=>({code:Number(value(n,'Code')),message:value(n,'Msg')})))}
export function authorizationResponse(xml,request){const result=soapResult(xml,'FECAESolicitar'),header=one(result,'FeCabResp',false),details=one(result,'FeDetResp',false)?.children||[],errors=messages(result);if(!header||details.length!==1){if(errors.length)return {state:'rechazado',messages:errors};throw new ArcaProtocolError('Respuesta de autorización incompleta.')}const d=details[0];if(Number(value(header,'PtoVta'))!==request.point||Number(value(header,'CbteTipo'))!==request.type||Number(value(header,'Cuit'))!==Number(request.issuer)||Number(value(d,'CbteDesde'))!==request.detail.CbteDesde||Number(value(d,'CbteHasta'))!==request.detail.CbteHasta||value(d,'DocNro')!==request.detail.DocNro||value(d,'CbteFch')!==request.detail.CbteFch)throw new ArcaProtocolError('La respuesta no corresponde al comprobante solicitado.');const all=[...errors,...messages(d)],approved=value(d,'Resultado');if(approved==='R')return {state:'rechazado',messages:all};if(approved!=='A')throw new ArcaProtocolError('Resultado de autorización desconocido.');return approvedResult(value(d,'CAE'),value(d,'CAEFchVto'),all)}
function approvedResult(cae,expires,messages){const iso=expires.slice(0,4)+'-'+expires.slice(4,6)+'-'+expires.slice(6);if(!/^\d{14}$/.test(cae)||/^0+$/.test(cae)||!/^\d{8}$/.test(expires)||Number.isNaN(Date.parse(iso))||new Date(iso+'T12:00:00Z').toISOString().slice(0,10)!==iso)throw new ArcaProtocolError('CAE o vencimiento inválidos.');return {state:'aprobado',cae,expires:expires.slice(0,4)+'-'+expires.slice(4,6)+'-'+expires.slice(6),messages}}
function rowsMatch(node,group,item,expected,fields){
 const actual=one(node,group,false)?.children||[]
 if(actual.length!==expected.length||actual.some(n=>n.name!==item))return false
 const normalize=(row,isXml)=>JSON.stringify(Object.fromEntries(fields.map(field=>{const v=isXml?value(row,field):row[field];return [field,centFields.has(field)?(isXml?Math.round(Number(v)*100):v):field==='Desc'?String(v):Number(v)]})))
 const left=actual.map(r=>normalize(r,true)).sort(),right=expected.map(r=>normalize(r,false)).sort()
 return left.every((v,i)=>v===right[i])
}
export function consultationResponse(xml,request){
 const result=soapResult(xml,'FECompConsultar'),d=one(result,'ResultGet',false),errors=messages(result)
 if(!d){if(errors.length&&errors.every(e=>e.code===602))return {state:'no-encontrado',messages:errors};throw new ArcaProtocolError('No se pudo determinar el estado del comprobante.')}
 if(value(d,'Resultado')!=='A'||value(d,'EmisionTipo')!=='CAE')throw new ArcaProtocolError('La consulta no devolvió una autorización CAE aprobada.')
 const conflict=message=>({state:'conflicto',messages:[{code:0,message}]})
 const expected={PtoVta:request.point,CbteTipo:request.type,DocTipo:request.detail.DocTipo,DocNro:request.detail.DocNro,CbteDesde:request.detail.CbteDesde,CbteHasta:request.detail.CbteHasta,Concepto:request.detail.Concepto}
 for(const [field,v] of Object.entries(expected))if(Number(value(d,field))!==Number(v))return conflict('El número consultado corresponde a otros datos. Requiere revisión.')
 for(const field of ['ImpTotal','ImpNeto','ImpIVA','ImpOpEx','ImpTotConc','ImpTrib'])if(Math.round(Number(value(d,field))*100)!==request.detail[field])return conflict('Los importes consultados no coinciden con el comprobante.')
 if(value(d,'CbteFch')!==request.detail.CbteFch||value(d,'MonId')!=='PES'||Number(value(d,'MonCotiz'))!==1)return conflict('Fecha, moneda o cotización diferentes en la consulta.')
 for(const field of ['FchServDesde','FchServHasta','FchVtoPago'])if(value(d,field,false)!==(request.detail[field]||''))return conflict('El período o vencimiento de servicios no coincide con la solicitud.')
 // Some deployed WSFE schemas omit this field in FECompConsultar. Validate it when supplied.
 const condition=value(d,'CondicionIVAReceptorId',false)
 if(condition&&Number(condition)!==request.detail.CondicionIVAReceptorId)return conflict('La condición IVA del receptor no coincide con la solicitud.')
 if(!rowsMatch(d,'Iva','AlicIva',request.iva,['Id','BaseImp','Importe'])||!rowsMatch(d,'Tributos','Tributo',request.tributes,['Id','Desc','BaseImp','Alic','Importe'])||!rowsMatch(d,'CbtesAsoc','CbteAsoc',request.associated,['Tipo','PtoVta','Nro']))return conflict('El desglose de IVA, tributos o comprobantes asociados no coincide con la solicitud.')
 return approvedResult(value(d,'CodAutorizacion'),value(d,'FchVto'),[...errors,...messages(d)])
}
