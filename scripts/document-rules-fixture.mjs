export function documentRulesFixture({initialState,loadTextileDemo,createDocument},date='2026-10-18'){
 const state=initialState();loadTextileDemo(state)
 Object.assign(state.settings,{name:'SICA Textil · comprobantes consistentes de ensayo',cuit:'30712345671',exerciseStart:'2026-01-01',exerciseEnd:'2026-12-31'})
 state.stockMoves.forEach(m=>m.date='2026-01-01')
 const customer=state.parties.find(p=>p.side==='cliente'),supplier=state.parties.find(p=>p.side==='proveedor'),product=state.products.find(p=>p.kind==='Producto')
 customer.seller='';customer.commission=0;supplier.cuit='30765432109'
 const base={kind:'factura',side:'cliente',letter:'A',date,due:date,branchId:'central',partyId:customer.id,lines:[{productId:product.id,description:product.name,quantity:1,unit:product.unit,price:10000,tax:'21',discount:0}],payments:[],allocations:[],perceptions:0,sourceId:'',observations:'Datos sintéticos de ensayo',responsible:'Operador de ensayo',costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const post=patch=>createDocument(state,{...structuredClone(base),...patch},'Administrador General')
 const invoice=post({}),future=post({date:'2026-10-20',due:'2026-10-20',lines:[{...base.lines[0],price:5000}]}),purchase=post({side:'proveedor',partyId:supplier.id})
 return {state,base,customer,supplier,invoice,future,purchase}
}
