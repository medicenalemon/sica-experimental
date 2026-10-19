import {createHash} from 'node:crypto'
import {hardenPostgresSchema} from './postgres-security.mjs'

const safe='9007199254740991'
const field=(name,key=name,type='text',optional=false)=>`${name} ${type} GENERATED ALWAYS AS (${optional?'nullif(':'('}data->>'${key}'${optional?",'')":')'}${type==='text'?'':`::${type}`}) STORED${optional?'':' NOT NULL'}`
const money=name=>`${field(name,name,'bigint')} CHECK(json_typeof(data->'${name}')='number' AND ${name} BETWEEN -${safe} AND ${safe})`
const ref=(column,table,target='id')=>`FOREIGN KEY(company_id,${column}) REFERENCES ${table}(company_id,${target}) DEFERRABLE INITIALLY DEFERRED`
export const pgEntities=[
 {table:'rel_branches',path:['masters','branches'],columns:[field('name')]},
 {table:'rel_accounts',path:['masters','accounts'],columns:[field('name')]},
 {table:'rel_deposits',path:['masters','deposits'],columns:[field('branch_id','branchId'),ref('branch_id','rel_branches')]},
 {table:'rel_treasury_accounts',path:['masters','treasury'],columns:[field('branch_id','branchId'),field('account_id','accountId','text',true),ref('branch_id','rel_branches'),ref('account_id','rel_accounts')]},
 {table:'rel_parties',path:['parties'],columns:[field('name'),field('side'),"CHECK(side IN ('cliente','proveedor'))",'UNIQUE(company_id,id,side)']},
 {table:'rel_products',path:['products'],columns:[field('sku'),field('kind'),"CHECK(kind IN ('Producto','Servicio','Bien de uso'))"]},
 {table:'rel_documents',path:['documents'],columns:[field('number'),field('kind'),field('side'),field('letter'),field('date'),field('branch_id','branchId'),field('party_id','partyId'),field('source_id','sourceId','text',true),field('deposit_id','depositId','text',true),money('net'),money('vat'),money('perceptions'),money('total'),"CHECK(kind IN ('factura','credito','debito','cobro','pago','pedido','remito','orden-compra','saldo'))","CHECK(side IN ('cliente','proveedor'))","CHECK(letter IN ('A','B','C','X'))",ref('branch_id','rel_branches'),ref('party_id','rel_parties'),ref('source_id','rel_documents'),ref('deposit_id','rel_deposits'),'FOREIGN KEY(company_id,party_id,side) REFERENCES rel_parties(company_id,id,side) DEFERRABLE INITIALLY DEFERRED']},
 {table:'rel_stock_moves',path:['stockMoves'],columns:[field('date'),field('product_id','productId'),field('deposit_id','depositId'),field('branch_id','branchId'),field('origin_id','documentId','text',true),field('quantity','quantity','double precision'),"CHECK(json_typeof(data->'quantity')='number' AND quantity>'-Infinity'::float8 AND quantity<'Infinity'::float8)",ref('product_id','rel_products'),ref('deposit_id','rel_deposits'),ref('branch_id','rel_branches')]},
 {table:'rel_treasury_moves',path:['treasuryMoves'],columns:[field('date'),field('treasury_id','treasuryId'),field('branch_id','branchId'),field('origin_id','documentId','text',true),money('amount'),ref('treasury_id','rel_treasury_accounts'),ref('branch_id','rel_branches')]},
 {table:'rel_entries',path:['entries'],columns:[field('date'),field('branch_id','branchId'),field('origin_id','documentId','text',true),ref('branch_id','rel_branches')]}
]
export const pgChildren=[
 {table:'rel_document_lines',parent:'rel_documents',collection:'lines',columns:[field('product_id','productId'),field('quantity','quantity','double precision'),money('price'),field('discount','discount','double precision'),"CHECK(json_typeof(data->'quantity')='number' AND quantity>0 AND quantity<'Infinity'::float8)",'CHECK(price>=0 AND discount BETWEEN 0 AND 100)',ref('product_id','rel_products')]},
 {table:'rel_document_payments',parent:'rel_documents',collection:'payments',columns:[field('method'),money('amount'),field('treasury_id','treasuryId','text',true),'CHECK(amount>0)',ref('treasury_id','rel_treasury_accounts')]},
 {table:'rel_document_allocations',parent:'rel_documents',collection:'allocations',columns:[field('document_id','documentId'),money('amount'),'CHECK(amount>=0)',ref('document_id','rel_documents'),'UNIQUE(company_id,parent_id,document_id)']},
 {table:'rel_entry_lines',parent:'rel_entries',collection:'lines',columns:[field('account_id','accountId'),money('debit'),money('credit'),'CHECK(debit>=0 AND credit>=0)',ref('account_id','rel_accounts')]}
]
export const pgTables=[...pgEntities,...pgChildren].map(e=>e.table)
const coreSchema=`
 CREATE TABLE companies(id text PRIMARY KEY,revision bigint NOT NULL CHECK(revision BETWEEN 0 AND ${safe}),state text NOT NULL CHECK(json_typeof(state::json)='object'));
 CREATE TABLE sessions(company_id text NOT NULL REFERENCES companies(id),token text NOT NULL,user_id text NOT NULL,csrf text NOT NULL,expires bigint NOT NULL,auth_hash text NOT NULL,public_id text NOT NULL,created bigint NOT NULL,last_seen bigint NOT NULL,client_name text NOT NULL,PRIMARY KEY(company_id,token),UNIQUE(company_id,public_id));
 CREATE INDEX sessions_expiry ON sessions(company_id,expires);
 CREATE TABLE requests(company_id text NOT NULL REFERENCES companies(id),user_id text NOT NULL,request_id text NOT NULL,command_hash text NOT NULL,revision bigint NOT NULL,PRIMARY KEY(company_id,user_id,request_id));
 CREATE TABLE audit(company_id text NOT NULL REFERENCES companies(id),id bigint NOT NULL,record text NOT NULL CHECK(json_typeof(record::json)='object'),previous_hash text NOT NULL,hash text NOT NULL,PRIMARY KEY(company_id,id));
 CREATE TABLE recovery(company_id text NOT NULL REFERENCES companies(id),id bigint NOT NULL,revision bigint NOT NULL,state text NOT NULL CHECK(json_typeof(state::json)='object'),created text NOT NULL,PRIMARY KEY(company_id,id));
 CREATE TABLE login_attempts(company_id text NOT NULL REFERENCES companies(id),key text NOT NULL,count integer NOT NULL,reset bigint NOT NULL,PRIMARY KEY(company_id,key));
 CREATE TABLE fiscal_jobs(company_id text NOT NULL REFERENCES companies(id),environment text NOT NULL CHECK(environment IN ('homologacion','produccion')),document_id text NOT NULL,issuer text NOT NULL,point integer NOT NULL,type integer NOT NULL,number integer NOT NULL,state text NOT NULL,request text NOT NULL CHECK(json_typeof(request::json)='object'),options text NOT NULL CHECK(json_typeof(options::json)='object'),signature text NOT NULL,result text NOT NULL CHECK(json_typeof(result::json)='object'),updated text NOT NULL,PRIMARY KEY(company_id,environment,document_id));
 CREATE UNIQUE INDEX fiscal_active_series ON fiscal_jobs(company_id,environment,issuer,point,type) WHERE state IN ('preparando','enviando','incierto','conflicto');
 CREATE UNIQUE INDEX fiscal_approved_number ON fiscal_jobs(company_id,environment,issuer,point,type,number) WHERE number>0 AND state!='rechazado';
 CREATE TABLE fiscal_tickets(company_id text NOT NULL REFERENCES companies(id),environment text NOT NULL CHECK(environment IN ('homologacion','produccion')),issuer text NOT NULL,secret text NOT NULL,PRIMARY KEY(company_id,environment,issuer));`

function relationalSchema(){
 const common="company_id text NOT NULL REFERENCES companies(id) DEFERRABLE INITIALLY DEFERRED,position integer NOT NULL CHECK(position>=0),data json NOT NULL CHECK(json_typeof(data)='object')"
 const tables=pgEntities.map(e=>`CREATE TABLE ${e.table}(${common},id text NOT NULL CHECK(length(id)>0 AND id=data->>'id'),${e.columns.join(',')},PRIMARY KEY(company_id,id),UNIQUE(company_id,position));`).join('\n')
 const details=pgChildren.map(e=>`CREATE TABLE ${e.table}(${common},parent_id text NOT NULL,${e.columns.join(',')},PRIMARY KEY(company_id,parent_id,position),${ref('parent_id',e.parent)});`).join('\n')
 const deletes=[...pgTables].reverse().map(t=>`DELETE FROM ${t} WHERE company_id=NEW.id;`).join('\n')
 const inserts=pgEntities.map(e=>`INSERT INTO ${e.table}(company_id,position,id,data) SELECT NEW.id,(j.ordinality-1)::integer,j.value->>'id',j.value FROM json_array_elements(NEW.state::json #> '{${e.path.join(',')}}') WITH ORDINALITY j(value,ordinality);`).join('\n')
 const childInserts=pgChildren.map(e=>`INSERT INTO ${e.table}(company_id,parent_id,position,data) SELECT NEW.id,p.id,(j.ordinality-1)::integer,j.value FROM ${e.parent} p CROSS JOIN LATERAL json_array_elements(p.data->'${e.collection}') WITH ORDINALITY j(value,ordinality) WHERE p.company_id=NEW.id;`).join('\n')
 return `${tables}\n${details}
 CREATE FUNCTION project_company_state() RETURNS trigger LANGUAGE plpgsql SET search_path=sica,pg_catalog AS $body$ BEGIN ${deletes}\n${inserts}\n${childInserts} RETURN NEW; END $body$;
 CREATE TRIGGER rel_companies_state AFTER INSERT OR UPDATE OF state ON companies FOR EACH ROW EXECUTE FUNCTION project_company_state();
 CREATE INDEX rel_documents_party_date ON rel_documents(company_id,party_id,date);
 CREATE INDEX rel_documents_branch_date ON rel_documents(company_id,branch_id,date);
 CREATE INDEX rel_documents_source ON rel_documents(company_id,source_id);
 CREATE INDEX rel_stock_product_deposit_date ON rel_stock_moves(company_id,product_id,deposit_id,date);
 CREATE INDEX rel_treasury_account_date ON rel_treasury_moves(company_id,treasury_id,date);
 CREATE INDEX rel_entries_branch_date ON rel_entries(company_id,branch_id,date);
 CREATE INDEX rel_entry_account ON rel_entry_lines(company_id,account_id,parent_id);
 CREATE INDEX rel_allocations_target ON rel_document_allocations(company_id,document_id);
 CREATE VIEW rel_account_totals AS SELECT company_id,account_id,sum(debit) AS debit,sum(credit) AS credit,sum(debit)-sum(credit) AS balance FROM rel_entry_lines GROUP BY company_id,account_id;
 CREATE VIEW rel_stock_balances AS SELECT company_id,product_id,deposit_id,sum(quantity) AS quantity FROM rel_stock_moves GROUP BY company_id,product_id,deposit_id;
 CREATE VIEW rel_treasury_balances AS SELECT company_id,treasury_id,sum(amount) AS amount FROM rel_treasury_moves GROUP BY company_id,treasury_id;`
}
const sql=coreSchema+relationalSchema(),checksum=createHash('sha256').update(sql).digest('hex')
export async function migratePostgres(client){
 await client.query('BEGIN')
 try{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('sica:schema',0))")
  await client.query('CREATE SCHEMA IF NOT EXISTS sica; SET LOCAL search_path TO sica,pg_catalog; CREATE TABLE IF NOT EXISTS sica_migrations(version integer PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())')
  const versions=(await client.query('SELECT version,checksum FROM sica_migrations ORDER BY version')).rows
  if(versions.length&&!(versions.length===1&&versions[0].version===1&&versions[0].checksum===checksum))throw new Error('Versión o checksum del esquema PostgreSQL incompatible.')
  if(!versions.length){await client.query(sql);await client.query('INSERT INTO sica_migrations(version,checksum) VALUES(1,$1)',[checksum])}
  await assertPostgresSchema(client)
  await hardenPostgresSchema(client)
  await client.query('COMMIT')
 }catch(error){await client.query('ROLLBACK');throw error}
}
export async function assertPostgresSchema(client){
 const {rows}=await client.query("SELECT tablename AS name FROM pg_tables WHERE schemaname='sica' UNION ALL SELECT viewname AS name FROM pg_views WHERE schemaname='sica'")
 const names=new Set(rows.map(r=>r.name))
 for(const name of [...pgTables,'companies','sessions','audit','recovery','requests','login_attempts','fiscal_jobs','fiscal_tickets','rel_account_totals','rel_stock_balances','rel_treasury_balances'])if(!names.has(name))throw new Error(`Esquema PostgreSQL incompleto: falta ${name}.`)
 const trigger=await client.query("SELECT 1 FROM pg_trigger WHERE tgrelid='sica.companies'::regclass AND tgname='rel_companies_state' AND tgenabled='O'")
 if(!trigger.rowCount)throw new Error('Falta el trigger relacional PostgreSQL habilitado.')
}
