# Changelog

All notable changes to WorldView. Versions follow `<Version>` in `WorldView/WorldView.csproj`.

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
