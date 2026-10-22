-- Shared fixed-window rate limit for serverless isolates.
--
-- The application previously counted hits in process memory. Each Vercel
-- instance had its own window, so a limit of N became N times the number of
-- warm instances. This table is the shared counter. Callers store a SHA-256
-- of the email, IP, or user id, not the raw value.
--
-- No catalogue rows change. No CHECK constraints on existing tables change.
-- Preflight: new empty table and one function. Expected row count after apply: 0.
--
-- The function is SECURITY INVOKER. Only service_role may execute it. Anonymous
-- and authenticated roles have no table privileges and no execute privilege.
-- RLS is enabled and there is no policy, so a mistaken grant still returns
-- no rows to those roles.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.consume_rate_limit(text, integer, integer);
--   DROP TABLE IF EXISTS public.rate_limit_buckets;

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0,
  CONSTRAINT rate_limit_buckets_hits_check CHECK (hits >= 0),
  CONSTRAINT rate_limit_buckets_bucket_length CHECK (
    char_length(bucket) BETWEEN 1 AND 200
  )
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM anon;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_ms integer
)
RETURNS TABLE (
  allowed boolean,
  retry_after_sec integer,
  remaining integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hits integer;
  v_started timestamptz;
  v_window interval;
BEGIN
  IF p_bucket IS NULL OR char_length(btrim(p_bucket)) = 0 THEN
    RAISE EXCEPTION 'rate limit key is required';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_window_ms IS NULL OR p_window_ms < 1 THEN
    RAISE EXCEPTION 'invalid rate limit';
  END IF;
  IF char_length(p_bucket) > 200 THEN
    RAISE EXCEPTION 'rate limit key is too long';
  END IF;

  v_window := (p_window_ms::numeric / 1000.0) * interval '1 second';

  INSERT INTO public.rate_limit_buckets AS bucket_row (bucket, window_started_at, hits)
  VALUES (p_bucket, clock_timestamp(), 1)
  ON CONFLICT (bucket) DO UPDATE
  SET
    hits = CASE
      WHEN bucket_row.window_started_at <= clock_timestamp() - v_window THEN 1
      ELSE bucket_row.hits + 1
    END,
    window_started_at = CASE
      WHEN bucket_row.window_started_at <= clock_timestamp() - v_window THEN clock_timestamp()
      ELSE bucket_row.window_started_at
    END
  RETURNING rate_limit_buckets.hits, rate_limit_buckets.window_started_at
  INTO v_hits, v_started;

  IF v_hits > p_limit THEN
    allowed := false;
    remaining := 0;
    retry_after_sec := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_started + v_window - clock_timestamp())))::integer
    );
  ELSE
    allowed := true;
    remaining := p_limit - v_hits;
    retry_after_sec := 0;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
