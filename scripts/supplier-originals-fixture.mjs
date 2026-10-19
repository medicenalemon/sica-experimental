import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument} from '../.server/domain/engine.js'
export function supplierOriginalsFixture(){
 const state=initialState();loadTextileDemo(state);state.settings.name='SICA Textil · Originales de proveedores';state.settings.cuit='30712345671'
 const supplier=state.parties.find(p=>p.side==='proveedor'),product=state.products.find(p=>p.sku==='REM-M-NEG'),base={side:'proveedor',partyId:supplier.id,branchId:'central',date:'2026-10-01',due:'2026-10-05',letter:'A',sourceId:'',depositId:'principal',perceptions:0,observations:'Compra sintética para identificar su comprobante recibido',responsible:'Administrador',costCenter:'',official:false,valued:false,seller:'',priceList:'',payments:[],allocations:[]}
 const invoice=createDocument(state,{...base,kind:'factura',lines:[{productId:product.id,description:product.name,quantity:2,unit:product.unit,price:50000,tax:'21',discount:0}]},'Administrador General')
 const other=createDocument(state,{...base,kind:'factura',date:'2026-10-02',lines:[{productId:product.id,description:product.name,quantity:1,unit:product.unit,price:30000,tax:'21',discount:0}]},'Administrador General')
 const input={documentId:invoice.id,documentKind:'factura',date:'2026-10-15',previousId:'',issuerCuit:supplier.cuit,receiverCuit:state.settings.cuit,point:4,number:42,authorization:'CAE',code:'12345678901234',expires:'2026-10-11',reference:'ORIG-ENSAYO-01',reason:'Datos copiados del comprobante sintético recibido.'}
 return {state,supplier,product,invoice,other,input}
}
