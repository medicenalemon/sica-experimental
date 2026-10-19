import pg from 'pg'
import {postgresConnectionConfig,initializePostgresSession} from '../server/postgres-connection.mjs'
import {migratePostgres} from '../server/postgres-schema.mjs'
process.umask(0o077)
let pool
try{
 pool=new pg.Pool(postgresConnectionConfig({databaseUrl:process.env.SICA_DATABASE_URL,poolSize:1}))
 const client=await pool.connect()
 try{
  await initializePostgresSession(client)
  await migratePostgres(client)
  const result=await client.query("SELECT current_setting('search_path') AS path,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls")
  console.log(JSON.stringify({ok:true,schema:'sica',searchPath:result.rows[0].path,tls:result.rows[0].tls,companyInitialized:false,arca:'disabled'}))
 }finally{client.release()}
}catch{console.error('No se pudo preparar Supabase. Revisá la URL Session pooler/directa, credenciales, certificado TLS y permisos de migración. No se imprimen secretos.');process.exitCode=1}finally{await pool?.end()}
