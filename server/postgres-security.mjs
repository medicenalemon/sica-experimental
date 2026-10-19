// SICA authenticates in its Node server. Supabase API roles must not bypass it.
// Restrict only our schema; leave Supabase's public/auth/storage schemas alone.
export async function hardenPostgresSchema(client){
 const roles=['PUBLIC',...(await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname")).rows.map(r=>'"'+r.rolname+'"')].join(',')
 await client.query(`REVOKE ALL ON SCHEMA sica FROM ${roles};
 REVOKE ALL ON ALL TABLES IN SCHEMA sica FROM ${roles};
 REVOKE ALL ON ALL SEQUENCES IN SCHEMA sica FROM ${roles};
 REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sica FROM ${roles};
 ALTER DEFAULT PRIVILEGES IN SCHEMA sica REVOKE ALL ON TABLES FROM ${roles};
 ALTER DEFAULT PRIVILEGES IN SCHEMA sica REVOKE ALL ON SEQUENCES FROM ${roles};
 ALTER DEFAULT PRIVILEGES IN SCHEMA sica REVOKE ALL ON FUNCTIONS FROM ${roles}`)
}
