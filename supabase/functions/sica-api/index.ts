import {createEdgeHandler} from '../../../server/edge-handler.mjs'

const keys=Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')) as string[]
const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if(legacy)keys.push(legacy)
if(!keys.length)throw new Error('No hay claves privadas del servidor.')
const databaseUrl=new URL(Deno.env.get('SICA_DATABASE_URL')||Deno.env.get('SUPABASE_DB_URL')||'')
// The platform URL can carry a libpq default mode. Always enforce certificate
// and hostname verification through the shared PostgreSQL connection builder.
databaseUrl.searchParams.set('sslmode','verify-full')
const handler=createEdgeHandler({
 databaseUrl:databaseUrl.href,
 url:Deno.env.get('SUPABASE_URL'),secretKeys:keys,
 sslCa:Deno.env.get('SICA_DATABASE_SSL_CA'),
 waitUntil:(promise:Promise<unknown>)=>EdgeRuntime.waitUntil(promise),
})
Deno.serve(handler)
