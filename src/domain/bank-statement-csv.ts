import {statementHeaders} from './bank-reconciliation'

const maxBytes=10*1024*1024
const canonical=(value:string)=>value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
type CsvRow={cells:string[];line:number}

function tokenize(text:string,delimiter:string):CsvRow[]{
 const rows:CsvRow[]=[],cells:string[]=[]
 let field='',quoted=false,closed=false,line=1,start=1
 function cell(){cells.push(field);if(cells.length>4)throw new Error(`CSV: la línea ${start} debe tener exactamente cuatro columnas.`);field='';closed=false}
 function row(){cell();if(cells.some(c=>c.trim())){rows.push({cells:[...cells],line:start});if(rows.length>5001)throw new Error('Importá hasta 5000 filas por archivo.')}cells.length=0;start=line+1}
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}
   else{field+=c;if(c==='\n')line++}
  }else if(c===delimiter)cell()
  else if(c==='\n'){row();line++}
  else if(closed)throw new Error(`CSV: contenido después de una comilla de cierre en la línea ${line}.`)
  else if(c==='"'){if(field)throw new Error(`CSV: comilla fuera del inicio de una celda en la línea ${line}.`);quoted=true}
  else field+=c
 }
 if(quoted)throw new Error(`CSV: falta cerrar una celda entre comillas iniciada en la fila ${start}.`)
 if(field||cells.length||closed)row()
 return rows
}

function headers(row:CsvRow|undefined){
 if(!row||row.cells.length!==4)return undefined
 const names=row.cells.map(c=>statementHeaders.find(h=>canonical(h)===canonical(c)))
 return names.every(Boolean)&&new Set(names).size===4?names as string[]:undefined
}

/** CSV only supplies rows; the existing bank import validates dates, cents and balances. */
export function parseBankStatementCsv(input:string):{headers:string[];rows:Record<string,string>[];delimiter:string}{
 if(typeof input!=='string'||new TextEncoder().encode(input).length>maxBytes)throw new Error('El archivo debe pesar como máximo 10 MB.')
 const text=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n')
 for(let i=0;i<text.length;i++){const code=text.charCodeAt(i);if(code<32&&code!==9&&code!==10)throw new Error('El CSV contiene caracteres de control inválidos.')}
 const first=text.match(/[^\n]*\S[^\n]*/)?.[0]||''
 const candidates=[',',';','\t'].filter(delimiter=>{try{return !!headers(tokenize(first,delimiter)[0])}catch{return false}})
 if(candidates.length!==1)throw new Error('El CSV necesita las cuatro columnas Fecha, Referencia, Descripcion e Importe, separadas por coma, punto y coma o tabulación.')
 const delimiter=candidates[0],records=tokenize(text,delimiter),names=headers(records.shift())!
 const rows=records.map(r=>{
  if(r.cells.length!==4)throw new Error(`CSV: la línea ${r.line} debe tener exactamente cuatro columnas.`)
  return {...Object.fromEntries(names.map((h,i)=>[h,r.cells[i].replace(/[\t\r\n]+/g,' ')])),__row:String(r.line)}
 })
 if(!rows.length)throw new Error('El CSV no contiene movimientos.')
 return {headers:statementHeaders,rows,delimiter}
}

export async function readBankStatementCsv(file:Pick<File,'size'|'arrayBuffer'>){
 if(file.size>maxBytes)throw new Error('El archivo debe pesar como máximo 10 MB.')
 let text:string
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer())}catch{throw new Error('No se pudo leer el CSV en UTF-8. Exportalo con esa codificación y volvé a cargarlo.')}
 return parseBankStatementCsv(text)
}
