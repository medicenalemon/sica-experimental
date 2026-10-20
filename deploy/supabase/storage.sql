-- Apply after bootstrap.sql in a Supabase project. No public access policies.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('sica-private','sica-private',false,52428800,ARRAY['application/json','application/octet-stream'])
ON CONFLICT(id) DO NOTHING;
