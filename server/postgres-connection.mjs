import {readFileSync} from 'node:fs'

// Supavisor session mode supports session state, but may ignore startup options.
export const initializePostgresSession=client=>client.query("SELECT set_config('search_path','sica,pg_catalog',false),set_config('statement_timeout','30000',false),set_config('lock_timeout','5000',false)")

export function postgresConnectionConfig({databaseUrl,poolSize=process.env.SICA_DATABASE_POOL_SIZE||6,sslCa=process.env.SICA_DATABASE_SSL_CA,sslCaFile=process.env.SICA_DATABASE_SSL_CA_FILE}={}){
 if(typeof databaseUrl!=='string'||!/^postgres(?:ql)?:\/\//.test(databaseUrl))throw new Error('Configurá SICA_DATABASE_URL con una conexión PostgreSQL.')
 let url;try{url=new URL(databaseUrl)}catch{throw new Error('La URL de conexión PostgreSQL es inválida.')}
 if((url.searchParams.get('port')||url.port)==='6543')throw new Error('SICA requiere conexión directa o Session pooler (5432), no Transaction pooler (6543).')
 const size=Number(poolSize)
 if(!Number.isInteger(size)||size<1||size>20)throw new Error('SICA_DATABASE_POOL_SIZE debe ser un entero entre 1 y 20 por empresa.')
 const host=url.searchParams.get('host')||url.hostname,local=host.startsWith('/')||['localhost','127.0.0.1','[::1]','::1'].includes(host),mode=url.searchParams.get('sslmode')
 if(mode&&!['disable','require','verify-full'].includes(mode))throw new Error('Usá sslmode=verify-full para PostgreSQL remoto.')
 if(!local&&mode==='disable')throw new Error('La conexión PostgreSQL remota requiere TLS con certificado verificado.')
 if(sslCa&&sslCaFile)throw new Error('Configurá una sola fuente del certificado PostgreSQL: SICA_DATABASE_SSL_CA o SICA_DATABASE_SSL_CA_FILE.')
 const ca=sslCaFile?readFileSync(sslCaFile,'utf8'):sslCa
 if(ca&&!ca.includes('-----BEGIN CERTIFICATE-----'))throw new Error('El certificado raíz PostgreSQL debe estar en formato PEM.')
 // Never let connection-string SSL settings replace the verified TLS object.
 for(const key of ['sslmode','ssl','sslcert','sslkey','sslrootcert','sslnegotiation','uselibpqcompat','options'])url.searchParams.delete(key)
 const tls=!local||mode==='require'||mode==='verify-full'||Boolean(ca)
 return {connectionString:url.href,max:size,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,ssl:tls?{rejectUnauthorized:true,...(ca?{ca}:{})}:false,application_name:'sica-experimental'}
}
