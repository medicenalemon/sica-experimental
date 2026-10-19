import DocumentsPage from '@/pages/gestion/DocumentsPage'
interface Props { titulo: string; tipoComprobante: 'factura' | 'nota-credito' | 'nota-debito' }
export default function ComprobanteVentaForm({ tipoComprobante }: Props) {
  const kind = tipoComprobante === 'nota-credito' ? 'credito' : tipoComprobante === 'nota-debito' ? 'debito' : 'factura'
  return <DocumentsPage side="cliente" kind={kind} form/>
}
