import {initialState} from '../.server/domain/seed.js'
import {loadTextileDemo} from '../.server/domain/demo.js'
export const multiCompanyConfigs=[
 {id:'textil',label:'SICA Textil · Tucumán',filename:'var/qa-multi-textil.sqlite',adminPassword:'Sica-Multi-Textil-QA-2026'},
 {id:'servicios',label:'SICA Servicios · Tucumán',filename:'var/qa-multi-servicios.sqlite',adminPassword:'Sica-Multi-Servicios-QA-2026'},
]
export function multiCompanyFixture(id){
 const state=initialState();loadTextileDemo(state)
 state.settings.name=id==='textil'?'SICA Textil · Empresa de ensayo':'SICA Servicios · Empresa de ensayo'
 state.masters.notes=[{id:'same-note-id',name:id==='textil'?'Nota exclusiva de Textil':'Nota exclusiva de Servicios',text:`Información sintética propia de ${id}.`}]
 return state
}
