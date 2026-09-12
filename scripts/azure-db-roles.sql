-- Restricted application roles for the Peace Buddy database.
--
-- Run by scripts/azure-db-roles.sh as the server admin, connected to the
-- application database, from a one-shot Container Apps Job inside the VNet.
-- It cannot be run from a laptop: the server has no public endpoint.
--
-- Two roles, because the api and the migration step need different powers.
--
--   :migrate_user  owns every table. Runs `prisma migrate deploy`, nothing
--                  else. Its password belongs in the deploy runbook, never in
--                  a running container.
--   :app_user      reads and writes rows. Cannot CREATE, ALTER or DROP. This
--                  is the role that goes in DATABASE_URL on the deployed api.
--
-- Neither can create databases or roles, neither is a member of
-- azure_pg_admin, and neither can reach another database on the server. The
-- admin account can do all three, which is why it must not end up in
-- DATABASE_URL. See docs/decisions.md, "Two database roles per server".
--
-- Idempotent. Re-running resets both passwords to whatever the env file
-- holds, which is how a rotation is done.
--
-- The caller prepends the \set lines this file reads:
--   db_name  admin_user  migrate_user  migrate_password  app_user  app_password

\set ON_ERROR_STOP on

-- Variable substitution does not happen inside dollar-quoted strings, so the
-- assertions below cannot read :'app_user' directly. Park the values in a temp
-- table and have the DO blocks read that instead.
CREATE TEMP TABLE _pb_cfg (k text PRIMARY KEY, v text);
INSERT INTO _pb_cfg VALUES
  ('db_name',      :'db_name'),
  ('migrate_user', :'migrate_user'),
  ('app_user',     :'app_user');

-- Wrong database means every grant below lands somewhere harmless and the
-- real database is left wide open, with nothing failing. Check first.
DO $$
DECLARE want text := (SELECT v FROM _pb_cfg WHERE k = 'db_name');
BEGIN
  IF current_database() <> want THEN
    RAISE EXCEPTION 'connected to %, expected %', current_database(), want;
  END IF;
END $$;

-- 1. The roles -----------------------------------------------------------
-- CREATE only when absent, then ALTER unconditionally, so a re-run rotates
-- the password rather than failing. The ALTER sets the password and nothing
-- else: on Azure Flexible Server the admin is not a superuser, and an ALTER
-- ROLE naming the superuser attribute is refused even when it changes it to
-- the value it already has. Attributes are asserted in section 6 instead.

SELECT format('CREATE ROLE %I LOGIN NOCREATEDB NOCREATEROLE NOSUPERUSER NOREPLICATION',
              :'migrate_user')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrate_user')
\gexec

SELECT format('ALTER ROLE %I PASSWORD %L', :'migrate_user', :'migrate_password')
\gexec

SELECT format('CREATE ROLE %I LOGIN NOCREATEDB NOCREATEROLE NOSUPERUSER NOREPLICATION',
              :'app_user')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format('ALTER ROLE %I PASSWORD %L', :'app_user', :'app_password')
\gexec

-- 2. The database --------------------------------------------------------
-- Postgres grants CONNECT on a new database to PUBLIC. Take it back, so any
-- future role on this server has to be named here to reach the application
-- data. The admin keeps access through ownership and is granted explicitly as
-- well: locking the admin out of a server with no public endpoint is not a
-- recoverable mistake.

SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_name')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db_name', :'admin_user')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db_name', :'migrate_user')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db_name', :'app_user')
\gexec

-- 3. The schema ----------------------------------------------------------
-- CREATE is what separates the two roles. The migration role has it, so the
-- tables Prisma creates are owned by it; the app role does not, so the api
-- cannot add or drop anything.
--
-- Postgres 15 and later stopped granting CREATE on `public` to PUBLIC, but a
-- database restored from an older server carries the old grant in its dump.
-- Revoke rather than assume.

REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'migrate_user')
\gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user')
\gexec

-- 4. Objects that already exist ------------------------------------------
-- Nothing on a fresh prod server. On staging this covers the tables restored
-- from Neon, which arrive owned by whoever ran the restore.
--
-- schema.prisma uses cuid ids and declares no autoincrement, so there are no
-- sequences today. Granted anyway, so that adding one later does not fail at
-- the first insert after deploy.

SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I',
              :'app_user')
\gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_user')
\gexec

-- 5. Objects the migration role creates later ----------------------------
-- The line the whole two-role split depends on. Without it the next migration
-- ships a table the api gets "permission denied" on, and that failure lands
-- after deploy rather than during it.
--
-- FOR ROLE names the *creating* role. These defaults apply to what
-- :migrate_user makes, not to what anyone else makes, which is why every
-- migration has to run as :migrate_user and not as the admin.

SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
              'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
              :'migrate_user', :'app_user')
\gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
              'GRANT USAGE, SELECT ON SEQUENCES TO %I',
              :'migrate_user', :'app_user')
\gexec

-- 6. Assert, do not assume -----------------------------------------------
-- Section 1 does not correct the attributes of a role that already existed,
-- and a grant that quietly did nothing looks exactly like one that worked.
-- Every check below raises, so the psql exit code fails the job replica and
-- the script reports it.

DO $$
DECLARE
  v_migrate text := (SELECT v FROM _pb_cfg WHERE k = 'migrate_user');
  v_app     text := (SELECT v FROM _pb_cfg WHERE k = 'app_user');
  v_db      text := (SELECT v FROM _pb_cfg WHERE k = 'db_name');
  bad       text;
BEGIN
  SELECT string_agg(c.v, ', ') INTO bad
    FROM _pb_cfg c
   WHERE c.k IN ('migrate_user', 'app_user')
     AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = c.v);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'role(s) % do not exist', bad;
  END IF;

  SELECT string_agg(r.rolname, ', ') INTO bad
    FROM pg_roles r JOIN _pb_cfg c ON c.v = r.rolname
   WHERE c.k IN ('migrate_user', 'app_user')
     AND (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolbypassrls);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'role(s) % hold SUPERUSER, CREATEDB, CREATEROLE or BYPASSRLS', bad;
  END IF;

  -- azure_pg_admin exists only on Azure Flexible Server. The same file runs
  -- against a plain Postgres in the local smoke test, where it does not.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azure_pg_admin') THEN
    SELECT string_agg(r.rolname, ', ') INTO bad
      FROM pg_roles r JOIN _pb_cfg c ON c.v = r.rolname
     WHERE c.k IN ('migrate_user', 'app_user')
       AND pg_has_role(r.rolname, 'azure_pg_admin', 'MEMBER');
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'role(s) % are members of azure_pg_admin', bad;
    END IF;
  END IF;

  IF has_schema_privilege(v_app, 'public', 'CREATE') THEN
    RAISE EXCEPTION '% can CREATE in schema public; it must not be able to', v_app;
  END IF;
  IF NOT has_schema_privilege(v_migrate, 'public', 'CREATE') THEN
    RAISE EXCEPTION '% cannot CREATE in schema public; migrations would fail', v_migrate;
  END IF;
  IF NOT has_schema_privilege(v_app, 'public', 'USAGE') THEN
    RAISE EXCEPTION '% cannot USE schema public', v_app;
  END IF;

  IF NOT has_database_privilege(v_app, v_db, 'CONNECT') THEN
    RAISE EXCEPTION '% cannot CONNECT to %', v_app, v_db;
  END IF;
  IF NOT has_database_privilege(v_migrate, v_db, 'CONNECT') THEN
    RAISE EXCEPTION '% cannot CONNECT to %', v_migrate, v_db;
  END IF;
  -- PUBLIC is not a row in pg_roles, so has_database_privilege cannot ask
  -- about it. Read the ACL instead; grantee 0 is PUBLIC, and a NULL acl means
  -- the built-in default, which grants PUBLIC CONNECT.
  IF EXISTS (
    SELECT 1 FROM pg_database d
     WHERE d.datname = v_db
       AND (d.datacl IS NULL
            OR EXISTS (SELECT 1 FROM aclexplode(d.datacl) a
                        WHERE a.grantee = 0 AND a.privilege_type = 'CONNECT'))
  ) THEN
    RAISE EXCEPTION 'PUBLIC can still CONNECT to %', v_db;
  END IF;

  SELECT string_agg(format('%s.%s', schemaname, tablename), ', ') INTO bad
    FROM pg_tables
   WHERE schemaname = 'public'
     AND NOT has_table_privilege(v_app, format('%I.%I', schemaname, tablename)::regclass, 'SELECT');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '% cannot SELECT from existing table(s): %', v_app, bad;
  END IF;
END $$;

-- Printed into the job log, so the run leaves a record of what was granted.
SELECT r.rolname                                       AS role,
       r.rolcanlogin                                   AS can_login,
       r.rolsuper OR r.rolcreatedb OR r.rolcreaterole  AS privileged,
       has_schema_privilege(r.rolname, 'public', 'CREATE') AS can_create,
       has_schema_privilege(r.rolname, 'public', 'USAGE')  AS can_use
  FROM pg_roles r
  JOIN _pb_cfg c ON c.v = r.rolname
 WHERE c.k IN ('migrate_user', 'app_user')
 ORDER BY r.rolname;

DROP TABLE _pb_cfg;
