// SICA authenticates in its Node server. Supabase API roles must not bypass it.
// Restrict only our schema; leave Supabase's public/auth/storage schemas alone.
export const postgresHardeningSql=`DO $sica_permissions$
DECLARE roles text;
BEGIN
 SELECT 'PUBLIC' || coalesce(',' || string_agg(quote_ident(rolname),',' ORDER BY rolname),'') INTO roles
 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
 EXECUTE format('REVOKE ALL ON SCHEMA sica FROM %s;
 REVOKE ALL ON ALL TABLES IN SCHEMA sica FROM %s;
 REVOKE ALL ON ALL SEQUENCES IN SCHEMA sica FROM %s;
 REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sica FROM %s;
 ALTER DEFAULT PRIVILEGES IN SCHEMA sica REVOKE ALL ON TABLES FROM %s;
 ALTER DEFAULT PRIVILEGES IN SCHEMA sica REVOKE ALL ON SEQUENCES FROM %s;
 ALTER DEFAULT PRIVILEGES IN SCHEMA sica REVOKE ALL ON FUNCTIONS FROM %s',roles,roles,roles,roles,roles,roles,roles);
END $sica_permissions$;`
export const hardenPostgresSchema=client=>client.query(postgresHardeningSql)
