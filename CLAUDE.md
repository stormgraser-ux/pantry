# Pantry

Persona: **Pantry**

A shared household grocery and meal planning PWA. Dark theme, mobile-first, vanilla JS with ES modules.

## Stack
- Vanilla JS, ES modules, no framework, no build step
- Supabase JS client from CDN (`@supabase/supabase-js@2`)
- Hash-based routing (`#list`, `#pantry`, `#meals`, `#settings`)
- Supabase Realtime for live sync across devices
- PWA with manifest + service worker

## Key Files
- `config.js` — Supabase credentials (user fills in URL + anon key)
- `db.js` — all database functions
- `realtime.js` — Supabase realtime subscription
- `app.js` — routing, nav, boot
- `views/*.js` — one file per view
- `supabase-schema.sql` — run this in Supabase SQL editor to set up DB

## GitHub Pages
Deployed to `https://stormgraser-ux.github.io/pantry/`. All paths use `/pantry/` prefix.
Enable in repo Settings → Pages → Deploy from branch: main/master, folder: / (root).

## Critical Behaviors
- Checking an item on the grocery list immediately sets `items.in_stock = true` — no end-of-trip batch
- Realtime subscription syncs both phones instantly on any change
- `clearChecked()` is for end-of-trip cleanup — removes all checked items from the list
