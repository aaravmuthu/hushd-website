-- Hushd beta invite codes. Someone types a code on /beta, and if it is good the site prints them a
-- beta license key (plan 'beta', tagged with the code it came from).
--
-- Codes are stored only as a SHA-256 of the normalized code, like license keys. Every code has a
-- redemption cap (100 by default) because short, memorable codes can be guessed; the per-visitor
-- rate limit below covers the rest.
--
-- Make a code from the SQL editor (it is returned once):
--   select * from public.create_beta_code('QUIETMAC', 'Friends and family', 50);
--   select * from public.create_beta_code(null, 'CAC judges', 10, now() + interval '30 days');  -- random code
-- Turn one off:
--   update public.beta_codes set active = false where label = 'Friends and family';
--
-- Paid launch, later: beta licenses are `plan = 'beta'`, so one statement gives them their month, e.g.
--   update public.licenses set expires_at = '<launch date>'::timestamptz + interval '30 days' where plan = 'beta';

create table public.beta_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or char_length(label) <= 120),
  max_redemptions integer not null default 100 check (max_redemptions between 1 and 100000),
  redemptions integer not null default 0 check (redemptions >= 0),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.licenses
  add column beta_code_id uuid references public.beta_codes (id) on delete set null;

create index licenses_beta_code_idx on public.licenses (beta_code_id);

-- Failed guesses only, keyed by a hash of the visitor's IP (Cloudflare's cf-connecting-ip). Rows
-- older than a day are cleared on every redeem, so this never holds more than a day of misses.
create table public.beta_redeem_failures (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  failed_at timestamptz not null default now()
);

create index beta_redeem_failures_ip_idx on public.beta_redeem_failures (ip_hash, failed_at);

alter table public.beta_codes enable row level security;
alter table public.beta_redeem_failures enable row level security;

revoke all on table public.beta_codes from public, anon, authenticated;
revoke all on table public.beta_redeem_failures from public, anon, authenticated;
grant all on table public.beta_codes to service_role;
grant all on table public.beta_redeem_failures to service_role;

-- Codes normalize like keys: case, spaces and dashes don't matter. (No look-alike mapping here:
-- codes are words, and O/I/L are real letters in words.)
create function public.beta_normalize_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create function public.create_beta_code(
  p_code text default null,
  p_label text default null,
  p_max_redemptions integer default 100,
  p_expires_at timestamptz default null
)
returns table (code_id uuid, code text)
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  raw bytea;
  i integer;
begin
  if p_code is null then
    raw := extensions.gen_random_bytes(10);
    code := '';
    for i in 0..9 loop
      code := code || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
    end loop;
  else
    code := public.beta_normalize_code(p_code);
  end if;

  if char_length(code) < 4 or char_length(code) > 40 then
    raise exception 'A beta code needs 4 to 40 letters or digits.';
  end if;

  insert into public.beta_codes (code_hash, label, max_redemptions, expires_at)
  values (public.license_sha256(code), p_label, p_max_redemptions, p_expires_at)
  returning id into code_id;
  return next;
end;
$$;

create function public.redeem_beta_code(p_code text, p_ip text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_ip text := public.license_sha256('beta-ip:' || coalesce(p_ip, 'unknown'));
  bc public.beta_codes;
  misses integer;
  issued record;
  why text;
begin
  delete from public.beta_redeem_failures where failed_at < now() - interval '1 day';

  select count(*) into misses
  from public.beta_redeem_failures
  where ip_hash = v_ip and failed_at > now() - interval '15 minutes';
  if misses >= 8 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- Lock the code so parallel redeems can't go past its cap.
  select * into bc
  from public.beta_codes
  where code_hash = public.license_sha256(public.beta_normalize_code(p_code))
  for update;

  if not found or not bc.active then
    why := 'invalid_code';
  elsif bc.expires_at is not null and bc.expires_at <= now() then
    why := 'code_expired';
  elsif bc.redemptions >= bc.max_redemptions then
    why := 'code_used_up';
  end if;

  if why is not null then
    insert into public.beta_redeem_failures (ip_hash) values (v_ip);
    return jsonb_build_object('ok', false, 'error', why);
  end if;

  update public.beta_codes set redemptions = redemptions + 1 where id = bc.id;

  select * into issued
  from public.issue_license(null, 'beta', 2, null, left('Beta code: ' || coalesce(bc.label, 'unlabelled'), 500));
  update public.licenses set beta_code_id = bc.id where id = issued.license_id;

  return jsonb_build_object(
    'ok', true,
    'license', jsonb_build_object(
      'key', issued.license_key,
      'key_hint', right(issued.license_key, 4),
      'plan', 'beta',
      'max_activations', 2,
      'issued_at', now()
    )
  );
end;
$$;

revoke all on function public.beta_normalize_code(text) from public, anon, authenticated;
revoke all on function public.create_beta_code(text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.redeem_beta_code(text, text) from public, anon, authenticated;
grant execute on function public.beta_normalize_code(text) to service_role;
grant execute on function public.create_beta_code(text, text, integer, timestamptz) to service_role;
grant execute on function public.redeem_beta_code(text, text) to service_role;
