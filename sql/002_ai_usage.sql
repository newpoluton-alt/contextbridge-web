-- Preserve existing daily request counts while adding token accounting.
-- Input totals include cached input; cached_input_tokens is a subset, never extra usage.
ALTER TABLE cb_usage
  ADD COLUMN IF NOT EXISTS input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  ADD COLUMN IF NOT EXISTS output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  ADD COLUMN IF NOT EXISTS cached_input_tokens bigint NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  ADD COLUMN IF NOT EXISTS reserved_tokens bigint NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0);

-- Application reservations supply a UTC day explicitly. Keep direct inserts consistent.
ALTER TABLE cb_usage ALTER COLUMN day SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date);
