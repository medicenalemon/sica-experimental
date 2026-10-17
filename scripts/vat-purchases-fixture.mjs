export function vatPurchasesFixture({initialState,loadTextileDemo,createDocument,previewSupplierOriginal,identifySupplierOriginal,supplierOriginalReview}){
 const state=initialState();loadTextileDemo(state);state.settings.name='SICA Textil · IVA compras';state.settings.cuit='30712345671';state.settings.exerciseStart='2026-01-01';state.settings.exerciseEnd='2026-12-31';state.settings.closedUntil=''
 const actor={userId:'admin',name:'Administrador',role:'Administrador General',permissions:[]},supplier=state.parties.find(p=>p.side==='proveedor');supplier.name='Textiles Ñandú SA';supplier.cuit='20123456786'
 const cSupplier={...supplier,id:'supplier-c',code:'PRO-C',name:'Proveedor C de ensayo',cuit:'30712345671',iva:'Responsable Monotributo'};state.parties.push(cSupplier)
 state.masters.branches.push({id:'iva-other-branch',name:'Sucursal de ensayo IVA',point:2,active:true})
 const product=state.products.find(p=>p.sku==='REM-M-NEG'),byTax={'21':product}
 for(const [i,tax]of ['10.5','Exento','No gravado','27','0'].entries()){const p={...product,id:`iva-product-${i}`,sku:`IVA-${i}`,name:`Artículo de ensayo IVA ${tax}`,parent:'',variants:''};state.products.push(p);byTax[tax]=p}
 const line=(price,tax)=>({productId:byTax[tax].id,description:byTax[tax].name,quantity:1,unit:'Unidad',price,tax,discount:0})
 const document={kind:'factura',side:'proveedor',letter:'A',date:'2026-10-15',due:'2026-10-30',branchId:'central',partyId:supplier.id,lines:[line(10000,'21'),line(20000,'10.5'),line(5000,'Exento'),line(2000,'No gravado')],payments:[],perceptions:300,sourceId:'',allocations:[],observations:'Datos sintéticos para preparar IVA compras.',responsible:actor.name,costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const invoice=createDocument(state,document,actor.role)
 const credit=createDocument(state,{...document,kind:'credito',date:'2026-10-16',sourceId:invoice.id,perceptions:0,lines:[line(1000,'21')]},actor.role)
 const debit=createDocument(state,{...document,kind:'debito',date:'2026-10-16',sourceId:invoice.id,perceptions:0,lines:[line(1000,'27')]},actor.role)
 // Historical B received while the company was exempt; current RI status does not turn it into deductible A.
 state.settings.iva='Exento'
 const b=createDocument(state,{...document,letter:'B',date:'2026-10-17',branchId:'iva-other-branch',perceptions:40,lines:[line(2420,'21'),line(600,'Exento')]},actor.role)
 state.settings.iva='Responsable Inscripto'
 const c=createDocument(state,{...document,letter:'C',date:'2026-10-17',partyId:cSupplier.id,perceptions:0,lines:[line(3000,'21')]},actor.role)
 const x=createDocument(state,{...document,letter:'X',date:'2026-10-17',perceptions:0,lines:[line(700,'21')]},actor.role)
 for(const [i,d]of [invoice,credit,debit,b,c].entries()){const original={documentId:d.id,documentKind:d.kind,date:'2026-10-17',previousId:'',issuerCuit:state.parties.find(p=>p.id===d.partyId).cuit,receiverCuit:state.settings.cuit,point:4,number:i+1,authorization:'Sin consignar',code:'',expires:'',reference:`IVA-ORIG-${i+1}`,reason:'Original sintético sin constatación; prueba del diseño de archivos.'};original.review=supplierOriginalReview(previewSupplierOriginal(state,original));identifySupplierOriginal(state,original,actor)}
 const input={period:'2026-10',previousId:'',reference:'IVA-COMPRAS-ENSAYO-01',reason:'Asignación directa sintética revisada; comprobar archivos y conservación de originales.',mode:'Asignación directa',scopeConfirmed:true,credits:[{documentId:invoice.id,amount:3000},{documentId:credit.id,amount:100},{documentId:debit.id,amount:200},{documentId:b.id,amount:0},{documentId:c.id,amount:0}]}
 return {state,actor,input,invoice,credit,debit,b,c,x,document,line,supplier}
}
