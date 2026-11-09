// The facts only the owner can supply. Everything is empty until filled in; an empty field renders nothing, so the live
// site never shows a placeholder. Fill these in with the real details once they exist (see docs/compliance.md).
export const OWNER = {
  /** Legal name of the person or company that runs Hushd, as it should appear in the Terms. */
  name: "",
  /** Postal address for legal notices. */
  address: "",
  /** Where people write about privacy, their key, or a deletion request. */
  email: "",
  /** Whose law the Terms follow, for example "the State of Texas, USA". */
  law: "",
  /** Youngest age that may use the beta, as a number such as "13" or "16". */
  minAge: "",
  /** How long a key's records are kept after the key ends, for example "90 days". */
  retention: "",
} as const;

type Field = keyof typeof OWNER;

/**
 * Fills a page's markup from OWNER: `{{email}}` becomes the value (HTML-escaped), and a block wrapped as
 * `<!--if:email-->...<!--/if-->` stays only when that field is filled in.
 */
export function fillOwner(html: string, owner: Record<Field, string> = OWNER): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const kept = html.replace(/<!--if:(\w+)-->([\s\S]*?)<!--\/if-->/g, (_m, f: string, inner: string) => (owner[f as Field]?.trim() ? inner : ""));
  return kept.replace(/\{\{(\w+)\}\}/g, (_m, f: string) => esc(owner[f as Field]?.trim() ?? ""));
}
