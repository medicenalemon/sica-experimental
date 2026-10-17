import type { State, Role, Party, Product, Kind, Side, Line } from './types'
import { saveParty, saveProduct, adjustStock, createDocument, saveMaster } from './engine'
import { uid, cents, today, taxRates, units } from './constants'
import { requireAdmin } from './permissions'

export interface ImportSpec { id:string;name:string;required:string[];optional:string[];admin?:boolean }
export const importSpecs: ImportSpec[]=[
 {id:'clientes',name:'Clientes',required:['Codigo','Razon Social','CUIT','Condicion IVA'],optional:['Domicilio','Provincia','Telefono','Mail','Condicion Pago','Lista Precios','Descuento','Vendedor','Comision','Forma Pago','Transporte']},
 {id:'proveedores',name:'Proveedores',required:['Codigo','Razon Social','CUIT','Condicion IVA'],optional:['Rubro','Domicilio','Provincia','Telefono','Mail','Condicion Pago','Forma Pago','Transporte']},
 {id:'productos',name:'Productos / SKU',required:['SKU','Descripcion','IVA'],optional:['Tipo','Rubro','Subrubro','Codigo de barras','Stock Minimo','Stock Real','Proveedor','Acepta Stock Negativo','Marca','Modelo','Utiliza variantes','Unidad','Precio','Costo','Deposito','Padre']},
 {id:'variantes',name:'Variantes',required:['SKU','Atributo','Valor'],optional:['Nombre']},
 {id:'stock',name:'Stock actualizado',required:['SKU','Deposito','Stock Real'],optional:['Motivo'],admin:true},
 {id:'saldos-clientes',name:'Saldos clientes',required:['Codigo','Saldo','Fecha','Sucursal','Referencia'],optional:['Observaciones']},
 {id:'saldos-proveedores',name:'Saldos proveedores',required:['Codigo','Saldo','Fecha','Sucursal','Referencia'],optional:['Observaciones']},
 {id:'precios',name:'Precios',required:['SKU','Lista Precios','Precio'],optional:[],admin:true},
 {id:'listas-precios',name:'Listas de precios',required:['Nombre','Sucursal','Ajuste'],optional:[],admin:true},
 {id:'combos',name:'Combos',required:['Nombre','Componentes','Precio'],optional:[]},
 {id:'pedidos',name:'Pedidos de venta',required:['Referencia','Codigo','SKU','Cantidad','Precio','Fecha','Sucursal'],optional:['Observaciones','Lista Precios','Descuento']},
 {id:'ordenes',name:'Órdenes de compra',required:['Referencia','Codigo','SKU','Cantidad','Precio','Fecha','Sucursal'],optional:['Observaciones']},
 {id:'compras',name:'Compras',required:['Referencia','Codigo','SKU','Cantidad','Precio','Fecha','Sucursal','Clase'],optional:['IVA','Centro Costos','Observaciones']},
 {id:'pagos',name:'Pagos',required:['Referencia','Codigo','Importe','Fecha','Sucursal','Cuenta','Forma Pago'],optional:['Aplicacion','Observaciones']},
 {id:'ecommerce',name:'E-commerce (vínculos de SKU)',required:['SKU','Plataforma','ID Externo'],optional:['Nombre']},
]
export interface ImportError { row:number;field:string;message:string }
export interface ImportPreview { errors:ImportError[];validRows:number[];total:number }
function num(value:string,field:string,optional=false) {if(!value&&optional)return 0;const number=Number(value.replace(',','.'));if(!Number.isFinite(number)||value==='')throw new Error(`${field}: ingresá un número válido sin separador de miles.`);return number}
function findMaster(s:State,key:string,value:string) {const m=s.masters[key]?.find(m=>m.id===value||m.name===value||m.code===value);if(!m)throw new Error(`${value}: no existe en ${key}.`);return m.id}
function party(s:State,code:string,side:Side){const p=s.parties.find(p=>p.code===code&&p.side===side);if(!p)throw new Error(`Código ${code}: la contraparte no existe.`);return p}
function product(s:State,sku:string){const p=s.products.find(p=>p.sku===sku);if(!p)throw new Error(`SKU ${sku}: no existe.`);return p}
function checkRequired(spec:ImportSpec,row:Record<string,string>){for(const h of spec.required)if(!row[h]?.trim())throw new Error(`${h}: columna obligatoria vacía.`)}
function boolean(value:string){if(!value)return false;if(['si','sí','true','1'].includes(value.toLowerCase()))return true;if(['no','false','0'].includes(value.toLowerCase()))return false;throw new Error('Usá Sí o No para campos lógicos.')}
function applyRows(s:State,spec:ImportSpec,rows:Record<string,string>[],role:Role) {
 if(spec.admin)requireAdmin(role)
 rows.forEach(r=>checkRequired(spec,r))
 const r=rows[0]
 if(['pedidos','ordenes','compras','pagos','saldos-clientes','saldos-proveedores'].includes(spec.id)) {
  if(s.documents.some(d=>d.observations.includes(`[Importación:${r.Referencia}]`)))throw new Error('La referencia ya fue importada. Se evitó duplicar el movimiento.')
  const side:Side=spec.id==='pedidos'||spec.id==='saldos-clientes'?'cliente':'proveedor'
  const p=party(s,r.Codigo,side),branchId=findMaster(s,'branches',r.Sucursal)
  if(rows.some(x=>x.Codigo!==r.Codigo||x.Sucursal!==r.Sucursal||x.Fecha!==r.Fecha||x.Clase!==r.Clase))throw new Error('Las filas de una referencia deben tener la misma contraparte, fecha, sucursal y clase.')
  const kind:Kind=spec.id==='pedidos'?'pedido':spec.id==='ordenes'?'orden-compra':spec.id==='compras'?'factura':spec.id==='pagos'?'pago':'saldo'
  const lines:Line[]=rows.filter(()=>!['pago','saldo'].includes(kind)).map(row=>{const p=product(s,row.SKU);return {productId:p.id,description:p.name,unit:p.unit,quantity:num(row.Cantidad,'Cantidad'),price:cents(num(row.Precio,'Precio')),tax:row.IVA||p.tax,discount:num(row.Descuento||'0','Descuento',true)}})
  const payment=kind==='pago'?{method:r['Forma Pago'],amount:cents(num(r.Importe,'Importe')),treasuryId:findMaster(s,'treasury',r.Cuenta),reference:r.Referencia}:null
  if(payment&&['Cheque','Retención'].includes(payment.method))throw new Error('Cheques y retenciones se registran desde Pagos con sus datos completos.')
  const applied=payment&&r.Aplicacion?s.documents.find(d=>d.number===r.Aplicacion):null
  if(r.Aplicacion&&!applied)throw new Error('El comprobante de aplicación no existe.')
  createDocument(s,{kind,side,letter:(r.Clase||'X') as 'A'|'B'|'C'|'X',date:r.Fecha,due:r.Fecha,branchId,partyId:p.id,lines,payments:payment?[payment]:[],perceptions:0,sourceId:'',allocations:applied?[{documentId:applied.id,amount:payment!.amount}]:[],observations:`${r.Observaciones||''} [Importación:${r.Referencia}]`,responsible:'Importación',costCenter:r['Centro Costos']?findMaster(s,'costCenters',r['Centro Costos']):'',depositId:'',official:false,valued:true,seller:p.seller,priceList:r['Lista Precios']?findMaster(s,'priceLists',r['Lista Precios']):p.priceList,total:kind==='saldo'?cents(num(r.Saldo,'Saldo')):undefined},role)
  return
 }
 if(spec.id==='clientes'||spec.id==='proveedores') {
  const side=spec.id==='clientes'?'cliente':'proveedor'
  if(s.parties.some(p=>p.side===side&&p.code===r.Codigo))throw new Error('El código ya existe. La importación de altas no modifica datos existentes.')
  const p:Party={id:uid(),side,code:r.Codigo,name:r['Razon Social'],cuit:r.CUIT,iva:r['Condicion IVA'],address:r.Domicilio||'',province:r.Provincia||s.settings.province,phone:r.Telefono||'',email:r.Mail||'',paymentTerms:r['Condicion Pago']||'Cuenta corriente 30 días',priceList:r['Lista Precios']?findMaster(s,'priceLists',r['Lista Precios']):'general',discount:num(r.Descuento||'0','Descuento'),seller:r.Vendedor?party(s,r.Vendedor,'proveedor').id:'',commission:num(r.Comision||'0','Comision'),paymentMethod:r['Forma Pago']||'',transport:r.Transporte||'',category:r.Rubro||''};saveParty(s,p)
 } else if(spec.id==='productos') {
  if(s.products.some(p=>p.sku===r.SKU))throw new Error('El SKU ya existe. Usá Stock o Precios para actualizarlo.')
  if(!taxRates.includes(r.IVA))throw new Error('IVA: alícuota no reconocida.')
  if(r.Unidad&&!units.includes(r.Unidad))throw new Error('Unidad no reconocida.')
  const p:Product={id:uid(),sku:r.SKU,name:r.Descripcion,kind:r.Tipo||'Producto',category:r.Rubro||'',subcategory:r.Subrubro||'',tax:r.IVA,barcode:r['Codigo de barras']||'',minimum:num(r['Stock Minimo']||'0','Stock Minimo'),supplier:r.Proveedor?party(s,r.Proveedor,'proveedor').id:'',negative:boolean(r['Acepta Stock Negativo']||''),brand:r.Marca||'',model:r.Modelo||'',variants:r['Utiliza variantes']||'',unit:r.Unidad||'Unidad',price:cents(num(r.Precio||'0','Precio')),cost:cents(num(r.Costo||'0','Costo')),parent:r.Padre?product(s,r.Padre).id:''};saveProduct(s,p)
  if(r['Stock Real']) {requireAdmin(role);const q=num(r['Stock Real'],'Stock Real');if(q!==0)adjustStock(s,role,p.id,r.Deposito?findMaster(s,'deposits',r.Deposito):'principal',q,'Stock inicial por importación',today())}
 } else if(spec.id==='stock') {
  const p=product(s,r.SKU),depositId=findMaster(s,'deposits',r.Deposito),current=s.stockMoves.filter(m=>m.productId===p.id&&m.depositId===depositId).reduce((n,m)=>n+m.quantity,0),target=num(r['Stock Real'],'Stock Real');if(target!==current)adjustStock(s,role,p.id,depositId,target-current,r.Motivo||'Actualización masiva de stock',today())
 } else if(spec.id==='variantes') saveMaster(s,'variants',{id:uid(),name:r.Nombre||`${r.SKU} ${r.Atributo} ${r.Valor}`,productId:product(s,r.SKU).id,attribute:r.Atributo,value:r.Valor},role)
 else if(spec.id==='ecommerce')saveMaster(s,'ecommerce',{id:uid(),name:r.Nombre||`${r.SKU} ${r.Plataforma}`,productId:product(s,r.SKU).id,platform:r.Plataforma,externalId:r['ID Externo']},role)
 else if(spec.id==='combos')saveMaster(s,'combos',{id:uid(),name:r.Nombre,components:r.Componentes,price:num(r.Precio,'Precio')},role)
 else if(spec.id==='listas-precios')saveMaster(s,'priceLists',{id:uid(),name:r.Nombre,branchId:findMaster(s,'branches',r.Sucursal),adjustment:num(r.Ajuste,'Ajuste')},role)
 else if(spec.id==='precios') {const productId=product(s,r.SKU).id,priceList=findMaster(s,'priceLists',r['Lista Precios']),existing=s.masters.prices.find(x=>x.productId===productId&&x.priceList===priceList),price=cents(num(r.Precio,'Precio'));if(price<0)throw new Error('El precio no puede ser negativo.');saveMaster(s,'prices',{id:existing?.id||uid(),name:`${r.SKU} ${r['Lista Precios']}`,productId,priceList,price},role)}
}
export function processImport(state:State,spec:ImportSpec,rows:Record<string,string>[],role:Role,commit=false):ImportPreview {
 let working=structuredClone(state)
 const errors:ImportError[]=[],validRows:number[]=[]
 const grouped=new Map<string,Record<string,string>[]>()
 const documentType=['pedidos','ordenes','compras'].includes(spec.id)
 rows.forEach((r,i)=>{const key=documentType?(r.Referencia||String(i)):String(i);grouped.set(key,[...(grouped.get(key)||[]),r])})
 for(const group of grouped.values()) {
  const trial=structuredClone(working)
  try{applyRows(trial,spec,group,role);working=trial;validRows.push(...group.map(r=>Number(r.__row)))}
  catch(e){const message=e instanceof Error?e.message:'Error de validación';group.forEach(r=>errors.push({row:Number(r.__row),field:message.includes(':')?message.split(':')[0]:'Registro',message}))}
 }
 if(commit)Object.assign(state,working)
 return {errors,validRows,total:rows.length}
}
