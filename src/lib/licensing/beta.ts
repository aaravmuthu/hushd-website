// POST /api/beta/redeem: trade a beta invite code for a beta license key.
//
// The rules (cap per code, expiry, the per-visitor guess limit, issuing the key) live in
// redeem_beta_code() in supabase/migrations/20261108010000_beta_codes.sql.
import { z } from "zod";

export type BetaRpc = (
  fn: "redeem_beta_code",
  args: { p_code: string; p_ip: string },
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

const bodySchema = z.object({ code: z.string().trim().min(1).max(64) });

const resultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  license: z
    .object({
      key: z.string(),
      key_hint: z.string(),
      plan: z.string(),
      max_activations: z.number(),
      issued_at: z.string(),
    })
    .optional(),
});

const REFUSALS: Record<string, [number, string]> = {
  bad_request: [400, "Type the code you were given."],
  invalid_code: [404, "That code didn't work. Check the spelling."],
  code_expired: [410, "That code has expired."],
  code_used_up: [410, "That code has been used up."],
  rate_limited: [429, "Too many tries. Wait a few minutes, then try again."],
  server_error: [500, "Couldn't check codes right now. Try again in a minute."],
};

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function refuse(error: string): Response {
  const [status, message] = REFUSALS[error] ?? [400, error];
  return reply(status, { ok: false, error, message });
}

/** Cloudflare sets cf-connecting-ip and clients can't override it; never trust x-forwarded-for here. */
export function visitorIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

export async function handleBetaRedeem(request: Request, rpc: BetaRpc): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return refuse("bad_request");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return refuse("bad_request");

  let result: z.infer<typeof resultSchema>;
  try {
    const { data, error } = await rpc("redeem_beta_code", {
      p_code: parsed.data.code,
      p_ip: visitorIp(request),
    });
    if (error) throw new Error(error.message);
    result = resultSchema.parse(data);
  } catch (err) {
    console.error("[beta] redeem failed:", err instanceof Error ? err.message : err);
    return refuse("server_error");
  }

  if (!result.ok || !result.license) return refuse(result.error ?? "invalid_code");
  return reply(200, { ok: true, license: result.license });
}
