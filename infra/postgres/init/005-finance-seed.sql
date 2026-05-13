insert into bootstrap.seed_users (id, email, name)
values
  (
    '92f49d09-7671-4518-bd08-c566ce68636a',
    'alexandre@example.com',
    'Alexandre Demo'
  ),
  (
    '4cb7f8d8-97a1-4d86-81f0-283ce8763a8f',
    'beatriz@example.com',
    'Beatriz Demo'
  )
on conflict (id) do update
set email = excluded.email,
    name = excluded.name;

insert into auth.users (
  id,
  email,
  name,
  password_hash,
  email_verified_at,
  created_at,
  updated_at
)
values
  (
    '92f49d09-7671-4518-bd08-c566ce68636a',
    'alexandre@example.com',
    'Alexandre Demo',
    'scrypt:3e94e1a36571829c2ab7a057ce1336ff:3ec94e1745d00adfb75a4d69083a3f2de8473dcbda69d125d1e4d226241478535f988b13e5402de1be19bde37540446310a83004c01d32e809be5613d8a97fe4',
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  ),
  (
    '4cb7f8d8-97a1-4d86-81f0-283ce8763a8f',
    'beatriz@example.com',
    'Beatriz Demo',
    'scrypt:0a202c9f7dd6681bbd8b9913c0902ce6:8efab6ad3839372217ca4be1c83ce8936fdac9858b085aab46a6cb0778aa51a414124ce0571cbe46af35b4f23268ef417772b0db87fa83b5c3f4f91f6ed06339',
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  )
on conflict (id) do update
set email = excluded.email,
    name = excluded.name,
    password_hash = excluded.password_hash,
    email_verified_at = excluded.email_verified_at,
    updated_at = excluded.updated_at;

insert into finance.user_settings (
  user_id,
  currency_code,
  locale,
  horizon_settings,
  created_at,
  updated_at
)
values
  (
    '92f49d09-7671-4518-bd08-c566ce68636a',
    'BRL',
    'pt-BR',
    '{"safetyMarginInCents":50000,"variableExpenseWindowInMonths":3}'::jsonb,
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  ),
  (
    '4cb7f8d8-97a1-4d86-81f0-283ce8763a8f',
    'BRL',
    'pt-BR',
    '{"safetyMarginInCents":80000,"variableExpenseWindowInMonths":4}'::jsonb,
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  )
on conflict (user_id) do update
set currency_code = excluded.currency_code,
    locale = excluded.locale,
    horizon_settings = excluded.horizon_settings,
    updated_at = excluded.updated_at;

insert into finance.accounts (
  id,
  user_id,
  name,
  type,
  opening_balance_in_cents,
  is_archived,
  archived_at,
  created_at,
  updated_at
)
values
  (
    'f16889b4-0d7d-4fd3-9810-0674d9294098',
    '92f49d09-7671-4518-bd08-c566ce68636a',
    'Conta Principal Seed',
    'checking',
    150000,
    false,
    null,
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  ),
  (
    '6573328f-299b-44cf-b41d-67482fd58195',
    '4cb7f8d8-97a1-4d86-81f0-283ce8763a8f',
    'Reserva Seed',
    'savings',
    220000,
    false,
    null,
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  )
on conflict (id) do update
set name = excluded.name,
    type = excluded.type,
    opening_balance_in_cents = excluded.opening_balance_in_cents,
    is_archived = excluded.is_archived,
    archived_at = excluded.archived_at,
    updated_at = excluded.updated_at;

insert into finance.tags (
  id,
  user_id,
  name,
  normalized_name,
  created_at,
  updated_at
)
values
  (
    '1d5d1174-f1bc-48e9-832b-a9bc85fc4843',
    '92f49d09-7671-4518-bd08-c566ce68636a',
    'Mercado',
    'mercado',
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  ),
  (
    'e68ac278-45ab-425d-a0fe-3c0d4f7b6ef6',
    '4cb7f8d8-97a1-4d86-81f0-283ce8763a8f',
    'Viagem',
    'viagem',
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  )
on conflict (id) do update
set name = excluded.name,
    normalized_name = excluded.normalized_name,
    updated_at = excluded.updated_at;

insert into finance.manual_transactions (
  id,
  user_id,
  account_id,
  type,
  description,
  category,
  amount_in_cents,
  transaction_date,
  payload,
  created_at,
  updated_at
)
values
  (
    '73c359b5-5de4-4d44-8bbf-c7471a1d194f',
    '92f49d09-7671-4518-bd08-c566ce68636a',
    'f16889b4-0d7d-4fd3-9810-0674d9294098',
    'expense',
    'Compra seed supermercado',
    'Alimentacao',
    2590,
    '2026-05-04',
    '{}'::jsonb,
    '2026-05-06T00:00:00.000Z',
    '2026-05-06T00:00:00.000Z'
  )
on conflict (id) do update
set description = excluded.description,
    category = excluded.category,
    amount_in_cents = excluded.amount_in_cents,
    transaction_date = excluded.transaction_date,
    updated_at = excluded.updated_at;

insert into finance.manual_transaction_tags (
  user_id,
  manual_transaction_id,
  tag_id,
  created_at
)
values (
  '92f49d09-7671-4518-bd08-c566ce68636a',
  '73c359b5-5de4-4d44-8bbf-c7471a1d194f',
  '1d5d1174-f1bc-48e9-832b-a9bc85fc4843',
  '2026-05-06T00:00:00.000Z'
)
on conflict (user_id, manual_transaction_id, tag_id) do nothing;

insert into legacy_import.sqlite_import_batches (
  id,
  user_id,
  source_path,
  source_checksum,
  status,
  summary,
  created_at,
  updated_at
)
values (
  'e61d6d8c-29f4-4ec0-a6b5-b48302080348',
  '92f49d09-7671-4518-bd08-c566ce68636a',
  'C:/temp/economy-cash-desktop.sqlite',
  'seed-checksum-v1',
  'staged',
  '{"detectedTables":["accounts","manual_transactions"]}'::jsonb,
  '2026-05-06T00:00:00.000Z',
  '2026-05-06T00:00:00.000Z'
)
on conflict (id) do update
set source_path = excluded.source_path,
    source_checksum = excluded.source_checksum,
    status = excluded.status,
    summary = excluded.summary,
    updated_at = excluded.updated_at;

insert into legacy_import.sqlite_import_rows (
  id,
  batch_id,
  user_id,
  source_table,
  source_row_id,
  payload,
  staged_at
)
values (
  '2f271da8-bb74-4de5-9388-db9aef570c14',
  'e61d6d8c-29f4-4ec0-a6b5-b48302080348',
  '92f49d09-7671-4518-bd08-c566ce68636a',
  'accounts',
  '1',
  '{"id":"legacy-account-1","name":"Conta Principal Seed","openingBalanceInCents":150000}'::jsonb,
  '2026-05-06T00:00:00.000Z'
)
on conflict (batch_id, source_table, source_row_id) do update
set payload = excluded.payload,
    staged_at = excluded.staged_at;