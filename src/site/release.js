// The newest build, as tools/beta/release.sh in the app project writes it (release.json, next to the image and feed in public/updates/).
// The Download page and the beta pass both read it, so neither can name a build that is not there.
import release from "./release.json";

export const DMG_URL = `/updates/${release.file}`;

export function size() {
  const mb = release.bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Points every [data-dmg] link at the newest image and fills [data-dmg-meta] and [data-dmg-label]. */
export function applyRelease(root) {
  root.querySelectorAll("[data-dmg]").forEach((a) => { a.href = DMG_URL; a.setAttribute("download", release.file); });
  root.querySelectorAll("[data-dmg-meta]").forEach((n) => { n.textContent = `${release.label} · ${size()} · Apple silicon`; });
  root.querySelectorAll("[data-dmg-label]").forEach((n) => { n.textContent = release.label; });
}
