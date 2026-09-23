-- Sales reporting (+ Square connection storage).
-- - Markets choose whether vendors report sales: off / optional / required,
--   how many days they have, and an optional % of sales the market charges.
-- - Vendors report per market date (by hand, or filled in from Square).
-- - A vendor's report is visible only to them, that market's organizer and
--   the admin.

alter table public.markets
  add column sales_reporting text not null default 'off' check (sales_reporting in ('off', 'optional', 'required')),
  add column sales_report_due_days int not null default 3 check (sales_report_due_days between 1 and 30),
  add column sales_fee_percent numeric(5, 2) check (sales_fee_percent between 0 and 50);

grant update (sales_reporting, sales_report_due_days, sales_fee_percent) on public.markets to authenticated;
grant insert (sales_reporting, sales_report_due_days, sales_fee_percent) on public.markets to authenticated;

create table public.sales_reports (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  event_date date not null,
  gross_sales_cents int not null check (gross_sales_cents between 0 and 100000000),
  card_sales_cents int check (card_sales_cents between 0 and 100000000),
  cash_sales_cents int check (cash_sales_cents between 0 and 100000000),
  transactions int check (transactions between 0 and 100000),
  notes text check (char_length(notes) <= 500),
  source text not null default 'manual' check (source in ('manual', 'square')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, event_date)
);

create index sales_reports_market_idx on public.sales_reports (market_id, event_date);

create trigger sales_reports_updated_at before update on public.sales_reports
  for each row execute function public.set_updated_at();

-- A vendor can report a date only if they were accepted for it and it has happened.
create function public.can_report_sales(vendor uuid, market uuid, app uuid, day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.id = app and a.vendor_id = vendor and a.market_id = market
      and public.owns_vendor(vendor)
      and day = any (a.event_dates)
      and day <= current_date
      and a.status in ('accepted', 'paid')
  )
$$;

alter table public.sales_reports enable row level security;
revoke all on public.sales_reports from anon, authenticated;
grant select on public.sales_reports to authenticated;
grant insert (application_id, market_id, vendor_id, event_date, gross_sales_cents, card_sales_cents,
  cash_sales_cents, transactions, notes, source) on public.sales_reports to authenticated;
grant update (gross_sales_cents, card_sales_cents, cash_sales_cents, transactions, notes, source)
  on public.sales_reports to authenticated;

create policy "vendor, market organizer and admin read" on public.sales_reports
  for select to authenticated
  using (public.owns_vendor(vendor_id) or public.organizes_market(market_id) or public.is_admin());
create policy "accepted vendor reports" on public.sales_reports
  for insert to authenticated
  with check (public.is_active_user() and public.can_report_sales(vendor_id, market_id, application_id, event_date));
create policy "vendor corrects own report" on public.sales_reports
  for update to authenticated
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

-- Which "please report your sales" emails were sent (server only).
create table public.sales_report_reminders (
  application_id uuid not null references public.applications(id) on delete cascade,
  event_date date not null,
  sent_at timestamptz not null default now(),
  primary key (application_id, event_date)
);
alter table public.sales_report_reminders enable row level security;
revoke all on public.sales_report_reminders from anon, authenticated;

-- Square connections. Tokens are encrypted by the server before saving, and
-- only the server (full access) can read this table. Vendors see just
-- "connected / not connected" through the view below.
create table public.pos_connections (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  provider text not null check (provider in ('square')),
  merchant_id text not null,
  business_name text,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (vendor_id, provider)
);
alter table public.pos_connections enable row level security;
revoke all on public.pos_connections from anon, authenticated;

create view public.my_pos_connections with (security_invoker = false) as
  select vendor_id, provider, business_name, created_at
  from public.pos_connections
  where public.owns_vendor(vendor_id);
grant select on public.my_pos_connections to authenticated;
