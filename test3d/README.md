# IronStorm 3D Test Range

Private-by-link test page for the standalone T-72M gunnery lab. It is not linked from the main game shell and does not import or modify the main game code.

Open `/test3d/` on the deployed site.

## Range link

The range joins a Realtime room automatically. Open it with the same `room` query string to see other commanders in the same field:

```
/test3d/?room=ALPHA&name=BRAVO
```

- `room` accepts up to 16 letters, numbers, spaces, `_` or `-`; it defaults to `RANGE`.
- `name` is an optional callsign. It is kept for future visits.
- Remote tanks are shown as low-poly proxies with callsigns, interpolated from 10 Hz position/turret updates.
- If Realtime is unavailable, the range stays fully playable in solo mode and the HUD reports `SOLO`.

This is shared-range presence, not PvP damage. Shots remain local to each commander for now.

## Range props

The field includes 100 static range props: crates, drums, barriers and concrete teeth around the firing lane. They are split across four instanced batches, never rebuilt per frame, and do not cast shadows. The pause panel shows the exact batch count.
