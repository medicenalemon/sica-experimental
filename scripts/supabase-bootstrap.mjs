import {mkdir,writeFile} from 'node:fs/promises'
import {postgresBootstrapSql} from '../server/postgres-schema.mjs'

const path=new URL('../deploy/supabase/bootstrap.sql',import.meta.url)
await mkdir(new URL('.',path),{recursive:true})
await writeFile(path,postgresBootstrapSql())
console.log('SQL inicial generado en deploy/supabase/bootstrap.sql. Aplicar en una transacción sobre un proyecto vacío.')
