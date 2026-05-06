create schema if not exists finance;
create schema if not exists audit;
create schema if not exists legacy_import;

create table if not exists finance.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency_code text not null default 'BRL',
  locale text not null default 'pt-BR',
  horizon_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists finance.accounts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'cash', 'investment', 'other')),
  opening_balance_in_cents bigint not null,
  is_archived boolean not null default false,
  archived_at timestamptz null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id)
);

create index if not exists finance_accounts_user_idx on finance.accounts (user_id, created_at desc);
create index if not exists finance_accounts_user_archived_idx on finance.accounts (user_id, is_archived);

create table if not exists finance.tags (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id),
  unique (user_id, normalized_name)
);

create index if not exists finance_tags_user_idx on finance.tags (user_id, name asc);

create table if not exists finance.manual_transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  type text not null check (type in ('income', 'expense')),
  description text not null,
  category text null,
  amount_in_cents bigint not null,
  transaction_date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, account_id)
    references finance.accounts (user_id, id)
    on delete restrict
);

create index if not exists finance_manual_transactions_user_date_idx
  on finance.manual_transactions (user_id, transaction_date desc, created_at desc);
create index if not exists finance_manual_transactions_user_account_idx
  on finance.manual_transactions (user_id, account_id, transaction_date desc);

create table if not exists finance.manual_transaction_tags (
  user_id uuid not null,
  manual_transaction_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null,
  primary key (user_id, manual_transaction_id, tag_id),
  foreign key (user_id, manual_transaction_id)
    references finance.manual_transactions (user_id, id)
    on delete cascade,
  foreign key (user_id, tag_id)
    references finance.tags (user_id, id)
    on delete cascade
);

create index if not exists finance_manual_transaction_tags_tag_idx
  on finance.manual_transaction_tags (user_id, tag_id);

create table if not exists finance.recurring_contracts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  name text not null,
  category text not null,
  type text not null check (type in ('income', 'expense')),
  amount_in_cents bigint not null,
  due_day smallint not null check (due_day between 1 and 31),
  start_date date not null,
  end_date date null,
  status text not null check (status in ('active', 'inactive')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, account_id)
    references finance.accounts (user_id, id)
    on delete restrict
);

create index if not exists finance_recurring_contracts_user_status_idx
  on finance.recurring_contracts (user_id, status, due_day asc);

create table if not exists finance.recurring_contract_adjustments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_contract_id uuid not null,
  amount_in_cents bigint not null,
  effective_start_date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, recurring_contract_id)
    references finance.recurring_contracts (user_id, id)
    on delete cascade
);

create index if not exists finance_recurring_contract_adjustments_user_contract_idx
  on finance.recurring_contract_adjustments (user_id, recurring_contract_id, effective_start_date desc);

create table if not exists finance.recurring_contract_tags (
  user_id uuid not null,
  recurring_contract_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null,
  primary key (user_id, recurring_contract_id, tag_id),
  foreign key (user_id, recurring_contract_id)
    references finance.recurring_contracts (user_id, id)
    on delete cascade,
  foreign key (user_id, tag_id)
    references finance.tags (user_id, id)
    on delete cascade
);

create index if not exists finance_recurring_contract_tags_tag_idx
  on finance.recurring_contract_tags (user_id, tag_id);

create table if not exists finance.credit_cards (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  credit_limit_in_cents bigint not null,
  statement_closing_day smallint not null check (statement_closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  payment_account_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id),
  unique (user_id, normalized_name),
  foreign key (user_id, payment_account_id)
    references finance.accounts (user_id, id)
    on delete restrict
);

create index if not exists finance_credit_cards_user_idx on finance.credit_cards (user_id, name asc);

create table if not exists finance.credit_card_purchases (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null,
  description text not null,
  category text null,
  amount_in_cents bigint not null,
  purchase_date date not null,
  installment_count integer not null default 1 check (installment_count >= 1),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, credit_card_id)
    references finance.credit_cards (user_id, id)
    on delete restrict
);

create index if not exists finance_credit_card_purchases_user_date_idx
  on finance.credit_card_purchases (user_id, purchase_date desc, created_at desc);

create table if not exists finance.credit_card_purchase_tags (
  user_id uuid not null,
  credit_card_purchase_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null,
  primary key (user_id, credit_card_purchase_id, tag_id),
  foreign key (user_id, credit_card_purchase_id)
    references finance.credit_card_purchases (user_id, id)
    on delete cascade,
  foreign key (user_id, tag_id)
    references finance.tags (user_id, id)
    on delete cascade
);

create index if not exists finance_credit_card_purchase_tags_tag_idx
  on finance.credit_card_purchase_tags (user_id, tag_id);

create table if not exists finance.installment_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('account', 'creditCard')),
  account_id uuid null,
  credit_card_id uuid null,
  description text not null,
  total_amount_in_cents bigint not null,
  installment_count integer not null check (installment_count >= 1),
  first_occurrence_date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, account_id)
    references finance.accounts (user_id, id)
    on delete restrict,
  foreign key (user_id, credit_card_id)
    references finance.credit_cards (user_id, id)
    on delete restrict,
  check (
    (source_type = 'account' and account_id is not null and credit_card_id is null)
    or
    (source_type = 'creditCard' and credit_card_id is not null and account_id is null)
  )
);

create index if not exists finance_installment_plans_user_occurrence_idx
  on finance.installment_plans (user_id, first_occurrence_date asc);

create table if not exists finance.installment_operations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  installment_plan_id uuid not null,
  type text not null check (type in ('anticipation')),
  operation_date date not null,
  affected_installment_count integer not null check (affected_installment_count >= 1),
  affected_amount_in_cents bigint not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, installment_plan_id)
    references finance.installment_plans (user_id, id)
    on delete cascade
);

create index if not exists finance_installment_operations_user_plan_idx
  on finance.installment_operations (user_id, installment_plan_id, operation_date desc);

create table if not exists finance.provisions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  description text not null,
  category text not null,
  target_amount_in_cents bigint not null,
  start_date date not null,
  target_date date not null,
  status text not null check (status in ('active', 'redeemed')),
  redeemed_at timestamptz null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id),
  foreign key (user_id, account_id)
    references finance.accounts (user_id, id)
    on delete restrict
);

create index if not exists finance_provisions_user_status_idx
  on finance.provisions (user_id, status, target_date asc);

create table if not exists finance.variable_expense_overrides (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  description text not null,
  occurrence_date date not null,
  amount_in_cents bigint not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id),
  unique (user_id, account_id, description, occurrence_date),
  foreign key (user_id, account_id)
    references finance.accounts (user_id, id)
    on delete restrict
);

create index if not exists finance_variable_expense_overrides_user_occurrence_idx
  on finance.variable_expense_overrides (user_id, occurrence_date asc);

create table if not exists audit.financial_events (
  id uuid primary key,
  user_id uuid null references auth.users(id) on delete set null,
  resource_type text not null,
  resource_id uuid null,
  action text not null,
  request_id text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null
);

create index if not exists audit_financial_events_user_idx
  on audit.financial_events (user_id, occurred_at desc);
create index if not exists audit_financial_events_resource_idx
  on audit.financial_events (resource_type, resource_id, occurred_at desc);
create index if not exists audit_financial_events_action_idx
  on audit.financial_events (action, occurred_at desc);

create table if not exists legacy_import.sqlite_import_batches (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_path text not null,
  source_checksum text not null,
  status text not null check (status in ('staged', 'validated', 'imported', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id)
);

create index if not exists legacy_import_batches_user_idx
  on legacy_import.sqlite_import_batches (user_id, created_at desc);

create table if not exists legacy_import.sqlite_import_rows (
  id uuid primary key,
  batch_id uuid not null,
  user_id uuid not null,
  source_table text not null,
  source_row_id text not null,
  payload jsonb not null,
  staged_at timestamptz not null,
  unique (batch_id, source_table, source_row_id),
  foreign key (user_id, batch_id)
    references legacy_import.sqlite_import_batches (user_id, id)
    on delete cascade
);

create index if not exists legacy_import_rows_batch_idx
  on legacy_import.sqlite_import_rows (batch_id, source_table, source_row_id);