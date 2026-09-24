-- Sign up with email + password, verify the email later.
-- People get in straight away, but must confirm their email (a 6-digit code)
-- before anything that reaches other people: sending applications, reviewing
-- a market, claiming a market. Only the server can set these columns.

alter table public.profiles
  add column email_verified_at timestamptz,
  add column has_password boolean not null default false;

-- Everyone so far signed in with a code from their inbox, so their email is proven.
update public.profiles set email_verified_at = coalesce(email_verified_at, now());

create function public.email_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.email_verified_at is not null)
$$;
grant execute on function public.email_verified() to authenticated;

drop policy "claim an unclaimed market" on public.market_claims;
create policy "claim an unclaimed market" on public.market_claims
  for insert to authenticated
  with check (
    public.is_active_user()
    and public.email_verified()
    and user_id = auth.uid()
    and exists (select 1 from public.markets m
                where m.id = market_id and m.organizer_id is null and m.approval_status = 'approved' and not m.is_sample)
  );

drop policy "signed-in people review visible markets" on public.shopper_reviews;
create policy "signed-in people review visible markets" on public.shopper_reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.email_verified()
    and exists (select 1 from public.markets m
                where m.id = market_id and m.is_published and m.approval_status = 'approved' and not m.is_sample)
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended_at is null)
  );
