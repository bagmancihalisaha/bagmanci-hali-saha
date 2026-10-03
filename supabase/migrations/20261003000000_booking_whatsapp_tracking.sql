alter table public.booking_requests
  add column if not exists whatsapp_confirmed boolean not null default false,
  add column if not exists reminder_sent boolean not null default false;
