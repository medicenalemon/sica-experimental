import {withinExerciseHistory,withinSingleExercise} from './exercise-calendar'
import type { State, Session, BankStatement, BankStatementInput } from './types'
import { uid } from './constants'
import { canAccess } from './permissions'

const path='/finanzas/bancos/extractos'
const day=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s
const amount=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)
function sum(values:number[]){let n=0;for(const value of values){n+=value;if(!Number.isSafeInteger(n))throw new Error('Los importes del extracto exceden el rango admitido.')}return n}
function access(actor:Session){if(!canAccess(actor,path))throw new Error('Tu perfil no permite gestionar extractos bancarios.')}
function header(state:State,input:BankStatementInput,historical=false) {
 const account=state.masters.treasury.find(t=>t.id===input.treasuryId&&t.type==='Banco')
 if(!account||!state.masters.branches.some(b=>b.id===account.branchId))throw new Error('Seleccioná una cuenta bancaria de una sucursal existente.')
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>200||!day(input.from)||!day(input.to)||input.to<input.from||(historical?!withinSingleExercise(state,input.from,input.to):input.from<state.settings.exerciseStart||input.to>state.settings.exerciseEnd))throw new Error('Indicá referencia y período del extracto dentro del ejercicio.')
 if(!amount(input.opening)||!amount(input.closing)||!Array.isArray(input.lines)||!input.lines.length||input.lines.length>5000)throw new Error('Saldos inválidos o extracto sin movimientos; se admiten hasta 5000 filas.')
 const refs=new Set<string>()
 for(const l of input.lines){if(!day(l.date)||l.date<input.from||l.date>input.to||!amount(l.amount)||l.amount===0||typeof l.reference!=='string'||!l.reference.trim()||l.reference.length>120||typeof l.description!=='string'||!l.description.trim()||l.description.length>500||refs.has(l.reference.trim()))throw new Error('Cada fila necesita fecha del período, importe firmado no nulo, descripción y referencia única.');refs.add(l.reference.trim())}
 if(sum([input.opening,...input.lines.map(l=>l.amount)])!==input.closing)throw new Error('El saldo inicial más los movimientos no coincide con el saldo final del extracto.')
 return account
}
export function importBankStatement(state:State,input:BankStatementInput,actor:Session):BankStatement {
 access(actor);const account=header(state,input)
 if(!state.masters.branches.some(b=>b.id===account.branchId&&b.active))throw new Error('La sucursal de la cuenta bancaria debe estar activa.')
 const existing=(state.bankStatements||[]).filter(s=>s.status==='Activo'&&s.treasuryId===input.treasuryId)
 if(existing.some(s=>s.from<=input.to&&s.to>=input.from))throw new Error('La cuenta ya tiene un extracto activo que se superpone con ese período. Anulá el anterior sin vínculos antes de reemplazarlo.')
 const references=new Set(existing.flatMap(s=>s.lines.map(l=>l.reference)))
 if(input.lines.some(l=>references.has(l.reference.trim())))throw new Error('Una referencia de movimiento ya está cargada en otro extracto activo de la cuenta.')
 const statement:BankStatement={treasuryId:input.treasuryId,from:input.from,to:input.to,opening:input.opening,closing:input.closing,id:uid(),branchId:String(account.branchId),accountName:String(account.name),name:input.name.trim(),status:'Activo',importedBy:actor.name,importedAt:new Date().toISOString(),events:[],lines:input.lines.map(l=>({id:uid(),date:l.date,reference:l.reference.trim(),description:l.description.trim(),amount:l.amount,treasuryMoveIds:[]}))}
 ;(state.bankStatements??=[]).push(statement);return statement
}
function event(s:BankStatement,actor:Session,action:BankStatement['events'][number]['action'],lineId:string,moveIds:string[],note:string){s.events.push({id:uid(),action,lineId,moveIds:[...moveIds],note,user:actor.name,at:new Date().toISOString()})}
export function bankLineGroup(s:BankStatement,lineId:string){return s.groups?.find(g=>g.lineIds.includes(lineId))}
export function matchBankGroup(state:State,statementId:string,lineIds:string[],moveIds:string[],note:string,actor:Session){
 access(actor)
 const s=state.bankStatements?.find(s=>s.id===statementId&&s.status==='Activo')
 if(!s||!Array.isArray(lineIds)||lineIds.length<2||lineIds.length>100||new Set(lineIds).size!==lineIds.length||!Array.isArray(moveIds)||!moveIds.length||moveIds.length>100||new Set(moveIds).size!==moveIds.length||typeof note!=='string'||!note.trim()||note.length>500)throw new Error('Elegí entre 2 y 100 filas pendientes, entre 1 y 100 movimientos sin repetir y un fundamento para agruparlos.')
 const rows=lineIds.map(id=>s.lines.find(l=>l.id===id)),moves=moveIds.map(id=>state.treasuryMoves.find(m=>m.id===id)),sign=Math.sign(rows[0]?.amount||0)
 if(rows.some(l=>!l||l.treasuryMoveIds.length||bankLineGroup(s,l.id)||Math.sign(l.amount)!==sign))throw new Error('Las filas del grupo deben estar pendientes en el mismo extracto y tener el mismo signo.')
 if(moves.some(m=>!m||m.treasuryId!==s.treasuryId||m.branchId!==s.branchId||!day(m.date)||!withinExerciseHistory(state,m.date)||m.reconciled||m.bankStatementLineId||Math.sign(m.amount)!==sign))throw new Error('Los movimientos deben ser pendientes, de la misma cuenta y sucursal y tener el mismo signo que las filas bancarias.')
 if(sum(rows.map(l=>l!.amount))!==sum(moves.map(m=>m!.amount)))throw new Error('El total de las filas bancarias debe coincidir exactamente con el total de los movimientos seleccionados.')
 const group={id:uid(),lineIds:[...lineIds],moveIds:[...moveIds]}
 ;(s.groups??=[]).push(group)
 for(const l of rows)l!.treasuryMoveIds=[...moveIds]
 for(const m of moves){m!.reconciled=true;m!.bankStatementLineId=lineIds[0]}
 event(s,actor,'Vincular',lineIds[0],moveIds,note.trim());Object.assign(s.events.at(-1)!,{groupId:group.id,lineIds:[...lineIds]})
 return `${s.name} · ${rows.map(l=>l!.reference).join(', ')}`
}
export function matchBankLine(state:State,statementId:string,lineId:string,moveIds:string[],note:string,actor:Session) {
 access(actor)
 const s=state.bankStatements?.find(s=>s.id===statementId&&s.status==='Activo'),line=s?.lines.find(l=>l.id===lineId)
 if(!s||!line||line.treasuryMoveIds.length||!Array.isArray(moveIds)||!moveIds.length||moveIds.length>100||new Set(moveIds).size!==moveIds.length||typeof note!=='string'||note.length>500)throw new Error('Elegí una fila pendiente y entre 1 y 100 movimientos sin repetir.')
 const moves=moveIds.map(id=>state.treasuryMoves.find(m=>m.id===id))
 if(moves.some(m=>!m||m.treasuryId!==s.treasuryId||m.branchId!==s.branchId||!day(m.date)||!withinExerciseHistory(state,m.date)||m.reconciled||m.bankStatementLineId||Math.sign(m.amount)!==Math.sign(line.amount)))throw new Error('Los movimientos deben ser pendientes, de la misma cuenta y tener el mismo signo que la fila bancaria.')
 if(sum(moves.map(m=>m!.amount))!==line.amount)throw new Error('La suma de los movimientos seleccionados debe coincidir exactamente con el importe bancario.')
 line.treasuryMoveIds=[...moveIds]
 for(const m of moves){m!.reconciled=true;m!.bankStatementLineId=line.id}
 event(s,actor,'Vincular',line.id,moveIds,note.trim());return `${s.name} · ${line.reference}`
}
export function unmatchBankLine(state:State,statementId:string,lineId:string,note:string,actor:Session) {
 access(actor)
 const s=state.bankStatements?.find(s=>s.id===statementId&&s.status==='Activo'),line=s?.lines.find(l=>l.id===lineId)
 if(!s||!line||!line.treasuryMoveIds.length||typeof note!=='string'||!note.trim()||note.length>500)throw new Error('Elegí una fila vinculada e indicá el motivo para deshacer la conciliación.')
 const group=bankLineGroup(s,line.id),anchor=group?.lineIds[0]||line.id
 const moves=line.treasuryMoveIds.map(id=>state.treasuryMoves.find(m=>m.id===id))
 if(moves.some(m=>!m||m.bankStatementLineId!==anchor))throw new Error('Los vínculos del extracto no coinciden con la tesorería.')
 event(s,actor,'Desvincular',anchor,line.treasuryMoveIds,note.trim())
 if(group){Object.assign(s.events.at(-1)!,{groupId:group.id,lineIds:[...group.lineIds]});for(const id of group.lineIds)s.lines.find(l=>l.id===id)!.treasuryMoveIds=[];s.groups=s.groups!.filter(g=>g.id!==group.id)}
 for(const m of moves){m!.reconciled=false;delete m!.bankStatementLineId}
 line.treasuryMoveIds=[];return `${s.name} · ${line.reference}`
}
export function cancelBankStatement(state:State,id:string,note:string,actor:Session) {
 access(actor);const s=state.bankStatements?.find(s=>s.id===id&&s.status==='Activo')
 if(!s||s.lines.some(l=>l.treasuryMoveIds.length)||typeof note!=='string'||!note.trim()||note.length>500)throw new Error('Desvinculá todas las filas e indicá un motivo antes de anular el extracto.')
 s.status='Anulado';event(s,actor,'Anular','',[],note.trim());return s.name
}
export function manualReconciliation(state:State,id:string,reconciled:boolean) {
 const m=state.treasuryMoves.find(m=>m.id===id)
 if(!m||typeof reconciled!=='boolean')throw new Error('Movimiento de conciliación inválido.')
 if(m.bankStatementLineId||(state.bankStatements||[]).some(s=>s.lines.some(l=>l.treasuryMoveIds.includes(id))))throw new Error('Desvinculá el movimiento desde su extracto para conservar la trazabilidad.')
 m.reconciled=reconciled;return m.reason
}
export function bankCandidates(state:State,s:BankStatement,line:BankStatement['lines'][number]) {
 return state.treasuryMoves.filter(m=>m.treasuryId===s.treasuryId&&m.branchId===s.branchId&&day(m.date)&&!m.reconciled&&!m.bankStatementLineId&&Math.sign(m.amount)===Math.sign(line.amount)).map(m=>({...m,distance:Math.abs(Date.parse(m.date)-Date.parse(line.date))/86400000})).sort((a,b)=>a.distance-b.distance||a.date.localeCompare(b.date))
}
export function statementSummary(state:State,s:BankStatement) {
 const ledger=sum(state.treasuryMoves.filter(m=>m.treasuryId===s.treasuryId&&m.date<=s.to).map(m=>m.amount))
 const pendingBank=sum(s.lines.filter(l=>!l.treasuryMoveIds.length).map(l=>l.amount))
 const pendingLedger=sum(state.treasuryMoves.filter(m=>m.treasuryId===s.treasuryId&&m.date<=s.to&&!m.reconciled).map(m=>m.amount))
 return {ledger,pendingBank,pendingLedger,difference:sum([s.closing,-ledger]),unexplained:sum([s.closing,-pendingBank,pendingLedger,-ledger]),matched:s.lines.filter(l=>l.treasuryMoveIds.length).length}
}
export function validateBankStatements(state:State) {
 if(state.bankStatements!==undefined&&!Array.isArray(state.bankStatements))throw new Error('Extractos bancarios inválidos.')
 const statements=state.bankStatements||[],ids=new Set<string>(),lines=new Set<string>(),groups=new Set<string>(),matched=new Set<string>(),movesById=new Map(state.treasuryMoves.map(m=>[m.id,m]))
 for(const s of statements){
  if(!s||!s.id||ids.has(s.id)||!['Activo','Anulado'].includes(s.status)||!s.accountName||!s.importedBy||typeof s.importedAt!=='string'||Number.isNaN(Date.parse(s.importedAt))||!Array.isArray(s.events))throw new Error('La copia contiene un extracto inválido.');ids.add(s.id)
  const account=header(state,s,true);if(account.branchId!==s.branchId)throw new Error('Sucursal del extracto bancario inválida.')
  if(s.groups!==undefined&&!Array.isArray(s.groups))throw new Error('Grupos bancarios inválidos.')
  const groupedLines=new Set<string>()
  for(const g of s.groups||[]){
   if(!g||!g.id||groups.has(g.id)||s.status!=='Activo'||!Array.isArray(g.lineIds)||g.lineIds.length<2||g.lineIds.length>100||new Set(g.lineIds).size!==g.lineIds.length||!Array.isArray(g.moveIds)||!g.moveIds.length||g.moveIds.length>100||new Set(g.moveIds).size!==g.moveIds.length)throw new Error('Grupo bancario inválido.');groups.add(g.id)
   const rows=g.lineIds.map(id=>s.lines.find(l=>l.id===id)),moves=g.moveIds.map(id=>movesById.get(id)),sign=Math.sign(rows[0]?.amount||0)
   if(rows.some(l=>!l||groupedLines.has(l.id)||Math.sign(l.amount)!==sign||JSON.stringify(l.treasuryMoveIds)!==JSON.stringify(g.moveIds))||moves.some(m=>!m||matched.has(m.id)||m.treasuryId!==s.treasuryId||m.branchId!==s.branchId||!day(m.date)||!withinExerciseHistory(state,m.date)||m.reconciled!==true||m.bankStatementLineId!==g.lineIds[0]||Math.sign(m.amount)!==sign)||sum(rows.map(l=>l!.amount))!==sum(moves.map(m=>m!.amount)))throw new Error('El grupo bancario no concilia con sus filas y movimientos de tesorería.')
   const last=s.events.filter(e=>e.groupId===g.id).at(-1)
   if(!last||last.action!=='Vincular'||JSON.stringify(last.lineIds)!==JSON.stringify(g.lineIds)||JSON.stringify(last.moveIds)!==JSON.stringify(g.moveIds)||last.lineId!==g.lineIds[0])throw new Error('El grupo bancario perdió su historial de vínculo.')
   rows.forEach(l=>groupedLines.add(l!.id));moves.forEach(m=>matched.add(m!.id))
  }
  for(const e of s.events)if(!e.id||!['Vincular','Desvincular','Anular'].includes(e.action)||!e.user||typeof e.at!=='string'||Number.isNaN(Date.parse(e.at))||typeof e.note!=='string'||!Array.isArray(e.moveIds))throw new Error('Historial del extracto inválido.')
  for(const e of s.events)if((e.groupId!==undefined||e.lineIds!==undefined)&&(!e.groupId||typeof e.groupId!=='string'||!Array.isArray(e.lineIds)||e.lineIds.length<2||e.lineIds.length>100||new Set(e.lineIds).size!==e.lineIds.length||e.lineIds.some(id=>!s.lines.some(l=>l.id===id))||e.lineId!==e.lineIds[0]||!e.moveIds.length||e.moveIds.length>100||new Set(e.moveIds).size!==e.moveIds.length||e.moveIds.some(id=>!movesById.has(id))||!e.note.trim()||e.note.length>500||e.action==='Anular'))throw new Error('Historial de agrupación bancaria inválido.')
  for(const l of s.lines){
   if(!l.id||lines.has(l.id)||!Array.isArray(l.treasuryMoveIds)||l.treasuryMoveIds.length>100||new Set(l.treasuryMoveIds).size!==l.treasuryMoveIds.length||(s.status==='Anulado'&&l.treasuryMoveIds.length))throw new Error('Filas o vínculos del extracto inválidos.');lines.add(l.id)
   if(groupedLines.has(l.id))continue
   const moves=l.treasuryMoveIds.map(id=>movesById.get(id))
   if(moves.some(m=>!m||matched.has(m.id)||m.treasuryId!==s.treasuryId||m.branchId!==s.branchId||!day(m.date)||!withinExerciseHistory(state,m.date)||m.reconciled!==true||m.bankStatementLineId!==l.id||Math.sign(m.amount)!==Math.sign(l.amount))||(moves.length&&sum(moves.map(m=>m!.amount))!==l.amount))throw new Error('Los vínculos bancarios no concilian con los movimientos de tesorería.')
   for(const m of moves)matched.add(m!.id)
  }
 }
 const active=statements.filter(s=>s.status==='Activo').sort((a,b)=>a.treasuryId.localeCompare(b.treasuryId)||a.from.localeCompare(b.from)),references=new Set<string>()
 for(const [i,s] of active.entries()){const previous=active[i-1];if(previous?.treasuryId===s.treasuryId&&previous.to>=s.from)throw new Error('La copia duplica períodos bancarios.');for(const l of s.lines){const ref=`${s.treasuryId}:${l.reference}`;if(references.has(ref))throw new Error('La copia duplica referencias bancarias.');references.add(ref)}}
 if(state.treasuryMoves.some(m=>m.bankStatementLineId&&!matched.has(m.id)))throw new Error('La copia perdió el extracto vinculado al movimiento de tesorería.')
}

export const statementHeaders=['Fecha','Referencia','Descripcion','Importe']
export function parseStatementRows(rows:Record<string,string>[]) {
 const lines:BankStatementInput['lines']=[],errors:{row:number;message:string}[]=[]
 for(const [i,row] of rows.entries())try{
  if(row.__columns&&Number(row.__columns)!==4)throw new Error('La fila debe tener exactamente cuatro columnas separadas por tabulaciones.')
  const raw=String(row.Importe??'').trim()
  if(!/^[+-]?\d+(?:[.,]\d{1,2})?$/.test(raw))throw new Error('Importe ARS con signo: sin separadores de miles, hasta dos decimales.')
  const match=raw.match(/^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/)!,cents=(Number(match[2])*100+Number((match[3]||'').padEnd(2,'0')))*(match[1]==='-'?-1:1)
  const date=String(row.Fecha??'').trim(),reference=String(row.Referencia??'').trim(),description=String(row.Descripcion??'').trim()
  if(!day(date)||!reference||reference.length>120||!description||description.length>500||!amount(cents)||!cents)throw new Error('Revisá fecha AAAA-MM-DD, referencia, descripción e importe distinto de cero.')
  lines.push({date,reference,description,amount:cents})
 }catch(error){errors.push({row:Number(row.__row)||i+2,message:error instanceof Error?error.message:'Fila inválida.'})}
 return {lines,errors}
}
