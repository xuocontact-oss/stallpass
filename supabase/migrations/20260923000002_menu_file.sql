-- Menu upload: vendors can attach their menu as a photo or PDF (optional).
-- The typed menu text stays in vendors.menu.

alter table public.vendors
  add column menu_file_path text check (split_part(menu_file_path, '/', 1) = id::text),
  add column menu_file_name text check (char_length(menu_file_name) <= 200);

grant update (menu_file_path, menu_file_name) on public.vendors to authenticated;

-- Menus are shown to markets, so like business photos they're public to view,
-- but only the vendor can add or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vendor-menus', 'vendor-menus', true, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "vendor reads own menus" on storage.objects
  for select to authenticated
  using (bucket_id = 'vendor-menus' and public.owns_vendor_folder(name));
create policy "vendor uploads own menus" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendor-menus' and public.owns_vendor_folder(name));
create policy "vendor deletes own menus" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendor-menus' and public.owns_vendor_folder(name));
