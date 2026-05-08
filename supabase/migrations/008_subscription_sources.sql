-- Track subscription status per platform independently.
-- This prevents a cancelled iOS subscription from incorrectly showing as
-- cancelled on web (where Stripe manages it), and vice versa.
-- is_subscribed is kept as the derived "either platform active" flag and
-- is updated atomically by each webhook handler.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_subscribed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rc_subscribed     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for fast stripe customer ID lookups in webhook handler
CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx
  ON public.users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
