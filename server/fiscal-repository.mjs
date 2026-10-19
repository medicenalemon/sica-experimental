export class FiscalRepository {
 constructor(repository){this.repository=repository;this.companyId=repository.companyId}
 query(sql,parameters=[],one=false){
  if(this.repository.backend==='postgres'){
   let index=0
   return this.repository.query(sql.replace(/\?/g,()=>`$${++index}`),parameters).then(result=>one?result.rows[0]:result.rows)
  }
  const statement=this.repository.db.prepare(sql)
  return one?statement.get(...parameters):statement.all(...parameters)
 }
 write(sql,parameters=[]){
  if(this.repository.backend==='postgres'){let index=0;return this.repository.query(sql.replace(/\?/g,()=>`$${++index}`),parameters)}
  return this.repository.db.prepare(sql).run(...parameters)
 }
 transaction(callback){
  if(this.repository.backend==='postgres')return this.repository.transaction(callback)
  return this.repository.exclusive(async()=>{const db=this.repository.db;db.exec('BEGIN IMMEDIATE');try{const result=await callback();db.exec('COMMIT');return result}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}})
 }
 getJob(id,environment){return this.query('SELECT * FROM fiscal_jobs WHERE company_id=? AND environment=? AND document_id=?',[this.companyId,environment,id],true)}
 getTicket(environment,issuer){return this.query('SELECT secret FROM fiscal_tickets WHERE company_id=? AND environment=? AND issuer=?',[this.companyId,environment,issuer],true)}
 saveTicket(environment,issuer,secret){return this.write('INSERT INTO fiscal_tickets(company_id,environment,issuer,secret) VALUES(?,?,?,?) ON CONFLICT(company_id,environment,issuer) DO UPDATE SET secret=excluded.secret',[this.companyId,environment,issuer,secret])}
 activeSeries(environment,request){return this.query("SELECT document_id FROM fiscal_jobs WHERE company_id=? AND environment=? AND issuer=? AND point=? AND type=? AND state IN ('preparando','enviando','incierto','conflicto')",[this.companyId,environment,request.issuer,request.point,request.type],true)}
 insertJob(values){return this.write('INSERT INTO fiscal_jobs(company_id,environment,document_id,issuer,point,type,number,state,request,options,signature,result,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',values)}
 reserveNumber(id,environment,number,request){return this.write("UPDATE fiscal_jobs SET number=?,state='enviando',request=?,updated=? WHERE company_id=? AND environment=? AND document_id=?",[number,JSON.stringify(request),new Date().toISOString(),this.companyId,environment,id])}
 finishJob(id,environment,result){return this.write('UPDATE fiscal_jobs SET state=?,result=?,updated=? WHERE company_id=? AND environment=? AND document_id=?',[result.state,JSON.stringify(result),new Date().toISOString(),this.companyId,environment,id])}
 bumpRevision(){return this.write('UPDATE companies SET revision=revision+1 WHERE id=?',[this.companyId])}
}
