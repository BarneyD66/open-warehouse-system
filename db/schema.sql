create table if not exists warehouse_submissions (
  id text primary key,
  type text not null check (type in ('inquiry', 'inbound')),
  customer_code text not null default 'PUBLIC_LEAD',
  status text not null,
  title text not null default '',
  contact text not null default '',
  phone text not null default '',
  search_text text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists warehouse_submissions_customer_idx
  on warehouse_submissions (customer_code, created_at desc);

create index if not exists warehouse_submissions_type_status_idx
  on warehouse_submissions (type, status);

create index if not exists warehouse_submissions_search_idx
  on warehouse_submissions using gin (to_tsvector('simple', search_text));

create table if not exists warehouse_customers (
  customer_code text primary key,
  company_name text not null,
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  vat_number text,
  eori_number text,
  platforms text[] not null default '{}',
  store_url text,
  business_address text,
  status text not null default 'unverified',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists warehouse_customer_accounts (
  username text primary key,
  customer_code text not null references warehouse_customers(customer_code),
  password_hash text not null,
  phone text not null,
  email text,
  status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists warehouse_customer_accounts_customer_idx
  on warehouse_customer_accounts (customer_code, status);

create table if not exists warehouse_audit_logs (
  id text primary key,
  action text not null,
  actor_role text not null,
  actor_name text not null,
  target_type text not null,
  target_id text not null,
  customer_code text,
  summary text not null,
  note text,
  before_payload jsonb,
  after_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists warehouse_audit_logs_customer_idx
  on warehouse_audit_logs (customer_code, created_at desc);

create index if not exists warehouse_audit_logs_target_idx
  on warehouse_audit_logs (target_type, target_id, created_at desc);

create table if not exists warehouse_skus (
  sku_code text primary key,
  customer_code text not null references warehouse_customers(customer_code),
  product_name text not null,
  barcode text,
  category text,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists warehouse_skus_customer_idx
  on warehouse_skus (customer_code, status);

create table if not exists warehouse_locations (
  location_code text primary key,
  warehouse_code text not null default 'SHEFFIELD-MAIN',
  zone text not null default 'MAIN',
  status text not null default 'active',
  capacity_cbm numeric(10, 2),
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists warehouse_locations_zone_idx
  on warehouse_locations (warehouse_code, zone, status);

create table if not exists warehouse_inventory_balances (
  id text primary key,
  customer_code text not null references warehouse_customers(customer_code),
  sku_code text not null references warehouse_skus(sku_code),
  warehouse_code text not null,
  location_code text,
  available_qty integer not null default 0,
  reserved_qty integer not null default 0,
  frozen_qty integer not null default 0,
  defective_qty integer not null default 0,
  inbound_qty integer not null default 0,
  alert_qty integer not null default 0,
  aging_days integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists warehouse_inventory_customer_idx
  on warehouse_inventory_balances (customer_code, warehouse_code, sku_code);

create table if not exists warehouse_inventory_movements (
  id text primary key,
  customer_code text not null references warehouse_customers(customer_code),
  sku_code text not null references warehouse_skus(sku_code),
  ref_type text not null,
  ref_id text not null,
  movement_type text not null,
  quantity integer not null,
  before_qty integer,
  after_qty integer,
  note text,
  occurred_at timestamptz not null default now(),
  operator text not null default 'system'
);

create index if not exists warehouse_inventory_movements_customer_idx
  on warehouse_inventory_movements (customer_code, occurred_at desc);

create index if not exists warehouse_inventory_movements_ref_idx
  on warehouse_inventory_movements (ref_type, ref_id, occurred_at desc);

create table if not exists warehouse_inventory_adjustments (
  id text primary key,
  customer_code text not null,
  sku_code text not null,
  warehouse_code text not null default 'SHEFFIELD-MAIN',
  status text not null default 'pending',
  available_delta integer not null default 0,
  reserved_delta integer not null default 0,
  alert_qty integer,
  aging_days integer,
  reason text not null default '',
  requested_by text not null default 'system',
  requested_by_role text not null default 'staff',
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists warehouse_inventory_adjustments_status_idx
  on warehouse_inventory_adjustments (status, requested_at desc);

create index if not exists warehouse_inventory_adjustments_customer_idx
  on warehouse_inventory_adjustments (customer_code, requested_at desc);

create table if not exists warehouse_outbound_orders (
  id text primary key,
  customer_code text not null references warehouse_customers(customer_code),
  channel text not null,
  order_count integer not null default 0,
  status text not null default 'pending_review',
  recipient_name text,
  delivery_address text,
  requested_ship_date date,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists warehouse_outbound_customer_status_idx
  on warehouse_outbound_orders (customer_code, status, created_at desc);

create table if not exists warehouse_return_orders (
  id text primary key,
  customer_code text not null,
  platform text not null default '',
  original_order_no text,
  buyer_return_tracking text,
  status text not null default 'requested',
  return_reason text not null default '',
  expected_arrival_date date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists warehouse_return_orders_customer_status_idx
  on warehouse_return_orders (customer_code, status, created_at desc);

create index if not exists warehouse_return_orders_tracking_idx
  on warehouse_return_orders (buyer_return_tracking);

create table if not exists warehouse_billing_records (
  id text primary key,
  customer_code text not null references warehouse_customers(customer_code),
  ref_type text not null,
  ref_id text not null,
  status text not null default 'draft',
  currency text not null default 'GBP',
  amount numeric(12, 2) not null default 0,
  due_date date,
  title text,
  note text,
  customer_message text,
  customer_confirmed_at timestamptz,
  payment_reference text,
  payment_note text,
  payment_submitted_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists warehouse_billing_customer_status_idx
  on warehouse_billing_records (customer_code, status, created_at desc);

create table if not exists warehouse_documents (
  id text primary key,
  customer_code text not null references warehouse_customers(customer_code),
  ref_type text not null,
  ref_id text not null,
  category text not null default 'other',
  original_name text not null,
  stored_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes integer not null default 0,
  note text,
  uploaded_by_role text not null,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists warehouse_documents_customer_ref_idx
  on warehouse_documents (customer_code, ref_type, ref_id, uploaded_at desc);

create table if not exists warehouse_notification_states (
  id text primary key,
  dismissed boolean not null default false,
  dismissed_by text,
  dismissed_at timestamptz,
  payload jsonb not null default '{}'::jsonb
);
