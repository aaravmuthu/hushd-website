# Compliance audit: hushd.store and the Hushd Mac app

Audited 2026-11-08 against a 20-item checklist. This is an engineering audit, not legal advice. **The Terms and the privacy wording are drafts and need review by someone qualified before anyone relies on them.** Facts only the owner can supply are not invented: they live in `src/site/owner.ts`, and a field left empty renders nothing on the site.

Context that decides several items: the beta is free, has no account, takes no payment, and Hushd sends no email.

| # | Item | Status | Evidence | Done / owner action |
|---|------|--------|----------|---------------------|
| 1 | Privacy policy | Done (draft) | `/privacy` existed; it now has a full list of what reaches hushd.store and what is kept (`#data`) | Owner: review wording; fill `email`, `retention` in `owner.ts` |
| 2 | Terms of service | Done (draft) | New `/terms`, linked from every footer | Owner: review; fill `name`, `address`, `email`, `law`, `minAge` |
| 3 | Refund policy | N/A | Beta is free; no payment code anywhere (`grep` for price/checkout finds only "Free") | Add one if the app is ever sold |
| 4 | Cookie policy | Done (inside Privacy) | Live headers: `__cf_bm` (Cloudflare) and `__dpl` (host deployment cookie). Site code uses no `document.cookie`, no `localStorage` | None |
| 5 | Cookie banner | N/A | Only strictly-necessary host cookies are set; no tracking cookies. A banner with nothing behind it would be noise | Revisit if analytics or ads are ever added |
| 6 | Form consents | Done | The only form is the beta code box; it submits a code, nothing else, and the Terms/Privacy are one click away in the footer | Optional: owner may want an explicit "I accept the Terms" line on `/beta` |
| 7 | No unnecessary data collection | Fixed (app PR #16) | `LicenseClient.swift` sent `device_name` (the Mac's name, usually a first name) on activate, contradicting the site, the app and its own comment. Server field is optional. Now removed | Merge and ship the app PR. Rows already stored keep their old `device_name` (see item 20) |
| 8 | Third-party SDKs | Done | Only Sparkle (MIT). Notice now ships in the bundle (`Acknowledgements.txt`) and opens from Settings, Privacy | None |
| 9 | Dark patterns | Pass | No countdowns, pre-ticked boxes, hidden opt-outs, confirm-shaming. Deactivate and Delete everything are plain buttons | None |
| 10 | Hidden fees | N/A | Free, no payment | None |
| 11 | Fake reviews | N/A | No testimonials, ratings or review claims on any page | None |
| 12 | Unsupported claims | Fixed | Swept "no account / no cloud / no analytics / nothing leaves". They hold for the app. Privacy copy now also says: IP addresses are seen by the host, a failed beta code stores an IP hash for one day, cookies are listed | Owner: see "Lovable events" below |
| 13 | Alt text | Pass | Content images have descriptive alt; `alt=""` is used only on icons beside their own text | None |
| 14 | Colour contrast | Fixed | axe-core 4.14 (wcag2a/aa/21aa + best-practice) on all 6 pages found: scroll-text words at 1.3:1, tablist/list structure, heading order. Fixed; 0 violations on all pages; Terms link underlined | None |
| 15 | Keyboard | Pass | Tabbed `/download` (45 stops) and `/beta` at phone width: every stop has a visible focus ring; skip link first; menu button reachable | None |
| 16 | Business details | Blocked on owner | Nothing invented. Terms shows name/address/email only when filled | Owner: supply legal name or sole-proprietor name, postal address, contact email |
| 17 | Age consent / COPPA / GDPR-K | Needs owner decision | App examples are schoolwork, so users may be under 13. The beta collects no name/email/DOB and has no account, but the key check does send a device hash and IP is seen | Owner: choose a minimum age (13 or 16 are common) and get legal advice. Set `minAge`; the Terms line appears automatically |
| 18 | Unsubscribe link | N/A | Hushd sends no email (no mail library, no list). Syncly is a separate product | Add if email is ever sent |
| 19 | Font / image licensing | Done | Google Fonts (Inter) was loaded from fonts.googleapis.com on every page, sending visitors' IPs to Google. Removed; the site uses system fonts. Art is credited in the footer: Rodin (public domain, Wikimedia), Dürer (NGA, CC0), Friedrich (public domain). App screenshots are our own | Owner: keep the source links for the art; I took the credits from the footer, not from independent verification |
| 20 | Data deletion flow | Partly done, proposal below | Deactivate this Mac deletes that Mac's `license_activations` row (migration `20261108000000`). No self-serve way to remove a whole key | See proposal |

## Evidence collected

* **Third-party requests** (headless Chrome, CDP Network, every page): before, `fonts.googleapis.com` on every page; after, only the site's own host.
* **Live headers**: `Set-Cookie: __cf_bm` on pages and `/api` routes. Live page also sets `__dpl`, and POSTs page events to `hushd.store/__l5e/trackevents`.
* **What the server stores** (migrations): `licenses` (key hash, last 4 chars, optional email, plan, status, expiry, note); `license_activations` (device hash, optional `device_name`, app version, first/last seen); `beta_redeem_failures` (IP hash, purged after 1 day); `beta_codes`.

## Owner actions, in one place

1. **Lovable events.** The host injects `/~flock.js` and `/__l5e/events…js`. The first references `api.tinybird.co`, cookies and web storage; the second includes session-replay code. In a headless load only first-party `trackevents` and the two cookies appeared, but this is host behaviour the repo cannot remove. Check the Lovable project's analytics/privacy settings and switch off anything you do not want; until confirmed, the privacy page says only what was observed.
2. Fill `src/site/owner.ts`: legal name, address, contact email, governing law, minimum age, retention period.
3. Decide the age rule (item 17) with advice.
4. Have the Terms and privacy text reviewed.
5. Merge app PR #16 and ship the next beta so the Mac's name stops being sent.

## Proposal: self-serve deletion (not shipped; needs a migration you run in Lovable)

A button on `/beta` (or Settings in the app): "Delete my key and its Macs", authorised by having the key.

* New function `delete_license(p_key text)` (service-role only): look up by `key_hash`, `delete from licenses where id = …` (activations go with it via `on delete cascade`), return `ok`.
* New route `POST /api/license/delete` through the existing handler, same rate limiting as activate.
* Also run once, to clear the stale field on old rows: `update license_activations set device_name = null;`
* Retention for ended keys is whatever `owner.ts` `retention` says; the function above deletes immediately.
