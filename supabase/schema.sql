-- FRONT2LINE 제품별 매출 누적 BI

create table if not exists daily_product_sales (
  id bigserial primary key,
  sale_date date not null,
  product_name text not null,
  normalized_product_name text not null,
  sales_amount numeric not null default 0,
  source_file_name text,
  uploaded_at timestamptz not null default now(),
  unique (sale_date, normalized_product_name)
);

create index if not exists idx_daily_product_sales_date
on daily_product_sales (sale_date);

create index if not exists idx_daily_product_sales_product
on daily_product_sales (normalized_product_name);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value)
values ('merge_keywords', '["[이청아 착용]", "[앵콜 반다]"]'::jsonb)
on conflict (key) do nothing;
