import {DatabaseSync,backup} from 'node:sqlite'
import {mkdtemp,rm,copyFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Repository} from './repository.mjs'
import {pgExportTables,validateCompanyBundle,importPostgresCompany} from './postgres-backup.mjs'

export async function exportSQLiteCompany({filename,companyId='sica',keyFilename}){
 const temporary=await mkdtemp(join(tmpdir(),'sica-sqlite-to-pg-')),staged=join(temporary,'source.sqlite')
 try{
  const source=new DatabaseSync(filename,{readOnly:true})
  try{if(!source.prepare('SELECT id FROM companies WHERE id=?').get(companyId))throw new Error('La base SQLite no contiene la empresa indicada. Conservá su código original.');await backup(source,staged)}finally{source.close()}
  await copyFile(keyFilename||filename+'.audit-key',staged+'.audit-key')
  const repository=await Repository.open({filename:staged,companyId})
  try{
   const company=repository.db.prepare('SELECT id,revision,state FROM companies WHERE id=?').get(companyId),tables={}
   repository.verifyAudit();repository.assertFiscalState(repository.read().state)
   for(const [table,columns] of Object.entries(pgExportTables))tables[table]=repository.db.prepare(`SELECT ${columns.join(',')} FROM ${table} WHERE company_id=?${['audit','recovery'].includes(table)?' ORDER BY id':''}`).all(companyId)
   const bundle={version:1,createdAt:new Date().toISOString(),company,tables},key=repository.key;validateCompanyBundle(bundle,key);return {bundle,key}
  }finally{await repository.close()}
 }finally{await rm(temporary,{recursive:true,force:true})}
}
export async function migrateSQLiteToPostgres(options){
 const {bundle,key}=await exportSQLiteCompany(options)
 return importPostgresCompany({...options,bundle,key,reason:options.reason||'Migración revisada desde SQLite, conservando operaciones y revocando sesiones anteriores.',action:'Migrar empresa de SQLite a PostgreSQL'})
}
