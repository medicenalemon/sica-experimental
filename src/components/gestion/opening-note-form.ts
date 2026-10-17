import type {Document,State,InventoryAccounts,InventoryOpeningNote,InventoryOpeningInvoice} from '@/domain/types'
import {openingNoteLineCosts} from '@/domain/inventory-costing'
import {parseCashAmount} from '@/domain/treasury-model'

export interface AllocationRow {sourceProductId:string;target:'Existencias'|'Resultados';productId:string;depositId:string;branchId:string;accountId:string;value:string}
export interface AllocationForm {reference:string;rows:AllocationRow[]}
export type OpeningNoteForms=Record<string,AllocationForm>
export type OpeningCosts=(state:State,document:Document)=>{productId:string;value:number}[]
export function blankRow(state:State,note:Document,accounts:InventoryAccounts,costsFor:OpeningCosts=openingNoteLineCosts):AllocationRow {return {sourceProductId:costsFor(state,note)[0]?.productId||'',target:'Existencias',productId:'',depositId:'',branchId:note.branchId,accountId:accounts.cogs,value:''}}
export function formFor(state:State,note:Document,accounts:InventoryAccounts,forms:OpeningNoteForms,costsFor:OpeningCosts=openingNoteLineCosts){return forms[note.id]||{reference:'',rows:costsFor(state,note).length?[blankRow(state,note,accounts,costsFor)]:[]}}
export function openingNoteInputs(state:State,notes:Document[],accounts:InventoryAccounts,forms:OpeningNoteForms):InventoryOpeningNote[]{
 return notes.map(note=>{const f=formFor(state,note,accounts,forms);return {noteId:note.id,reference:f.reference,lines:f.rows.map(r=>({sourceProductId:r.sourceProductId,value:parseCashAmount(r.value),...(r.target==='Existencias'?{target:r.target,productId:r.productId,depositId:r.depositId}:{target:r.target,branchId:r.branchId,accountId:r.accountId})}))}})
}

export function openingInvoiceInputs(state:State,invoices:Document[],accounts:InventoryAccounts,forms:OpeningNoteForms,costsFor:OpeningCosts):InventoryOpeningInvoice[]{return invoices.map(invoice=>{const f=formFor(state,invoice,accounts,forms,costsFor);return {invoiceId:invoice.id,reference:f.reference,lines:f.rows.map(r=>({sourceProductId:r.sourceProductId,value:parseCashAmount(r.value),...(r.target==='Existencias'?{target:r.target,productId:r.productId,depositId:r.depositId}:{target:r.target,branchId:r.branchId,accountId:r.accountId})}))}})}
