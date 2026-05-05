-- 0. Limpiar las tablas a medio crear de la importación fallida
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- 1. Crear el rol 'postgres' (Supabase lo usa como dueño de todo, AWS no lo trae por defecto)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres;
  END IF;
  -- Roles internos de Supabase
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin;
  END IF;
END
$$;

-- 2. Crear los esquemas críticos que Supabase asume que existen
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;

-- 3. Instalar la extensión UUID dentro del esquema extensions (Vital para los IDs de tus tablas)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- 4. Crear una tabla de usuarios falsa en el esquema auth para que las Foreign Keys no exploten
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid NOT NULL PRIMARY KEY,
    email character varying(255),
    encrypted_password character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);
