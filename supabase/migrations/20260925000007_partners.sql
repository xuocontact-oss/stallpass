-- Partner (affiliate) resources: kitchens, insurers etc. that pay Stallpass per
-- referral. Public: the offer and promo code. Admin only: the tracking link,
-- commission terms and contacts. Clicks / code copies / "I signed up" are
-- counted so the admin can check what partners owe.

alter table public.resources
  add column is_partner boolean not null default false,
  add column promo_code text check (char_length(promo_code) <= 40),
  add column promo_text text check (char_length(promo_text) <= 200);

create table public.resource_partner_details (
  resource_id uuid primary key references public.resources(id) on delete cascade,
  referral_url text check (referral_url ~* '^https?://' and char_length(referral_url) <= 1000),
  commission_terms text check (char_length(commission_terms) <= 500),
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (char_length(contact_email) <= 200),
  notes text check (char_length(notes) <= 1000),
  updated_at timestamptz not null default now()
);

alter table public.resource_partner_details enable row level security;
revoke all on public.resource_partner_details from anon, authenticated;
grant select, insert, update, delete on public.resource_partner_details to authenticated;
create policy "admin only" on public.resource_partner_details
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.resource_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  event text not null check (event in ('click', 'code_copy', 'signup_reported')),
  user_id uuid references public.profiles(id) on delete set null,
  page text check (char_length(page) <= 40),
  created_at timestamptz not null default now()
);

create index resource_events_resource_idx on public.resource_events (resource_id, created_at);
-- Each person can say "I signed up" once per partner.
create unique index resource_events_one_signup on public.resource_events (resource_id, user_id)
  where event = 'signup_reported' and user_id is not null;

-- Events are written by trusted server code only; only the admin reads them.
alter table public.resource_events enable row level security;
revoke all on public.resource_events from anon, authenticated;
grant select on public.resource_events to authenticated;
create policy "admin reads events" on public.resource_events
  for select to authenticated using (public.is_admin());
