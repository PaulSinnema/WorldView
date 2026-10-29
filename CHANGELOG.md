# Changelog

All notable changes to WorldView. Versions follow `<Version>` in `WorldView/WorldView.csproj`.

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
