-- Hushd licensing: license keys and the Macs they are activated on.
--
-- Keys are never stored. Only a SHA-256 of the normalized key is kept, plus the
-- last four characters so a person can recognise their key in a list. Device ids
-- are hashed the same way.
--
-- Nothing here is reachable from the browser: RLS is on with no policies, every
-- grant to anon/authenticated is revoked, and the functions run for service_role
-- only. The site's /api/license/* routes call them with the service-role client.
--
-- Issue a key from the SQL editor:
--   select * from public.issue_license('someone@example.com');                 -- beta, 2 Macs, never expires
--   select * from public.issue_license('judge@example.com', 'beta', 3, now() + interval '60 days', 'CAC judge');
-- The plaintext key is returned once, by that call only.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  key_hint text not null check (char_length(key_hint) = 4),
  email text check (email is null or (char_length(email) <= 320 and email like '%_@_%')),
  plan text not null default 'beta' check (plan ~ '^[a-z0-9_-]{1,32}$'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  max_activations integer not null default 2 check (max_activations between 1 and 100),
  expires_at timestamptz,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licenses_email_idx on public.licenses (lower(email));

create table public.license_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses (id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  device_name text check (device_name is null or char_length(device_name) <= 120),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (license_id, device_hash)
);

alter table public.licenses enable row level security;
alter table public.license_activations enable row level security;

revoke all on table public.licenses from public, anon, authenticated;
revoke all on table public.license_activations from public, anon, authenticated;
grant all on table public.licenses to service_role;
grant all on table public.license_activations to service_role;

create function public.licenses_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger licenses_touch_updated_at
before update on public.licenses
for each row execute function public.licenses_touch_updated_at();

-- ---------------------------------------------------------------- key helpers

-- Keys look like HUSHD-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX: 25 Crockford base32
-- characters (125 random bits). Normalizing drops the prefix, dashes, spaces and
-- case, and maps the look-alikes O->0 and I/L->1, so a key typed by hand still matches.
create function public.license_normalize_key(p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    case
      when char_length(k) = 30 and left(k, 5) = 'HUSHD' then substr(k, 6)
      else k
    end,
    'OIL', '011')
  from (select upper(regexp_replace(coalesce(p_key, ''), '[^A-Za-z0-9]', '', 'g')) as k) s;
$$;

create function public.license_sha256(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_value, 'UTF8')), 'hex');
$$;

-- ---------------------------------------------------------------- admin: issue

create function public.issue_license(
  p_email text default null,
  p_plan text default 'beta',
  p_max_activations integer default 2,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns table (license_id uuid, license_key text)
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  raw bytea;
  body text;
  i integer;
begin
  loop
    raw := extensions.gen_random_bytes(25);
    body := '';
    for i in 0..24 loop
      -- 256 is a multiple of 32, so the low five bits of a random byte are uniform.
      body := body || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
    end loop;

    begin
      insert into public.licenses (key_hash, key_hint, email, plan, max_activations, expires_at, note)
      values (
        public.license_sha256(body),
        right(body, 4),
        nullif(lower(btrim(p_email)), ''),
        p_plan,
        p_max_activations,
        p_expires_at,
        p_note
      )
      returning id into license_id;
      exit;
    exception when unique_violation then
      -- A 125-bit collision will not happen, but never hand out a duplicate.
    end;
  end loop;

  license_key := 'HUSHD-' || substr(body, 1, 5) || '-' || substr(body, 6, 5) || '-'
    || substr(body, 11, 5) || '-' || substr(body, 16, 5) || '-' || substr(body, 21, 5);
  return next;
end;
$$;

-- ---------------------------------------------------------------- app: activate / validate / deactivate

-- Shared shape for every answer the app gets back.
create function public.license_summary(p_license public.licenses)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'plan', p_license.plan,
    'expires_at', p_license.expires_at,
    'max_activations', p_license.max_activations,
    'activations', (select count(*) from public.license_activations a where a.license_id = p_license.id),
    'key_hint', p_license.key_hint
  );
$$;

create function public.activate_license(
  p_key text,
  p_device_id text,
  p_device_name text default null,
  p_app_version text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lic public.licenses;
  dev text := public.license_sha256(coalesce(p_device_id, ''));
  used integer;
begin
  if coalesce(btrim(p_device_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_device');
  end if;

  -- Lock the license so two Macs activating at once cannot both slip under the cap.
  select * into lic
  from public.licenses
  where key_hash = public.license_sha256(public.license_normalize_key(p_key))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;
  if lic.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;
  if lic.expires_at is not null and lic.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update public.license_activations
  set last_seen_at = now(),
      device_name = coalesce(left(p_device_name, 120), device_name),
      app_version = coalesce(left(p_app_version, 40), app_version)
  where license_id = lic.id and device_hash = dev;

  if not found then
    select count(*) into used from public.license_activations where license_id = lic.id;
    if used >= lic.max_activations then
      return jsonb_build_object('ok', false, 'error', 'activation_limit', 'license', public.license_summary(lic));
    end if;

    insert into public.license_activations (license_id, device_hash, device_name, app_version)
    values (lic.id, dev, left(p_device_name, 120), left(p_app_version, 40));
  end if;

  return jsonb_build_object('ok', true, 'license', public.license_summary(lic));
end;
$$;

create function public.validate_license(
  p_key text,
  p_device_id text,
  p_app_version text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lic public.licenses;
begin
  select * into lic
  from public.licenses
  where key_hash = public.license_sha256(public.license_normalize_key(p_key));

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;
  if lic.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;
  if lic.expires_at is not null and lic.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update public.license_activations
  set last_seen_at = now(),
      app_version = coalesce(left(p_app_version, 40), app_version)
  where license_id = lic.id
    and device_hash = public.license_sha256(coalesce(p_device_id, ''));

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_activated', 'license', public.license_summary(lic));
  end if;

  return jsonb_build_object('ok', true, 'license', public.license_summary(lic));
end;
$$;

create function public.deactivate_license(p_key text, p_device_id text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lic public.licenses;
begin
  select * into lic
  from public.licenses
  where key_hash = public.license_sha256(public.license_normalize_key(p_key))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  delete from public.license_activations
  where license_id = lic.id
    and device_hash = public.license_sha256(coalesce(p_device_id, ''));

  return jsonb_build_object('ok', true, 'license', public.license_summary(lic));
end;
$$;

-- Only the server (service_role) may run any of these.
revoke all on function public.licenses_touch_updated_at() from public, anon, authenticated;
revoke all on function public.license_normalize_key(text) from public, anon, authenticated;
revoke all on function public.license_sha256(text) from public, anon, authenticated;
revoke all on function public.issue_license(text, text, integer, timestamptz, text) from public, anon, authenticated;
revoke all on function public.license_summary(public.licenses) from public, anon, authenticated;
revoke all on function public.activate_license(text, text, text, text) from public, anon, authenticated;
revoke all on function public.validate_license(text, text, text) from public, anon, authenticated;
revoke all on function public.deactivate_license(text, text) from public, anon, authenticated;

grant execute on function public.license_normalize_key(text) to service_role;
grant execute on function public.license_sha256(text) to service_role;
grant execute on function public.issue_license(text, text, integer, timestamptz, text) to service_role;
grant execute on function public.license_summary(public.licenses) to service_role;
grant execute on function public.activate_license(text, text, text, text) to service_role;
grant execute on function public.validate_license(text, text, text) to service_role;
grant execute on function public.deactivate_license(text, text) to service_role;
