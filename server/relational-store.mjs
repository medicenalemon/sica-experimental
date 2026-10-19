// The snapshot remains the interchange format for the domain and older backups.
// SQL relations are maintained by the database itself, in the same transaction.
import {canonical} from './fiscal-store.mjs'

export const relationalVersion=1
const safe='9007199254740991'
const field=(name,type='TEXT',required=true,expression=`json_extract(data,'$.${name}')`)=>`${name} ${type} GENERATED ALWAYS AS (${expression}) STORED${required?' NOT NULL':''}`
const money=name=>`${field(name,'INTEGER')} CHECK(typeof(json_extract(data,'$.${name}'))='integer' AND ${name} BETWEEN -${safe} AND ${safe})`
const reference=(column,table,target='id')=>`FOREIGN KEY(company_id,${column}) REFERENCES ${table}(company_id,${target}) DEFERRABLE INITIALLY DEFERRED`
const optional=name=>field(name,'TEXT',false,`nullif(json_extract(data,'$.${name}'),'')`)
// documentId on stock/journal/treasury movements is a polymorphic origin: it can
// identify a cheque, transfer, valuation, settlement, etc. Keep it as origin_id.
const entities=[
 {table:'rel_branches',path:'masters.branches',columns:[field('name')]},
 {table:'rel_accounts',path:'masters.accounts',columns:[field('name')]},
 {table:'rel_deposits',path:'masters.deposits',columns:[field('branchId'),reference('branchId','rel_branches')]},
 {table:'rel_treasury_accounts',path:'masters.treasury',columns:[field('branchId'),optional('accountId'),reference('branchId','rel_branches'),reference('accountId','rel_accounts')]},
 {table:'rel_parties',path:'parties',columns:[field('name'),field('side'),"CHECK(side IN ('cliente','proveedor'))",'UNIQUE(company_id,id,side)']},
 {table:'rel_products',path:'products',columns:[field('sku'),field('kind'),"CHECK(kind IN ('Producto','Servicio','Bien de uso'))"]},
 {table:'rel_documents',path:'documents',omit:['lines','payments','allocations'],columns:[
  field('number'),field('kind'),field('side'),field('letter'),field('date'),field('branchId'),field('partyId'),optional('sourceId'),optional('depositId'),
  money('net'),money('vat'),money('perceptions'),money('total'),
  "CHECK(kind IN ('factura','credito','debito','cobro','pago','pedido','remito','orden-compra','saldo'))","CHECK(side IN ('cliente','proveedor'))","CHECK(letter IN ('A','B','C','X'))",
  reference('branchId','rel_branches'),reference('partyId','rel_parties'),reference('sourceId','rel_documents'),reference('depositId','rel_deposits'),
  'FOREIGN KEY(company_id,partyId,side) REFERENCES rel_parties(company_id,id,side) DEFERRABLE INITIALLY DEFERRED'
 ]},
 {table:'rel_stock_moves',path:'stockMoves',columns:[field('date'),field('productId'),field('depositId'),field('branchId'),field('origin_id','TEXT',false,"nullif(json_extract(data,'$.documentId'),'')"),field('quantity','REAL'),"CHECK(abs(quantity)<=1.7976931348623157e308)",reference('productId','rel_products'),reference('depositId','rel_deposits'),reference('branchId','rel_branches')]},
 {table:'rel_treasury_moves',path:'treasuryMoves',columns:[field('date'),field('treasuryId'),field('branchId'),field('origin_id','TEXT',false,"nullif(json_extract(data,'$.documentId'),'')"),money('amount'),reference('treasuryId','rel_treasury_accounts'),reference('branchId','rel_branches')]},
 {table:'rel_entries',path:'entries',omit:['lines'],columns:[field('date'),field('branchId'),field('origin_id','TEXT',false,"nullif(json_extract(data,'$.documentId'),'')"),reference('branchId','rel_branches')]}
]
const children=[
 {table:'rel_document_lines',parent:'rel_documents',collection:'lines',columns:[field('productId'),field('quantity','REAL'),money('price'),field('discount','REAL'),"CHECK(quantity>0 AND quantity<=1.7976931348623157e308)","CHECK(price>=0 AND discount BETWEEN 0 AND 100)",reference('productId','rel_products')]},
 {table:'rel_document_payments',parent:'rel_documents',collection:'payments',columns:[field('method'),money('amount'),optional('treasuryId'),'CHECK(amount>0)',reference('treasuryId','rel_treasury_accounts')]},
 {table:'rel_document_allocations',parent:'rel_documents',collection:'allocations',columns:[field('documentId'),money('amount'),'CHECK(amount>=0)',reference('documentId','rel_documents'),'UNIQUE(company_id,parent_id,documentId)']},
 {table:'rel_entry_lines',parent:'rel_entries',collection:'lines',columns:[field('accountId'),money('debit'),money('credit'),'CHECK(debit>=0 AND credit>=0)',reference('accountId','rel_accounts')]}
]
export const relationalTables=[...entities,...children].map(e=>e.table)

function schema(){
 const common=`company_id TEXT NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED, position INTEGER NOT NULL CHECK(position>=0), data TEXT NOT NULL CHECK(json_valid(data) AND json_type(data)='object')`
 const parentSql=entities.map(e=>`CREATE TABLE ${e.table}(${common}, id TEXT NOT NULL CHECK(length(id)>0 AND id=json_extract(data,'$.id')), property_order TEXT NOT NULL CHECK(json_valid(property_order) AND json_type(property_order)='array'), ${e.columns.join(',')}, PRIMARY KEY(company_id,id), UNIQUE(company_id,position)) STRICT;`).join('\n')
 const childSql=children.map(e=>`CREATE TABLE ${e.table}(${common}, parent_id TEXT NOT NULL, ${e.columns.join(',')}, PRIMARY KEY(company_id,parent_id,position), ${reference('parent_id',e.parent)}) STRICT;`).join('\n')
 const inserts=entities.map(e=>`INSERT INTO ${e.table}(company_id,position,id,data,property_order) SELECT NEW.id,CAST(j.key AS INTEGER),json_extract(j.value,'$.id'),${e.omit?`json_remove(j.value,${e.omit.map(k=>`'$.${k}'`).join(',')})`:'j.value'},(SELECT json_group_array(k.key) FROM json_each(j.value) k) FROM json_each(NEW.state,'$.${e.path}') j;`).join('\n')
 const childInserts=children.map(e=>{const parent=entities.find(p=>p.table===e.parent);return `INSERT INTO ${e.table}(company_id,parent_id,position,data) SELECT NEW.id,json_extract(p.value,'$.id'),CAST(c.key AS INTEGER),c.value FROM json_each(NEW.state,'$.${parent.path}') p,json_each(p.value,'$.${e.collection}') c;`}).join('\n')
 const deletes=[...relationalTables].reverse().map(table=>`DELETE FROM ${table} WHERE company_id=NEW.id;`).join('\n')
 const body=`SELECT CASE WHEN NOT json_valid(NEW.state) THEN RAISE(ABORT,'Estado JSON inválido') END; ${deletes}\n${inserts}\n${childInserts}`
 return `${parentSql}\n${childSql}
  CREATE TRIGGER rel_companies_insert AFTER INSERT ON companies BEGIN ${body} END;
  CREATE TRIGGER rel_companies_update AFTER UPDATE OF state ON companies BEGIN ${body} END;
  CREATE INDEX rel_documents_party_date ON rel_documents(company_id,partyId,date);
  CREATE INDEX rel_documents_branch_date ON rel_documents(company_id,branchId,date);
  CREATE INDEX rel_documents_source ON rel_documents(company_id,sourceId);
  CREATE INDEX rel_stock_product_deposit_date ON rel_stock_moves(company_id,productId,depositId,date);
  CREATE INDEX rel_treasury_account_date ON rel_treasury_moves(company_id,treasuryId,date);
  CREATE INDEX rel_entries_branch_date ON rel_entries(company_id,branchId,date);
  CREATE INDEX rel_entry_account ON rel_entry_lines(company_id,accountId,parent_id);
  CREATE INDEX rel_allocations_target ON rel_document_allocations(company_id,documentId);
  CREATE VIEW rel_account_totals AS SELECT company_id,accountId,sum(debit) AS debit,sum(credit) AS credit,sum(debit)-sum(credit) AS balance FROM rel_entry_lines GROUP BY company_id,accountId;
  CREATE VIEW rel_stock_balances AS SELECT company_id,productId,depositId,sum(quantity) AS quantity FROM rel_stock_moves GROUP BY company_id,productId,depositId;
  CREATE VIEW rel_treasury_balances AS SELECT company_id,treasuryId,sum(amount) AS amount FROM rel_treasury_moves GROUP BY company_id,treasuryId;`
}

export function migrateRelationalStore(db){
 db.exec('BEGIN IMMEDIATE')
 try{
  db.exec('CREATE TABLE IF NOT EXISTS sica_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL) STRICT')
  const versions=db.prepare('SELECT version FROM sica_migrations ORDER BY version').all().map(r=>Number(r.version))
  if(versions.some(v=>v!==relationalVersion))throw new Error('Versión de base relacional no compatible con este servidor.')
  if(!versions.length){db.exec(schema());db.exec('UPDATE companies SET state=state');db.prepare('INSERT INTO sica_migrations VALUES(?,?)').run(relationalVersion,new Date().toISOString())}
  assertSchema(db)
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('La base contiene relaciones inválidas; se canceló la migración.')
  db.exec('COMMIT')
 }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}
}

function assertSchema(db){
 const names=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','trigger','view')").all().map(r=>r.name))
 for(const name of [...relationalTables,'rel_companies_insert','rel_companies_update','rel_account_totals','rel_stock_balances','rel_treasury_balances'])if(!names.has(name))throw new Error(`Esquema relacional incompleto: falta ${name}.`)
}

export function readRelationalState(db,companyId,state){
 for(const e of entities){
  const rows=db.prepare(`SELECT id,data,property_order FROM ${e.table} WHERE company_id=? ORDER BY position`).all(companyId)
  const objects=rows.map(r=>JSON.parse(r.data)),byId=new Map(objects.map(o=>[o.id,o]))
  for(const c of children.filter(c=>c.parent===e.table)){
   for(const o of objects)o[c.collection]=[]
   for(const row of db.prepare(`SELECT parent_id,data FROM ${c.table} WHERE company_id=? ORDER BY parent_id,position`).all(companyId)){
    const parent=byId.get(row.parent_id);if(!parent)throw new Error('Detalle relacional sin cabecera.')
    parent[c.collection].push(JSON.parse(row.data))
   }
  }
  // Some historical review signatures use JSON.stringify rather than a
  // canonical serializer. Preserve their original property order as well.
  const ordered=objects.map((object,index)=>{
   const keys=JSON.parse(rows[index].property_order)
   if(keys.length!==Object.keys(object).length||new Set(keys).size!==keys.length||keys.some(key=>!Object.hasOwn(object,key)))throw new Error('Orden de propiedades relacionales inválido.')
   return Object.fromEntries(keys.map(key=>[key,object[key]]))
  })
  if(e.path.startsWith('masters.'))state.masters[e.path.slice(8)]=ordered;else state[e.path]=ordered
 }
 return state
}

export function assertRelationalStore(db,companyId,state){
 const exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sica_migrations'").get()
 if(!exists){
  if(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'rel_%'").get())throw new Error('Esquema relacional incompleto: falta el registro de migraciones.')
  return // Historical backups are validated and migrated on first open.
 }
 assertSchema(db)
 if(db.prepare('SELECT version FROM sica_migrations').all().map(r=>r.version).join(',')!==String(relationalVersion))throw new Error('Versión relacional incompatible.')
 const reconstructed=readRelationalState(db,companyId,structuredClone(state))
 if(canonical(reconstructed)!==canonical(state)||JSON.stringify(reconstructed)!==JSON.stringify(state))throw new Error('Las relaciones SQL no coinciden con la copia de estado. Se requiere revisar la base antes de operar.')
}
