-- FantaChat - service role grants for server-side imports
--
-- The Sportmonks import runs server-side with SUPABASE_SERVICE_ROLE_KEY.
-- This key must be able to read/write the app tables while staying outside
-- the browser/client bundle.

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to service_role;

alter default privileges in schema public
  grant all privileges on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;
