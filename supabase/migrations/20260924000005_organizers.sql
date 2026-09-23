-- Stallpass Phase 3: market organizers.
-- - Organizers claim existing markets (admin approves every claim) or create
--   new ones (need admin approval unless the organizer is trusted or has a
--   good track record, see platform_settings).
-- - Organizers manage their markets, decide on applications, assign booths,
--   message accepted vendors and reply to reviews.
-- - Organizers see the profile + attached documents of vendors who applied to
--   their markets, never a vendor's private document vault.

-- ---------------------------------------------------------------------------
-- Profiles: organizer flags
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column is_organizer boolean not null default false,
  add column is_trusted_organizer boolean not null default false;

-- People can say they're an organizer themselves; only the admin can trust them.
grant update (is_organizer) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Platform settings (one row, admin only)
-- ---------------------------------------------------------------------------

create table public.platform_settings (
  id int primary key default 1 check (id = 1),
  auto_approve_min_rating numeric(2, 1) not null default 4.0 check (auto_approve_min_rating between 1 and 5),
  auto_approve_min_reviews int not null default 5 check (auto_approve_min_reviews between 1 and 1000),
  -- Placeholder for a future AI checker of new market listings. Off for now.
  ai_market_review_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.platform_settings (id) values (1);

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select, update (auto_approve_min_rating, auto_approve_min_reviews, ai_market_review_enabled, updated_at, updated_by)
  on public.platform_settings to authenticated;
create policy "admin reads settings" on public.platform_settings
  for select to authenticated using (public.is_admin());
create policy "admin updates settings" on public.platform_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Markets: approval
-- ---------------------------------------------------------------------------

alter table public.markets
  add column approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column rejection_reason text check (char_length(rejection_reason) <= 500),
  add column created_by uuid references public.profiles(id) on delete set null,
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete set null;

-- Existing markets are approved; anything new starts pending unless decided below.
alter table public.markets alter column approval_status set default 'pending';

-- Does this organizer skip manual approval for new markets?
create function public.organizer_auto_approved(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_trusted_organizer and p.suspended_at is null
                   from public.profiles p where p.id = uid), false)
    or exists (
      select 1
      from public.markets m
      cross join public.platform_settings s
      where m.organizer_id = uid
        and m.approval_status = 'approved'
        and (select count(*) from public.reviews r where r.market_id = m.id and not r.is_hidden)
              >= s.auto_approve_min_reviews
        and (select avg(r.rating_overall) from public.reviews r where r.market_id = m.id and not r.is_hidden)
              >= s.auto_approve_min_rating
    )
$$;

create or replace function public.markets_before_save() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.min_booth_fee_cents = (
    select min((f->>'amount_cents')::int)
    from jsonb_array_elements(new.booth_fees) f
    where f ? 'amount_cents'
  );

  -- Signed-in users (not the server's full-access key used by scripts).
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.created_by = auth.uid();
      if public.is_admin() then
        new.approval_status = 'approved';
      elsif public.organizer_auto_approved(auth.uid()) then
        new.approval_status = 'approved';
        new.approved_at = now();
      else
        new.approval_status = 'pending';
      end if;
    elsif not public.is_admin() and old.approval_status = 'rejected' then
      -- An organizer fixing a rejected listing sends it back for review.
      new.approval_status = 'pending';
      new.rejection_reason = null;
    end if;
  end if;
  return new;
end $$;

-- Can the signed-in person see this market (and its dates/photos)?
create function public.market_visible(market uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.markets m
    where m.id = market
      and ((m.is_published and m.approval_status = 'approved')
        or public.is_admin()
        or m.organizer_id = auth.uid())
  )
$$;

-- For storage paths like "<market id>/photo.jpg".
create function public.organizes_market_folder(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.markets m
    where m.id::text = split_part(path, '/', 1) and m.organizer_id = auth.uid()
  )
$$;

drop policy "read published markets" on public.markets;
create policy "read visible markets" on public.markets
  for select using ((is_published and approval_status = 'approved') or public.is_admin() or organizer_id = auth.uid());

drop policy "read dates of published markets" on public.market_dates;
create policy "read dates of visible markets" on public.market_dates
  for select using (public.market_visible(market_id));
drop policy "read photos of published markets" on public.market_photos;
create policy "read photos of visible markets" on public.market_photos
  for select using (public.market_visible(market_id));

-- Organizer accounts: only people who said they run a market can create one.
create function public.is_organizer_account() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_organizer and p.suspended_at is null from public.profiles p where p.id = auth.uid()), false)
$$;

-- Organizers create and edit their own markets. Only these columns: approval,
-- ownership (after creation), sample flag etc. are changed by the admin only.
revoke insert, update on public.markets from authenticated;
grant insert (name, slug, market_type, organizer_name, organizer_id, website, instagram, address, city, state,
  zip, lat, lng, description, schedule_summary, booth_fees, categories_wanted, required_doc_types,
  application_deadline, application_notes, is_published) on public.markets to authenticated;
grant update (name, slug, market_type, organizer_name, website, instagram, address, city, state,
  zip, lat, lng, description, schedule_summary, booth_fees, categories_wanted, required_doc_types,
  application_deadline, application_notes, is_published) on public.markets to authenticated;

create policy "organizer creates own market" on public.markets
  for insert to authenticated
  with check (organizer_id = auth.uid() and public.is_organizer_account());
create policy "organizer edits own market" on public.markets
  for update to authenticated using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy "organizer deletes own unapproved market" on public.markets
  for delete to authenticated using (organizer_id = auth.uid() and approval_status <> 'approved');

create policy "organizer manages dates" on public.market_dates
  for all to authenticated using (public.organizes_market(market_id)) with check (public.organizes_market(market_id));
create policy "organizer manages photos" on public.market_photos
  for all to authenticated
  using (public.organizes_market(market_id))
  with check (public.organizes_market(market_id) and split_part(path, '/', 1) = market_id::text);
create policy "organizer manages contact" on public.market_contacts
  for all to authenticated using (public.organizes_market(market_id)) with check (public.organizes_market(market_id));

create policy "organizer manages own market photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'market-photos' and public.organizes_market_folder(name))
  with check (bucket_id = 'market-photos' and public.organizes_market_folder(name));

-- Only approved, published markets take applications and show reviews.
drop policy "vendor creates own application" on public.applications;
create policy "vendor creates own application" on public.applications
  for insert to authenticated
  with check (
    public.owns_vendor(vendor_id)
    and status in ('draft', 'submitted')
    and exists (select 1 from public.markets m
                where m.id = market_id and m.is_published and m.approval_status = 'approved')
  );

create or replace view public.market_reviews as
  select r.id, r.market_id, r.event_date, r.rating_foot_traffic, r.rating_organization,
         r.rating_value, r.rating_overall, r.sales_range, r.body, r.reviewer_name,
         r.reviewer_category, r.organizer_reply, r.organizer_reply_at, r.is_sample, r.created_at
  from public.reviews r
  join public.markets m on m.id = r.market_id
  where not r.is_hidden and m.is_published and m.approval_status = 'approved';

create function public.admin_review_market(market uuid, approve boolean, reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do that.' using errcode = 'P0001';
  end if;
  update public.markets
    set approval_status = case when approve then 'approved' else 'rejected' end,
        rejection_reason = case when approve then null else left(nullif(trim(reason), ''), 500) end,
        approved_at = case when approve then now() end,
        approved_by = case when approve then auth.uid() end
    where id = market;
  if not found then
    raise exception 'Market not found.' using errcode = 'P0001';
  end if;
  perform public.log_admin_action(case when approve then 'approve_market' else 'reject_market' end,
    'market', market, jsonb_build_object('reason', reason));
end $$;

create function public.admin_set_trusted_organizer(uid uuid, trusted boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do that.' using errcode = 'P0001';
  end if;
  update public.profiles set is_trusted_organizer = trusted, is_organizer = is_organizer or trusted where id = uid;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0001';
  end if;
  perform public.log_admin_action(case when trusted then 'trust_organizer' else 'untrust_organizer' end,
    'profile', uid, '{}'::jsonb);
end $$;


-- ---------------------------------------------------------------------------
-- Claims
-- ---------------------------------------------------------------------------

create table public.market_claims (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (char_length(role) between 1 and 100),
  message text check (char_length(message) <= 1000),
  evidence_url text check (char_length(evidence_url) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text check (char_length(rejection_reason) <= 500),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index market_claims_one_pending on public.market_claims (market_id, user_id) where status = 'pending';

alter table public.market_claims enable row level security;
revoke all on public.market_claims from anon, authenticated;
grant select, insert (market_id, user_id, role, message, evidence_url) on public.market_claims to authenticated;
grant delete on public.market_claims to authenticated;

create policy "see own claims" on public.market_claims
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "claim an unclaimed market" on public.market_claims
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.markets m
                where m.id = market_id and m.organizer_id is null and m.approval_status = 'approved')
  );
create policy "withdraw own pending claim" on public.market_claims
  for delete to authenticated using (user_id = auth.uid() and status = 'pending');

create function public.admin_decide_claim(claim uuid, approve boolean, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.market_claims;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do that.' using errcode = 'P0001';
  end if;
  select * into c from public.market_claims where id = claim and status = 'pending';
  if c.id is null then
    raise exception 'That claim was already decided.' using errcode = 'P0001';
  end if;
  if approve then
    if exists (select 1 from public.markets where id = c.market_id and organizer_id is not null) then
      raise exception 'This market already has an organizer.' using errcode = 'P0001';
    end if;
    update public.markets set organizer_id = c.user_id where id = c.market_id;
    update public.profiles set is_organizer = true where id = c.user_id;
    -- Anyone else's pending claim on the same market is turned down.
    update public.market_claims
      set status = 'rejected', rejection_reason = 'Another organizer was confirmed for this market.',
          decided_at = now(), decided_by = auth.uid()
      where market_id = c.market_id and status = 'pending' and id <> claim;
  end if;
  update public.market_claims
    set status = case when approve then 'approved' else 'rejected' end,
        rejection_reason = case when approve then null else left(nullif(trim(reason), ''), 500) end,
        decided_at = now(), decided_by = auth.uid()
    where id = claim;
  perform public.log_admin_action(case when approve then 'approve_claim' else 'reject_claim' end,
    'market_claim', claim, jsonb_build_object('market_id', c.market_id, 'user_id', c.user_id, 'reason', reason));
end $$;

-- ---------------------------------------------------------------------------
-- Organizer tools on applications
-- ---------------------------------------------------------------------------

alter table public.applications
  add column booth_number text check (char_length(booth_number) <= 20),
  add column organizer_note text check (char_length(organizer_note) <= 1000);

create function public.organizer_set_application_status(app uuid, new_status text, message text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.applications;
begin
  select * into a from public.applications where id = app;
  if a.id is null or a.status = 'draft' or not public.organizes_market(a.market_id) then
    raise exception 'Application not found.' using errcode = 'P0001';
  end if;
  if new_status not in ('submitted', 'accepted', 'waitlisted', 'declined') then
    raise exception 'That status isn''t allowed.' using errcode = 'P0001';
  end if;
  if a.status in ('paid', 'cancelled') then
    raise exception 'This application is % and can''t be changed.', a.status using errcode = 'P0001';
  end if;
  update public.applications
    set status = new_status, status_source = 'organizer',
        organizer_note = coalesce(left(nullif(trim(message), ''), 1000), organizer_note)
    where id = app;
end $$;

create function public.organizer_set_booth(app uuid, booth text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.applications;
begin
  select * into a from public.applications where id = app;
  if a.id is null or a.status = 'draft' or not public.organizes_market(a.market_id) then
    raise exception 'Application not found.' using errcode = 'P0001';
  end if;
  if char_length(booth) > 20 then
    raise exception 'Keep booth numbers short (20 characters max).' using errcode = 'P0001';
  end if;
  update public.applications set booth_number = nullif(trim(booth), '') where id = app;
end $$;

-- Organizers can see the profile and photos of vendors who applied to them.
create function public.organizer_can_see_vendor(vendor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.vendor_id = vendor and a.status <> 'draft' and public.organizes_market(a.market_id)
  )
$$;

create policy "organizer reads applicant vendors" on public.vendors
  for select to authenticated using (public.organizer_can_see_vendor(id));
create policy "organizer reads applicant photos" on public.vendor_photos
  for select to authenticated using (public.organizer_can_see_vendor(vendor_id));

-- A record of messages organizers send to their vendors (and a spam brake).
create table public.organizer_messages (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  event_date date,
  sent_by uuid references public.profiles(id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 5000),
  recipient_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.organizer_messages enable row level security;
revoke all on public.organizer_messages from anon, authenticated;
grant select, insert (market_id, event_date, sent_by, subject, body, recipient_count) on public.organizer_messages to authenticated;
create policy "organizer and admin read messages" on public.organizer_messages
  for select to authenticated using (public.organizes_market(market_id) or public.is_admin());
create policy "organizer records own messages" on public.organizer_messages
  for insert to authenticated with check (public.organizes_market(market_id) and sent_by = auth.uid());

-- Function permissions: signed-in users only.
revoke execute on function public.admin_review_market(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_trusted_organizer(uuid, boolean) from public, anon;
revoke execute on function public.admin_decide_claim(uuid, boolean, text) from public, anon;
revoke execute on function public.organizer_set_application_status(uuid, text, text) from public, anon;
revoke execute on function public.organizer_set_booth(uuid, text) from public, anon;
grant execute on function public.admin_review_market(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_trusted_organizer(uuid, boolean) to authenticated;
grant execute on function public.admin_decide_claim(uuid, boolean, text) to authenticated;
grant execute on function public.organizer_set_application_status(uuid, text, text) to authenticated;
grant execute on function public.organizer_set_booth(uuid, text) to authenticated;
