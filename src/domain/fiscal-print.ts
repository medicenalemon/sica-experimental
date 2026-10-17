import {assertProductionRequest,fiscalLegends} from './fiscal-production'
import type { FiscalRecord, FiscalRequest } from './fiscal'
import { lineTotals, validCuit } from './engine'
import { registrationDate, registrationText } from './fiscal-registration'

const iso=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s
const date=(s:string)=>`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
const typeNames:Record<number,string>={1:'Factura',2:'Nota de débito',3:'Nota de crédito',6:'Factura',7:'Nota de débito',8:'Nota de crédito',11:'Factura',12:'Nota de débito',13:'Nota de crédito'}
export function fiscalPrintModel(request:FiscalRequest,record:FiscalRecord) {
 if(!['homologacion','produccion'].includes(record.environment)||record.state!=='aprobado')throw new Error('El PDF con CAE requiere un resultado aprobado de homologación o producción.')
 if(request.environment!==undefined&&request.environment!==record.environment)throw new Error('El ambiente del resultado no coincide con la solicitud conservada.')
 if(record.environment==='produccion')assertProductionRequest(request)
 const d=request.detail,emission=date(d.CbteFch),letter=request.type<=3?'A':request.type<=8?'B':'C'
 const iibb=registrationText(request.snapshot.issuer.iibbRegistration),activityStart=registrationDate(request.snapshot.issuer.activityStart),warnings:string[]=[]
 if(activityStart&&activityStart>emission)throw new Error('El inicio de actividades conservado es posterior a la emisión.')
 if(!iibb)warnings.push('Inscripción o condición en Ingresos Brutos no informada en la solicitud original.')
 if(!activityStart)warnings.push('Inicio de actividades no informado en la solicitud original.')
 if(!typeNames[request.type]||request.letter!==letter||request.point!==record.point||request.type!==record.type||d.CbteDesde!==record.number||d.CbteHasta!==record.number||!Number.isInteger(record.point)||record.point<1||record.point>99999||!Number.isInteger(record.number)||record.number<1||record.number>99999999)throw new Error('La numeración del resultado no coincide con la solicitud fiscal conservada.')
 if(!validCuit(request.issuer)||request.snapshot.issuer.cuit!==request.issuer||d.DocTipo!==80||!validCuit(d.DocNro)||request.snapshot.receiver.cuit!==d.DocNro||!iso(emission)||!record.expires||!iso(record.expires)||record.expires<emission||!record.cae||!/^\d{14}$/.test(record.cae)||/^0+$/.test(record.cae))throw new Error('Datos de emisor, receptor, fechas o CAE inválidos para representar el comprobante.')
 if(d.MonId!=='PES'||d.MonCotiz!==1||![d.ImpTotal,d.ImpNeto,d.ImpIVA,d.ImpTrib,d.ImpOpEx,d.ImpTotConc].every(n=>Number.isSafeInteger(n)&&n>=0)||d.ImpTotal<=0||d.ImpTotal>999999999999999||d.ImpTotal!==d.ImpNeto+d.ImpIVA+d.ImpTrib+d.ImpOpEx+d.ImpTotConc)throw new Error('Los importes fiscales deben conciliar en centavos de pesos argentinos.')
 const lines=request.snapshot.lines.map(l=>{
  if(!Number.isFinite(l.quantity)||l.quantity<=0||!Number.isSafeInteger(l.price)||l.price<0||!Number.isFinite(l.discount)||l.discount<0||l.discount>100||!['0','2.5','5','10.5','21','27','Exento','No gravado'].includes(l.tax)||typeof l.description!=='string'||typeof l.unit!=='string')throw new Error('El detalle fiscal contiene una línea inválida.')
  const amounts=lineTotals(l,request.letter);return {...l,...amounts}
 })
 if(!lines.length||lines.reduce((n,l)=>n+l.total,0)+d.ImpTrib!==d.ImpTotal||lines.reduce((n,l)=>n+l.vat,0)!==d.ImpIVA)throw new Error('El detalle conservado no coincide con los importes autorizados.')
 const net=lines.reduce((n,l)=>n+(letter==='C'?l.total:!['Exento','No gravado'].includes(l.tax)?l.net:0),0),exempt=letter==='C'?0:lines.filter(l=>l.tax==='Exento').reduce((n,l)=>n+l.net,0),nonTaxable=letter==='C'?0:lines.filter(l=>l.tax==='No gravado').reduce((n,l)=>n+l.net,0)
 if(d.ImpNeto!==net||d.ImpOpEx!==exempt||d.ImpTotConc!==nonTaxable||request.tributes.reduce((n,t)=>n+t.Importe,0)!==d.ImpTrib||request.iva.reduce((n,v)=>n+v.Importe,0)!==d.ImpIVA)throw new Error('Las bases, el IVA y los tributos no corresponden al detalle conservado.')
 const national=request.snapshot.nationalIndirect
 if(national!==undefined&&(!national||letter!=='B'||!Number.isSafeInteger(national.amount)||national.amount<0||national.amount>d.ImpTotal-d.ImpIVA-d.ImpTrib||typeof national.reference!=='string'||!national.reference.trim()||national.reference.length>200))throw new Error('Declaración de impuestos nacionales indirectos inválida.')
 if(letter==='B'&&!national)warnings.push('Otros impuestos nacionales indirectos contenidos no declarados. No se presume importe cero.')
 const payload={ver:1,fecha:emission,cuit:Number(request.issuer),ptoVta:record.point,tipoCmp:record.type,nroCmp:record.number,importe:d.ImpTotal/100,moneda:d.MonId,ctz:d.MonCotiz,tipoDocRec:d.DocTipo,nroDocRec:Number(d.DocNro),tipoCodAut:'E',codAut:Number(record.cae)}
 const encoded=btoa(JSON.stringify(payload)),qrUrl=`https://www.arca.gob.ar/fe/qr/?p=${encodeURIComponent(encoded)}`
 return {request:structuredClone(request),record:structuredClone(record),legends:fiscalLegends(request),lines,emission,title:typeNames[record.type],number:`${String(record.point).padStart(5,'0')}-${String(record.number).padStart(8,'0')}`,payload,qrUrl,warnings,nationalIndirect:national?.amount??null}
}
