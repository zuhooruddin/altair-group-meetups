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

-- Realtime Authorization surface: Supabase evaluates RLS on realtime.messages
-- with realtime.topic() = the channel name. Only what the policies touch.
create schema realtime;
grant usage on schema realtime to anon, authenticated, service_role;
create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null,
  payload jsonb,
  event text,
  private boolean default false,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
grant select, insert on realtime.messages to anon, authenticated;
grant usage on sequence realtime.messages_id_seq to anon, authenticated;
create function realtime.topic() returns text language sql stable
  as $$ select nullif(current_setting('realtime.topic', true), '')::text $$;

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
