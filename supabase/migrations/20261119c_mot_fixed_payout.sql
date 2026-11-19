-- Fixed MOT payout (19 Nov 2026): every test centre is paid the official maximum for the class minus our £9.85
-- (which includes VAT). Class 4 car: £45.00. No negotiated fees (partners.mot_agreed is no longer used).
-- book_mot was re-created with: pay := private.mot_payout(p_class);  (otherwise as in 20261119b_mot_bay_hours.sql)
create or replace function private.mot_payout(p_class text) returns numeric language sql immutable set search_path = '' as $$
  select greatest(0, private.mot_max(p_class) - 9.85) $$;

-- Changed the same day: test centres are paid 82% of the official maximum for every class (we keep 18%, incl. VAT).
-- Car (class 4): £44.98.
create or replace function private.mot_payout(p_class text) returns numeric language sql immutable set search_path = '' as $$
  select round(private.mot_max(p_class) * 0.82, 2) $$;
