import { describe, expect, it } from "vitest";
import terms from "./terms.body.html?raw";
import privacy from "./privacy.body.html?raw";
import { fillOwner, OWNER } from "./owner";

const empty = { name: "", address: "", email: "", law: "", minAge: "", retention: "" };

describe("fillOwner", () => {
  it("renders nothing for an empty field", () => {
    expect(fillOwner("a<!--if:email-->X {{email}}<!--/if-->b", empty)).toBe("ab");
    expect(fillOwner("[{{name}}]", empty)).toBe("[]");
  });
  it("keeps a block and escapes the value when filled", () => {
    expect(fillOwner("<!--if:name-->Hi {{name}}<!--/if-->", { ...empty, name: "A & <B>" })).toBe("Hi A &amp; &lt;B&gt;");
  });
  it("leaves no placeholder or marker on the live pages while OWNER is unfilled", () => {
    for (const page of [terms, privacy]) {
      const html = fillOwner(page, OWNER);
      expect(html).not.toMatch(/\{\{|<!--if|<!--\/if|\[Company\]/);
    }
  });
});
