import {rolldown} from 'rolldown'
import {readFile,writeFile} from 'node:fs/promises'
// Bundle the existing domain and backend. Node built-ins are supplied by Deno;
// exact npm versions are declared in the function's deno.json.
const bundle=await rolldown({input:'server/edge-handler.mjs',platform:'node',external:id=>id!=='node:sqlite'&&(id.startsWith('node:')||['pg','saxes'].includes(id)),plugins:[{
 name:'edge-no-sqlite',resolveId(id){if(id==='node:sqlite')return '\0edge-no-sqlite'},
 load(id){if(id==='\0edge-no-sqlite')return 'export class DatabaseSync {constructor(){throw new Error("SQLite no está disponible en Edge.")}}; export function backup(){throw new Error("SQLite no está disponible en Edge.")}'},
}]})
try{await bundle.write({file:'supabase/functions/sica-api/backend.mjs',format:'esm',codeSplitting:false})}finally{await bundle.close()}
const entry=await readFile('supabase/functions/sica-api/index.ts','utf8')
await writeFile('supabase/functions/sica-api/deploy-entry.ts',entry.replace('../../../server/edge-handler.mjs','./backend.mjs'))
console.log('Edge Function compilada con el dominio de SICA.')
