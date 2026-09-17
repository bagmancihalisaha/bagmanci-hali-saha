create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default '',
  email text not null default '',
  full_name text not null default '',
  phone text not null default '',
  subscriber boolean not null default false,
  subscription_package text not null default '',
  preferred_subscription_day text not null default '',
  preferred_subscription_time text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists subscription_package text not null default '';
alter table public.profiles add column if not exists preferred_subscription_day text not null default '';
alter table public.profiles add column if not exists preferred_subscription_time text not null default '';
alter table public.profiles add column if not exists phone_verified boolean not null default false;
alter table public.profiles add column if not exists phone_verified_at timestamptz;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username <> '';

create table if not exists public.site_settings (
  id text primary key,
  hero_image text not null default '',
  match_image text not null default '',
  background_image text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_settings add column if not exists background_image text not null default '';
alter table public.site_settings add column if not exists bank_name text not null default '';
alter table public.site_settings add column if not exists iban text not null default '';
alter table public.site_settings add column if not exists iban_holder text not null default '';
alter table public.site_settings add column if not exists day_price numeric(10,2) not null default 1200;
alter table public.site_settings add column if not exists night_price numeric(10,2) not null default 1800;
alter table public.site_settings add column if not exists subscriber_price numeric(10,2) not null default 1700;
alter table public.site_settings add column if not exists favicon_image text not null default '';
alter table public.site_settings add column if not exists logo_image text not null default '';
alter table public.site_settings add column if not exists hero_fit text not null default 'cover';
alter table public.site_settings add column if not exists background_fit text not null default 'cover';
alter table public.site_settings add column if not exists match_fit text not null default 'cover';
alter table public.site_settings add column if not exists logo_fit text not null default 'contain';
alter table public.site_settings add column if not exists favicon_fit text not null default 'contain';

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  payment_token uuid not null default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  booking_date date not null,
  booking_time text not null,
  subscriber boolean not null default false,
  duration_hours numeric(3,1) not null default 1,
  package_name text not null,
  total_amount numeric(10,2) not null default 0,
  deposit_amount numeric(10,2) not null default 600,
  paid_amount numeric(10,2) not null default 0,
  payment_choice text not null default 'deposit' check (payment_choice in ('deposit', 'full')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposit', 'paid', 'pending', 'proof_submitted', 'approved', 'rejected')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.booking_requests add column if not exists paid_amount numeric(10,2) not null default 0;
alter table public.booking_requests add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.booking_requests add column if not exists subscriber boolean not null default false;
alter table public.booking_requests add column if not exists duration_hours numeric(3,1) not null default 1;
alter table public.booking_requests drop constraint if exists booking_requests_payment_status_check;
alter table public.booking_requests add constraint booking_requests_payment_status_check check (payment_status in ('unpaid', 'deposit', 'paid', 'pending', 'proof_submitted', 'approved', 'rejected')) not valid;
alter table public.booking_requests drop constraint if exists booking_requests_phone_format;
alter table public.booking_requests add constraint booking_requests_phone_format check (phone ~ '^0[0-9]{10}$') not valid;

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  subscription_day text not null,
  subscription_time text not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  description text not null,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  formatted_phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_phone_verifications_phone_idx on public.whatsapp_phone_verifications (formatted_phone, created_at desc);

create table if not exists public.whatsapp_ready_replies (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  response_text text not null,
  active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now()
);

insert into public.whatsapp_ready_replies (keyword, response_text, active, priority)
values
  ('fiyat', 'Gunduz tarifesi 1200 TL, gece tarifesi 1800 TL. Rezervasyon icin web sitemizden gun ve saat secebilirsiniz.', true, 10),
  ('rezervasyon', 'Rezervasyon icin web sitesindeki takvimden musait gun ve saati secmeniz yeterli. Odeme/dekont sonrasi kaydiniz kesinlesir.', true, 20),
  ('adres', 'Bagmanci Hali Saha Sanliurfa. Konum icin web sitemizdeki iletisim bolumunu acabilirsiniz.', true, 30)
on conflict do nothing;

alter table public.operating_expenses enable row level security;
alter table public.subscription_requests enable row level security;
alter table public.whatsapp_phone_verifications enable row level security;
alter table public.whatsapp_ready_replies enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (auth.jwt() ->> 'email') = 'bagmanciabdullah93@gmail.com'
    or (auth.jwt() ->> 'aal') = 'aal2',
    false
  );
$$;

drop policy if exists "admins manage operating expenses" on public.operating_expenses;
create policy "admins manage operating expenses" on public.operating_expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage whatsapp phone verifications" on public.whatsapp_phone_verifications;
create policy "admins manage whatsapp phone verifications" on public.whatsapp_phone_verifications for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage whatsapp ready replies" on public.whatsapp_ready_replies;
create policy "admins manage whatsapp ready replies" on public.whatsapp_ready_replies for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public can create subscription requests" on public.subscription_requests;
drop policy if exists "admins manage subscription requests" on public.subscription_requests;
create policy "public can create subscription requests" on public.subscription_requests for insert to anon, authenticated with check (true);
create policy "admins manage subscription requests" on public.subscription_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.booking_requests enable row level security;
drop policy if exists "public can create booking requests" on public.booking_requests;
drop policy if exists "admins manage booking requests" on public.booking_requests;
create policy "public can create booking requests" on public.booking_requests for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
drop policy if exists "customers read own booking requests" on public.booking_requests;
create policy "customers read own booking requests" on public.booking_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins manage booking requests" on public.booking_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.subscription_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_day text not null,
  subscription_time text not null,
  field_name text not null default 'Bağmancı Halı Saha',
  remaining_weeks integer not null default 12,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.subscription_slots drop constraint if exists subscription_slots_subscription_day_subscription_time_key;
create unique index if not exists subscription_slots_active_unique on public.subscription_slots (subscription_day, subscription_time) where active = true;

alter table public.subscription_slots enable row level security;
drop policy if exists "public can read active subscription slots" on public.subscription_slots;
drop policy if exists "customers read own subscription slots" on public.subscription_slots;
drop policy if exists "customers manage own subscription slots" on public.subscription_slots;
create policy "public can read active subscription slots" on public.subscription_slots for select to anon, authenticated using (active = true or user_id = auth.uid() or public.is_admin());
create policy "customers read own subscription slots" on public.subscription_slots for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "customers manage own subscription slots" on public.subscription_slots for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

create or replace function public.choose_booking_payment(p_booking_id uuid, p_payment_token uuid, p_payment_choice text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_payment_choice not in ('deposit', 'full') then raise exception 'Geçersiz ödeme seçimi'; end if;
  update public.booking_requests set payment_choice = p_payment_choice where id = p_booking_id and payment_token = p_payment_token;
  return found;
end;
$$;

alter table public.site_settings enable row level security;

alter table public.profiles enable row level security;

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "public can read site assets" on storage.objects;
drop policy if exists "admins upload site assets" on storage.objects;
drop policy if exists "admins update site assets" on storage.objects;
drop policy if exists "admins delete site assets" on storage.objects;

create policy "public can read site assets" on storage.objects
for select to anon, authenticated using (bucket_id = 'site-assets');

create policy "admins upload site assets" on storage.objects
for insert to authenticated with check (bucket_id = 'site-assets' and public.is_admin());

create policy "admins update site assets" on storage.objects
for update to authenticated using (bucket_id = 'site-assets' and public.is_admin())
with check (bucket_id = 'site-assets' and public.is_admin());

create policy "admins delete site assets" on storage.objects
for delete to authenticated using (bucket_id = 'site-assets' and public.is_admin());

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'site_settings')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end
$$;

create policy "public can read site settings" on public.site_settings
for select to anon, authenticated using (true);

create policy "admins manage site settings" on public.site_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "customers read own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "customers create own profile" on public.profiles
for insert to authenticated with check (id = auth.uid());

create policy "customers update own profile" on public.profiles
for update to authenticated using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Run this once for your admin user after replacing the email.
-- update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb where email = 'bagmanciabdullah93@gmail.com';


create table if not exists public.match_records (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  match_date date not null,
  field_name text not null,
  duration text not null,
  video_url text not null,
  thumbnail_url text not null,
  created_at timestamptz not null default now()
);

alter table public.match_records enable row level security;
drop policy if exists "public can read match records" on public.match_records;
drop policy if exists "admins manage match records" on public.match_records;
create policy "public can read match records" on public.match_records for select to anon, authenticated using (true);
create policy "admins manage match records" on public.match_records for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Force PostgREST to pick up any new/renamed columns immediately.
NOTIFY pgrst, 'reload schema';
