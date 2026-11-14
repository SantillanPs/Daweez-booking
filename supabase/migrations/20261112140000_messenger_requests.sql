-- Guests write to the hotel's Facebook page, not WhatsApp (Sebastian, 2026-11-12: "the guests message the
-- facebook page of the hotel, and the ai responds"). The same bot answers Messenger, so a request can
-- come from there too. A Messenger guest has no phone number on the message: the bot asks for it.
alter table public.booking_requests drop constraint booking_requests_source_check;
alter table public.booking_requests add constraint booking_requests_source_check
  check (source in ('whatsapp', 'website', 'messenger'));
