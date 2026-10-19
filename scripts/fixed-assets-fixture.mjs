import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,saveProduct} from '../.server/domain/engine.js'
import {prepareFixedAssetAccounts,previewFixedAsset,fixedAssetReview} from '../.server/domain/fixed-assets.js'
export function fixedAssetsFixture(actor){
 const state=initialState();loadTextileDemo(state);state.stockMoves=[];state.settings.exerciseStart='2026-01-01';state.settings.exerciseEnd='2026-12-31';state.settings.name='SICA QA - BIENES DE USO'
 prepareFixedAssetAccounts(state,actor)
 const product={...state.products.find(p=>p.sku==='REM-M-NEG'),id:'fixed-machine',sku:'BU-MACHINE',name:'Equipo textil sintético',kind:'Bien de uso',parent:'',minimum:0};saveProduct(state,product)
 const supplier=state.parties.find(p=>p.side==='proveedor'),document={kind:'remito',side:'proveedor',letter:'X',date:'2026-10-01',due:'2026-10-01',branchId:'central',partyId:supplier.id,lines:[{productId:product.id,description:product.name,quantity:1,unit:product.unit,price:100000,tax:'21',discount:0}],payments:[],perceptions:0,sourceId:'',allocations:[],observations:'Equipo recibido para ensayo sintético. Vida útil corta sólo para verificar el cálculo, sin tasa fiscal presumida.',responsible:actor.name,costCenter:'',depositId:'principal',official:false,valued:true,seller:'',priceList:'general'}
 const receipt=createDocument(state,document,actor.role),invoice=createDocument(state,{...document,kind:'factura',letter:'A',sourceId:receipt.id},actor.role),asset={date:'2026-10-01',invoiceId:invoice.id,productId:product.id,reference:'Alta sintética QA 2026',reason:'Equipo de ensayo recibido para uso propio. Costo según factura; vida útil sintética de 30 días y residual de 100 ARS para verificar el cálculo, sin tasa fiscal presumida.',name:'Equipo textil QA',assetClass:'Maquinarias',location:'Casa Central, sala de ensayo',assetAccountId:'1.2.1',accumulatedAccountId:'1.2.2',expenseAccountId:'5.9',method:'Lineal diaria',commissionedOn:'2026-10-01',usefulLifeEnd:'2026-10-31',residual:10000}
 const reviewed=()=>({...asset,review:fixedAssetReview(previewFixedAsset(state,asset))})
 return {state,receipt,invoice,asset,reviewed,product,supplier}
}
