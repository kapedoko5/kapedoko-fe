# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary users are people in the Philippines, especially Metro Manila, Cebu, and Davao, who need a cafe to sit and work. They open the app to find a place with WiFi, power outlets, and usable open hours—not to browse coffee as a hobby. The web landing leads with that Deskless Worker job. It may acknowledge search-by-name and nearby shops or events for people who already know a shop or are deciding with others. It must not claim vibe, pet, parking, or bean-grade filters. Cafe owners claim a listed shop and keep hours, contact, and the logo accurate after an admin verifies them. Admins approve listings and ownership claims.

## Product Purpose

KapeDoko helps someone choose a coffee shop they can actually work from: search and scan nearby cafes, see WiFi and outlet availability, check hours, and get to the exact location. Success is picking a cafe with confidence and arriving without discovering too late that there is no WiFi, no plug, or that the shop is closed.

## Positioning

KapeDoko is a Philippines-specific cafe guide whose job is work-readiness, not generic discovery. A maps app or worldwide cafe directory could list shops; it could not truthfully claim local coverage plus WiFi, outlets, and hours as the reason to choose one cafe over another.

## Operating Context

Used on a phone, often while already out or about to leave: search a shop by name or area, filter by Near You / Popular / WiFi / Plugs, scan a list of cards (photo, rating, open/closed, address, amenity icons), and use maps for the exact location. Cafe submissions can be pinned anywhere in the Philippines. Pins outside the country are blocked. First-run onboarding teaches the WiFi and plug icons, then maps. A bottom bar opens Home, saved cafes, Map, and Profile. Accounts use Supabase email and password on every platform, and Google Sign-In on the website, including registration, password reset, and sign-out. Native Capacitor shells stay email and password. Guests can browse and save cafes on the device; signing in syncs those saves to the account. The same UI ships as a web app and as Capacitor iOS/Android shells.

## Capabilities and Constraints

- Confirmed in product intent: cafe search, amenity-aware listing (WiFi, power outlets), open/closed status, filters, maps for location, saved cafes, profile, first-run onboarding, admin-posted community events.
- Events are standalone pins (not tied to a listed cafe). Admins set gathering hours and a separate display window. Home shows a nearby event card only within 5 km of a real GPS fix; Map shows live events as teal pins.
- One shared UI across web and Capacitor iOS/Android. Do not split into separate iOS vs Android design languages.
- Public cafe submissions cover the Philippines. Pins outside the country stay blocked.
- Admins can still publish a cafe anywhere, including outside the Philippines.
- Catalog seed data for Metro Manila, Cebu City, and Davao City may be imported from OpenStreetMap as pending shops. Admins approve them. Place data is © OpenStreetMap contributors (ODbL). The importer does not invent Wi-Fi, plugs, photos, or logos.
- A signed-in person can claim a listed cafe. An admin verifies the claim before the account becomes a cafe owner for that shop. Verified owners can edit identity, hours, contact, and logo only — never publish status, ads, or other cafes.
- Home and Search list approved shops. WiFi and outlet claims appear only after enough reviews; until then the app says they are not confirmed. Do not treat sample shop names, ratings, or stock images as real product evidence.
- Auth implementation (Supabase) is present in the repo; keeping that vendor is not a confirmed product commitment.
- Push notifications are not part of the current app. Featured placements are later work and are not shown as live cafes.

## Brand Commitments

Name is **KapeDoko**, also styled **kapé DOKO**. Do not invent a different product name. The standing visual preference is a clean coffee-shop identity. The first proof is a specialty bag label on Home and the shared header and menu: matte stock, ink, one coffee brown, facts in words.

## Evidence on Hand

Brand assets live under `public/assets/` and `app/assets/css/logos/`. Onboarding copy and home UI copy are real product language. Cafe listings, ratings, and photography currently in the home screen are mock. Do not fabricate testimonials, press, real cafe coverage claims, or user counts.

## Product Principles

- Choose a cafe to work, not to window-shop coffee.
- Amenity truth (WiFi, outlets, hours, location) outranks atmosphere copy.
- Stay in the Philippines: public submissions cover the country, and pins outside it stay blocked.
- Treat placeholder data as scaffolding; never present it as proof.
- Ship one interface people can learn once, on phone or in a native wrapper.

## Accessibility & Inclusion

Aim for WCAG 2.2 AA. Respect reduced motion. Keep amenity and status information available as text or accessible names, not icons alone.
