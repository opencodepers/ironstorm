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
js/rooms.js           room naming, capacity, mutators, rule sets
js/maps.js            four authored map presets
js/progress.js        career ledger, salvage, medal unlocking
js/medals.js          24 achievement definitions
js/cosmetics.js       emblems, shell trails, kill effects
js/season.js          weekly season clock and rank tiers
js/social.js          friends list and invite links
js/touch.js           virtual stick, fire/dash, touch aiming
sw.js                 offline shell service worker
manifest.webmanifest  installable PWA manifest
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

## Servers, rooms and quickplay

- **Named rooms** — every match runs on its own realtime channel keyed by warzone and server name
  (`ironstorm-arena-v1:deathmatch:raid-night`), so two players who type the same name land in the
  same battle. The server name appears in the deploy cinematic, the HUD mode bar and the report.
- **Server browser** — the SERVERS pane lists the default room for the selected warzone plus every
  live room with its occupancy (`3/12`), and joins any row directly.
- **Quickplay** — PLAY joins the busiest room of the selected warzone that still has a slot, falling
  back to `ALPHA`. Play Again returns to the same server.
- **Join by name** — typing a name joins that live room in whatever warzone it runs in, or creates it
  in the selected warzone. Rooms hold 12 commanders; local bots still fill out the arena.
- **Directory** — occupancy is published over a presence channel (`ironstorm-directory-v1`) rather
  than Postgres, so rooms need no schema change and empty rooms simply disappear from the browser.

## Touch controls and the installable app

- **Touch controls** — on coarse pointers the arena mounts a left virtual stick, right fire and dash
  buttons, and tap/drag aiming on the right half of the screen. Optionally turn on aim assist in
  GAMEPLAY. Portrait phones get a rotate-to-landscape guard, and the HUD moves the minimap and health
  bar clear of your thumbs.
- **PWA** — `manifest.webmanifest` plus `sw.js` make the game installable from the browser with a
  home-screen icon and landscape standalone display.
- **Offline practice** — the service worker precaches the shell and caches sprites/styles as they are
  used, so after one visit the game boots and plays a local skirmish without a connection. Boot no
  longer fails when the Supabase catalogue or session request is unreachable.

## Maps, mutators and host controls

- **Four authored maps** — Ashford Ridge, Frozen Crossing, Dune Basin and Ash Harbour change the sand
  mix, clutter density and fixed landmarks. A room either rotates maps by server name or pins one.
- **Room mutators** — Standard, Rapid Fire, Armoured, Sniper and Chaos scale hull, damage, reload,
  shell speed and spread for everyone in the room.
- **Host controls** — the earliest commander in a room becomes host. The pause menu exposes mutator,
  map (next deploy), bot count, weather and score limit, and changes broadcast to every client over the
  room channel. Everyone sees the mutator in the HUD and deploy screen; only the host can edit it.

## Career, medals and salvage cosmetics

- **Career pane** — lifetime kills, deaths, K/D, wins, battles, best score, best streak and accuracy,
  plus a per-vehicle record and the last 20 battles with mode, map and accuracy. Signed-in players also
  see older rows from `match_history` in the command archive.
- **24 medals** — from First Blood to Iron Legend, tank and camo completion, max upgrades, per-warzone
  wins, wave 10, flawless and 80% accuracy. Each unlocks automatically and pays salvage.
- **Salvage economy** — every battle pays salvage, with medals paying bonuses. Spend it in the shop's
  SALVAGE tab on 17 cosmetics (8 hull emblems, 5 shell trails, 4 kill effects), all drawn on canvas.
  This gives commanders something to chase after every vehicle is requisitioned.
- **Weekly season** — kills, wins and battles earn season points (wins 120, kills 6, battles 10). The
  ladder resets Monday 00:00 UTC, keeps your best week, and maps points to Bronze → Diamond tiers.
  Lifetime tier glyphs sit beside every name on the global leaderboard.

## Friends, invites and quality of life

- **Friends pane** — add a callsign, see who is online and which server they are in, join them directly,
  and copy an invite link for a named server (`?room=NAME&mode=warzone`). Invite links drop straight into
  that server and carry your squad code.
- **Battlefield events** — random supply drops, a 30-second bounty on the kill leader (+300), and
  telegraph-then-impact artillery barrages break up long matches.
- **Smarter bots** — they prioritise wounded targets, break contact when crippled, look for nearby cover,
  and only take risky shots when retreating.
- **Accessibility** — colourblind team markers (shapes plus blue/orange), reduced screen flashes,
  optional aim assist, and rebindable drive/dash/chat/scoreboard keys. Settings persist locally.

Career, medals, salvage, cosmetics and friends are stored per commander on the device
(`ironstorm.local.v1:<uid>`), alongside squad codes. Rooms, mutators, presence and friends' online
status all run over Supabase Realtime and need no schema change.

## Training, command abilities and gamepad

- **Academy** — a three-drill tutorial (drive, fire/reload, dash into the zone) with no bots, no
  score and no rewards, plus a free-fire range with unlimited respawns and target dummies.
- **Command abilities** — kills and time earn command points. Spend 1/2/3 on a supply cache, a smoke
  screen or a five-shell artillery marker, from the HUD, the 1/2/3 keys, a gamepad or the touch bar.
- **Gamepad** — left stick drives, right stick aims, RT fires, A dashes, X/Y/B call abilities and Start
  pauses; rumble fires on dashes and abilities. Gamepads are detected on the next arena frame.
- **Bot skill and personalities** — hosts choose Recruit, Regular or Veteran and bots cycle through
  aggressive, cautious and objective-driven behaviour.

## Map Lab, ranked, theater and dog tags

- **Map Lab** — place ten prop types on a 10x10 grid, pick a theme, then copy a self-contained code.
  Test a layout in the range, host it as a real server (the code rides the room rules), save it
  locally or load someone else's code.
- **Ranked** — local MMR with five placements, monthly soft reset, Bronze→Diamond ratings and a
  result delta on the battle report. Matchmaking uses veteran bots; the ladder is per device because
  the command database cannot accept a new table.
- **Theater** — every battle is sampled into ~5 fps snapshots. The last recording plays back with a
  draggable, zoomable free camera, scrubber, pause and speed controls (session-scoped).
- **Dog tag** — renders a shareable 900x500 PNG with callsign, tier, K/D, accuracy, best streak,
  favourite vehicle and top medals.
- **Leaderboard filters** — all-time, live weekly (online commanders), friends-only and a personal
  per-vehicle record. Global weekly/vehicle boards need tables the anon key cannot create.

## Accessibility and languages

- **Second accessibility pass** — text scaling (three sizes), high-contrast HUD and team colours,
  an explicit screen-shake toggle, and a one-handed touch layout that moves fire and abilities beside
  the stick.
- **Localization** — English, Spanish, French and Arabic string tables for the command shell, rail,
  settings, training and new panes, with automatic RTL layout for Arabic. Untranslated dynamic copy
  falls back to English.
- **Season rewards** — each weekly tier pays one-time salvage, Gold/Platinum/Diamond add a cosmetic,
  and the best week is paid out when the ladder rolls over.
