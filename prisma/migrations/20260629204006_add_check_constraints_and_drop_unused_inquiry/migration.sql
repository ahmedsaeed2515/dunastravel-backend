-- =====================================================
-- Migration: Add CHECK Constraints + Drop Dead Inquiry
-- =====================================================

-- 1. Enforce positive price on tours
ALTER TABLE tours
  ADD CONSTRAINT chk_tours_price_positive
  CHECK (base_price_usd >= 0);

-- 2. Enforce at least 1 adult per booking
ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_adults_positive
  CHECK (adults >= 1);

-- 3. Enforce non-negative children / infants
ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_children_nn
  CHECK (children >= 0);

ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_infants_nn
  CHECK (infants >= 0);

-- 4. Enforce positive payment amounts
ALTER TABLE payments
  ADD CONSTRAINT chk_payments_amount_positive
  CHECK (amount > 0);

-- 5. Drop the legacy Inquiry table (superseded by tailor_made_inquiries)
--    Only safe to run after confirming the table is empty / unused.
DROP TABLE IF EXISTS inquiries;
