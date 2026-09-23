-- Shoppers + nationwide discovery.
-- - Shoppers are regular accounts that can review MARKETS (not vendors).
--   Shopper reviews are separate from verified vendor reviews.
-- - Markets can be imported from the USDA farmers market directory.

-- ---------------------------------------------------------------------------
-- Shopper profile bits
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column is_shopper boolean not null default false,
  add column home_zip text check (home_zip ~ '^\d{5}$');

grant update (is_shopper, home_zip) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Imported markets
-- ---------------------------------------------------------------------------

alter table public.markets
  add column source text not null default 'stallpass' check (source in ('stallpass', 'usda')),
  add column source_id text,
  add column source_updated_at timestamptz;

create unique index markets_source_id_idx on public.markets (source, source_id) where source_id is not null;
create index markets_location_idx on public.markets (lat, lng);

-- ---------------------------------------------------------------------------
-- Shopper reviews (markets only)
-- ---------------------------------------------------------------------------

create table public.shopper_reviews (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  visited_on date not null,
  rating_overall smallint not null check (rating_overall between 1 and 5),
  rating_variety smallint check (rating_variety between 1 and 5),
  rating_atmosphere smallint check (rating_atmosphere between 1 and 5),
  rating_prices smallint check (rating_prices between 1 and 5),
  body text check (char_length(body) <= 2000),
  -- "Maria G." Filled in automatically from the account name.
  display_name text,
  is_sample boolean not null default false,
  is_hidden boolean not null default false,
  hidden_reason text check (char_length(hidden_reason) <= 300),
  organizer_reply text check (char_length(organizer_reply) <= 2000),
  organizer_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per shopper per market (they can edit it).
  unique (market_id, user_id)
);

create index shopper_reviews_market_idx on public.shopper_reviews (market_id);

create function public.shopper_reviews_before_save() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  full_name text;
  recent int;
begin
  select p.full_name into full_name from public.profiles p where p.id = new.user_id;
  -- First name + last initial, never the full name or email.
  new.display_name = coalesce(
    nullif(trim(split_part(coalesce(full_name, ''), ' ', 1) || ' ' ||
      coalesce(left(nullif(split_part(trim(full_name), ' ', 2), ''), 1) || '.', '')), ''),
    'Shopper');
  new.updated_at = now();

  if tg_op = 'INSERT' and auth.uid() is not null then
    if new.visited_on > current_date or new.visited_on < current_date - 365 then
      raise exception 'Pick the date you visited (within the last year).' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.markets m where m.id = new.market_id and m.organizer_id = auth.uid()) then
      raise exception 'You can''t review a market you run.' using errcode = 'P0001';
    end if;
    select count(*) into recent from public.shopper_reviews
      where user_id = new.user_id and created_at > now() - interval '1 day';
    if recent >= 5 then
      raise exception 'That''s a lot of reviews today. Please try again tomorrow.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger shopper_reviews_before_save before insert or update on public.shopper_reviews
  for each row execute function public.shopper_reviews_before_save();

alter table public.shopper_reviews enable row level security;
revoke all on public.shopper_reviews from anon, authenticated;
grant select, delete on public.shopper_reviews to authenticated;
grant insert (market_id, user_id, visited_on, rating_overall, rating_variety, rating_atmosphere, rating_prices, body)
  on public.shopper_reviews to authenticated;
grant update (visited_on, rating_overall, rating_variety, rating_atmosphere, rating_prices, body)
  on public.shopper_reviews to authenticated;

create policy "author and admin read" on public.shopper_reviews
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "signed-in people review visible markets" on public.shopper_reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.markets m
                where m.id = market_id and m.is_published and m.approval_status = 'approved')
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended_at is null)
  );
create policy "author edits own" on public.shopper_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "author deletes own" on public.shopper_reviews
  for delete to authenticated using (user_id = auth.uid());

-- What everyone sees: no user ids.
create view public.market_shopper_reviews as
  select r.id, r.market_id, r.visited_on, r.rating_overall, r.rating_variety, r.rating_atmosphere,
         r.rating_prices, r.body, r.display_name, r.organizer_reply, r.organizer_reply_at, r.is_sample, r.created_at
  from public.shopper_reviews r
  join public.markets m on m.id = r.market_id
  where not r.is_hidden and m.is_published and m.approval_status = 'approved';

grant select on public.market_shopper_reviews to anon, authenticated;

create function public.reply_to_shopper_review(review uuid, reply text) returns void
language plpgsql security definer set search_path = '' as $$
declare m uuid;
begin
  select market_id into m from public.shopper_reviews where id = review;
  if m is null or not public.organizes_market(m) then
    raise exception 'Only the market''s organizer can reply.' using errcode = 'P0001';
  end if;
  if char_length(reply) > 2000 then
    raise exception 'Keep replies under 2,000 characters.' using errcode = 'P0001';
  end if;
  update public.shopper_reviews
    set organizer_reply = nullif(trim(reply), ''),
        organizer_reply_at = case when nullif(trim(reply), '') is null then null else now() end
    where id = review;
end $$;

create function public.admin_set_shopper_review_hidden(review uuid, hidden boolean, reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can do that.' using errcode = 'P0001';
  end if;
  update public.shopper_reviews
    set is_hidden = hidden,
        hidden_reason = case when hidden then left(nullif(trim(reason), ''), 300) end
    where id = review;
  if not found then
    raise exception 'Review not found.' using errcode = 'P0001';
  end if;
  perform public.log_admin_action(
    case when hidden then 'hide_shopper_review' else 'restore_shopper_review' end,
    'shopper_review', review, jsonb_build_object('reason', reason));
end $$;

revoke execute on function public.reply_to_shopper_review(uuid, text) from public, anon;
revoke execute on function public.admin_set_shopper_review_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.reply_to_shopper_review(uuid, text) to authenticated;
grant execute on function public.admin_set_shopper_review_hidden(uuid, boolean, text) to authenticated;
