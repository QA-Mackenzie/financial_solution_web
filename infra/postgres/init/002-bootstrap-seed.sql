insert into bootstrap.seed_metadata (key, value)
values ('environment', 'local-dev')
on conflict (key) do update
set value = excluded.value;

insert into bootstrap.seed_users (id, email, name)
values (
  '92f49d09-7671-4518-bd08-c566ce68636a',
  'alexandre@example.com',
  'Alexandre Demo'
)
on conflict (id) do nothing;
