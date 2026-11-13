# IronStorm

**Play online:** https://opencodepers.github.io/ironstorm/

A browser-based multiplayer tank arena — account creation, persistent progression,
garage, upgrades, global leaderboards and a realtime shared battlefield.

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

## Warzones

| Mode | Objective |
| --- | --- |
| Deathmatch | Free-for-all, first to 25 kills |
| Team Battle | Green vs Red, first to 60 team kills |
| King of the Hill | Hold the central zone, first to 100 points |
| Survival | Three lives against endless escalating waves |

The selected warzone carries from the landing page into the arena, and weather
(clear / rain / fog / dusk) is rolled per match.

## Shop and progression

- 12 vehicles from the M4 Sherman to the KV-2, each with its own handling model.
- 8 camouflage patterns applied as canvas filters, so any camo fits any hull.
- Daily supply crate every 20 hours, priced and granted server-side.
- Five upgrade lines, 25 levels, credits and XP for every battle.

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

## Combat feedback, contracts and promotions

- **Kill cam** — the last 1.5 s of engagements is buffered during a match and replayed as a slowed
  one-shot cinematic with a letterbox, progress bar and replay/skip controls inside the battle report.
- **Daily contracts** — three objectives roll over every UTC day (destroy 8 in the featured warzone,
  win 2, finish 4). Complete one and claim it from the shop's supply tab. Guests track locally;
  signed-in players are validated by `claim_contract` on the server.
- **Streak rewards** — every third kill escalates the announcer, fires a screen tint and raises the
  combo multiplier shown in the HUD.
- **Hit markers** — punchy cross markers plus an audio pitch that climbs with each consecutive hit.
- **Rank-up cinematic** — crossing a level threshold plays a promotion overlay with the new insignia
  and resets the supply crate via `unlock_rank_crate`.
- **Pickup magnet** — crates and power-ups curve toward a nearby tank, leaving a short trail.

## Deploy cinematic, unlock paths, squads and spectating

- **Deploy cinematic** — every match opens with a 3.1 s deploy sequence: letterbox bars, the warzone
  name, map and weather, and a progress line before the HUD fades in. The match clock starts when the
  cinematic ends, and it is skipped entirely when the player prefers reduced motion.
- **Unlock paths** — the garage opens with a next-requisition banner for the nearest locked vehicle
  and camo, and every locked card shows an XP bar with the exact XP needed for its level. The shop
  shows the same distance on each locked vehicle.
- **Squad codes** — the SQUAD pane issues a four-character code with copy-invite-link, join-by-code
  and a recent-squadmates list. `?squad=ABCD` joins automatically, and squadmates carry a ◆ over
  their hull in the live arena. Codes are shared out of band; the arena is still one global battle.
- **Spectating** — when your vehicle is destroyed the camera follows a living tank with a SPECTATING
  bar, and A/D cycles targets until you redeploy.
