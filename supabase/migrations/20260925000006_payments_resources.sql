-- Stallpass Phase 4: booth-fee payments + the "Start" hub for new vendors.
--
-- Payments: two ways, chosen per market.
--  1. Stripe Connect (Express). Money goes straight to the organizer's Stripe
--     account ("direct charge"); Stallpass takes an application fee. We never
--     hold the money.
--  2. The market's own payment link (many city-run markets have one). The
--     vendor pays there and taps "I've paid"; the organizer confirms.
-- Payment rows are written only by trusted server code (after Stripe
-- confirms), never directly by users.

-- ---------------------------------------------------------------------------
-- Platform fee (admin setting)
-- ---------------------------------------------------------------------------

alter table public.platform_settings
  add column platform_fee_percent numeric(5, 2) not null default 5.00 check (platform_fee_percent between 0 and 50),
  add column platform_fee_flat_cents int not null default 0 check (platform_fee_flat_cents between 0 and 10000);

grant update (platform_fee_percent, platform_fee_flat_cents) on public.platform_settings to authenticated;

-- ---------------------------------------------------------------------------
-- How each market takes payment
-- ---------------------------------------------------------------------------

alter table public.markets
  add column payment_method text not null default 'none'
    check (payment_method in ('none', 'stripe', 'external_link')),
  add column payment_link text check (char_length(payment_link) <= 500 and payment_link ~* '^https://'),
  add column payment_instructions text check (char_length(payment_instructions) <= 1000);

grant update (payment_method, payment_link, payment_instructions) on public.markets to authenticated;
grant insert (payment_method, payment_link, payment_instructions) on public.markets to authenticated;

-- Organizers' Stripe accounts. Written only by server code after talking to Stripe.
create table public.payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payout_accounts enable row level security;
revoke all on public.payout_accounts from anon, authenticated;
grant select on public.payout_accounts to authenticated;
create policy "owner and admin read payout account" on public.payout_accounts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  method text not null check (method in ('stripe', 'external_link')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'reported', 'confirmed', 'rejected')),
  amount_cents int check (amount_cents >= 0),
  platform_fee_cents int not null default 0 check (platform_fee_cents >= 0),
  currency text not null default 'usd',
  description text check (char_length(description) <= 300),
  stripe_account_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  receipt_emailed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_application_idx on public.payments (application_id);
create index payments_market_idx on public.payments (market_id);

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy "vendor, organizer and admin read payments" on public.payments
  for select to authenticated
  using (public.owns_vendor(vendor_id) or public.organizes_market(market_id) or public.is_admin());

-- Vendor says "I've paid" on the market's own payment page.
create function public.vendor_report_external_payment(app uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  a public.applications;
  m public.markets;
  pay_id uuid;
begin
  select * into a from public.applications where id = app;
  if a.id is null or not public.owns_vendor(a.vendor_id) then
    raise exception 'Application not found.' using errcode = 'P0001';
  end if;
  if a.status <> 'accepted' then
    raise exception 'You can pay once you''ve been accepted.' using errcode = 'P0001';
  end if;
  select * into m from public.markets where id = a.market_id;
  if m.payment_method <> 'external_link' then
    raise exception 'This market doesn''t use an outside payment link.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where application_id = app and status in ('reported', 'confirmed', 'paid')) then
    raise exception 'You already told us you paid.' using errcode = 'P0001';
  end if;

  insert into public.payments (application_id, market_id, vendor_id, method, status, description)
  values (app, a.market_id, a.vendor_id, 'external_link',
          case when m.organizer_id is null then 'confirmed' else 'reported' end,
          'Paid on the market''s own payment page')
  returning id into pay_id;

  -- Markets not on Stallpass have no one to confirm, so it counts as paid
  -- (reported by the vendor).
  if m.organizer_id is null then
    update public.applications set status = 'paid' where id = app;
  end if;
  return pay_id;
end $$;

-- Organizer confirms (or rejects) a vendor's "I've paid".
create function public.organizer_confirm_payment(payment uuid, confirmed boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.payments;
begin
  select * into p from public.payments where id = payment;
  if p.id is null or not public.organizes_market(p.market_id) then
    raise exception 'Payment not found.' using errcode = 'P0001';
  end if;
  if p.status <> 'reported' then
    raise exception 'This payment was already handled.' using errcode = 'P0001';
  end if;
  update public.payments
    set status = case when confirmed then 'confirmed' else 'rejected' end,
        paid_at = case when confirmed then now() end
    where id = payment;
  if confirmed then
    update public.applications set status = 'paid' where id = p.application_id and status = 'accepted';
  end if;
end $$;

-- Vendors of markets NOT on Stallpass can also mark "paid" in their tracker.
create or replace function public.vendor_set_application_status(app uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.applications;
  claimed boolean;
begin
  select * into a from public.applications where id = app;
  if a.id is null or not public.owns_vendor(a.vendor_id) then
    raise exception 'Application not found.' using errcode = 'P0001';
  end if;
  if a.status = 'draft' then
    raise exception 'Send the application first.' using errcode = 'P0001';
  end if;
  select m.is_claimed into claimed from public.markets m where m.id = a.market_id;
  if a.status = 'paid' and (claimed or new_status <> 'accepted') then
    raise exception 'Paid applications can''t be changed here. Contact the market.' using errcode = 'P0001';
  end if;
  if new_status = 'cancelled' then
    null;
  elsif claimed then
    raise exception 'This market manages applications on Stallpass, so only the organizer can change the status.' using errcode = 'P0001';
  elsif new_status not in ('submitted', 'accepted', 'waitlisted', 'declined', 'paid') then
    raise exception 'That status isn''t allowed.' using errcode = 'P0001';
  elsif new_status = 'paid' and a.status <> 'accepted' then
    raise exception 'Mark it accepted first.' using errcode = 'P0001';
  end if;

  if new_status is distinct from a.status then
    update public.applications
      set status = new_status,
          status_source = case when new_status = 'paid' or (a.status = 'paid' and new_status = 'accepted') then status_source else 'vendor' end,
          verified_at = case when new_status in ('paid', 'accepted') and a.status in ('accepted', 'paid') then verified_at end,
          verified_by = case when new_status in ('paid', 'accepted') and a.status in ('accepted', 'paid') then verified_by end
      where id = app;
  end if;
end $$;

revoke execute on function public.vendor_report_external_payment(uuid) from public, anon;
revoke execute on function public.organizer_confirm_payment(uuid, boolean) from public, anon;
grant execute on function public.vendor_report_external_payment(uuid) to authenticated;
grant execute on function public.organizer_confirm_payment(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- "Start" hub: resources for new vendors (admin-managed, public to read)
-- ---------------------------------------------------------------------------

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'business_license', 'sellers_permit', 'food_handler', 'kitchen', 'health_permit',
    'insurance', 'cottage_food', 'other')),
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  url text check (url ~* '^https?://' and char_length(url) <= 500),
  area text check (char_length(area) <= 80),
  price_note text check (char_length(price_note) <= 120),
  is_official boolean not null default false,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  is_sample boolean not null default false,
  position int not null default 0,
  last_checked date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger resources_updated_at before update on public.resources
  for each row execute function public.set_updated_at();

alter table public.resources enable row level security;
revoke all on public.resources from anon, authenticated;
grant select on public.resources to anon, authenticated;
grant insert, update, delete on public.resources to authenticated;
create policy "anyone reads published resources" on public.resources
  for select using (is_published or public.is_admin());
create policy "admin manages resources" on public.resources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Starter resources: official agencies (checked 2026-09-25; rules and links
-- change, so the admin should re-check them from time to time).
insert into public.resources (category, name, description, url, area, price_note, is_official, position, last_checked) values
  ('health_permit', 'LA County Environmental Health',
   'Health permits for most of LA County: temporary food facility (TFF) permits for events, mobile food facility (truck/cart) permits, and cottage food registration.',
   'http://publichealth.lacounty.gov/eh/', 'LA County (most cities)', null, true, 1, '2026-09-25'),
  ('health_permit', 'City of Pasadena Public Health',
   'Pasadena runs its own health department. Use this instead of LA County for events inside Pasadena.',
   'https://www.cityofpasadena.net/public-health/', 'Pasadena', null, true, 2, '2026-09-25'),
  ('health_permit', 'City of Long Beach Health',
   'Long Beach runs its own health department. Use this instead of LA County for events inside Long Beach.',
   'https://www.longbeach.gov/health/', 'Long Beach', null, true, 3, '2026-09-25'),
  ('cottage_food', 'LA County Cottage Food Operations',
   'Selling low-risk foods made in your home kitchen (breads, cookies, jams, dried goods)? Register as a Cottage Food Operation instead of renting a commercial kitchen.',
   'http://publichealth.lacounty.gov/eh/', 'LA County', null, true, 1, '2026-09-25'),
  ('sellers_permit', 'CDTFA Seller''s Permit',
   'California seller''s permit so you can collect and pay sales tax. Apply online.',
   'https://www.cdtfa.ca.gov/', 'California', 'Free', true, 1, '2026-09-25'),
  ('business_license', 'City of Los Angeles: Business Tax Registration',
   'Needed if you do business inside the City of LA. Other cities have their own business license. Check the city where you''re based.',
   'https://finance.lacity.gov/', 'City of Los Angeles', null, true, 1, '2026-09-25'),
  ('business_license', 'CalGold permit finder',
   'Official California tool that lists the permits your business needs, by city and business type.',
   'https://www.calgold.ca.gov/', 'California', 'Free', true, 2, '2026-09-25'),
  ('food_handler', 'ServSafe (food handler & manager courses)',
   'Accredited online courses for the California Food Handler Card and the Food Protection Manager certification.',
   'https://www.servsafe.com/', 'Online', null, false, 1, '2026-09-25'),
  ('insurance', 'FLIP: Food Liability Insurance Program',
   'General liability insurance made for food vendors. Buy per event or yearly and get the certificate (COI) markets ask for.',
   'https://www.fliprogram.com/', 'Online', null, false, 1, '2026-09-25'),
  ('insurance', 'Thimble',
   'Short-term or monthly liability insurance for small businesses and event vendors, bought online.',
   'https://www.thimble.com/', 'Online', null, false, 2, '2026-09-25');
