ALTER TABLE promotions
  ALTER COLUMN discount_percent TYPE DECIMAL(5, 2)
  USING ROUND(discount_percent::numeric, 2);

ALTER TABLE promotions
  ADD CONSTRAINT promotions_discount_percent_range
  CHECK (discount_percent > 0 AND discount_percent <= 90);

ALTER TABLE promotions
  ADD CONSTRAINT promotions_usage_range
  CHECK (max_uses > 0 AND current_uses >= 0 AND current_uses <= max_uses);
