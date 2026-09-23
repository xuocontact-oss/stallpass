-- Stallpass Phase 2: applications, reviews, admin audit log.
-- Vendors see only their own applications. Organizers (Phase 3) see sent
-- applications to markets they run. Reviews are public through a view that
-- hides who wrote them (unless the vendor chooses to show their name).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when the signed-in person runs this market (a claimed listing).
create function public.organizes_market(market uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.markets m where m.id = market and m.organizer_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- Admin audit log: every admin action is recorded. Nobody can edit or delete it.
-- ---------------------------------------------------------------------------

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) <= 80),
  target_type text not null check (char_length(target_type) <= 40),
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select, insert (admin_id, action, target_type, target_id, details) on public.admin_audit_log to authenticated;
create policy "admin reads log" on public.admin_audit_log
  for select to authenticated using (public.is_admin());
create policy "admin writes own entries" on public.admin_audit_log
  for insert to authenticated with check (public.is_admin() and admin_id = auth.uid());

create function public.log_admin_action(action text, target_type text, target_id uuid, details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), action, target_type, target_id, coalesce(details, '{}'::jsonb))
$$;
revoke execute on function public.log_admin_action(text, text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'accepted', 'waitlisted', 'declined', 'paid', 'cancelled')),
  -- Who set the current status. Only 'organizer'/'admin' (or an admin
  -- verification) counts as proof the vendor was really accepted.
  status_source text not null default 'vendor' check (status_source in ('vendor', 'organizer', 'admin')),
  event_dates date[] not null check (cardinality(event_dates) between 1 and 12),
  booth_choice text check (char_length(booth_choice) <= 60),
  note text check (char_length(note) <= 1000),
  -- How it reached the market: in the organizer's dashboard, or by email.
  delivered_via text check (delivered_via in ('platform', 'email', 'not_sent')),
  emailed_at timestamptz,
  -- Secret link for markets not on Stallpass yet. Expires.
  share_token text unique,
  share_expires_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_vendor_idx on public.applications (vendor_id);
create index applications_market_idx on public.applications (market_id);

create function public.applications_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end $$;

create trigger applications_before_update before update on public.applications
  for each row execute function public.applications_before_update();

-- Can the signed-in person see this application?
create function public.can_see_application(app uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.id = app
      and (public.owns_vendor(a.vendor_id)
        or public.is_admin()
        or (a.status <> 'draft' and public.organizes_market(a.market_id)))
  )
$$;

alter table public.applications enable row level security;
revoke all on public.applications from anon, authenticated;
grant select, delete on public.applications to authenticated;
-- Vendors create applications with these fields only; delivery, verification
-- and status changes happen through the functions below or trusted server code.
grant insert (vendor_id, market_id, status, event_dates, booth_choice, note) on public.applications to authenticated;

create policy "see own or organized applications" on public.applications
  for select to authenticated
  using (public.owns_vendor(vendor_id) or public.is_admin()
    or (status <> 'draft' and public.organizes_market(market_id)));
create policy "vendor creates own application" on public.applications
  for insert to authenticated
  with check (
    public.owns_vendor(vendor_id)
    and status in ('draft', 'submitted')
    and exists (select 1 from public.markets m where m.id = market_id and m.is_published)
  );
create policy "vendor deletes own draft" on public.applications
  for delete to authenticated using (public.owns_vendor(vendor_id) and status = 'draft');

-- Vendors update the status of their own applications. For markets NOT on
-- Stallpass they report the outcome themselves (it then needs admin
-- verification before they can review). For markets on Stallpass only the
-- organizer decides; the vendor can only cancel.
create function public.vendor_set_application_status(app uuid, new_status text) returns void
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
  if a.status = 'paid' then
    raise exception 'Paid applications can''t be changed here. Contact the market.' using errcode = 'P0001';
  end if;
  select m.is_claimed into claimed from public.markets m where m.id = a.market_id;
  if new_status = 'cancelled' then
    null;
  elsif claimed then
    raise exception 'This market manages applications on Stallpass, so only the organizer can change the status.' using errcode = 'P0001';
  elsif new_status not in ('submitted', 'accepted', 'waitlisted', 'declined') then
    raise exception 'That status isn''t allowed.' using errcode = 'P0001';
  end if;

  if new_status is distinct from a.status then
    update public.applications
      set status = new_status, status_source = 'vendor', verified_at = null, verified_by = null
      where id = app;
  end if;
end $$;

-- Admin confirms (or un-confirms) that a vendor-reported acceptance is real.
create function public.admin_verify_application(app uuid, verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do that.' using errcode = 'P0001';
  end if;
  update public.applications
    set verified_at = case when verified then now() end,
        verified_by = case when verified then auth.uid() end
    where id = app and status in ('accepted', 'paid');
  if not found then
    raise exception 'Only accepted applications can be verified.' using errcode = 'P0001';
  end if;
  perform public.log_admin_action(
    case when verified then 'verify_application' else 'unverify_application' end,
    'application', app, '{}'::jsonb);
end $$;

-- Copies of the documents attached when the application was sent, so the
-- market sees exactly what was submitted even if the vendor edits later.
create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  source_document_id uuid references public.vendor_documents(id) on delete set null,
  doc_type text not null references public.document_types(key),
  title text,
  file_path text not null,
  file_name text not null,
  issue_date date,
  expiration_date date,
  created_at timestamptz not null default now()
);

create index application_documents_app_idx on public.application_documents (application_id);

alter table public.application_documents enable row level security;
revoke all on public.application_documents from anon, authenticated;
grant select on public.application_documents to authenticated;
create policy "see documents of visible applications" on public.application_documents
  for select to authenticated using (public.can_see_application(application_id));

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  event_date date not null,
  rating_foot_traffic smallint not null check (rating_foot_traffic between 1 and 5),
  rating_organization smallint not null check (rating_organization between 1 and 5),
  rating_value smallint not null check (rating_value between 1 and 5),
  rating_overall smallint not null check (rating_overall between 1 and 5),
  sales_range text check (sales_range in ('under_300', '300_700', '700_1500', '1500_plus')),
  body text check (char_length(body) <= 3000),
  show_business_name boolean not null default false,
  -- Filled in automatically from the vendor profile.
  reviewer_name text,
  reviewer_category text,
  is_sample boolean not null default false,
  is_hidden boolean not null default false,
  hidden_reason text check (char_length(hidden_reason) <= 300),
  hidden_at timestamptz,
  organizer_reply text check (char_length(organizer_reply) <= 2000),
  organizer_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, market_id, event_date)
);

create index reviews_market_idx on public.reviews (market_id);

create function public.reviews_before_save() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.vendors;
begin
  select * into v from public.vendors where id = new.vendor_id;
  new.reviewer_name = case when new.show_business_name then v.business_name end;
  new.reviewer_category = v.category;
  new.updated_at = now();
  return new;
end $$;

create trigger reviews_before_save before insert or update on public.reviews
  for each row execute function public.reviews_before_save();

-- A vendor may review a market date only if they were really accepted for it
-- (by the organizer, or verified by the admin) and the date has passed.
create function public.can_review(vendor uuid, market uuid, app uuid, day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.id = app
      and a.vendor_id = vendor
      and a.market_id = market
      and public.owns_vendor(vendor)
      and day = any (a.event_dates)
      and day <= current_date
      and a.status in ('accepted', 'paid')
      and (a.status_source in ('organizer', 'admin') or a.verified_at is not null)
  )
$$;

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select, delete on public.reviews to authenticated;
grant insert (vendor_id, market_id, application_id, event_date, rating_foot_traffic,
  rating_organization, rating_value, rating_overall, sales_range, body, show_business_name)
  on public.reviews to authenticated;
grant update (rating_foot_traffic, rating_organization, rating_value, rating_overall,
  sales_range, body, show_business_name) on public.reviews to authenticated;

create policy "reviewer, organizer and admin read" on public.reviews
  for select to authenticated
  using (public.owns_vendor(vendor_id) or public.is_admin() or public.organizes_market(market_id));
create policy "eligible vendor writes review" on public.reviews
  for insert to authenticated
  with check (public.can_review(vendor_id, market_id, application_id, event_date));
create policy "reviewer edits own review" on public.reviews
  for update to authenticated
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));
create policy "reviewer deletes own review" on public.reviews
  for delete to authenticated using (public.owns_vendor(vendor_id));

-- What the public sees: visible reviews of published markets, without the
-- vendor/application ids (so anonymous reviews stay anonymous).
create view public.market_reviews as
  select r.id, r.market_id, r.event_date, r.rating_foot_traffic, r.rating_organization,
         r.rating_value, r.rating_overall, r.sales_range, r.body, r.reviewer_name,
         r.reviewer_category, r.organizer_reply, r.organizer_reply_at, r.is_sample, r.created_at
  from public.reviews r
  join public.markets m on m.id = r.market_id
  where not r.is_hidden and m.is_published;

grant select on public.market_reviews to anon, authenticated;

create function public.reply_to_review(review uuid, reply text) returns void
language plpgsql security definer set search_path = '' as $$
declare m uuid;
begin
  select market_id into m from public.reviews where id = review;
  if m is null or not public.organizes_market(m) then
    raise exception 'Only the market''s organizer can reply.' using errcode = 'P0001';
  end if;
  if char_length(reply) > 2000 then
    raise exception 'Keep replies under 2,000 characters.' using errcode = 'P0001';
  end if;
  update public.reviews
    set organizer_reply = nullif(trim(reply), ''),
        organizer_reply_at = case when nullif(trim(reply), '') is null then null else now() end
    where id = review;
end $$;

create function public.admin_set_review_hidden(review uuid, hidden boolean, reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do that.' using errcode = 'P0001';
  end if;
  update public.reviews
    set is_hidden = hidden,
        hidden_reason = case when hidden then left(nullif(trim(reason), ''), 300) end,
        hidden_at = case when hidden then now() end
    where id = review;
  if not found then
    raise exception 'Review not found.' using errcode = 'P0001';
  end if;
  perform public.log_admin_action(
    case when hidden then 'hide_review' else 'restore_review' end,
    'review', review, jsonb_build_object('reason', reason));
end $$;

-- Functions are callable only by signed-in users (not by anonymous visitors).
revoke execute on function public.vendor_set_application_status(uuid, text) from public, anon;
revoke execute on function public.admin_verify_application(uuid, boolean) from public, anon;
revoke execute on function public.reply_to_review(uuid, text) from public, anon;
revoke execute on function public.admin_set_review_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.vendor_set_application_status(uuid, text) to authenticated;
grant execute on function public.admin_verify_application(uuid, boolean) to authenticated;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated;
