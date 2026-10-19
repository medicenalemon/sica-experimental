export interface PurchaseProrationInput {
 from:string;to:string;taxable:number;exempt:number;untaxed:number;reference:string;reason:string;confirmed:boolean;
 common:{documentId:string;amount:number}[];
}
export interface PurchaseProration {
 input:PurchaseProrationInput;basisTotal:number;ordinaryVat:number;creditNoteVat:number;direct:number;common:number;excluded:number;
 prorated:number;computable:number;nonComputable:number;restitution:number;creditNet:number;nonComputableNet:number;
 items:{documentId:string;direct:number;common:number;excluded:number;restitution:number}[];
}
interface Row {document:{id:string;kind:string};vat:number}
const amount=(n:number)=>Number.isSafeInteger(n)&&n>=0
const text=(v:string,label:string,max:number)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new Error(`${label}: completá hasta ${max} caracteres.`);return v.trim()}
export function globalPurchaseMode(mode:string){return ['Prorrateo global','Asignación directa y global'].includes(mode)}
export function calculatePurchaseProration(rows:Row[],credits:{documentId:string;amount:number}[],input:PurchaseProrationInput):PurchaseProration{
 if(!input||input.confirmed!==true)throw new Error('Confirmá la revisión del destino común, las bases fiscales y las restituciones históricas.')
 if(![input.taxable,input.exempt,input.untaxed].every(amount))throw new Error('Las bases del prorrateo deben ser importes no negativos en centavos.')
 const basisTotal=input.taxable+input.exempt+input.untaxed;if(!Number.isSafeInteger(basisTotal))throw new Error('Las bases del prorrateo exceden la precisión segura.')
 if(!Array.isArray(input.common)||input.common.length!==rows.length||new Set(input.common.map(c=>c.documentId)).size!==rows.length||input.common.some(c=>!rows.some(r=>r.document.id===c.documentId)))throw new Error('Revisá la asignación común de todos los comprobantes, sin omitir ni repetir filas.')
 if(credits.length!==rows.length||new Set(credits.map(c=>c.documentId)).size!==rows.length||credits.some(c=>!rows.some(r=>r.document.id===c.documentId)))throw new Error('Revisá el crédito directo o a restituir de cada comprobante.')
 const items:PurchaseProration['items']=[];let ordinaryVat=0,creditNoteVat=0,direct=0,common=0,restitution=0
 for(const row of rows){const credit=credits.find(c=>c.documentId===row.document.id)!.amount,pool=input.common.find(c=>c.documentId===row.document.id)!.amount
  if(!amount(credit)||!amount(pool)||credit+pool>row.vat||!Number.isSafeInteger(credit+pool))throw new Error('El crédito directo más el IVA común no puede superar el IVA discriminado de la compra; B/C llevan cero.')
  if(row.document.kind==='credito'){if(pool)throw new Error('Las notas de crédito no se prorratean con la proporción actual. Indicá el crédito a restituir según el cómputo original.');creditNoteVat+=row.vat;restitution+=credit;items.push({documentId:row.document.id,direct:0,common:0,excluded:row.vat-credit,restitution:credit})}
  else{ordinaryVat+=row.vat;direct+=credit;common+=pool;items.push({documentId:row.document.id,direct:credit,common:pool,excluded:row.vat-credit-pool,restitution:0})}
 }
 if(![ordinaryVat,creditNoteVat,direct,common,restitution].every(amount))throw new Error('Las asignaciones exceden la precisión segura de importes.')
 if(common&&!basisTotal)throw new Error('El IVA de uso común requiere bases fiscales documentadas con total mayor que cero.')
 // Round the aggregate pool once, in cents, using exact rational arithmetic.
 const prorated=basisTotal?Number((2n*BigInt(common)*BigInt(input.taxable)+BigInt(basisTotal))/(2n*BigInt(basisTotal))):0
 const computable=direct+prorated,nonComputable=ordinaryVat-computable,creditNet=computable-restitution,nonComputableNet=nonComputable-(creditNoteVat-restitution),excluded=ordinaryVat-direct-common
 if(![prorated,computable,nonComputable,excluded].every(amount)||![creditNet,nonComputableNet].every(Number.isSafeInteger))throw new Error('El prorrateo no conserva los importes discriminados.')
 const normalized={from:input.from,to:input.to,taxable:input.taxable,exempt:input.exempt,untaxed:input.untaxed,reference:text(input.reference,'Referencia de las bases fiscales',200),reason:text(input.reason,'Fundamento de las bases y asignaciones',2000),confirmed:true,common:rows.map(r=>({documentId:r.document.id,amount:input.common.find(c=>c.documentId===r.document.id)!.amount}))}
 return {input:normalized,basisTotal,ordinaryVat,creditNoteVat,direct,common,excluded,prorated,computable,nonComputable,restitution,creditNet,nonComputableNet,items}
}
