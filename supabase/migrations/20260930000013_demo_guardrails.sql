-- Example ("demo") content on the live site, kept apart from real people:
-- real vendors can't apply to, claim, review or list example markets.
-- (Example content is marked is_sample and can be removed in one go.)

create function public.is_sample_vendor(vendor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select v.is_sample from public.vendors v where v.id = vendor), false)
$$;

drop policy "vendor creates own application" on public.applications;
create policy "vendor creates own application" on public.applications
  for insert to authenticated
  with check (
    public.is_active_user()
    and public.owns_vendor(vendor_id)
    and status in ('draft', 'submitted')
    and exists (select 1 from public.markets m
                where m.id = market_id and m.is_published and m.approval_status = 'approved'
                  and (not m.is_sample or public.is_sample_vendor(vendor_id)))
  );

drop policy "vendor adds own" on public.vendor_markets;
create policy "vendor adds own" on public.vendor_markets
  for insert to authenticated
  with check (
    public.owns_vendor(vendor_id)
    and exists (select 1 from public.markets m
                where m.id = market_id and m.is_published and m.approval_status = 'approved'
                  and (not m.is_sample or public.is_sample_vendor(vendor_id)))
  );

drop policy "claim an unclaimed market" on public.market_claims;
create policy "claim an unclaimed market" on public.market_claims
  for insert to authenticated
  with check (
    public.is_active_user()
    and user_id = auth.uid()
    and exists (select 1 from public.markets m
                where m.id = market_id and m.organizer_id is null and m.approval_status = 'approved' and not m.is_sample)
  );

drop policy "signed-in people review visible markets" on public.shopper_reviews;
create policy "signed-in people review visible markets" on public.shopper_reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.markets m
                where m.id = market_id and m.is_published and m.approval_status = 'approved' and not m.is_sample)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended_at is null)
  );
