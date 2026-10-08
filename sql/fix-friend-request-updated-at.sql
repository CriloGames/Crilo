-- Repair the existing Crilo friend_requests table without removing any requests.
-- Safe to run more than once. Preserve existing friendships and account data.
ALTER TABLE public.friend_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Verify the column exists.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'friend_requests'
  AND column_name = 'updated_at';
