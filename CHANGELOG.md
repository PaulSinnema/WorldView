# Changelog

All notable changes to WorldView. Versions follow `<Version>` in `WorldView/WorldView.csproj`.

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
