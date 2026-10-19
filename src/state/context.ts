import type {FiscalOptions,FiscalRequest,FiscalEnvironment,FiscalConnection} from '@/domain/fiscal'
import { createContext, useContext } from 'react'
import type { Command } from '@/domain/commands'
import type { State, Session } from '@/domain/types'
export interface CompanyChoice {id:string;label:string}
export interface ActiveSession {id:string;userId:string;name:string;username:string;role:string;terminal:string;created:string|null;lastSeen:string|null;expires:string;current:boolean}
export interface StoreValue {
  companies:CompanyChoice[]; companyId:string; selectCompany:(id:string)=>boolean;
  data: State; session: Session | null; branch: string; setBranch: (id: string)=>void;
  error: string; notice: string; notify: (message: string)=>void;
  transact: (path: string, action: string, detail: string, command: Command)=>Promise<boolean>;
  login: (username: string, password: string, remember: boolean,terminalName?:string)=>Promise<boolean>;
  activeSessions:()=>Promise<ActiveSession[]>;
  logout: ()=>Promise<boolean>;
  restore: (next: unknown)=>Promise<boolean>;
  previewTaxCertificate:(input:import('@/domain/tax-certificates').TaxCertificateInput)=>Promise<import('@/domain/tax-certificates').TaxCertificatePreview>;
  previewVatSales:(input:import('@/domain/vat-sales').VatSalesInput)=>Promise<import('@/domain/vat-sales').VatSalesPreview>;
  previewFiscal:(id:string,options:FiscalOptions,environment?:FiscalEnvironment)=>Promise<FiscalRequest>; operateFiscal:(id:string,options:FiscalOptions,action:'autorizar'|'consultar',reviewRevision?:number,environment?:FiscalEnvironment)=>Promise<boolean>; fiscalConnection:()=>Promise<FiscalConnection>;
  mode:'local'|'server'; ready:boolean; busy:boolean; revision:number; reload:()=>Promise<void>; exportBackup:()=>Promise<State>; recoveries:()=>Promise<{id:number;revision:number;created:string;name:string;documents:number}[]>; recoveryCopy:(id:number)=>Promise<State>; localCopy:()=>unknown;
}
export const Context = createContext<StoreValue | null>(null)
export function useStore() { const value=useContext(Context); if(!value) throw new Error('Falta el proveedor SICA.'); return value }
