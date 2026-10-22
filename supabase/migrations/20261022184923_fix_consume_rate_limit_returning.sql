-- The first consume_rate_limit body referenced rate_limit_buckets in RETURNING
-- after the INSERT target was aliased as bucket_row. Postgres rejected the
-- call with 42P01. This replaces the function. Grants stay service-role only.
-- No table rows are rewritten.

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
  RETURNING bucket_row.hits, bucket_row.window_started_at
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
