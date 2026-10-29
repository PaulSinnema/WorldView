// WorldView globe engine: CesiumJS + keyless public feeds
const Cz = window.Cesium;
const SETTINGS_KEY = 'wv-settings';
const LAYERS = ['flights', 'military', 'trains', 'ov', 'air', 'satellites', 'telescopes', 'quakes', 'fires', 'launches', 'radio', 'cameras'];
const ORBITERS = ['satellites', 'telescopes'];
const TEL_COLOR = '#00e5ff';
// Earth-orbiting space telescopes (NORAD id, name)
// [NORAD id, name, English Wikipedia title (photo + description)]
const TELESCOPES = [[20580, 'Hubble', 'Hubble Space Telescope'], [25867, 'Chandra', 'Chandra X-ray Observatory'], [25989, 'XMM-Newton', 'XMM-Newton'],
    [33053, 'Fermi', 'Fermi Gamma-ray Space Telescope'], [28485, 'Swift', 'Neil Gehrels Swift Observatory'], [38358, 'NuSTAR', 'NuSTAR'],
    [43435, 'TESS', 'Transiting Exoplanet Survey Satellite'], [49954, 'IXPE', 'Imaging X-ray Polarimetry Explorer'], [57800, 'XRISM', 'XRISM'], [27540, 'INTEGRAL', 'INTEGRAL']];
// Sun-Earth L2 telescopes: no TLE, shown at approximate L2 (offset avoids overlap)
const L2_TELESCOPES = [['jwst', 'James Webb (JWST)', 3e8, 'James Webb Space Telescope'], ['euclid', 'Euclid', -3e8, 'Euclid (spacecraft)']];
const L2_DIST = 1.5e9;
const STYLE_KEYS = ['normal', 'crt', 'nvg', 'flir', 'ironbow', 'noir', 'snow'];
const BILLBOARD_LAYERS = ['flights', 'military', 'trains', 'ov', 'launches', 'cameras'];
const MOVERS = ['flights', 'military', 'trains', 'ov'];
const PLANES = ['flights', 'military'];
const TRAIN_COLOR = '#9dff3a', OV_COLOR = '#ffd23f';
// Public transport per mode: [icon, colour]
const OV_ICONS = { bus: ['bus', OV_COLOR], tram: ['tram', '#ff6b5a'], metro: ['metro', '#4da6ff'], ferry: ['ferry', '#5af0ff'] };
const FT = 0.3048, R_EARTH = 6371000;
const FEED_URL = 'https://flights.sinnema.ch'; // netcup VPS, see fetcher/README.md
const DETECT_COLORS = { flights: '#3fd0ff', military: '#ffb020', trains: TRAIN_COLOR, ov: OV_COLOR, air: '#50f0e6', satellites: '#ffffff', quakes: '#ff5050', fires: '#ff7a1a', launches: '#c080ff', radio: '#ff4fd8', cameras: '#ff3b3b', telescopes: '#00e5ff' };
// Translations (same cache-busting version as this module)
const { LANGS, LOCALES, pickLang, t, strings } = await import(`./i18n.js${new URL(import.meta.url).search}`);
const tr = (key, params) => t(S.lang, key, params);
const loc = () => LOCALES[S.lang] || 'en-GB';
const SAT_GROUPS = [['stations', '#ff5a5a', 'grp.stations'], ['visual', '#ffffff', 'grp.visual'], ['gps-ops', '#4cff8a', 'grp.gps'], ['weather', '#5ac8ff', 'grp.weather'], ['science', '#ffd23f', 'grp.science'], ['geo', '#b07aff', 'grp.geo']];
const RADIO_HOSTS = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info', 'https://fi1.api.radio-browser.info'];
const CITIES = {
    apeldoorn: [52.211, 5.969], amsterdam: [52.373, 4.893], rotterdam: [51.922, 4.479], 'den haag': [52.078, 4.288], utrecht: [52.091, 5.122],
    eindhoven: [51.441, 5.478], groningen: [53.219, 6.567], schiphol: [52.310, 4.768], brussel: [50.847, 4.357], brussels: [50.847, 4.357],
    londen: [51.507, -0.128], london: [51.507, -0.128], parijs: [48.857, 2.352], paris: [48.857, 2.352], berlijn: [52.520, 13.405], berlin: [52.520, 13.405],
    madrid: [40.417, -3.704], rome: [41.903, 12.496], wenen: [48.208, 16.373], vienna: [48.208, 16.373], moskou: [55.756, 37.617], moscow: [55.756, 37.617],
    'new york': [40.713, -74.006], washington: [38.907, -77.037], 'los angeles': [34.052, -118.244], lax: [33.942, -118.408], 'san francisco': [37.775, -122.419],
    austin: [30.267, -97.743], chicago: [41.878, -87.630], tokio: [35.676, 139.650], tokyo: [35.676, 139.650], peking: [39.904, 116.407], beijing: [39.904, 116.407],
    'hong kong': [22.320, 114.169], singapore: [1.352, 103.820], dubai: [25.204, 55.271], sydney: [-33.869, 151.209], kaapstad: [-33.925, 18.424],
    'cape town': [-33.925, 18.424], 'rio de janeiro': [-22.907, -43.173], 'cape canaveral': [28.392, -80.605], kiev: [50.450, 30.523], kyiv: [50.450, 30.523]
};

let viewer = null, dotnet = null, sat = null;
const S = { layers: {}, style: 'normal', basemap: 'esri', ionToken: '', hud: true, detect: false, daynight: true, nightLight: 60, borders: false, regions: true, cities: true, zoom: {}, cockpit: false };
// Per layer: zoom/follow on click
const ZOOM_DEFAULT = { cities: false, flights: false, military: false, trains: false, ov: false, air: false, satellites: false, telescopes: false, quakes: false, fires: false, launches: false, radio: false, cameras: false };
const NIGHT_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
let nightLayer = null;
// Night brightness 0..100 → city-lights blend 0.8..0.05 (60 ≈ 0.35)
const nightAlpha = () => 0.8 - Math.max(0, Math.min(100, S.nightLight)) / 100 * 0.75;
export function setNightLight(v) {
    S.nightLight = Number(v); saveSettings();
    if (nightLayer) nightLayer.nightAlpha = nightAlpha();
}
const store = Object.fromEntries(LAYERS.map(l => [l, new Map()]));
const coll = {};
const gen = {};
const icons = {};
let telLabels = null, telOrbits = null, lastTelOrbit = 0;
let selected = null, trackEntity = null, orbitEntity = null, trail = [];
let styleStage = null, googleTiles = null;
let detectCanvas = null, detectCtx = null, lastDetect = 0, lastCam = 0, lastInfo = 0, lastTrail = 0, lastOrbit = 0;
let audio = null;

const toDeg = r => Cz.Math.toDegrees(r);
const toRad = d => Cz.Math.toRadians(d);
const notify = (m, ...a) => { try { dotnet?.invokeMethodAsync(m, ...a); } catch { } };
const toast = msg => notify('OnToast', msg);

// ---------- settings ----------
function loadSettings() {
    try { Object.assign(S, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { }
    S.cockpit = false;
    if (typeof S.layers !== 'object' || !S.layers) S.layers = {};
    for (const l of LAYERS) if (typeof S.layers[l] !== 'boolean') S.layers[l] = l === 'flights' || l === 'satellites';
    if (!STYLE_KEYS.includes(S.style)) S.style = 'normal';
    if (typeof S.daynight !== 'boolean') S.daynight = true;
    if (!Number.isFinite(S.nightLight)) S.nightLight = 60;
    if (typeof S.regions !== 'boolean') S.regions = true;
    if (typeof S.cities !== 'boolean') S.cities = true;
    if (typeof S.timezones !== 'boolean') S.timezones = false;
    if (typeof S.coast !== 'boolean') S.coast = false;
    if (typeof S.eez !== 'boolean') S.eez = false;
    if (typeof S.nature !== 'boolean') S.nature = false;
    if (typeof S.streets !== 'boolean') S.streets = false;
    if (typeof S.envOverlay !== 'string' || (S.envOverlay && !GRID_LAYERS[S.envOverlay] && !ENV_LAYERS[S.envOverlay])) S.envOverlay = '';
    if (typeof S.envClick !== 'boolean') S.envClick = true;
    S.lang = pickLang(S.lang);
    if (!Array.isArray(S.radioFav)) S.radioFav = [];
    S.zoom = { ...ZOOM_DEFAULT, ...(S.zoom && typeof S.zoom === 'object' ? S.zoom : {}) };
    delete S.camZoom;
    // One-off reset: zoom now defaults to off for every layer
    if (S.zoomV !== 2) { S.zoom = { ...ZOOM_DEFAULT }; S.zoomV = 2; }
}
function saveSettings() {
    try { const { cockpit, ...rest } = S; localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest)); } catch { }
}
function parseHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.has('l')) { const on = h.get('l').split(',').filter(Boolean); for (const l of LAYERS) S.layers[l] = on.includes(l); }
    if (h.has('s') && STYLE_KEYS.includes(h.get('s'))) S.style = h.get('s');
    if (h.has('c')) { const p = h.get('c').split(',').map(Number); if (p.length >= 3 && p.every(Number.isFinite)) return p; }
    return null;
}

// ---------- icons ----------
function makeIcon(kind, color) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); g.translate(16, 16);
    g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 1.5; g.beginPath();
    if (kind === 'plane') {
        const p = [[0, -14], [3, -4], [13, 2], [13, 5], [3, 2], [2, 10], [6, 13], [6, 15], [0, 13], [-6, 15], [-6, 13], [-2, 10], [-3, 2], [-13, 5], [-13, 2], [-3, -4]];
        p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    } else if (kind === 'train') {
        // Top view of a locomotive, nose up
        const p = [[0, -14], [6, -8], [6, 14], [-6, 14], [-6, -8]];
        p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    } else if (kind === 'bus') {
        // Top view of a bus, front up
        g.moveTo(-6, -11); g.quadraticCurveTo(-6, -14, -3, -14); g.lineTo(3, -14); g.quadraticCurveTo(6, -14, 6, -11);
        g.lineTo(6, 14); g.lineTo(-6, 14); g.closePath();
    } else if (kind === 'tram') {
        // Two articulated sections, rounded front
        g.moveTo(-5, -10); g.quadraticCurveTo(-5, -14, 0, -14); g.quadraticCurveTo(5, -14, 5, -10); g.lineTo(5, -1); g.lineTo(-5, -1); g.closePath();
        g.rect(-5, 1, 10, 13);
    } else if (kind === 'metro') {
        // Capsule, rounded at both ends
        g.moveTo(-6, -9); g.arc(0, -9, 6, Math.PI, 0); g.lineTo(6, 9); g.arc(0, 9, 6, 0, Math.PI); g.closePath();
    } else if (kind === 'ferry') {
        // Hull with pointed bow
        const p = [[0, -15], [7, -5], [7, 13], [-7, 13], [-7, -5]];
        p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    } else if (kind === 'rocket') {
        g.moveTo(0, -14); g.lineTo(5, -4); g.lineTo(5, 8); g.lineTo(9, 14); g.lineTo(-9, 14); g.lineTo(-5, 8); g.lineTo(-5, -4); g.closePath();
    } else {
        g.rect(-11, -7, 16, 14); g.moveTo(5, -3); g.lineTo(12, -8); g.lineTo(12, 8); g.lineTo(5, 3); g.closePath();
    }
    g.fill(); g.stroke();
    // Letter marks tram/metro (readable at a glance)
    const mark = { tram: 'T', metro: 'M' }[kind];
    if (mark) { g.fillStyle = 'rgba(0,0,0,0.8)'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(mark, 0, kind === 'tram' ? -6 : 0); }
    return c.toDataURL(); // shared atlas entry via URL id
}
const icon = (kind, color) => icons[kind + color] ??= makeIcon(kind, color);

// ---------- basemap ----------
function imagery(name) {
    // CARTO now shows "API key required" tiles: Esri Dark Gray Canvas (keyless)
    if (name === 'dark') return new Cz.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', maximumLevel: 16, credit: 'Esri, HERE, Garmin, © OpenStreetMap contributors' });
    if (name === 'osm') return new Cz.UrlTemplateImageryProvider({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maximumLevel: 19, credit: '© OpenStreetMap contributors' });
    return new Cz.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maximumLevel: 19, credit: 'Esri, Maxar, Earthstar Geographics' });
}
export async function setBasemap(name) {
    if (name === 'google' && !S.ionToken) return `${S.basemap}|${tr('err.ionNeeded')}`;
    if (googleTiles) { viewer.scene.primitives.remove(googleTiles); googleTiles = null; }
    viewer.scene.globe.show = true;
    if (name === 'google') {
        try {
            googleTiles = await Cz.createGooglePhotorealistic3DTileset();
            viewer.scene.primitives.add(googleTiles);
            viewer.scene.globe.show = false;
            S.basemap = 'google'; saveSettings();
            return 'google|';
        } catch (e) {
            name = 'esri';
            setImagery(name);
            S.basemap = name; saveSettings();
            return `esri|${tr('err.google3d', { e: e?.message ?? e })}`;
        }
    }
    setImagery(name);
    S.basemap = name; saveSettings();
    return `${name}|`;
}
function setImagery(name) {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(imagery(name));
    addNightLayer();
    addEnvLayer();
}
// Environment overlays: NASA GIBS satellite layers, latest available date ('default'); [layer id, max zoom]
const ENV_LAYERS = {
    lstDay: ['MODIS_Terra_L3_Land_Surface_Temp_8Day_Day', 7], lstNight: ['MODIS_Terra_L3_Land_Surface_Temp_8Day_Night', 7],
    sst: ['GHRSST_L4_MUR_Sea_Surface_Temperature', 7], sstAnom: ['GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies', 7],
    // TROPOMI: the latest day is still incomplete, so show the day before yesterday (3rd value = days back)
    no2: ['TROPOMI_L2_Nitrogen_Dioxide_Tropospheric_Column', 6, 2, '#ffee8c', 0.15],
    // SO2: MERRA-2 monthly model field (gap-free); 4th value = palette colour made transparent (clean air)
    so2: ['MERRA2_SO2_Column_Mass_Density_Monthly', 6, 0, '#fff7bc'],
    // Ozone: OMPS daily total column (Dobson units); today is still incomplete, so yesterday
    ozone: ['OMPS_Ozone_Total_Column', 6, 1],
    aod: ['MODIS_Combined_MAIAC_L2G_AerosolOpticalDepth', 7], rain: ['IMERG_Precipitation_Rate', 6],
    ndvi: ['MODIS_Terra_NDVI_8Day', 9], // Snow: SMAP L4 snow mass (satellite-driven land model, daily, gap-free); MODIS optical products confuse clouds with snow
    // (was MODIS_Terra_NDSI_Snow_Cover, then MODIS_Terra_L3_Snow_Extent_8Day)
    snow: ['SMAP_L4_Snow_Mass', 6, 0, '#52626a', 0.02] // grey = no snow → transparent
};
let envLayer = null, envGen = 0;
// Ammonia (NH3, µg/m³): colour stops, low values transparent
const NH3_STOPS = [[2, [255, 255, 80, 0]], [4, [255, 225, 77, 150]], [8, [255, 176, 32, 185]], [15, [255, 90, 26, 210]], [25, [200, 16, 46, 225]], [40, [125, 33, 129, 235]]];
function nh3Rgba(v) {
    if (v == null || v <= NH3_STOPS[0][0]) return [0, 0, 0, 0];
    for (let i = 1; i < NH3_STOPS.length; i++) {
        const [v1, c1] = NH3_STOPS[i];
        if (v <= v1) { const [v0, c0] = NH3_STOPS[i - 1], f = (v - v0) / (v1 - v0); return c0.map((c, k) => Math.round(c + (c1[k] - c) * f)); }
    }
    return NH3_STOPS.at(-1)[1];
}
// Total ozone (DU): rainbow like the usual ozone maps; ozone hole (< 220) dark blue/purple
const O3_STOPS = [[150, [40, 0, 90, 215]], [220, [30, 60, 220, 205]], [260, [0, 200, 230, 190]], [300, [40, 210, 80, 185]], [340, [240, 230, 40, 195]], [380, [255, 130, 20, 205]], [420, [230, 20, 60, 215]], [470, [255, 90, 220, 220]], [500, [255, 220, 255, 225]]];
function o3Rgba(v) {
    if (v == null) return [0, 0, 0, 0];
    if (v <= O3_STOPS[0][0]) return O3_STOPS[0][1];
    for (let i = 1; i < O3_STOPS.length; i++) {
        const [v1, c1] = O3_STOPS[i];
        if (v <= v1) { const [v0, c0] = O3_STOPS[i - 1], f = (v - v0) / (v1 - v0); return c0.map((c, k) => Math.round(c + (c1[k] - c) * f)); }
    }
    return O3_STOPS.at(-1)[1];
}
// Fetcher grids → smooth translucent image: [file, colour fn, credit]
const GRID_LAYERS = { nh3: ['nh3.json', nh3Rgba, 'Open-Meteo / CAMS Europe'], ozoneCams: ['ozone.json', o3Rgba, 'Copernicus CAMS (ECMWF)'] };
async function addGridLayer(gen, [file, rgba, credit]) {
    const d = await tryJson(`${FEED_URL}/${file}?b=${Math.floor(Date.now() / 600000)}`, 20000);
    if (!d?.v || gen !== envGen) { if (!d?.v) toast(tr('err.noData')); return; }
    const small = document.createElement('canvas'); small.width = d.nx; small.height = d.ny;
    const g = small.getContext('2d'), img = g.createImageData(d.nx, d.ny);
    for (let y = 0; y < d.ny; y++) for (let x = 0; x < d.nx; x++) {
        const c = rgba(d.v[y * d.nx + x]), o = ((d.ny - 1 - y) * d.nx + x) * 4; // rows from south → canvas from north
        img.data.set(c, o);
    }
    g.putImageData(img, 0, 0);
    const k = d.nx > 200 ? 6 : 16; // keep the canvas size reasonable for the global grid
    const big = document.createElement('canvas'); big.width = d.nx * k; big.height = d.ny * k;
    const bg = big.getContext('2d'); bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = 'high';
    bg.drawImage(small, 0, 0, big.width, big.height);
    const h = d.step / 2, rect = Cz.Rectangle.fromDegrees(d.w - h, d.s - h, d.w + (d.nx - 1) * d.step + h, d.s + (d.ny - 1) * d.step + h);
    const provider = await Cz.SingleTileImageryProvider.fromUrl(big.toDataURL(), { rectangle: rect, credit });
    if (gen !== envGen) return;
    envLayer = viewer.imageryLayers.addImageryProvider(provider);
}
// Own legend: colour bar as data URL
function gridLegendUrl(rgba, max, ticks, unit, min = 0) {
    const c = document.createElement('canvas'); c.width = 420; c.height = 46;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    for (let x = 0; x < 400; x++) { const [r, gg, b, a] = rgba(min + x / 400 * (max - min)); g.fillStyle = `rgba(${r},${gg},${b},${a / 255})`; g.fillRect(10 + x, 6, 1, 16); }
    g.strokeStyle = '#999'; g.strokeRect(10, 6, 400, 16);
    g.fillStyle = '#222'; g.font = '11px sans-serif'; g.textAlign = 'center';
    for (const v of ticks) g.fillText(String(v), 10 + (v - min) / (max - min) * 400, 36);
    g.textAlign = 'right'; g.fillText(unit, 410, 45);
    return c.toDataURL();
}
const nh3LegendUrl = () => gridLegendUrl(nh3Rgba, 45, [0, 5, 10, 20, 30, 45], 'NH₃ µg/m³');
const o3LegendUrl = () => gridLegendUrl(o3Rgba, 500, [150, 220, 300, 380, 450, 500], 'O₃ Dobson (DU)', 150);
function addEnvLayer() {
    envLayer = null;
    const gen = ++envGen;
    if (GRID_LAYERS[S.envOverlay]) { addGridLayer(gen, GRID_LAYERS[S.envOverlay]); return; }
    const e = ENV_LAYERS[S.envOverlay];
    if (!e) return;
    const time = e[2] ? new Date(Date.now() - e[2] * 86400000).toISOString().slice(0, 10) : 'default';
    envLayer = viewer.imageryLayers.addImageryProvider(new Cz.UrlTemplateImageryProvider({
        url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${e[0]}/default/${time}/GoogleMapsCompatible_Level${e[1]}/{z}/{y}/{x}.png`,
        maximumLevel: e[1], credit: 'NASA GIBS'
    }));
    envLayer.alpha = 0.75;
    // Lowest (clean) values transparent, so only real concentrations show
    if (e[3]) { envLayer.colorToAlpha = Cz.Color.fromCssColorString(e[3]); envLayer.colorToAlphaThreshold = e[4] ?? 0.12; }
}
// Legend image (colour bar with units) from NASA GIBS, named after the palette (from Worldview's config)
const ENV_PALETTE = {
    lstDay: 'MODIS_Land_Surface_Temp', lstNight: 'MODIS_Land_Surface_Temp', sst: 'GHRSST_Sea_Surface_Temperature',
    sstAnom: 'GHRSST_Sea_Surface_Temperature_Anomalies', no2: 'OMI_Nitrogen_Dioxide_Tropo_Column', so2: 'MERRA2_SO2_Column_Mass_Density_Monthly', ozone: 'OMPS_Ozone_Total_Column',
    aod: 'MODIS_VIIRS_AOD', rain: 'GPM_Precipitation_Rate', ndvi: 'MODIS_NDVI', snow: 'SMAP_Snow_Mass'
};
// Layers whose NASA legend is in Kelvin: own legend in °C, built from the GIBS colour map
const KELVIN_LAYERS = { lstDay: 'Land °C', lstNight: 'Land °C' };
const celsiusLegends = {};
async function celsiusLegendUrl(palette, unit) {
    if (celsiusLegends[palette]) return celsiusLegends[palette];
    const r = await fetch(`https://gibs.earthdata.nasa.gov/colormaps/v1.3/${palette}.xml`).catch(() => null);
    if (!r?.ok) return `https://gibs.earthdata.nasa.gov/legends/${palette}_H.png`; // fallback: Kelvin legend
    const doc = new DOMParser().parseFromString(await r.text(), 'text/xml'), stops = [];
    for (const e of doc.getElementsByTagName('ColorMapEntry')) {
        if (e.getAttribute('nodata') === 'true' || e.getAttribute('transparent') === 'true') continue;
        const m = /\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(e.getAttribute('value') || '');
        if (!m || +m[2] - +m[1] > 10) continue; // skip open-ended catch-all classes
        stops.push([(+m[1] + +m[2]) / 2 - 273.15, (e.getAttribute('rgb') || '0,0,0').split(',').map(Number)]);
    }
    if (!stops.length) return `https://gibs.earthdata.nasa.gov/legends/${palette}_H.png`;
    stops.sort((a, b) => a[0] - b[0]);
    const min = stops[0][0], max = stops.at(-1)[0], ticks = [];
    for (let v = Math.ceil(min / 20) * 20; v <= max; v += 20) ticks.push(v);
    const rgba = v => { let best = stops[0]; for (const s of stops) if (Math.abs(s[0] - v) < Math.abs(best[0] - v)) best = s; return [...best[1], 255]; };
    return celsiusLegends[palette] = gridLegendUrl(rgba, max, ticks, unit, min);
}
const envLegend = async () => KELVIN_LAYERS[S.envOverlay] ? celsiusLegendUrl(ENV_PALETTE[S.envOverlay], KELVIN_LAYERS[S.envOverlay])
    : S.envOverlay === 'nh3' ? nh3LegendUrl() : S.envOverlay === 'ozoneCams' ? o3LegendUrl() : ENV_PALETTE[S.envOverlay] ? `https://gibs.earthdata.nasa.gov/legends/${ENV_PALETTE[S.envOverlay]}_H.png` : '';
export function setEnvOverlay(name) {
    S.envOverlay = ENV_LAYERS[name] || GRID_LAYERS[name] ? name : ''; saveSettings();
    if (envLayer) viewer.imageryLayers.remove(envLayer);
    addEnvLayer();
    return envLegend();
}
export const getEnvLegend = () => envLegend();
export function setEnvClick(on) { S.envClick = !!on; saveSettings(); }
// City lights, only visible on the night side
function addNightLayer() {
    nightLayer = viewer.imageryLayers.addImageryProvider(new Cz.UrlTemplateImageryProvider({ url: NIGHT_URL, maximumLevel: 8, credit: 'NASA Black Marble (GIBS)' }));
    nightLayer.dayAlpha = 0.0;
    nightLayer.nightAlpha = nightAlpha(); // partial blend keeps coastlines visible
    nightLayer.brightness = 2.2;
    nightLayer.show = S.daynight;
}
export function setDayNight(on, fromEngine = false) {
    S.daynight = !!on; saveSettings();
    const g = viewer.scene.globe;
    g.enableLighting = S.daynight;
    g.dynamicAtmosphereLighting = S.daynight;
    g.dynamicAtmosphereLightingFromSun = S.daynight;
    if (nightLayer) nightLayer.show = S.daynight;
    if (fromEngine) notify('OnToggle', 'daynight', S.daynight);
}
export function setIonToken(token) {
    S.ionToken = (token || '').trim();
    if (!S.ionToken && S.basemap === 'google') S.basemap = 'esri';
    saveSettings();
    location.reload();
}

// ---------- init ----------
export async function init(containerId, ref) {
    dotnet = ref;
    loadSettings();
    document.documentElement.lang = S.lang;
    if (!Cz) throw new Error(tr('err.cesium'));
    const cam = parseHash();
    Cz.Ion.defaultAccessToken = S.ionToken || '';

    viewer = new Cz.Viewer(containerId, {
        baseLayer: new Cz.ImageryLayer(imagery(S.basemap === 'google' ? 'esri' : S.basemap)),
        terrainProvider: new Cz.EllipsoidTerrainProvider(),
        animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
        sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
        selectionIndicator: false, shouldAnimate: true,
        // Prefer the dedicated GPU (laptops with hybrid graphics), WebGL2 + MSAA
        contextOptions: { requestWebgl1: false, webgl: { powerPreference: 'high-performance', alpha: false } },
        msaaSamples: 4
    });
    checkGpu();
    const scene = viewer.scene;
    // Sharp text: FXAA blurs labels (MSAA handles edges); render at full device resolution
    scene.postProcessStages.fxaa.enabled = false;
    viewer.useBrowserRecommendedResolution = false;
    scene.screenSpaceCameraController.minimumZoomDistance = 30;
    // Keep sun lighting at every zoom level (default lights everything below 10,000 km)
    const globe = scene.globe;
    globe.lightingFadeOutDistance = 1; globe.lightingFadeInDistance = 2;
    // Ground atmosphere turns the night side pitch black; plain shading keeps contours visible
    globe.showGroundAtmosphere = false;
    addNightLayer();
    addEnvLayer();
    setDayNight(S.daynight);
    if (S.ionToken) { try { scene.setTerrain(Cz.Terrain.fromWorldTerrain()); } catch { } }
    if (S.basemap === 'google') { const r = await setBasemap('google'); const msg = r.split('|')[1]; if (msg) toast(msg); }

    for (const l of LAYERS) {
        coll[l] = scene.primitives.add(BILLBOARD_LAYERS.includes(l) ? new Cz.BillboardCollection() : new Cz.PointPrimitiveCollection());
        coll[l].show = S.layers[l];
    }
    telLabels = new Cz.LabelCollection(); // drawn by drawLabels(), not by Cesium
    telOrbits = scene.primitives.add(new Cz.PolylineCollection());
    telLabels.show = telOrbits.show = S.layers.telescopes;
    // L2 lies at ~1.5 million km: extend the far plane
    viewer.camera.frustum.far = 1e10;

    // Map labels: crisp native text on a 2D canvas above the globe (see drawLabels)
    labelCanvas = document.createElement('canvas');
    labelCanvas.className = 'labels';
    document.body.appendChild(labelCanvas);
    labelCtx = labelCanvas.getContext('2d');
    detectCanvas = document.createElement('canvas');
    detectCanvas.className = 'detect';
    document.body.appendChild(detectCanvas);
    detectCtx = detectCanvas.getContext('2d');

    const handler = new Cz.ScreenSpaceEventHandler(scene.canvas);
    // Hand cursor over clickable things (objects, cities, countries, provinces); throttled picking
    let hoverPos = null, hoverQueued = false;
    handler.setInputAction(e => {
        hoverPos = e.endPosition;
        if (hoverQueued) return;
        hoverQueued = true;
        setTimeout(() => {
            hoverQueued = false;
            if (!hoverPos) return;
            const { x, y } = hoverPos;
            let on = labelHits.some(([hx, hy, w, h]) => x >= hx && x <= hx + w && y >= hy && y <= hy + h);
            if (!on) { const id = scene.pick(hoverPos)?.id; on = !!(id?.wv || id?.city || id?.country || id?.region); }
            scene.canvas.style.cursor = on ? 'pointer' : '';
        }, 80);
    }, Cz.ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction(e => {
        // Labels live on the 2D canvas: hit-test them first (cities, countries)
        const hit = labelHits.findLast(([x, y, w, h]) => e.position.x >= x && e.position.x <= x + w && e.position.y >= y && e.position.y <= y + h)?.[4];
        if (hit?.city) { selectCity(hit.city); return; }
        if (hit?.country) { selectCountry(hit.country); return; }
        if (hit?.region) { selectRegion(hit.region); return; }
        const p = scene.pick(e.position);
        if (p?.id?.wv) select(p.id.wv.layer, p.id.wv.key, true);
        else if (p?.id?.city) selectCity(p.id.city);
        else if (p?.id?.country) selectCountry(p.id.country);
        // Click on empty globe/space closes the info box (not while riding in the cockpit)
        else if ((selected || cityPick) && !S.cockpit) clearSelection();
        // Nothing open: local air quality + weather for the clicked spot
        else if (S.envClick && !S.cockpit) {
            const c = viewer.camera.pickEllipsoid(e.position);
            if (c) { const g = Cz.Cartographic.fromCartesian(c); selectSpot(toDeg(g.latitude), toDeg(g.longitude)); }
        }
    }, Cz.ScreenSpaceEventType.LEFT_CLICK);

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    viewer.camera.moveEnd.addEventListener(() => {
        if (radioQuery.inView && S.layers.radio) runRadioSearch();
        if (S.layers.flights) startLayer('flights'); // load the tiles for the new view
    });
    window.addEventListener('blur', () => navHeld.clear());
    scene.preRender.addEventListener(onPreRender);
    scene.postRender.addEventListener(onPostRender);
    setInterval(tick, 250);

    if (cam) viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(cam[1], cam[0], cam[2]), orientation: { heading: toRad(cam[3] || 0), pitch: toRad(cam[4] ?? -90), roll: 0 } });
    else viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(8, 38, 2.2e7) });

    setStyle(S.style);
    if (S.borders) setBorders(true);
    if (S.timezones) setTimezones(true);
    if (S.nature) applyNature();
    if (S.streets) setStreets(true);
    for (const l of LAYERS) if (S.layers[l]) startLayer(l);

    return JSON.stringify({ layers: S.layers, style: S.style, basemap: S.basemap, ionToken: S.ionToken, hud: S.hud, detect: S.detect, dayNight: S.daynight, nightLight: S.nightLight, borders: S.borders, regions: S.regions, cities: S.cities, coast: S.coast, eez: S.eez, nature: S.nature, streets: S.streets, timezones: S.timezones, envOverlay: S.envOverlay, envClick: S.envClick, zoom: S.zoom, gpu: gpuName });
}

// Warn when the browser renders in software (hardware acceleration off or no GPU)
let gpuName = '';
function checkGpu() {
    try {
        const gl = viewer.scene.context._gl;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        gpuName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        if (/swiftshader|llvmpipe|softpipe|basic render|software/i.test(gpuName)) {
            viewer.resolutionScale = 0.75;
            toast(tr('toast.noGpu'));
        }
    } catch { }
}
export const getGpu = () => gpuName;

// ---------- layers ----------
const LOADERS = { flights: loadFlights, military: loadMilitary, trains: loadTrains, ov: loadOv, air: loadAir, satellites: loadSatellites, telescopes: loadTelescopes, quakes: loadQuakes, fires: loadFires, launches: loadLaunches, radio: loadRadio, cameras: loadCameras };

export function setLayer(name, on) { applyLayer(name, on, false); }
function applyLayer(name, on, fromEngine) {
    if (!LAYERS.includes(name)) return;
    S.layers[name] = on; saveSettings();
    coll[name].show = on;
    if (name === 'telescopes') telLabels.show = telOrbits.show = on;
    if (name === 'radio' && !on) radioStop();
    if (on) startLayer(name); else stopLayer(name);
    if (!on && selected?.layer === name) clearSelection();
    if (fromEngine) notify('OnLayerChanged', name, on);
}
function startLayer(name) {
    const my = (gen[name] = (gen[name] || 0) + 1);
    const run = async () => {
        if (gen[name] !== my || !S.layers[name]) return;
        let next = 0;
        try { next = await LOADERS[name](); } catch (e) { report(name, 'st.error', { e: e?.message ?? e }); next = 60000; }
        if (next > 0 && gen[name] === my && S.layers[name]) setTimeout(run, next);
    };
    run();
}
function stopLayer(name) { gen[name] = (gen[name] || 0) + 1; }
// Status = translation key (+params) or a function, re-evaluated on language change
const lastStatus = {};
function report(name, key, params) {
    lastStatus[name] = [key, params];
    notify('OnLayerStatus', name, store[name].size, statusText(name));
}
function statusText(name) {
    const [key, params] = lastStatus[name] || [];
    if (!key) return '';
    return typeof key === 'function' ? key() : tr(key, params);
}
function validateSel(layer) { if (selected?.layer === layer && !store[layer].has(selected.key)) clearSelection(); }
function clearLayer(layer) { coll[layer].removeAll(); store[layer].clear(); }

async function getJson(url, ms = 15000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(t); }
}
async function tryJson(url, ms) { try { return await getJson(url, ms); } catch { return null; } }

function viewCenter() {
    const cv = viewer.scene.canvas;
    const p = viewer.camera.pickEllipsoid(new Cz.Cartesian2(cv.clientWidth / 2, cv.clientHeight / 2));
    const c = p ? Cz.Cartographic.fromCartesian(p) : viewer.camera.positionCartographic;
    return { lat: toDeg(c.latitude), lon: toDeg(c.longitude) };
}
// flights: one shared snapshot served via CDN (see fetcher/)
// civil: [icao, call, lat, lon, altM, gsMs, track, ground, country, squawk, tPos, reg, type]
function fromFeedCivil(a, t) {
    const type = a[12] || '';
    return {
        key: a[0], lat: a[2], lon: a[3], alt: a[4], gs: a[5], track: a[6], ground: !!a[7], mil: false, t: (a[10] || t) * 1000,
        label: a[1] || a[11] || a[0], type,
        info: [['callsign', a[1] || '—'], ['registration', a[11] || '—'], ['type', () => typeText(type)], ['country', a[8] || '—'], ['icao', a[0]], ['squawk', a[9] || '—']]
    };
}
// military: [hex, call, lat, lon, altM, gsMs, track, ground, reg, type, squawk, tPos]
function fromFeedMil(a, t) {
    const type = a[9] || '';
    return {
        key: a[0], lat: a[2], lon: a[3], alt: a[4], gs: a[5], track: a[6], ground: !!a[7], mil: true, t: (a[11] || t) * 1000,
        label: a[1] || a[8] || a[0], type,
        info: [['callsign', a[1] || '—'], ['registration', a[8] || '—'], ['type', () => typeText(type)], ['icao', a[0]], ['squawk', a[10] || '—']]
    };
}

// Aircraft type names (types.json from the fetcher): B738 -> "BOEING 737-800"
let typeNames = null, typesLoading = null;
function loadTypeNames() {
    typesLoading ??= tryJson(`${FEED_URL}/types.json`, 20000).then(j => { typeNames = j || {}; if (selected) pushInfo(); });
    return typesLoading;
}
// "BOEING 737-800" -> "Boeing 737-800" (short acronyms like ATR stay upper case)
const prettyModel = n => n.replace(/\b[A-Z]{4,}\b/g, w => w[0] + w.slice(1).toLowerCase());
function typeText(code) {
    if (!code) return '—';
    if (!typeNames) { loadTypeNames(); return code; }
    const n = typeNames[code];
    return n ? `${prettyModel(n)} (${code})` : code;
}
// Model article on Wikipedia per type code (shared by all aircraft of that type)
const modelWiki = new Map();
function aircraftWiki(r) {
    if (!r.type) return null;
    if (!typeNames) { loadTypeNames(); return { wikiTitle: null }; }
    const name = typeNames[r.type];
    if (!name) return null;
    let m = modelWiki.get(r.type);
    if (!m) {
        m = { wikiTitle: null };
        modelWiki.set(r.type, m);
        const q = encodeURIComponent(`${prettyModel(name)} aircraft`);
        tryJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=1&format=json&origin=*`, 15000).then(j => {
            m.wikiTitle = j?.query?.search?.[0]?.title || '';
            if (selected) pushInfo();
        });
    }
    return m;
}
// NS train composition + image via the fetcher (/ns/train/{nr}, key stays on the VPS)
const nsDetails = new Map(); // nr -> data | null | 'loading'
function nsTrain(key) {
    const nr = key.startsWith('ns-') ? key.slice(3) : '';
    if (!/^\d+$/.test(nr)) return null;
    const d = nsDetails.get(nr);
    if (d !== undefined) return d === 'loading' ? null : d;
    nsDetails.set(nr, 'loading');
    tryJson(`${FEED_URL}/ns/train/${nr}`, 15000).then(j => {
        nsDetails.set(nr, j && !j.error ? j : null);
        if (selected?.key === key) pushInfo();
    });
    return null;
}
// Photo of the actual aircraft (Planespotters.net: credit + link to the photo page required)
const photos = new Map(); // hex -> {src, link, by} | null | 'loading'
function aircraftPhoto(hex) {
    const p = photos.get(hex);
    if (p !== undefined) return p === 'loading' ? null : p;
    photos.set(hex, 'loading');
    tryJson(`https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(hex)}`, 15000).then(j => {
        const f = j?.photos?.[0], src = f?.thumbnail_large?.src || f?.thumbnail?.src;
        photos.set(hex, src ? { src, link: f.link, by: f.photographer } : null);
        if (selected?.key === hex) pushInfo();
    });
    return null;
}
// 30 s bucket keeps the CDN cache key shared by all users
const getFeed = name => tryJson(`${FEED_URL}/${name}.json?b=${Math.floor(Date.now() / 30000)}`, 20000);
const age = t => Math.max(0, Math.round(Date.now() / 1000 - t));
// Zoomed in: only the 10° tiles in view (≈10–40 KB each); zoomed out: the world file (≈360 KB)
async function loadFlights() {
    const idx = await getFeed('flights-index');
    if (!idx?.tiles) { report('flights', 'st.feedDown'); return 30000; }
    const have = new Set(idx.tiles);
    const keys = tilesInView(viewer.camera.computeViewRectangle(), idx.tile, 3).filter(k => have.has(k));
    const zoomed = camHeight() < 4e6 && keys.length > 0;
    const parts = zoomed ? await Promise.all(keys.map(k => getFeed(`flights/${k}`))) : [await getFeed('flights')];
    const ok = parts.filter(p => p?.ac);
    if (!ok.length) { report('flights', 'st.feedDown'); return 30000; }
    const list = ok.flatMap(p => p.ac.map(a => fromFeedCivil(a, p.t)));
    merge('flights', list.filter(f => !store.military.has(f.key)), 'plane', '#3fd0ff');
    report('flights', 'st.age', { src: idx.src, s: age(idx.t) });
    return zoomed ? 30000 : 60000;
}
async function loadMilitary() {
    const j = await getFeed('military');
    if (!j?.ac) { report('military', 'st.feedDown'); return 30000; }
    merge('military', j.ac.map(a => fromFeedMil(a, j.t)), 'plane', '#ffb020');
    report('military', 'st.age', { src: j.src, s: age(j.t) });
    return 20000;
}
// trains: [id, label, lat, lon, speedMs, heading, country, operator, tPos] (NS, Digitraffic, Amtraker via fetcher)
async function loadTrains() {
    const j = await getFeed('trains');
    if (!j?.tr) { report('trains', 'st.feedDown'); return 30000; }
    merge('trains', j.tr.map(a => ({
        key: a[0], lat: a[2], lon: a[3], alt: 0, gs: a[4], track: a[5], ground: false, t: (a[8] || j.t) * 1000, label: a[1],
        // Optional (Amtraker): [9] route, [10] from, [11] to
        info: [['train', a[1]], ['operator', a[7]], ['country', a[6]], ['route', a[9]], ['from', a[10]], ['to', a[11]]].filter(([, v]) => v)
    })), 'train', TRAIN_COLOR);
    report('trains', 'st.age', { src: j.src, s: age(j.t) });
    return 15000;
}
// Dutch public transport: [id, line, lat, lon, speedMs, heading, operator, mode, tPos, vehicle] (OVapi via fetcher)
async function loadOv() {
    const j = await getFeed('ov');
    if (!j?.ov) { report('ov', 'st.feedDown'); return 30000; }
    merge('ov', j.ov.map(a => {
        const mode = () => tr('mode.' + a[7]);
        const [kind, color] = OV_ICONS[a[7]] || OV_ICONS.bus;
        return {
            key: a[0], lat: a[2], lon: a[3], alt: 0, gs: a[4], track: a[5], ground: false, t: (a[8] || j.t) * 1000,
            img: icon(kind, color), noPredict: true, // stops and turns: no dead reckoning, last reported position

            label: `${tr('mode.' + a[7])} ${a[1]}`.trim(),
            info: [['line', a[1] || '—'], ['mode', mode], ['operator', a[6] || '—'], ['vehicle', a[9] || '—']]
        };
    }), 'bus', OV_COLOR);
    report('ov', 'st.age', { src: j.src, s: age(j.t) });
    return 15000;
}
function merge(layer, list, kind, color) {
    const m = store[layer], col = coll[layer], now = Date.now(), img = icon(kind, color);
    for (const f of list) {
        let r = m.get(f.key);
        if (!r) {
            r = f;
            r.bb = col.add({ image: f.img || img, scale: 0.7, alignedAxis: Cz.Cartesian3.UNIT_Z, scaleByDistance: new Cz.NearFarScalar(2e5, 1.0, 1.5e7, 0.45), id: { wv: { layer, key: f.key } } });
            m.set(f.key, r);
        } else {
            if (f.img && f.img !== r.img) r.bb.image = f.img; // vehicle changed type
            Object.assign(r, f);
        }
        r.t = Math.min(f.t || now, now); r.seen = now;
        r.bb.rotation = -toRad(r.track || 0);
        // Dead-reckoned position, same as tick(): no jump back on refresh
        const [la, lo, al] = posAt(r, now);
        r.bb.position = Cz.Cartesian3.fromDegrees(lo, la, al);
    }
    for (const [k, r] of m) if (now - r.seen > 120000) { col.remove(r.bb); m.delete(k); }
    validateSel(layer);
}
function posAt(r, now) {
    if (!r.gs || r.ground || r.noPredict) return [r.lat, r.lon, r.alt];
    const dt = Math.min(300, (now - r.t) / 1000), d = r.gs * dt, tr = toRad(r.track || 0);
    const lat = r.lat + toDeg(d * Math.cos(tr) / R_EARTH);
    const lon = r.lon + toDeg(d * Math.sin(tr) / (R_EARTH * Math.max(0.05, Math.cos(toRad(r.lat)))));
    return [lat, lon, r.alt];
}

// satellites
async function tleGroup(g) {
    const ck = 'wv-tle-' + g;
    try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < 6 * 3600000) return c.d; } catch { }
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    try {
        const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`, { signal: ctl.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.text();
        try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d })); } catch { }
        return d;
    } finally { clearTimeout(t); }
}
async function loadSatellites() {
    sat ??= await import('https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/+esm');
    if (!store.satellites.size) {
        for (const [g, color, label] of SAT_GROUPS) {
            let txt;
            try { txt = await tleGroup(g); } catch { continue; }
            const lines = txt.split(/\r?\n/).map(s => s.trimEnd()).filter(Boolean);
            for (let i = 0; i + 2 < lines.length; i += 3) {
                const name = lines[i].trim(), l1 = lines[i + 1], l2 = lines[i + 2];
                if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) continue;
                const id = l1.substring(2, 7).trim();
                if (store.satellites.has(id)) continue;
                let rec;
                try { rec = sat.twoline2satrec(l1, l2); } catch { continue; }
                const r = { key: id, label: name, rec, group: label, color, lat: 0, lon: 0, alt: 0, vel: 0 };
                r.pt = coll.satellites.add({ pixelSize: g === 'stations' ? 7 : 4, color: Cz.Color.fromCssColorString(color), outlineColor: Cz.Color.BLACK, outlineWidth: 1, id: { wv: { layer: 'satellites', key: id } } });
                store.satellites.set(id, r);
            }
        }
        propagateSats();
    }
    report('satellites', store.satellites.size ? () => 'CelesTrak (SGP4)' : 'st.sourceDown');
    return store.satellites.size ? 0 : 120000;
}
function satGeo(r, date, gmst) {
    const pv = sat.propagate(r.rec, date);
    if (!pv || !pv.position || typeof pv.position !== 'object') return null;
    const g = sat.eciToGeodetic(pv.position, gmst ?? sat.gstime(date));
    return { lat: g.latitude, lon: g.longitude, h: g.height * 1000, v: pv.velocity };
}
function propagateSats() {
    if (!sat || !S.layers.satellites) return;
    const now = new Date(), gmst = sat.gstime(now);
    for (const r of store.satellites.values()) {
        const g = satGeo(r, now, gmst);
        if (!g) { r.pt.show = false; continue; }
        r.lat = toDeg(g.lat); r.lon = toDeg(g.lon); r.alt = g.h;
        r.vel = g.v ? Math.hypot(g.v.x, g.v.y, g.v.z) : 0;
        r.pos = Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h);
        r.pt.position = r.pos; r.pt.show = true;
    }
}
function drawOrbit(r) {
    if (orbitEntity) { viewer.entities.remove(orbitEntity); orbitEntity = null; }
    if (!sat || !r.rec?.no) return;
    const now = new Date(), gmst = sat.gstime(now), period = 2 * Math.PI / r.rec.no, pts = [];
    for (let i = 0; i <= 180; i++) {
        const g = satGeo(r, new Date(now.getTime() + i / 180 * period * 60000), gmst);
        if (g) pts.push(Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h));
    }
    orbitEntity = viewer.entities.add({ polyline: { positions: pts, width: 1.5, material: Cz.Color.fromCssColorString(r.color).withAlpha(0.7) } });
}

// country borders + names (Natural Earth, public domain)
const NE_BASE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/';
let borderLines = null, countryLabels = null, bordersLoading = null, countryProps = [];
// Natural Earth carries NAME_EN/NL/DE/FR/ZH
const countryName = p => p[`NAME_${S.lang.toUpperCase()}`] || p.NAME_EN || p.NAME;
function relabelCountries() {
    if (!countryLabels) return;
    for (let i = 0; i < countryLabels.length; i++) countryLabels.get(i).text = countryName(countryProps[i]).toUpperCase();
}
export async function setBorders(on, fromEngine = false) {
    S.borders = !!on; saveSettings();
    if (fromEngine) notify('OnToggle', 'borders', S.borders);
    if (S.borders && !borderLines) await loadBorders();
    if (countryLabels) countryLabels.show = S.borders;
    await applyOverlays();
}

// Detailed borders (geoBoundaries, tools/build-borders.mjs): 5° tiles when zoomed in, else the coarse line
const DETAIL_BORDER_H = 1e6;
let borderTileSize = 5, borderTileKeys = new Set();
const borderTiles = new Map(); // key -> primitive | 'loading'
function refreshBorders(rect, h) {
    const detail = S.borders && h < DETAIL_BORDER_H && borderTileKeys.size > 0;
    const visible = new Set(detail ? tilesInView(rect, borderTileSize, 8) : []);
    // Coarse line stays until every visible detail tile is loaded
    const pending = [...visible].some(k => borderTileKeys.has(k) && !(borderTiles.get(k) instanceof Cz.Primitive));
    if (borderLines) borderLines.show = S.borders && (!detail || visible.size === 0 || pending);
    for (const k of visible) {
        if (!borderTileKeys.has(k) || borderTiles.has(k)) continue;
        borderTiles.set(k, 'loading');
        tryJson(`data/borders/${k}.json`, 20000).then(d => {
            if (!d) { borderTiles.delete(k); return; }
            borderTiles.set(k, viewer.scene.primitives.add(linePrimitive(d, Cz.Color.WHITE.withAlpha(0.8), 1.5)));
            refreshOverlayLabels();
        });
    }
    for (const [k, p] of borderTiles) if (p !== 'loading') p.show = visible.has(k);
}
function loadBorders() {
    bordersLoading ??= (async () => {
        // 10m borders (built by tools/build-geo.mjs) for accurate positions near border towns
        const [lines, countries, index] = await Promise.all([
            tryJson('data/admin0-lines.json', 30000),
            tryJson(NE_BASE + 'ne_110m_admin_0_countries.geojson', 30000),
            tryJson('data/borders-index.json', 15000)]);
        if (!lines || !countries) { bordersLoading = null; toast(tr('toast.bordersFail')); return; }
        if (index?.tiles) { borderTileSize = index.tile; borderTileKeys = new Set(index.tiles); }
        const pl = linePrimitive(lines, Cz.Color.WHITE.withAlpha(0.75), 1.5);
        const lc = new Cz.LabelCollection();
        countryProps = [];
        for (const f of countries.features) {
            const p = f.properties, name = countryName(p);
            if (!name || !Number.isFinite(p.LABEL_X) || !Number.isFinite(p.LABEL_Y)) continue;
            countryProps.push(p);
            // Small countries only appear when zoomed in
            const rank = p.LABELRANK ?? 5, far = rank <= 2 ? 3e7 : rank <= 4 ? 1.2e7 : 5e6;
            lc.add({
                id: { country: p },
                position: Cz.Cartesian3.fromDegrees(p.LABEL_X, p.LABEL_Y, 200), text: name.toUpperCase(),
                font: '600 26px "Share Tech Mono", monospace', scale: 0.5, fillColor: Cz.Color.WHITE.withAlpha(0.9),
                outlineColor: Cz.Color.BLACK, outlineWidth: 5, style: Cz.LabelStyle.FILL_AND_OUTLINE,
                horizontalOrigin: Cz.HorizontalOrigin.CENTER, verticalOrigin: Cz.VerticalOrigin.CENTER,
                distanceDisplayCondition: new Cz.DistanceDisplayCondition(0, far), scaleByDistance: new Cz.NearFarScalar(1e6, 1.1, 2e7, 0.75)
            });
        }
        borderLines = viewer.scene.primitives.add(pl);
        countryLabels = lc; // drawn by drawLabels()
    })();
    return bordersLoading;
}

// Time zones (Natural Earth, tools/build-tz.mjs): outlines + "UTC+1 · 15:13" per zone (standard time, no DST)
let tzLines = null, tzLabels = null, tzFill = null, tzFillIds = [], tzZones = [], tzLoading = null, tzMinute = -1, tzSel = null;
const TZ_COLOR = '#c080ff';
// Fill colours: neighbouring whole-hour zones get different colours
const TZ_PALETTE = ['#ff5a5a', '#ffb020', '#ffe14d', '#5dffa8', '#3fd0ff', '#b07aff'];
const tzFillColor = i => {
    const p = TZ_PALETTE[((Math.floor(tzZones[i][0]) % 6) + 6) % 6];
    const a = tzSel === null ? 0.16 : tzSel === i ? 0.55 : 0.05;
    return Cz.Color.fromCssColorString(p).withAlpha(a);
};
function tzFillPrimitive(d) {
    const s = d.s, instances = [];
    d.l.forEach((ring, n) => {
        const flat = []; let x = 0, y = 0;
        for (let i = 0; i < ring.length; i += 2) { x += ring[i]; y += ring[i + 1]; flat.push(x / s, Math.max(-89.5, Math.min(89.5, y / s))); }
        if (flat.length < 6) return;
        const id = { tz: d.lz[n], n };
        tzFillIds.push(id);
        instances.push(new Cz.GeometryInstance({
            id, geometry: new Cz.PolygonGeometry({ polygonHierarchy: new Cz.PolygonHierarchy(Cz.Cartesian3.fromDegreesArray(flat)), height: 0, granularity: Cz.Math.RADIANS_PER_DEGREE }),
            attributes: { color: Cz.ColorGeometryInstanceAttribute.fromColor(tzFillColor(d.lz[n])) }
        }));
    });
    return new Cz.Primitive({ geometryInstances: instances, appearance: new Cz.PerInstanceColorAppearance({ translucent: true, flat: true }), allowPicking: false, asynchronous: true });
}
// Highlight one zone (index into tzZones) or none (null)
export function setTzSelected(i) {
    tzSel = Number.isInteger(i) && tzZones[i] ? i : null;
    // Turn the globe to the zone at the equator (keep a height that shows the whole zone)
    if (tzSel !== null) flyTo(tzZones[tzSel][1], 0, Math.max(camHeight(), 1.2e7), 1.8);
    if (!tzFill?.ready) return;
    for (const id of tzFillIds) {
        const a = tzFill.getGeometryInstanceAttributes(id);
        if (a) a.color = Cz.ColorGeometryInstanceAttribute.toValue(tzFillColor(id.tz), a.color);
    }
}
export const getTzZones = () => JSON.stringify(tzZones.map(([zone]) => zone));
export async function setTimezones(on, fromEngine = false) {
    S.timezones = !!on; saveSettings();
    if (fromEngine) notify('OnToggle', 'timezones', S.timezones);
    if (S.timezones && !tzLines) {
        tzLoading ??= (async () => {
            const d = await tryJson('data/timezones.json', 20000);
            if (!d) { tzLoading = null; return; }
            tzZones = d.z;
            tzFill = viewer.scene.primitives.add(tzFillPrimitive(d));
            // Long straight edges (meridians/parallels): densify every 0.25° to follow the curvature
            tzLines = viewer.scene.primitives.add(linePrimitive(d, Cz.Color.fromCssColorString(TZ_COLOR).withAlpha(0.55), 1.2, 0.25));
            tzLabels = new Cz.LabelCollection(); // drawn by drawLabels()
            const color = Cz.Color.fromCssColorString(TZ_COLOR);
            for (const [, lon, lat] of tzZones)
                tzLabels.add({ position: Cz.Cartesian3.fromDegrees(lon, lat, 300), text: '', ...labelStyle(13, color),
                    horizontalOrigin: Cz.HorizontalOrigin.CENTER, verticalOrigin: Cz.VerticalOrigin.CENTER, distanceDisplayCondition: new Cz.DistanceDisplayCondition(0, 3e7) });
            tzMinute = -1; updateTzLabels();
        })();
        await tzLoading;
    }
    if (tzLines) tzLines.show = tzLabels.show = tzFill.show = S.timezones;
}
function updateTzLabels() {
    if (!tzLabels || !S.timezones) return;
    const now = Date.now(), minute = Math.floor(now / 60000);
    if (minute === tzMinute) return;
    tzMinute = minute;
    tzZones.forEach(([zone], i) => {
        const t = new Date(now + zone * 3600000), sign = zone < 0 ? '−' : '+', a = Math.abs(zone);
        const off = zone === 0 ? 'UTC' : `UTC${sign}${Math.floor(a)}${a % 1 ? ':' + String(Math.round(a % 1 * 60)).padStart(2, '0') : ''}`;
        tzLabels.get(i).text = `${off} · ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
    });
}

// Decode { s, l: delta-encoded lines } into one batched primitive (single draw call)
// maxStep (degrees): densify long segments so straight chords follow the curvature
function linePrimitive(data, color, width, maxStep = 0) {
    const s = data.s || 100, rows = data.l || data;
    const attr = Cz.ColorGeometryInstanceAttribute.fromColor(color);
    const instances = [];
    for (const d of rows) {
        const flat = []; let x = 0, y = 0, px = null, py = null;
        for (let i = 0; i < d.length; i += 2) {
            x += d[i]; y += d[i + 1];
            const lon = x / s, lat = Math.max(-89.5, Math.min(89.5, y / s));
            if (maxStep && px !== null) {
                const n = Math.ceil(Math.max(Math.abs(lon - px), Math.abs(lat - py)) / maxStep);
                for (let k = 1; k < n; k++) flat.push(px + (lon - px) * k / n, py + (lat - py) * k / n);
            }
            if (lon !== px || lat !== py) flat.push(lon, lat);
            px = lon; py = lat;
        }
        if (flat.length < 4) continue;
        instances.push(new Cz.GeometryInstance({
            geometry: new Cz.PolylineGeometry({ positions: Cz.Cartesian3.fromDegreesArray(flat), width, arcType: Cz.ArcType.NONE }),
            attributes: { color: attr }
        }));
    }
    return new Cz.Primitive({ geometryInstances: instances, appearance: new Cz.PolylineColorAppearance({ translucent: true }), asynchronous: true });
}

// Provinces/states + cities: compact files built by tools/build-geo.mjs
let regionLines = null, regionLabels = null, regionsLoading = null;
let cityLabels = null, cityDots = null, citiesLoading = null;
const camHeight = () => viewer.camera.positionCartographic.height;
// Glyphs rasterized at 2x and scaled down for crisp edges
const labelStyle = (size, color) => ({
    font: `${size * 2}px "Share Tech Mono", monospace`, scale: 0.5, fillColor: color, outlineColor: Cz.Color.BLACK, outlineWidth: 5,
    style: Cz.LabelStyle.FILL_AND_OUTLINE, disableDepthTestDistance: 2e6
});
export async function setRegions(on) {
    S.regions = !!on; saveSettings();
    await applyOverlays();
}
export async function setCities(on) {
    S.cities = !!on; saveSettings();
    await applyOverlays();
}
// Coastlines and maritime boundaries (tools/build-sea.mjs), also under the borders switch
let coastLines = null, eezLines = null, seaLoading = {};
const EEZ_STYLE = { agreed: ['#3fd0ff', 0.75, 1.5], limit: ['#3fd0ff', 0.35, 1.0], disputed: ['#ff9f40', 0.85, 1.5] };
export async function setCoast(on) { S.coast = !!on; saveSettings(); await applySea(); }
export async function setEez(on) { S.eez = !!on; saveSettings(); await applySea(); }
async function applySea() {
    const showCoast = S.borders && S.coast, showEez = S.borders && S.eez;
    if (showCoast && !coastLines) await (seaLoading.coast ??= (async () => {
        const d = await tryJson('data/coastline.json', 30000);
        if (d) coastLines = viewer.scene.primitives.add(linePrimitive(d, Cz.Color.fromCssColorString('#bfe8ff').withAlpha(0.55), 1.0));
        else seaLoading.coast = null;
    })());
    if (showEez && !eezLines) await (seaLoading.eez ??= (async () => {
        const d = await tryJson('data/eez.json', 30000);
        if (!d) { seaLoading.eez = null; return; }
        eezLines = Object.entries(EEZ_STYLE).map(([k, [c, a, w]]) =>
            viewer.scene.primitives.add(linePrimitive({ s: d.s, l: d[k] || [] }, Cz.Color.fromCssColorString(c).withAlpha(a), w)));
    })());
    if (showCoast && !coastTileKeys) {
        const idx = await tryJson('data/coast-index.json', 15000);
        coastTileKeys = new Set(idx?.tiles || []); coastTileSize = idx?.tile || 5;
    }
    if (eezLines) for (const p of eezLines) p.show = showEez;
    refreshCoast();
}
// Detailed OSM coastline (tools/build-coast.mjs): 5° tiles when zoomed in, else the coarse Natural Earth line
const DETAIL_COAST_H = 1.5e6;
const COAST_MIN_H = 5e4; // hide coastlines below 50 km
let coastTileKeys = null, coastTileSize = 5;
const coastTiles = new Map(); // key -> primitive | 'loading'
function refreshCoast() {
    if (!viewer) return;
    const h = camHeight(), show = S.borders && S.coast && h >= COAST_MIN_H;
    const detail = show && h < DETAIL_COAST_H && coastTileKeys?.size > 0;
    const visible = new Set(detail ? tilesInView(viewer.camera.computeViewRectangle(), coastTileSize, 8) : []);
    // Coarse line stays until every visible detail tile is loaded
    const pending = [...visible].some(k => coastTileKeys.has(k) && !(coastTiles.get(k) instanceof Cz.Primitive));
    if (coastLines) coastLines.show = show && (!detail || visible.size === 0 || pending);
    for (const k of visible) {
        if (!coastTileKeys.has(k) || coastTiles.has(k)) continue;
        coastTiles.set(k, 'loading');
        tryJson(`data/coast/${k}.json`, 20000).then(d => {
            if (!d) { coastTiles.delete(k); return; }
            coastTiles.set(k, viewer.scene.primitives.add(linePrimitive(d, Cz.Color.fromCssColorString('#bfe8ff').withAlpha(0.6), 1.0)));
            refreshCoast();
        });
    }
    for (const [k, p] of coastTiles) if (p !== 'loading') p.show = visible.has(k);
}
// Nature names: seas, rivers, lakes, peaks, landscapes (tools/build-nature.mjs) + OpenStreetMap detail when zoomed in
let natureData = null, natureLabels = null, natureLoading = null, natureHooked = false;
const natureShown = new Map(); // feature -> label
// kind: [font size, colour, italic]
const NATURE_STYLE = { o: [13, '#8fd3ff', true], r: [11, '#7cc4ff', true], l: [11, '#7cc4ff', true], p: [11, '#f0dcb4', false], m: [12, '#e8d5a8', false] };
const OSM_NATURE_H = 8e4;
const zoomOf = h => Math.log2(3e7 / Math.max(h, 1));
export async function setNature(on) { S.nature = !!on; saveSettings(); await applyNature(); }
async function applyNature() {
    if (S.nature && !natureData) await (natureLoading ??= (async () => {
        const d = await tryJson('data/nature.json', 30000);
        if (!d) { natureLoading = null; toast(tr('toast.natureFail')); return; }
        natureData = d.map(([k, lon, lat, z, name, n, ele]) => ({ k, lon, lat, z, name, n: n || null, ele, carto: Cz.Cartographic.fromDegrees(lon, lat) }));
        natureLabels = new Cz.LabelCollection(); // drawn by drawLabels()
    })());
    if (!natureHooked && natureLabels) {
        natureHooked = true;
        viewer.camera.percentageChanged = Math.min(viewer.camera.percentageChanged, 0.15);
        viewer.camera.changed.addEventListener(refreshNature);
        viewer.camera.moveEnd.addEventListener(refreshNature);
    }
    refreshNature();
}
function natureText(f) {
    const n = f.n?.[S.lang] || f.name;
    return f.k === 'p' ? `▲ ${n}${f.ele ? ` ${f.ele} m` : ''}` : f.k === 'm' ? n.toUpperCase() : n;
}
function refreshNature() {
    if (!viewer || !natureLabels) return;
    const h = camHeight(), rect = viewer.camera.computeViewRectangle(), want = new Map();
    if (S.nature) {
        const z = zoomOf(h) + 1;
        const list = h < OSM_NATURE_H ? natureData.concat(osmNatureInView(rect)) : natureData;
        const toWin = Cz.SceneTransforms.worldToWindowCoordinates ?? Cz.SceneTransforms.wgs84ToWindowCoordinates;
        const placed = [];
        for (const f of list) { // most important first
            if (f.z > z || !inView(rect, f.carto)) continue;
            const text = natureText(f), size = NATURE_STYLE[f.k][0];
            const s = toWin(viewer.scene, Cz.Cartesian3.fromDegrees(f.lon, f.lat, 100));
            if (s) {
                const w = text.length * size * 0.62 + 6, x = s.x - w / 2;
                // Declutter, and one label per name nearby (rivers in pieces)
                if (placed.some(p => (x < p.x + p.w && x + w > p.x && Math.abs(s.y - p.y) < size + 6) || (p.t === text && Math.hypot(p.cx - s.x, p.y - s.y) < 300))) continue;
                placed.push({ x, y: s.y, w, cx: s.x, t: text });
            }
            want.set(f, text);
            if (want.size >= 200) break;
        }
    }
    for (const [f, lb] of natureShown) if (want.get(f) !== lb.text) { natureLabels.remove(lb); natureShown.delete(f); }
    for (const [f, text] of want) {
        if (natureShown.has(f)) continue;
        const [size, color, italic] = NATURE_STYLE[f.k], st = labelStyle(size, Cz.Color.fromCssColorString(color));
        if (italic) st.font = 'italic ' + st.font;
        natureShown.set(f, natureLabels.add({ position: Cz.Cartesian3.fromDegrees(f.lon, f.lat, 100), text, ...st,
            horizontalOrigin: Cz.HorizontalOrigin.CENTER, verticalOrigin: Cz.VerticalOrigin.CENTER }));
    }
}
// OpenStreetMap names from OpenFreeMap vector tiles (OpenMapTiles schema): rivers, canals, lakes, bays, peaks
const OMT_TILEJSON = 'https://tiles.openfreemap.org/planet';
const osmNatureTiles = new Map(); // "z/x/y" -> rows | 'loading' | 'failed'
let omtTemplate = null, osmNatureRefreshQueued = false;
// Web-mercator tiles [z, x, y] covering the view: most detailed zoom (maxZ..minZ) that needs at most maxTiles
function omtTilesInView(rect, maxZ, minZ, maxTiles = 48) {
    if (!rect) return [];
    const w = toDeg(rect.west), e = toDeg(rect.east);
    if (e < w) return []; // antimeridian: skip
    let z = maxZ + 1, n, x0, x1, y0, y1;
    do {
        n = 2 ** --z;
        const tx = lon => Math.max(0, Math.min(n - 1, Math.floor((lon + 180) / 360 * n)));
        const ty = lat => { const r = toRad(Math.max(-85, Math.min(85, lat))); return Math.max(0, Math.min(n - 1, Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n))); };
        x0 = tx(w); x1 = tx(e); y0 = ty(toDeg(rect.north)); y1 = ty(toDeg(rect.south));
    } while ((x1 - x0 + 1) * (y1 - y0 + 1) > maxTiles && z > minZ);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > maxTiles) return [];
    const out = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([z, x, y]);
    return out;
}
// Tilted view reaches the horizon: limit the view rectangle to the area around the point the camera looks at
function nearRect(rect, h) {
    const c = viewer.camera.pickEllipsoid(new Cz.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2));
    const g = c ? Cz.Cartographic.fromCartesian(c) : viewer.camera.positionCartographic;
    const dLat = Math.max(h * 3, 3000) / 111320, dLon = dLat / Math.max(0.1, Math.cos(g.latitude));
    const lat = toDeg(g.latitude), lon = toDeg(g.longitude);
    const near = Cz.Rectangle.fromDegrees(lon - dLon, Math.max(-89, lat - dLat), lon + dLon, Math.min(89, lat + dLat));
    return rect ? Cz.Rectangle.intersection(rect, near) || near : near;
}
// One OpenFreeMap vector tile, decoded
async function fetchOmt(z, x, y) {
    omtTemplate ??= (await tryJson(OMT_TILEJSON, 15000))?.tiles?.[0];
    if (!omtTemplate) throw new Error('tilejson');
    const r = await fetch(omtTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return decodeMvt(await r.arrayBuffer());
}
// Tile pixel (0..extent) → lon/lat
function omtLonLat(z, x, y, px, py, extent) {
    const n = 2 ** z, X = x + px / extent, Y = y + py / extent;
    return [X / n * 360 - 180, toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * Y / n))))];
}
function osmNatureInView(rect) {
    const out = [];
    for (const [z, x, y] of omtTilesInView(nearRect(rect, camHeight()), 12, 9)) { // canals appear from z12
        const k = `${z}/${x}/${y}`, t = osmNatureTiles.get(k);
        if (Array.isArray(t)) out.push(...t);
        else if (!t) loadOsmNatureTile(k, z, x, y);
    }
    return out;
}
const OSM_KIND_ORDER = { o: 0, l: 1, r: 2, p: 3 };
const SEA_CLASSES = new Set(['ocean', 'sea', 'bay', 'strait', 'gulf', 'sound', 'channel', 'fjord', 'lagoon']);
async function loadOsmNatureTile(k, z, x, y) {
    osmNatureTiles.set(k, 'loading');
    try {
        const layers = await fetchOmt(z, x, y), seen = new Set(), rows = [];
        for (const [ln, kindOf] of [['water_name', t => SEA_CLASSES.has(t.class) ? 'o' : 'l'], ['waterway', () => 'r'], ['mountain_peak', () => 'p']]) {
            const L = layers[ln];
            if (!L) continue;
            for (const f of L.feats) {
                const t = {};
                for (let i = 0; i < f.tags.length; i += 2) t[L.keys[f.tags[i]]] = L.values[f.tags[i + 1]];
                if (!t.name || !f.pt) continue;
                const kind = kindOf(t);
                if (seen.has(kind + t.name)) continue; // one per name per tile
                seen.add(kind + t.name);
                const [lon, lat] = omtLonLat(z, x, y, f.pt[0], f.pt[1], L.extent);
                const names = {};
                for (const l of Object.keys(LANGS)) if (t['name:' + l]) names[l] = t['name:' + l];
                rows.push({ k: kind, lon, lat, z: 0, name: t.name, n: names, ele: kind === 'p' && t.ele ? Math.round(t.ele) : null, carto: Cz.Cartographic.fromDegrees(lon, lat) });
            }
        }
        rows.sort((a, b) => OSM_KIND_ORDER[a.k] - OSM_KIND_ORDER[b.k]);
        osmNatureTiles.set(k, rows);
        // Many tiles arrive together: one refresh per frame
        if (!osmNatureRefreshQueued) { osmNatureRefreshQueued = true; requestAnimationFrame(() => { osmNatureRefreshQueued = false; refreshNature(); }); }
    } catch {
        osmNatureTiles.set(k, 'failed');
        setTimeout(() => osmNatureTiles.delete(k), 30000); // retry later
    }
}
// Street names (OpenMapTiles transportation_name), drawn along the street by drawLabels below 6 km
const STREETS_MAX_H = 10000;
const streetTiles = new Map(); // "z/x/y" -> rows | 'loading' | 'failed'
let streetShown = [], streetsHooked = false, streetRefreshQueued = false;
const STREET_SKIP = /^(path|track|service|bridleway|ferry|rail|transit|aerialway|pier)$/;
const STREET_MAJOR = /^(motorway|trunk|primary|secondary)$/;
export function setStreets(on) {
    S.streets = !!on; saveSettings();
    if (S.streets && !streetsHooked) {
        streetsHooked = true;
        viewer.camera.percentageChanged = Math.min(viewer.camera.percentageChanged, 0.15);
        viewer.camera.changed.addEventListener(refreshStreets);
        viewer.camera.moveEnd.addEventListener(refreshStreets);
    }
    refreshStreets();
}
async function loadStreetTile(k, z, x, y) {
    streetTiles.set(k, 'loading');
    try {
        const L = (await fetchOmt(z, x, y)).transportation_name, rows = [], placed = new Map(); // name -> label points (tile units)
        const ext = L?.extent || 4096, step = ext / 4, minGap = ext / 8; // ≈ 1 label per 400 m at z14
        const ll = p => omtLonLat(z, x, y, p[0], p[1], ext);
        for (const f of L?.feats || []) {
            const t = {};
            for (let i = 0; i < f.tags.length; i += 2) t[L.keys[f.tags[i]]] = L.values[f.tags[i + 1]];
            if (!t.name || STREET_SKIP.test(t.class || '') || !f.line || f.line.length < 2) continue;
            // Label points along the line: every `step`, or the middle for short streets
            const seg = [];
            let len = 0;
            for (let i = 1; i < f.line.length; i++) { const d = Math.hypot(f.line[i][0] - f.line[i - 1][0], f.line[i][1] - f.line[i - 1][1]); seg.push(d); len += d; }
            const n = Math.max(1, Math.floor(len / step)), at = [];
            for (let j = 0; j < n; j++) at.push(len * (j + 0.5) / n);
            const pts = placed.get(t.name) || [];
            let i = 0, acc = 0;
            for (const d of at) {
                while (i < seg.length - 1 && acc + seg[i] < d) acc += seg[i++];
                const a = f.line[i], b = f.line[i + 1], k = seg[i] ? (d - acc) / seg[i] : 0;
                const p = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
                if (pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < minGap)) continue; // same street, other piece close by
                pts.push(p);
                const [lon, lat] = ll(p), [alon, alat] = ll(a), [blon, blat] = ll(b);
                rows.push({ text: t.name, major: STREET_MAJOR.test(t.class || ''), carto: Cz.Cartographic.fromDegrees(lon, lat),
                    pos: Cz.Cartesian3.fromDegrees(lon, lat, 5), a: Cz.Cartesian3.fromDegrees(alon, alat, 5), b: Cz.Cartesian3.fromDegrees(blon, blat, 5) });
            }
            placed.set(t.name, pts);
        }
        streetTiles.set(k, rows);
        if (!streetRefreshQueued) { streetRefreshQueued = true; requestAnimationFrame(() => { streetRefreshQueued = false; refreshStreets(); }); }
    } catch {
        streetTiles.set(k, 'failed');
        setTimeout(() => streetTiles.delete(k), 30000); // retry later
    }
}
function refreshStreets() {
    streetShown = [];
    if (!viewer || !S.streets || camHeight() > STREETS_MAX_H) return;
    const rect = viewer.camera.computeViewRectangle(), list = [];
    for (const [z, x, y] of omtTilesInView(nearRect(rect, camHeight()), 14, 12, 64)) { // street names: z14 all, z12–13 main roads
        const k = `${z}/${x}/${y}`, t = streetTiles.get(k);
        if (Array.isArray(t)) list.push(...t);
        else if (!t) loadStreetTile(k, z, x, y);
    }
    list.sort((p, q) => q.major - p.major);
    const toWin = Cz.SceneTransforms.worldToWindowCoordinates ?? Cz.SceneTransforms.wgs84ToWindowCoordinates;
    const placed = [];
    for (const s of list) {
        if (!inView(rect, s.carto)) continue;
        const p = toWin(viewer.scene, s.pos);
        if (!p) continue;
        // Declutter (axis-aligned box is good enough), one label per name nearby
        const w = s.text.length * 6.5 + 6, x = p.x - w / 2;
        if (placed.some(q => (x < q.x + q.w && x + w > q.x && Math.abs(p.y - q.y) < 16) || (q.t === s.text && Math.hypot(q.cx - p.x, q.y - p.y) < w + 120))) continue;
        placed.push({ x, y: p.y, w, cx: p.x, t: s.text });
        streetShown.push(s);
        if (streetShown.length >= 250) break;
    }
}
const scratchA = new Cz.Cartesian2(), scratchB = new Cz.Cartesian2(), scratchP = new Cz.Cartesian2();
function drawStreetNames(ctx, occ, toWin, w, h) {
    if (!streetShown.length) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    for (const s of streetShown) {
        if (!occ.isPointVisible(s.pos)) continue;
        const p = toWin(viewer.scene, s.pos, scratchP), a = toWin(viewer.scene, s.a, scratchA), b = toWin(viewer.scene, s.b, scratchB);
        if (!p || !a || !b || p.x < -100 || p.y < -50 || p.x > w + 100 || p.y > h + 50) continue;
        // Along the street, never upside down
        let ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
        ctx.save();
        ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.rotate(ang);
        ctx.font = `${s.major ? 12 : 11}px "Share Tech Mono", monospace`;
        ctx.strokeText(s.text, 0, 0);
        ctx.fillStyle = s.major ? '#ffe9a8' : '#f2f2f2'; ctx.fillText(s.text, 0, 0);
        ctx.restore();
    }
}
// Minimal Mapbox Vector Tile decoder: layer keys/values, feature tags and a label point (middle vertex of the first part)
function decodeMvt(buf) {
    const b = new Uint8Array(buf), dv = new DataView(buf), td = new TextDecoder();
    let p = 0;
    const varint = () => { let v = 0, s = 0, c; do { c = b[p++]; v += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return v; };
    const skip = w => { if (w === 0) varint(); else if (w === 1) p += 8; else if (w === 2) p += varint(); else if (w === 5) p += 4; };
    const str = () => { const l = varint(), s = td.decode(b.subarray(p, p + l)); p += l; return s; };
    const zz = v => (v >>> 1) ^ -(v & 1);
    const layers = {};
    while (p < b.length) {
        const t = varint();
        if (t !== 0x1a) { skip(t & 7); continue; } // field 3 = layer
        const end = varint() + p, L = { name: '', keys: [], values: [], feats: [], extent: 4096 };
        while (p < end) {
            const t2 = varint(), f = t2 >> 3;
            if (t2 === 0x0a) L.name = str();
            else if (t2 === 0x1a) L.keys.push(str());
            else if (t2 === 0x22) {
                const ve = varint() + p;
                let v = null;
                while (p < ve) {
                    const t3 = varint(), f3 = t3 >> 3;
                    if (f3 === 1) v = str();
                    else if (f3 === 2) { v = dv.getFloat32(p, true); p += 4; }
                    else if (f3 === 3) { v = dv.getFloat64(p, true); p += 8; }
                    else if (f3 === 4 || f3 === 5) v = varint();
                    else if (f3 === 6) v = zz(varint());
                    else if (f3 === 7) v = !!varint();
                    else skip(t3 & 7);
                }
                L.values.push(v);
            }
            else if (t2 === 0x12) {
                const fe = varint() + p, F = { tags: [], pt: null };
                let geom = null;
                while (p < fe) {
                    const t3 = varint(), f3 = t3 >> 3;
                    if (f3 === 2 || f3 === 4) { const pe = varint() + p, arr = []; while (p < pe) arr.push(varint()); if (f3 === 2) F.tags = arr; else geom = arr; }
                    else skip(t3 & 7);
                }
                if (geom) {
                    // First part's vertices (MoveTo + LineTo), then its middle vertex
                    const pts = [];
                    let x = 0, y = 0;
                    for (let i = 0; i < geom.length;) {
                        const cmd = geom[i] & 7, cnt = geom[i++] >> 3;
                        if (cmd === 7) break;
                        if (cmd === 1 && pts.length) break;
                        for (let j = 0; j < cnt; j++) { x += zz(geom[i++]); y += zz(geom[i++]); pts.push([x, y]); }
                    }
                    F.pt = pts[pts.length >> 1] || null;
                    F.line = pts;
                }
                L.feats.push(F);
            }
            else if (t2 === 0x28) L.extent = varint();
            else skip(t2 & 7);
        }
        layers[L.name] = L;
    }
    return layers;
}
// Regions and cities follow the borders switch
let regionData = null, cityData = null, overlayHooked = false;
const REGION_LINES_MAX_H = 6e6;
async function applyOverlays() {
    applySea();
    const showR = S.borders && S.regions, showC = S.borders && S.cities;
    if (showR && !regionLines) await loadRegions();
    if (showC && !cityData) await loadCities();
    if (!overlayHooked && (borderLines || regionLines || cityData)) {
        overlayHooked = true;
        // Rebuild visible labels when the camera moves
        viewer.camera.percentageChanged = 0.15;
        viewer.camera.changed.addEventListener(refreshOverlayLabels);
        viewer.camera.moveEnd.addEventListener(refreshOverlayLabels);
    }
    refreshOverlayLabels();
}
function loadRegions() {
    regionsLoading ??= (async () => {
        const [lines, labels] = await Promise.all([tryJson('data/admin1-lines.json', 30000), tryJson('data/admin1-labels.json', 30000)]);
        if (!lines || !labels) { regionsLoading = null; toast(tr('toast.regionsFail')); return; }
        regionLines = viewer.scene.primitives.add(linePrimitive(lines, Cz.Color.fromCssColorString('#ffd23f').withAlpha(0.6), 1.0));
        // One label per province name (data has extra points for islands)
        const seen = new Set();
        regionData = labels.filter(([name, lon, lat]) => {
            const k = `${name}|${Math.round(lon / 5)}|${Math.round(lat / 5)}`;
            if (seen.has(k)) return false;
            seen.add(k); return true;
        }).map(([name, lon, lat, rank]) => ({ name, lon, lat, rank, carto: Cz.Cartographic.fromDegrees(lon, lat) }));
        regionLabels = new Cz.LabelCollection(); // drawn by drawLabels()
    })();
    return regionsLoading;
}
// Cities (GeoNames): overview list + 5° detail tiles loaded on demand
let cityTileSize = 5, cityTileKeys = new Set();
const cityTiles = new Map(); // key -> rows | 'loading'
let cityAdmins = [], cityTzs = [];
const toCity = ([name, lon, lat, pop, cap, gid, cc, adm, elev, tz]) =>
    ({ name, lon, lat, pop, cap, gid, cc, adm, elev, tz, carto: Cz.Cartographic.fromDegrees(lon, lat) });
const regionName = cc => { try { return new Intl.DisplayNames([loc()], { type: 'region' }).of(cc); } catch { return cc; } };

// City info panel: base data at once, Wikipedia summary (via Wikidata/GeoNames id) when it arrives
let cityPick = null;
async function selectCity(c, fly = true) {
    clearSelection(false);
    cityPick = c;
    if (fly && S.zoom.cities === true) flyTo(c.lon, c.lat, 25000);
    const tz = cityTzs[c.tz];
    const f = [[tr('f.country'), (c.cc && regionName(c.cc)) || '—']];
    if (cityAdmins[c.adm]) f.push([tr('f.province'), cityAdmins[c.adm]]);
    f.push([tr('f.population'), c.pop ? c.pop.toLocaleString(loc()) : tr('v.unknown')]);
    if (c.cap) f.push([tr('f.status'), tr(c.cap === 2 ? 'v.capital' : 'v.provCapital')]);
    if (c.elev != null) f.push([tr('f.elevation'), `${c.elev} m`]);
    if (tz) {
        let local = '';
        try { local = new Date().toLocaleTimeString(loc(), { timeZone: tz, hour: '2-digit', minute: '2-digit' }); } catch { }
        f.push([tr('f.timezone'), local ? tr('v.nowTime', { tz, t: local }) : tz]);
    }
    f.push([tr('f.position'), fmtPos(c.lat, c.lon)]);
    const info = { layer: 'city', key: String(c.gid), title: c.name, fields: f, image: null, video: null, canCockpit: false, isRadio: false, summary: tr('v.wikiLoading'), link: null };
    notify('OnSelect', JSON.stringify(info));
    const wiki = await cityWiki(c.gid);
    if (cityPick !== c) return;
    Object.assign(info, wiki ? { summary: wiki.extract, image: wiki.thumb, link: wiki.url } : { summary: null });
    notify('OnSelect', JSON.stringify(info));
}
// Country info panel: Natural Earth facts at once, Wikipedia (via Wikidata id) when it arrives
async function selectCountry(p) {
    clearSelection(false);
    cityPick = p; // same lifecycle as a picked city (cleared by clearSelection)
    const n = v => Number(v).toLocaleString(loc());
    const f = [];
    if (p.CONTINENT) f.push([tr('f.continent'), p.CONTINENT]);
    if (p.SUBREGION && p.SUBREGION !== p.CONTINENT) f.push([tr('f.region'), p.SUBREGION]);
    if (p.POP_EST > 0) f.push([tr('f.population'), `${n(p.POP_EST)}${p.POP_YEAR ? ` (${p.POP_YEAR})` : ''}`]);
    if (p.GDP_MD > 0) f.push([tr('f.gdp'), `${n(Math.round(p.GDP_MD / 1000))} ${tr('u.billionUsd')}${p.GDP_YEAR ? ` (${p.GDP_YEAR})` : ''}`]);
    if (p.ISO_A2 && p.ISO_A2 !== '-99') f.push([tr('f.isoCode'), `${p.ISO_A2} / ${p.ISO_A3 || ''}`]);
    f.push([tr('f.position'), fmtPos(p.LABEL_Y, p.LABEL_X)]);
    const title = (p.ISO_A2 && p.ISO_A2 !== '-99' && regionName(p.ISO_A2)) || countryName(p);
    const info = { layer: 'country', key: p.ISO_A3 || title, title, fields: f, image: null, video: null, canCockpit: false, isRadio: false, summary: tr('v.wikiLoading'), link: null };
    notify('OnSelect', JSON.stringify(info));
    const wiki = p.WIKIDATAID ? await wikidataWiki(p.WIKIDATAID) : null;
    if (cityPick !== p) return;
    Object.assign(info, wiki ? { summary: wiki.extract, image: wiki.thumb, link: wiki.url } : { summary: null });
    notify('OnSelect', JSON.stringify(info));
}
// Province/state info: OSM boundary at the label point (Nominatim, with Wikidata id) → Wikipedia
async function selectRegion(r) {
    clearSelection(false);
    cityPick = r; // same lifecycle as a picked city
    const info = { layer: 'region', key: r.name, title: r.name, fields: [[tr('f.position'), fmtPos(r.lat, r.lon)]], image: null, video: null, canCockpit: false, isRadio: false, summary: tr('v.wikiLoading'), link: null };
    notify('OnSelect', JSON.stringify(info));
    const n = await tryJson(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=5&extratags=1&lat=${r.lat}&lon=${r.lon}&accept-language=${S.lang}`, 15000);
    if (cityPick !== r) return;
    const f = [], a = n?.address || {};
    if (a.country) f.push([tr('f.country'), a.country]);
    if (n?.extratags?.population) f.push([tr('f.population'), Number(n.extratags.population).toLocaleString(loc())]);
    f.push([tr('f.position'), fmtPos(r.lat, r.lon)]);
    const title = n?.name || r.name;
    const wiki = n?.extratags?.wikidata ? await wikidataWiki(n.extratags.wikidata) : null;
    if (cityPick !== r) return;
    Object.assign(info, { title, fields: f, summary: wiki?.extract ?? null, image: wiki?.thumb ?? null, link: wiki?.url ?? null });
    notify('OnSelect', JSON.stringify(info));
}

// Clicked spot: air quality + weather (Open-Meteo) and place name (Nominatim)
const aqiBand = v => v == null ? 0 : v <= 20 ? 1 : v <= 40 ? 2 : v <= 60 ? 3 : v <= 80 ? 4 : v <= 100 ? 5 : 6;
const wxKey = c => c === 0 ? 'clear' : c <= 3 ? 'cloudy' : c <= 48 ? 'fog' : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'showers' : c <= 86 ? 'snow' : 'thunder';
const COMPASS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
async function selectSpot(lat, lon) {
    clearSelection(false);
    const spot = { spot: true, lat, lon };
    cityPick = spot; // cleared by clearSelection
    trackEntity = viewer.entities.add({ position: Cz.Cartesian3.fromDegrees(lon, lat), point: { pixelSize: 14, color: Cz.Color.TRANSPARENT, outlineColor: Cz.Color.fromCssColorString('#7dffb0'), outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
    const pos = fmtPos(lat, lon), q = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`;
    const info = { layer: 'spot', key: pos, title: pos, fields: [[tr('f.position'), pos]], image: null, video: null, canCockpit: false, isRadio: false, summary: tr('v.loading'), link: null };
    notify('OnSelect', JSON.stringify(info));
    const [aq, wx, place] = await Promise.all([
        tryJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,ammonia,uv_index`, 15000),
        tryJson(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,precipitation`, 15000),
        tryJson(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&${q.replace('latitude', 'lat').replace('longitude', 'lon')}&accept-language=${S.lang}`, 15000)]);
    if (cityPick !== spot) return;
    const f = [], a = aq?.current, w = wx?.current, u = ' µg/m³', num = v => Number(v).toLocaleString(loc());
    if (w) {
        if (w.weather_code != null) f.push([tr('f.weather'), tr('wx.' + wxKey(w.weather_code))]);
        f.push([tr('f.temperature'), `${num(w.temperature_2m)} °C`], [tr('f.humidity'), `${w.relative_humidity_2m} %`],
            [tr('f.wind'), `${Math.round(w.wind_speed_10m)} ${tr('u.kmh')} ${COMPASS8[Math.round(w.wind_direction_10m / 45) % 8]}`],
            [tr('f.clouds'), `${w.cloud_cover} %`], [tr('f.precip'), `${num(w.precipitation)} mm`]);
    }
    if (a) {
        if (a.european_aqi != null) f.push([tr('f.airQuality'), `${a.european_aqi} · ${tr('aqi.' + aqiBand(a.european_aqi))}`]);
        for (const [k, key] of [['pm2_5', 'f.pm25'], ['pm10', 'f.pm10'], ['nitrogen_dioxide', 'f.no2'], ['ammonia', 'f.nh3'], ['ozone', 'f.o3']]) if (a[k] != null) f.push([tr(key), num(a[k]) + u]);
        if (a.uv_index != null) f.push([tr('f.uv'), num(a.uv_index)]);
    }
    f.push([tr('f.position'), pos]);
    Object.assign(info, { title: place?.display_name?.split(',').slice(0, 2).join(',') || pos, fields: f, summary: a || w ? null : tr('err.noData') });
    notify('OnSelect', JSON.stringify(info));
}

// Air quality sensors: Sensor.Community + OpenAQ via the fetcher (air.json)
// row: [id, lat, lon, pm25, pm10, tempC, humidity, source]
const PM25_COLORS = [[10, '#50f0e6'], [20, '#50ccaa'], [25, '#f0e641'], [50, '#ff5050'], [75, '#960032'], [Infinity, '#7d2181']];
async function loadAir() {
    const j = await getFeed('air');
    if (!j?.a) { report('air', 'st.feedDown'); return 120000; }
    clearLayer('air');
    const n = v => v == null ? '—' : Number(v).toLocaleString(loc());
    for (const [id, lat, lon, pm25, pm10, t, h, src] of j.a) {
        if (pm25 == null) continue;
        addPoint('air', {
            key: id, lat, lon, label: `PM2.5 ${pm25}`,
            info: [['pm25', `${n(pm25)} µg/m³`], ['pm10', pm10 == null ? '—' : `${n(pm10)} µg/m³`], ['temperature', t == null ? '—' : `${n(t)} °C`], ['humidity', h == null ? '—' : `${n(h)} %`], ['source', src]]
        }, 6, PM25_COLORS.find(([max]) => pm25 <= max)[1]);
    }
    validateSel('air');
    report('air', 'st.age', { src: j.src, s: age(j.t) });
    return 300000;
}

// Info under an enlarged image: description, author, licence and source page
const stripHtml = s => (typeof s === 'string' ? s : '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
// Non-Latin scripts (Cyrillic, Greek, Arabic, Hebrew, Indic, Thai, CJK, Korean)
const FOREIGN_SCRIPT = /[Ͱ-ϿЀ-ӿ֐-ۿऀ-෿฀-๿぀-ヿ一-鿿가-힯]/;
// Description in the UI language, else English, else machine-translated (MyMemory, keyless)
async function imageDesc(v) {
    let s = '', src = 'autodetect';
    if (v && typeof v === 'object') {
        s = stripHtml(v[S.lang] ?? v.en ?? '');
        if (!s) { const k = Object.keys(v).find(k => k !== '_type'); if (k) { s = stripHtml(v[k]); src = k; } }
        else return s.slice(0, 300);
    } else {
        s = stripHtml(v);
        if (S.lang === 'zh' || !FOREIGN_SCRIPT.test(s)) return s.slice(0, 300);
    }
    if (!s) return '';
    s = s.slice(0, 300);
    const target = S.lang === 'zh' ? 'zh-CN' : S.lang;
    const j = await tryJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=${encodeURIComponent(`${src}|${target}`)}`, 10000);
    const t = j?.responseStatus === 200 ? stripHtml(j.responseData?.translatedText) : '';
    return t ? `${t} (${tr('v.machineTranslated')})` : s;
}
export async function imageInfo(url, layer, key) {
    const out = { desc: '', credit: '', license: '', page: '' };
    try {
        if (layer === 'cameras') {
            const r = store.cameras.get(key);
            const op = r?.info?.find(([k]) => k === 'operator')?.[1];
            Object.assign(out, { desc: tr('v.liveCam'), credit: typeof op === 'function' ? op() : op || '' });
        } else if (/(upload|thumb)\.wikimedia\.org/.test(url)) {
            // .../commons/thumb/a/ab/Name.jpg/1280px-Name.jpg or .../commons/a/ab/Name.jpg (also /wikipedia/<lang>/)
            const parts = new URL(url).pathname.split('/'), ti = parts.indexOf('thumb');
            const file = decodeURIComponent(ti >= 0 ? parts[ti + 3] : parts.at(-1));
            const wiki = parts[1] === 'wikipedia' && parts[2] !== 'commons' ? `${parts[2]}.wikipedia.org` : 'commons.wikimedia.org';
            const j = await tryJson(`https://${wiki}/w/api.php?action=query&titles=File:${encodeURIComponent(file)}&prop=imageinfo&iiprop=extmetadata|url&iiextmetadatafilter=ImageDescription|Artist|LicenseShortName|DateTimeOriginal&iiextmetadatamultilang=1&iiextmetadatalanguage=${S.lang}&format=json&origin=*`, 15000);
            const ii = Object.values(j?.query?.pages || {})[0]?.imageinfo?.[0], m = ii?.extmetadata || {};
            Object.assign(out, {
                desc: await imageDesc(m.ImageDescription?.value),
                credit: stripHtml(m.Artist?.value).replace(/^(.+?)\s+\1$/, '$1'), license: stripHtml(m.LicenseShortName?.value), // "X X" → "X"
                page: ii?.descriptionurl || ''
            });
            const date = stripHtml(m.DateTimeOriginal?.value).match(/^\d{4}(-\d{2}(-\d{2})?)?/)?.[0]; // only a real date
            if (date) out.desc = [out.desc, date].filter(Boolean).join(' · ');
        } else if (/ns-mlab\.nl/.test(url)) {
            Object.assign(out, { desc: tr('v.trainType'), credit: 'NS' });
        }
    } catch { }
    return JSON.stringify(out);
}

// Wikidata item → Wikipedia summary in the UI language, else English
async function wikidataWiki(qid) {
    const w = await tryJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks&sitefilter=${S.lang}wiki|enwiki&format=json&origin=*`, 15000);
    const links = w?.entities?.[qid]?.sitelinks || {};
    for (const [site, host] of [[`${S.lang}wiki`, `${S.lang}.wikipedia.org`], ['enwiki', 'en.wikipedia.org']]) {
        const title = links[site]?.title;
        if (!title) continue;
        const path = encodeURIComponent(title.replace(/ /g, '_'));
        const s = await tryJson(`https://${host}/api/rest_v1/page/summary/${path}`, 15000);
        if (s?.extract) return { extract: s.extract, thumb: wikiImage(s), url: `https://${host}/wiki/${path}` };
    }
    return null;
}
async function cityWiki(gid) {
    if (!gid) return null;
    // GeoNames id → Wikipedia article in the UI language, else English
    const lw = `https://${S.lang}.wikipedia.org/`;
    const q = `SELECT ?l ?en WHERE { ?i wdt:P1566 "${gid}" . OPTIONAL { ?l schema:about ?i ; schema:isPartOf <${lw}> } OPTIONAL { ?en schema:about ?i ; schema:isPartOf <https://en.wikipedia.org/> } } LIMIT 1`;
    const r = await tryJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, 15000);
    const b = r?.results?.bindings?.[0];
    const url = b?.l?.value || b?.en?.value;
    if (!url) return null;
    const u = new URL(url), title = u.pathname.split('/wiki/')[1];
    const s = await tryJson(`https://${u.host}/api/rest_v1/page/summary/${title}`, 15000);
    if (!s?.extract) return null;
    return { extract: s.extract, thumb: wikiImage(s), url };
}
function loadCities() {
    citiesLoading ??= (async () => {
        const j = await tryJson('data/cities-top.json', 30000);
        if (!j?.top) { citiesLoading = null; toast(tr('toast.citiesFail')); return; }
        cityTileSize = j.tile; cityTileKeys = new Set(j.tiles);
        cityAdmins = j.admins || []; cityTzs = j.tzs || [];
        cityData = j.top.map(toCity);
        cityDots = viewer.scene.primitives.add(new Cz.PointPrimitiveCollection());
        cityLabels = new Cz.LabelCollection(); // drawn by drawLabels()
    })();
    return citiesLoading;
}
// Tiles covering the view; fetch missing ones, return loaded rows
// Keys "x_y" of T° tiles covering the view rectangle (handles the antimeridian)
function tilesInView(rect, T, maxSpan = 12) {
    if (!rect) return [];
    const w = toDeg(rect.west), e = toDeg(rect.east), s = toDeg(rect.south), n = toDeg(rect.north);
    const x0 = Math.floor(w / T), x1 = Math.floor((e < w ? e + 360 : e) / T);
    const y0 = Math.floor(s / T), y1 = Math.floor(n / T);
    if (x1 - x0 > maxSpan || y1 - y0 > maxSpan) return [];
    const wrap = 360 / T, keys = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${((x + wrap / 2) % wrap + wrap) % wrap - wrap / 2}_${y}`);
    return keys;
}
function citiesFromTiles(rect) {
    const out = [];
    for (const k of tilesInView(rect, cityTileSize)) {
        if (!cityTileKeys.has(k)) continue;
        const t = cityTiles.get(k);
        if (Array.isArray(t)) { out.push(...t); continue; }
        if (t) continue;
        cityTiles.set(k, 'loading');
        tryJson(`data/cities/${k}.json`, 20000).then(rows => {
            if (rows) { cityTiles.set(k, rows.map(toCity)); refreshOverlayLabels(); } else cityTiles.delete(k);
        });
    }
    return out;
}
// Minimum population shown per camera height
const cityPopFor = h => h > 8e6 ? 3e6 : h > 3e6 ? 1e6 : h > 1.2e6 ? 3e5 : h > 5e5 ? 1e5 : h > 2e5 ? 3e4 : h > 8e4 ? 1e4 : 0;
const regionRankFor = h => h > 3e6 ? -1 : h > 1.5e6 ? 4 : h > 6e5 ? 8 : 99;
function inView(rect, carto) {
    return !rect || Cz.Rectangle.contains(rect, carto);
}
function refreshOverlayLabels() {
    if (!viewer) return;
    const h = camHeight(), rect = viewer.camera.computeViewRectangle();
    const showR = S.borders && S.regions, showC = S.borders && S.cities;
    refreshBorders(rect, h);
    refreshCoast();
    if (regionLines) regionLines.show = showR && h < REGION_LINES_MAX_H;
    if (regionLabels) {
        const want = new Set();
        if (showR) {
            const max = regionRankFor(h);
            for (const r of regionData) {
                if (r.rank > max || !inView(rect, r.carto)) continue;
                want.add(r);
                if (want.size >= 150) break;
            }
        }
        // Diff instead of rebuild: unchanged labels stay on screen (no blink)
        for (const [r, lb] of regionShown) if (!want.has(r)) { regionLabels.remove(lb); regionShown.delete(r); }
        for (const r of want) if (!regionShown.has(r)) regionShown.set(r, regionLabels.add({
            id: { region: r }, position: Cz.Cartesian3.fromDegrees(r.lon, r.lat, 150), text: r.name, ...labelStyle(12, REGION_COLOR),
            horizontalOrigin: Cz.HorizontalOrigin.CENTER, verticalOrigin: Cz.VerticalOrigin.CENTER }));
    }
    if (cityLabels) {
        const want = new Set();
        if (showC) {
            const min = cityPopFor(h);
            const list = h < 1.2e6 ? cityData.concat(citiesFromTiles(rect)).sort((a, b) => b.pop - a.pop) : cityData;
            const toWin = Cz.SceneTransforms.worldToWindowCoordinates ?? Cz.SceneTransforms.wgs84ToWindowCoordinates;
            const placed = [];
            let n = 0;
            for (const c of list) { // sorted by population: biggest first
                if ((c.pop < min && !(c.cap === 2 && h < 8e6)) || !inView(rect, c.carto)) continue;
                const pos = Cz.Cartesian3.fromDegrees(c.lon, c.lat, 120);
                // Declutter: skip when overlapping a bigger city's label
                const s = toWin(viewer.scene, pos);
                if (s) {
                    const w = 8 + c.name.length * 7;
                    if (placed.some(p => s.x < p.x + p.w && s.x + w > p.x && Math.abs(s.y - p.y) < 16)) continue;
                    placed.push({ x: s.x, y: s.y, w });
                }
                want.add(c);
                if (++n >= 250) break;
            }
        }
        for (const [c, o] of cityShown) if (!want.has(c)) { cityLabels.remove(o.label); cityDots.remove(o.dot); cityShown.delete(c); }
        for (const c of want) {
            if (cityShown.has(c)) continue;
            const pos = Cz.Cartesian3.fromDegrees(c.lon, c.lat, 120), white = Cz.Color.WHITE;
            cityShown.set(c, {
                dot: cityDots.add({ position: pos, pixelSize: c.cap === 2 ? 7 : 5, color: white, outlineColor: Cz.Color.BLACK, outlineWidth: 1, id: { city: c } }),
                label: cityLabels.add({ position: pos, text: c.name, id: { city: c }, ...labelStyle(c.cap === 2 ? 14 : 12, white), pixelOffset: new Cz.Cartesian2(7, 0),
                    horizontalOrigin: Cz.HorizontalOrigin.LEFT, verticalOrigin: Cz.VerticalOrigin.CENTER })
            });
        }
    }
}
// Labels currently on screen (object -> primitive), for diff updates
const regionShown = new Map(), cityShown = new Map();
const REGION_COLOR = Cz.Color.fromCssColorString('#ffe58a').withAlpha(0.9);

// space telescopes
async function tleById(id) {
    const ck = 'wv-tle-cat-' + id;
    try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < 6 * 3600000) return c.d; } catch { }
    const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=tle`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.text();
    try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d })); } catch { }
    return d;
}
// Approximate Sun-Earth L2: 1.5 million km opposite the Sun (Earth-fixed frame)
function l2Position(offset = 0) {
    const t = Cz.JulianDate.now();
    const sun = Cz.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(t);
    const m = Cz.Transforms.computeIcrfToFixedMatrix(t) ?? Cz.Transforms.computeTemeToPseudoFixedMatrix(t);
    const dir = Cz.Cartesian3.normalize(Cz.Matrix3.multiplyByVector(m, sun, new Cz.Cartesian3()), new Cz.Cartesian3());
    const anti = Cz.Cartesian3.multiplyByScalar(dir, -L2_DIST, new Cz.Cartesian3());
    if (!offset) return anti;
    const side = Cz.Cartesian3.normalize(Cz.Cartesian3.cross(dir, Cz.Cartesian3.UNIT_Z, new Cz.Cartesian3()), new Cz.Cartesian3());
    return Cz.Cartesian3.add(anti, Cz.Cartesian3.multiplyByScalar(side, offset, side), anti);
}
async function loadTelescopes() {
    sat ??= await import('https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/+esm');
    if (!store.telescopes.size) {
        const color = Cz.Color.fromCssColorString(TEL_COLOR);
        const addTel = r => {
            r.pt = coll.telescopes.add({ pixelSize: 8, color, outlineColor: Cz.Color.BLACK, outlineWidth: 1, id: { wv: { layer: 'telescopes', key: r.key } } });
            r.lbl = telLabels.add({ text: r.label, font: '24px "Share Tech Mono", monospace', scale: 0.5, fillColor: color, outlineColor: Cz.Color.BLACK, outlineWidth: 4, style: Cz.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cz.Cartesian2(8, -8), horizontalOrigin: Cz.HorizontalOrigin.LEFT });
            store.telescopes.set(r.key, r);
        };
        const tles = await Promise.all(TELESCOPES.map(([id]) => tleById(id).catch(() => null)));
        TELESCOPES.forEach(([id, name, wikiTitle], i) => {
            const lines = (tles[i] || '').split(/\r?\n/).map(s => s.trimEnd()).filter(Boolean);
            if (lines.length < 3 || !lines[1].startsWith('1 ') || !lines[2].startsWith('2 ')) return;
            let rec;
            try { rec = sat.twoline2satrec(lines[1], lines[2]); } catch { return; }
            addTel({ key: String(id), label: name, wikiTitle, rec, group: 'grp.telescope', color: TEL_COLOR, lat: 0, lon: 0, alt: 0, vel: 0 });
        });
        for (const [key, name, offset, wikiTitle] of L2_TELESCOPES) addTel({ key, label: name, wikiTitle, l2: true, offset, group: 'grp.telescopeL2' });
        propagateTelescopes();
        drawTelOrbits();
    }
    const n = [...store.telescopes.values()].filter(r => !r.l2).length;
    if (n) report('telescopes', 'st.telescopes', { n: L2_TELESCOPES.length }); else report('telescopes', 'st.sourceDown');
    return n ? 0 : 120000;
}
function propagateTelescopes() {
    if (!sat || !S.layers.telescopes) return;
    const now = new Date(), gmst = sat.gstime(now);
    for (const r of store.telescopes.values()) {
        if (r.l2) { r.pos = l2Position(r.offset); }
        else {
            const g = satGeo(r, now, gmst);
            if (!g) { r.pt.show = r.lbl.show = false; continue; }
            r.lat = toDeg(g.lat); r.lon = toDeg(g.lon); r.alt = g.h;
            r.vel = g.v ? Math.hypot(g.v.x, g.v.y, g.v.z) : 0;
            r.pos = Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h);
        }
        r.pt.position = r.lbl.position = r.pos;
        r.pt.show = r.lbl.show = true;
    }
}
// Full orbit rings (re-aligned to current Earth rotation) + dashed line to L2
function drawTelOrbits() {
    if (!sat || !telOrbits) return;
    telOrbits.removeAll();
    const now = new Date(), gmst = sat.gstime(now);
    const ring = Cz.Material.fromType('Color', { color: Cz.Color.fromCssColorString(TEL_COLOR).withAlpha(0.55) });
    const dash = Cz.Material.fromType('PolylineDash', { color: Cz.Color.fromCssColorString(TEL_COLOR).withAlpha(0.5), dashLength: 24 });
    for (const r of store.telescopes.values()) {
        if (r.l2) {
            const p = l2Position(r.offset);
            const start = Cz.Cartesian3.multiplyByScalar(Cz.Cartesian3.normalize(p, new Cz.Cartesian3()), 8e6, new Cz.Cartesian3());
            telOrbits.add({ positions: [start, p], width: 1, material: dash });
            continue;
        }
        if (!r.rec?.no) continue;
        const period = 2 * Math.PI / r.rec.no, pts = [];
        for (let i = 0; i <= 240; i++) {
            const g = satGeo(r, new Date(now.getTime() + i / 240 * period * 60000), gmst);
            if (g) pts.push(Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h));
        }
        if (pts.length > 1) telOrbits.add({ positions: pts, width: 1.5, material: ring });
    }
}

// static point layers
function addPoint(layer, r, size, color) {
    r.pos = Cz.Cartesian3.fromDegrees(r.lon, r.lat, 0);
    r.pt = coll[layer].add({ position: r.pos, pixelSize: size, color: Cz.Color.fromCssColorString(color), outlineColor: Cz.Color.BLACK.withAlpha(0.6), outlineWidth: 1, disableDepthTestDistance: 1.5e6, id: { wv: { layer, key: r.key } } });
    store[layer].set(r.key, r);
}
function addBillboard(layer, r, img, scale) {
    r.pos = Cz.Cartesian3.fromDegrees(r.lon, r.lat, 0);
    r.bb = coll[layer].add({ position: r.pos, image: img, scale, disableDepthTestDistance: 1.5e6, scaleByDistance: new Cz.NearFarScalar(1e3, 1.0, 8e6, 0.4), id: { wv: { layer, key: r.key } } });
    store[layer].set(r.key, r);
}
async function loadQuakes() {
    const j = await tryJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
    if (!j) { report('quakes', 'st.sourceDown'); return 120000; }
    clearLayer('quakes');
    for (const f of j.features || []) {
        const [lon, lat, depth] = f.geometry.coordinates, m = f.properties.mag ?? 0, p = f.properties;
        addPoint('quakes', {
            key: f.id, lat, lon, label: `M${m.toFixed(1)} ${p.place ?? ''}`.trim(),
            info: [['magnitude', m.toFixed(1)], ['depth', `${Math.round(depth)} km`], ['time', () => new Date(p.time).toLocaleString(loc())],
                ['location', p.place ?? '—'], ['tsunami', () => tr(p.tsunami ? 'v.warning' : 'v.no')]]
        }, 4 + Math.max(0, m) * 3, m >= 5 ? '#ff3030' : m >= 3 ? '#ff9a2a' : '#ffe14d');
    }
    validateSel('quakes');
    report('quakes', 'st.quakes');
    return 300000;
}
async function loadFires() {
    const j = await tryJson('https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&days=30', 25000);
    if (!j) { report('fires', 'st.sourceDown'); return 300000; }
    clearLayer('fires');
    for (const e of j.events || []) {
        const g = e.geometry?.[e.geometry.length - 1];
        if (!g || g.type !== 'Point') continue;
        const info = [['name', e.title], ['date', () => new Date(g.date).toLocaleDateString(loc())], ['source', (e.sources || []).map(s => s.id).join(', ') || '—']];
        if (g.magnitudeValue) info.push(['extent', `${g.magnitudeValue} ${g.magnitudeUnit || ''}`.trim()]);
        addPoint('fires', { key: e.id, lat: g.coordinates[1], lon: g.coordinates[0], label: e.title, info }, 8, '#ff7a1a');
    }
    validateSel('fires');
    report('fires', 'st.fires');
    return 1800000;
}
async function loadLaunches() {
    const ck = 'wv-ll2';
    let list = null;
    try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < 3600000) list = c.d; } catch { }
    if (!list) {
        const j = await tryJson('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=40&mode=normal', 25000);
        if (!j?.results) { report('launches', 'st.sourceDownLimit'); return 600000; }
        list = j.results.map(l => ({
            id: l.id, name: l.name, net: l.net, status: l.status?.name, provider: l.launch_service_provider?.name,
            rocket: l.rocket?.configuration?.full_name, pad: l.pad?.name, loc: l.pad?.location?.name,
            lat: Number(l.pad?.latitude), lon: Number(l.pad?.longitude), mission: l.mission?.description
        }));
        try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: list })); } catch { }
    }
    clearLayer('launches');
    const img = icon('rocket', '#c080ff');
    for (const l of list) {
        if (!Number.isFinite(l.lat) || !Number.isFinite(l.lon)) continue;
        addBillboard('launches', {
            key: l.id, lat: l.lat, lon: l.lon, label: l.name, net: l.net,
            info: [['mission', l.name], ['launchTime', () => new Date(l.net).toLocaleString(loc())], ['countdown', () => countdown(l.net)], ['status', l.status || '—'],
                ['provider', l.provider || '—'], ['rocket', l.rocket || '—'], ['pad', l.pad || '—'], ['location', l.loc || '—'], ['description', (l.mission || '—').slice(0, 280)]]
        }, img, 0.8);
    }
    validateSel('launches');
    report('launches', 'st.launches');
    return 3600000;
}
async function loadRadio() {
    if (store.radio.size) { report('radio', () => 'Radio Browser'); return 0; }
    const j = await radioApi('/json/stations/search?has_geo_info=true&hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=750');
    if (!j) { report('radio', 'st.sourceDown'); return 120000; }
    for (const s of j) addRadioStation(s);
    report('radio', () => 'Radio Browser');
    runRadioSearch();
    return 0;
}
// Public traffic cameras: keyless, CORS-enabled lists; each returns [{id, lat, lon, name, image, video?}]
// name = region id, translated via 'cam.<name>'
const CAMERA_SOURCES = [
    {
        name: 'london', owner: 'Transport for London', load: async () => {
            const j = await tryJson('https://api.tfl.gov.uk/Place/Type/JamCam', 25000);
            return j?.map(c => {
                const p = Object.fromEntries((c.additionalProperties || []).map(x => [x.key, x.value]));
                return { id: c.id, lat: c.lat, lon: c.lon, name: c.commonName, image: p.imageUrl, video: p.videoUrl };
            });
        }
    },
    {
        name: 'finland', owner: 'Fintraffic', load: async () => {
            const j = await tryJson('https://tie.digitraffic.fi/api/weathercam/v1/stations', 25000);
            return j?.features?.map(f => {
                const preset = f.properties.presets?.find(p => p.inCollection) ?? f.properties.presets?.[0];
                return preset && { id: f.id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], name: f.properties.name.replace(/_/g, ' '), image: `https://weathercam.digitraffic.fi/${preset.id}.jpg` };
            });
        }
    },
    {
        name: 'california', owner: 'Caltrans', load: async () => {
            const districts = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
            const parts = await Promise.all(districts.map(d => tryJson(`https://cwwp2.dot.ca.gov/data/d${+d}/cctv/cctvStatusD${d}.json`, 30000)));
            const out = [];
            for (const j of parts) for (const { cctv: c } of j?.data ?? []) {
                const url = c?.imageData?.static?.currentImageURL;
                if (c?.inService !== 'true' || !url) continue;
                out.push({ id: `${c.location.district}-${c.index}`, lat: +c.location.latitude, lon: +c.location.longitude, name: c.location.locationName, image: url });
            }
            return out.length ? out : null;
        }
    },
    {
        name: 'austin', owner: 'City of Austin', load: async () => {
            const j = await tryJson("https://data.austintexas.gov/resource/b4k4-adkb.json?$where=camera_status='TURNED_ON'&$limit=5000", 25000);
            return j?.filter(c => c.location?.coordinates && c.screenshot_address)
                .map(c => ({ id: c.camera_id, lat: c.location.coordinates[1], lon: c.location.coordinates[0], name: (c.location_name || c.camera_id).trim(), image: c.screenshot_address }));
        }
    },
    {
        name: 'calgary', owner: 'City of Calgary', load: async () => {
            const j = await tryJson('https://data.calgary.ca/resource/k7p9-kppz.json?$limit=1000', 25000);
            return j?.filter(c => c.point?.coordinates && c.camera_url?.url)
                .map(c => ({ id: c.camera_url.url, lat: c.point.coordinates[1], lon: c.point.coordinates[0], name: c.camera_location, image: c.camera_url.url }));
        }
    },
    // Lists without CORS, relayed by the fetcher (cameras-extra.json)
    { name: 'iceland', owner: 'Vegagerðin', load: async () => (await extraCams())?.iceland },
    { name: 'bc', owner: 'DriveBC', load: async () => (await extraCams())?.bc },
    { name: 'nsw', owner: 'Transport for NSW', load: async () => (await extraCams())?.nsw },
    { name: 'nz', owner: 'NZ Transport Agency', load: async () => (await extraCams())?.nz },
    {
        name: 'hongkong', owner: 'Transport Department HK', load: async () => {
            try {
                const r = await fetch('https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.csv');
                if (!r.ok) return null;
                const rows = new TextDecoder('utf-16le').decode(await r.arrayBuffer()).split(/\r?\n/).slice(1);
                return rows.map(l => l.split('\t')).filter(c => c.length >= 9 && c[8].startsWith('https'))
                    .map(c => ({ id: c[0], lat: +c[6], lon: +c[7], name: c[3], image: c[8].trim() }));
            } catch { return null; }
        }
    }
];
let extraCamsP = null;
const extraCams = () => (extraCamsP ??= tryJson(`${FEED_URL}/cameras-extra.json`, 20000));
async function loadCameras() {
    if (store.cameras.size) return 0;
    const img = icon('camera', '#ff3b3b');
    const results = await Promise.all(CAMERA_SOURCES.map(async s => ({ s, list: await s.load().catch(() => null) })));
    const ok = [], failed = [];
    for (const { s, list } of results) {
        const valid = (list || []).filter(c => c && c.image && Number.isFinite(c.lat) && Number.isFinite(c.lon));
        if (!valid.length) { failed.push(s.name); continue; }
        ok.push([s.name, valid.length]);
        for (const c of valid) {
            const key = `${s.name}:${c.id}`;
            if (store.cameras.has(key)) continue;
            addBillboard('cameras', {
                key, lat: c.lat, lon: c.lon, label: c.name, image: c.image, video: c.video || null,
                info: [['camera', c.name], ['region', () => tr(`cam.${s.name}`)], ['operator', s.owner]]
            }, img, 0.6);
        }
    }
    report('cameras', () => ok.map(([n, c]) => `${tr(`cam.${n}`)} ${c}`).join(' · ')
        + (failed.length ? ` · ${tr('st.camsDown', { list: failed.map(n => tr(`cam.${n}`)).join(', ') })}` : ''));
    return ok.length ? 0 : 120000;
}

// ---------- selection ----------
function currentCartesian() {
    if (!selected) return undefined;
    const r = store[selected.layer].get(selected.key);
    if (!r) return undefined;
    if (MOVERS.includes(selected.layer)) { const [la, lo, al] = posAt(r, Date.now()); return Cz.Cartesian3.fromDegrees(lo, la, al); }
    if (r.l2) return l2Position(r.offset);
    if (ORBITERS.includes(selected.layer) && sat) { const g = satGeo(r, new Date()); if (g) return Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h); }
    return r.pos;
}
export function selectItem(layer, key) { select(layer, key, true); }
// North up: same spot in the middle, same height, looking straight down with north at the top
export function northUp() {
    const cam = viewer.camera, h = camHeight();
    const c = cam.pickEllipsoid(new Cz.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2));
    const g = c ? Cz.Cartographic.fromCartesian(c) : cam.positionCartographic;
    cam.flyTo({ destination: Cz.Cartesian3.fromRadians(g.longitude, g.latitude, h), orientation: { heading: 0, pitch: toRad(-90), roll: 0 }, duration: 1.2 });
}
// My position (browser geolocation) with a blue dot
let meDot = null;
function showMe(lat, lon, accuracy) {
    meDot ??= viewer.scene.primitives.add(new Cz.PointPrimitiveCollection()).add({ pixelSize: 12, color: Cz.Color.fromCssColorString('#2f8bff'), outlineColor: Cz.Color.WHITE, outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY });
    meDot.position = Cz.Cartesian3.fromDegrees(lon, lat, 2);
    // Closer when the fix is precise (GPS/Wi-Fi), wider for a rough estimate
    const h = Math.min(30000, Math.max(800, accuracy * 6));
    viewer.camera.flyTo({ destination: Cz.Cartesian3.fromDegrees(lon, lat, h), orientation: { heading: 0, pitch: toRad(-90), roll: 0 }, duration: 2 });
}
// Fallback when the browser gives no position: approximate place from the internet connection (city level)
async function approxMe(reason) {
    const j = await tryJson('https://ipapi.co/json/', 10000);
    if (Number.isFinite(j?.latitude) && Number.isFinite(j?.longitude)) { toast(tr('toast.geoApprox', { why: reason, place: j.city || '' })); showMe(j.latitude, j.longitude, 3000); }
    else toast(reason);
}
export function flyToMe() {
    if (!navigator.geolocation) { approxMe(tr('toast.geoNone')); return; }
    navigator.geolocation.getCurrentPosition(p => showMe(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
        e => approxMe(tr(e.code === 1 ? 'toast.geoDenied' : e.code === 3 ? 'toast.geoTimeout' : 'toast.geoUnavailable')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}
// "Zoom to": centre the selected object (or picked city/country/province/spot) in view, same camera height and direction
export function zoomToSelection() {
    let target = currentCartesian();
    if (!target && cityPick) {
        const p = cityPick, lat = p.lat ?? p.LABEL_Y, lon = p.lon ?? p.LABEL_X;
        if (lat != null && lon != null) target = Cz.Cartesian3.fromDegrees(lon, lat, 0);
    }
    if (!target || S.cockpit) return false;
    const cam = viewer.camera, h = camHeight(), alt = Cz.Cartographic.fromCartesian(target).height;
    // Look down at least 15°, distance so the camera height stays the same
    const pitch = Math.min(cam.pitch, toRad(-15)), above = h - alt;
    if (above <= 100) { // object above the camera (satellites): straight over it, same height
        const g = Cz.Cartographic.fromCartesian(target);
        cam.flyTo({ destination: Cz.Cartesian3.fromRadians(g.longitude, g.latitude, h), orientation: { heading: cam.heading, pitch: toRad(-90), roll: 0 }, duration: 1.5 });
        return true;
    }
    cam.flyToBoundingSphere(new Cz.BoundingSphere(target, 0), { offset: new Cz.HeadingPitchRange(cam.heading, pitch, above / Math.sin(-pitch)), duration: 1.5 });
    return true;
}
function select(layer, key, fly) {
    const r = store[layer]?.get(key);
    if (!r) return;
    clearSelection(false);
    selected = { layer, key }; trail = [];
    const moving = MOVERS.includes(layer) || ORBITERS.includes(layer);
    const posFn = () => currentCartesian();
    const glow = Cz.Color.fromCssColorString('#7dffb0');
    trackEntity = viewer.entities.add({
        position: Cz.CallbackPositionProperty ? new Cz.CallbackPositionProperty(posFn, false) : new Cz.CallbackProperty(posFn, false),
        point: { pixelSize: 20, color: Cz.Color.TRANSPARENT, outlineColor: glow, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        polyline: moving ? { positions: new Cz.CallbackProperty(() => trail, false), width: 3, material: new Cz.PolylineGlowMaterialProperty({ glowPower: 0.25, color: glow }) } : undefined,
        viewFrom: r.l2 ? new Cz.Cartesian3(0, -6e8, 4e8) : ORBITERS.includes(layer) ? new Cz.Cartesian3(0, -1.6e6, 1.2e6) : new Cz.Cartesian3(0, -30000, 20000)
    });
    if (layer === 'satellites') { drawOrbit(r); lastOrbit = Date.now(); }
    const zoom = S.zoom[layer] === true;
    if (moving) { if (zoom) viewer.trackedEntity = trackEntity; }
    else if (fly && zoom) flyTo(r.lon, r.lat, layer === 'cameras' ? 1500 : layer === 'radio' ? 150000 : 400000);
    if (layer === 'radio' && radioCurrent !== key) radioPlay(key, false);
    pushInfo();
}
export function clearSelection(notifyUi = true) {
    if (S.cockpit) setCockpit(false);
    if (viewer) viewer.trackedEntity = undefined;
    if (trackEntity) viewer.entities.remove(trackEntity);
    if (orbitEntity) viewer.entities.remove(orbitEntity);
    trackEntity = orbitEntity = null; selected = null; trail = []; cityPick = null;
    if (notifyUi) notify('OnSelect', null);
}
function fmtPos(lat, lon) {
    return `${Math.abs(lat).toFixed(4)}°${tr(lat >= 0 ? 'dir.n' : 'dir.s')} ${Math.abs(lon).toFixed(4)}°${tr(lon >= 0 ? 'dir.e' : 'dir.w')}`;
}
function countdown(net) {
    const ms = new Date(net).getTime() - Date.now(), a = Math.abs(ms);
    const d = Math.floor(a / 86400000), h = Math.floor(a / 3600000) % 24, m = Math.floor(a / 60000) % 60;
    return `${ms >= 0 ? 'T-' : 'T+'}${d ? d + tr('u.day') + ' ' : ''}${h}${tr('u.hour')} ${m}m`;
}
// info rows: [fieldKey, value | () => value]
const infoRows = (rows, f) => { for (const [k, v] of rows || []) f.push([tr('f.' + k), typeof v === 'function' ? v() : String(v)]); };
function pushInfo() {
    if (!selected) return;
    const L = selected.layer, r = store[L].get(selected.key);
    if (!r) return;
    const f = [];
    if (MOVERS.includes(L)) {
        const [la, lo] = posAt(r, Date.now());
        infoRows(r.info, f);
        if (PLANES.includes(L)) f.push([tr('f.altitude'), r.ground ? tr('v.onGround') : `${Math.round(r.alt).toLocaleString(loc())} m (FL${Math.round(r.alt / FT / 100)})`]);
        f.push([tr('f.speed'), `${Math.round(r.gs * 3.6)} ${tr('u.kmh')}`], [tr('f.heading'), `${Math.round(r.track || 0)}°`], [tr('f.position'), fmtPos(la, lo)]);
    } else if (r.l2) {
        const km = Cz.Cartesian3.magnitude(l2Position(r.offset)) / 1000;
        f.push([tr('f.group'), tr(r.group)], [tr('f.location'), tr('v.l2')], [tr('f.distance'), tr('v.millionKm', { n: Math.round(km / 1e5) / 10 })], [tr('f.position'), tr('v.approx')]);
    } else if (ORBITERS.includes(L)) {
        f.push([tr('f.group'), tr(r.group)], [tr('f.norad'), r.key], [tr('f.altitude'), `${Math.round(r.alt / 1000).toLocaleString(loc())} km`], [tr('f.speed'), `${r.vel.toFixed(2)} km/s`]);
        if (r.rec?.no) f.push([tr('f.period'), `${(2 * Math.PI / r.rec.no).toFixed(1)} min`]);
        f.push([tr('f.position'), fmtPos(r.lat, r.lon)]);
    } else {
        infoRows(r.info, f);
    }
    let img = r.image ? `${r.image}${r.image.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 30000)}` : null;
    let summary = null, link = null, photo = null;
    // Wikipedia: own article (telescopes) or the aircraft model article
    const ws = r.wikiTitle ? r : PLANES.includes(L) ? aircraftWiki(r) : null;
    if (ws?.wikiTitle === null) summary = tr('v.wikiLoading');
    else if (ws?.wikiTitle) {
        const w = ws.wiki?.lang === S.lang ? ws.wiki : null;
        if (!w) loadWiki(ws);
        img = w?.thumb || null; summary = w ? w.extract : tr('v.wikiLoading'); link = w?.url || null;
    }
    if (PLANES.includes(L)) photo = aircraftPhoto(r.key);
    if (L === 'trains') {
        const d = nsTrain(r.key);
        if (d) {
            if (d.operator) f.push([tr('f.operator'), d.operator]);
            if (d.type) f.push([tr('f.rollingStock'), d.type]);
            if (d.parts?.length) f.push([tr('f.units'), d.parts.join(', ')]);
            if (d.cars || d.meters) f.push([tr('f.length'), [d.cars ? tr('v.cars', { n: d.cars }) : '', d.meters ? `${d.meters} m` : ''].filter(Boolean).join(' · ')]);
            if (d.seats1 || d.seats2) f.push([tr('f.seats'), tr('v.seats', { a: d.seats1 || 0, b: d.seats2 || 0 })]);
            if (d.bikes) f.push([tr('f.bikes'), String(d.bikes)]);
            if (d.facilities?.length) f.push([tr('f.facilities'), d.facilities.map(x => { const k = 'fac.' + x.toLowerCase(), s = tr(k); return s === k ? x.toLowerCase() : s; }).join(', ')]);
            img = d.img || img;
        }
    }
    notify('OnSelect', JSON.stringify({ layer: L, key: selected.key, title: r.label || r.key, fields: f, image: photo ? null : img, video: r.video || null,
        canCockpit: MOVERS.includes(L), isRadio: L === 'radio', summary, link, photo: photo?.src || null, photoLink: photo?.link || null, photoBy: photo?.by || null }));
}
// Sharp image (max 1280 px wide) instead of the 330 px summary thumbnail
function wikiImage(s) {
    const th = s?.thumbnail?.source, orig = s?.originalimage;
    if (!th) return null;
    if (orig?.source && orig.width <= 1280) return orig.source;
    return /\/\d+px-/.test(th) ? th.replace(/\/\d+px-/, '/1280px-') : th;
}
// Photo + description from Wikipedia: article in the UI language (via Wikidata), image/fallback from English
async function loadWiki(r) {
    const lang = S.lang;
    if (r.wikiLoading === lang) return;
    r.wikiLoading = lang;
    let title = r.wikiTitle, host = 'en.wikipedia.org';
    if (lang !== 'en') {
        const w = await tryJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(r.wikiTitle)}&props=sitelinks&sitefilter=${lang}wiki&format=json&origin=*`, 15000);
        const local = w && Object.values(w.entities || {})[0]?.sitelinks?.[`${lang}wiki`]?.title;
        if (local) { title = local; host = `${lang}.wikipedia.org`; }
    }
    const path = encodeURIComponent(title.replace(/ /g, '_'));
    let s = await tryJson(`https://${host}/api/rest_v1/page/summary/${path}`, 15000);
    // Local article without photo: take the English one
    if (s && !s.thumbnail && host !== 'en.wikipedia.org') {
        const en = await tryJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(r.wikiTitle.replace(/ /g, '_'))}`, 15000);
        if (en?.thumbnail) { s.thumbnail = en.thumbnail; s.originalimage = en.originalimage; }
    }
    if (r.wikiLoading !== lang) return;
    r.wikiLoading = null;
    r.wiki = { lang, extract: s?.extract || null, thumb: wikiImage(s), url: s ? `https://${host}/wiki/${path}` : null };
    if (selected) pushInfo(); // r may be shared (aircraft model)
}

// ---------- radio (Radio Browser) ----------
// Playback is independent of the info box: it keeps playing until stopped in the radio panel
const radioMeta = new Map(); // key -> station meta (also stations without coordinates)
let radioHost = null, radioQuery = { q: '', cc: '', tag: '', inView: false, fav: false };
let radioList = [], radioCurrent = null, radioVol = 0.8, radioGen = 0, radioCountryRaw = null;

async function radioApi(path) {
    for (const h of radioHost ? [radioHost, ...RADIO_HOSTS.filter(x => x !== radioHost)] : RADIO_HOSTS) {
        const j = await tryJson(h + path, 15000);
        if (j) { radioHost = h; return j; }
    }
    return null;
}
function addRadioStation(s) {
    if (!s?.stationuuid || !s.url_resolved?.startsWith('https:')) return null;
    let m = radioMeta.get(s.stationuuid);
    if (!m) {
        m = {
            key: s.stationuuid, name: (s.name || '').trim() || '—', cc: s.countrycode || '', country: s.country || '',
            tags: (s.tags || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 4).join(', '),
            codec: s.codec || '', bitrate: s.bitrate || 0, votes: s.clickcount || 0,
            favicon: s.favicon?.startsWith('https:') ? s.favicon : '', stream: s.url_resolved,
            lat: s.geo_lat, lon: s.geo_long
        };
        radioMeta.set(m.key, m);
    }
    // Stations with coordinates also go on the globe
    if (m.lat != null && m.lon != null && !store.radio.has(m.key)) {
        addPoint('radio', {
            key: m.key, lat: m.lat, lon: m.lon, label: m.name, stream: m.stream,
            info: [['station', m.name], ['country', () => (m.cc && regionName(m.cc)) || m.country || '—'], ['genre', m.tags || '—'], ['codec', `${m.codec || '?'} ${m.bitrate ? m.bitrate + ' kbps' : ''}`.trim()]]
        }, 5, '#ff4fd8');
    }
    return m;
}
const isFav = key => (S.radioFav || []).some(f => f.key === key);
const radioPublic = m => ({
    key: m.key, name: m.name, country: (m.cc && regionName(m.cc)) || m.country || '', tags: m.tags, codec: m.codec,
    bitrate: m.bitrate, favicon: m.favicon, geo: m.lat != null && m.lon != null, fav: isFav(m.key)
});
// Countries with stations, names in the UI language
export async function radioCountries() {
    radioCountryRaw ??= await radioApi('/json/countries?hidebroken=true');
    const list = (radioCountryRaw || []).filter(c => c.iso_3166_1 && c.stationcount >= 3)
        .map(c => ({ cc: c.iso_3166_1, name: regionName(c.iso_3166_1) || c.name, n: c.stationcount }));
    list.sort((a, b) => a.name.localeCompare(b.name, loc()));
    return JSON.stringify(list);
}
export function radioSetQuery(json) {
    try { radioQuery = { ...radioQuery, ...JSON.parse(json) }; } catch { }
    runRadioSearch();
}
async function runRadioSearch() {
    const my = ++radioGen, q = radioQuery, text = (q.q || '').trim().toLowerCase();
    let list;
    if (q.fav) {
        for (const f of S.radioFav || []) if (!radioMeta.has(f.key)) radioMeta.set(f.key, { ...f });
        list = (S.radioFav || []).map(f => radioMeta.get(f.key));
    } else if (!q.inView && (text || q.cc || q.tag)) {
        // Targeted server search: all matching stations, not just the preloaded top 750
        const p = new URLSearchParams({ hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true', limit: '300' });
        if (text) p.set('name', text);
        if (q.cc) p.set('countrycode', q.cc);
        if (q.tag) p.set('tag', q.tag);
        const j = await radioApi(`/json/stations/search?${p}`);
        if (my !== radioGen) return;
        list = (j || []).map(addRadioStation).filter(Boolean);
    } else {
        list = [...radioMeta.values()];
    }
    // Client-side filters (view, text, country, genre)
    const rect = q.inView && viewer ? viewer.camera.computeViewRectangle() : null;
    list = list.filter(m => m
        && (!q.inView || (m.lat != null && m.lon != null && inView(rect, Cz.Cartographic.fromDegrees(m.lon, m.lat))))
        && (!text || m.name.toLowerCase().includes(text))
        && (!q.cc || m.cc === q.cc)
        && (!q.tag || m.tags.toLowerCase().includes(q.tag)));
    if (!q.fav) list.sort((a, b) => b.votes - a.votes);
    radioList = list.slice(0, 300);
    if (my !== radioGen) return;
    notify('OnRadioList', JSON.stringify(radioList.map(radioPublic)));
}
function radioNow() {
    const m = radioMeta.get(radioCurrent);
    notify('OnRadioNow', m ? JSON.stringify({ ...radioPublic(m), playing: !!audio && !audio.paused }) : null);
}
export function radioPlay(key, doSelect = true) {
    const m = radioMeta.get(key);
    if (!m) return;
    stopAudio();
    radioCurrent = key;
    audio = new Audio(m.stream);
    audio.volume = radioVol;
    audio.addEventListener('playing', radioNow);
    audio.addEventListener('pause', radioNow);
    audio.addEventListener('error', () => { toast(tr('toast.radioFail')); radioNow(); });
    audio.play().catch(() => { toast(tr('toast.radioFail')); radioNow(); });
    radioNow();
    // Show it on the globe when it has coordinates, else fly to its country
    if (doSelect && store.radio.has(key)) select('radio', key, true);
    else if (doSelect && S.zoom.radio === true && m.cc) flyToCountry(m.cc);
}
// Country centre via Nominatim (cached)
const countryCentre = new Map();
async function flyToCountry(cc) {
    let p = countryCentre.get(cc);
    if (!p) {
        const j = await tryJson(`https://nominatim.openstreetmap.org/search?country=${encodeURIComponent(cc)}&format=json&limit=1`, 15000);
        if (!j?.[0]) return;
        p = [Number(j[0].lon), Number(j[0].lat)];
        countryCentre.set(cc, p);
    }
    flyTo(p[0], p[1], 1.5e6);
}
function stopAudio() { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; } }
export function radioStop() { stopAudio(); radioNow(); }
export function radioToggle() {
    if (audio && !audio.paused) audio.pause();
    else if (audio) audio.play().catch(() => toast(tr('toast.radioFail')));
    else if (radioCurrent) radioPlay(radioCurrent);
    else if (radioList[0]) radioPlay(radioList[0].key);
}
export function radioStep(dir) {
    if (!radioList.length) return;
    const i = radioList.findIndex(m => m.key === radioCurrent);
    radioPlay(radioList[((i < 0 ? -1 : i) + dir + radioList.length) % radioList.length].key);
}
export function radioVolume(v) { radioVol = Math.max(0, Math.min(1, v / 100)); if (audio) audio.volume = radioVol; }
export function radioFav(key) {
    const m = radioMeta.get(key);
    if (!m) return;
    const favs = S.radioFav || [];
    S.radioFav = isFav(key) ? favs.filter(f => f.key !== key) : [...favs, { ...m }];
    saveSettings();
    runRadioSearch();
    if (radioCurrent === key) radioNow();
}

// ---------- camera ----------
function flyTo(lon, lat, height, dur = 2.5) {
    if (S.cockpit) setCockpit(false);
    viewer.trackedEntity = undefined;
    const oblique = height < 60000;
    const dest = Cz.Cartesian3.fromDegrees(lon, oblique ? lat - height / 111320 : lat, height);
    viewer.camera.flyTo({ destination: dest, orientation: { heading: 0, pitch: toRad(oblique ? -45 : -90), roll: 0 }, duration: dur });
}
export function resetGlobe() {
    clearSelection();
    const c = viewCenter();
    viewer.camera.flyTo({ destination: Cz.Cartesian3.fromDegrees(c.lon, Math.max(-60, Math.min(60, c.lat)), 2.2e7), orientation: { heading: 0, pitch: toRad(-90), roll: 0 }, duration: 2.5 });
}
export async function search(q) {
    q = (q || '').trim();
    if (!q) return null;
    const m = q.match(/^(?:geo:)?\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/i);
    if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) { flyTo(+m[2], +m[1], 15000); return `${m[1]}, ${m[2]}`; }
    const city = CITIES[q.toLowerCase()];
    if (city) { flyTo(city[1], city[0], 25000); return q; }
    const j = await tryJson(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=${S.lang}&q=` + encodeURIComponent(q), 12000);
    if (j?.length) {
        const r = j[0], bb = (r.boundingbox || []).map(Number);
        const span = bb.length === 4 ? Math.max(Math.abs(bb[1] - bb[0]), Math.abs(bb[3] - bb[2])) : 0.1;
        flyTo(Number(r.lon), Number(r.lat), Math.min(2e7, Math.max(2500, span * 111000 * 1.4)));
        return r.display_name;
    }
    return null;
}
export async function shareLink() {
    const c = viewer.camera.positionCartographic;
    const p = [toDeg(c.latitude).toFixed(4), toDeg(c.longitude).toFixed(4), Math.round(c.height), toDeg(viewer.camera.heading).toFixed(1), toDeg(viewer.camera.pitch).toFixed(1)];
    const u = new URL(location.href);
    u.searchParams.delete('v'); u.searchParams.delete('r');
    u.hash = `c=${p.join(',')}&l=${LAYERS.filter(l => S.layers[l]).join(',')}&s=${S.style}`;
    const url = u.toString();
    try { await navigator.clipboard.writeText(url); } catch { }
    return url;
}
function distKm(a1, o1, a2, o2) {
    const dLa = toRad(a2 - a1), dLo = toRad(o2 - o1);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLo / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}
export function getContacts() {
    let ref = null;
    const p = currentCartesian();
    if (p) { const c = Cz.Cartographic.fromCartesian(p); ref = { lat: toDeg(c.latitude), lon: toDeg(c.longitude) }; }
    ref ??= viewCenter();
    const out = [], now = Date.now();
    for (const l of MOVERS) {
        if (!S.layers[l]) continue;
        for (const r of store[l].values()) {
            if (selected?.key === r.key) continue;
            const [la, lo] = posAt(r, now), d = distKm(ref.lat, ref.lon, la, lo);
            if (d <= 250) out.push({ layer: l, key: r.key, label: r.label || r.key, distKm: Math.round(d), alt: Math.round(r.alt) });
        }
    }
    out.sort((a, b) => a.distKm - b.distKm);
    return JSON.stringify(out.slice(0, 25));
}

// ---------- modes ----------
const HEAD = `uniform sampler2D colorTexture;
uniform float time;
in vec2 v_textureCoordinates;
float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float lum(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}
float vig(vec2 uv){vec2 d=uv-0.5;return clamp(1.0-dot(d,d)*1.8,0.0,1.0);}
`;
const SHADERS = {
    crt: `void main(){vec2 uv=v_textureCoordinates;vec2 cc=uv-0.5;float d=dot(cc,cc);uv=0.5+cc*(1.0+0.1*d);
if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){out_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
float r=texture(colorTexture,uv+vec2(0.0018,0.0)).r;float g=texture(colorTexture,uv).g;float b=texture(colorTexture,uv-vec2(0.0018,0.0)).b;
vec3 c=vec3(r,g,b)*(0.78+0.22*sin(uv.y*1100.0+time*6.0));c*=vig(uv)*1.15;c=mix(c,c*vec3(0.8,1.08,0.92),0.6);
out_FragColor=vec4(c,1.0);}`,
    nvg: `void main(){vec2 uv=v_textureCoordinates;float l=pow(lum(texture(colorTexture,uv).rgb),0.75)*1.7;
float n=(rnd(uv*vec2(1733.0,977.0)+fract(time))-0.5)*0.22;vec3 c=vec3(0.18,1.0,0.3)*(l+n)*vig(uv);
out_FragColor=vec4(c,1.0);}`,
    flir: `void main(){vec2 uv=v_textureCoordinates;float l=smoothstep(0.04,0.85,lum(texture(colorTexture,uv).rgb));
l+=(rnd(uv*vec2(1500.0,900.0)+fract(time))-0.5)*0.06;out_FragColor=vec4(vec3(l),1.0);}`,
    ironbow: `vec3 iron(float t){t=clamp(t,0.0,1.0);vec3 a=vec3(0.0,0.0,0.08);vec3 b=vec3(0.4,0.0,0.6);vec3 c=vec3(0.92,0.25,0.1);vec3 d=vec3(1.0,0.78,0.0);vec3 e=vec3(1.0,1.0,0.92);
if(t<0.25)return mix(a,b,t*4.0);if(t<0.5)return mix(b,c,(t-0.25)*4.0);if(t<0.75)return mix(c,d,(t-0.5)*4.0);return mix(d,e,(t-0.75)*4.0);}
void main(){vec2 uv=v_textureCoordinates;float l=smoothstep(0.03,0.9,lum(texture(colorTexture,uv).rgb));out_FragColor=vec4(iron(l),1.0);}`,
    noir: `void main(){vec2 uv=v_textureCoordinates;float l=smoothstep(0.08,0.92,lum(texture(colorTexture,uv).rgb));
l+=(rnd(uv*vec2(1200.0,800.0)+fract(time))-0.5)*0.08;out_FragColor=vec4(vec3(l*vig(uv)*1.1),1.0);}`,
    snow: `void main(){vec2 uv=v_textureCoordinates;vec3 c=texture(colorTexture,uv).rgb;float l=lum(c);
vec3 s=mix(c,vec3(l)*vec3(0.92,0.97,1.08)+0.18,0.75);out_FragColor=vec4(clamp(s,0.0,1.0),1.0);}`
};
export function setStyle(name, fromEngine = false) {
    if (!STYLE_KEYS.includes(name)) name = 'normal';
    S.style = name; saveSettings();
    if (styleStage) { viewer.scene.postProcessStages.remove(styleStage); styleStage = null; }
    if (name !== 'normal') {
        try { styleStage = viewer.scene.postProcessStages.add(new Cz.PostProcessStage({ fragmentShader: HEAD + SHADERS[name], uniforms: { time: () => (performance.now() / 1000) % 1000 } })); }
        catch (e) { toast(tr('toast.opticsFail', { e: e?.message ?? e })); }
    }
    if (fromEngine) notify('OnStyleChanged', name);
}
export function setHud(on) { S.hud = !!on; saveSettings(); }

// ---------- language ----------
export const getLangs = () => JSON.stringify(LANGS);
export const getStrings = () => JSON.stringify({ lang: S.lang, strings: strings(S.lang) });
export function setLang(lang) {
    if (!(lang in LANGS)) return getStrings();
    S.lang = lang; saveSettings();
    document.documentElement.lang = lang;
    relabelCountries();
    refreshNature();
    for (const l of LAYERS) if (lastStatus[l]) notify('OnLayerStatus', l, store[l].size, statusText(l));
    if (selected) pushInfo();
    else if (cityPick) cityPick.spot ? selectSpot(cityPick.lat, cityPick.lon) : cityPick.LABEL_X != null ? selectCountry(cityPick) : cityPick.rank != null && cityPick.pop == null ? selectRegion(cityPick) : selectCity(cityPick, false);
    if (radioMeta.size) { runRadioSearch(); radioNow(); }
    return getStrings();
}
export function setZoom(layer, on) { S.zoom[layer] = !!on; saveSettings(); }
export function setDetect(on, fromEngine = false) {
    S.detect = !!on; saveSettings();
    if (!S.detect && detectCtx) detectCtx.clearRect(0, 0, detectCanvas.width, detectCanvas.height);
    if (fromEngine) notify('OnToggle', 'detect', S.detect);
}
export function setCockpit(on) {
    if (on && !(selected && MOVERS.includes(selected.layer))) { toast(tr('toast.selectPlane')); on = false; }
    S.cockpit = on;
    const r = selected ? store[selected.layer].get(selected.key) : null;
    if (r?.bb) r.bb.show = !on;
    if (trackEntity) trackEntity.show = !on;
    viewer.trackedEntity = on ? undefined : (selected && trackEntity && S.zoom[selected.layer] === true && (MOVERS.includes(selected.layer) || ORBITERS.includes(selected.layer)) ? trackEntity : undefined);
    notify('OnToggle', 'cockpit', on);
}

// ---------- loop ----------
function tick() {
    const now = Date.now();
    for (const l of MOVERS) {
        if (!S.layers[l]) continue;
        for (const r of store[l].values()) { const [la, lo, al] = posAt(r, now); r.bb.position = Cz.Cartesian3.fromDegrees(lo, la, al); }
    }
    if (S.layers.satellites && now % 1000 < 250) propagateSats();
    updateTzLabels();
    if (selected && now - lastTrail > 1000) {
        lastTrail = now;
        // No trail for trains, nor for aircraft on the ground (taxiing gives odd tracks)
        const noTrail = selected.layer === 'trains' || selected.layer === 'ov' || (MOVERS.includes(selected.layer) && store[selected.layer].get(selected.key)?.ground);
        if (noTrail) trail = [];
        else {
            const p = currentCartesian();
            if (p) { trail.push(p); if (trail.length > 600) trail.shift(); }
        }
    }
    if (S.layers.telescopes && now % 1000 < 250) propagateTelescopes();
    if (S.layers.telescopes && now - lastTelOrbit > 30000) { lastTelOrbit = now; drawTelOrbits(); }
    if (selected?.layer === 'satellites' && now - lastOrbit > 10000) { lastOrbit = now; const r = store.satellites.get(selected.key); if (r) drawOrbit(r); }
    if (selected && now - lastInfo > 2000) { lastInfo = now; pushInfo(); }
}
function onPreRender() {
    navStep();
    if (!S.cockpit || !selected) return;
    const r = store[selected.layer].get(selected.key);
    if (!r) return;
    const [la, lo, al] = posAt(r, Date.now());
    viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(lo, la, Math.max(al, 50) + 15), orientation: { heading: toRad(r.track || 0), pitch: toRad(-7), roll: 0 } });
}
function onPostRender() {
    const now = performance.now();
    if (now - lastCam > 250) {
        lastCam = now;
        const c = viewer.camera.positionCartographic;
        notify('OnCamera', toDeg(c.latitude), toDeg(c.longitude), c.height, (toDeg(viewer.camera.heading) + 360) % 360);
    }
    try { drawLabels(); } catch (e) { console.warn('labels', e); }
    // Every frame: boxes stay glued to their targets while the globe moves
    if (S.detect) {
        lastDetect = now;
        // Never let the overlay break Cesium's render loop
        try { drawDetect(); } catch (e) { console.warn('detect', e); setDetect(false, true); toast(tr('toast.detectOff', { e: e?.message ?? e })); }
    }
}
// Map labels drawn as native 2D text (sharp at any pixel ratio); Cesium LabelCollections only hold the data
let labelCanvas = null, labelCtx = null, labelHits = [];
const scratchWin = new Cz.Cartesian2();
const ALIGN = l => l.horizontalOrigin === Cz.HorizontalOrigin.CENTER ? 'center' : l.horizontalOrigin === Cz.HorizontalOrigin.RIGHT ? 'right' : 'left';
const BASELINE = l => l.verticalOrigin === Cz.VerticalOrigin.CENTER ? 'middle' : l.verticalOrigin === Cz.VerticalOrigin.TOP ? 'top' : l.verticalOrigin === Cz.VerticalOrigin.BOTTOM ? 'bottom' : 'alphabetic';
function drawLabels() {
    const cv = labelCanvas, dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = labelCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    const cam = viewer.camera.positionWC, occ = new Cz.EllipsoidalOccluder(Cz.Ellipsoid.WGS84, cam);
    const toWin = Cz.SceneTransforms.worldToWindowCoordinates ?? Cz.SceneTransforms.wgs84ToWindowCoordinates;
    const hits = [];
    drawStreetNames(ctx, occ, toWin, w, h); // lowest layer
    // Draw order: countries, nature, provinces, time zones, cities, telescopes (later = on top)
    for (const set of [countryLabels, natureLabels, regionLabels, tzLabels, cityLabels, telLabels]) {
        if (!set || set.show === false) continue;
        for (let i = 0; i < set.length; i++) {
            const l = set.get(i), p = l.position;
            if (!l.show || !l.text || !p) continue;
            const d = Cz.Cartesian3.distance(cam, p), ddc = l.distanceDisplayCondition;
            if (ddc && (d < ddc.near || d > ddc.far)) continue;
            if (!occ.isPointVisible(p)) continue;
            const s = toWin(viewer.scene, p, scratchWin);
            if (!s || s.x < -300 || s.y < -50 || s.x > w + 300 || s.y > h + 50) continue;
            let k = l.scale;
            const sbd = l.scaleByDistance;
            if (sbd) { const t = Math.min(1, Math.max(0, (d - sbd.near) / (sbd.far - sbd.near))); k *= sbd.nearValue + (sbd.farValue - sbd.nearValue) * t; }
            const m = /(\d+(?:\.\d+)?)px/.exec(l.font), px = (m ? +m[1] : 16) * k;
            ctx.font = l.font.replace(/(\d+(?:\.\d+)?)px/, `${px.toFixed(1)}px`);
            ctx.textAlign = ALIGN(l); ctx.textBaseline = BASELINE(l);
            const x = Math.round(s.x + l.pixelOffset.x), y = Math.round(s.y + l.pixelOffset.y);
            if (l.style !== Cz.LabelStyle.FILL && l.outlineWidth > 0) {
                ctx.lineWidth = Math.max(2, l.outlineWidth * k); ctx.strokeStyle = l.outlineColor.toCssColorString(); ctx.strokeText(l.text, x, y);
            }
            ctx.fillStyle = l.fillColor.toCssColorString(); ctx.fillText(l.text, x, y);
            if (l.id) {
                const tw = ctx.measureText(l.text).width, x0 = ctx.textAlign === 'left' ? x : ctx.textAlign === 'right' ? x - tw : x - tw / 2;
                const y0 = ctx.textBaseline === 'middle' ? y - px / 2 : ctx.textBaseline === 'top' ? y : y - px;
                hits.push([x0 - 3, y0 - 3, tw + 6, px + 6, l.id]);
            }
        }
    }
    labelHits = hits;
}
function drawDetect() {
    const cv = detectCanvas, dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = detectCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const occ = new Cz.EllipsoidalOccluder(Cz.Ellipsoid.WGS84, viewer.camera.positionWC);
    const toWin = Cz.SceneTransforms.worldToWindowCoordinates ?? Cz.SceneTransforms.wgs84ToWindowCoordinates;
    // One candidate per screen cell: spreads labels over the whole view (also after zooming out)
    const cells = new Map();
    for (const l of LAYERS) {
        if (!S.layers[l]) continue;
        for (const r of store[l].values()) {
            const p = r.bb ? r.bb.position : r.pos;
            if (!p || !occ.isPointVisible(p)) continue;
            const s = toWin(viewer.scene, p);
            if (!s || s.x < 0 || s.y < 0 || s.x > w || s.y > h) continue;
            const cx = Math.floor(s.x / DETECT_CW), cy = Math.floor(s.y / DETECT_CH), k = cx * 1000 + cy;
            // Labelled last frame wins its cell (no flicker); else closest to the cell centre
            const d = detectShown.has(r) ? -1 : Math.hypot(s.x - (cx + 0.5) * DETECT_CW, s.y - (cy + 0.5) * DETECT_CH);
            const cur = cells.get(k);
            if (!cur || d < cur[0]) cells.set(k, [d, s.x, s.y, r, l]);
        }
    }
    const items = [...cells.values()].sort((a, b) => a[0] - b[0]);
    const shownNow = new Set();
    ctx.lineWidth = 1; ctx.font = '13px "Share Tech Mono", monospace';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3;
    const b = 11, drawn = [];
    for (const [, x, y, r, l] of items) {
        // Declutter: skip targets overlapping an already boxed one
        if (drawn.length >= 250) break;
        if (drawn.some(([dx, dy]) => Math.abs(dx - x) < 180 && Math.abs(dy - y) < 30)) continue;
        drawn.push([x, y]);
        shownNow.add(r);
        ctx.strokeStyle = ctx.fillStyle = DETECT_COLORS[l];
        ctx.beginPath();
        for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.moveTo(x + dx * b, y + dy * (b - 5)); ctx.lineTo(x + dx * b, y + dy * b); ctx.lineTo(x + dx * (b - 5), y + dy * b);
        }
        ctx.stroke();
        // Moving targets: speed next to the name
        const name = String(r.label || r.key).slice(0, 18);
        ctx.fillText(MOVERS.includes(l) ? `${name} ${Math.round((r.gs || 0) * 3.6)} ${tr('u.kmh')}` : name, x + b + 3, y - b + 8);
    }
    detectShown = shownNow;
}
let detectShown = new Set();
const DETECT_CW = 200, DETECT_CH = 40; // label grid cell (px)
// Arrow keys pan, +/- zoom; applied every frame while held for smooth motion
const NAV_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', '+', '=', '-', '_']);
const navHeld = new Set();
let navLast = 0;
const isTyping = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
// Smooth start/stop: velocities ease towards the keys' target (time constant NAV_EASE seconds)
const NAV_EASE = 0.3;
const navVel = { x: 0, y: 0, z: 0 };
function navStep() {
    const now = performance.now(), dt = Math.min(0.1, (now - (navLast || now)) / 1000);
    navLast = now;
    if (S.cockpit) { navVel.x = navVel.y = navVel.z = 0; return; }
    const tx = (navHeld.has('arrowright') ? 1 : 0) - (navHeld.has('arrowleft') ? 1 : 0);
    const ty = (navHeld.has('arrowup') ? 1 : 0) - (navHeld.has('arrowdown') ? 1 : 0);
    const tz = (navHeld.has('+') || navHeld.has('=') ? 1 : 0) - (navHeld.has('-') || navHeld.has('_') ? 1 : 0);
    const k = 1 - Math.exp(-dt / NAV_EASE);
    navVel.x += (tx - navVel.x) * k; navVel.y += (ty - navVel.y) * k; navVel.z += (tz - navVel.z) * k;
    // Come to rest once nearly stopped
    for (const a of ['x', 'y', 'z']) if (Math.abs(navVel[a]) < 0.01 && !(a === 'x' ? tx : a === 'y' ? ty : tz)) navVel[a] = 0;
    if (!navVel.x && !navVel.y && !navVel.z) return;
    const cam = viewer.camera, h = camHeight();
    // Move over the globe relative to the screen (heading-aware), keeping height and view angle
    const dx = navVel.x, dy = navVel.y;
    if (dx || dy) {
        if (viewer.trackedEntity) viewer.trackedEntity = undefined;
        const c = cam.positionCartographic, hd = cam.heading;
        const ang = Math.min(0.6, h / R_EARTH) * 0.6 * dt; // ≈ half a view per second
        const east = dy * Math.sin(hd) + dx * Math.cos(hd), north = dy * Math.cos(hd) - dx * Math.sin(hd);
        const lat = Math.max(-1.55, Math.min(1.55, c.latitude + north * ang));
        const lon = c.longitude + east * ang / Math.max(0.05, Math.cos(c.latitude));
        cam.setView({ destination: Cz.Cartesian3.fromRadians(lon, lat, c.height), orientation: { heading: hd, pitch: cam.pitch, roll: cam.roll } });
    }
    if (navVel.z > 0 && h > 50) cam.zoomIn(h * 0.7 * navVel.z * dt);
    if (navVel.z < 0 && h < 6e7) cam.zoomOut(h * 0.7 * -navVel.z * dt);
}
function onKeyUp(e) { navHeld.delete(e.key.toLowerCase()); }
function onKey(e) {
    const t = e.target;
    if (isTyping(t)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (NAV_KEYS.has(k)) {
        if (!navHeld.size) navLast = performance.now();
        navHeld.add(k);
        e.preventDefault();
        return;
    }
    if (k >= '1' && k <= '7') setStyle(STYLE_KEYS[+k - 1], true);
    else if (k === 'h') { setHud(!S.hud); notify('OnToggle', 'hud', S.hud); }
    else if (k === 'd') setDetect(!S.detect, true);
    else if (k === 'n') setDayNight(!S.daynight, true);
    else if (k === 'b') setBorders(!S.borders, true);
    else if (k === 'z') setTimezones(!S.timezones, true);
    else if (k === 'c') setCockpit(!S.cockpit);
    else if (k === 'escape') { if (S.cockpit) setCockpit(false); else clearSelection(); }
    else return;
    e.preventDefault();
}

// ---------- voice (Web Speech API) ----------
// Keywords in EN/NL/DE/FR/ZH
const VOICE_LAYERS = [
    ['milit', 'military'], ['军', 'military'],
    ['vlucht', 'flights'], ['vliegtuig', 'flights'], ['flight', 'flights'], ['plane', 'flights'], ['flug', 'flights'], ['avion', 'flights'], ['vol ', 'flights'], ['航班', 'flights'], ['飞机', 'flights'],
    ['telescop', 'telescopes'], ['teleskop', 'telescopes'], ['télescope', 'telescopes'], ['望远镜', 'telescopes'],
    ['satel', 'satellites'], ['卫星', 'satellites'],
    ['aardbeving', 'quakes'], ['earthquake', 'quakes'], ['erdbeben', 'quakes'], ['séisme', 'quakes'], ['seisme', 'quakes'], ['地震', 'quakes'],
    ['bosbrand', 'fires'], ['brand', 'fires'], ['fire', 'fires'], ['feu', 'fires'], ['火', 'fires'],
    ['lancering', 'launches'], ['launch', 'launches'], ['raketenstart', 'launches'], ['lancement', 'launches'], ['发射', 'launches'],
    ['radio', 'radio'], ['电台', 'radio'],
    ['bus', 'ov'], ['tram', 'ov'], ['metro', 'ov'], ['公交', 'ov'],
    ['trein', 'trains'], ['train', 'trains'], ['zug', 'trains'], ['züge', 'trains'], ['火车', 'trains'],
    ['camera', 'cameras'], ['kamera', 'cameras'], ['caméra', 'cameras'], ['摄像', 'cameras']];
const VOICE_STYLES = [['nacht', 'nvg'], ['night', 'nvg'], ['nuit', 'nvg'], ['夜视', 'nvg'], ['nvg', 'nvg'], ['ironbow', 'ironbow'],
    ['thermisch', 'flir'], ['thermal', 'flir'], ['thermique', 'flir'], ['热成像', 'flir'], ['flir', 'flir'], ['crt', 'crt'],
    ['noir', 'noir'], ['zwart', 'noir'], ['schwarz', 'noir'], ['黑白', 'noir'], ['sneeuw', 'snow'], ['snow', 'snow'], ['schnee', 'snow'], ['neige', 'snow'], ['雪', 'snow'],
    ['normaal', 'normal'], ['normal', 'normal'], ['正常', 'normal']];
const VOICE_GO = /(?:ga naar|vlieg naar|breng me naar|neem me mee naar|take me to|fly to|go to|geh(?:e)? zu|flieg(?:e)? nach|zeige|aller à|va à|vole vers|montre|去|飞到|前往)\s*(.+)/;
const VOICE_OFF = /\b(uit|off|verberg|hide|aus|ausblenden|désactive|cache)\b|关闭|隐藏/;
async function handleVoice(text) {
    const t = text.toLowerCase().trim();
    let reply = tr('v.notUnderstood');
    const go = t.match(VOICE_GO);
    const layer = VOICE_LAYERS.find(([w]) => t.includes(w));
    const style = VOICE_STYLES.find(([w]) => t.includes(w));
    if (go) { const r = await search(go[1]); reply = r ? `→ ${r}` : tr('v.locNotFound'); }
    else if (/(uitzoom|zoom out|wereldbeeld|globe|globus|reset|全球|地球)/.test(t)) { resetGlobe(); reply = `→ ${tr('btn.reset')}`; }
    else if (layer) { const on = !VOICE_OFF.test(t); applyLayer(layer[1], on, true); reply = `→ ${tr('layer.' + layer[1])} ${tr(on ? 'v.on' : 'v.off')}`; }
    else if (style) { setStyle(style[1], true); reply = `→ ${style[1].toUpperCase()}`; }
    else if (t.includes('hud')) { setHud(!S.hud); notify('OnToggle', 'hud', S.hud); reply = '→ HUD'; }
    else if (/detect|erkennung|détection|检测/.test(t)) { setDetect(!S.detect, true); reply = `→ ${tr('btn.detect')}`; }
    else if (/cockpit|驾驶/.test(t)) { setCockpit(true); reply = '→ cockpit'; }
    notify('OnVoice', text, reply);
}
export function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    const r = new SR();
    r.lang = { en: 'en-US', nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', zh: 'zh-CN' }[S.lang] || 'en-US';
    r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = e => handleVoice(e.results[0][0].transcript);
    r.onerror = e => toast(tr('toast.voiceErr', { e: e.error }));
    r.onend = () => notify('OnToggle', 'listening', false);
    r.start();
    return true;
}
