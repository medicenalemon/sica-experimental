if(Number(process.versions.node.split('.')[0])<24)throw new Error('Las herramientas de datos requieren Node.js 24 o superior.')
process.umask(0o077)
const usage=`Uso:
  npm run postgres:data -- verify --source COPIA.sica-pg.json [--company CODIGO]
  npm run postgres:data -- recover --source COPIA.sica-pg.json --reason "Motivo" [--operator "Nombre"]
  npm run postgres:data -- migrate --source BASE.sqlite --company CODIGO [--reason "Motivo"]
  npm run postgres:data -- backup [--company CODIGO]

Destino: SICA_DATABASE_URL. Clave de destino: SICA_AUDIT_KEY_FILE.
La importación exige que la empresa de destino no exista. No se renombra la empresa.
Se preservan credenciales, operaciones y solicitudes fiscales; se revocan sesiones copiadas.
verify no conecta al servidor. No se realiza ninguna conexión a ARCA.`
const args=process.argv.slice(2),action=args.shift()
if(action==='help'||action==='--help'||!action){console.log(usage);if(!action)process.exitCode=1}
else try{
 if(!['verify','recover','migrate','backup'].includes(action))throw new Error('Acción inválida. Usá --help.')
 const names={'--source':'filename','--company':'companyId','--key':'keyFilename','--reason':'reason','--operator':'operator'},options={},seen=new Set()
 for(let i=0;i<args.length;i++){
  const arg=args[i]
  if(seen.has(arg)||!Object.hasOwn(names,arg)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Argumentos duplicados, incompletos o desconocidos.')
  seen.add(arg);options[names[arg]]=args[++i]
 }
 if(action!=='backup'&&!options.filename)throw new Error('Falta --source.')
 if(action==='backup'&&Object.keys(options).some(k=>k!=='companyId'))throw new Error('backup admite sólo --company.')
 if(action==='verify'&&(options.reason||options.operator))throw new Error('verify no admite motivo u operador.')
 const {readPostgresBackup,recoverPostgresBackup}=await import('../server/postgres-backup.mjs')
 if(action==='backup'){
  const {PostgresRepository}=await import('../server/postgres-repository.mjs')
  if(!process.env.SICA_AUDIT_KEY_FILE)throw new Error('Falta SICA_AUDIT_KEY_FILE para leer la clave de auditoría original.')
  const repository=await PostgresRepository.open({databaseUrl:process.env.SICA_DATABASE_URL,companyId:options.companyId||process.env.SICA_COMPANY_ID||'sica',auditKeyFile:process.env.SICA_AUDIT_KEY_FILE,initialize:false})
  try{console.log(JSON.stringify({companyId:repository.companyId,filename:await repository.backupFile(),arca:'disabled'}))}finally{await repository.close()}
 }
 else if(action==='verify'){const {report}=await readPostgresBackup({...options,expectedCompanyId:options.companyId});console.log(JSON.stringify({...report,seal:'HMAC verificado'},null,2))}
 else{
  if(!process.env.SICA_DATABASE_URL)throw new Error('Falta SICA_DATABASE_URL para el destino PostgreSQL.')
  if(!process.env.SICA_AUDIT_KEY_FILE)throw new Error('Falta SICA_AUDIT_KEY_FILE para conservar la clave de auditoría.')
  const target={...options,databaseUrl:process.env.SICA_DATABASE_URL,auditKeyFile:process.env.SICA_AUDIT_KEY_FILE,expectedCompanyId:options.companyId}
  if(action==='migrate'){
   if(!options.companyId)throw new Error('Indicá --company con el código original de SQLite.')
   const {migrateSQLiteToPostgres}=await import('../server/sqlite-to-postgres.mjs');console.log(JSON.stringify(await migrateSQLiteToPostgres(target),null,2))
  }else console.log(JSON.stringify(await recoverPostgresBackup(target),null,2))
 }
}catch(error){console.error(`Error: ${error.message}`);process.exitCode=1}
