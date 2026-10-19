import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
import {executeCommand} from '../.server/domain/commands.js'
import {today} from '../.server/domain/constants.js'
export async function bankGroupsFixture(){
 const state=initialState(),date=today(),actor={userId:'admin',name:'Administrador',role:'Administrador General',permissions:[]}
 loadTextileDemo(state);state.settings.name='SICA Textil · Conciliación agrupada de ensayo'
 const party=state.parties.find(p=>p.side==='cliente')
 await executeCommand(state,actor,{type:'document.create',document:{kind:'cobro',side:'cliente',letter:'X',date,due:date,branchId:'central',partyId:party.id,lines:[],payments:[{method:'Transferencia',amount:600000,treasuryId:'banco-demo',reference:'ANTICIPO-GRUPO'}],allocations:[],perceptions:0,sourceId:'',observations:'Anticipo sintético para verificar dos acreditaciones bancarias.',responsible:'Administrador',costCenter:'',depositId:'principal',official:false,valued:false,seller:'',priceList:'general'}})
 await executeCommand(state,actor,{type:'bank.import',statement:{treasuryId:'banco-demo',name:'Dos acreditaciones de un anticipo',from:date,to:date,opening:0,closing:590000,lines:[{date,reference:'ACRED-1',description:'Primera acreditación del anticipo',amount:200000},{date,reference:'ACRED-2',description:'Segunda acreditación del anticipo',amount:400000},{date,reference:'CARGO-1',description:'Cargo bancario pendiente de registrar',amount:-10000}]}})
 const statement=state.bankStatements[0],move=state.treasuryMoves.find(m=>m.treasuryId==='banco-demo')
 return {state,statement,move,actor}
}
