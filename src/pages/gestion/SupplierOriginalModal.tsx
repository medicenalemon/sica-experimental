import {useState} from 'react'
import {useStore} from '@/state/context'
import {supplierOriginal,supplierOriginalLabel,supplierOriginalType,supplierOriginalPath,previewSupplierOriginal,supplierOriginalReview} from '@/domain/supplier-originals'
import type {SupplierOriginalInput,SupplierOriginalPreview,SupplierDocumentKind} from '@/domain/supplier-originals'
import {today,dateLabel,money} from '@/domain/constants'
import {Modal,Field,DataTable,Hint} from '@/components/gestion/UI'

export default function SupplierOriginalModal({documentId,onClose}:{documentId:string;onClose:()=>void}){
 const {data,transact,busy}=useStore(),document=data.documents.find(d=>d.id===documentId)!,current=supplierOriginal(data,documentId),prior=current?.preview.input
 const [input,setInput]=useState<SupplierOriginalInput>({documentId,documentKind:document.kind as SupplierDocumentKind,date:today(),previousId:current?.id||'',issuerCuit:prior?.issuerCuit||data.parties.find(p=>p.id===document.partyId)?.cuit||'',receiverCuit:prior?.receiverCuit||data.settings.cuit,point:prior?.point||1,number:prior?.number||0,authorization:prior?.authorization||'Sin consignar',code:prior?.code||'',expires:prior?.expires||'',reference:'',reason:''})
 const [preview,setPreview]=useState<SupplierOriginalPreview|null>(null),[error,setError]=useState('')
 function update<K extends keyof SupplierOriginalInput>(key:K,value:SupplierOriginalInput[K]){setInput({...input,[key]:value});setPreview(null);setError('')}
 async function submit(e:React.FormEvent){e.preventDefault();try{if(!preview){setPreview(previewSupplierOriginal(data,input));setError('');return}if(await transact(supplierOriginalPath(input.documentKind),'Identificar original de proveedor',document.number,{type:'supplier.original',original:{...input,review:supplierOriginalReview(preview)}}))onClose();else setPreview(null)}catch(e){setPreview(null);setError(e instanceof Error?e.message:'No se pudo revisar la identificación.')}}
 return <Modal title="Comprobante original del proveedor" onClose={onClose}>
  <p>{document.number} · Emisión {dateLabel(document.date)} · Tipo ARCA {String(supplierOriginalType(document)).padStart(3,'0')} · Total {money(document.total)}</p>
  <Hint>Copiá los datos del documento recibido. La referencia interna de SICA se conserva. Esta carga no constata la autorización ante ARCA ni cambia importes, impuestos o movimientos.</Hint>
  {current&&<p>Identificación vigente: <strong>{supplierOriginalLabel(current)}</strong> · CUIT emisor {prior!.issuerCuit}. La nueva constancia conservará el antecedente {current.number}.</p>}
  <form onSubmit={submit}><div className="form-grid">
   <Field label="CUIT del proveedor emisor *"><input required value={input.issuerCuit} onChange={e=>update('issuerCuit',e.target.value)}/></Field>
   <Field label="CUIT de la empresa receptora *"><input required value={input.receiverCuit} onChange={e=>update('receiverCuit',e.target.value)}/></Field>
   <Field label="Punto de venta del proveedor *"><input required type="number" min="1" max="99999" step="1" value={input.point} onChange={e=>update('point',Number(e.target.value))}/></Field>
   <Field label="Número original del comprobante *"><input required type="number" min="1" max="99999999" step="1" value={input.number} onChange={e=>update('number',Number(e.target.value))}/></Field>
   <Field label="Autorización informada"><select value={input.authorization} onChange={e=>{setInput({...input,authorization:e.target.value as SupplierOriginalInput['authorization'],code:'',expires:''});setPreview(null);setError('')}}><option>Sin consignar</option><option>CAE</option><option>CAEA</option><option>CAI</option></select></Field>
   {input.authorization!=='Sin consignar'&&<><Field label="Código de autorización *"><input required inputMode="numeric" pattern="[0-9]{14}" maxLength={14} value={input.code} onChange={e=>update('code',e.target.value)}/></Field><Field label="Vencimiento de autorización informado"><input type="date" min={document.date} value={input.expires} onChange={e=>update('expires',e.target.value)}/></Field></>}
   <Field label="Fecha de identificación *"><input required type="date" min={data.settings.exerciseStart} max={data.settings.exerciseEnd} value={input.date} onChange={e=>update('date',e.target.value)}/></Field>
  </div><Field label="Referencia de identificación *"><input required maxLength={200} value={input.reference} onChange={e=>update('reference',e.target.value)}/></Field><Field label="Fundamento de identificación o corrección *"><textarea required maxLength={1000} value={input.reason} onChange={e=>update('reason',e.target.value)}/></Field>
  {preview&&<Hint>Revisado: CUIT {preview.input.issuerCuit} → {preview.input.receiverCuit}; tipo {String(preview.type).padStart(3,'0')}, punto {String(preview.input.point).padStart(5,'0')}, número {String(preview.input.number).padStart(8,'0')}; emisión {dateLabel(preview.source.date)} y total {money(preview.source.total)}. {preview.status}.</Hint>}
  {error&&<p role="alert" className="form-error">{error}</p>}<div className="form-footer"><button className="button" disabled={busy}>{preview?'Confirmar identificación revisada':'Revisar identificación'}</button></div></form>
  {(data.supplierOriginals||[]).some(r=>r.preview.source.id===documentId)&&<DataTable title={`Historial del original de ${document.number}`} rows={(data.supplierOriginals||[]).filter(r=>r.preview.source.id===documentId).map(r=>({id:r.id,number:r.number,date:dateLabel(r.preview.input.date),original:supplierOriginalLabel(r),issuer:r.preview.input.issuerCuit,receiver:r.preview.input.receiverCuit,authorization:r.preview.input.authorization,code:r.preview.input.code,reference:r.preview.input.reference,reason:r.preview.input.reason,responsible:r.responsible}))} columns={[{key:'number',label:'Constancia'},{key:'date',label:'Registro'},{key:'original',label:'Original'},{key:'issuer',label:'CUIT emisor'},{key:'receiver',label:'CUIT receptor'},{key:'authorization',label:'Autorización declarada'},{key:'code',label:'Código'},{key:'reference',label:'Referencia'},{key:'reason',label:'Fundamento'},{key:'responsible',label:'Responsable'}]}/>}
 </Modal>
}
