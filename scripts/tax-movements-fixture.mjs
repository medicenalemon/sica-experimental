export function taxMovementsFixture({initialState,loadTextileDemo,createDocument,settleCards}){
 const state=initialState();loadTextileDemo(state);state.settings.cuit='30712345671';state.settings.exerciseStart='2026-01-01';state.settings.exerciseEnd='2026-12-31';state.stockMoves.forEach(m=>m.date='2026-01-01');state.masters.branches.push({id:'north-tax',name:'Sucursal norte de ensayo',point:'2',active:true})
 const customer=state.parties.find(p=>p.side==='cliente'),supplier=state.parties.find(p=>p.side==='proveedor'&&!p.isSeller)||state.parties.find(p=>p.side==='proveedor'),product=state.products.find(p=>p.kind==='Producto'),date='2026-09-05'
 const base={kind:'factura',side:'cliente',letter:'A',date,due:date,branchId:'central',partyId:customer.id,lines:[{productId:product.id,description:product.name,quantity:1,unit:product.unit,price:10000,tax:'21',discount:0}],payments:[],allocations:[],perceptions:0,sourceId:'',observations:'Ensayo impositivo sintético',responsible:'Administrador de ensayo',costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 supplier.cuit='30765432109'
 const post=patch=>createDocument(state,{...structuredClone(base),...patch},'Administrador General'),evidence=(jurisdiction,reference)=>({tax:'Ingresos Brutos',jurisdiction,reference})
 const sale=post({perceptions:300,perceptionEvidence:evidence('Tucumán','REG-SALES-TEST')})
 const receipt=post({kind:'cobro',letter:'X',lines:[],payments:[{method:'Efectivo',amount:12150,treasuryId:'caja-principal',reference:''},...[100,150].map(amount=>({method:'Retención',amount,treasuryId:'',reference:'CERT-SHARED',tax:'Ingresos Brutos',jurisdiction:'Tucumán'}))],allocations:[{documentId:sale.id,amount:sale.total}]})
 post({kind:'credito',sourceId:sale.id,lines:[{...base.lines[0],price:1000}],perceptions:100,perceptionEvidence:evidence('Tucumán','REG-SALES-TEST')})
 const purchase=post({side:'proveedor',partyId:supplier.id,perceptions:500,perceptionEvidence:evidence('Córdoba','REG-PURCHASE-TEST')})
 post({kind:'pago',side:'proveedor',partyId:supplier.id,letter:'X',lines:[],payments:[{method:'Efectivo',amount:12550,treasuryId:'caja-principal',reference:''},{method:'Retención',amount:50,treasuryId:'',reference:'CERT-PAY',tax:'Ganancias',jurisdiction:''}],allocations:[{documentId:purchase.id,amount:purchase.total}]})
 post({kind:'credito',side:'proveedor',partyId:supplier.id,sourceId:purchase.id,lines:[{...base.lines[0],price:1000}],perceptions:200,perceptionEvidence:evidence('Córdoba','REG-PURCHASE-TEST')})
 const legacy=post({side:'proveedor',partyId:supplier.id,perceptions:400,observations:'Percepción IIBB Salta · texto que no sustituye identificación estructurada'})
 const internal=post({letter:'X',perceptions:700,perceptionEvidence:evidence('Tucumán','REG-INTERNAL')})
 post({side:'proveedor',partyId:supplier.id,branchId:'north-tax',perceptions:250,perceptionEvidence:evidence('Salta','REG-NORTH')})
 const card=state.masters.cards[0],coupon=post({kind:'cobro',letter:'X',lines:[],payments:[{method:'Tarjeta de crédito',amount:6050,treasuryId:'',reference:'COUPON-TAX-TEST',cardId:card.id}],allocations:[]})
 const settlement=settleCards(state,{reference:'SETTLEMENT-TAX-TEST',date,branchId:'central',treasuryId:'banco-demo',cardId:card.id,items:[{receiptId:coupon.id,paymentIndex:0,amount:6050}],fee:50,withholdings:[{method:'Retención',amount:300,treasuryId:'',reference:'CERT-CARD',agentUnknownReason:'Agente no identificado en el respaldo sintético de ensayo',tax:'IVA',jurisdiction:''}]},'Administrador General')
 return {state,base,sale,receipt,purchase,legacy,internal,settlement,customer,supplier,post}
}
