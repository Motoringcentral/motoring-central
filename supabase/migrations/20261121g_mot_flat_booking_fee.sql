-- 21 Nov 2026 (owner's decision, after feedback from an MOT station that already charges the full fee):
-- test centres are paid the official maximum for the class minus a flat £5 booking fee (which includes VAT).
-- Car (class 4): customer pays £54.85, test centre £49.85, we keep £5. No joining fee for MOT stations.
-- book_mot uses private.mot_payout, so new bookings follow this at once; earlier bookings keep their stored figures.
create or replace function private.mot_payout(p_class text) returns numeric language sql immutable set search_path = '' as $$
  select greatest(0, round(private.mot_max(p_class) - 5.00, 2)) $$;
