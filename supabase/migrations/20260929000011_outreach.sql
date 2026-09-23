-- Walking markets to sign up vendors:
-- - which market / person a sign-up came from (for the admin's outreach stats)
-- - "markets I sell at" on vendor profiles, with public COUNTS per market
--   (never names), to show organizers how many of their vendors use Stallpass
-- - one "finish your setup" reminder

alter table public.profiles
  add column signup_market_id uuid references public.markets(id) on delete set null,
  add column signup_ref text check (signup_ref ~ '^[a-z0-9-]{1,40}$'),
  add column setup_nudged_at timestamptz;

-- The sign-up source is written once, by the server, on first sign-in.
-- (Not user-editable: no update grant on these columns.)

create table public.vendor_markets (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vendor_id, market_id)
);

create index vendor_markets_market_idx on public.vendor_markets (market_id);

alter table public.vendor_markets enable row level security;
revoke all on public.vendor_markets from anon, authenticated;
grant select, insert (vendor_id, market_id), delete on public.vendor_markets to authenticated;
create policy "vendor and admin read" on public.vendor_markets
  for select to authenticated using (public.owns_vendor(vendor_id) or public.is_admin());
create policy "vendor adds own" on public.vendor_markets
  for insert to authenticated
  with check (
    public.owns_vendor(vendor_id)
    and exists (select 1 from public.markets m where m.id = market_id and m.is_published and m.approval_status = 'approved')
  );
create policy "vendor removes own" on public.vendor_markets
  for delete to authenticated using (public.owns_vendor(vendor_id));

-- Public: how many Stallpass vendors sell at each market (counts only).
create view public.market_vendor_counts as
  select vm.market_id, count(*)::int as vendor_count
  from public.vendor_markets vm
  join public.markets m on m.id = vm.market_id
  where m.is_published and m.approval_status = 'approved'
  group by vm.market_id;

grant select on public.market_vendor_counts to anon, authenticated;
