import { describe, expect, it, vi } from "vitest";

import { handleLicenseRequest, type LicenseRpc } from "./handler";

const license = {
  plan: "beta",
  expires_at: null,
  max_activations: 2,
  activations: 1,
  key_hint: "QK01",
};

function post(body: unknown): Request {
  return new Request("https://hushd.test/api/license/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const good = {
  key: "HUSHD-AAAAA-BBBBB-CCCCC-DDDDD-EEEEE",
  device_id: "mac-1",
  device_name: "Studio",
  app_version: "0.4",
};

describe("license API", () => {
  it("activates through the database function with every field", async () => {
    const rpc = vi.fn<LicenseRpc>(async () => ({ data: { ok: true, license }, error: null }));
    const res = await handleLicenseRequest("activate", post(good), rpc);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, license });
    expect(rpc).toHaveBeenCalledWith("activate_license", {
      p_key: good.key,
      p_device_id: "mac-1",
      p_device_name: "Studio",
      p_app_version: "0.4",
    });
  });

  it("validates and deactivates with only what those functions take", async () => {
    const rpc = vi.fn<LicenseRpc>(async () => ({ data: { ok: true, license }, error: null }));
    await handleLicenseRequest("validate", post(good), rpc);
    await handleLicenseRequest("deactivate", post({ key: good.key, device_id: "mac-1" }), rpc);
    expect(rpc).toHaveBeenNthCalledWith(1, "validate_license", {
      p_key: good.key,
      p_device_id: "mac-1",
      p_app_version: "0.4",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "deactivate_license", {
      p_key: good.key,
      p_device_id: "mac-1",
    });
  });

  it.each([
    ["invalid_key", 404],
    ["activation_limit", 409],
    ["revoked", 403],
    ["expired", 403],
    ["not_activated", 403],
  ])("maps %s to %i with a readable message", async (error, status) => {
    const rpc: LicenseRpc = async () => ({ data: { ok: false, error }, error: null });
    const res = await handleLicenseRequest("activate", post(good), rpc);
    const body = await res.json();
    expect(res.status).toBe(status);
    expect(body).toMatchObject({ ok: false, error });
    expect(body.message).toMatch(/\w/);
  });

  it("rejects bad input before touching the database", async () => {
    const rpc = vi.fn<LicenseRpc>();
    for (const body of [
      "not json",
      {},
      { key: "", device_id: "x" },
      { key: "k", device_id: "x".repeat(201) },
    ]) {
      const res = await handleLicenseRequest("activate", post(body), rpc);
      expect(res.status).toBe(400);
    }
    expect((await handleLicenseRequest("issue", post(good), rpc)).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("hides database errors behind a 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc: LicenseRpc = async () => ({
      data: null,
      error: { message: "relation does not exist" },
    });
    const res = await handleLicenseRequest("validate", post(good), rpc);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("relation");
    spy.mockRestore();
  });
});

describe("license API when the database client cannot start", () => {
  it("still answers JSON, not an HTML error page", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc: LicenseRpc = () => {
      throw new Error("Missing Supabase environment variable(s)");
    };
    const res = await handleLicenseRequest("activate", post(good), rpc);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "server_error" });
    spy.mockRestore();
  });
});
