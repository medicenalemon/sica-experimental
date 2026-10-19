import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {createDocument,settleCards} from '../.server/domain/engine.js'
import {prepareCardClaimAccounts} from '../.server/domain/card-disputes.js'
import {today} from '../.server/domain/constants.js'
export function cardDisputesFixture(){
 const state=initialState(),actor={userId:'admin',name:'Administrador',role:'Administrador General',permissions:[]},date=today();loadTextileDemo(state);state.settings.name='SICA Textil · Contracargos de ensayo'
 const product=state.products.find(p=>p.sku==='REM-M-NEG'),party=state.parties.find(p=>p.side==='cliente'),base={side:'cliente',partyId:party.id,branchId:'central',date,due:date,sourceId:'',depositId:'principal',perceptions:0,observations:'Ensayo sintético de tarjeta',responsible:actor.name,costCenter:'',official:false,valued:false,seller:'',priceList:''}
 const invoice=createDocument(state,{...base,kind:'factura',letter:'A',lines:[{productId:product.id,description:product.name,quantity:2,unit:product.unit,price:50000,tax:'21',discount:0}],payments:[],allocations:[]},actor.role)
 const receipt=createDocument(state,{...base,kind:'cobro',letter:'X',lines:[],payments:[{method:'Tarjeta de crédito',amount:100000,treasuryId:'',reference:'CUP-CB-ENSAYO',cardId:'visa'}],allocations:[{documentId:invoice.id,amount:100000}]},actor.role)
 const bank=state.masters.treasury.find(t=>t.type==='Banco'),settlement=settleCards(state,{date,reference:'LIQ-CB-ENSAYO',branchId:'central',treasuryId:bank.id,cardId:'visa',items:[{receiptId:receipt.id,paymentIndex:0,amount:100000}],fee:3000,withholdings:[{method:'Retención',amount:2000,treasuryId:'',reference:'CERT-CB-ENSAYO',agentUnknownReason:'Agente no identificado en el respaldo sintético de ensayo',tax:'Ingresos Brutos',jurisdiction:'Tucumán'}]},actor.role)
 prepareCardClaimAccounts(state,actor)
 const input={receiptId:receipt.id,paymentIndex:0,settlementId:settlement.id,date,reference:'CB-ENSAYO-01',reason:'Notificación de procesadora; respuesta incierta en este ensayo.',amount:40000,claimAccountId:'card-dispute-asset',lossAccountId:'card-dispute-loss',recoveryAccountId:'card-dispute-recovery',treatment:'Reclamo contingente',assetConfirmed:false}
 return {state,actor,date,invoice,receipt,bank,settlement,input}
}
