# Changelog

All notable changes to WorldView. Versions follow `<Version>` in `WorldView/WorldView.csproj`.

## [1.0.231] - 2026-11-04
### Removed
- Dead code: `getGpu` export and write-only `lastDetect` (worldview.js), unused radio `Codec`/`Bitrate` fields (WorldConsole.razor + payload), unused `info.shrink` text, unused `.radio-count` CSS.

## [1.0.230] - 2026-11-04
### Changed
- Satellites/telescopes: 1.0.229 undone, navigation is free again after the first positioning.
### Fixed
- First positioning: the target–Earth angle now fits the view (at most 26°, smaller on a flat landscape screen); on a phone in landscape the Earth was outside the picture (Chandra, JWST).

## [1.0.229] - 2026-11-04
### Changed
- Satellites/telescopes: also while you steer the camera, the Earth stays in view (its edge within 10° of the screen centre); the camera turns around the object only as far as needed.

## [1.0.228] - 2026-11-04
### Fixed
- Flashing lines close to a selected telescope/satellite on a high orbit (Chandra, XMM, GEO): its orbit ring slid ~10 km/s away from the object between the one-second redraws; the ring now turns with the Earth every frame.

## [1.0.227] - 2026-11-04
### Changed
- Orbit names: an arrow pointing at the orbit line instead of a dot; arrow and name stay fully inside the view.

## [1.0.226] - 2026-11-04
### Added
- Detection on: the name of a telescope (and the ISS) is shown along its orbit line while the object itself is off screen; clicking the name selects the object.

## [1.0.225] - 2026-11-04
### Fixed
- Telescopes (Fermi, Hubble, ...) no longer appear a second time in the satellite list: that copy lost its orbit line on deselect. They only live in the telescope layer, where the orbit stays visible.

## [1.0.224] - 2026-11-04
### Added
- Satellite and telescope lists: rows with a 3D model get a 🧊 icon, and a "3D model" filter button shows only those.

## [1.0.223] - 2026-11-04
### Changed
- Orbit fade only for the selected satellite/telescope; the other telescope rings stay fully visible.

## [1.0.222] - 2026-11-04
### Changed
- Selecting a satellite/telescope puts it in the screen centre (was aimed between target and Earth centre: target upper right); camera position unchanged, so the Earth still shows lower left.

## [1.0.221] - 2026-11-04
### Changed
- Orbit fade shorter close up: ~5 min of orbit visible (full for 1 min either side, gone after 2.5 min; was 200 km … 2000 km with a 5% floor); zoomed out the whole ring stays visible.

## [1.0.220] - 2026-11-04
### Changed
- Orbit lines of the selected satellite and of the space telescopes fade with distance to the camera (from 3× the camera-object distance, min 200 km, down to 5%): close up, the far side of the ring no longer shows as a sharp V (perspective of a ring seen edge-on); zoomed out the full ring stays visible. ISS dashed orbit unchanged.

## [1.0.219] - 2026-11-04
### Fixed
- Orbit lines still showed kinks close up: twice as many points (≤0.5° turn per vertex) and, near the camera, segments no longer than 1% of their distance to it, so the line stays smooth when zoomed in.

## [1.0.218] - 2026-11-04
### Fixed
- Orbit lines of eccentric/high orbits (INTEGRAL, XMM-Newton, Chandra, TESS) showed sharp corners: sampling is now uniform in eccentric anomaly (≤1.5° turn per vertex, also at perigee and apogee) instead of fixed time steps (21 min for INTEGRAL).
- 90° kink / spike at the object on high orbits: the real-Earth-rotation zone around the object is limited by the sideways shift it causes (LEO unchanged: 60 s / 15 min) and sampled densely; where Earth rotation outruns the object itself (INTEGRAL, XMM, Chandra, TESS near apogee) it is left out and the plain ring is drawn.

## [1.0.217] - 2026-11-04
### Changed
- Space telescopes take their TLE from the CelesTrak `science`/`visual` groups the satellite layer already loads; only telescopes not in those groups (TESS, INTEGRAL) are requested one by one. Cuts CelesTrak requests per load from 17 to 9 (CelesTrak blocks IPs that ask too often).
- Concurrent requests for the same CelesTrak group are shared instead of fetched twice.

## [1.0.216] - 2026-11-04
### Added
- 3D models (NASA 3D Resources, optimized to ≤0.5 MB each) for the telescopes Fermi, Swift and TESS, and for the Earth-observation satellites Landsat 8, Terra and ICESat-2.
- New `resource` satellite group (CelesTrak Earth Resources) so Landsat 8, Terra and ICESat-2 are tracked and listed; needs a live check that they actually appear in that group.
- Real-world model scale is approximate for the new models: NASA doesn't publish exact deployed dimensions for all of them (Fermi, TESS, Landsat 8, Terra are estimates from public figures; Swift and ICESat-2 are well-sourced).

## [1.0.215] - 2026-11-04
### Fixed
- L2 line still flickered between positions. Reproduced and tested live: a single straight segment from 85 m to 1.5 million km from the camera renders unreliably (the depth along it is interpolated between two wildly different ends). The line now has 50 points spaced geometrically from the telescope (100 m, 150 m, … 1.5 million km): steady in every captured frame.

## [1.0.214] - 2026-11-04
### Fixed
- L2 line invisible or jumping close to JWST. Checked live: the line was in view and in front of the camera, but the dash pattern breaks down when one end is 85 m and the other 1.5 million km away. Now a solid, semi-transparent line (and visible again close by; 1.0.213's hiding removed).

## [1.0.213] - 2026-11-04
### Fixed
- L2 line: back to ending at the telescope (1.0.212's shortened line collapsed to a dot from close by). It is now hidden within 50,000 km of the telescope: from there it runs past or behind the camera and its clipped end swung about; the 3D model shows the telescope anyway.

## [1.0.212] - 2026-11-04
### Fixed
- L2 line still swung about close to JWST (seen in a screen recording): a moved line is drawn about a frame late, ~2 km off at 110 km/s, and from 85 m away its end swung in all directions. The line now stops 2,000 km short of the telescope, where that lag is invisible.

## [1.0.211] - 2026-11-04
### Fixed
- L2 line jumped about (1.0.210's turned collection) and flickered (1.0.209). Now each L2 telescope has one line in its own small collection, created once and moved every frame; it is no longer removed and re-added every 30 s with the orbit rings.

## [1.0.210] - 2026-11-04
### Fixed
- L2 line flickered after 1.0.209 (rewritten every frame). The line now stays as drawn in its own collection, which is turned every frame from the drawn L2 direction to the current one (only a matrix changes).

## [1.0.209] - 2026-11-04
### Fixed
- JWST/Euclid: the dashed line to L2 was drawn every 30 s while the telescope moves ~110 km/s in the Earth-fixed frame, so the line drifted up to 3,000 km away from it. The line now moves with the telescope every frame.

## [1.0.208] - 2026-11-04
### Fixed
- View spun around when turning a tracked object until it lined up with the Earth: the composition (object upper right, Earth lower left) was forced every frame and flipped there. It now only sets the first view; once you turn or zoom (mouse or keys) the camera keeps looking at the object with your own "up", without snapping or flipping.

## [1.0.207] - 2026-11-04
### Fixed
- Arrow keys while tracking a satellite/telescope panned the globe (and stopped tracking), so the object vanished at once (at L2 a pan step is millions of km). Now arrow keys and the nav pad turn around the object, and +/- zoom towards it.

## [1.0.206] - 2026-11-04
### Fixed
- Rotating around a tracked satellite/telescope stopped halfway in one direction: Cesium keeps the camera from passing over the target's "pole" (its local up). Free rotation while tracking (restored afterwards). Also no breakdown when target and Earth line up exactly: the last screen layout is kept.

## [1.0.205] - 2026-11-04
### Fixed
- Orbit line still wobbled close up: the line consists of straight 0.5 s pieces (3.75 km), which bow 0.25 m from the true path; from 50 m the object swayed off its line twice a second. Within ±5 s of the object the line now has 0.05 s pieces (2.5 mm).

## [1.0.204] - 2026-11-04
### Fixed
- Orbit line of a tracked object wobbled: rings are re-aligned to the Earth's rotation, which moved the far part ~15 km at once every 10–30 s. The tracked object's ring (and the ISS ring while a satellite is tracked) is now re-aligned every second; the others stay at 30 s. Model heading uses the frame's clock time too.

## [1.0.203] - 2026-11-04
### Fixed
- Model and selection ring now and then drawn shifted for a frame: they were computed at different moments (the ring when Cesium updates entities, the model and camera later in the frame; at 7.5 km/s a few ms is metres). Everything for the tracked object now uses the frame's own clock time, also L2.

## [1.0.202] - 2026-11-04
### Fixed
- Docked craft listed separately (ISS (NAUKA), Soyuz, Progress, Dragon, …) were followed from 2,000 km while ISS (ZARYA) was followed close by. Any object within 2 km of a 3D model now gets that model's close-up distance.

## [1.0.201] - 2026-11-04
### Fixed
- ISS model stood on its edge (truss along the motion, modules pointing up). Now in flight attitude: modules along the motion, truss across it, the whole station flat over the Earth.

## [1.0.200] - 2026-11-04
### Fixed
- 3D models flickered light/dark (ISS, Hubble, …): Cesium's dynamic environment map is regenerated as a model moves (7.5 km/s), so its lighting kept changing. Turned off for the models.
- ISS model: removed the stray ball-shaped parts floating above the station; true proportions now (truss 109 m, modules 72 m).
- JWST model: variant B (deployed, no loose fragments around it), 0.37 MB instead of 2.3 MB.

## [1.0.199] - 2026-11-04
### Fixed
- Satellite list empty for a long time: the CelesTrak groups were fetched one after another (up to 20 s each). Now all at once, with the same caching as the telescopes (cache used at once up to a week, background refresh after 6 h, 10 s timeout, older cache as fallback).

## [1.0.198] - 2026-11-04
### Fixed
- Telescope list stayed empty for ~30 s: it waited for every CelesTrak request, and one that hung waited for the browser's own timeout. Now: L2 telescopes (JWST, Euclid) appear at once; cached orbits (up to a week old) are used straight away and refreshed in the background after 6 h; a download gives up after 8 s and falls back to an older cache; a second load during the download no longer adds telescopes twice.

## [1.0.197] - 2026-11-04
### Fixed
- 3D models flickered light/dark: the heading came from the frame-to-frame position change, which flipped when the position was written twice in one frame, so the model kept turning against the sunlight. Heading now from the orbit itself (position 1 s ahead).

## [1.0.196] - 2026-11-04
### Changed
- Hubble model back to the original with the aperture door closed (the opened door did not look right).

## [1.0.195] - 2026-11-04
### Fixed
- Hubble model: open aperture door no longer floats loose. Hinge moved slightly inside the rim so the door overlaps the tube (no background showing through); the dark interior no longer includes the door's square decal planes (the dark block above the tube).

## [1.0.194] - 2026-11-04
### Fixed
- Kink in orbit lines (Hubble, ISS, …): the exact piece around the object (real Earth rotation) joined the ring (fixed rotation) abruptly. Now blended smoothly over ±15 min, sampled half an orbit back and half ahead.
### Changed
- Hubble model: aperture door open (~105° about its hinge), with a dark interior; tube walls visible from inside.

## [1.0.193] - 2026-11-04
### Changed
- 3D models: minimum size 8 px instead of 36 px, so a model shrinks with distance (at 36 px Hubble stopped shrinking at ~300 m and looked far away while it was close by).

## [1.0.192] - 2026-11-04
### Fixed
- A deselected telescope or satellite vanished from a close view: only the selected one moved every frame, the rest once a second (7.5 km jumps; L2 110 km). Now all telescopes, and satellites within 3,000 km of the camera (max 300), move every frame.
- Orbit line missing close up: the ring's 180–240 chords lay hundreds of metres inside the real path. Every orbit line (telescopes, ISS, selected satellite) now has a dense Earth-fixed piece of ±60 s around the object, so it stays exactly on its line.

## [1.0.191] - 2026-11-04
### Changed
- No trail for satellites and space telescopes any more: their orbit line already shows the path. Aircraft, ships and trains keep theirs.

## [1.0.190] - 2026-11-04
### Fixed
- Trail of a tracked satellite/telescope flickered: its end point was computed separately (ms later); now it ends at the same per-frame position as dot, model and camera. L2 telescopes (JWST, Euclid) get no trail: in the Earth-fixed frame it is only a sweep from the Earth's rotation.

## [1.0.189] - 2026-11-04
### Fixed
- 3D models flickered: camera and model used positions computed a few ms apart (metres at 7.5 km/s); now one position per frame. Close by, the dot and selection ring are hidden so they no longer fight with the model surface.
- JWST/Euclid tracking: the selected L2 telescope now moves every frame (L2 sweeps ~110 km/s in the Earth-fixed frame; once a second made it jump away).
- Tracking satellites/telescopes: minimum zoom distance 1 m instead of 30 m (restored when tracking stops).

## [1.0.188] - 2026-11-04
### Added
- 3D models in real size for ISS, Hubble, Chandra and JWST (NASA 3D Resources, compressed to `wwwroot/models/*.glb`, 0.1–2.3 MB). Far away they stay visible as a 36 px icon; zooming in grows them to true size. Nose along the direction of motion (real attitude is not public).
- Tracking one of these: camera at 4× the object's size instead of 2,000 km, so the model is seen in real size; same composition (object upper right, Earth lower left).

## [1.0.187] - 2026-11-04
### Fixed
- Detection overlay: no second name next to objects that already have their own map label (space telescopes); box only.

## [1.0.186] - 2026-11-04
### Changed
- Satellites and space telescopes: composed view instead of the Earth straight behind — object at the upper right, Earth (centre) at the lower left, 26° apart; kept every frame while tracking.

## [1.0.185] - 2026-11-04
### Changed
- Satellites and space telescopes: the camera sits above/behind the object, tilted just enough that the Earth is always the background (also for high orbits such as Chandra and for L2). "Zoom to" uses the same view.

## [1.0.184] - 2026-11-04
### Changed
- Phones: no floating info box at all (it covered the dock); the info box only shows inside the tapped list row.

## [1.0.183] - 2026-11-04
### Changed
- One shared dock panel (`DockPanel` + `DockSpec`) for all list panels: airports, museums, radio, satellites, telescopes, launches. Each panel only supplies its filters, head controls and rows; head, pager, rows, row details and phone info box are shared.

## [1.0.182] - 2026-11-04
### Changed
- Phones (portrait and landscape): tapping a row in any list panel shows the full info box inside that row (player, photo, fields, buttons) instead of behind the panel.

## [1.0.181] - 2026-11-04
### Fixed
- Telescope list could stay empty: the only list was sent once at start-up (telescopes load fast, before the UI was listening). Opening a list panel (satellites, telescopes, launches) now asks the engine for a fresh list; list errors are logged to the console and crash report.

## [1.0.180] - 2026-11-04
### Added
- List panel for Space telescopes (search name/NORAD, group Earth orbit / L2, In view); filter also hides dots, labels and orbit rings; row details with Wikipedia summary and photo.
### Fixed
- Selected telescope moves every frame (as satellites), so it no longer jumps when followed close up.

## [1.0.179] - 2026-11-04
### Fixed
- Following the ISS close up: docked/nearby craft (Progress MS-34, Poisk) swept back and forth; satellites within 300 km of the selected one now also move every frame.
- The glow trail of the selected satellite ended up to a second behind it (its end jumped each second); it now always ends at the current position.

## [1.0.178] - 2026-11-04
### Fixed
- Selected satellite close up (camera ~25 km from the ISS): the red dot with its "ISS (ZARYA)" box jumped around the green target ring. The detect box and label used the position stored once a second (~8 km jumps, huge at that distance); the selected satellite's stored position is now also updated every frame.

## [1.0.177] - 2026-11-04
### Fixed
- Following a satellite: every few seconds the view jumped away for one or two frames (seen in a screen recording, ~3.6 s apart). Satellites and telescopes are no longer followed via Cesium's `trackedEntity` but by own tracking in the target's east-north-up frame, moved every frame; mouse rotate/zoom around the target still works. Navigating, "zoom to", fly-to and closing the info box end the tracking.

## [1.0.176] - 2026-11-04
### Fixed
- Selected satellite (e.g. ISS) jittered when zoomed in: its dot moved once a second (~8 km jumps) while the following camera moves smoothly; the selected satellite's dot now moves every frame.

## [1.0.175] - 2026-11-04
### Fixed
- Following a satellite (zoom button on): the view flickered briefly every 10–30 s. The orbit lines (selected satellite every 10 s, ISS every 30 s) were removed and re-added as entities; now primitives updated in place.

## [1.0.174] - 2026-11-04
### Added
- List panels for Satellites (search name/NORAD, group, In view; ISS first) and Launches (search name/provider, provider, status, In view, 🎥 webcast; by launch time), like museums: paged per 200, row details, filters also decide what shows on the globe and are kept. One generic panel (`ListPanel` in C#, `LISTS` in worldview.js) for both.

## [1.0.173] - 2026-11-04
### Fixed
- Aircraft trails stayed on for some aircraft on the ground: besides the ground flag, slow (< 30 m/s) and low (< 300 m) now counts as on the ground (many transponders never send the flag); also for the selected aircraft's trail.

## [1.0.172] - 2026-11-04
### Added
- Launches: the YouTube webcast (best by Launch Library priority) plays in the info box, with a link; launch list now fetched in detailed mode (cached 1 h).
- ISS: orbit always drawn (dashed) while the satellite layer is on, refreshed every 30 s; the info box plays a live ISS view from YouTube (found by the fetcher, NASA first).

## Fetcher 1.24.0 - 2026-11-04
### Added
- Live search also for "ISS live earth from space"; best hit as `iss` in `atc-streams.json` (search now 300 units per 6 h).

## [1.0.171] - 2026-11-03
### Changed
- YouTube stream in the info box: globe limited to 24 fps while it plays, so the video gets CPU/GPU time (smoother playback); back to full speed when the info box closes.

## Fetcher 1.23.1 - 2026-11-03
### Changed
- ATC title matching: accents ignored (Vaclav = Václav), name words from 6 letters (Midway), "<city> airport" also for medium airports (Asheville); a search hit needs an aviation word in its title (no more Golden Globe → Yaroslavl, Aurora → Guatemala).

## Fetcher 1.23.0 - 2026-11-03
### Added
- ATC live search matched against all airports (`airports.json`): ICAO code, else IATA code (common 3-letter words skipped), else "<city> airport" with one large airport there. Titles without a match listed in `atc-debug.json` (`unmatched`).

## Fetcher 1.22.3 - 2026-11-03
### Changed
- ATC streams: Flightradar24 and Airline Videos Live only via the live search (their handles gave no uploads); AMS LIVE still via its uploads every 30 min.

## Fetcher 1.22.2 - 2026-11-03
### Fixed
- ATC streams: channel ids resolved from the handle via the API (`channels?forHandle`) instead of hard-coded ids (one was wrong).
### Added
- Live search every 6 h (`airport live ATC`, `flightradar24 live`; 200 units): streams on any channel whose title names a known airport; all hits listed in `atc-debug.json`.

## Fetcher 1.22.1 - 2026-11-03
### Fixed
- ATC streams: the API search (`eventType=live`) returned nothing; now the channel's 200 newest uploads are checked for live status (`playlistItems` + `videos`, ≈ 24 units per run, every 30 min). Unmatched live titles go to `atc-debug.json`.

## Fetcher 1.22.0 - 2026-11-03
### Changed
- ATC streams via the YouTube Data API when `YOUTUBE_API_KEY` is in `.env` (hourly, 7,200 of 10,000 daily units); YouTube serves servers a stripped channel page without the Live tab. Without a key the page is still scraped; `atc-debug.json` shows why a channel gave nothing.

## [1.0.170] - 2026-11-03
### Changed
- Data layers: Airports directly below Flights.

## [1.0.169] - 2026-11-03
### Changed
- Airports come from the fetcher (`airports.json`, `airports.js`, OurAirports checked daily, refreshed every 30 days) instead of `wwwroot/data`; removed from the geo workflow. Fetcher 1.21.0.

## [1.0.168] - 2026-11-03
### Added
- Airports layer: 5,281 large and medium airports (OurAirports, public domain; `tools/build-airports.mjs` → `data/airports.json`, also in the monthly geo workflow). Medium airports show below 3,000 km.
- Airport panel in the dock (like museums): search by name, ICAO or IATA, country, place, size, "In view" and 🎧 ATC stream; paged per 200; filters also decide the dots on the globe and are kept.
- Airports with a live YouTube ATC stream: green, larger dot, the stream plays in the info box; every airport links to its LiveATC search page.
### Changed
- ATC stream cameras: green camera icon (white was hard to see).

## [1.0.167] - 2026-11-03
### Added
- Traffic cameras: airport live streams with ATC audio from YouTube (Flightradar24, Airline Videos Live, AMS LIVE for Schiphol while live), green camera icon. The info box plays the stream in a YouTube player and links to the video.
- Fetcher 1.21.0: `atc-streams.json`, live video IDs read from the channels' Streams tab every 30 min (`atcstreams.js`).

## [1.0.166] - 2026-11-03
### Removed
- Museum panel: the "clear filters" ✕ in the head bar (easy to hit by accident on the folded bar); each filter field has its own ✕. The radio head bar had none.

## [1.0.165] - 2026-11-03
### Changed
- New users: all data layers start off (flights and satellites were on). Saved choices of existing users stay as they are.

## [1.0.164] - 2026-11-03
### Changed
- Combo boxes: lists always sorted alphabetically (place too, was by count; up to 500 places); the list now opens downwards (was upwards), at least 180 px wide.

## [1.0.163] - 2026-11-03
### Changed
- All filter dropdowns in the museum and radio panels (country, place, kind, genre) are now one reusable combo box (`Combo.razor`): type to filter the list, ✕ clears, ▾ opens/closes, the chosen item is highlighted; same on every device. Country/kind/genre: pick from the list (half-typed text falls back to the chosen value); place: free text. Touch screens: filter inputs at 16 px so iOS doesn't zoom in on focus. The settings panel keeps its native selects (language, environment layer, basemap).

## [1.0.162] - 2026-11-03
### Changed
- Museum place filter: own combo box instead of `<datalist>` (iOS showed no dropdown, arrow or clear button). Same on every device: ✕ clears, ▾ opens/closes the list, typing filters the suggestions (contains, most museums first, max 60); the list opens upwards.

## [1.0.161] - 2026-11-03
### Fixed
- Phones portrait: the nav pad covered the museum/radio panels. It now sits above the folded bars (one or two) and is hidden while a list is open.

## [1.0.160] - 2026-11-03
### Changed
- Museum list: a row click flies to the museum only when the museum zoom button is on, like radio and the other layers (it always flew before). Nav pad stays on every device (TEMP note removed).

## [1.0.159] - 2026-11-03
### Added
- Museum row details: tapping the photo enlarges it in the lightbox (zoom/pan as in the info box); close with ✕ or a tap beside it.

### Changed
- Museum and radio panels: a tap on the head bar folds the panel open/shut; the small 🏛/📻 ▴▾ button is gone. Radio controls (play, stop, favourite, volume) and the museum ✕ don't fold the panel.

## [1.0.158] - 2026-11-03
### Changed
- Phones, museum and radio lists: a second tap on the folded-open row folds it shut (without flying or restarting the station); the ▸/▾ button is hidden there. Desktop keeps the button.

## [1.0.157] - 2026-11-03
### Fixed
- Museum row details showed no photo or summary when the Wikipedia load was already running (phones: the row tap selects the museum, which starts the load, and then folds the row open). `loadQidWiki` now returns the running load, so the details wait for the same result.

## [1.0.156] - 2026-11-03
### Changed
- Phones: tapping a row in the museum or radio list also folds it open (and scrolls it to the top); ▾ folds it shut. Desktop unchanged (▸ only).

## [1.0.155] - 2026-11-03
### Added
- List panels remember their last filter across sessions: every query is saved per panel in the settings (`S.panelFilters.radio`, `.museums`), applied by the engine at start (list and globe dots) and read back by the UI (`getPanelFilter`). New panels: save with `savePanelFilter(name, query)` and add their fields to `PanelFilter`.

## [1.0.154] - 2026-11-03
### Changed
- Museum and radio lists: the selected row (item in the info box, or the folded-open row) gets a soft green background with a thin green bar on the left; its details share the tint. The playing radio station keeps its pink.

## [1.0.153] - 2026-11-03
### Changed
- Row details on a phone in portrait: image above the text (landscape and desktop keep it on the left).

## [1.0.152] - 2026-11-03
### Changed
- Row details: photo/logo on the left (max 140 × 120 px), fields, summary and link to its right.

## [1.0.151] - 2026-11-03
### Changed
- Phones: an open museum/radio list fills the height up to the top bar (both open: they share it); head and filters keep their height, only the list shrinks.
- Pager (◀ 1–200 ▶) moved into the filter row; radio station count there too (separate count row removed).

### Fixed
- Photo in the folded-open row details was squeezed to 22 px by the list icon rule; now up to 160 × 110 px.

## [1.0.150] - 2026-11-03
### Changed
- Museum/radio lists: a row folded open scrolls (smoothly) to the top of its list, again once the details have loaded, so the start of the text is in view.

## [1.0.149] - 2026-11-03
### Added
- Museum and radio lists: ▸ button per row folds the details open under the row (museum: kind, place, country, opening hours, website link, Wikipedia summary + photo + link; radio: logo, country, genre, codec, position). One row at a time.

### Changed
- Phones (portrait, and landscape with touch): one thing at a time. Settings open → info box and museum/radio panels hidden; a museum/radio list expanded → info box hidden (selection stays; it returns when the list is collapsed). In phone landscape the settings panel now starts closed and opens with ☰, as in portrait.

## [1.0.148] - 2026-11-03
### Added
- Museums: place per museum in the list ("kind · place · country") and the info box; new "Place…" filter (contains, case-insensitive) with suggestions from the current result (most museums first, max 500); also filters the dots on the globe.
- Fetcher 1.20.0: place as 11th row element: OSM `addr:city`, else the nearest town (≥ 5,000 inhabitants) within 15 km from GeoNames cities5000 (`places.js`; city districts and arrondissements skipped). Index gets `fields: 11`; an older index triggers a rebuild that fills in country and place for existing tiles.

## [1.0.147] - 2026-11-03
### Changed
- Museum and radio lists are paged: 200 per page with ◀ 1–200 ▶ when there are more; a new filter goes back to page 1, the list scrolls to the top on each page. Radio server search now returns up to 1,000 stations (was 300); prev/next steps through the whole result.

## [1.0.146] - 2026-11-03
### Changed
- Info box: field values that are web addresses (http/https) are links that open in a new tab. Museum websites without a scheme get `https://`; of several (`;`-separated) only the first is used.

## [1.0.145] - 2026-11-03
### Changed
- Radio: for a station without coordinates the info box now says "no own location – centre of {country} shown" when the camera flew to the country (zoom on); otherwise "no location" as before.

## [1.0.144] - 2026-11-03
### Added
- Radio: the station logo (Radio Browser favicon) shows in the info box, small (max 96 px) and centred, not enlargeable; hidden when it fails to load.

## [1.0.143] - 2026-11-03
### Fixed
- Radio: choosing a station without coordinates showed no info box (only stations on the globe could be selected). It now opens an info box with station, country, genre, codec and "no location"; with zoom on it still flies to the country.

## [1.0.142] - 2026-11-03
### Added
- Museum panel, like the radio panel: search by name, country (with counts), kind, "In view" and "Wikipedia" filters; list sorted Wikipedia first, then name (max 300 shown, total in the header); a click flies there (3 km) and opens the info box. The filters also decide which dots show on the globe. Choosing a country loads all its museums (`museums/cc/{ISO2}.json`). The info box shows the country.
- Bottom dock: museum and radio panels stack above each other at the same width; when both are expanded their lists shrink (18vh, 14vh on phones).
- Fetcher 1.19.0: country per museum (10th row element, ISO2) from Natural Earth 50m admin 0 (`countries.js`, point in polygon; OSM `addr:country` or the nearest coast within 0.5° as fallback). The index gets `countries` ({ISO2: count}) and every rebuild writes `museums/cc/{ISO2}.json`; tiles without the country field get it on the next rebuild (an index without `countries` triggers one at start).

## [1.0.141] - 2026-11-03
### Fixed
- Fetcher 1.18.1 (`museums.js`): HTTP 502 from Overpass means an overloaded server, not a too heavy query; splitting on it only multiplied requests. Now 502/429/503, network errors and timeouts switch to the next server at once, with a 30 s and 60 s pause after each round past all servers (max 9 attempts per box part). Only 504 or an Overpass timeout/memory remark splits the box.

## [1.0.140] - 2026-11-03
### Changed
- Museums: switching the layer on reloads `museums-index.json` when the last load is older than 10 minutes, so boxes the fetcher added since then appear without a page reload; a changed index reloads the tiles in view. A failed reload keeps the old index.

## [1.0.139] - 2026-11-03
### Changed
- Energy per year and power plants now come from the fetcher. Fetcher 1.18.0: `energy.js` (OWID/Ember, `energy-year.json`) and `plants.js` (WRI GPPD, `plants.json`) replace `tools/build-energy.mjs` and `tools/build-plants.mjs`; fetched when missing or older than a year (checked daily). The app loads both from `FEED_URL`; both builds removed from `.github/workflows/update-geo.yml`.
- Heavy datasets (borders, coast, geo/cities, sea, time zones, nature) stay in `wwwroot/data`, built on the PC; the app reads them via `STATIC_URL` (`data`).

## [1.0.138] - 2026-11-03
### Changed
- Fetcher 1.17.0: museums are fetched and saved per 30° box instead of all at once. Boxes go nearest to UTC+1 (Central Europe) first; each finished box writes its 5° tiles and rebuilds `museums-index.json` from all tiles on disk, so museums appear after the first box. A failed box keeps its old tiles and is retried on the hourly check; after 3 failed boxes in a row the run stops until the next hour. `museums-state.json` holds the last success per box (refresh every 30 days). A box that returns less than half its previous count (over 100) keeps its old tiles. Rows get a 9th element (1 = has a Wikipedia article) for the overview.

### Fixed
- Museums never loaded: overpass-api.de answered every run with HTTP 502, which aborted the whole fetch. Fetcher 1.16.1 (`museums.js`): rotates between Overpass mirrors (overpass-api.de, private.coffee, kumi.systems) on 429/502/503/504, network errors and HTML error pages; a box that gets a gateway error twice is split instead of failing; gives up after 60 such failures per run; 3-minute request timeout; query timeout 120 s without `maxsize`; logs the element count.

## [1.0.137] - 2026-11-02
### Changed
- Search: addresses now fly to 300 m height (was 3 km); other places still at least 3 km.

## [1.0.136] - 2026-11-02
### Changed
- Search: an address (text with a number, or a Nominatim result of type house/building/road, e.g. "Ooiweg 6, Apeldoorn") flies to 3 km height; other places never go lower than 3 km (was 2.5 km).

## [1.0.135] - 2026-11-02
### Changed
- Museums now come from the fetcher instead of a manual build script. Fetcher 1.16.0 (`museums.js`): queries Overpass worldwide every 30 days in the background (≈ 10–30 min; skipped at start while `museums-index.json` is younger than 30 days), writes `museums/{x}_{y}.json` tiles, removes stale ones and writes the index last; a result under 1,000 museums keeps the old files. The app loads `museums-index.json` and the tiles from `flights.sinnema.ch`. `tools/build-museums.mjs` is obsolete.

## [1.0.134] - 2026-11-02
### Added
- **Museums** layer from OpenStreetMap (`tourism=museum`, ODbL), built with `tools/build-museums.mjs` (Overpass, dense areas split automatically) into `data/museums-index.json` + 5° tiles in `data/museums/`. Zoomed out: well-known museums (with a Wikipedia article, max 6,000); below 2,000 km all museums in view (tiles loaded on demand). Info box: kind (`museum:type`), opening hours and website as in OSM, position, and the Wikipedia summary + photo via the Wikidata id in the UI language. Voice keyword "museum", help text in 5 languages.

## [1.0.133] - 2026-11-01
### Changed
- Aircraft trails stay visible until their tail has left the view too: aircraft up to 50 km outside the view are considered, and a trail is kept as long as any of its points is in view.

## [1.0.132] - 2026-11-01
### Added
- "Follow" button in the info box of aircraft: keeps the selected aircraft in the screen centre every frame at the current height, heading and tilt (zoom and the nav pad keep working). Off on a new selection, when the selection is cleared and in cockpit view.

## [1.0.131] - 2026-11-01
### Changed
- Selecting an aircraft keeps its normal trail (fetcher history) instead of replacing it with a new glow trail that starts at the moment of selection; the selected aircraft always gets a trail, also beyond the device budget. Other moving objects (satellites, trains, …) keep the glow trail.

## [1.0.130] - 2026-11-01
### Added
- Helicopters get a helicopter icon (top view: cabin, tail boom, crossed rotor blades), in the layer colour. Fetcher 1.15.1: `types.json` gets `_H`, the ICAO type codes whose description starts with H (tar1090-db). The app loads the type names as soon as an aircraft layer has data (was: on first selection) and switches aircraft already on screen when they arrive.

## [1.0.129] - 2026-11-01
### Fixed
- `/near` kept being requested every 8 s when the fetcher has no such endpoint yet (404, shown by Chrome as a CORS error): after a failed request the app now waits 5 minutes before trying again.

## [1.0.128] - 2026-11-01
### Fixed
- Nav pad sat behind the settings panel in landscape: it is now always drawn above panels; with the panel open it moves bottom left on smaller/short screens (left of the panel on screens ≥ 900 × 600); phones portrait still hide it while the full-width panel is open.

## [1.0.127] - 2026-11-01
### Changed
- Nav pad temporarily shown on PC too (review); tilt gesture on PC unchanged.

## [1.0.126] - 2026-11-01
### Fixed
- White globe on phones (DPR > 1) since 1.0.125: the label/detection canvases had `inset: 0` without width/height, so they took their own pixel size, which the app sets to screen size × DPR every frame → the canvas grew ×DPR per frame. Now explicit 100 % width/height.

## [1.0.125] - 2026-11-01
### Fixed
- Phones portrait (≤ 760 px): top bar on two rows (search full width, buttons below at 38 px), so all buttons are visible; search text 16 px (no iOS zoom on focus); version moved to bottom right; panel, HUD, toast and crash button start below the bar; info box full width, max 45 % high.
- Phone landscape and tablets (761–1299 px): the centred top bar ran under the side panel; the panel now starts below the bar.
- Nav pad: bottom right with less margin; left of the open panel only on big screens (≥ 900 × 600), hidden while the panel is open on smaller or short screens (it sat in the middle of a landscape phone screen); smaller pad on short landscape screens.
- Short landscape (≤ 500 px high): more compact HUD, info box uses the height.
- Touch screens: bigger top-bar buttons.
- Label and detection canvases now cover exactly the globe area instead of 100vh (taller than the visible area on iOS/Android with toolbars, which shifted labels).

## [1.0.124] - 2026-11-01
### Added
- Fetcher 1.15.0: `GET /near/{lat}/{lon}/{nm}` (0.5° grid, radius 25/50/100/150/250 nm) → adsb.lol `/v2/point`, military row format. Cached 8 s per area, at most 6 upstream calls per 10 s, 60 s pause after a 429 (then the last answer or an empty list). Caddy proxies `/near/*`.
- App: below 300 km the civil aircraft around the view centre come from `/near` every 8 s (iOS 10 s). Known aircraft get the extra fixes, new ones are added; they are shown ~15 s behind instead of 140 s (catching up at double speed). When the near feed stops for 30 s they fall back to the OpenSky delay. Landings now follow real positions down to the runway.
### Fixed
- Landing fallback: past the last fix an aircraft that was low (< 600 m) and descending no longer flies on at approach speed for kilometres; it descends to the ground at its sink rate and brakes to a stop (2 m/s²). Altitudes are above sea level, so at high airports this is approximate.

## [1.0.123] - 2026-11-01
### Added
- Fetcher 1.14.0: keeps a track history per airborne aircraft (`history.js`), only as much as a 50 km trail behind the delayed icon needs (50 km + delay distance, plus one fix beyond for the curve; reset on the ground, after a 10-min gap or 5 min unseen). Sent as `[ageS, lat, lon, alt, gs, track] × n`: element 13 of civil rows in the tiles (not in the `flights.json` overview), element 12 of military rows.
- App: these earlier fixes are merged into each aircraft, so trails appear as soon as an aircraft comes into view instead of after the next updates.

## [1.0.122] - 2026-11-01
### Added
- Aircraft trails can be switched on/off: "Trails" button under Display (on by default, remembered).

## [1.0.121] - 2026-11-01
### Added
- WorldView reopens at the last view on this device (position, height, heading, pitch; saved after every camera move, not in cockpit view). A link with `#c=…` still wins.

## [1.0.120] - 2026-11-01
### Changed
- Aircraft trails are at most 50 km long (was 5 minutes): traced back from the icon along its curve and cut off at exactly 50 km, or shorter when the oldest received fix is nearer.

## [1.0.119] - 2026-11-01
### Changed
- Aircraft trails respect slower computers and tablets: only the aircraft nearest the screen centre get one (start 150, iOS 40); if an update takes > 8 ms that number drops by a quarter (min 15), under 3 ms it grows again (max 300, iOS 80). Coarser points when zoomed out (5 s below 50 km, 10 s below 200 km, else 15 s). iOS updates every 2 s instead of every second.

## [1.0.118] - 2026-11-01
### Changed
- Aircraft trails now appear below 400 km altitude (was 100 km).

## [1.0.117] - 2026-11-01
### Changed
- Aircraft trails now appear below 100 km altitude (was 50 km).

## [1.0.116] - 2026-11-01
### Added
- Below 50 km altitude every airborne aircraft in view (flights and military) gets a thin trail of its last 5 minutes, drawn through the same smooth curve the icon follows (from the received fixes, ending at the icon). Updated every second; hidden above 50 km and in cockpit view. The selected aircraft keeps its own glow trail.

## [1.0.115] - 2026-11-01
### Changed
- Nav pad touch-only again (hidden on PC).

## [1.0.114] - 2026-11-01
### Changed
- Nav pad temporarily shown on PC too (testing); tilt gesture on PC unchanged.

## [1.0.113] - 2026-11-01
### Fixed
- Nav pad: tilt used the wrong axis and turning jumped instead of starting from the current view. Turn and tilt now use Cesium's own `rotateRight`/`rotateDown` in the east-north-up frame of the point in the screen centre, so they start exactly at the current view; tilt stops 8° above the horizon and at straight down.

## [1.0.112] - 2026-10-31
### Fixed
- iPad/iPhone still crashed ~2 s after turning borders on (crash report: only the 389 KB border file, no JS error → tab killed for memory). The first line overlay starts Cesium's geometry web workers, each loading its own copy of the Cesium worker code. On iOS line/fill overlays are now built on the main thread (no workers), and the globe renders at CSS-pixel resolution (4× smaller GL buffers on Retina; labels stay sharp on their own canvas).

## [1.0.111] - 2026-10-31
### Fixed
- Nav pad was hidden behind the side panel: while the panel is open it now sits left of it; on narrow screens it is drawn on top.

## [1.0.110] - 2026-10-31
### Added
- Crash report, kept on the device only (nothing is sent): every 3 s the state (layers + counts, overlays, environment layer, camera, primitives, imagery layers, screen, selection) and the last 80 events (setting changes, selections, camera moves, JS errors, WebGL context loss, render errors, visibility) go to localStorage. A session that ended while visible without a normal unload counts as a crash; the next start shows a ⚠ Crash report button (also via `#crash` in the URL) with Copy, Share, Delete and Close.
### Fixed
- Reloading or closing the page within 20 s of start no longer counts as a crash (crash guard flag is cleared on `pagehide`).

## [1.0.109] - 2026-10-31
### Changed
- Touch screens (iPad/iPhone): a two-finger drag no longer tilts the view by accident (the globe used to slide off the bottom); pinch only zooms.
- Touch screens: on-screen nav pad bottom right — hold ⟲/⟳ to turn, ▲/▼ to tilt (around the screen centre, max 8° above the horizon), −/+ to zoom; N = straight down, north up. Tilting while looking past the globe brings it back into view.

## [1.0.108] - 2026-10-31
### Fixed
- Fetcher 1.13.1: NS trains were almost all gone (only Arriva left). NS now reports a meaningless `horizontaleNauwkeurigheid` for source `OBIS` (e.g. 140 km for a correct position), so the 5 km filter dropped them; it now ignores that field for `OBIS`.

## [1.0.107] - 2026-10-31
### Fixed
- iPad/iPhone crashed (and kept reloading) with borders, coastlines or cities on: on iOS lines are drawn as light 1 px GL lines (wide polylines need ~8× the memory) and MSAA is off.
- Crash guard: if the page died while starting or loading borders/coast/cities/provinces (flag not cleared within 20 s), the next start turns borders, time zones, nature/street names and the environment layer off and says so, instead of crashing again.

## [1.0.106] - 2026-10-31
### Changed
- Aircraft move smoothly along their real path: shown a fixed delay behind real time (civil 140 s, military 45 s) and moved along a Hermite curve between received positions (position + speed/heading at both ends), so turns are curves instead of straight lines with jumps. Past the newest position they continue along their current turn (max 45°). The icon points along the curve.
- Selected aircraft is tracked live: every 5 s its own position from adsb.lol via the fetcher (`/live/{hex}`), shown only 12 s behind; the trail restarts at the live position. After deselecting it slowly falls back to the normal delay.
- Fetcher 1.13.0: `/live/{hex}` endpoint (adsb.lol `/v2/hex`, cached 3 s); Caddy proxies `/live/*` to the fetcher.

## [1.0.105] - 2026-10-30
### Changed
- Side panel: the Environment section (layer, legend, KNMI images, "Air & weather on click") now sits right under Language; the "Air & weather on click" button spans the full width. Its heading is in capitals like the other sections.

## [1.0.104] - 2026-10-30
### Fixed
- Side panel no longer scrolls horizontally: 20 px wider, legend and KNMI images include their border/padding in their width.

## [1.0.103] - 2026-10-30
### Fixed
- NO₂ layer: no more white/grey striped blocks. Tiles are filtered per pixel: clean air (pale yellow) and grey no-retrieval pixels become transparent, strength fades in towards orange/red, and the gaps between TROPOMI swath lines are filled. Every zoom level is built from the same source level (GIBS level 4, ≈ 6–10 km/pixel), so the picture no longer changes while zooming.

## [1.0.102] - 2026-10-30
### Changed
- Copernicus (ADS/CDS) removed: no account or key needed any more. Fetcher 1.12.0:
  - **Ozone – whole Earth** now from the NOAA GFS analysis via NOMADS (`ozone.js`, every 6 h); GRIB decoder handles complex packing with spatial differencing.
  - **Temperature anomaly** now from NASA GISTEMP v4 (`gistemp.js`, replaces `era5.js`): latest month on a 2° grid, rebased to 1991–2020, checked daily.
  - `ADS_API_KEY` / `CDS_API_KEY` dropped from `.env`; `status.json` reports no keys.
### Removed
- CO₂ and methane layers (only source was Copernicus CAMS).

## [1.0.101] - 2026-10-30
### Changed
- Electricity layer labels are drawn on the screen text layer: constant size like other names, decluttered while zooming (small countries such as the Netherlands appear when there is room)

## [1.0.100] - 2026-10-30

### Changed
- Electricity layers (year and now) show the country name above the values, in the chosen language.

## [1.0.99] - 2026-10-30

### Added
- **Electricity CO₂ per kWh (year, world)**: latest yearly carbon intensity and renewable share for ~210 countries (Ember via Our World in Data, `tools/build-energy.mjs`, also in the monthly geo update). The live layer is now "(now, Europe)".
- HUD shows the active environment layer and its source.

## [1.0.98] - 2026-10-30

### Fixed
- Fetcher 1.11.3: electricity CO₂ showed only UK, Ireland and Portugal after midnight. Energy-Charts returns only the country's local "today" by default, which is empty just after midnight; the fetcher now asks for yesterday + today.

### Changed
- All NASA legends are now drawn by WorldView from the GIBS colour maps: large readable type, layer name in the chosen language, Kelvin shown as °C, very large/small values as e.g. 5.0e15 (the small NASA images remain the fallback).

## [1.0.97] - 2026-10-30

### Fixed
- Own legends (coral, temperature anomaly, CO₂/methane, electricity, ozone, NH₃, land temperature °C) were unreadable: larger type, coral labels on two lines.

## [1.0.96] - 2026-10-30

### Fixed
- Sea ice: still stray tiles north of 40° in GIBS's web-mercator pyramid; the layer now uses GIBS's geographic (EPSG:4326) tiles, which are clean.

## [1.0.95] - 2026-10-30

### Changed
- Fetcher 1.11.2: network errors are logged with their cause (e.g. `ETIMEDOUT`, `ENOTFOUND`); feeds with long intervals (coral, power) retry after 30 min instead of waiting a full interval.

### Fixed
- Sea ice: NASA GIBS serves stray wrong tiles (clouds, other products) for empty open-ocean tiles of this layer; tiles are now only requested north of 40° N and south of 45° S.

## [1.0.94] - 2026-10-30

### Changed
- Environment layers that need a Copernicus key on the fetcher (ozone CAMS, CO₂, methane, temperature anomaly) are greyed out with "(key needed)" while the key is missing (fetcher 1.11.1 reports configured keys in `status.json`).

## [1.0.93] - 2026-10-30

### Fixed
- Coral bleaching showed nothing: the browser could not use NOAA's map service directly. Fetcher 1.11.0 (`coral.js`) now downloads one global image every 6 h and serves it as `coral.png`.
- Environment overlays: switching layers now removes every earlier overlay (tagged imagery layers), so no leftover patches of a previous layer (seen with Sea ice).

## [1.0.92] - 2026-10-29

### Added
- Environment layers: **Temperature anomaly** (ERA5 vs 1991–2020, fetcher `era5.js` via the Copernicus CDS, needs `CDS_API_KEY`), **CO₂** and **methane** column averages (CAMS greenhouse gas forecasts via ADS, relative colour scale with today's range), **Sea ice** (NASA GHRSST MUR), **Coral bleaching heat stress** (NOAA Coral Reef Watch, 7-day max alert level, ERDDAP WMS) and **Electricity CO₂ per kWh** for ~37 European countries (fetcher `power.js` from Energy-Charts every 30 min, rate-limited; estimate from the generation mix with IPCC lifecycle factors, renewable share shown).
- **Power plants** data layer: ~35,000 plants (WRI Global Power Plant Database, `tools/build-plants.mjs`), colour per energy source, size per capacity, details in the info box.
- Fetcher 1.10.0: generic Copernicus data store request, multi-message GRIB decoding. 1.10.1: logs at start which optional keys are missing and which features stay off.

## [1.0.91] - 2026-10-29

### Changed
- Realistic star sky: NASA SVS Deep Star Maps 2020 (Gaia DR2, Hipparcos, Tycho; Milky Way included) as a 6 × 2048 px sky box (`tools/build-sky.py`, ≈ 4.4 MB), replacing Cesium's low-resolution Tycho sky.

## [1.0.90] - 2026-10-29

### Changed
- Keyboard navigation (arrows, +/−) speeds up and slows down smoothly (easing ≈ 0.3 s) instead of starting and stopping abruptly.

## [1.0.89] - 2026-10-29

### Changed
- Land surface temperature (day/night): legend in °C instead of Kelvin, drawn from NASA's colour map.

## [1.0.88] - 2026-10-29

### Changed
- Snow cover: areas without snow (grey) are fully transparent.

## [1.0.87] - 2026-10-29

### Fixed
- Snow cover: NASA SMAP L4 snow mass (daily, gap-free, kg/m²) instead of the MODIS 8-day extent, which flagged clouds as snow (e.g. "snow" around Apeldoorn at +9 °C) and drew blocky red patches.

## [1.0.86] - 2026-10-29

### Fixed
- My location: specific message (blocked, no position, timeout) and fallback to an approximate location from the internet connection (ipapi.co, city level).

## [1.0.85] - 2026-10-29

### Added
- **Ozone – whole Earth (CAMS)**: total column ozone incl. polar night from the Copernicus CAMS global forecast (fetcher 1.8.0, `ozone.js`: ADS API + own GRIB decoder, every 6 h, needs `ADS_API_KEY`), own colour scale and legend.
- With an ozone layer: KNMI/TEMIS polar ozone maps (north/south) as thumbnails, enlarge on click.
- Top bar: **N↑** (north up, straight down, same spot and height) and **◉** (fly to your own location via the browser, blue dot).

### Changed
- OMPS layer renamed "Ozone – measured (OMPS)".

## [1.0.84] - 2026-10-29

### Added
- **Ozone** environment layer: OMPS daily total ozone column (Dobson units, yesterday), with legend.

## [1.0.83] - 2026-10-29

### Fixed
- Snow cover: MODIS 8-day snow extent composite (cloud-free, no swath strips) instead of the daily swath that showed clouds and gaps.

## [1.0.82] - 2026-10-29

### Fixed
- Fetcher 1.7.1: NS trains no longer jump back to the same spot. NS often repeats an unchanged position; the fetcher now keeps the time that position was first seen, so the browser keeps extrapolating.
- Fetcher 1.7.2: NS positions with an accuracy worse than 5 km (`horizontaleNauwkeurigheid`, no fresh fix) are skipped.

### Added
- **Zoom to** button in the info box: centres the selected object, city, country, province or spot in view without changing the camera height or direction.

## [1.0.81] - 2026-10-29

### Fixed
- Long streets are labelled repeatedly (about every 400 m, at least a label width plus 120 px apart on screen).
- Street and OSM nature names also in a tilted view (only the area around the view centre is loaded) and up to 10 km altitude (main roads from 6 km).

## [1.0.80] - 2026-10-29

### Added
- **Street names** toggle: below 6 km, names from OpenStreetMap (OpenFreeMap vector tiles) drawn along the street, main roads highlighted.

## [1.0.79] - 2026-10-29

### Changed
- Faster updates. Fetcher 1.7.0: every feed on its own schedule — military 20 s, trains Finland 15 s, NS 30 s, Amtrak 60 s, bus/tram/metro 15 s, flights 90 s (`OPENSKY_INTERVAL_S`, default now 90). Browser polls military every 20 s, trains and bus/tram/metro every 15 s.

## [1.0.78] - 2026-10-29

### Changed
- Bus, tram, metro and ferry are no longer extrapolated: shown at their last reported position.

## [1.0.77] - 2026-10-29

### Changed
- Public transport icons per mode: bus (yellow), tram (red, two sections, T), metro (blue capsule, M), ferry (cyan hull).

## [1.0.76] - 2026-10-29

### Added
- **Nature names** toggle: seas, rivers, lakes, mountain peaks (with height) and landscapes from Natural Earth (`tools/build-nature.mjs`, also in the monthly geo update), more names as you zoom in; below 80 km also canals, smaller rivers, lakes, bays and peaks from OpenStreetMap (OpenFreeMap vector tiles, decoded in the browser).

## [1.0.75] - 2026-10-29

### Changed
- Coastlines are hidden below 50 km camera height.

## [1.0.74] - 2026-10-29

### Changed
- Detailed coastlines from OpenStreetMap (≈ 80 m, 5° tiles loaded when zoomed in below 1,500 km; `tools/build-coast.mjs`, also in the monthly geo update); the Natural Earth line remains for the overview.

## [1.0.73] - 2026-10-29

### Added
- **Coastlines** (Natural Earth 10m) and **Sea borders** (Marine Regions EEZ boundaries: agreed in blue, 200 nautical mile limits faint blue, disputed in orange) as options under Borders; built by `tools/build-sea.mjs`, also in the monthly geo update.

## [1.0.72] - 2026-10-29

### Changed
- Image descriptions that only exist in another language are machine-translated into the UI language (MyMemory) and marked as such, instead of being left out.

## [1.0.71] - 2026-10-29

### Fixed
- Image descriptions only in the UI language or English; a description that exists only in another script (e.g. Russian) is left out. Doubled author names cleaned up.

## [1.0.70] - 2026-10-29

### Fixed
- Image details missing for most Wikipedia images: Wikimedia now serves images from `thumb.wikimedia.org` as well as `upload.wikimedia.org`.

## [1.0.69] - 2026-10-29

### Added
- Enlarged images show details underneath: description, date, author, licence and a link to the source (Wikimedia Commons); camera images show the operator, NS images the source.

## [1.0.68] - 2026-10-29

### Added
- Hand cursor over everything clickable on the globe (objects, cities, countries, provinces/states).

## [1.0.67] - 2026-10-29

### Added
- Province/state info: clicking a province or state name shows country, population and the Wikipedia summary and image (via the OSM boundary and its Wikidata id).

## [1.0.66] - 2026-10-29

### Changed
- Sharp map labels: country, province, city, time zone and telescope names are drawn as native text on a 2D overlay (pixel-aligned, any screen resolution) instead of Cesium texture labels; clicking country and city names still works.

## [1.0.65] - 2026-10-29

### Changed
- Ammonia map covers all of Europe (CAMS Europe domain, 1° grid, 2,940 points), refreshed every 8 hours in the background with throttled requests (fetcher 1.6.1).

## [1.0.64] - 2026-10-29

### Added
- Ammonia (NH₃): in air & weather on click (Europe), and an **Ammonia (NH₃, Netherlands)** map in the Environment list: 588-point CAMS Europe grid via Open-Meteo, refreshed every 2 hours by the fetcher (1.6.0, `nh3.json`), smooth colours with legend; low values transparent.

## [1.0.63] - 2026-10-29

### Fixed
- Environment legends missing for most layers: legend images are named after the GIBS palette, not the layer.

## [1.0.62] - 2026-10-29

### Changed
- NO₂: clean-air values are transparent, like SO₂.

## [1.0.61] - 2026-10-29

### Changed
- NO₂ satellite layer restored (removed by mistake in 1.0.60), now with legend.

## [1.0.60] - 2026-10-29

### Added
- Environment: colour legend with units (NASA GIBS) under the satellite layer choice.

### Changed
- SO₂: clean-air values are transparent, only real concentrations are coloured.

### Removed
- NO₂ satellite layer (daily swaths with gaps and noise; NO₂ stays available via air & weather on click).

## [1.0.59] - 2026-10-29

### Fixed
- SO₂ overlay: striped TROPOMI swath artefacts replaced by the gap-free MERRA-2 monthly SO₂ field.

## [1.0.58] - 2026-10-29

### Fixed
- NO₂ and SO₂ overlays were empty: the latest TROPOMI day is still incomplete, now showing the day before yesterday.
- Fetcher 1.5.1: also accepts `OPENAQ_KEY` as the OpenAQ key name.

## [1.0.57] - 2026-10-29

### Added
- **Environment** section: NASA GIBS satellite overlays (land temperature day/night, sea temperature and anomaly, NO₂, SO₂, aerosols, precipitation, vegetation, snow), latest available day.
- **Air & weather on click**: click an empty spot on Earth for the European air quality index, PM2.5, PM10, NO₂, ozone, UV and the current weather (Open-Meteo), with the place name (Nominatim).
- **Air quality (sensors)** layer: ~9,000 Sensor.Community sensors (+ OpenAQ stations with `OPENAQ_API_KEY`), coloured by PM2.5 (fetcher 1.5.0, `air.json`, every 5 min).

## [1.0.56] - 2026-10-29

### Added
- Help page (? button next to the microphone): everything explained in EN/NL/DE/FR/ZH, with an index, keyboard shortcuts and sources. Closes with ✕, Esc or a click outside.

### Changed
- The Cesium ion token explanation moved from the side panel to the help page.

## [1.0.55] - 2026-10-29

### Changed
- Time zones: the globe turns to the chosen zone at the equator.

## [1.0.54] - 2026-10-29

### Added
- Country info: clicking a country label shows continent, region, population, GDP, ISO code and the Wikipedia summary and image (UI language, via Wikidata).

## [1.0.53] - 2026-10-29

### Changed
- Display panel: Provinces/states and Cities directly under Borders, Time zones below them.

## [1.0.52] - 2026-10-29

### Changed
- Time zones: choosing a zone in the legend turns the globe towards it.

## [1.0.51] - 2026-10-29

### Added
- Time zones: translucent colour fill per zone, and a clickable legend with the current time per zone; the chosen zone lights up on the globe.

## [1.0.50] - 2026-10-29

### Fixed
- Time zone lines follow the curvature of the Earth (long edges densified every 0.25°).

## [1.0.49] - 2026-10-29

### Added
- **Time zones** (toggle Z · Tijdzones): zone outlines and per zone the UTC offset with the current local time, updated every minute (Natural Earth, standard time without DST; `tools/build-tz.mjs`, also in the monthly geo update).

## [1.0.48] - 2026-10-29

### Added
- Cameras: New South Wales (Transport for NSW, 250) and New Zealand (NZTA, ~250), via the fetcher (1.4.1).

## [1.0.47] - 2026-10-29

### Added
- Cameras: Iceland (Vegagerðin, ~500) and British Columbia (DriveBC, ~1,000), relayed hourly by the fetcher (1.4.0, `cameras-extra.json`) because these lists have no browser CORS.

## [1.0.46] - 2026-10-29

### Fixed
- Dark map: CARTO now requires an API key; replaced by the keyless Esri Dark Gray Canvas.

## [1.0.45] - 2026-10-29

### Added
- **Bus, tram, metro (NL)** layer: live positions of Dutch public transport via OVapi GTFS-Realtime (fetcher 1.3.0, `ov.json`), with line, operator and vehicle; line numbers from the static GTFS (read via HTTP ranges, daily).

## [1.0.44] - 2026-10-29

### Changed
- Radio: choosing a station without coordinates in the radio panel flies to its country (when zoom-on-click is on for radio).

## [1.0.43] - 2026-10-29

### Added
- Trains in the US and Canada: Amtrak, Brightline and VIA Rail via the Amtraker API (fetcher 1.2.0), with route, origin and destination in the info box.

## [1.0.42] - 2026-10-29

### Changed
- Detection: speed (km/h) next to the name of aircraft and trains; wider label spacing.

## [1.0.41] - 2026-10-29

### Changed
- No trail for selected trains.

## [1.0.40] - 2026-10-29

### Changed
- NS train details (fetcher 1.1.2): operator, carriages and length in metres, seats per class, bike spaces and facilities; fixed seat count.

## [1.0.39] - 2026-10-29

### Added
- Fetcher version (`VERSION` in `fetcher/server.js`, now 1.1.1): logged at start and served as `/status.json`.
- Fetcher 1.1.1: keeps the previous NS train list when NS returns a partial one.
- NS trains: image and composition (rolling stock, units, seats, length) in the info box, via the fetcher endpoint `/ns/train/{nr}` (NS Virtual Train API, cached 5 min).

## [1.0.38] - 2026-10-29

### Added
- **Trains** layer: live positions in the Netherlands (NS Virtual Train API, key on the VPS) and Finland (Digitraffic), via the fetcher (`trains.json`), with dead reckoning, info box, Detection labels and voice keywords.

## [1.0.37] - 2026-10-29

### Fixed
- No trail for a selected aircraft while it is on the ground (taxiing).

## [1.0.36] - 2026-10-29

### Added
- Aircraft registration and type for civil flights (fetcher joins the weekly tar1090-db/Mictronics aircraft database; type names via `types.json`).
- Info box: photo of the actual aircraft from Planespotters.net (with photographer credit and link), else the Wikipedia image of the model.
- Info box: Wikipedia description of the aircraft model, in the UI language when available.

## [1.0.35] - 2026-10-29

### Fixed
- Detection labels spread over the whole view via a screen grid: after zooming out, newly visible flights get labels too.
- Flight labels no longer blink on data refresh (positions stay dead-reckoned instead of jumping back).

## [1.0.34] - 2026-10-29

### Fixed
- City and province names no longer blink when the view refreshes (labels are updated instead of rebuilt).

### Changed
- Flight backend live at `flights.sinnema.ch`; Caddy now starts after the fetcher (`docker-compose.yml`).

## [1.0.33] - 2026-10-28

### Added
- **Day/night shading** based on the sun position, with an adjustable night brightness slider.
- **GPU rendering**: high-performance GPU preference with 4× MSAA.
- **Cameras**: more sources (London TfL, Finland Fintraffic, California Caltrans, Austin, Calgary, Hong Kong), red camera icons, and an enlarge-image lightbox.
- **Lightbox zoom/pan**: mouse wheel, double-click, +/− buttons, drag and pinch (up to ×12).
- **Space telescopes** layer (Hubble, JWST, Euclid and others) with Wikipedia photos in high resolution (up to 1280 px).
- **Country borders** with country names, using detailed geoBoundaries CGAZ borders when zoomed in.
- **Province/state borders** and labels.
- **City names** depending on zoom level (GeoNames, all places with ≥ 1000 inhabitants).
- **City info** on click: population, elevation, time zone, Wikidata/Wikipedia summary and photo.
- **Monthly geo update**: `update-geo.yml` GitHub Action rebuilds borders and cities and redeploys.
- **Multilingual UI**: English, Dutch, German, French and Chinese (also country names and Wikipedia texts).
- **Keyboard navigation**: arrow keys to pan, `+`/`−` to zoom.
- **Radio panel**: search, country and genre filters, "in view" filter, favourites, previous/next, stop and volume; collapsed by default.
- **Per-layer zoom-on-click** setting (⌖), off by default.
- **Flight data backend** (`fetcher/`): Docker fetcher plus Caddy on a VPS, serving OpenSky flights and adsb.lol military flights as a global snapshot and 10° tiles.

### Changed
- Flights load per tile in view when zoomed in, the global snapshot when zoomed out.
- Sharper labels: glyphs rendered at 2× scale, FXAA off, full device resolution.
- Larger Detection labels.
- Clicking beside the info box closes it.
- Radio playback is independent of the info box.

### Fixed
- Detection overlay turning the screen white and drawing stray dots.
- Detection labels jittering while the globe rotates.
- Night side too dark (contours now visible).
- Missing cities (e.g. Apeldoorn).
- Inaccurate border placement (e.g. Ahfir, Morocco/Algeria).
- Low frame rate with province borders (batched into one GPU primitive).
- Arrow-key navigation changing altitude or moving in the wrong direction.
- Low-resolution Wikipedia images.

### Removed
- All references to "God's Eye".
- Cloudflare Worker/R2 and browser proxy variants of the flight backend.

## [1.0.1] - Initial release

- Blazor WebAssembly single-page app (.NET 10) with a CesiumJS 3D globe.
- Layers: flights, military flights, satellites (SGP4), earthquakes, wildfires, launches, cameras and radio.
- Visual styles, HUD and Detection overlay, place search.
- GitHub Pages deployment (`deploy.yml`) with automatic updates that bypass the browser cache.
- Version number shown top right.
