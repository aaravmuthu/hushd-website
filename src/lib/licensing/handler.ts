// The license API the Hushd Mac app talks to: POST /api/license/{activate,validate,deactivate}.
//
// All the rules (key lookup, the per-key Mac cap, revoke, expiry) live in Postgres
// functions (supabase/migrations/20261108000000_licensing.sql). This file only checks
// the request shape, calls the right function, and turns its answer into an HTTP reply.
import { z } from "zod";

export type LicenseAction = "activate" | "validate" | "deactivate";

/** Calls a Postgres function with the service role. Injected so tests need no database. */
export type LicenseRpc = (
  fn: "activate_license" | "validate_license" | "deactivate_license",
  args: Record<string, string | null>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

const text = (max: number) => z.string().trim().min(1).max(max);

const bodySchema = z.object({
  key: text(64),
  device_id: text(200),
  device_name: text(120).optional(),
  app_version: text(40).optional(),
});

const resultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  license: z
    .object({
      plan: z.string(),
      expires_at: z.string().nullable(),
      max_activations: z.number(),
      activations: z.number(),
      key_hint: z.string(),
    })
    .optional(),
});

/** HTTP status for each refusal the database can give. */
const STATUS: Record<string, number> = {
  missing_device: 400,
  invalid_key: 404,
  not_activated: 403,
  activation_limit: 409,
  revoked: 403,
  expired: 403,
};

const MESSAGES: Record<string, string> = {
  bad_request: "Send JSON with key and device_id.",
  missing_device: "This Mac didn't send an id.",
  invalid_key: "That license key doesn't exist. Check it for typos.",
  not_activated: "This Mac isn't activated on that key yet.",
  activation_limit: "That key is already active on the most Macs it allows. Deactivate one first.",
  revoked: "That license key has been turned off.",
  expired: "That license key has expired.",
  server_error: "Licensing is unavailable right now. Try again in a minute.",
  not_found: "Unknown license action.",
};

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function refuse(error: string, extra: Record<string, unknown> = {}): Response {
  return reply(STATUS[error] ?? 400, { ok: false, error, message: MESSAGES[error] ?? error, ...extra });
}

export function isLicenseAction(value: string): value is LicenseAction {
  return value === "activate" || value === "validate" || value === "deactivate";
}

export async function handleLicenseRequest(
  action: string,
  request: Request,
  rpc: LicenseRpc,
): Promise<Response> {
  if (!isLicenseAction(action)) return reply(404, { ok: false, error: "not_found", message: MESSAGES.not_found });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return reply(400, { ok: false, error: "bad_request", message: MESSAGES.bad_request });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return reply(400, { ok: false, error: "bad_request", message: MESSAGES.bad_request });
  const { key, device_id, device_name, app_version } = parsed.data;

  const call =
    action === "activate"
      ? rpc("activate_license", {
          p_key: key,
          p_device_id: device_id,
          p_device_name: device_name ?? null,
          p_app_version: app_version ?? null,
        })
      : action === "validate"
        ? rpc("validate_license", { p_key: key, p_device_id: device_id, p_app_version: app_version ?? null })
        : rpc("deactivate_license", { p_key: key, p_device_id: device_id });

  let result: z.infer<typeof resultSchema>;
  try {
    const { data, error } = await call;
    if (error) throw new Error(error.message);
    result = resultSchema.parse(data);
  } catch (err) {
    console.error(`[license] ${action} failed:`, err instanceof Error ? err.message : err);
    return reply(500, { ok: false, error: "server_error", message: MESSAGES.server_error });
  }

  if (!result.ok) return refuse(result.error ?? "invalid_key", result.license ? { license: result.license } : {});
  return reply(200, { ok: true, license: result.license });
}
