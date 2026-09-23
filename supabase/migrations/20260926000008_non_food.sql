-- Non-food vendors (clothing, crafts, art, vintage…) and more Start-hub sections.

insert into public.food_categories (key, label, position) values
  ('clothing', 'Clothing & accessories', 20),
  ('jewelry', 'Jewelry', 21),
  ('art', 'Art & prints', 22),
  ('crafts', 'Crafts & handmade goods', 23),
  ('vintage', 'Vintage & thrift', 24),
  ('beauty', 'Beauty, candles & body care', 25),
  ('plants', 'Plants & flowers', 26),
  ('home_goods', 'Home goods & decor', 27)
on conflict (key) do nothing;

alter table public.markets drop constraint markets_market_type_check;
alter table public.markets add constraint markets_market_type_check
  check (market_type in ('farmers', 'night', 'food_truck', 'popup', 'festival', 'craft', 'flea', 'other'));

alter table public.resources drop constraint resources_category_check;
alter table public.resources add constraint resources_category_check check (category in (
  'business_license', 'sellers_permit', 'food_handler', 'kitchen', 'health_permit', 'insurance',
  'cottage_food', 'packaged_food', 'product_safety', 'fire_safety', 'supplies', 'payments', 'other'));

-- More starter links (checked 2026-09-26; agencies move pages, so re-check them).
insert into public.resources (category, name, description, url, area, price_note, is_official, position, last_checked) values
  ('sellers_permit', 'CDTFA: resale certificates',
   'With a seller''s permit you can buy stock to resell (clothing, supplies for products) without paying sales tax up front, using a resale certificate.',
   'https://www.cdtfa.ca.gov/', 'California', 'Free', true, 2, '2026-09-26'),
  ('packaged_food', 'CA Dept. of Public Health: Food and Drug Branch',
   'Packaged foods made in a commercial kitchen (sauces, snacks, drinks) generally need a Processed Food Registration from the state.',
   'https://www.cdph.ca.gov/', 'California', null, true, 1, '2026-09-26'),
  ('product_safety', 'U.S. Consumer Product Safety Commission (CPSC)',
   'Selling anything for kids 12 and under (including kids'' clothing and toys)? There are federal safety, testing and labeling rules.',
   'https://www.cpsc.gov/', 'United States', null, true, 1, '2026-09-26'),
  ('product_safety', 'FDA: cosmetics',
   'Soaps, lotions, lip balms and other cosmetics have labeling and safety rules.',
   'https://www.fda.gov/cosmetics', 'United States', null, true, 2, '2026-09-26'),
  ('fire_safety', 'California State Fire Marshal',
   'Many events require a flame-retardant canopy with a State Fire Marshal (CSFM) label. Food booths with cooking may also need a fire inspection.',
   'https://osfm.fire.ca.gov/', 'California', null, true, 1, '2026-09-26'),
  ('payments', 'Square',
   'Card reader and free point-of-sale app, popular with market vendors. Works offline.',
   'https://squareup.com/', 'Online', 'Reader from ~$59', false, 1, '2026-09-26'),
  ('payments', 'Clover',
   'Card readers and point-of-sale systems for small businesses.',
   'https://www.clover.com/', 'Online', null, false, 2, '2026-09-26');
