# KapeDoko FE

Nuxt 4 frontend with Ionic app shell, shadcn-vue style components, and Capacitor mobile support.

## Setup

```bash
bun install
```

Create a `.env` file from `.env.example` and set the Supabase project URL and publishable key.

Product analytics is off until `NUXT_PUBLIC_ANALYTICS_ENABLED=true` and `NUXT_PUBLIC_POSTHOG_KEY` are set. Use PostHog Cloud EU (`https://eu.i.posthog.com`), a separate project for local/dev, and a $0 billing limit. The app never sends events until the user allows analytics. Staff read funnels and retention in PostHog, not in `/admin`. After changing analytics env vars, rebuild the web app; native shells also need `bun run cap:sync` so `@capacitor/app` is registered.

Apply the SQL files in `db/` in filename order in the Supabase SQL editor, including `20260929_admin_portal.sql`, `20260929_admin_portal_fix.sql`, `20260929_philippines_coverage.sql`, `20260930_user_role_cafe_owner.sql`, `20260930_cafe_owners_catalog.sql`, `20260930_withdraw_shop_claim.sql`, `20260930_sync_cafe_owner_role_cast.sql`, `20260930_sync_cafe_owner_role_enum_assign.sql`, `20260930_list_my_shop_claims.sql`, `20261002_user_role_auditor.sql`, `20261003_amenity_source_of_truth.sql`, `20261004_amenity_resolutions.sql`, `20261005_amenity_needs_recheck_definer.sql`, `20261006_audit_payment_methods.sql`, `20261007_shop_payment_public.sql`, `20261008_block_own_review_reports.sql`, `20261013_shop_status_enum_hidden.sql`, `20261013_shop_status_hidden.sql`, `20261026_delete_admin_shop.sql`, `20261026_shop_checkin_stats.sql`, and `20261026_shop_busyness_cooldown_lock.sql`. The check-in file adds privacy-safe 30-day counts from busyness reports for cafe detail and the admin dashboard. The cooldown lock serializes a user and cafe so two taps in the same moment cannot both pass the 30-minute check. Run the hidden-status enum file as its own query before the follow-up so `hidden` can be used. Admin-created cafes and CSV imports start hidden; owner submissions stay pending. Admins publish and unpublish with approved ↔ hidden. Admins delete cafes from `/admin/cafes` after a confirmation; `delete_admin_shop` is admin-only and returns unused logo, banner, and audit-photo keys for R2 cleanup. Optional sample: `db/seed_hidden_cafe.sql`. The role files add `cafe-owner` and `auditor` to the live `user_role` enum; run each as its own query so later files can use the new labels. If `user_role` does not exist, skip those enum files. The Philippines file lets public cafe submissions be pinned anywhere in the country. The owners file adds the `cafe-owner` role, OSM provenance columns, and admin-reviewed cafe claims. The portal migration adds audit logging, approved cafe creation, placements RPC, ad campaigns, and role changes. The amenity files add append-only team audits, seed reports, and `shop_amenity_resolutions_public`. The payment files add QR, card, and cash on team visits and `shop_payment_public` for cafe cards and detail. The fix file casts shop status to the live `shop_status` enum and creates `content_reports` if that table is missing. `20261008_block_own_review_reports.sql` stops a signed-in user from reporting a review they wrote. Deploy the Edge Functions from `db/functions/` (`presign-upload` and `admin-users`) so banner and audit-photo uploads, unused asset deletes after a cafe is removed, and user suspend/reactivate work. Deploy `admin-users` with `--no-verify-jwt` (auth is checked inside the function); include `db/functions/admin-users/config.toml` when copying into `supabase/functions`. Optional RLS checks live in `db/verify/admin_portal_rls.sql` and `db/verify/amenity_source_of_truth.sql`. In Supabase Auth, allow redirects to `/confirm` and `/reset-password` on each origin you use. Mobile builds store the session in local storage (`NUXT_PUBLIC_AUTH_STORAGE=local` via `bun run build:mobile`) because Capacitor WebViews do not keep the web cookie session. Founder amenity lists import as `reported` via `bun run import:amenities -- --file=... --dry-run`, then the admin RPC `import_cafe_amenity_reports`. The importer does not write reviews.

Cafe catalog imports come from OpenStreetMap Overpass (`amenity=cafe`) for Metro Manila, Cebu City, and Davao City. Run `bun run import:osm` to write `db/seed_osm_cafes.sql`, then apply that file in the SQL editor. The importer queries city bounding boxes in tiles, caches them in `.cache/osm-import/`, waits between tiles, and fails over across Overpass mirrors. Re-run the same command after a 429 or 504 — finished tiles are reused. If the public API is saturated, wait a minute and run it again. Rows start as pending and go through `/admin/requests`. Place data is © OpenStreetMap contributors (ODbL). The importer does not invent Wi-Fi, plugs, photos, or logos. Cafe owners claim a listed shop from its page; admins verify claims at `/admin/claims`. Verified owners can edit identity, hours, contact, and logo only.

## Development

```bash
bun dev
```

## Build and preview

```bash
bun run build
bun run preview
```

## Ionic + shadcn-vue notes

- Ionic is the primary app container (`IonApp` + `IonRouterOutlet`) and each page uses Ionic page primitives.
- shadcn-vue foundation is configured through `shadcn-nuxt` with UI components in `/home/runner/work/kapedoko-fe/kapedoko-fe/app/components/ui`.
- Tailwind config lives in `/home/runner/work/kapedoko-fe/kapedoko-fe/tailwind.config.ts`.
- CSS layering is explicit: Tailwind tokens/utilities first, then Ionic CSS (`app/assets/css/ionic.css`).

## Capacitor workflows

Generate a static web build for Capacitor:

```bash
bun run build:mobile
```

Sync web assets and plugins:

```bash
bun run cap:sync
```

Open native projects:

```bash
bun run cap:android
bun run cap:ios
```

## Platform prerequisites

- Android: Android Studio + Android SDK.
- iOS: macOS with Xcode and CocoaPods.
