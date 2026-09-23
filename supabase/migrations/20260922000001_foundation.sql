-- Stallpass Phase 1: accounts, vendor profiles, document vault, market directory.
-- Security: Row Level Security is ON for every table. Vendors only ever see
-- their own business and documents. Markets are public to read; only the
-- super admin can change them (organizers get access in Phase 3).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles: one per login. Created automatically when someone signs up.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 100),
  is_super_admin boolean not null default false,
  suspended_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the signed-in person is the (active) super admin.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.is_super_admin and p.suspended_at is null
       from public.profiles p where p.id = auth.uid()),
    false)
$$;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
-- People can read their own profile and change only their name.
grant select, update (full_name) on public.profiles to authenticated;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Fixed lists: food categories and document types (readable by everyone)
-- ---------------------------------------------------------------------------

create table public.food_categories (
  key text primary key,
  label text not null,
  position int not null default 0
);

insert into public.food_categories (key, label, position) values
  ('tacos_mexican', 'Tacos & Mexican', 1),
  ('bbq_grill', 'BBQ & grill', 2),
  ('asian', 'Asian', 3),
  ('burgers_sandwiches', 'Burgers & sandwiches', 4),
  ('pizza_italian', 'Pizza & Italian', 5),
  ('mediterranean', 'Mediterranean & Middle Eastern', 6),
  ('seafood', 'Seafood', 7),
  ('vegan', 'Vegan & plant-based', 8),
  ('baked_goods', 'Baked goods & desserts', 9),
  ('frozen_treats', 'Ice cream & frozen treats', 10),
  ('coffee_drinks', 'Coffee & drinks', 11),
  ('produce', 'Produce & farm goods', 12),
  ('packaged', 'Packaged foods (jams, sauces, snacks)', 13),
  ('other', 'Other', 99);

create table public.document_types (
  key text primary key,
  label text not null,
  position int not null default 0
);

insert into public.document_types (key, label, position) values
  ('health_permit', 'Health permit', 1),
  ('liability_insurance', 'Liability insurance (COI)', 2),
  ('business_license', 'Business license', 3),
  ('sellers_permit', 'Seller''s permit', 4),
  ('food_handler_card', 'Food handler card', 5),
  ('other', 'Other', 99);

alter table public.food_categories enable row level security;
alter table public.document_types enable row level security;
revoke all on public.food_categories, public.document_types from anon, authenticated;
grant select on public.food_categories, public.document_types to anon, authenticated;
create policy "anyone can read" on public.food_categories for select using (true);
create policy "anyone can read" on public.document_types for select using (true);

-- ---------------------------------------------------------------------------
-- Vendors: one business per login (for now)
-- ---------------------------------------------------------------------------

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 100),
  category text not null references public.food_categories(key),
  description text check (char_length(description) <= 2000),
  menu text check (char_length(menu) <= 4000),
  setup_type text not null default 'tent' check (setup_type in ('tent', 'truck', 'trailer', 'cart')),
  needs_power boolean not null default false,
  needs_water boolean not null default false,
  setup_notes text check (char_length(setup_notes) <= 500),
  phone text check (char_length(phone) <= 30),
  instagram text check (char_length(instagram) <= 200),
  facebook text check (char_length(facebook) <= 200),
  tiktok text check (char_length(tiktok) <= 200),
  website text check (char_length(website) <= 200),
  service_area text check (char_length(service_area) <= 200),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger vendors_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();

-- True when the signed-in person owns this vendor business.
create function public.owns_vendor(vendor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.vendors v where v.id = vendor and v.owner_id = auth.uid()
  )
$$;

-- Same, for a storage path like "<vendor id>/file.pdf". Compares text so a
-- junk path is simply "not yours" instead of an error.
create function public.owns_vendor_folder(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.vendors v
    where v.id::text = split_part(path, '/', 1) and v.owner_id = auth.uid()
  )
$$;

alter table public.vendors enable row level security;
revoke all on public.vendors from anon, authenticated;
grant select, delete on public.vendors to authenticated;
-- Everything except id, owner, sample flag and timestamps is editable.
grant insert (owner_id, business_name, category, description, menu, setup_type, needs_power,
  needs_water, setup_notes, phone, instagram, facebook, tiktok, website, service_area)
  on public.vendors to authenticated;
grant update (business_name, category, description, menu, setup_type, needs_power,
  needs_water, setup_notes, phone, instagram, facebook, tiktok, website, service_area)
  on public.vendors to authenticated;

create policy "owner reads vendor" on public.vendors
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "create own vendor" on public.vendors
  for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates vendor" on public.vendors
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "admin deletes vendor" on public.vendors
  for delete to authenticated using (public.is_admin());

create table public.vendor_photos (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  path text not null unique check (split_part(path, '/', 1) = vendor_id::text),
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.vendor_photos enable row level security;
revoke all on public.vendor_photos from anon, authenticated;
grant select, insert (vendor_id, path, position), delete on public.vendor_photos to authenticated;
create policy "owner reads photos" on public.vendor_photos
  for select to authenticated using (public.owns_vendor(vendor_id) or public.is_admin());
create policy "owner adds photos" on public.vendor_photos
  for insert to authenticated with check (public.owns_vendor(vendor_id));
create policy "owner removes photos" on public.vendor_photos
  for delete to authenticated using (public.owns_vendor(vendor_id));

-- ---------------------------------------------------------------------------
-- Document vault
-- ---------------------------------------------------------------------------

create table public.vendor_documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  doc_type text not null references public.document_types(key),
  title text check (char_length(title) <= 100),
  file_path text not null check (split_part(file_path, '/', 1) = vendor_id::text),
  file_name text not null check (char_length(file_name) <= 200),
  issue_date date,
  expiration_date date,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiration_date is null or issue_date is null or expiration_date >= issue_date)
);

create index vendor_documents_vendor_idx on public.vendor_documents (vendor_id);
create index vendor_documents_expiry_idx on public.vendor_documents (expiration_date);

create trigger vendor_documents_updated_at before update on public.vendor_documents
  for each row execute function public.set_updated_at();

alter table public.vendor_documents enable row level security;
revoke all on public.vendor_documents from anon, authenticated;
grant select, delete on public.vendor_documents to authenticated;
grant insert (vendor_id, doc_type, title, file_path, file_name, issue_date, expiration_date, notes)
  on public.vendor_documents to authenticated;
grant update (doc_type, title, file_path, file_name, issue_date, expiration_date, notes)
  on public.vendor_documents to authenticated;

create policy "owner reads documents" on public.vendor_documents
  for select to authenticated using (public.owns_vendor(vendor_id) or public.is_admin());
create policy "owner adds documents" on public.vendor_documents
  for insert to authenticated with check (public.owns_vendor(vendor_id));
create policy "owner updates documents" on public.vendor_documents
  for update to authenticated using (public.owns_vendor(vendor_id))
  with check (public.owns_vendor(vendor_id));
create policy "owner deletes documents" on public.vendor_documents
  for delete to authenticated using (public.owns_vendor(vendor_id));

-- Which expiry reminder emails were already sent. A renewed document (new
-- expiration date) gets fresh reminders. Only the server's reminder job uses it.
create table public.document_reminders (
  document_id uuid not null references public.vendor_documents(id) on delete cascade,
  kind text not null check (kind in ('30_day', '7_day')),
  expiration_date date not null,
  sent_at timestamptz not null default now(),
  primary key (document_id, kind, expiration_date)
);

alter table public.document_reminders enable row level security;
revoke all on public.document_reminders from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Markets (public directory)
-- ---------------------------------------------------------------------------

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 1 and 120),
  market_type text not null default 'farmers'
    check (market_type in ('farmers', 'night', 'food_truck', 'popup', 'festival', 'other')),
  organizer_name text check (char_length(organizer_name) <= 120),
  -- Set when an organizer's claim is approved (Phase 3).
  organizer_id uuid references public.profiles(id) on delete set null,
  is_claimed boolean generated always as (organizer_id is not null) stored,
  website text check (char_length(website) <= 200),
  instagram text check (char_length(instagram) <= 200),
  address text not null check (char_length(address) <= 200),
  city text not null check (char_length(city) <= 80),
  state text not null default 'CA' check (char_length(state) <= 40),
  zip text check (char_length(zip) <= 12),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  description text check (char_length(description) <= 4000),
  schedule_summary text check (char_length(schedule_summary) <= 200),
  -- [{"label": "10x10 tent", "amount_cents": 7500}, ...]
  booth_fees jsonb not null default '[]'::jsonb check (jsonb_typeof(booth_fees) = 'array'),
  min_booth_fee_cents int,
  categories_wanted text[] not null default '{}',
  required_doc_types text[] not null default '{}',
  application_deadline date,
  application_notes text check (char_length(application_notes) <= 1000),
  is_published boolean not null default true,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.markets_before_save() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.min_booth_fee_cents = (
    select min((f->>'amount_cents')::int)
    from jsonb_array_elements(new.booth_fees) f
    where f ? 'amount_cents'
  );
  return new;
end $$;

create trigger markets_before_save before insert or update on public.markets
  for each row execute function public.markets_before_save();

-- Contact details are kept apart so they are never shown publicly.
create table public.market_contacts (
  market_id uuid primary key references public.markets(id) on delete cascade,
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (char_length(contact_email) <= 200),
  phone text check (char_length(phone) <= 30),
  notes text check (char_length(notes) <= 1000)
);

create table public.market_dates (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  event_date date not null,
  starts_at time,
  ends_at time,
  note text check (char_length(note) <= 200),
  unique (market_id, event_date)
);

create index market_dates_date_idx on public.market_dates (event_date);

create table public.market_photos (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  path text not null unique,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.markets enable row level security;
alter table public.market_contacts enable row level security;
alter table public.market_dates enable row level security;
alter table public.market_photos enable row level security;

revoke all on public.markets, public.market_contacts, public.market_dates, public.market_photos
  from anon, authenticated;
grant select on public.markets, public.market_dates, public.market_photos to anon, authenticated;
grant insert, update, delete on public.markets, public.market_dates, public.market_photos
  to authenticated;
grant select, insert, update, delete on public.market_contacts to authenticated;

-- Everyone (even signed out) can browse published markets.
create policy "read published markets" on public.markets
  for select using (is_published or public.is_admin());
create policy "read dates of published markets" on public.market_dates
  for select using (exists (
    select 1 from public.markets m
    where m.id = market_id and (m.is_published or public.is_admin())));
create policy "read photos of published markets" on public.market_photos
  for select using (exists (
    select 1 from public.markets m
    where m.id = market_id and (m.is_published or public.is_admin())));

-- Only the super admin changes markets for now.
create policy "admin writes markets" on public.markets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin writes dates" on public.market_dates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin writes photos" on public.market_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages contacts" on public.market_contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- File storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vendor-documents', 'vendor-documents', false, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('vendor-photos', 'vendor-photos', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('market-photos', 'market-photos', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Documents are PRIVATE: only the vendor (and the admin) can read them, and
-- only through short-lived signed links made by the server.
create policy "vendor reads own documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'vendor-documents' and (public.owns_vendor_folder(name) or public.is_admin()));
create policy "vendor uploads own documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendor-documents' and public.owns_vendor_folder(name));
create policy "vendor deletes own documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendor-documents' and public.owns_vendor_folder(name));

-- Business photos are public to view (they're marketing), but only the
-- vendor can add or remove them.
create policy "vendor reads own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'vendor-photos' and public.owns_vendor_folder(name));
create policy "vendor uploads own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendor-photos' and public.owns_vendor_folder(name));
create policy "vendor deletes own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendor-photos' and public.owns_vendor_folder(name));

create policy "admin manages market photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'market-photos' and public.is_admin())
  with check (bucket_id = 'market-photos' and public.is_admin());
