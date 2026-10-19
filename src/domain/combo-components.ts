import type { Master, Product, State } from './types'

export interface ComboComponent { product:Product; quantity:number }

export function comboComponents(state:State, value:unknown):ComboComponent[] {
 if(typeof value!=='string'||!value.trim())throw new Error('Componentes: indicá SKU:cantidad separados por coma.')
 const rows=value.split(',')
 if(rows.length>100)throw new Error('Componentes: el combo admite hasta 100 SKU.')
 const seen=new Set<string>()
 return rows.map(row=>{
  const separator=row.lastIndexOf(':'),sku=row.slice(0,separator).trim(),raw=row.slice(separator+1).trim()
  if(separator<1||!/^\d+(?:\.\d+)?$/.test(raw))throw new Error('Componentes: usá SKU:cantidad, con punto para decimales.')
  const quantity=Number(raw),product=state.products.find(p=>p.sku.toLocaleLowerCase('es')===sku.toLocaleLowerCase('es'))
  if(!product||product.kind!=='Producto')throw new Error(`Componentes: ${sku} no es un SKU de mercadería existente.`)
  if(!Number.isFinite(quantity)||quantity<=0||quantity>1_000_000)throw new Error(`Componentes: cantidad inválida para ${sku}.`)
  if(seen.has(product.id))throw new Error(`Componentes: ${sku} está repetido; agrupá su cantidad.`)
  seen.add(product.id)
  return {product,quantity}
 })
}

export function validateCombo(state:State, item:Master) {
 if(typeof item.name!=='string'||!item.name.trim())throw new Error('Nombre: indicá un nombre para el combo.')
 if(!['number','string'].includes(typeof item.price)||String(item.price).trim()==='')throw new Error('Precio: indicá un importe para el combo.')
 const price=Number(item.price)
 if(!Number.isFinite(price)||price<0||!Number.isSafeInteger(Math.round(price*100))||Math.abs(price*100-Math.round(price*100))>0.000001)throw new Error('Precio: indicá ARS no negativos con hasta dos decimales.')
 if(state.masters.combos.some(c=>c.id!==item.id&&String(c.name).trim().toLocaleLowerCase('es')===String(item.name).trim().toLocaleLowerCase('es')))throw new Error('Nombre: ya existe este combo.')
 return comboComponents(state,item.components)
}
