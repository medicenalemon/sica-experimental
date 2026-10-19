import {fingerprint,canonical,fiscalRecord} from './fiscal-store.mjs'
export function assertFiscalSources(db,companyId,next){
 return assertFiscalRows(db.prepare('SELECT * FROM fiscal_jobs WHERE company_id=?').all(companyId),next)
}
export function assertFiscalRows(rows,next){
 for(const row of rows.filter(row=>row.state!=='rechazado')){
  const d=next.documents.find(d=>d.id===row.document_id),branch=next.masters.branches.find(b=>b.id===d?.branchId)
  if(fingerprint(d)!==row.signature||next.settings.cuit.replace(/[-\s]/g,'')!==row.issuer||Number(branch?.point)!==Number(row.point))throw new Error('La operación modificaría o quitaría un comprobante con solicitud ARCA pendiente o aprobada. Se conservan el comprobante, el emisor y el punto de venta.')
 }
 for(const preparation of next.vatSales||[])for(const source of preparation.preview.source.authorizations){
  const row=rows.find(row=>row.environment===preparation.preview.input.environment&&row.document_id===source.documentId)
  if(!row||row.state!=='aprobado'||source.unchanged!==true||canonical(JSON.parse(row.request))!==canonical(source.request)||canonical(fiscalRecord(row))!==canonical(source.record))throw new Error('La preparación de IVA ventas no coincide con su autorización fiscal original conservada en el servidor.')
 }

}
