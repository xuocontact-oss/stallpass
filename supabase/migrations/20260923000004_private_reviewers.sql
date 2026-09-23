-- Reviews: only the super admin knows who wrote a review. Organizers and the
-- public see ratings and text, never the vendor. (Reviews are still tied to
-- a verified vendor account behind the scenes, so they can't be spammed.)

drop policy "reviewer, organizer and admin read" on public.reviews;
create policy "reviewer and admin read" on public.reviews
  for select to authenticated using (public.owns_vendor(vendor_id) or public.is_admin());

-- The "show my business name" option is retired: names are never published.
create or replace function public.reviews_before_save() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v public.vendors;
begin
  select * into v from public.vendors where id = new.vendor_id;
  new.show_business_name = false;
  new.reviewer_name = null;
  new.reviewer_category = v.category;
  new.updated_at = now();
  return new;
end $$;

update public.reviews set show_business_name = false where show_business_name or reviewer_name is not null;
