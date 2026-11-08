import { describe, expect, it, vi } from "vitest";

import { handleBetaRedeem, type BetaRpc } from "./beta";

const license = {
  key: "HUSHD-AAAAA-BBBBB-CCCCC-DDDDD-EEEEE",
  key_hint: "EEEE",
  plan: "beta",
  max_activations: 2,
  issued_at: "2026-11-08T18:00:00Z",
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://hushd.test/api/beta/redeem", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("beta redeem API", () => {
  it("returns the new key and passes Cloudflare's visitor ip, not x-forwarded-for", async () => {
    const rpc = vi.fn<BetaRpc>(async () => ({ data: { ok: true, license }, error: null }));
    const res = await handleBetaRedeem(
      post(
        { code: " quietmac " },
        { "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4" },
      ),
      rpc,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, license });
    expect(rpc).toHaveBeenCalledWith("redeem_beta_code", {
      p_code: "quietmac",
      p_ip: "203.0.113.9",
    });
  });

  it.each([
    ["invalid_code", 404],
    ["code_expired", 410],
    ["code_used_up", 410],
    ["rate_limited", 429],
  ])("maps %s to %i", async (error, status) => {
    const rpc: BetaRpc = async () => ({ data: { ok: false, error }, error: null });
    const res = await handleBetaRedeem(post({ code: "x" }), rpc);
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ ok: false, error, message: expect.any(String) });
  });

  it("rejects empty or junk bodies without calling the database", async () => {
    const rpc = vi.fn<BetaRpc>();
    for (const b of ["nope", {}, { code: "   " }, { code: "x".repeat(65) }]) {
      expect((await handleBetaRedeem(post(b), rpc)).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers JSON 500 when the database client can't start", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc: BetaRpc = () => {
      throw new Error("Missing Supabase environment variable(s)");
    };
    const res = await handleBetaRedeem(post({ code: "x" }), rpc);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "server_error" });
    spy.mockRestore();
  });
});
