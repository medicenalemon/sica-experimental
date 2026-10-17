import {withinSingleExercise} from './exercise-calendar'
import type {State,Entry} from './types'

export function accountingDate(date:string){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)throw new Error('Ingresá una fecha contable válida.');return date}
export function accountingSum(a:number,b:number){const value=a+b;if(!Number.isSafeInteger(value))throw new Error('El total contable supera el rango de centavos seguros.');return value}
export interface TrialBalanceRow {accountId:string;code:string;name:string;group:string;opening:number;debit:number;credit:number;closing:number}
export interface TrialBalance {from:string;to:string;branchId:string;rows:TrialBalanceRow[];totals:{openingDebit:number;openingCredit:number;debit:number;credit:number;closingDebit:number;closingCredit:number};entryIds:string[]}
export function validJournal(state:State,entry:Entry){
 accountingDate(entry.date)
 if(!entry.id||!state.masters.branches.some(b=>b.id===entry.branchId)||typeof entry.concept!=='string'||!entry.concept.trim()||!Array.isArray(entry.lines)||entry.lines.length<2)throw new Error('El asiento requiere identidad, sucursal, concepto y al menos dos líneas.')
 let difference=0
 for(const l of entry.lines){if(!state.masters.accounts.some(a=>a.id===l.accountId)||![l.debit,l.credit].every(n=>Number.isSafeInteger(n)&&n>=0)||l.debit>0&&l.credit>0||!l.debit&&!l.credit)throw new Error('El asiento contiene una cuenta o importes inválidos.');difference=accountingSum(difference,l.debit-l.credit)}
 if(difference)throw new Error('El asiento no conserva la partida doble.')
}
export function trialBalance(state:State,from:string,to:string,branchId='all'):TrialBalance {
 accountingDate(from);accountingDate(to)
 if(!withinSingleExercise(state,from,to))throw new Error('El rango contable debe ser válido y estar dentro del ejercicio.')
 if(branchId!=='all'&&!state.masters.branches.some(b=>b.id===branchId))throw new Error('Seleccioná una sucursal existente para el balance.')
 const rows:TrialBalanceRow[]=state.masters.accounts.map(a=>({accountId:a.id,code:String(a.code),name:String(a.name),group:String(a.group),opening:0,debit:0,credit:0,closing:0})),map=new Map(rows.map(r=>[r.accountId,r]))
 if(map.size!==rows.length)throw new Error('El plan de cuentas contiene identificadores repetidos.')
 for(const e of state.entries)accountingDate(e.date)
 const entries=state.entries.filter(e=>e.date<=to&&(branchId==='all'||e.branchId===branchId)).sort((a,b)=>a.date.localeCompare(b.date)),ids=new Set<string>()
 for(const e of entries){validJournal(state,e);if(ids.has(e.id))throw new Error('El diario contiene identificadores repetidos.');ids.add(e.id);for(const l of e.lines){const row=map.get(l.accountId)!;if(e.date<from)row.opening=accountingSum(row.opening,l.debit-l.credit);else{row.debit=accountingSum(row.debit,l.debit);row.credit=accountingSum(row.credit,l.credit)}}}
 const totals={openingDebit:0,openingCredit:0,debit:0,credit:0,closingDebit:0,closingCredit:0}
 for(const r of rows){r.closing=accountingSum(r.opening,r.debit-r.credit);totals.openingDebit=accountingSum(totals.openingDebit,Math.max(0,r.opening));totals.openingCredit=accountingSum(totals.openingCredit,Math.max(0,-r.opening));totals.debit=accountingSum(totals.debit,r.debit);totals.credit=accountingSum(totals.credit,r.credit);totals.closingDebit=accountingSum(totals.closingDebit,Math.max(0,r.closing));totals.closingCredit=accountingSum(totals.closingCredit,Math.max(0,-r.closing))}
 if(totals.openingDebit!==totals.openingCredit||totals.debit!==totals.credit||totals.closingDebit!==totals.closingCredit)throw new Error('Los saldos iniciales, movimientos o saldos finales no concilian.')
 return {from,to,branchId,rows,totals,entryIds:[...ids]}
}
