---
name: KapeDoko
description: Specialty coffee bag labels on a cool off-white shelf — ink, teal brand, orange accent for actions.
colors:
  primary-teal: "#1F6F6B"
  accent-orange: "#D9793B"
  shelf-field: "#F2F2F2"
  matte-stock: "#FAF8F5"
  ink: "#1c1917"
  brick-closed: "#8c3a2f"
  white: "#ffffff"
typography:
  display:
    fontFamily: "'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.325rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.7875rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: "'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  label: "16px"
  logo: "8px"
  none: "0"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  gutter: "20px"
  stack: "12px"
  tabbar: "72px"
components:
  button-print:
    backgroundColor: "{colors.accent-orange}"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
    padding: "0 16px"
    height: "44px"
  button-print-active:
    backgroundColor: "{colors.accent-orange}"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
    padding: "0 16px"
    height: "44px"
  chip-filter:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
    padding: "0 12px"
    height: "44px"
  chip-filter-active:
    backgroundColor: "{colors.accent-orange}"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
    padding: "0 12px"
    height: "44px"
  input-search:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "46px"
  bag-label:
    backgroundColor: "{colors.matte-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.label}"
    padding: "16px 40px 12px 16px"
  nav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "44px"
  nav-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.primary-teal}"
    rounded: "{rounded.none}"
    height: "44px"
---

# Design System: KapeDoko

## Overview

**Creative North Star: "Coffee Bag Label"**

KapeDoko reads like specialty coffee packaging laid on a cool off-white shelf: dark ink for reading, teal for brand chrome, and orange for actions and highlights. The product name stays **kapé DOKO** / **KapeDoko**. Home is a stack of bag labels — shop name with an optional logo slot, a small Closed line when closed, origin, then Hours / WiFi / Outlets as icon-plus-words — not photo cards, not a route plate, not a dashboard of chips and stars.

Density is quiet and vertical. Shelf, header, filters, and the bottom menu sit on flat cool field `#F2F2F2`. Each bag-label face (and partner cards) uses a flat warm white `#FAF8F5` inside the hairline border — no stipple or shipping-tooth texture. Depth comes from that bordered flat face and ink rules, not lift shadows or textured panels. Map, Saved, and Profile keep their own layouts but inherit this palette and type.

Rejected by this system: warm enamel as the full-page field, Satoshi or condensed all-caps UI faces, floating elevated cards, icon-only bottom navigation without words, and a "Review WiFi and outlets" control on the bag label. Do not use orange as small body text on stock (≈2.8:1) — put ink on orange fills instead.

**Key Characteristics:**
- Cool shelf field `#F2F2F2`; flat warm-white label faces `#FAF8F5`
- Teal brand chrome, orange action accent, ink reading
- Kumbh Sans only — variable Google Font, regular and bold, sentence case
- Bag labels: 16px corners, logo slot left of name, Closed in brick under the name, facts as icon plus words
- Menu is Lucide icon plus word; an orange mark slides to the active tab; active label is teal

## Colors

Reading stays ink on the field or stock. Teal owns brand chrome; orange owns fills, ratings, amenity icons, and selected highlights.

### Primary
- **Teal** (#1F6F6B): Brand primary — `--kd-primary` / HSL `--primary`. Focus rings, links, active tab labels, caret, partner badges, outline retries. Brand chrome, not button fills.

### Accent
- **Orange** (#D9793B): `--kd-accent` / HSL `--secondary`. Button fills, active filter chips, tab indicator mark, save heart and save-fill strip, amenity icons beside Hours / WiFi / Outlets, text selection. On orange fills use ink `#1c1917` (≈5.6:1) — cream on orange fails AA (~2.8:1). Never use orange as small text on stock.

### Neutral
- **Shelf Field** (#F2F2F2): Flat Home chrome, shelf, filters hinterland, and tab bar. Cool 5% off-white; not warm enamel.
- **Matte Stock** (#FAF8F5): Flat bag-label face and partner card fill. Not the page field; not the old yellow enamel; no tooth/stipple texture.
- **Ink** (#1c1917): Primary reading color — cafe names, origin, fact keys and values, inactive tabs, inactive chip text, body copy, and the default hairline border mix. Do not recolor cafe names or the page to teal.
- **White** (#ffffff): Skeleton shimmer; pure white is optional for label faces but warm white `#FAF8F5` is the default.
- **Brick Closed** (#8c3a2f): One "Closed" line under the cafe name on bag labels; also destructive / error elsewhere. Not a second brand accent for chrome.

### Named Rules
**The Stock Reading Rule.** Body copy and cafe names stay ink `#1c1917`. Teal and orange are roles, not a whole-page tint.

**The Accent Contrast Rule.** Orange is for fills, marks, and amenity icons. Put ink on orange fills. Do not put orange text on cream stock.

**The Shelf Field Rule.** Shelf, header, filters hinterland, and the bottom menu sit on flat `#F2F2F2`. Bag-label faces use flat warm white `#FAF8F5` — no `bag-stock.png` tile, no stipple. Do not paint texture across chrome.

## Typography

**Display Font:** Kumbh Sans (Google Fonts variable 100–900; system sans fallback)
**Body Font:** Kumbh Sans (same family)

**Character:** One quiet geometric sans for the whole UI. Weight and size carry hierarchy; case stays natural (title case / sentence case). The brand lockup is the raster wordmark; UI type does not imitate condensed packing stamps. Satoshi remains in unused `@font-face` leftovers and is not part of this system.

### Hierarchy
- **Display** (700, 1.325rem, line-height 1.05, tracking −0.03em): Cafe name on each bag label.
- **Title** (700, ~0.95–1.05rem): Search field text, Add a cafe, partner names, and other primary interactive copy.
- **Body** (400–700, 0.7875–0.85rem, line-height 1.3): Fact values (bold), fact keys, general reading.
- **Label** (400–700, 0.6875–0.75rem): Filter chips, state line, Closed, origin, tab words, greeting name.

### Named Rules
**The Kumbh Sans-Only Rule.** UI type is Kumbh Sans regular or bold. Do not introduce Satoshi, condensed caps faces, serif display for body UI, or a second UI family.

**The Words-With-Icons Rule.** Hours, WiFi, outlets, and distance keep readable words; Lucide icons (~15px, orange) sit beside the keys. Closed stays a small brick text line under the name. The bottom menu pairs each Lucide icon with its word — never icon-only destinations.

## Layout

Phone-first vertical shelf. Horizontal gutter is 20px. Labels stack with 12px between bags. Header chrome is at least 72px tall including safe area; the bottom menu is 72px plus safe-area inset. Size classes, not device names: compact (`< 600px`, phone and folded cover) keeps one column and the bottom menu; medium (`600–839px`, unfolded fold) and expanded (`≥ 840px`, desktop) move that menu into an 80px left rail and pack bag labels two across (three from `1200px`). Reading surfaces (auth, profile, review, submit) stay a readable column (`~36rem`), not a stretched phone mock. Map on compact keeps bottom sheets; on medium+ the nearby list and cafe/event detail dock as a side pane. Home, Search, and Saved do the same: a cafe or event tap opens that pane on the right; compact still opens the page. On medium+ the pane is resizable from the left spine, from 280px up to half the viewport. Dual-screen spanning leaves the hinge empty.

Home chrome puts a time-of-day greeting (and optional first name) on the left and the kapé DOKO wordmark on the right. Search sits under that row as a full-width underline field. When any cafe has `markerTier === 'partner'`, a partner placement sits between search and filters; otherwise that slot is hidden. Filters are a single horizontal scroll of printed tags. Compact lists one column of bag labels; wider sizes keep the same labels in a grid. Infinite scroll appends more labels without changing density.

### Named Rules
**The Shelf Rule.** Home is greeting + wordmark → search → optional partner placement → filters → bag labels. Do not introduce photo grids or map-first chrome. Compact stays one column; medium and expanded may sit labels side by side as the same bag, never as a different card type.

## Elevation & Depth

Flat print. No ambient drop shadows on labels, chips, or the tab bar. Presence comes from the flat label face, 1px ink-mix borders, and occasional inset press marks on active controls. Focus is a 2px teal outline, not a glow.

Motion is short paper behavior: labels settle in (~460ms ease-out), fact blocks reprint with a vertical clip (~520ms), filter list swaps fade/slide 8px (~220ms), saving fills the right heart strip (~280ms), and the bottom menu’s orange active mark slides to the selected tab (~220ms) with a short stamp press on tap. On medium+ a cafe or event tap reprints a detail sheet from the right spine of the shelf (~480ms clip, then the white face prints ~520ms) and dismiss clips it back faster (~280ms). Respect `prefers-reduced-motion: reduce` by removing spatial motion (no mark slide, no press translate, no pane clip) while keeping active color/weight, saved/unsaved state, and a short fade for the pane.

### Named Rules
**The Flat Print Rule.** No floating card shadows. Depth is border + flat label face only.

## Shapes

Clearly rounded label corners (16px radius) on bags, filter tags, partner cards, and filled actions — soft enough to read as rounded, not nearly square, and not pills. Logo slot uses a tighter 8px corner. Search is a bottom rule, not a rounded field. Borders are 1px ink at roughly 12–34% opacity, or solid accent/teal when selected/active. No pills (`rounded-full`), no soft white panels.

### Named Rules
**The Label Corner Rule.** Interactive print pieces use 16px corners or a straight underline — not nearly-square corners or pill chips. Logo slots use 8px.

## Components

### Buttons
- **Filled (primary action):** Orange `#D9793B` fill, ink text, 16px corners, min-height 44px (Add a cafe).
- **Outline retry:** Teal text and border on the shelf field.
- **Active / press:** Inset shadow mixing ink — a stamp press, not a lift.
- **Focus:** 2px teal outline with small offset.

### Chips
- **Style:** Printed filter tags — transparent fill, 1px ink-mix border (~22%), 16px radius, 44px tall, 0.75rem Kumbh Sans, Lucide icon + word.
- **Active:** Orange fill, ink text, bold weight, matching border.
- **State:** Horizontal scroll; one active filter at a time.

### Cards / Containers — Bag Label
- **Corner Style:** 16px
- **Background:** Flat warm white `#FAF8F5` (no tooth/stipple texture)
- **Border:** 1px ink at ~34% opacity; selected uses solid teal
- **Mast:** 40×40 logo slot (8px radius, same flat fill) left of the name — empty unless a real cafe logo exists (never the KapeDoko mark as a stand-in)
- **Internal structure:** Large ink name → optional Closed in brick `#8c3a2f` → origin → Hours / WiFi / Outlets (and Distance when known) as icon-plus-words; full-height right save spine with orange heart and orange fill when saved
- **No review control:** Do not add a "Review WiFi and outlets" link on the label
- **Shadow Strategy:** None at rest; settle + reprint motion on enter/filter change

### Inputs / Fields
- **Search:** Transparent field under a 1px ink-mix bottom rule; 46px tall; bold ink text (~0.95rem); muted ink placeholder; teal caret; focus thickens the underline to teal.
- **Focus:** No glow ring on search; outline buttons and chips use the 2px teal focus outline.

### Navigation
- **Style:** Four destinations — Home, Saved, Map, Profile — each a Lucide icon stacked above its word on flat shelf field `#F2F2F2`. Compact uses a light top hairline; the rail uses a light trailing hairline. A 2px orange (`--kd-accent` / `#D9793B`) mark sits on the active item and slides when the selection changes.
- **Default:** Ink icon + regular ~0.6875rem word; 44px hit targets.
- **Active:** Teal icon and bold word; orange mark on that item. Short stamp press on tap. No filled tab plates.
- **Placement:** Compact docks the menu to the bottom (Home / Saved / Profile). Medium and expanded use an 80px left rail on every `/app` route except onboarding.

### Wordmark
Raster lockup (`kapedoko-horizontal-text_dark.png`) at roughly 120×26 on the right of Home chrome, beside the greeting. Do not replace the product name or invent a second wordmark style in UI type.

### Partner Placement
Shown when any cafe has `markerTier === 'promoted'` or `markerTier === 'partner'`; hidden when neither exists. A horizontal snap track sits between search and filters. Order is sponsored first (`promoted`, from active `shop_placements.kind = 'sponsored'`), then partners. Each card is a placement insert on matte stock `#FAF8F5`: a shared coffee-cup placeholder creative on the left whose ground color comes from CSS (orange `#D9793B` for sponsored, teal `#1F6F6B` for partner), a cream stamp on that creative (“Sponsored” in ink / “Partner” in teal), then the cafe name in ink and the address under it. When more than one placement is showing, `1 of N` counts the whole strip order. Bag labels under the filters stay without photos.

## Do's and Don'ts

### Do:
- **Do** keep shelf field `#F2F2F2`, ink `#1c1917`, teal `#1F6F6B`, and orange `#D9793B` as the identity on shared chrome and Home.
- **Do** put ink on orange fills; use teal for focus, active tab labels, and brand chrome.
- **Do** keep bag-label faces flat `#FAF8F5` with no stipple; keep shelf and menu flat `#F2F2F2`.
- **Do** set UI type in Kumbh Sans (400/700) and keep cafe facts as icon-plus-words.
- **Do** treat each cafe as a bag label: logo slot, name, Closed when closed (brick), origin, then Hours / WiFi / Outlets.
- **Do** pair each menu destination with a Lucide icon and word; mark the active tab with an orange indicator and teal label.
- **Do** show partner placement only between search and filters when `markerTier === 'partner'`.

### Don't:
- **Don't** use orange as small text on cream stock (~2.8:1).
- **Don't** recolor the whole page or cafe names to teal — body reading stays ink.
- **Don't** use warm enamel `#f6f1e8` as the page field or bag-label face — labels use flat `#FAF8F5`.
- **Don't** revive Satoshi, condensed all-caps UI faces, white elevated cards, or the jeepney plate composition.
- **Don't** ship icon-only menu destinations or replace amenity facts with icon-only rows.
- **Don't** add a "Review WiFi and outlets" control on bag labels.
- **Don't** fill the logo slot with the KapeDoko mark or invent logos.
- **Don't** add drop shadows or pill chips to this identity.
- **Don't** rename the product away from kapé DOKO / KapeDoko.
- **Don't** bring back the bag-stock tooth/stipple on labels, shelf, header, or bottom menu.
- **Don't** invent prices, ratings, or coverage claims as design system content.
