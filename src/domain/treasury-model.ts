import type {State} from './types'

export function sumMoney(values:number[]) {
 let total=0
 for(const n of values){if(!Number.isSafeInteger(n)||!Number.isSafeInteger(total+n))throw new Error('Los saldos de tesorería superan el rango admitido.');total+=n}
 return total
}
export function treasuryBalance(state:State,id:string,date:string){return sumMoney(state.treasuryMoves.filter(m=>m.treasuryId===id&&m.date<=date).map(m=>m.amount))}
export function assertTreasuryWithdrawal(state:State,id:string,date:string,amount:number){
 const daily=new Map<string,number>()
 for(const m of state.treasuryMoves.filter(m=>m.treasuryId===id))daily.set(m.date,sumMoney([daily.get(m.date)||0,m.amount]))
 daily.set(date,sumMoney([daily.get(date)||0,-amount]));let balance=0
 for(const [day,change] of [...daily].sort(([a],[b])=>a.localeCompare(b))){balance=sumMoney([balance,change]);if(day>=date&&balance<0)throw new Error('El retiro supera el saldo disponible a la fecha o afecta movimientos posteriores.')}
}
export function parseCashAmount(value:string){
 const match=/^(\d+)(?:\.(\d{0,2}))?$/.exec(value)
 if(!match)throw new Error('Ingresá importes no negativos con hasta dos decimales.')
 const amount=BigInt(match[1])*100n+BigInt((match[2]||'').padEnd(2,'0'))
 if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('El importe supera el rango admitido.')
 return Number(amount)
}
export function cashAmountText(value:number){return `${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`}
export function assertTreasuryCredit(state:State,id:string,date:string,amount:number){
 const daily=new Map<string,number>()
 for(const m of state.treasuryMoves.filter(m=>m.treasuryId===id))daily.set(m.date,sumMoney([daily.get(m.date)||0,m.amount]))
 daily.set(date,sumMoney([daily.get(date)||0,amount]));let balance=0
 for(const [,change] of [...daily].sort(([a],[b])=>a.localeCompare(b)))balance=sumMoney([balance,change])
}
