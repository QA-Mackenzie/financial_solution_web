create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  email_verified_at timestamptz null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null,
  revoked_at timestamptz null
);

create index if not exists auth_sessions_user_idx on auth.sessions (user_id);
create index if not exists auth_sessions_expires_idx on auth.sessions (expires_at);

create table if not exists auth.password_reset_tokens (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  consumed_at timestamptz null
);

create table if not exists auth.email_verification_tokens (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  consumed_at timestamptz null
);

create table if not exists auth.consents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  consent_version text not null,
  granted_at timestamptz not null
);

create index if not exists auth_consents_user_idx on auth.consents (user_id);

create table if not exists auth.audit_logs (
  id uuid primary key,
  user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  ip_address text null,
  user_agent text null,
  request_id text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null
);

create index if not exists auth_audit_logs_user_idx on auth.audit_logs (user_id, occurred_at desc);
create index if not exists auth_audit_logs_event_idx on auth.audit_logs (event_type, occurred_at desc);
