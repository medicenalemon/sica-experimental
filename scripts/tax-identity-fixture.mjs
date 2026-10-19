export function taxIdentityFixture({initialState,loadTextileDemo,createDocument},date){
 const state=initialState();loadTextileDemo(state)
 Object.assign(state.settings,{name:'SICA Textil · identidad impositiva de ensayo',cuit:'30712345671',exerciseStart:'2026-01-01',exerciseEnd:'2026-12-31'})
 state.stockMoves.forEach(m=>m.date='2026-01-01')
 const customer=state.parties.find(p=>p.side==='cliente'),supplier=state.parties.find(p=>p.side==='proveedor')
 supplier.cuit='30765432109';customer.seller='';customer.commission=0
 const product=state.products.find(p=>p.kind==='Producto')
 const base={kind:'factura',side:'cliente',letter:'A',date,due:date,branchId:'central',partyId:customer.id,lines:[{productId:product.id,description:product.name,quantity:1,unit:product.unit,price:10000,tax:'21',discount:0}],payments:[],allocations:[],perceptions:0,sourceId:'',observations:'Datos sintéticos de ensayo',responsible:'Operador de ensayo',costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const post=patch=>createDocument(state,{...structuredClone(base),...patch},'Administrador General')
 const invoice=post({perceptions:100,perceptionEvidence:{tax:'Ingresos Brutos',jurisdiction:'Tucumán',reference:'REG-IDENTITY-UI'}})
 const receipt=post({kind:'cobro',letter:'X',lines:[],payments:[{method:'Retención',amount:200,treasuryId:'',reference:'CERT-ORIGIN-UI',tax:'IVA',jurisdiction:''}]})
 const legacy=post({side:'proveedor',partyId:supplier.id,perceptions:50,perceptionEvidence:{tax:'Ingresos Brutos',jurisdiction:'Tucumán',reference:'REG-LEGACY-UI'}});delete legacy.taxIdentity
 const coupon=post({kind:'cobro',letter:'X',lines:[],payments:[{method:'Tarjeta de crédito',amount:10000,treasuryId:'',reference:'COUPON-IDENTITY-UI',cardId:'visa'}]})
 return {state,base,customer,supplier,invoice,receipt,legacy,coupon}
}
