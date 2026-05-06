create schema if not exists bootstrap;

create table if not exists bootstrap.seed_metadata (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

create table if not exists bootstrap.seed_users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
