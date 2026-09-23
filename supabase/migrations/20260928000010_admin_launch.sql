-- Launch: suspensions enforced everywhere that matters, admin account tools.

-- True when the signed-in person exists and isn't suspended.
create function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended_at is null)
$$;

-- Add "and not suspended" to the actions that reach other people.
drop policy "vendor creates own application" on public.applications;
create policy "vendor creates own application" on public.applications
  for insert to authenticated
  with check (
    public.is_active_user()
    and public.owns_vendor(vendor_id)
    and status in ('draft', 'submitted')
    and exists (select 1 from public.markets m
                where m.id = market_id and m.is_published and m.approval_status = 'approved')
  );

drop policy "eligible vendor writes review" on public.reviews;
create policy "eligible vendor writes review" on public.reviews
  for insert to authenticated
  with check (public.is_active_user() and public.can_review(vendor_id, market_id, application_id, event_date));

drop policy "claim an unclaimed market" on public.market_claims;
create policy "claim an unclaimed market" on public.market_claims
  for insert to authenticated
  with check (
    public.is_active_user()
    and user_id = auth.uid()
    and exists (select 1 from public.markets m
                where m.id = market_id and m.organizer_id is null and m.approval_status = 'approved')
  );

drop policy "organizer records own messages" on public.organizer_messages;
create policy "organizer records own messages" on public.organizer_messages
  for insert to authenticated
  with check (public.is_active_user() and public.organizes_market(market_id) and sent_by = auth.uid());

drop policy "create own vendor" on public.vendors;
create policy "create own vendor" on public.vendors
  for insert to authenticated with check (public.is_active_user() and owner_id = auth.uid());

-- Suspended organizers can't run their markets, and their markets can't take
-- new applications (they stay visible, so vendors can still see the listing).
create or replace function public.organizes_market(market uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.markets m
    join public.profiles p on p.id = m.organizer_id
    where m.id = market and m.organizer_id = auth.uid() and p.suspended_at is null
  )
$$;

-- Admin: suspend / unsuspend an account (with a reason for the record).
alter table public.profiles add column suspension_reason text check (char_length(suspension_reason) <= 300);

create function public.admin_set_suspended(uid uuid, suspended boolean, reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do that.' using errcode = 'P0001';
  end if;
  if uid = auth.uid() then
    raise exception 'You can''t suspend yourself.' using errcode = 'P0001';
  end if;
  update public.profiles
    set suspended_at = case when suspended then now() end,
        suspension_reason = case when suspended then left(nullif(trim(reason), ''), 300) end
    where id = uid;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0001';
  end if;
  perform public.log_admin_action(case when suspended then 'suspend_user' else 'unsuspend_user' end,
    'profile', uid, jsonb_build_object('reason', reason));
end $$;

revoke execute on function public.admin_set_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;
