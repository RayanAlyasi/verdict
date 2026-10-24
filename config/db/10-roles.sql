-- Runs as the superuser when the Postgres container first creates its data directory, and in the
-- api's tests. Plain SQL with no psql commands, so the tests can run this exact file.
-- 20-role-passwords.sh then lets the roles log in.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'verdict_api') THEN
    CREATE ROLE verdict_api;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'verdict_web') THEN
    CREATE ROLE verdict_web;
  END IF;
  -- Owning the database gives the api the public schema and lets DBOS create its own schema.
  EXECUTE format('ALTER DATABASE %I OWNER TO verdict_api', current_database());
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO verdict_web', current_database());
END
$$;

-- Postgres grants USAGE on public to every role; without this the web role could read api tables.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Better Auth's tables. Only the web role can reach them.
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION verdict_web;
ALTER ROLE verdict_web SET search_path = auth;
