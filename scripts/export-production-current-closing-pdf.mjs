import {readFileSync,writeFileSync,mkdtempSync,readdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import ts from 'typescript'
import {Repository} from '../server/repository.mjs'
const directory=mkdtempSync(join(tmpdir(),'sica-process-closing-export-')),require=createRequire(import.meta.url)
for(const filename of readdirSync(resolve('src/domain')).filter(f=>f.endsWith('.ts'))){let source=readFileSync(resolve('src/domain',filename),'utf8').replace(/from '(\.\/[^']+)'/g,(_,name)=>`from '${name}.mjs'`);for(const name of ['exceljs','jspdf','qrcode'])source=source.replaceAll(`import('${name}')`,`import('${pathToFileURL(require.resolve(name)).href}')`);writeFileSync(join(directory,filename.replace(/\.ts$/,'.mjs')),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
const {inventoryClosingExport}=await import(pathToFileURL(join(directory,'inventory-closing-model.mjs')).href),{buildStatementPdf}=await import(pathToFileURL(join(directory,'statement-files.mjs')).href),repo=await Repository.open({filename:'var/qa-production-current-closing.sqlite'})
try{const {state}=repo.read(),record=inventoryClosingExport(state,state.reexpressionPostings[0].id),pdf=await buildStatementPdf(record),filename='output/pdf/estados-finales-proceso-2026-10-13.pdf';writeFileSync(filename,Buffer.from(pdf.output('arraybuffer')));console.log(JSON.stringify({filename,pages:pdf.getNumberOfPages(),assets:record.preview.position.assets,profit:record.preview.results.profit,equity:record.preview.equity.closing,cashDifference:record.preview.cash.difference,temporaryDirectory:directory}))}finally{await repo.close()}
