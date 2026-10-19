import type { Letter, Line, State } from './types'
import { validateCombo } from './combo-components'
import { lineTotals } from './engine'

// Allocate integer cents by largest remainder, with deterministic ties in component order.
function allocate(total:number,weights:number[]):number[] {
 const sum=weights.reduce((n,w)=>n+BigInt(w),0n)
 if(sum===0n){if(total)throw new Error('El combo necesita precios de catálogo para distribuir su importe.');return weights.map(()=>0)}
 const shares=weights.map((w,i)=>{const numerator=BigInt(total)*BigInt(w);return {i,amount:Number(numerator/sum),remainder:numerator%sum}})
 let extra=total-shares.reduce((n,s)=>n+s.amount,0)
 for(const share of [...shares].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1))if(extra-->0)share.amount++
 return shares.map(s=>s.amount)
}

// Keep unit prices in integer cents; a discount expresses the exact assigned line amount.
function pricedLine(line:Line,amount:number,referencePrice:number,letter:Letter):Line {
 if(!Number.isSafeInteger(amount)||amount<0||!Number.isFinite(line.quantity)||line.quantity<=0||!Number.isSafeInteger(referencePrice)||referencePrice<0)throw new Error('Cantidad o importe del componente fuera de rango.')
 const price=Math.max(referencePrice,Math.ceil(amount/line.quantity)),base=price*line.quantity
 if(!Number.isFinite(base)||base>Number.MAX_SAFE_INTEGER)throw new Error('El importe del componente supera el rango admitido.')
 const discount=base?Math.max(0,Math.min(100,(1-amount/base)*100)):0
 const result={...line,price,discount}
 const actual=lineTotals(result,letter)
 if((letter==='A'?actual.net:actual.total)!==amount)throw new Error('No se pudo conciliar el precio del componente a centavos. Revisá las cantidades.')
 return result
}

export function expandCombo(state:State,id:string,count:number,letter:Letter,customerDiscount=0):Line[] {
 const combo=state.masters.combos.find(c=>c.id===id)
 if(!combo)throw new Error('Seleccioná un combo del catálogo.')
 const components=validateCombo(state,combo)
 if(!Number.isSafeInteger(count)||count<=0||count>1_000_000)throw new Error('La cantidad de combos debe ser entera y mayor que cero.')
 if(!Number.isFinite(customerDiscount)||customerDiscount<0||customerDiscount>100)throw new Error('Descuento del cliente inválido.')
 const target=Math.round(Math.round(Number(combo.price)*100)*count*(1-customerDiscount/100))
 if(!Number.isSafeInteger(target)||target<0)throw new Error('El precio total del combo supera el rango admitido.')
 const weights=components.map(({product,quantity})=>{
  if(!Number.isSafeInteger(product.price)||product.price<0)throw new Error('Revisá los precios de catálogo de los componentes.')
  const weight=Math.round(product.price*quantity)
  if(!Number.isSafeInteger(weight)||weight<0)throw new Error('Importe de referencia del componente fuera de rango.')
  return weight
 })
 const beforeDiscount=allocate(Math.round(Number(combo.price)*100),weights).map(amount=>amount*count)
 if(beforeDiscount.some(amount=>!Number.isSafeInteger(amount)))throw new Error('El precio total del combo supera el rango admitido.')
 const amounts=customerDiscount?allocate(target,beforeDiscount):beforeDiscount
 return components.map(({product,quantity},i)=>{
  const net=amounts[i],rate=Number(product.tax)||0
  const amount=letter==='B'?net+Math.round(net*rate/100):net
  const reference=letter==='B'?Math.round(product.price*(1+rate/100)):product.price
  return pricedLine({productId:product.id,description:product.name,quantity:quantity*count,unit:product.unit,price:0,tax:product.tax,discount:0},amount,reference,letter)
 })
}

export function mergeComboLines(existing:Line[],incoming:Line[],letter:Letter):Line[] {
 const result=existing.map(l=>({...l}))
 for(const line of incoming){
  const index=result.findIndex(l=>l.productId===line.productId)
  if(index<0){result.push({...line});continue}
  const prior=result[index]
  if(prior.tax!==line.tax||prior.unit!==line.unit)throw new Error('Un SKU repetido tiene otra unidad o alícuota. Revisá sus líneas antes de agregar el combo.')
  const a=lineTotals(prior,letter),b=lineTotals(line,letter),amount=letter==='A'?a.net+b.net:a.total+b.total
  result[index]=pricedLine({...prior,quantity:prior.quantity+line.quantity},amount,Math.max(prior.price,line.price),letter)
 }
 return result
}

export function convertLinePrices(lines:Line[],from:Letter,to:Letter):Line[] {
 if(from===to)return lines.map(l=>({...l}))
 return lines.map(line=>{
  const net=lineTotals(line,from).net,rate=Number(line.tax)||0
  const amount=to==='B'?net+Math.round(net*rate/100):net
  const reference=from==='B'&&to!=='B'?Math.round(line.price/(1+rate/100)):from!=='B'&&to==='B'?Math.round(line.price*(1+rate/100)):line.price
  return pricedLine(line,amount,reference,to)
 })
}
