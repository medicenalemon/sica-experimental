import type { State, Party, Product } from './types'
import { saveParty, saveProduct, adjustStock } from './engine'
import { today, uid } from './constants'
export function loadTextileDemo(s:State) {
 if(s.products.length||s.parties.length||s.documents.length)throw new Error('El ejemplo se carga solo en una base sin productos, contrapartes ni operaciones.')
 s.settings.name='SICA Textil · Empresa de prueba';s.settings.industry='Comercio textil';s.settings.province='Tucumán';s.settings.iva='Responsable Inscripto';s.settings.skuMode='Madre-Hijo-Nieto';s.settings.onboarding=true
 const provider:Party={id:uid(),side:'proveedor',code:'PRO-00001',name:'Proveedor textil de prueba',cuit:'30712345671',iva:'Responsable Inscripto',address:'San Miguel de Tucumán',province:'Tucumán',phone:'',email:'',paymentTerms:'Cuenta corriente 30 días',priceList:'general',discount:0,seller:'',commission:0,paymentMethod:'Transferencia',transport:'Retira en sucursal',category:'Ropa y Accesorios',isSeller:true}
 const client:Party={...provider,id:uid(),side:'cliente',code:'CLI-00001',name:'Cliente mayorista de prueba',cuit:'20123456786',category:'',seller:provider.id,commission:3}
 saveParty(s,provider);saveParty(s,client)
 const base:Product={id:uid(),sku:'REM',name:'Remera de algodón',kind:'Producto',category:'Ropa y Accesorios',subcategory:'Indumentaria',tax:'21',barcode:'',minimum:5,supplier:provider.id,negative:false,brand:'SICA Demo',model:'Clásica',parent:'',variants:'Talle, Color',unit:'Unidad',price:1500000,cost:800000}
 saveProduct(s,base)
 const child={...base,id:uid(),sku:'REM-M',name:'Remera de algodón · Talle M',parent:base.id};saveProduct(s,child)
 const item={...base,id:uid(),sku:'REM-M-NEG',name:'Remera de algodón · M · Negro',parent:child.id};saveProduct(s,item)
 const trousers={...base,id:uid(),sku:'PANT-42-AZ',name:'Pantalón · 42 · Azul',parent:'',price:3000000,cost:1800000};saveProduct(s,trousers)
 adjustStock(s,'Administrador General',item.id,'principal',40,'Stock inicial de ejemplo (sin valuación contable)',today())
 adjustStock(s,'Administrador General',trousers.id,'principal',20,'Stock inicial de ejemplo (sin valuación contable)',today())
 s.masters.variants.push({id:uid(),name:'Talle M',attribute:'Talle',value:'M',productId:item.id},{id:uid(),name:'Negro',attribute:'Color',value:'Negro',productId:item.id})
 s.masters.treasury.push({id:'banco-demo',name:'Banco de prueba',type:'Banco',branchId:'central',bank:'nacion',cbu:'',accountId:'1.1.2'})
 s.masters.notes.push({id:uid(),name:'Datos de ejemplo',text:'Los CUIT son datos sintéticos para probar el dígito verificador. No se consultó el padrón ni se verificó la existencia de los contribuyentes. Reemplazar antes de cualquier uso real.'})
}
