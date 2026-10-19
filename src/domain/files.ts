import type ExcelJS from 'exceljs'

export function downloadBlob(name: string, data: Blob) {
  const url=URL.createObjectURL(data), a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000)
}
export async function buildXlsx(rows: Record<string,unknown>[], headers?: string[]) {
  const { default: ExcelJS } = await import('exceljs')
  const book=new ExcelJS.Workbook(), sheet=book.addWorksheet('SICA')
  const keys=headers || Object.keys(rows[0] || {})
  sheet.columns=keys.map(k=>({ header:k,key:k,width:Math.min(45,Math.max(18,k.length+3)) }))
  rows.forEach(row=>sheet.addRow(Object.fromEntries(keys.map(k=>[k,typeof row[k]==='object' ? JSON.stringify(row[k]) : row[k]??'']))))
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0F172A'}}
  sheet.views=[{state:'frozen',ySplit:1}]
  sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,rows.length+1),column:Math.max(1,keys.length)}}
  const bytes=await book.xlsx.writeBuffer()
  return new Uint8Array(bytes)
}
export async function exportXlsx(title: string, rows: Record<string,unknown>[], headers?: string[]) {
  downloadBlob(`${title}.xlsx`,new Blob([await buildXlsx(rows,headers)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
}
export async function buildPdf(title: string, rows: Record<string,unknown>[]) {
  const { jsPDF } = await import('jspdf')
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  const keys=Object.keys(rows[0]||{}), width=277/Math.max(1,keys.length)
  let y=30
  function header() { doc.setFontSize(14);doc.text(doc.splitTextToSize(`SICA · ${title}`,277).slice(0,1),10,12);doc.setFontSize(8);doc.text('Reporte de gestión interna · ARS · Sin autorización fiscal',10,21);const headings=keys.map(k=>doc.splitTextToSize(k,width-3));const height=Math.max(1,...headings.map(h=>h.length))*4+5;doc.setFillColor(15,23,42);doc.rect(10,25,277,height,'F');doc.setTextColor(255,255,255);headings.forEach((h,i)=>doc.text(h,12+i*width,30));doc.setTextColor(15,23,42);y=25+height+6 }
  header()
  rows.forEach((row,index)=>{
    const cells=keys.map(k=>doc.splitTextToSize(String(row[k]??''),width-3))
    const height=Math.max(1,...cells.map(c=>c.length))*4+4
    if(y+height>195) {doc.addPage();header()}
    if(index%2===0) {doc.setFillColor(248,250,252);doc.rect(10,y-4,277,height,'F')}
    cells.forEach((cell,i)=>doc.text(cell,12+i*width,y));y+=height
  })
  if(!rows.length) doc.text('Sin movimientos para el filtro seleccionado.',10,40)
  return doc
}
export async function exportPdf(title: string, rows: Record<string,unknown>[]) {
  const doc=await buildPdf(title,rows)
  downloadBlob(`${title}.pdf`,doc.output('blob'))
}
export async function readXlsx(file: File): Promise<{headers:string[]; rows:Record<string,string>[]}> {
  if(file.size>10*1024*1024) throw new Error('El archivo debe pesar menos de 10 MB.')
  const { default: ExcelJS } = await import('exceljs')
  const book=new ExcelJS.Workbook(); await book.xlsx.load(await file.arrayBuffer())
  const sheet=book.worksheets[0];if(!sheet) throw new Error('El archivo no contiene hojas.')
  function value(v: ExcelJS.CellValue):string { if(v===null || v===undefined)return ''; if(v instanceof Date)return v.toISOString().slice(0,10); if(typeof v==='object') {if('formula' in v || 'sharedFormula' in v) throw new Error('Las fórmulas no se importan. Pegá los valores antes de subir el archivo.'); if('text' in v)return v.text; if('richText' in v)return v.richText.map(t=>t.text).join(''); if('error' in v)throw new Error('La planilla contiene una celda con error.')}return String(v) }
  const headers:string[]=[];sheet.getRow(1).eachCell({includeEmpty:true},c=>headers.push(value(c.value).trim()))
  if(headers.some(h=>!h) || new Set(headers).size!==headers.length)throw new Error('Las columnas deben tener nombres únicos y no vacíos.')
  if(sheet.rowCount>5001)throw new Error('Importá hasta 5000 filas por archivo.')
  const rows:Record<string,string>[]=[]
  for(let r=2;r<=sheet.rowCount;r++) { const row=Object.fromEntries(headers.map((h,i)=>[h,value(sheet.getCell(r,i+1).value).trim()]));if(Object.values(row).some(Boolean))rows.push({...row,__row:String(r)}) }
  return {headers,rows}
}
