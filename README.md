# IronStorm

A browser-based multiplayer tank arena — account creation, persistent progression,
garage, upgrades, global leaderboards and a realtime shared battlefield.

![game](assets/ui/favicon.svg)

## Run it

```bash
node server.mjs      # http://localhost:5173
```

The site is plain HTML/CSS/JS modules — no build step. Serve it over HTTP
(`file://` blocks ES modules and the Supabase client).

## What is in the game

- **Accounts** — callsign + password via Supabase Auth (password is never stored
  client-side; Supabase hashes it). Guests get a local profile saved on the device.
- **Main menu** — callsign plate, credits, upgrades / garage / leaderboards /
  gameplay rail, live 3D-ish turret preview of the equipped tank, PLAY.
- **Arena** — 2600 × 2600 battlefield, destructible crates, explosive barrels,
  cover, oil spills, power-ups, respawns, kill feed, chat, minimap, directional
  turret aiming, dash, particles, screen shake, procedural audio.
- **Progression** — credits + XP from every battle, 40 upgrade levels across five
  upgrade lines, six unlockable tanks from M4 Sherman to Maus.
- **Multiplayer** — Supabase Realtime broadcast + presence. Everyone in the world
  joins the same arena channel; remote tanks are interpolated at 10 Hz.
  Practice bots keep the map busy.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | drive the hull |
| mouse | traverse the turret |
| `LMB` | fire |
| `SHIFT` | emergency dash |
| `TAB` | full scoreboard |
| `ENTER` | chat |
| `ESC` | pause / leave |

## Backend

Project `tooaxcbdajbhkqzbwoae` (`eu-north-1`).

- `supabase/schema.sql` — tables, RLS policies, RPCs, leaderboard view.
- All mutations go through security-definer RPCs (`record_match`, `buy_upgrade`,
  `buy_tank`, `equip_tank`) so rewards and prices are decided server-side.
  `profiles` is read-only to clients except `last_seen`.
- Email confirmation is disabled on the project so callsign signup works
  instantly; emails are synthetic (`<callsign>@ironstorm.gg`).

The anon key in `js/config.js` is public by design — RLS enforces access.

## Layout

```
index.html            app shell: auth, menu, HUD
styles/               menu.css, game.css
js/config.js          supabase url/key + tuning
js/assets.js          sprite preloader
js/audio.js           synthesised SFX + ambient loop
js/store.js           guest save / account profile
js/net.js             auth, persistence, realtime arena
js/tanks.js           vehicle catalogue + upgrade maths
js/game.js            simulation + renderer + HUD
js/menu.js            menus, panes, report, auth UI
js/app.js             bootstrap + screen routing
assets/               Kenney top-down tank sprites (CC0)
supabase/schema.sql   database schema
server.mjs            dev static server
```

Artwork: Kenney "Top-down Tanks Remastered" (CC0).
