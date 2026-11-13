---
version: 1
slug: "app-pages-admin-cafes-id-vue"
primary_target: "app/pages/admin/cafes/[id].vue"
related_targets: ["app/components/admin/AdminCafeForm.vue","app/composables/useAdminPortal.ts"]
---

## Scope and visitor mode

Operate. Admin cafe edit already publishes identity, hours, pin, logo, and listing status. This pass puts the in-cafe poster and featured photos on that same page so an admin can update or take them down without leaving the listing.

## Audience, job, action, constraints

KapeDoko admins at a desk. See the live poster and up to eight featured photos for this cafe, replace them, or delete them. Home banners stay on Admin Ads. Bag-label admin cafe editor stays. No new identity.

## Direction and memorable moment

The poster is a print plate on this cafe’s bag. Featured photos are the bag’s extra stamps. Take down clips the plate off; Remove peels a stamp. Save reprints what remains.

## Unresolved decisions

None. Media lives on cafe edit only. New-cafe create stays without media until the listing exists.

## Direction contract

THESIS: Cafe edit is the listing bag, now with the poster plate and featured stamps on it, refusing a second Ads scheduler and a nested media wizard.

OWN-WORLD: Shelf #F2F2F2, stock #FAF8F5, ink #1c1917, teal chrome, orange action fills. Kumbh Sans. 16px label corners, hairline borders, no lift shadows.

STORY: The admin opens a cafe, sees the poster and photos under the pin, replaces or takes them down, and saves.

FIRST VIEWPORT: Same cafe editor. Below identity and address, a spanning stock panel: In-cafe poster with plate, file, Take down; Featured photos with grid, Remove, Add photos, n of 8. Orange Save changes.

FORM: Admin cafe editor extension, code-led. Signature interaction: Take down clips the live plate immediately; photo Remove plus Save reprints the gallery.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
