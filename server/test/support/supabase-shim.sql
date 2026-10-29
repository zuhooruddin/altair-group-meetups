-- Minimal stand-in for what every Supabase project already has, so the real
-- migrations and the provided seed run unchanged on an embedded Postgres
-- (PGlite) for the offline test suite. Hosted Supabase does not use this file.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema extensions;
create extension pgcrypto with schema extensions;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants ALL on new public tables/functions to the API roles by
-- default. Reproduce that so the migrations' revokes are actually exercised.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;

-- Only the columns the provided seed writes.
create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  confirmation_token varchar(255),
  email_change varchar(255),
  email_change_token_new varchar(255),
  recovery_token varchar(255)
);

create table auth.identities (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
