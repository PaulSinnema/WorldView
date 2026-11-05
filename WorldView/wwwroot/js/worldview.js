// WorldView globe engine: CesiumJS + keyless public feeds
const Cz = window.Cesium;
const SETTINGS_KEY = 'wv-settings';
const LAYERS = ['flights', 'military', 'trains', 'ov', 'air', 'satellites', 'telescopes', 'quakes', 'fires', 'launches', 'radio', 'cameras', 'plants', 'museums', 'airports'];
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
const TEL_IDS = new Set(TELESCOPES.map(([id]) => String(id))); // NORAD ids of the telescope layer
const TEL_GROUPS = ['science', 'visual']; // CelesTrak groups that hold most TELESCOPES (also in SAT_GROUPS)
const STYLE_KEYS = ['normal', 'crt', 'nvg', 'flir', 'ironbow', 'noir', 'snow'];
const BILLBOARD_LAYERS = ['flights', 'military', 'trains', 'ov', 'launches', 'cameras'];
const MOVERS = ['flights', 'military', 'trains', 'ov'];
const PLANES = ['flights', 'military'];
const TRAIN_COLOR = '#9dff3a', OV_COLOR = '#ffd23f';
// Public transport per mode: [icon, colour]
const OV_ICONS = { bus: ['bus', OV_COLOR], tram: ['tram', '#ff6b5a'], metro: ['metro', '#4da6ff'], ferry: ['ferry', '#5af0ff'] };
const FT = 0.3048, R_EARTH = 6371000;
const FEED_URL = 'https://flights.sinnema.ch'; // netcup VPS, see fetcher/README.md
const STATIC_URL = 'data'; // heavy datasets built on the PC (tools/build-*.mjs), shipped with the app
const DETECT_COLORS = { flights: '#3fd0ff', military: '#ffb020', trains: TRAIN_COLOR, ov: OV_COLOR, air: '#50f0e6', satellites: '#ffffff', quakes: '#ff5050', fires: '#ff7a1a', launches: '#c080ff', radio: '#ff4fd8', cameras: '#ff3b3b', telescopes: '#00e5ff', plants: '#ffd23f', museums: '#ff8fa3', airports: '#c8d2ff' };
// Translations (same cache-busting version as this module)
const { LANGS, LOCALES, pickLang, t, strings } = await import(`./i18n.js${new URL(import.meta.url).search}`);
const tr = (key, params) => t(S.lang, key, params);
const loc = () => LOCALES[S.lang] || 'en-GB';
const SAT_GROUPS = [['stations', '#ff5a5a', 'grp.stations'], ['visual', '#ffffff', 'grp.visual'], ['gps-ops', '#4cff8a', 'grp.gps'], ['weather', '#5ac8ff', 'grp.weather'], ['science', '#ffd23f', 'grp.science'], ['geo', '#b07aff', 'grp.geo'], ['resource', '#6bffb0', 'grp.resource']];
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
const ZOOM_DEFAULT = { cities: false, flights: false, military: false, trains: false, ov: false, air: false, satellites: false, telescopes: false, quakes: false, fires: false, launches: false, radio: false, cameras: false, plants: false, museums: false, airports: false };
const NIGHT_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
let nightLayer = null;
// Night brightness 0..100 → city-lights blend 0.8..0.05 (60 ≈ 0.35)
const nightAlpha = () => 0.8 - Math.max(0, Math.min(100, S.nightLight)) / 100 * 0.75;
// Detection labels: size (px), black plate on/off, plate opacity (%)
export function setDetectStyle(font, bg, alpha) {
    S.detectFont = Math.min(24, Math.max(10, +font || 14));
    S.detectBg = !!bg;
    S.detectBgAlpha = Math.min(100, Math.max(0, +alpha || 0));
    saveSettings();
}
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
let detectCanvas = null, detectCtx = null, lastCam = 0, lastInfo = 0, lastTrail = 0, lastOrbit = 0, lastTick = 0;
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
    for (const l of LAYERS) if (typeof S.layers[l] !== 'boolean') S.layers[l] = false; // new users start with a quiet globe
    if (!STYLE_KEYS.includes(S.style)) S.style = 'normal';
    if (typeof S.daynight !== 'boolean') S.daynight = true;
    if (typeof S.trails !== 'boolean') S.trails = true;
    if (!Number.isFinite(S.nightLight)) S.nightLight = 60;
    if (!Number.isFinite(S.detectFont)) S.detectFont = 14; // detection label size (px)
    if (typeof S.detectBg !== 'boolean') S.detectBg = false; // black plate under detection labels
    if (!Number.isFinite(S.detectBgAlpha)) S.detectBgAlpha = 60; // its opacity (%)
    if (typeof S.regions !== 'boolean') S.regions = true;
    if (typeof S.cities !== 'boolean') S.cities = true;
    if (typeof S.timezones !== 'boolean') S.timezones = false;
    if (typeof S.coast !== 'boolean') S.coast = false;
    if (typeof S.eez !== 'boolean') S.eez = false;
    if (typeof S.nature !== 'boolean') S.nature = false;
    if (typeof S.streets !== 'boolean') S.streets = false;
    if (typeof S.envOverlay !== 'string' || (S.envOverlay && !OWN_ENV.includes(S.envOverlay) && !GRID_LAYERS[S.envOverlay] && !ENV_LAYERS[S.envOverlay])) S.envOverlay = '';
    if (typeof S.envClick !== 'boolean') S.envClick = true;
    S.lang = pickLang(S.lang);
    if (!Array.isArray(S.radioFav)) S.radioFav = [];
    // Last filter per list panel (radio, museums, …)
    if (typeof S.panelFilters !== 'object' || !S.panelFilters) S.panelFilters = {};
    radioQuery = { ...radioQuery, ...(S.panelFilters.radio || {}) };
    museumQuery = { ...museumQuery, ...(S.panelFilters.museums || {}) };
    airportQuery = { ...airportQuery, ...(S.panelFilters.airports || {}) };
    loadListFilters();
    S.zoom = { ...ZOOM_DEFAULT, ...(S.zoom && typeof S.zoom === 'object' ? S.zoom : {}) };
    delete S.camZoom;
    // One-off reset: zoom now defaults to off for every layer
    if (S.zoomV !== 2) { S.zoom = { ...ZOOM_DEFAULT }; S.zoomV = 2; }
}
// iPhone/iPad (iPadOS reports as Mac with touch): tight memory limit → lighter geometry, no MSAA
const LITE = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Touch screen: no accidental tilt, on-screen nav pad instead
const TOUCH = navigator.maxTouchPoints > 0 && matchMedia('(any-pointer: coarse)').matches;
// Crash guard: a flag set while starting or loading heavy overlays; still set at the next start = the page crashed → start without overlays
const BOOT_KEY = 'wv-boot';
let bootTimer = null;
function markRisky() {
    try { localStorage.setItem(BOOT_KEY, '1'); } catch { }
    clearTimeout(bootTimer);
    bootTimer = setTimeout(() => { try { localStorage.removeItem(BOOT_KEY); } catch { } }, 20000);
}
function crashedLastTime() { try { return localStorage.getItem(BOOT_KEY) === '1'; } catch { return false; } }

// Crash report, kept on this device only: events + state every 3 s in localStorage.
// Previous session ended while visible without pagehide = crash → report in wv-crash, shown via the ⚠ button or #crash
const CRUMB_KEY = 'wv-crumbs', SNAP_KEY = 'wv-snap', CRASH_KEY = 'wv-crash', VIEW_KEY = 'wv-view';
const APP_VER = new URL(import.meta.url).searchParams.get('v') || '?';
const T0 = Date.now(), crumbs = [];
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
function crumb(m) {
    crumbs.push(`${((Date.now() - T0) / 1000).toFixed(1)}s ${m}`);
    if (crumbs.length > 80) crumbs.shift();
}
function stateSnap(extra) {
    const c = viewer?.camera.positionCartographic;
    const on = o => Object.entries(o).filter(([, v]) => v).map(([k]) => k).join(' ');
    return {
        v: APP_VER, t: new Date().toISOString(), up: Math.round((Date.now() - T0) / 1000), visible: document.visibilityState === 'visible',
        layers: LAYERS.filter(l => S.layers[l]).map(l => `${l}:${store[l].size}`).join(' '),
        overlays: on({ borders: S.borders, coast: S.coast, cities: S.cities, regions: S.regions, eez: S.eez, timezones: S.timezones, nature: S.nature, streets: S.streets, daynight: S.daynight, detect: S.detect }),
        env: S.envOverlay, basemap: S.basemap, style: S.style, cockpit: S.cockpit,
        cam: c ? `${toDeg(c.latitude).toFixed(2)},${toDeg(c.longitude).toFixed(2)} ${Math.round(c.height)} m` : null,
        prims: viewer?.scene.primitives.length, imagery: viewer?.imageryLayers.length, entities: viewer?.entities.values.length,
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
        screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`, selected: selected ? `${selected.layer}:${selected.key}` : null, ...extra
    };
}
function saveCrashState(extra) { lsSet(SNAP_KEY, stateSnap(extra)); lsSet(CRUMB_KEY, crumbs); }
// At start: did the previous session crash? Then keep its state + events as the report
function checkCrash() {
    const prev = lsGet(SNAP_KEY);
    if (!prev || !prev.visible || prev.exit) return false;
    lsSet(CRASH_KEY, { detected: new Date().toISOString(), ua: navigator.userAgent, lite: LITE, last: prev, crumbs: lsGet(CRUMB_KEY) || [] });
    return true;
}
export function crashReportText() {
    const r = lsGet(CRASH_KEY);
    if (!r) return 'No crash report on this device.';
    return ['WorldView crash report', `detected: ${r.detected}`, `ua: ${r.ua}`, `lite: ${r.lite}`, '', 'Last state:',
        ...Object.entries(r.last).map(([k, v]) => `  ${k}: ${v}`), '', 'Last events:', ...r.crumbs.map(c => '  ' + c)].join('\n');
}
// ⚠ button (after a crash or with #crash) → overlay with the report, Copy / Share / Delete
function showCrashButton() {
    const b = document.createElement('button');
    b.className = 'crash-btn'; b.textContent = '⚠ Crash report';
    b.addEventListener('click', () => { b.remove(); showCrashReport(); });
    document.body.appendChild(b);
}
function showCrashReport() {
    const text = crashReportText();
    const ov = document.createElement('div');
    ov.className = 'crash-report';
    const pre = document.createElement('pre'); pre.textContent = text;
    const bar = document.createElement('div');
    const btn = (label, fn) => { const x = document.createElement('button'); x.textContent = label; x.addEventListener('click', fn); bar.appendChild(x); return x; };
    const copy = btn('Copy', async () => { try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied ✓'; } catch { copy.textContent = 'Copy failed'; } });
    if (navigator.share) btn('Share', () => navigator.share({ title: 'WorldView crash report', text }).catch(() => { }));
    btn('Delete', () => { try { localStorage.removeItem(CRASH_KEY); } catch { } ov.remove(); });
    btn('Close', () => ov.remove());
    ov.append(bar, pre);
    document.body.appendChild(ov);
}
let lastSettings = null;
function saveSettings() {
    try {
        const { cockpit, ...rest } = S;
        // Event log: which settings changed (token value left out)
        if (lastSettings) for (const k of Object.keys(rest)) {
            const a = lastSettings[k], b = rest[k];
            if (JSON.stringify(a) === JSON.stringify(b)) continue;
            if (k === 'ionToken') crumb('ionToken changed');
            else if (b && typeof b === 'object') crumb(`${k} ${Object.keys(b).filter(x => a?.[x] !== b[x]).map(x => `${x}=${b[x]}`).join(' ')}`);
            else crumb(`${k}=${String(b).slice(0, 40)}`);
        }
        lastSettings = JSON.parse(JSON.stringify(rest));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
    } catch { }
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
    } else if (kind === 'heli') {
        // Top view: cabin, tail boom with fin (rotor drawn after the fill)
        g.ellipse(0, -2, 5, 8, 0, 0, Math.PI * 2);
        g.moveTo(1.5, 5); g.lineTo(1.2, 12); g.lineTo(4, 13); g.lineTo(4, 15); g.lineTo(-4, 15); g.lineTo(-4, 13); g.lineTo(-1.2, 12); g.lineTo(-1.5, 5); g.closePath();
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
    if (kind === 'heli') {
        // Main rotor: two crossed blades through the rotor hub, dark edge
        g.beginPath(); g.moveTo(-11, -13); g.lineTo(11, 9); g.moveTo(11, -13); g.lineTo(-11, 9);
        g.lineCap = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.stroke();
        g.lineWidth = 2; g.strokeStyle = color; g.stroke();
    }
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
    // Sea ice: GIBS's web-mercator pyramid serves stray wrong tiles (other products) for this layer → geographic pyramid (e[6]),
    // polar areas only (e[5])
    seaIce: ['GHRSST_L4_MUR_Sea_Ice_Concentration', 6, 0, null, 0, [[-180, 40, 180, 90], [-180, -90, 180, -45]], '1km'],
    // TROPOMI: the latest day is still incomplete, so show the day before yesterday (3rd value = days back)
    // Per-pixel filter (e[7]): clean air (pale yellow) fades out, gaps between swath lines filled
    no2: ['TROPOMI_L2_Nitrogen_Dioxide_Tropospheric_Column', 6, 2, null, 0, null, null, no2Alpha],
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
// Relative scale for greenhouse gases (range = 2nd–98th percentile of today's field): blue → green → yellow → red
const REL_STOPS = [[0, [40, 50, 170, 185]], [0.25, [30, 150, 230, 185]], [0.5, [60, 200, 120, 185]], [0.75, [250, 210, 40, 195]], [1, [220, 40, 40, 205]]];
const relRgba = (lo, hi) => v => {
    if (v == null) return [0, 0, 0, 0];
    const f = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
    for (let i = 1; i < REL_STOPS.length; i++) {
        const [f1, c1] = REL_STOPS[i];
        if (f <= f1) { const [f0, c0] = REL_STOPS[i - 1], k = (f - f0) / (f1 - f0); return c0.map((c, j) => Math.round(c + (c1[j] - c) * k)); }
    }
    return REL_STOPS.at(-1)[1];
};
function pctRange(v) {
    const s = v.filter(x => x != null).sort((a, b) => a - b);
    return s.length ? [s[Math.floor(s.length * 0.02)], s[Math.floor(s.length * 0.98)]] : [0, 1];
}
// Temperature anomaly (°C ×10 in the file): blue colder, red warmer; near-normal fades out
const ANOM_STOPS = [[-10, [5, 48, 97]], [-5, [67, 147, 195]], [-2, [146, 197, 222]], [0, [247, 247, 247]], [2, [244, 165, 130]], [5, [214, 96, 77]], [10, [103, 0, 31]]];
function anomRgba(v10) {
    if (v10 == null) return [0, 0, 0, 0];
    const v = Math.max(-10, Math.min(10, v10 / 10)), a = Math.round(Math.min(1, 0.25 + Math.abs(v) / 4) * 200);
    for (let i = 1; i < ANOM_STOPS.length; i++) {
        const [v1, c1] = ANOM_STOPS[i];
        if (v <= v1) { const [v0, c0] = ANOM_STOPS[i - 1], f = (v - v0) / (v1 - v0); return [...c0.map((c, k) => Math.round(c + (c1[k] - c) * f)), a]; }
    }
    return [...ANOM_STOPS.at(-1)[1], a];
}
// Fetcher grids → smooth translucent image: [file, colour fn (or factory for relative scales), credit, unit for relative legend]
const GRID_LAYERS = {
    tempAnom: ['tempanom.json', anomRgba, 'NASA GISTEMP v4'],
    nh3: ['nh3.json', nh3Rgba, 'Open-Meteo / CAMS Europe'], ozoneCams: ['ozone.json', o3Rgba, 'NOAA GFS']
};
// Grid files cached for 10 minutes (layer + legend share one download)
const gridCache = {};
function loadGrid(file) {
    const b = Math.floor(Date.now() / 600000), c = gridCache[file];
    if (c?.b === b) return c.p;
    const p = tryJson(`${FEED_URL}/${file}?b=${b}`, 20000);
    gridCache[file] = { b, p };
    return p;
}
async function addGridLayer(gen, [file, rgbaFn, credit]) {
    const d = await loadGrid(file);
    if (!d?.v || gen !== envGen) { if (!d?.v) toast(tr('err.noData')); return; }
    const rgba = rgbaFn || relRgba(...pctRange(d.v));
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
    envLayer = envAdd(provider);
}
// Environment imagery is tagged, so switching always removes every earlier overlay (also late async ones)
// NO2 palette pale yellow → orange → red: strength = how much redder than green/blue; pale (clean air) and grey (no retrieval) → transparent
function no2Alpha(r, g, b) { return Math.max(0, Math.min(1, ((2 * r - g - b) / 510 - 0.3) / 0.2)); }
// One source tile on a canvas: alpha per pixel, then fills 1–2 px gaps (L2 swath lines)
function filterTile(img, alphaOf) {
    const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h), a = d.data;
    for (let i = 0; i < a.length; i += 4) if (a[i + 3]) a[i + 3] = Math.round(a[i + 3] * alphaOf(a[i], a[i + 1], a[i + 2]));
    // Fill empty pixels from the nearest filled one above/below/left/right (two passes)
    for (let pass = 0; pass < 2; pass++) {
        const src = a.slice();
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
            const i = (yy * w + xx) * 4;
            if (src[i + 3]) continue;
            for (const j of [i - w * 4, i + w * 4, xx ? i - 4 : -1, xx < w - 1 ? i + 4 : -1]) {
                if (j >= 0 && j < src.length && src[j + 3]) { a[i] = src[j]; a[i + 1] = src[j + 1]; a[i + 2] = src[j + 2]; a[i + 3] = src[j + 3]; break; }
            }
        }
    }
    g.putImageData(d, 0, 0);
    return c;
}
// Every tile built from one fixed source level: GIBS samples L2 swaths differently per level, so the picture changed while zooming.
// Lower levels = downscaled mosaic of source tiles, higher levels = Cesium enlarges the source level
const FILTER_SRC_LEVEL = 4; // ≈ 6–10 km per pixel; whole world = 256 tiles
function filteredProvider(opts, alphaOf) {
    const p = new Cz.UrlTemplateImageryProvider({ ...opts, maximumLevel: FILTER_SRC_LEVEL });
    const url = (x, y) => opts.url.replace('{z}', FILTER_SRC_LEVEL).replace('{y}', y).replace('{x}', x);
    const cache = new Map(); // processed source tiles, LRU
    const source = (x, y) => {
        const k = `${x}/${y}`;
        let pr = cache.get(k);
        if (pr) { cache.delete(k); cache.set(k, pr); return pr; }
        pr = fetch(url(x, y)).then(r => r.ok ? r.blob() : null).then(b => b && createImageBitmap(b)).then(img => img && filterTile(img, alphaOf)).catch(() => null);
        cache.set(k, pr);
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return pr;
    };
    p.requestImage = async (x, y, level) => {
        const n = 2 ** (FILTER_SRC_LEVEL - level), s = 256 / n, out = document.createElement('canvas'); out.width = out.height = 256;
        const g = out.getContext('2d'); g.imageSmoothingQuality = 'high';
        const parts = [];
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) parts.push(source(x * n + i, y * n + j).then(c => { if (c) g.drawImage(c, i * s, j * s, s, s); }));
        await Promise.all(parts);
        return out;
    };
    return p;
}
function envAdd(provider) {
    const l = viewer.imageryLayers.addImageryProvider(provider);
    l._wvEnv = true;
    return l;
}
function clearEnvLayers() {
    const L = viewer.imageryLayers;
    for (let i = L.length - 1; i >= 0; i--) if (L.get(i)._wvEnv) L.remove(L.get(i));
    envLayer = null;
    envLabels = [];
}
// Value labels of the current env layer: { pos, title, value, rank }
let envLabels = [];
function drawEnvLabels(ctx, occ, toWin, w, h) {
    if (!envLabels.length) return;
    const cam = viewer.camera.positionWC, placed = [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = '#fff';
    for (const l of envLabels) {
        if (!occ.isPointVisible(l.pos)) continue;
        const s = toWin(viewer.scene, l.pos, scratchWin);
        if (!s || s.x < -100 || s.y < -50 || s.x > w + 100 || s.y > h + 50) continue;
        // Same distance scaling as the country names
        const d = Cz.Cartesian3.distance(cam, l.pos), t = Math.min(1, Math.max(0, (d - 1e6) / 1.9e7)), k = 1.1 - 0.35 * t;
        const f1 = 12 * k, f2 = 14 * k, x = Math.round(s.x), y = Math.round(s.y);
        ctx.font = `600 ${f1.toFixed(1)}px "Share Tech Mono", monospace`; const w1 = ctx.measureText(l.title).width;
        ctx.font = `bold ${f2.toFixed(1)}px sans-serif`; const w2 = ctx.measureText(l.value).width;
        const hw = Math.max(w1, w2) / 2 + 3, top = y - f2 - 2, bottom = y + f2 + 2;
        if (placed.some(p => x - hw < p[2] && x + hw > p[0] && top < p[3] && bottom > p[1])) continue;
        placed.push([x - hw, top, x + hw, bottom]);
        ctx.font = `600 ${f1.toFixed(1)}px "Share Tech Mono", monospace`; ctx.lineWidth = 3;
        ctx.strokeText(l.title, x, y - f2 * 0.6); ctx.fillText(l.title, x, y - f2 * 0.6);
        ctx.font = `bold ${f2.toFixed(1)}px sans-serif`; ctx.lineWidth = 3.5;
        ctx.strokeText(l.value, x, y + f2 * 0.6); ctx.fillText(l.value, x, y + f2 * 0.6);
    }
}
// Own legend: colour bar as data URL; shown at ~half size in the panel, so large type
function gridLegendUrl(rgba, max, ticks, unit, min = 0) {
    const c = document.createElement('canvas'); c.width = 420; c.height = 84;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    for (let x = 0; x < 400; x++) { const [r, gg, b, a] = rgba(min + x / 400 * (max - min)); g.fillStyle = `rgba(${r},${gg},${b},${a / 255})`; g.fillRect(10 + x, 6, 1, 22); }
    g.strokeStyle = '#999'; g.strokeRect(10, 6, 400, 22);
    g.fillStyle = '#111'; g.font = 'bold 19px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    ticks.forEach((t, i) => {
        const [v, lab] = Array.isArray(t) ? t : [t, t], x = 10 + (v - min) / (max - min) * 400;
        g.textAlign = i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center'; // keep edge labels inside
        g.fillText(String(lab), i === 0 ? Math.max(4, x) : i === ticks.length - 1 ? Math.min(416, x) : x, 34);
    });
    g.font = '18px sans-serif'; g.textAlign = 'center'; g.fillText(unit, 210, 60);
    return c.toDataURL();
}
const nh3LegendUrl = () => gridLegendUrl(nh3Rgba, 45, [0, 5, 10, 20, 30, 45], 'NH₃ µg/m³');
const anomLegendUrl = () => gridLegendUrl(anomRgba, 100, [[-100, '−10'], [-50, '−5'], [0, '0'], [50, '+5'], [100, '+10']], tr('env.anomUnit'), -100);
const o3LegendUrl = () => gridLegendUrl(o3Rgba, 500, [150, 220, 300, 380, 450, 500], 'O₃ Dobson (DU)', 150);
// Environment overlays with their own rendering (not GIBS or fetcher grids)
const OWN_ENV = ['coral', 'power', 'powerYear'];
// NOAA Coral Reef Watch bleaching alert (7-day max), ERDDAP WMS; colours as ERDDAP draws levels 0–4 (checked against the data)
const CRW_LEVELS = [['#0000ff', 'crw.watch'], ['#00ff00', 'crw.warning'], ['#ff9900', 'crw.alert1'], ['#800000', 'crw.alert2']];
// Global image prepared by the fetcher (coral.png, from the ERDDAP WMS)
async function addCoralLayer(gen) {
    let provider;
    try {
        provider = await Cz.SingleTileImageryProvider.fromUrl(`${FEED_URL}/coral.png?b=${Math.floor(Date.now() / 3600000)}`,
            { rectangle: Cz.Rectangle.fromDegrees(-180, -90, 180, 90), credit: 'NOAA Coral Reef Watch' });
    } catch { if (gen === envGen) toast(tr('err.noData')); return; }
    if (gen !== envGen) return;
    envLayer = envAdd(provider);
    envLayer.alpha = 0.8;
    // Level 0 (no stress, purple) transparent
    envLayer.colorToAlpha = Cz.Color.fromCssColorString('#800080'); envLayer.colorToAlphaThreshold = 0.05;
}
// Shown at ~half size in the panel: one row per level (swatch + large label)
function coralLegendUrl() {
    const c = document.createElement('canvas'); c.width = 420; c.height = 8 + CRW_LEVELS.length * 38;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.textBaseline = 'middle'; g.font = 'bold 24px sans-serif';
    CRW_LEVELS.forEach(([col, key], i) => {
        const y = 6 + i * 38;
        g.fillStyle = col; g.fillRect(10, y, 56, 30);
        g.fillStyle = '#111'; g.fillText(tr(key), 80, y + 16);
    });
    return c.toDataURL();
}
// Electricity CO2 intensity per European country (fetcher power.json from Energy-Charts; estimate from the generation mix)
const CI_STOPS = [[0, [26, 152, 80, 170]], [150, [145, 207, 96, 170]], [300, [254, 224, 139, 175]], [450, [252, 141, 89, 180]], [600, [215, 48, 39, 185]], [800, [127, 0, 0, 190]]];
function ciRgba(v) {
    if (v == null) return [0, 0, 0, 0];
    if (v <= 0) return CI_STOPS[0][1];
    for (let i = 1; i < CI_STOPS.length; i++) {
        const [v1, c1] = CI_STOPS[i];
        if (v <= v1) { const [v0, c0] = CI_STOPS[i - 1], f = (v - v0) / (v1 - v0); return c0.map((c, k) => Math.round(c + (c1[k] - c) * f)); }
    }
    return CI_STOPS.at(-1)[1];
}
let euCountries = null;
// Electricity now (Europe, fetcher power.json: ISO2 keys, Energy-Charts)
async function addPowerLayer(gen) {
    const d = await loadGrid('power.json');
    if (!d?.c) { if (gen === envGen) toast(tr('err.noData')); return; }
    const iso2 = p => { const c = String(p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2).toLowerCase(); return c === 'gb' ? 'uk' : c; };
    await addCountryLayer(gen, p => d.c[iso2(p)], EUROPE_BOX, 40, 'Energy-Charts (Fraunhofer ISE)');
}
const EUROPE_BOX = [-25, 34, 45, 72];
// Electricity per year (whole world, data/energy-year.json from Our World in Data / Ember: ISO3 → [year, g/kWh, renewable %])
let energyYear = null;
async function addPowerYearLayer(gen) {
    const d = await (energyYear ??= tryJson(`${FEED_URL}/energy-year.json`, 20000));
    if (!d) { energyYear = null; if (gen === envGen) toast(tr('err.noData')); return; }
    const iso3 = p => p.ISO_A3 && p.ISO_A3 !== '-99' ? p.ISO_A3 : p.ADM0_A3; // France, Norway: ISO_A3 is -99 in Natural Earth
    const val = p => { const r = d[iso3(p)]; return r && { ci: r[1], ren: r[2] }; };
    // World at low resolution (labels outside Europe) + Europe sharp on top (room for all its small countries)
    await addCountryLayer(gen, val, [-180, -90, 180, 90], 11, 'Ember / Our World in Data', 99, EUROPE_BOX);
    await addCountryLayer(gen, val, EUROPE_BOX, 40, 'Ember / Our World in Data');
}
// Country choropleth by g CO2/kWh with value labels; valueOf(props) → { ci, ren } | null; labels only up to maxRank (NE LABELRANK)
async function addCountryLayer(gen, valueOf, [W0, S0, E0, N0], K, credit, maxRank = 99, noLabels = null) {
    const geo = await (euCountries ??= tryJson(NE_BASE + 'ne_50m_admin_0_countries.geojson', 30000));
    if (!geo?.features) { euCountries = null; if (gen === envGen) toast(tr('err.noData')); return; }
    if (gen !== envGen) return;
    const cv = document.createElement('canvas');
    cv.width = (E0 - W0) * K; cv.height = (N0 - S0) * K;
    const g = cv.getContext('2d'), X = lon => (lon - W0) * K, Y = lat => (N0 - lat) * K;
    const labels = [];
    for (const f of geo.features) {
        const v = valueOf(f.properties);
        if (!v || v.ci == null) continue;
        const [r, gg, b, a] = ciRgba(v.ci);
        g.fillStyle = `rgba(${r},${gg},${b},${a / 255})`;
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        g.beginPath();
        for (const poly of polys) for (const ring of poly) ring.forEach(([lon, lat], i) => i ? g.lineTo(X(lon), Y(lat)) : g.moveTo(X(lon), Y(lat)));
        g.fill('evenodd');
        const rank = f.properties.LABELRANK ?? 9;
        if (rank <= maxRank) labels.push([f.properties.LABEL_X, f.properties.LABEL_Y, v, countryName(f.properties) || f.properties.NAME || '', rank]);
    }
    // Area covered by a sharper layer: leave empty (no double colour)
    if (noLabels) g.clearRect(X(noLabels[0]), Y(noLabels[3]), (noLabels[2] - noLabels[0]) * K, (noLabels[3] - noLabels[1]) * K);
    // Per country: name, g CO2/kWh and renewable share; drawn on the screen overlay (constant size, decluttered per frame)
    for (const [lon, lat, v, name, rank] of labels) {
        if (!Number.isFinite(lon) || lon < W0 || lon > E0 || lat < S0 || lat > N0) continue;
        if (noLabels && lon >= noLabels[0] && lon <= noLabels[2] && lat >= noLabels[1] && lat <= noLabels[3]) continue; // handled by the sharper layer
        envLabels.push({ pos: Cz.Cartesian3.fromDegrees(lon, lat, 200), title: name.toUpperCase(), value: `${v.ci} g${v.ren != null ? ` · ${v.ren}% ♻` : ''}`, rank });
    }
    envLabels.sort((a, b) => a.rank - b.rank); // important countries win overlaps
    const provider = await Cz.SingleTileImageryProvider.fromUrl(cv.toDataURL(), { rectangle: Cz.Rectangle.fromDegrees(W0, S0, E0, N0), credit });
    if (gen !== envGen) return;
    envLayer = envAdd(provider);
}
const powerLegendUrl = () => gridLegendUrl(ciRgba, 800, [0, 200, 400, 600, 800], S.envOverlay === 'powerYear' ? 'g CO₂/kWh · ♻ %' : tr('env.ciUnit'));
function addEnvLayer() {
    clearEnvLayers();
    const gen = ++envGen;
    if (S.envOverlay === 'coral') { addCoralLayer(gen); return; }
    if (S.envOverlay === 'power') { addPowerLayer(gen); return; }
    if (S.envOverlay === 'powerYear') { addPowerYearLayer(gen); return; }
    if (GRID_LAYERS[S.envOverlay]) { addGridLayer(gen, GRID_LAYERS[S.envOverlay]); return; }
    const e = ENV_LAYERS[S.envOverlay];
    if (!e) return;
    const time = e[2] ? new Date(Date.now() - e[2] * 86400000).toISOString().slice(0, 10) : 'default';
    // Optional areas (e[5]): only request tiles there (one imagery layer per area)
    for (const r of e[5] || [null]) {
        // EPSG:4326 pyramid: 512 px tiles, level 0 = 2×1 tiles of 288° (grid extends past the date line and the south pole)
        const geo = e[6] ? {
            url: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${e[0]}/default/${time}/${e[6]}/{z}/{y}/{x}.png`, tileWidth: 512, tileHeight: 512,
            tilingScheme: new Cz.GeographicTilingScheme({ rectangle: Cz.Rectangle.fromDegrees(-180, -198, 396, 90), numberOfLevelZeroTilesX: 2, numberOfLevelZeroTilesY: 1 })
        } : { url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${e[0]}/default/${time}/GoogleMapsCompatible_Level${e[1]}/{z}/{y}/{x}.png` };
        const opts = { ...geo, maximumLevel: e[1], credit: 'NASA GIBS', ...(r ? { rectangle: Cz.Rectangle.fromDegrees(...r) } : {}) };
        envLayer = envAdd(e[7] ? filteredProvider(opts, e[7]) : new Cz.UrlTemplateImageryProvider(opts));
        envLayer.alpha = 0.75;
        // Lowest (clean) values transparent, so only real concentrations show
        if (e[3]) { envLayer.colorToAlpha = Cz.Color.fromCssColorString(e[3]); envLayer.colorToAlphaThreshold = e[4] ?? 0.12; }
    }
}
// Legend image (colour bar with units) from NASA GIBS, named after the palette (from Worldview's config)
const ENV_PALETTE = {
    lstDay: 'MODIS_Land_Surface_Temp', lstNight: 'MODIS_Land_Surface_Temp', sst: 'GHRSST_Sea_Surface_Temperature',
    sstAnom: 'GHRSST_Sea_Surface_Temperature_Anomalies', seaIce: 'GHRSST_Sea_Ice_Concentration', no2: 'OMI_Nitrogen_Dioxide_Tropo_Column', so2: 'MERRA2_SO2_Column_Mass_Density_Monthly', ozone: 'OMPS_Ozone_Total_Column',
    aod: 'MODIS_VIIRS_AOD', rain: 'GPM_Precipitation_Rate', ndvi: 'MODIS_NDVI', snow: 'SMAP_Snow_Mass'
};
// NASA legends: drawn ourselves from the GIBS colour map (large type, Kelvin shown as °C); GIBS image as fallback
const gibsLegends = {};
const fmtNum = v => {
    const a = Math.abs(v);
    if (a >= 1e5 || (a > 0 && a < 1e-3)) return v.toExponential(1).replace('e+', 'e'); // e.g. 4.8e15
    return a >= 100 || Number.isInteger(v) ? String(Math.round(v)) : a >= 10 ? v.toFixed(1).replace(/\.0$/, '') : String(+v.toPrecision(2));
};
async function gibsLegendUrl(key) {
    const palette = ENV_PALETTE[key], cacheKey = key + S.lang;
    if (gibsLegends[cacheKey]) return gibsLegends[cacheKey];
    const fallback = `https://gibs.earthdata.nasa.gov/legends/${palette}_H.png`;
    // Colour map per layer id, else per palette name
    let r = await fetch(`https://gibs.earthdata.nasa.gov/colormaps/v1.3/${ENV_LAYERS[key][0]}.xml`).catch(() => null);
    if (!r?.ok) r = await fetch(`https://gibs.earthdata.nasa.gov/colormaps/v1.3/${palette}.xml`).catch(() => null);
    if (!r?.ok) return fallback;
    const doc = new DOMParser().parseFromString(await r.text(), 'text/xml');
    // The data colour map: the one with most coloured entries
    const maps = [...doc.getElementsByTagName('ColorMap')].map(m => ({ m, n: [...m.getElementsByTagName('ColorMapEntry')].filter(e => e.getAttribute('transparent') !== 'true').length }));
    const best = maps.sort((a, b) => b.n - a.n)[0]?.m;
    if (!best) return fallback;
    const units = best.getAttribute('units') || '', kelvin = units === 'K', title = tr('env.' + key);
    const rgbOf = e => (e.getAttribute('rgb') || '0,0,0').split(',').map(Number);
    // Classification (e.g. ice / snow classes): one row per class
    const legendType = best.getElementsByTagName('Legend')[0]?.getAttribute('type');
    if (legendType === 'classification') {
        const rows = [...best.getElementsByTagName('LegendEntry')].map(e => [rgbOf(e), e.getAttribute('tooltip') || '']).slice(0, 8);
        const c = document.createElement('canvas'); c.width = 420; c.height = 8 + rows.length * 38;
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.textBaseline = 'middle'; g.font = 'bold 24px sans-serif';
        rows.forEach(([[rr, gg, bb], label], i) => { g.fillStyle = `rgb(${rr},${gg},${bb})`; g.fillRect(10, 6 + i * 38, 56, 30); g.fillStyle = '#111'; g.fillText(label, 80, 22 + i * 38); });
        return gibsLegends[cacheKey] = c.toDataURL();
    }
    // Continuous: entries in order, equal width (as NASA draws them, also for non-linear scales)
    let ents = [];
    for (const e of best.getElementsByTagName('ColorMapEntry')) {
        if (e.getAttribute('transparent') === 'true' || e.getAttribute('nodata') === 'true') continue;
        const m = /\[\s*([+-]?INF|[-+\d.eE]+)\s*,\s*([+-]?INF|[-+\d.eE]+)\s*[)\]]/.exec(e.getAttribute('value') || '');
        const lo = m ? parseFloat(m[1]) : parseFloat(e.getAttribute('value'));
        const hi = m ? parseFloat(m[2]) : lo;
        if (!Number.isFinite(lo) && !Number.isFinite(hi)) continue;
        ents.push({ rgb: rgbOf(e), v: Number.isFinite(lo) ? lo : hi, w: Number.isFinite(lo) && Number.isFinite(hi) ? hi - lo : Infinity });
    }
    // Drop open-ended / catch-all classes at the ends (e.g. 0–200 K before 200.0–200.6 K)
    const ws = ents.map(e => e.w).filter(Number.isFinite).sort((a, b) => a - b), med = ws[ws.length >> 1] || 0;
    if (med > 0) ents = ents.filter(e => e.w <= med * 20);
    if (ents.length < 2) return fallback;
    const n = ents.length, conv = v => kelvin ? v - 273.15 : v;
    const rgba = i => [...ents[Math.min(n - 1, Math.max(0, Math.floor(i)))].rgb, 255];
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => { const i = Math.min(n - 1, Math.round(f * (n - 1))); return [f * n, fmtNum(conv(ents[i].v))]; });
    const unit = `${title}${units ? ` (${kelvin ? '°C' : units})` : ''}`;
    return gibsLegends[cacheKey] = gridLegendUrl(rgba, n, ticks, unit, 0);
}
// Relative legend (greenhouse gases): today's range from the data
async function relLegendUrl([file, , , unit]) {
    const d = await loadGrid(file);
    if (!d?.v) return '';
    const [lo, hi] = pctRange(d.v), step = (hi - lo) / 4, dec = hi - lo < 20 ? 1 : 0;
    const ticks = [0, 1, 2, 3, 4].map(i => +(lo + i * step).toFixed(dec));
    return gridLegendUrl(relRgba(lo, hi), hi, ticks, unit, lo);
}
const envLegend = async () => S.envOverlay === 'coral' ? coralLegendUrl() : S.envOverlay === 'power' || S.envOverlay === 'powerYear' ? powerLegendUrl()
    : GRID_LAYERS[S.envOverlay]?.[3] ? relLegendUrl(GRID_LAYERS[S.envOverlay])
    : S.envOverlay === 'nh3' ? nh3LegendUrl() : S.envOverlay === 'ozoneCams' ? o3LegendUrl() : S.envOverlay === 'tempAnom' ? anomLegendUrl()
    : ENV_PALETTE[S.envOverlay] && ENV_LAYERS[S.envOverlay] ? gibsLegendUrl(S.envOverlay) : '';
export function setEnvOverlay(name) {
    S.envOverlay = ENV_LAYERS[name] || GRID_LAYERS[name] || OWN_ENV.includes(name) ? name : ''; saveSettings();
    clearEnvLayers();
    addEnvLayer();
    return envLegend();
}
export const getEnvLegend = () => envLegend();
// Source of the environment layer, shown in the HUD
const ENV_SOURCE = {
    tempAnom: 'NASA GISTEMP v4', lstDay: 'NASA GIBS · MODIS Terra', lstNight: 'NASA GIBS · MODIS Terra', sst: 'NASA GIBS · GHRSST MUR',
    sstAnom: 'NASA GIBS · GHRSST MUR', coral: 'NOAA Coral Reef Watch', seaIce: 'NASA GIBS · GHRSST MUR', no2: 'NASA GIBS · Sentinel-5P TROPOMI',
    so2: 'NASA GIBS · MERRA-2', nh3: 'Open-Meteo · CAMS Europe',
    powerYear: 'Ember · Our World in Data', power: 'Energy-Charts (Fraunhofer ISE)', ozoneCams: 'NOAA GFS', ozone: 'NASA GIBS · OMPS',
    aod: 'NASA GIBS · MODIS/VIIRS MAIAC', rain: 'NASA GIBS · GPM IMERG', ndvi: 'NASA GIBS · MODIS Terra', snow: 'NASA GIBS · SMAP L4'
};
export const getEnvSource = () => ENV_SOURCE[S.envOverlay] || '';
// Layers that need a key on the fetcher (status.json keys); unknown or missing key → listed as unavailable
const ENV_KEY = {};
export async function getEnvMissing() {
    const s = await tryJson(`${FEED_URL}/status.json?b=${Math.floor(Date.now() / 60000)}`, 10000);
    return Object.entries(ENV_KEY).filter(([, k]) => !s?.keys?.[k]).map(([layer]) => layer);
}
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
    const crashed = checkCrash();
    crumb(`start v${APP_VER}${crashed ? ' (previous session crashed)' : ''}`);
    saveCrashState(); // a crash during start-up is caught too
    // Previous start crashed (iOS reloads the page after running out of memory): heavy overlays off, else it loops
    const safe = crashedLastTime();
    if (safe) { S.borders = false; S.timezones = false; S.nature = false; S.streets = false; S.envOverlay = ''; saveSettings(); }
    markRisky();
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
        msaaSamples: LITE ? 1 : 4
    });
    if (safe) setTimeout(() => toast(tr('toast.safeMode')), 3000);
    checkGpu();
    const scene = viewer.scene;
    // Star sky: NASA SVS Deep Star Maps 2020 (Gaia/Hipparcos/Tycho) as cube faces (tools/build-sky.py)
    const sky = f => `sky/${f}.jpg?v=2`;
    scene.skyBox = new Cz.SkyBox({ sources: { positiveX: sky('px'), negativeX: sky('nx'), positiveY: sky('py'), negativeY: sky('ny'), positiveZ: sky('pz'), negativeZ: sky('nz') } });
    // Sharp text: FXAA blurs labels (MSAA handles edges); render at full device resolution
    scene.postProcessStages.fxaa.enabled = false;
    // iOS: CSS-pixel resolution (4× smaller GL buffers on Retina); labels stay sharp on their own canvas
    viewer.useBrowserRecommendedResolution = LITE;
    scene.screenSpaceCameraController.minimumZoomDistance = 30;
    // Touch: two-finger drag tilted the view by accident (globe slid off the bottom); pinch only zooms now
    if (TOUCH) scene.screenSpaceCameraController.tiltEventTypes = [Cz.CameraEventType.MIDDLE_DRAG];
    addNavPad(); // on every device (also PC)
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
    loadModels(); // ISS + telescopes as 3D models (async, non-blocking)

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
            let on = (S.detect ? orbNameHits.concat(detectHits) : []).concat(labelHits).some(([hx, hy, w, h]) => x >= hx && x <= hx + w && y >= hy && y <= hy + h);
            if (!on) { const id = scene.pick(hoverPos)?.id; on = !!(id?.wv || id?.city || id?.country || id?.region); }
            scene.canvas.style.cursor = on ? 'pointer' : '';
        }, 80);
    }, Cz.ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction(e => {
        const inHit = ([x, y, w, h]) => e.position.x >= x && e.position.x <= x + w && e.position.y >= y && e.position.y <= y + h;
        // Detection on: orbit names, then target boxes + labels: click selects the object
        const oh = S.detect ? orbNameHits.findLast(inHit) ?? detectHits.findLast(inHit) : null;
        if (oh) { select(oh[4], oh[5], true); return; }
        // Labels live on the 2D canvas: hit-test them first (telescopes, cities, countries)
        const hit = labelHits.findLast(inHit)?.[4];
        if (hit?.wv) { select(hit.wv.layer, hit.wv.key, true); return; }
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
        if (S.layers.museums) { refreshMuseums(); if (museumQuery.inView) scheduleMuseumSearch(); }
        if (S.layers.airports && airportQuery.inView) scheduleAirportSearch();
        for (const n in listState) if (S.layers[n] && listState[n].q.inView) scheduleList(n);
    });
    window.addEventListener('blur', () => navHeld.clear());
    // Crash report: state every 3 s; normal unload/background is not a crash
    { const { cockpit, ...rest } = S; lastSettings = JSON.parse(JSON.stringify(rest)); }
    setInterval(() => saveCrashState(), 3000);
    window.addEventListener('pagehide', () => { try { localStorage.removeItem(BOOT_KEY); } catch { } crumb('pagehide'); saveCrashState({ exit: true }); });
    document.addEventListener('visibilitychange', () => { crumb(`visibility ${document.visibilityState}`); saveCrashState(); });
    window.addEventListener('error', e => crumb(`error ${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`));
    window.addEventListener('unhandledrejection', e => crumb(`rejection ${e.reason?.message || e.reason}`));
    scene.canvas.addEventListener('webglcontextlost', () => { crumb('webgl context lost'); saveCrashState(); });
    scene.renderError.addEventListener((s, e) => { crumb(`render error ${e?.message || e}`); saveCrashState(); });
    viewer.camera.moveEnd.addEventListener(() => crumb(`camera ${Math.round(camHeight() / 1000)} km`));
    saveCrashState();
    if (crashed || location.hash.includes('crash')) showCrashButton();
    scene.preRender.addEventListener(onPreRender);
    scene.postRender.addEventListener(onPostRender);
    setInterval(tick, 250);

    // Start view: link (#c=…) > last view on this device > whole globe
    const view = cam || lsGet(VIEW_KEY);
    if (view?.length >= 3 && view.every(Number.isFinite)) viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(view[1], view[0], view[2]), orientation: { heading: toRad(view[3] || 0), pitch: toRad(view[4] ?? -90), roll: 0 } });
    else viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(8, 38, 2.2e7) });
    // Remember the view after every camera move
    viewer.camera.moveEnd.addEventListener(() => {
        if (S.cockpit) return;
        const cm = viewer.camera, c = cm.positionCartographic;
        lsSet(VIEW_KEY, [+toDeg(c.latitude).toFixed(5), +toDeg(c.longitude).toFixed(5), Math.round(c.height), +toDeg(cm.heading).toFixed(1), +toDeg(cm.pitch).toFixed(1)]);
    });

    setStyle(S.style);
    if (S.borders) setBorders(true);
    if (S.timezones) setTimezones(true);
    if (S.nature) applyNature();
    if (S.streets) setStreets(true);
    for (const l of LAYERS) if (S.layers[l]) startLayer(l);

    return JSON.stringify({ layers: S.layers, style: S.style, basemap: S.basemap, ionToken: S.ionToken, hud: S.hud, detect: S.detect, dayNight: S.daynight, trails: S.trails, nightLight: S.nightLight, detectFont: S.detectFont, detectBg: S.detectBg, detectBgAlpha: S.detectBgAlpha, borders: S.borders, regions: S.regions, cities: S.cities, coast: S.coast, eez: S.eez, nature: S.nature, streets: S.streets, timezones: S.timezones, envOverlay: S.envOverlay, envClick: S.envClick, zoom: S.zoom, gpu: gpuName });
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

// ---------- layers ----------
const LOADERS = { flights: loadFlights, military: loadMilitary, trains: loadTrains, ov: loadOv, air: loadAir, satellites: loadSatellites, telescopes: loadTelescopes, quakes: loadQuakes, fires: loadFires, launches: loadLaunches, radio: loadRadio, cameras: loadCameras, plants: loadPlants, museums: loadMuseums, airports: loadAirports };

export function setLayer(name, on) { applyLayer(name, on, false); }
function applyLayer(name, on, fromEngine) {
    if (!LAYERS.includes(name)) return;
    S.layers[name] = on; saveSettings();
    coll[name].show = on;
    if (name === 'telescopes') { telLabels.show = telOrbits.show = on; if (l2Lines) l2Lines.show = on; }
    if (name === 'satellites' && !on) drawIssOrbit(); // removes the ISS orbit
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
// civil: [icao, call, lat, lon, altM, gsMs, track, ground, country, squawk, tPos, reg, type, history (tiles only)]
function fromFeedCivil(a, t) {
    const type = a[12] || '';
    return {
        key: a[0], lat: a[2], lon: a[3], alt: a[4], gs: a[5], track: a[6], ground: !!a[7], mil: false, t: (a[10] || t) * 1000, hist: a[13],
        label: a[1] || a[11] || a[0], call: a[1] || '', reg: a[11] || '', type, img: airIcon(type, '#3fd0ff'),
        info: [['callsign', a[1] || '—'], ['registration', a[11] || '—'], ['type', () => typeText(type)], ['country', a[8] || '—'], ['icao', a[0]], ['squawk', a[9] || '—']]
    };
}
// military: [hex, call, lat, lon, altM, gsMs, track, ground, reg, type, squawk, tPos, history]
function fromFeedMil(a, t) {
    const type = a[9] || '';
    return {
        key: a[0], lat: a[2], lon: a[3], alt: a[4], gs: a[5], track: a[6], ground: !!a[7], mil: true, t: (a[11] || t) * 1000, hist: a[12],
        label: a[1] || a[8] || a[0], call: a[1] || '', reg: a[8] || '', type, img: airIcon(type, '#ffb020'),
        info: [['callsign', a[1] || '—'], ['registration', a[8] || '—'], ['type', () => typeText(type)], ['icao', a[0]], ['squawk', a[10] || '—']]
    };
}

// Aircraft type names (types.json from the fetcher): B738 -> "BOEING 737-800"
let typeNames = null, typesLoading = null, heliTypes = new Set();
function loadTypeNames() {
    typesLoading ??= tryJson(`${FEED_URL}/types.json`, 20000).then(j => {
        typeNames = j || {};
        // Helicopter type codes (_H): give aircraft already on screen their helicopter icon
        heliTypes = new Set(Array.isArray(typeNames._H) ? typeNames._H : []);
        for (const [l, color] of [['flights', '#3fd0ff'], ['military', '#ffb020']])
            for (const r of store[l].values()) { const img = airIcon(r.type, color); if (img && r.img !== img) { r.img = img; r.bb.image = img; } }
        if (selected) pushInfo();
    });
    return typesLoading;
}
// Helicopter icon for helicopter types, else the layer's default (undefined)
const airIcon = (type, color) => type && heliTypes.has(type) ? icon('heli', color) : undefined;
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
    if (AIR_DELAY[layer] && !typesLoading) loadTypeNames(); // type names + helicopter types, for the icons
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
        if (AIR_DELAY[layer]) { r.delayTarget = r.near > now - 30000 ? NEAR_DELAY : AIR_DELAY[layer]; r.delay ??= r.delayTarget; addHistory(r, f); addFix(r, r); }
        r.bb.rotation = -toRad(r.track || 0);
        // Dead-reckoned position, same as tick(): no jump back on refresh
        const [la, lo, al] = posAt(r, now);
        r.bb.position = Cz.Cartesian3.fromDegrees(lo, la, al);
    }
    for (const [k, r] of m) if (now - r.seen > 120000) { col.remove(r.bb); m.delete(k); }
    validateSel(layer);
    if (LISTS[layer]) runList(layer); // panel filter on new aircraft + fresh list
}
// Aircraft are shown DELAY behind real time and move along a smooth curve between received fixes (Hermite: position + velocity at both ends);
// past the newest fix they continue along their turn. Feed intervals: OpenSky 90 s (+ polling), adsb.lol 20 s
const AIR_DELAY = { flights: 140000, military: 45000 }, LIVE_DELAY = 12000, LIVE_POLL = 5000;
// Zoomed in (< 300 km): aircraft around the view centre from adsb.lol via the fetcher every 8 s, shown ~15 s behind instead of 140 s
const NEAR_H = 3e5, NEAR_DELAY = 15000, NEAR_EVERY = LITE ? 10000 : 8000;
let lastNear = 0, nearBusy = false, nearOffUntil = 0;
async function loadNear() {
    const h = camHeight(), now = Date.now();
    if (nearBusy || !S.layers.flights || h > NEAR_H || now < nearOffUntil) return;
    nearBusy = true;
    try {
        const c = viewCenter(), g = v => (Math.round(v * 2) / 2) || 0; // 0.5° grid (no -0)
        const nm = h < 3e4 ? 25 : h < 6e4 ? 50 : h < 1.2e5 ? 100 : h < 2e5 ? 150 : 250;
        const j = await tryJson(`${FEED_URL}/near/${g(c.lat)}/${g(c.lon)}/${nm}`, 8000);
        if (!j) { nearOffUntil = now + 300000; return; } // fetcher without /near or down: retry in 5 min
        if (j.ac?.length) mergeNear(j.ac, j.t);
    } finally { nearBusy = false; }
}
// Rows in military format; known aircraft only get a new fix (keep their OpenSky info), new ones are added
function mergeNear(rows, t) {
    const m = store.flights, now = Date.now(), fresh = [];
    for (const a of rows) {
        if (store.military.has(a[0])) continue; // military layer has its own feed
        const f = { t: Math.min((a[11] || t) * 1000, now), lat: a[2], lon: a[3], alt: a[4], gs: a[5], track: a[6], ground: !!a[7] };
        const r = m.get(a[0]);
        if (r) {
            r.near = r.seen = now; r.delayTarget = NEAR_DELAY;
            if (addFix(r, f)) Object.assign(r, f);
        } else fresh.push(Object.assign(fromFeedMil(a, t), { mil: false, hist: undefined, near: now, img: airIcon(a[9], '#3fd0ff') }));
    }
    if (fresh.length) merge('flights', fresh, 'plane', '#3fd0ff');
}
function addFix(r, f) {
    const fx = r.fixes ??= [], last = fx[fx.length - 1];
    if (last && f.t <= last.t) return false;
    fx.push({ t: f.t, lat: f.lat, lon: f.lon, alt: f.alt, gs: f.gs || 0, track: f.track || 0, ground: !!f.ground });
    while (fx.length > 2 && (fx[0].t < f.t - 900000 || fx.length > 80)) fx.shift();
    return true;
}
// Earlier fixes kept by the fetcher (flat [ageS, lat, lon, alt, gs, track] × n, age before this row): trail at once
function addHistory(r, f) {
    const h = f.hist;
    if (!Array.isArray(h) || f.ground) return;
    const fx = r.fixes ??= [], have = new Set(fx.map(x => x.t));
    for (let i = 0; i + 5 < h.length; i += 6) {
        const t = f.t - h[i] * 1000;
        if (!have.has(t)) fx.push({ t, lat: h[i + 1], lon: h[i + 2], alt: h[i + 3], gs: h[i + 4] || 0, track: h[i + 5] || 0, ground: false });
    }
    fx.sort((a, b) => a.t - b.t);
}
// Metres east/north after t s at speed v, heading h, turn rate w (turn limited to 45°, then straight on)
function arc(v, h, w, t) {
    if (Math.abs(w) < 1e-4 || t <= 0) return [v * Math.sin(h) * t, v * Math.cos(h) * t];
    const tt = Math.min(t, Math.PI / 4 / Math.abs(w)), h1 = h + w * tt, rest = t - tt;
    return [v / w * (Math.cos(h) - Math.cos(h1)) + v * Math.sin(h1) * rest, v / w * (Math.sin(h1) - Math.sin(h)) + v * Math.cos(h1) * rest];
}
const lonScale = lat => R_EARTH * Math.max(0.05, Math.cos(toRad(lat)));
// From fix a (turn rate from the fix before) to time td; negative times run backwards along a straight line
function extrapolate(a, prev, td) {
    if (a.ground || !a.gs) return [a.lat, a.lon, a.alt];
    const dt = Math.max(-300, Math.min(300, (td - a.t) / 1000));
    // Landing fallback: low and descending at the last fix → down to the runway at the current descent rate, then brake (2 m/s²) to a stop; no flying on
    const sink = prev && a.t > prev.t ? (prev.alt - a.alt) / ((a.t - prev.t) / 1000) : 0;
    if (dt > 0 && a.alt < 600 && (sink > 0.5 || (!prev && a.alt < 150))) {
        const rate = Math.max(2, sink), tTouch = a.alt / rate, tAir = Math.min(dt, tTouch);
        const tRoll = Math.min(Math.max(0, dt - tTouch), a.gs / 2), s = a.gs * tAir + a.gs * tRoll - tRoll * tRoll;
        const hd = toRad(a.track);
        return [a.lat + toDeg(s * Math.cos(hd) / R_EARTH), a.lon + toDeg(s * Math.sin(hd) / lonScale(a.lat)), Math.max(0, a.alt - rate * tAir)];
    }
    let w = 0;
    if (prev && !prev.ground && a.t > prev.t && a.t - prev.t <= 180000) w = Math.max(-0.05, Math.min(0.05, toRad(((a.track - prev.track + 540) % 360) - 180) / ((a.t - prev.t) / 1000)));
    const [e, n] = arc(a.gs, toRad(a.track), w, dt);
    return [a.lat + toDeg(n / R_EARTH), a.lon + toDeg(e / lonScale(a.lat)), a.alt];
}
function hermite(a, b, td) {
    const T = (b.t - a.t) / 1000, s = (td - a.t) / (b.t - a.t), dLon = ((b.lon - a.lon + 540) % 360) - 180;
    const alt = a.alt + (b.alt - a.alt) * s, lin = [a.lat + (b.lat - a.lat) * s, a.lon + dLon * s, alt];
    if (a.ground || b.ground || T > 600) return lin;
    const kx = lonScale(a.lat), x1 = toRad(dLon) * kx, y1 = toRad(b.lat - a.lat) * R_EARTH;
    // Reported speed must roughly match the distance flown, else straight (avoids loops)
    const dist = Math.hypot(x1, y1), avg = (a.gs + b.gs) / 2 * T;
    if (!avg || dist < avg * 0.5 || dist > avg * 1.5) return lin;
    const ha = toRad(a.track), hb = toRad(b.track), s2 = s * s, s3 = s2 * s;
    const h10 = (s3 - 2 * s2 + s) * T, h01 = -2 * s3 + 3 * s2, h11 = (s3 - s2) * T;
    const x = h10 * a.gs * Math.sin(ha) + h01 * x1 + h11 * b.gs * Math.sin(hb);
    const y = h10 * a.gs * Math.cos(ha) + h01 * y1 + h11 * b.gs * Math.cos(hb);
    return [a.lat + toDeg(y / R_EARTH), a.lon + toDeg(x / kx), alt];
}
function airPos(r, td) {
    const fx = r.fixes, n = fx.length;
    if (td >= fx[n - 1].t) return extrapolate(fx[n - 1], fx[n - 2], td);
    if (td <= fx[0].t) return extrapolate(fx[0], null, td);
    let i = n - 1;
    while (fx[i - 1].t > td) i--;
    return hermite(fx[i - 1], fx[i], td);
}
function posAt(r, now) {
    if (r.fixes?.length) return airPos(r, now - (r.delay ?? 0));
    if (!r.gs || r.ground || r.noPredict) return [r.lat, r.lon, r.alt];
    const dt = Math.min(300, (now - r.t) / 1000), d = r.gs * dt, tr = toRad(r.track || 0);
    const lat = r.lat + toDeg(d * Math.cos(tr) / R_EARTH);
    const lon = r.lon + toDeg(d * Math.sin(tr) / (R_EARTH * Math.max(0.05, Math.cos(toRad(r.lat)))));
    return [lat, lon, r.alt];
}

// satellites
// Same caching as tleById: cache at once (up to a week), background refresh after 6 h, 10 s timeout, older cache as fallback
const tleGroupPending = new Map(); // one in-flight load per group: satellites and telescopes share it
function tleGroup(g) {
    if (!tleGroupPending.has(g)) tleGroupPending.set(g, tleGroupLoad(g).finally(() => tleGroupPending.delete(g)));
    return tleGroupPending.get(g);
}
// TLE (3 lines) for one NORAD id out of a group text, or null
function tleFromGroup(txt, id) {
    if (!txt) return null;
    const lines = txt.split(/\r?\n/).map(s => s.trimEnd()).filter(Boolean);
    for (let i = 0; i + 2 < lines.length; i++)
        if (lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ') && lines[i + 1].substring(2, 7).trim() === String(id)) return lines.slice(i, i + 3).join('\n');
    return null;
}
async function tleGroupLoad(g) {
    const ck = 'wv-tle-' + g;
    let c = null;
    try { c = JSON.parse(localStorage.getItem(ck) || 'null'); } catch { }
    const fresh = async () => {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
        try {
            const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`, { signal: ctl.signal });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.text();
            try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d })); } catch { }
            return d;
        } finally { clearTimeout(t); }
    };
    if (c && Date.now() - c.t < 7 * 86400000) {
        if (Date.now() - c.t > 6 * 3600000) fresh().catch(() => { });
        return c.d;
    }
    try { return await fresh(); } catch (e) { if (c) return c.d; throw e; }
}
let satLoading = false; // TLE download running: a second load waits for it
async function loadSatellites() {
    sat ??= await import('https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/+esm');
    if (satLoading) return 0;
    if (!store.satellites.size) {
        satLoading = true;
        // All groups at once (was one after another, up to 20 s each); added in group order for the duplicate check
        const txts = await Promise.all(SAT_GROUPS.map(([g]) => tleGroup(g).catch(() => null)));
        satLoading = false;
        for (const [gi, [g, color, label]] of SAT_GROUPS.entries()) {
            const txt = txts[gi];
            if (!txt) continue;
            const lines = txt.split(/\r?\n/).map(s => s.trimEnd()).filter(Boolean);
            for (let i = 0; i + 2 < lines.length; i += 3) {
                const name = lines[i].trim(), l1 = lines[i + 1], l2 = lines[i + 2];
                if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) continue;
                const id = l1.substring(2, 7).trim();
                if (store.satellites.has(id) || TEL_IDS.has(id)) continue; // telescopes live in their own layer (always-on orbit)
                let rec;
                try { rec = sat.twoline2satrec(l1, l2); } catch { continue; }
                const r = { key: id, label: name, rec, group: label, color, lat: 0, lon: 0, alt: 0, vel: 0 };
                r.pt = coll.satellites.add({ pixelSize: g === 'stations' ? 7 : 4, color: Cz.Color.fromCssColorString(color), outlineColor: Cz.Color.BLACK, outlineWidth: 1, id: { wv: { layer: 'satellites', key: id } } });
                store.satellites.set(id, r);
            }
        }
        propagateSats();
    }
    drawIssOrbit(); lastIssOrbit = Date.now();
    atcStreams().then(() => { applyIssStream(); runList('satellites'); });
    runList('satellites');
    report('satellites', store.satellites.size ? () => 'CelesTrak (SGP4)' : 'st.sourceDown');
    return store.satellites.size ? 0 : 120000;
}
function satGeo(r, date, gmst) {
    const pv = sat.propagate(r.rec, date);
    if (!pv || !pv.position || typeof pv.position !== 'object') return null;
    const g = sat.eciToGeodetic(pv.position, gmst ?? sat.gstime(date));
    return { lat: g.latitude, lon: g.longitude, h: g.height * 1000, v: pv.velocity };
}
// Satellites within 300 km of the selected one (recomputed once a second), moved every frame in onPreRender
let satNear = [];
const SAT_NEAR_M = 300000;
function propagateSats() {
    if (!sat || !S.layers.satellites) return;
    const now = new Date(), gmst = sat.gstime(now);
    const selR = selected?.layer === 'satellites' ? store.satellites.get(selected.key) : null;
    const cam = viewer.camera.positionWC;
    satNear = []; camNear = [];
    for (const r of store.satellites.values()) {
        const g = satGeo(r, now, gmst);
        if (!g) { r.pt.show = false; continue; }
        r.lat = toDeg(g.lat); r.lon = toDeg(g.lon); r.alt = g.h;
        r.vel = g.v ? Math.hypot(g.v.x, g.v.y, g.v.z) : 0;
        r.pos = Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h);
        r.pt.position = r.pos; r.pt.show = r.listOk !== false; // panel filter
        if (selR && r !== selR && selR.pos && Cz.Cartesian3.distance(r.pos, selR.pos) < SAT_NEAR_M) satNear.push(r);
        else if (r !== selR && r.pt.show && camNear.length < CAM_NEAR_MAX && Cz.Cartesian3.distance(r.pos, cam) < CAM_NEAR_M) camNear.push(r);
    }
}
// Satellites near the camera, moved every frame (else a deselected one jumps away at ~7.5 km/s)
let camNear = [];
const CAM_NEAR_M = 3e6, CAM_NEAR_MAX = 300;
// One full orbit (half back, half ahead): the ring as seen in space (fixed Earth rotation), except around the object,
// where it follows the real Earth rotation so the object stays exactly on its line close up; blended smoothly (no kink)
const ORBIT_NEAR_MS = 60000, ORBIT_FADE_MS = 900000, ORBIT_NEAR_STEP = 500;
const ORBIT_NEAR_KM = 30, ORBIT_FADE_KM = 450, EARTH_OMEGA = 7.2921159e-5; // max sideways shift by Earth rotation (LEO: 60 s / 15 min)
const ORBIT_CAM_CHORD = 0.01; // max segment length as a fraction of its distance to the camera (no visible kinks close up)
function orbitPoints(r, n = 720) {
    const now = Date.now(), g0 = sat.gstime(new Date(now)), half = Math.PI / r.rec.no * 60000, pts = [];
    const aM = r.rec.a * 6378135; // semi-major axis (m)
    // High orbits shift ω·r sideways per second (INTEGRAL ~10 km/s): shorter real-rotation zone there, else a huge hook
    const rm = r.pos ? Cz.Cartesian3.magnitude(r.pos) : aM, rot = EARTH_OMEGA * rm / 1000; // km/s
    const v = Math.sqrt(398600.4418 * Math.max(0, 2000 / rm - 1000 / aM)); // own speed (km/s, vis-viva)
    // Rotation dominates (high orbit near apogee): the real-rotation zone would stick out as a spike, so plain ring there
    const blend = rot < 0.3 * v;
    const near = blend ? Math.min(ORBIT_NEAR_MS, ORBIT_NEAR_KM / rot * 1000) : 0;
    const fade = blend ? Math.max(near + 1000, Math.min(ORBIT_FADE_MS, half * 0.8, ORBIT_FADE_KM / rot * 1000)) : 0;
    // Weight of the real rotation: 1 near the object, cosine fade to 0 (fixed ring) further away
    const w = dt => { const a = Math.abs(dt); return a <= near ? 1 : a >= fade ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (a - near) / (fade - near)); };
    const push = dt => {
        const d = new Date(now + dt), diff = ((sat.gstime(d) - g0) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        const g = satGeo(r, d, g0 + w(dt) * diff);
        if (!g) return null;
        const p = Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h);
        pts.push(p);
        return p;
    };
    // Step uniform in eccentric anomaly (dt ∝ r), scaled by √(1-e²): ≤ 360/n degrees of turn per vertex, also at perigee/apogee
    // of eccentric orbits (INTEGRAL, XMM, Chandra); inside the blend zone at most 1/30 of it
    const base = 2 * half / n, k = Math.sqrt(1 - Math.min(r.rec.ecco, 0.99) ** 2), cam = viewer.camera.positionWC;
    const stepAt = (dt, p) => {
        let s = base;
        if (p) {
            const pr = Cz.Cartesian3.magnitude(p), pv = Math.sqrt(398600.4418 * Math.max(1e-9, 2000 / pr - 1000 / aM)); // km/s
            s = Math.min(base * (pr / aM) * k, ORBIT_CAM_CHORD * Cz.Cartesian3.distance(p, cam) / pv); // ms
        }
        if (Math.abs(dt) < fade) s = Math.min(s, (fade - near) / 30);
        else if (dt < -fade) s = Math.min(s, -fade - dt); // land on the blend zone, don't jump over it
        return Math.max(s, 50);
    };
    for (let dt = -half; dt < -near;) dt += stepAt(dt, push(dt));
    // Extra dense ±5 s: a 0.5 s chord (3.75 km) bows 0.25 m from the true path, a visible wobble from 50 m away
    for (let dt = -near; dt < near; dt += Math.abs(dt) < 5000 ? 50 : ORBIT_NEAR_STEP) push(dt);
    for (let dt = near; dt <= half;) dt += stepAt(dt, push(dt));
    push(-half); // close the ring
    r.orbSpin = blend ? null : { g0, base: pts }; // plain ring: fixed in space, turned with the Earth every frame (spinOrbit)
    return pts;
}
// Selected object on a high orbit (Chandra, XMM, GEO...): the Earth turns ω·r ≈ 10 km/s under it, so its ring (drawn once a second)
// slid away from the object between the redraws and showed up as flashes; turn the ring about Earth's axis every frame instead
function spinOrbit() {
    if (!sat || !selected || !ORBITERS.includes(selected.layer)) return;
    const r = store[selected.layer].get(selected.key), sp = r?.orbSpin;
    const line = selected.layer === 'telescopes' ? r?.orbLine : orbitEntity?.wvKey === r?.key ? orbitEntity : null;
    if (!sp || !line) return;
    const a = -(sat.gstime(new Date(frameMs)) - sp.g0), c = Math.cos(a), s = Math.sin(a);
    line.positions = sp.base.map(p => new Cz.Cartesian3(p.x * c - p.y * s, p.x * s + p.y * c, p.z));
}
// Orbit lines as primitives, updated in place: re-adding entities every few seconds made the view flicker while following
let orbitLines = null;
function orbitLine(line, positions, color, width, dashed) {
    orbitLines ??= viewer.scene.primitives.add(new Cz.PolylineCollection());
    if (line) { line.positions = positions; line.show = true; return line; }
    const c = Cz.Color.fromCssColorString(color).withAlpha(dashed ? 0.8 : 0.7);
    return orbitLines.add({ positions, width, material: dashed ? Cz.Material.fromType('PolylineDash', { color: c, dashLength: 24 }) : orbitFadeMaterial(c) });
}
// Orbit line fading with eye distance: full near the camera, faint far away (the far side of a ring seen edge-on looks like a V).
// Fixed type: one shared shader; a new material per line (a removed polyline destroys its material)
const ORBIT_FADE_FULL_S = 60, ORBIT_FADE_SPAN = 2.5, ORBIT_FADE_ALPHA = 0; // close up: full 1 min of flight, gone after 2.5 min (5 min in all)
function orbitFadeMaterial(color) {
    return new Cz.Material({
        fabric: {
            type: 'WvOrbitFade',
            uniforms: { color, fadeNear: 1e12, fadeFar: 1e13 },
            source: `czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material m = czm_getDefaultMaterial(materialInput);
    float d = 1.0 / gl_FragCoord.w; // eye-space depth (m)
    m.diffuse = color.rgb;
    m.alpha = color.a * max(1.0 - smoothstep(fadeNear, fadeFar, d), ${ORBIT_FADE_ALPHA.toFixed(2)});
    return m;
}`
        },
        translucent: true
    });
}
// Fade starts at 3× the camera-object distance, at least the distance flown in 1 min: zoomed out the whole ring stays full,
// close up only ~5 min of orbit remains (2.5 min either side)
function fadeOrbit(line, r) {
    const u = line?.material?.uniforms;
    if (!u || u.fadeNear === undefined || !r?.pos) return;
    // Only the selected object's line fades; the rest stay full rings
    if (selected?.key !== r.key || !ORBITERS.includes(selected.layer)) { u.fadeNear = 1e12; u.fadeFar = 1e13; return; }
    u.fadeNear = Math.max(3 * Cz.Cartesian3.distance(viewer.camera.positionWC, r.pos), (r.vel || 7.5) * 1000 * ORBIT_FADE_FULL_S);
    u.fadeFar = u.fadeNear * ORBIT_FADE_SPAN;
}
function fadeOrbits() {
    if (orbitEntity) fadeOrbit(orbitEntity, store.satellites.get(orbitEntity.wvKey));
    for (const r of store.telescopes.values()) fadeOrbit(r.orbLine, r);
}
function drawOrbit(r) {
    if (orbitEntity && (orbitEntity.wvKey !== r.key || !sat || !r.rec?.no)) { orbitLines.remove(orbitEntity); orbitEntity = null; }
    if (!sat || !r.rec?.no) return;
    orbitEntity = orbitLine(orbitEntity, orbitPoints(r), r.color, 1.5, false);
    orbitEntity.wvKey = r.key;
    fadeOrbit(orbitEntity, r);
}
function hideOrbit() { if (orbitEntity) { orbitLines.remove(orbitEntity); orbitEntity = null; } }
// ISS: orbit always shown with the satellite layer (refreshed every 30 s), plus the live view from YouTube
const ISS_ID = '25544';
let issOrbitEntity = null, lastIssOrbit = 0;
function drawIssOrbit() {
    const r = store.satellites.get(ISS_ID);
    if (!S.layers.satellites || !sat || !r?.rec?.no) { if (issOrbitEntity) issOrbitEntity.show = false; return; }
    issOrbitEntity = orbitLine(issOrbitEntity, orbitPoints(r), r.color, 2, true);
}
function applyIssStream() {
    const r = store.satellites.get(ISS_ID), s = atcLast?.iss;
    if (!r) return;
    r.embed = s ? ytEmbed(s.id) : null;
    r.ytLink = s ? `https://www.youtube.com/watch?v=${s.id}` : null;
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
    if (S.borders) markRisky();
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
        tryJson(`${STATIC_URL}/borders/${k}.json`, 20000).then(d => {
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
            tryJson(`${STATIC_URL}/admin0-lines.json`, 30000),
            tryJson(NE_BASE + 'ne_110m_admin_0_countries.geojson', 30000),
            tryJson(`${STATIC_URL}/borders-index.json`, 15000)]);
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
    return new Cz.Primitive({ geometryInstances: instances, appearance: new Cz.PerInstanceColorAppearance({ translucent: true, flat: true }), allowPicking: false, asynchronous: !LITE }); // iOS: no geometry workers
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
            const d = await tryJson(`${STATIC_URL}/timezones.json`, 20000);
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
        const positions = Cz.Cartesian3.fromDegreesArray(flat);
        instances.push(new Cz.GeometryInstance({
            // iOS: 1 px GL lines (wide polylines need ~8× the memory)
            geometry: LITE ? new Cz.SimplePolylineGeometry({ positions, arcType: Cz.ArcType.NONE }) : new Cz.PolylineGeometry({ positions, width, arcType: Cz.ArcType.NONE }),
            attributes: { color: attr }
        }));
    }
    const appearance = LITE ? new Cz.PerInstanceColorAppearance({ flat: true, translucent: true }) : new Cz.PolylineColorAppearance({ translucent: true });
    // iOS: build on the main thread; Cesium's geometry web workers cost too much memory there (tab killed)
    return new Cz.Primitive({ geometryInstances: instances, appearance, asynchronous: !LITE });
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
    S.regions = !!on; saveSettings(); if (S.regions) markRisky();
    await applyOverlays();
}
export async function setCities(on) {
    S.cities = !!on; saveSettings(); if (S.cities) markRisky();
    await applyOverlays();
}
// Coastlines and maritime boundaries (tools/build-sea.mjs), also under the borders switch
let coastLines = null, eezLines = null, seaLoading = {};
const EEZ_STYLE = { agreed: ['#3fd0ff', 0.75, 1.5], limit: ['#3fd0ff', 0.35, 1.0], disputed: ['#ff9f40', 0.85, 1.5] };
export async function setCoast(on) { S.coast = !!on; saveSettings(); if (S.coast) markRisky(); await applySea(); }
export async function setEez(on) { S.eez = !!on; saveSettings(); await applySea(); }
async function applySea() {
    const showCoast = S.borders && S.coast, showEez = S.borders && S.eez;
    if (showCoast && !coastLines) await (seaLoading.coast ??= (async () => {
        const d = await tryJson(`${STATIC_URL}/coastline.json`, 30000);
        if (d) coastLines = viewer.scene.primitives.add(linePrimitive(d, Cz.Color.fromCssColorString('#bfe8ff').withAlpha(0.55), 1.0));
        else seaLoading.coast = null;
    })());
    if (showEez && !eezLines) await (seaLoading.eez ??= (async () => {
        const d = await tryJson(`${STATIC_URL}/eez.json`, 30000);
        if (!d) { seaLoading.eez = null; return; }
        eezLines = Object.entries(EEZ_STYLE).map(([k, [c, a, w]]) =>
            viewer.scene.primitives.add(linePrimitive({ s: d.s, l: d[k] || [] }, Cz.Color.fromCssColorString(c).withAlpha(a), w)));
    })());
    if (showCoast && !coastTileKeys) {
        const idx = await tryJson(`${STATIC_URL}/coast-index.json`, 15000);
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
        tryJson(`${STATIC_URL}/coast/${k}.json`, 20000).then(d => {
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
        const d = await tryJson(`${STATIC_URL}/nature.json`, 30000);
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
        const [lines, labels] = await Promise.all([tryJson(`${STATIC_URL}/admin1-lines.json`, 30000), tryJson(`${STATIC_URL}/admin1-labels.json`, 30000)]);
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
        const j = await tryJson(`${STATIC_URL}/cities-top.json`, 30000);
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
        tryJson(`${STATIC_URL}/cities/${k}.json`, 20000).then(rows => {
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
// Cached TLE returned at once (up to a week old; refreshed in the background after 6 h); a fetch gives up after 8 s
async function tleById(id) {
    const ck = 'wv-tle-cat-' + id;
    let c = null;
    try { c = JSON.parse(localStorage.getItem(ck) || 'null'); } catch { }
    const fresh = async () => {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
        try {
            const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=tle`, { signal: ctl.signal });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.text();
            try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d })); } catch { }
            return d;
        } finally { clearTimeout(t); }
    };
    if (c && Date.now() - c.t < 7 * 86400000) {
        if (Date.now() - c.t > 6 * 3600000) fresh().catch(() => { }); // next load uses the new one
        return c.d;
    }
    try { return await fresh(); } catch (e) { if (c) return c.d; throw e; } // older cache beats nothing
}
// Approximate Sun-Earth L2: 1.5 million km opposite the Sun (Earth-fixed frame)
function l2Position(offset = 0, ms) {
    const t = ms === undefined ? Cz.JulianDate.now() : Cz.JulianDate.fromDate(new Date(ms));
    const sun = Cz.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(t);
    const m = Cz.Transforms.computeIcrfToFixedMatrix(t) ?? Cz.Transforms.computeTemeToPseudoFixedMatrix(t);
    const dir = Cz.Cartesian3.normalize(Cz.Matrix3.multiplyByVector(m, sun, new Cz.Cartesian3()), new Cz.Cartesian3());
    const anti = Cz.Cartesian3.multiplyByScalar(dir, -L2_DIST, new Cz.Cartesian3());
    if (!offset) return anti;
    const side = Cz.Cartesian3.normalize(Cz.Cartesian3.cross(dir, Cz.Cartesian3.UNIT_Z, new Cz.Cartesian3()), new Cz.Cartesian3());
    return Cz.Cartesian3.add(anti, Cz.Cartesian3.multiplyByScalar(side, offset, side), anti);
}
let telLoading = false; // TLE download running: a second load must not add everything twice
async function loadTelescopes() {
    sat ??= await import('https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/+esm');
    if (telLoading) return 0; // the running load finishes the job
    if (![...store.telescopes.values()].some(r => !r.l2)) { // retry until the orbiting ones are in
        telLoading = true;
        const color = Cz.Color.fromCssColorString(TEL_COLOR);
        const addTel = r => {
            r.pt = coll.telescopes.add({ pixelSize: 8, color, outlineColor: Cz.Color.BLACK, outlineWidth: 1, id: { wv: { layer: 'telescopes', key: r.key } } });
            r.lbl = telLabels.add({ id: { wv: { layer: 'telescopes', key: r.key } }, text: r.label, font: '24px "Share Tech Mono", monospace', scale: 0.5, fillColor: color, outlineColor: Cz.Color.BLACK, outlineWidth: 4, style: Cz.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cz.Cartesian2(8, -8), horizontalOrigin: Cz.HorizontalOrigin.LEFT });
            store.telescopes.set(r.key, r);
        };
        // L2 telescopes need no download: in the list straight away
        for (const [key, name, offset, wikiTitle] of L2_TELESCOPES) if (!store.telescopes.has(key)) addTel({ key, label: name, wikiTitle, l2: true, offset, group: 'grp.telescopeL2' });
        propagateTelescopes();
        runList('telescopes');
        // Most telescopes are in groups the satellite layer loads anyway: per-id request only for the rest (CelesTrak rate-limits)
        const grp = await Promise.all(TEL_GROUPS.map(g => tleGroup(g).catch(() => null)));
        const tles = await Promise.all(TELESCOPES.map(([id]) => grp.map(t => tleFromGroup(t, id)).find(Boolean) ?? tleById(id).catch(() => null)));
        telLoading = false;
        TELESCOPES.forEach(([id, name, wikiTitle], i) => {
            const lines = (tles[i] || '').split(/\r?\n/).map(s => s.trimEnd()).filter(Boolean);
            if (lines.length < 3 || !lines[1].startsWith('1 ') || !lines[2].startsWith('2 ')) return;
            let rec;
            try { rec = sat.twoline2satrec(lines[1], lines[2]); } catch { return; }
            addTel({ key: String(id), label: name, wikiTitle, rec, group: 'grp.telescope', color: TEL_COLOR, lat: 0, lon: 0, alt: 0, vel: 0 });
        });
        propagateTelescopes();
    }
    runList('telescopes'); // filter + orbits
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
        r.pt.show = r.lbl.show = r.listOk !== false; // panel filter
    }
}
// Full orbit rings (re-aligned to current Earth rotation) + dashed line to L2
let l2Lines = null; // Earth → L2 lines, moved every frame in onPreRender
const L2_LINE_PTS = 48;
function drawTelOrbits() {
    if (!sat || !telOrbits) return;
    telOrbits.removeAll();
    const ringColor = Cz.Color.fromCssColorString(TEL_COLOR).withAlpha(0.55);
    for (const r of store.telescopes.values()) {
        if (r.l2Line) r.l2Line.show = r.listOk !== false;
        if (r.listOk === false) continue; // filtered out in the panel
        if (r.l2 || !r.rec?.no) continue; // L2 lines: onPreRender
        const pts = orbitPoints(r, 480);
        r.orbLine = pts.length > 1 ? telOrbits.add({ positions: pts, width: 1.5, material: orbitFadeMaterial(ringColor) }) : null;
        fadeOrbit(r.orbLine, r);
    }
}
// Selected telescope: its ring every second (a 30 s re-alignment made the far part jump ~15 km: the line wobbled)
function drawTelOrbit(r) {
    if (sat && r?.orbLine && r.rec?.no) r.orbLine.positions = orbitPoints(r);
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
// Power plants (WRI Global Power Plant Database, tools/build-plants.mjs): colour per fuel, size per capacity; static, loaded once
const FUEL_COLORS = { Solar: '#ffd23f', Wind: '#7fd8ff', Hydro: '#2f7bff', Nuclear: '#c86bff', Gas: '#ff9a2a', Coal: '#b07850', Oil: '#ff4b4b', Biomass: '#4cd964',
    Waste: '#9e9e9e', Geothermal: '#ff6fa8', Storage: '#00e5c0', 'Wave and Tidal': '#00bcd4', Cogeneration: '#cccccc', Petcoke: '#8d6e63', Other: '#cccccc' };
const fuelKey = f => 'fuel.' + f.toLowerCase().replace(/ /g, '');
async function loadPlants() {
    if (store.plants.size) { report('plants', 'st.plants'); return 0; }
    const d = await tryJson(`${FEED_URL}/plants.json`, 30000);
    if (!d?.p) { report('plants', 'st.sourceDown'); return 120000; }
    d.p.forEach(([lon, lat, mw, fi, name, owner, year, country], i) => {
        const fuel = d.fuels[fi];
        addPoint('plants', {
            key: 'pp' + i, lat, lon, label: name,
            info: [['fuel', () => tr(fuelKey(fuel))], ['capacity', () => `${mw.toLocaleString(loc())} MW`], ['owner', owner || '—'], ['commissioned', year || '—'], ['country', country]]
        }, Math.min(16, 3 + Math.sqrt(mw) / 6), FUEL_COLORS[fuel] || '#cccccc');
    });
    report('plants', 'st.plants');
    return 0;
}
// Museums (OpenStreetMap via the fetcher, refreshed monthly): overview (with Wikipedia article) at once, all museums per 5° tile when zoomed in
// row: [id, lon, lat, name, typeIndex, wikidata, website, openingHours, wiki(0/1), country ISO2, place]
const MUSEUM_TILE_H = 2e6; // below this height the tiles in view are loaded and shown
let museumIdx = null, museumIdxAt = 0, museumIdxP = null;
const museumTiles = new Map(); // key -> 'loading' | true
const museumByCc = new Map(); // ISO2 -> Promise of rows (museums/cc/{ISO2}.json)
let museumQuery = { q: '', cc: '', type: '', city: '', inView: false, wiki: false }, museumGen = 0, museumTimer = null;
const lowTrim = s => (s || '').trim().toLowerCase();
// Panel filter; also decides which dots show on the globe (noCity: for the place suggestions)
function museumMatch(r, text = lowTrim(museumQuery.q), city = lowTrim(museumQuery.city), noCity = false) {
    const q = museumQuery;
    return (!q.cc || r.cc === q.cc) && (!q.type || r.type === q.type) && (!q.wiki || r.wiki) && (!text || r.label.toLowerCase().includes(text))
        && (noCity || !city || r.city.toLowerCase().includes(city));
}
function addMuseum([id, lon, lat, name, ti, qid, web, hours, wiki, cc, city], top) {
    if (store.museums.has(id)) return;
    const type = museumIdx?.types[ti] || 'other';
    const info = [['museumType', () => tr('mus.' + type)]];
    if (city) info.push(['place', city]);
    if (cc) info.push(['country', () => regionName(cc) || cc]);
    if (hours) info.push(['openingHours', hours]);
    if (web) { const u = web.split(';')[0].trim(); info.push(['website', /^https?:\/\//i.test(u) ? u.replace(/^https?/i, s => s.toLowerCase()) : 'https://' + u]); } // OSM often omits the scheme
    info.push(['position', fmtPos(lat, lon)]);
    const r = { key: id, lat, lon, label: name, qid, info, top, type, cc: cc || '', city: city || '', wiki: !!wiki };
    r.pos = Cz.Cartesian3.fromDegrees(lon, lat, 0);
    r.pt = coll.museums.add({ position: r.pos, pixelSize: top ? 6 : 5, color: Cz.Color.fromCssColorString(DETECT_COLORS.museums), outlineColor: Cz.Color.BLACK.withAlpha(0.6), outlineWidth: 1,
        disableDepthTestDistance: 1.5e6, distanceDisplayCondition: top ? undefined : new Cz.DistanceDisplayCondition(0, MUSEUM_TILE_H * 1.2), id: { wv: { layer: 'museums', key: id } } });
    r.pt.show = museumMatch(r);
    store.museums.set(id, r);
}
// Index at first start, again after 10 min (the fetcher adds boxes one by one); false = unreachable
function loadMuseumIndex() {
    if (museumIdx && Date.now() - museumIdxAt <= 600000) return Promise.resolve(true);
    return museumIdxP ??= (async () => {
        const d = await tryJson(`${FEED_URL}/museums-index.json?b=${Math.floor(Date.now() / 60000)}`, 30000);
        if (!d?.tiles) return !!museumIdx;
        museumIdxAt = Date.now();
        if (d.t !== museumIdx?.t) {
            museumIdx = { t: d.t, tile: d.tile, tiles: new Set(d.tiles), types: d.types || [], countries: d.countries || {} };
            museumTiles.clear(); // changed tiles reload via the new ?b=
            museumByCc.clear();
            for (const row of d.top || []) addMuseum(row, true);
        }
        return true;
    })().finally(() => { museumIdxP = null; });
}
async function loadMuseums() {
    if (!await loadMuseumIndex()) { report('museums', 'st.sourceDown'); return 120000; }
    refreshMuseums();
    runMuseumSearch();
    return 0;
}
// Countries with museums, names in the UI language
export async function museumCountries() {
    await loadMuseumIndex();
    const list = Object.entries(museumIdx?.countries || {}).map(([cc, n]) => ({ cc, name: regionName(cc) || cc, n }));
    list.sort((a, b) => a.name.localeCompare(b.name, loc()));
    return JSON.stringify(list);
}
export function museumSetQuery(json) {
    try { museumQuery = { ...museumQuery, ...JSON.parse(json) }; } catch { }
    savePanelFilter('museums', museumQuery);
    museumOffset = 0; // new filter: page 1
    const text = lowTrim(museumQuery.q), city = lowTrim(museumQuery.city);
    for (const r of store.museums.values()) r.pt.show = museumMatch(r, text, city);
    runMuseumSearch();
}
// Last filter of a list panel: kept in the settings, read back by the UI at start
function savePanelFilter(name, q) {
    if (JSON.stringify(S.panelFilters[name]) === JSON.stringify(q)) return;
    S.panelFilters[name] = { ...q };
    saveSettings();
}
export function getPanelFilter(name) { return JSON.stringify(S.panelFilters?.[name] || {}); }
function scheduleMuseumSearch() {
    clearTimeout(museumTimer);
    museumTimer = setTimeout(runMuseumSearch, 300);
}
// Panel list: a chosen country loads all its museums; otherwise what is loaded (overview + tiles in view)
async function runMuseumSearch() {
    const my = ++museumGen, q = museumQuery;
    if (q.cc && museumIdx) {
        let p = museumByCc.get(q.cc);
        if (!p) museumByCc.set(q.cc, p = tryJson(`${FEED_URL}/museums/cc/${q.cc}.json?b=${museumIdx.t || 0}`, 30000));
        const rows = await p;
        if (my !== museumGen) return;
        if (!rows) museumByCc.delete(q.cc);
        for (const row of rows || []) addMuseum(row, false);
    }
    const text = lowTrim(q.q), city = lowTrim(q.city);
    const rect = q.inView && viewer ? viewer.camera.computeViewRectangle() : null;
    // All filters except place: base for the place suggestions (most museums first)
    const base = [...store.museums.values()].filter(r => museumMatch(r, text, city, true) && (!rect || inView(rect, Cz.Cartographic.fromDegrees(r.lon, r.lat))));
    const counts = new Map();
    for (const r of base) if (r.city) counts.set(r.city, (counts.get(r.city) || 0) + 1);
    museumPlaces = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 500).map(([c]) => c);
    const list = city ? base.filter(r => r.city.toLowerCase().includes(city)) : base;
    list.sort((a, b) => (b.wiki - a.wiki) || a.label.localeCompare(b.label, loc()));
    museumAll = list;
    museumOffset = Math.min(museumOffset, Math.max(0, Math.floor((list.length - 1) / LIST_PAGE) * LIST_PAGE)); // list may have shrunk
    emitMuseumPage();
}
// Paged list for the panel (LIST_PAGE per page)
const LIST_PAGE = 200;
let museumAll = [], museumOffset = 0, museumPlaces = [];
function emitMuseumPage() {
    notify('OnMuseumList', JSON.stringify({
        total: museumAll.length, offset: museumOffset, places: museumPlaces,
        items: museumAll.slice(museumOffset, museumOffset + LIST_PAGE).map(r => ({ key: r.key, name: r.label, type: tr('mus.' + r.type), city: r.city, country: (r.cc && regionName(r.cc)) || '', wiki: r.wiki }))
    }));
}
export function museumPage(dir) {
    museumOffset = Math.max(0, Math.min(museumOffset + dir * LIST_PAGE, Math.floor((museumAll.length - 1) / LIST_PAGE) * LIST_PAGE));
    emitMuseumPage();
}
// Phone layout (same media query as the CSS): portrait, or short landscape with touch
export function isPhone() { return matchMedia('(max-width: 760px), (max-height: 500px) and (pointer: coarse)').matches; }
// Panel row folded open: scroll it to the top of its own list (not the page)
export function scrollRowTop(key) {
    const li = [...document.querySelectorAll('.radio-list li[data-key]')].find(e => e.dataset.key === key);
    const list = li?.closest('.radio-list');
    if (list) list.scrollTo({ top: list.scrollTop + li.getBoundingClientRect().top - list.getBoundingClientRect().top, behavior: 'smooth' });
}
// Details folded open in the panel row: info fields + Wikipedia summary (loaded when missing)
export async function museumDetails(key) {
    const r = store.museums.get(key);
    if (!r) return null;
    if (r.qid && r.qw?.lang !== S.lang) await loadQidWiki(r);
    const fields = [];
    infoRows(r.info, fields);
    const w = r.qw?.lang === S.lang ? r.qw : null;
    return JSON.stringify({ fields, summary: w?.extract || null, link: w?.url || null, image: w?.thumb || null });
}
// List click: open the info box; flies there only with the zoom button on (as radio and the other layers)
export function museumGo(key) {
    if (store.museums.has(key)) select('museums', key, true);
}
function refreshMuseums() {
    if (!museumIdx) return;
    if (camHeight() < MUSEUM_TILE_H) {
        for (const k of tilesInView(viewer.camera.computeViewRectangle(), museumIdx.tile, 8)) {
            if (!museumIdx.tiles.has(k) || museumTiles.has(k)) continue;
            museumTiles.set(k, 'loading');
            tryJson(`${FEED_URL}/museums/${k}.json?b=${museumIdx.t || 0}`, 20000).then(rows => {
                if (!rows) { museumTiles.delete(k); return; }
                museumTiles.set(k, true);
                for (const row of rows) addMuseum(row, false);
                report('museums', 'st.museums');
                if (museumQuery.inView || !museumQuery.cc) scheduleMuseumSearch();
            });
        }
    }
    report('museums', 'st.museums');
}
// ---------- airports (OurAirports via the fetcher, refreshed monthly): large + medium ----------
// row: [ident, lon, lat, name, large(0/1), iata, country ISO2, city, enwiki title]
const AIRPORT_MEDIUM_H = 3e6; // medium airports only below this height
let airportQuery = { q: '', cc: '', type: '', city: '', inView: false, atc: false }, airportTimer = null, airportsLoaded = false;
let airportAll = [], airportOffset = 0, airportPlaces = [], airportCc = {};
// YouTube ATC streams (fetcher), shared with the camera layer; refreshed after 30 min
let atcP = null, atcAt = 0, atcLast = null;
function atcStreams() {
    if (!atcP || Date.now() - atcAt > 30 * 60000) {
        atcAt = Date.now();
        atcP = tryJson(`${FEED_URL}/atc-streams.json?b=${Math.floor(Date.now() / 60000)}`, 20000).then(j => { if (j) { atcLast = j; applyIssStream(); } return j; });
    }
    return atcP;
}
// YouTube video id from watch/live/embed/youtu.be URLs; embed URL for the info box player
function ytId(url) {
    return String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] || null;
}
function ytEmbed(id) { return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1`; }
function airportMatch(r, text = lowTrim(airportQuery.q), city = lowTrim(airportQuery.city), noCity = false) {
    const q = airportQuery;
    return (!q.cc || r.cc === q.cc) && (!q.type || r.type === q.type) && (!q.atc || !!r.embed)
        && (!text || r.label.toLowerCase().includes(text) || r.key.toLowerCase() === text || r.iata.toLowerCase() === text)
        && (noCity || !city || r.city.toLowerCase().includes(city));
}
// Static list, loaded once (shared by the layer and the country list); false = unreachable
let airportRowsP = null;
function loadAirportRows() {
    if (airportsLoaded) return Promise.resolve(true);
    return airportRowsP ??= (async () => {
        const d = await tryJson(`${FEED_URL}/airports.json`, 30000);
        if (!d?.a) return false;
        airportCc = {};
        for (const [id, lon, lat, name, large, iata, cc, city, wiki] of d.a) {
            const type = large ? 'large' : 'medium';
            const info = [['airportType', () => tr('apt.' + type)], ['icao', id]];
            if (iata) info.push(['iata', iata]);
            if (city) info.push(['place', city]);
            if (cc) info.push(['country', () => regionName(cc) || cc]);
            info.push(['position', fmtPos(lat, lon)], ['liveatc', `https://www.liveatc.net/search/?icao=${encodeURIComponent(id)}`]);
            const r = { key: id, lat, lon, label: name, iata: iata || '', cc: cc || '', city: city || '', type, info, wikiTitle: wiki || undefined, embed: null };
            r.pos = Cz.Cartesian3.fromDegrees(lon, lat, 0);
            r.pt = coll.airports.add({ position: r.pos, pixelSize: large ? 6 : 4, color: Cz.Color.fromCssColorString(DETECT_COLORS.airports), outlineColor: Cz.Color.BLACK.withAlpha(0.6), outlineWidth: 1,
                disableDepthTestDistance: 1.5e6, distanceDisplayCondition: large ? undefined : new Cz.DistanceDisplayCondition(0, AIRPORT_MEDIUM_H), id: { wv: { layer: 'airports', key: id } } });
            store.airports.set(id, r);
            if (cc) airportCc[cc] = (airportCc[cc] || 0) + 1;
        }
        airportsLoaded = true;
        return true;
    })().finally(() => { airportRowsP = null; });
}
async function loadAirports() {
    if (!await loadAirportRows()) { report('airports', 'st.sourceDown'); return 120000; }
    // Live streams: embed + green, larger dot
    const j = await atcStreams(), live = new Map();
    for (const s of j?.streams || []) if (!live.has(s.icao)) live.set(s.icao, s);
    for (const r of store.airports.values()) {
        const s = live.get(r.key), embed = s ? `https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&playsinline=1` : null;
        if (r.embed === embed) continue;
        r.embed = embed;
        r.info = r.info.filter(([k]) => k !== 'youtube');
        if (s) r.info.push(['youtube', `https://www.youtube.com/watch?v=${s.id}`]);
        r.pt.color = Cz.Color.fromCssColorString(s ? '#3dff6e' : DETECT_COLORS.airports);
        r.pt.pixelSize = s ? 9 : r.type === 'large' ? 6 : 4;
        r.pt.distanceDisplayCondition = s || r.type === 'large' ? undefined : new Cz.DistanceDisplayCondition(0, AIRPORT_MEDIUM_H);
    }
    const text = lowTrim(airportQuery.q), city = lowTrim(airportQuery.city);
    for (const r of store.airports.values()) r.pt.show = airportMatch(r, text, city);
    report('airports', () => `OurAirports · ${tr('apt.atcCount', { n: live.size })}`);
    runAirportSearch();
    if (selected?.layer === 'airports') pushInfo();
    return 30 * 60000;
}
export async function airportCountries() {
    await loadAirportRows();
    const list = Object.entries(airportCc).map(([cc, n]) => ({ cc, name: regionName(cc) || cc, n }));
    list.sort((a, b) => a.name.localeCompare(b.name, loc()));
    return JSON.stringify(list);
}
export function airportSetQuery(json) {
    try { airportQuery = { ...airportQuery, ...JSON.parse(json) }; } catch { }
    savePanelFilter('airports', airportQuery);
    airportOffset = 0;
    const text = lowTrim(airportQuery.q), city = lowTrim(airportQuery.city);
    for (const r of store.airports.values()) r.pt.show = airportMatch(r, text, city);
    runAirportSearch();
}
function scheduleAirportSearch() {
    clearTimeout(airportTimer);
    airportTimer = setTimeout(runAirportSearch, 300);
}
function runAirportSearch() {
    if (!airportsLoaded) return;
    const q = airportQuery, text = lowTrim(q.q), city = lowTrim(q.city);
    const rect = q.inView && viewer ? viewer.camera.computeViewRectangle() : null;
    const base = [...store.airports.values()].filter(r => airportMatch(r, text, city, true) && (!rect || inView(rect, Cz.Cartographic.fromDegrees(r.lon, r.lat))));
    const counts = new Map();
    for (const r of base) if (r.city) counts.set(r.city, (counts.get(r.city) || 0) + 1);
    airportPlaces = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 500).map(([c]) => c);
    const list = city ? base.filter(r => r.city.toLowerCase().includes(city)) : base;
    // Streams first, then large airports, then by name
    list.sort((a, b) => (!!b.embed - !!a.embed) || ((b.type === 'large') - (a.type === 'large')) || a.label.localeCompare(b.label, loc()));
    airportAll = list;
    airportOffset = Math.min(airportOffset, Math.max(0, Math.floor((list.length - 1) / LIST_PAGE) * LIST_PAGE));
    emitAirportPage();
}
function emitAirportPage() {
    notify('OnAirportList', JSON.stringify({
        total: airportAll.length, offset: airportOffset, places: airportPlaces,
        items: airportAll.slice(airportOffset, airportOffset + LIST_PAGE).map(r => ({ key: r.key, name: r.label, codes: [r.key, r.iata].filter(Boolean).join(' / '), type: tr('apt.' + r.type), city: r.city, country: (r.cc && regionName(r.cc)) || '', atc: !!r.embed }))
    }));
}
export function airportPage(dir) {
    airportOffset = Math.max(0, Math.min(airportOffset + dir * LIST_PAGE, Math.floor((airportAll.length - 1) / LIST_PAGE) * LIST_PAGE));
    emitAirportPage();
}
export async function airportDetails(key) {
    const r = store.airports.get(key);
    if (!r) return null;
    if (r.wikiTitle && r.wiki?.lang !== S.lang) await loadWiki(r);
    const fields = [];
    infoRows(r.info, fields);
    const w = r.wiki?.lang === S.lang ? r.wiki : null;
    return JSON.stringify({ fields, summary: w?.extract || null, link: w?.url || null, image: w?.thumb || null });
}
export function airportGo(key) {
    if (store.airports.has(key)) select('airports', key, true);
}

// ---------- generic list panels (satellites, launches): text, combo a, combo b, in view, flag ----------
// q: { q, a, b, inView, flag }; filters also decide what shows on the globe (r.listOk)
const LISTS = {
    satellites: {
        match: (r, q, t) => (!q.a || r.group === q.a) && (!q.flag || hasModel('satellites', r.key)) && (!t || r.label.toLowerCase().includes(t) || r.key === t),
        sort: (a, b) => (b.key === ISS_ID) - (a.key === ISS_ID) || a.label.localeCompare(b.label, loc()),
        row: r => ({ key: r.key, name: r.label, sub: [`NORAD ${r.key}`, tr(r.group), r.alt ? `${Math.round(r.alt / 1000).toLocaleString(loc())} km` : ''].filter(Boolean).join(' · '), flag: hasModel('satellites', r.key) }),
        optA: () => SAT_GROUPS.map(([, , l]) => ({ k: l, v: tr(l) })),
        optB: () => [],
        apply: r => { if (r.pt) r.pt.show = r.listOk !== false; }
    },
    launches: {
        match: (r, q, t) => (!q.a || r.provider === q.a) && (!q.b || r.status === q.b) && (!q.flag || !!r.embed) && (!t || r.label.toLowerCase().includes(t) || (r.provider || '').toLowerCase().includes(t)),
        sort: (a, b) => new Date(a.net) - new Date(b.net),
        row: r => ({ key: r.key, name: r.label, sub: [new Date(r.net).toLocaleString(loc(), { dateStyle: 'medium', timeStyle: 'short' }), countdown(r.net), r.status, r.loc].filter(Boolean).join(' · '), flag: !!r.embed }),
        optA: () => [...new Set([...store.launches.values()].map(r => r.provider).filter(Boolean))].sort().map(v => ({ k: v, v })),
        optB: () => [...new Set([...store.launches.values()].map(r => r.status).filter(Boolean))].sort().map(v => ({ k: v, v })),
        apply: r => { if (r.bb) r.bb.show = r.listOk !== false; }
    },
    telescopes: {
        match: (r, q, t) => (!q.a || r.group === q.a) && (!q.flag || hasModel('telescopes', r.key)) && (!t || r.label.toLowerCase().includes(t) || r.key === t),
        sort: (a, b) => a.label.localeCompare(b.label, loc()),
        row: r => ({ key: r.key, name: r.label, sub: [r.l2 ? 'L2' : `NORAD ${r.key}`, tr(r.group), r.l2 ? tr('v.millionKm', { n: 1.5 }) : r.alt ? `${Math.round(r.alt / 1000).toLocaleString(loc())} km` : ''].filter(Boolean).join(' · '), flag: hasModel('telescopes', r.key) }),
        optA: () => ['grp.telescope', 'grp.telescopeL2'].map(k => ({ k, v: tr(k) })),
        optB: () => [],
        apply: r => { if (r.pt) r.pt.show = r.lbl.show = r.listOk !== false; },
        after: () => drawTelOrbits()
    },
    flights: airList(),
    military: airList()
};
// Aircraft panels: q = callsign, q2 = registration
// Masked callsigns ("######") last: '~' sorts after letters and digits
const airSortKey = r => { const s = r.call || r.reg || r.key; return /^[A-Z0-9]/i.test(s) ? s : '~' + s; };
function airList() {
    return {
        match: (r, q, t) => { const t2 = lowTrim(q.q2); return (!t || (r.call || '').toLowerCase().includes(t)) && (!t2 || (r.reg || '').toLowerCase().includes(t2)); },
        sort: (a, b) => { const x = airSortKey(a), y = airSortKey(b); return x < y ? -1 : x > y ? 1 : 0; }, // ASCII codes: fast for ~10k aircraft
        row: r => ({ key: r.key, name: r.call || r.reg || r.key, sub: [r.reg, typeText(r.type), r.ground ? tr('v.onGround') : `FL${Math.round((r.alt || 0) / FT / 100)}`].filter(Boolean).join(' · '), flag: false }),
        optA: () => [],
        optB: () => [],
        apply: r => { if (r.bb) r.bb.show = r.listOk !== false && !(S.cockpit && selected?.key === r.key); }
    };
}
// Saved filters are merged in by loadListFilters() once the settings are read
const listState = Object.fromEntries(Object.keys(LISTS).map(n => [n, { q: { q: '', q2: '', a: '', b: '', inView: false, flag: false }, all: [], offset: 0, timer: null }]));
function loadListFilters() { for (const n in listState) listState[n].q = { ...listState[n].q, ...(S.panelFilters?.[n] || {}) }; }
export function listSetQuery(name, json) {
    const st = listState[name];
    if (!st) return;
    try { st.q = { ...st.q, ...JSON.parse(json) }; } catch { }
    savePanelFilter(name, st.q);
    st.offset = 0;
    runList(name);
}
function scheduleList(name) {
    const st = listState[name];
    clearTimeout(st.timer);
    st.timer = setTimeout(() => runList(name), 300);
}
function runList(name) {
    try { runListInner(name); } catch (e) { console.warn('list', name, e); crumb(`list ${name}: ${e?.message}`); }
}
function runListInner(name) {
    const st = listState[name], L = LISTS[name], q = st.q, t = lowTrim(q.q);
    const rect = q.inView && viewer ? viewer.camera.computeViewRectangle() : null;
    const list = [];
    for (const r of store[name].values()) {
        r.listOk = L.match(r, q, t);
        L.apply(r);
        // No position on Earth (L2): never "in view"
        if (r.listOk && (!rect || (Number.isFinite(r.lon) && Number.isFinite(r.lat) && inView(rect, Cz.Cartographic.fromDegrees(r.lon, r.lat))))) list.push(r);
    }
    L.after?.();
    list.sort(L.sort);
    st.all = list;
    st.offset = Math.min(st.offset, Math.max(0, Math.floor((list.length - 1) / LIST_PAGE) * LIST_PAGE));
    emitList(name);
}
function emitList(name) {
    const st = listState[name], L = LISTS[name];
    notify('OnList', name, JSON.stringify({ total: st.all.length, offset: st.offset, items: st.all.slice(st.offset, st.offset + LIST_PAGE).map(L.row), a: L.optA(), b: L.optB() }));
}
export function listPage(name, dir) {
    const st = listState[name];
    if (!st) return;
    st.offset = Math.max(0, Math.min(st.offset + dir * LIST_PAGE, Math.floor((st.all.length - 1) / LIST_PAGE) * LIST_PAGE));
    emitList(name);
}
// Row click / details per panel (RowClick passes only the key)
export function satGo(key) { if (store.satellites.has(key)) select('satellites', key, true); }
export function telGo(key) { if (store.telescopes.has(key)) select('telescopes', key, true); }
export async function telDetails(key) {
    const r = store.telescopes.get(key);
    if (!r) return null;
    if (r.wikiTitle && r.wiki?.lang !== S.lang) await loadWiki(r);
    const f = [[tr('f.group'), tr(r.group)]];
    if (r.l2) f.push([tr('f.location'), tr('v.l2')], [tr('f.distance'), tr('v.millionKm', { n: 1.5 })]);
    else {
        f.push([tr('f.norad'), r.key], [tr('f.altitude'), `${Math.round(r.alt / 1000).toLocaleString(loc())} km`], [tr('f.speed'), `${r.vel.toFixed(2)} km/s`]);
        if (r.rec?.no) f.push([tr('f.period'), `${(2 * Math.PI / r.rec.no).toFixed(1)} min`]);
        f.push([tr('f.position'), fmtPos(r.lat, r.lon)]);
    }
    const w = r.wiki?.lang === S.lang ? r.wiki : null;
    return JSON.stringify({ fields: f, summary: w?.extract || null, link: w?.url || null, image: w?.thumb || null });
}
export function launchGo(key) { if (store.launches.has(key)) select('launches', key, true); }
export function flightGo(key) { if (store.flights.has(key)) select('flights', key, true); }
export function milGo(key) { if (store.military.has(key)) select('military', key, true); }
function airDetails(layer, key) {
    const r = store[layer].get(key);
    if (!r) return null;
    const fields = [];
    infoRows(r.info, fields);
    fields.push([tr('f.altitude'), r.ground ? tr('v.onGround') : `${Math.round(r.alt).toLocaleString(loc())} m (FL${Math.round(r.alt / FT / 100)})`], [tr('f.speed'), `${Math.round(r.gs * 3.6)} ${tr('u.kmh')}`]);
    return JSON.stringify({ fields, summary: null, link: null, image: null });
}
export function flightDetails(key) { return airDetails('flights', key); }
export function milDetails(key) { return airDetails('military', key); }
export function satDetails(key) {
    const r = store.satellites.get(key);
    if (!r) return null;
    const f = [[tr('f.group'), tr(r.group)], [tr('f.norad'), r.key], [tr('f.altitude'), `${Math.round(r.alt / 1000).toLocaleString(loc())} km`], [tr('f.speed'), `${r.vel.toFixed(2)} km/s`]];
    if (r.rec?.no) f.push([tr('f.period'), `${(2 * Math.PI / r.rec.no).toFixed(1)} min`]);
    f.push([tr('f.position'), fmtPos(r.lat, r.lon)]);
    if (r.ytLink) f.push([tr('f.youtube'), r.ytLink]);
    return JSON.stringify({ fields: f, summary: null, link: null, image: null });
}
export function launchDetails(key) {
    const r = store.launches.get(key);
    if (!r) return null;
    const fields = [];
    infoRows(r.info, fields);
    return JSON.stringify({ fields, summary: null, link: null, image: null });
}

// Wikipedia summary + photo of a Wikidata item (museums), cached per language
// Returns the running load when one is busy, so a second caller (row details) waits for the same result
function loadQidWiki(r) {
    const lang = S.lang;
    if (r.qwLoading === lang) return r.qwP;
    r.qwLoading = lang;
    return r.qwP = (async () => {
        const w = await wikidataWiki(r.qid);
        if (r.qwLoading !== lang) return;
        r.qwLoading = null;
        r.qw = { lang, extract: w?.extract || null, thumb: w?.thumb || null, url: w?.url || null };
        if (selected?.key === r.key) pushInfo();
    })();
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
    const ck = 'wv-ll2b'; // b: with webcasts (detailed mode)
    let list = null;
    try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < 3600000) list = c.d; } catch { }
    if (!list) {
        const j = await tryJson('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=40&mode=detailed', 40000);
        if (!j?.results) { report('launches', 'st.sourceDownLimit'); return 600000; }
        list = j.results.map(l => ({
            id: l.id, name: l.name, net: l.net, status: l.status?.name, provider: l.launch_service_provider?.name,
            rocket: l.rocket?.configuration?.full_name, pad: l.pad?.name, loc: l.pad?.location?.name,
            lat: Number(l.pad?.latitude), lon: Number(l.pad?.longitude), mission: l.mission?.description,
            // YouTube webcasts, best first (priority: lower = better)
            yt: (l.vid_urls || []).map(v => ({ p: v.priority ?? 99, id: ytId(v.url), title: v.title || v.publisher?.name || '' })).filter(v => v.id).sort((a, b) => a.p - b.p).map(({ id, title }) => ({ id, title }))
        }));
        try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: list })); } catch { }
    }
    clearLayer('launches');
    const img = icon('rocket', '#c080ff');
    for (const l of list) {
        if (!Number.isFinite(l.lat) || !Number.isFinite(l.lon)) continue;
        const yt = l.yt?.[0];
        const info = [['mission', l.name], ['launchTime', () => new Date(l.net).toLocaleString(loc())], ['countdown', () => countdown(l.net)], ['status', l.status || '—'],
            ['provider', l.provider || '—'], ['rocket', l.rocket || '—'], ['pad', l.pad || '—'], ['location', l.loc || '—'], ['description', (l.mission || '—').slice(0, 280)]];
        if (yt) info.push(['youtube', `https://www.youtube.com/watch?v=${yt.id}`]);
        addBillboard('launches', { key: l.id, lat: l.lat, lon: l.lon, label: l.name, net: l.net, provider: l.provider || '', status: l.status || '', loc: l.loc || '', embed: yt ? ytEmbed(yt.id) : null, info }, img, 0.8);
    }
    runList('launches');
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
    // YouTube airport streams with live ATC audio (live IDs found by the fetcher)
    {
        name: 'atc', owner: 'YouTube', load: async () => {
            const j = await atcStreams();
            return j?.streams?.map(s => ({
                id: s.id, lat: s.lat, lon: s.lon, name: `${s.name} (${s.icao}) – ATC`, owner: s.channel, title: s.title,
                image: `https://i.ytimg.com/vi/${s.id}/hqdefault_live.jpg`,
                embed: `https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&playsinline=1`,
                link: `https://www.youtube.com/watch?v=${s.id}`
            }));
        }
    },
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
    const img = icon('camera', '#ff3b3b'), atcImg = icon('camera', '#3dff6e');
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
                key, lat: c.lat, lon: c.lon, label: c.name, image: c.image, video: c.video || null, embed: c.embed || null,
                info: [['camera', c.title || c.name], ['region', () => tr(`cam.${s.name}`)], ['operator', c.owner || s.owner], ...(c.link ? [['youtube', c.link]] : [])]
            }, s.name === 'atc' ? atcImg : img, s.name === 'atc' ? 0.8 : 0.6);
        }
    }
    report('cameras', () => ok.map(([n, c]) => `${tr(`cam.${n}`)} ${c}`).join(' · ')
        + (failed.length ? ` · ${tr('st.camsDown', { list: failed.map(n => tr(`cam.${n}`)).join(', ') })}` : ''));
    return ok.length ? 0 : 120000;
}

// ---------- selection ----------
// Clock time of the frame being drawn (set in onPreRender); orbiters are computed for this one instant
let frameMs = Date.now();
function currentCartesian(ms = frameMs) {
    if (!selected) return undefined;
    const r = store[selected.layer].get(selected.key);
    if (!r) return undefined;
    if (MOVERS.includes(selected.layer)) { const [la, lo, al] = posAt(r, Date.now()); return Cz.Cartesian3.fromDegrees(lo, la, al); }
    if (r.l2) return l2Position(r.offset, ms);
    if (ORBITERS.includes(selected.layer) && sat) { const g = satGeo(r, new Date(ms)); if (g) return Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h); }
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
    const orb = selected && ORBITERS.includes(selected.layer) ? store[selected.layer]?.get(selected.key) : null;
    if (orb) { startOrbTrack(orb); return true; } // satellites/telescopes: Earth in the background
    stopTrack();
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
    selected = { layer, key }; trail = []; crumb(`select ${layer}:${key}`);
    const moving = MOVERS.includes(layer) || ORBITERS.includes(layer);
    // Entity callbacks get this frame's clock time: same instant as dot, model and camera (else the ring is drawn metres off)
    const posFn = time => currentCartesian(time ? Cz.JulianDate.toDate(time).getTime() : undefined);
    const glow = Cz.Color.fromCssColorString('#7dffb0');
    trackEntity = viewer.entities.add({
        position: Cz.CallbackPositionProperty ? new Cz.CallbackPositionProperty(posFn, false) : new Cz.CallbackProperty(posFn, false),
        point: { pixelSize: 20, color: Cz.Color.TRANSPARENT, outlineColor: glow, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        // Aircraft keep their normal trail (fetcher history); others get the glow trail
        // Trail ends at the current position (points are added once a second; else its end lags behind the object)
        // Orbiters: no trail, their orbit line already shows the path
        polyline: moving && !AIR_DELAY[layer] && !ORBITERS.includes(layer) ? { positions: new Cz.CallbackProperty(() => { const p = currentCartesian(); return p && trail.length ? [...trail, p] : trail; }, false), width: 3, material: new Cz.PolylineGlowMaterialProperty({ glowPower: 0.25, color: glow }) } : undefined,
        viewFrom: r.l2 ? new Cz.Cartesian3(0, -6e8, 4e8) : ORBITERS.includes(layer) ? new Cz.Cartesian3(0, -1.6e6, 1.2e6) : new Cz.Cartesian3(0, -30000, 20000)
    });
    if (layer === 'satellites') { drawOrbit(r); lastOrbit = Date.now(); }
    const zoom = S.zoom[layer] === true;
    if (moving) { if (zoom) { if (ORBITERS.includes(layer)) startOrbTrack(r); else viewer.trackedEntity = trackEntity; } }
    else if (fly && zoom) flyTo(r.lon, r.lat, layer === 'cameras' ? 1500 : layer === 'museums' ? 3000 : layer === 'airports' ? 12000 : layer === 'radio' ? 150000 : 400000);
    if (layer === 'radio' && radioCurrent !== key) radioPlay(key, false);
    if (AIR_DELAY[layer]) startLive(layer, key);
    pushInfo();
}
// Selected aircraft: own position every 5 s (adsb.lol via the fetcher, /live/{hex}), shown only LIVE_DELAY behind
let liveTimer = null, liveRec = null;
function startLive(layer, key) {
    const poll = async () => {
        if (selected?.key !== key) return;
        const j = await tryJson(`${FEED_URL}/live/${encodeURIComponent(key)}?b=${Math.floor(Date.now() / 1000)}`, 8000);
        const r = store[layer].get(key), a = j?.ac?.[0];
        if (r && a && selected?.key === key) {
            const f = fromFeedMil(a, j.t);
            if (addFix(r, f)) Object.assign(r, { lat: f.lat, lon: f.lon, alt: f.alt, gs: f.gs, track: f.track, ground: f.ground, t: f.t });
            if (r.delay > LIVE_DELAY) { r.delay = LIVE_DELAY; trail = []; } // jump to live once, trail restarts there
            r.liveUntil = Date.now() + 3 * LIVE_POLL; liveRec = r;
        }
        if (selected?.key === key) liveTimer = setTimeout(poll, LIVE_POLL);
    };
    poll();
}
function stopLive() {
    clearTimeout(liveTimer); liveTimer = null;
    if (liveRec) liveRec.liveUntil = 0;
    liveRec = null;
}
// Satellites/telescopes: own tracking in the target's east-north-up frame, moved every frame in onPreRender
// (Cesium's trackedEntity jumped away for a frame every few seconds); the mouse still rotates/zooms around the target
let orbTrack = false;
function startOrbTrack(r) {
    const p = currentCartesian();
    if (!p) return;
    viewer.trackedEntity = undefined;
    orbTrack = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1; // zoom right up to the model
    viewer.camera.constrainedAxis = undefined; // rotate freely around the target (the default stops at its "poles")
    viewer.camera.lookAtTransform(Cz.Transforms.eastNorthUpToFixedFrame(p), orbOffset(r, p));
    orbAim();
    orbManual = false; orbLast = null; // composed view until the user moves
}
// Angle between target and Earth centre as seen from the camera
// At most 26°, but the Earth centre (lower left, 45°) at 40% of the half view (clear of the bottom panels) in both directions: a flat phone screen in landscape
// has only ~15° half height, so a fixed 26° put the Earth outside the view (Chandra, JWST)
function orbSep() {
    const f = viewer.camera.frustum, hy = Math.tan((f.fovy ?? f.fov) / 2), hx = hy * (f.aspectRatio || 1);
    return Math.min(26 * Math.PI / 180, Math.atan(Math.min(hx, hy) * 0.4 * Math.SQRT2));
}
// Camera offset (east-north-up) behind the target, tilted until target and Earth centre are orbSep() apart
function orbOffset(r, p) {
    // With a 3D model (its own, or one within 2 km: docked craft such as Nauka, Soyuz, Dragon at the ISS): close by, real size in view
    let model = MODEL_SIZE[MODELS[selected?.layer]?.[r.key]];
    if (!model) for (const o of models) {
        const q = store[o.layer]?.get(o.key)?.pos;
        if (q && Cz.Cartesian3.distance(q, p) < 2000) { model = MODEL_SIZE[MODELS[o.layer][o.key]]; break; }
    }
    const L = model ? model * 4 : r.l2 ? 7.2e8 : 2e6, R = Cz.Cartesian3.magnitude(p);
    // Target at the origin, Earth centre at (0, 0, -R), camera at L·(0, -sin t, cos t)
    const sep = t => Math.acos(Math.min(1, (L + Math.cos(t) * R) / Math.hypot(L * Math.sin(t), R + L * Math.cos(t))));
    let lo = 0, hi = toRad(89);
    const want = orbSep();
    for (let i = 0; i < 30; i++) { const t = (lo + hi) / 2; if (sep(t) < want) lo = t; else hi = t; }
    const t = (lo + hi) / 2;
    return new Cz.Cartesian3(0, -L * Math.sin(t), L * Math.cos(t));
}
// Aim at the target (screen centre), rolled so the Earth lies lower left
let orbW = null; // last Earth → target screen direction (used while they line up)
function orbAim() {
    const cam = viewer.camera, C3 = Cz.Cartesian3;
    const inv = Cz.Matrix4.inverseTransformation(cam.transform, new Cz.Matrix4());
    const earth = Cz.Matrix4.multiplyByPoint(inv, C3.ZERO, new C3()); // Earth centre in the target's frame
    const a = C3.normalize(C3.negate(cam.position, new C3()), new C3());
    const b = C3.normalize(C3.subtract(earth, cam.position, new C3()), new C3());
    // Look straight at the target (was the bisector of target and Earth: target off-centre upper right)
    const d = a;
    const v = C3.subtract(a, b, new C3());
    const vp = C3.subtract(v, C3.multiplyByScalar(d, C3.dot(d, v), new C3()), new C3());
    let w;
    if (C3.magnitude(vp) > 1e-6) w = orbW = C3.normalize(vp, vp); // Earth → target on screen
    else {
        w = C3.subtract(orbW ?? C3.UNIT_Z, C3.multiplyByScalar(d, C3.dot(d, orbW ?? C3.UNIT_Z), new C3()), new C3());
        if (C3.magnitude(w) < 1e-6) w = C3.cross(d, C3.UNIT_X, new C3());
        C3.normalize(w, w);
    }
    const q = C3.cross(d, w, new C3());
    C3.clone(d, cam.direction);
    C3.normalize(C3.subtract(w, q, new C3()), cam.up); // w is 45° between up and right
    C3.normalize(C3.add(w, q, new C3()), cam.right);
}
function orbTrackStep() {
    if (!orbTrack) return;
    // Same position as this frame's dot/model (set in onPreRender); a second computation ms later jitters metres
    const p = selected && ORBITERS.includes(selected.layer) ? store[selected.layer].get(selected.key)?.pos : null;
    if (!p) { stopTrack(); return; }
    const cam = viewer.camera, C3 = Cz.Cartesian3;
    // Moved by mouse or keys since last frame: from then on the user steers; the composition lets go (it flipped
    // the view when target and Earth lined up, making it spin)
    if (orbLast && !C3.equalsEpsilon(cam.position, orbLast, 1e-9, 1e-6)) orbManual = true;
    const up = C3.clone(cam.up);
    // Same offset in the new frame: the camera moves along with the target
    cam.lookAtTransform(Cz.Transforms.eastNorthUpToFixedFrame(p), C3.clone(cam.position));
    if (!orbManual) orbAim();
    else {
        // Look at the target, keep the user's own "up" (no snapping to the target's local vertical)
        const d = C3.normalize(C3.negate(cam.position, new C3()), new C3());
        const u = C3.subtract(up, C3.multiplyByScalar(d, C3.dot(d, up), new C3()), new C3());
        if (C3.magnitude(u) > 1e-6) {
            C3.normalize(u, u);
            C3.clone(d, cam.direction); C3.clone(u, cam.up); C3.cross(d, u, cam.right);
        }
    }
    orbLast = C3.clone(cam.position, orbLast ?? undefined);
}
let orbManual = false, orbLast = null;
function stopTrack() {
    if (viewer?.trackedEntity) viewer.trackedEntity = undefined;
    if (orbTrack) { orbTrack = false; viewer.camera.lookAtTransform(Cz.Matrix4.IDENTITY); viewer.scene.screenSpaceCameraController.minimumZoomDistance = 30; viewer.camera.constrainedAxis = Cz.Cartesian3.UNIT_Z; }
}
// Follow: keep the selected aircraft in the screen centre at the current height, heading and tilt
let follow = false;
export function setFollow(on) {
    follow = !!on && !!selected;
    if (follow) stopTrack();
}
function followStep() {
    if (!follow || !selected || S.cockpit) return;
    const p = currentCartesian();
    if (!p) return;
    const cam = viewer.camera, cv = viewer.scene.canvas;
    const g = Cz.Cartographic.fromCartesian(p), target = Cz.Cartesian3.fromRadians(g.longitude, g.latitude, 0);
    const ctr = cam.pickEllipsoid(new Cz.Cartesian2(cv.clientWidth / 2, cv.clientHeight / 2));
    const range = ctr ? Cz.Cartesian3.distance(cam.positionWC, ctr) : cam.positionCartographic.height;
    cam.lookAt(target, new Cz.HeadingPitchRange(cam.heading, Math.min(cam.pitch, toRad(-5)), range));
    cam.lookAtTransform(Cz.Matrix4.IDENTITY);
}
export function clearSelection(notifyUi = true) {
    follow = false;
    if (S.cockpit) setCockpit(false);
    if (viewer) stopTrack();
    if (trackEntity) viewer.entities.remove(trackEntity);
    hideOrbit();
    trackEntity = null; selected = null; trail = []; cityPick = null;
    stopLive();
    setStreamMode(false);
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
// Moving object: own rows, altitude (aircraft), speed, heading, position
function moverRows(L, r, f) {
    const [la, lo] = posAt(r, Date.now());
    infoRows(r.info, f);
    if (PLANES.includes(L)) f.push([tr('f.altitude'), r.ground ? tr('v.onGround') : `${Math.round(r.alt).toLocaleString(loc())} m (FL${Math.round(r.alt / FT / 100)})`]);
    f.push([tr('f.speed'), `${Math.round(r.gs * 3.6)} ${tr('u.kmh')}`], [tr('f.heading'), `${Math.round(r.track || 0)}°`], [tr('f.position'), fmtPos(la, lo)]);
}
// ---------- flight legs (fetcher legs.js: take-offs and landings seen at airports) ----------
const legCache = new Map(); // path -> { t, d, busy }
let aptLegTimer = null;
// ttl: airport lists 5 s (open info box), aircraft legs 30 s
function legData(path, onLoad, ttl = 30000) {
    let c = legCache.get(path);
    if (!c || (!c.busy && Date.now() - c.t > ttl - 500)) {
        if (legCache.size > 500) legCache.clear();
        c ??= { t: 0, d: null };
        c.busy = true; legCache.set(path, c);
        tryJson(`${FEED_URL}/${path}${path.includes('?') ? '&' : '?'}b=${Math.floor(Date.now() / ttl)}`, 15000).then(d => { c.t = Date.now(); c.d = d || c.d || {}; c.busy = false; onLoad?.(); }); // {}: fetcher without legs
    }
    return c.d;
}
// ICAO → [name, IATA] (airports.json, also without the airport layer)
let aptNames = null, aptNamesP = null;
function aptName(icao) {
    const r = store.airports.get(icao);
    if (r) return [r.label, r.iata];
    if (!aptNames) {
        aptNamesP ??= tryJson(`${FEED_URL}/airports.json`, 30000).then(d => { aptNames = new Map((d?.a || []).map(a => [a[0], [a[3], a[5]]])); if (selected) pushInfo(); });
        return null;
    }
    return aptNames.get(icao) || null;
}
const aptCode = icao => icao ? aptName(icao)?.[1] || icao : '?';
const aptLabel = icao => { const n = aptName(icao); return n ? `${n[0]} (${n[1] || icao})` : icao; };
const hm = s => new Date(s * 1000).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
const aptOf = a => `${a.name} (${a.iata || a.icao})`;
const durText = min => min >= 60 ? `${Math.floor(min / 60)}${tr('u.hour')} ${min % 60}m` : `${min}m`;
// Aircraft info: airline and planned route (adsbdb via the fetcher), distance/time to go, where it took off, earlier legs, owner
function legRows(hex, f, onLoad, r) {
    const d = legData(`leg/${hex}`, onLoad);
    const fl = legData(`flight/${hex}?call=${encodeURIComponent(r?.call || '')}`, onLoad, 120000);
    const rt = fl?.route, al = rt?.airline;
    if (al?.name) f.push([tr('f.airline'), al.iata ? `${al.name} (${al.iata})` : al.name]);
    if (rt?.from && rt?.to) {
        // Take-off seen at another airport than planned: the route for this callsign is probably outdated
        const odd = !!d?.leg?.dep && d.leg.dep !== rt.from.icao;
        f.push([tr('f.flightRoute'), `${aptOf(rt.from)} → ${aptOf(rt.to)}${odd ? ' · ' + tr('v.routeOdd') : ''}`]);
        if (r && !r.ground && !odd && Number.isFinite(rt.to.lat)) {
            const [la, lo] = posAt(r, Date.now()), km = Math.round(distKm(la, lo, rt.to.lat, rt.to.lon));
            f.push([tr('f.toGo'), `${km.toLocaleString(loc())} km${r.gs > 30 ? ` · ~${durText(Math.round(km * 1000 / r.gs / 60))}` : ''}`]);
        }
    }
    if (d?.leg) f.push([tr('f.departed'), `${aptLabel(d.leg.dep)} · ${hm(d.leg.depT)}`]);
    const prev = (d?.legs || []).slice(-3).map(([a, at, b, bt]) => `${aptCode(a)}${at ? ' ' + hm(at) : ''} → ${aptCode(b)}${bt ? ' ' + hm(bt) : ''}`);
    if (prev.length) f.push([tr('f.earlierLegs'), prev.join(' · ')]);
    const o = fl?.owner;
    if (o?.owner && o.owner !== al?.name) f.push([tr('f.owner'), o.cc ? `${o.owner} (${regionName(o.cc) || o.cc})` : o.owner]);
}
// Airport info: departures and arrivals of the last hours, for the fold-open rows
function airportLegItems(icao) {
    const d = legData(`airport/${icao}`, () => { if (selected?.key === icao) pushInfo(); }, 5000);
    if (!d) return { hours: 6, loading: true, dep: [], arr: [] };
    const item = (x, other, airborne) => ({
        key: x[0], label: x[1] || x[2] || x[0], sub: [x[1] && x[2] ? x[2] : '', x[3]].filter(Boolean).join(' · '), time: hm(x[4]),
        other: other ? aptCode(other) : '', airborne: !!airborne, inView: store.flights.has(x[0]) || store.military.has(x[0])
    });
    // x[7] / x[6]: planned destination / origin from the route (fetcher 1.27), shown with "~" while not seen
    return {
        hours: d.hours || 6, loading: false,
        dep: (d.dep || []).map(x => ({ ...item(x, x[5], x[6] && !x[7]), plan: x[7] ? '~' + aptCode(x[7]) : '' })),
        arr: (d.arr || []).map(x => ({ ...item(x, x[5], 0), plan: x[6] ? '~' + aptCode(x[6]) : '' }))
    };
}
// Info of one aircraft without selecting it (airport info box: aircraft from its departures/arrivals)
export function aircraftInfo(hex) {
    const L = store.military.has(hex) ? 'military' : store.flights.has(hex) ? 'flights' : null, r = L ? store[L].get(hex) : null, f = [];
    if (r) moverRows(L, r, f);
    legRows(hex, f, null, r);
    const photo = aircraftPhoto(hex);
    return JSON.stringify({ layer: L, key: hex, title: r ? r.label || hex : hex, fields: f, inView: !!r, photo: photo?.src || null, photoLink: photo?.link || null, photoBy: photo?.by || null });
}
function pushInfo() {
    if (!selected) return;
    const L = selected.layer, r = store[L].get(selected.key);
    if (!r) return;
    const f = [];
    if (MOVERS.includes(L)) {
        moverRows(L, r, f);
        if (PLANES.includes(L)) legRows(r.key, f, () => { if (selected?.key === r.key) pushInfo(); }, r);
    } else if (r.l2) {
        const km = Cz.Cartesian3.magnitude(l2Position(r.offset)) / 1000;
        f.push([tr('f.group'), tr(r.group)], [tr('f.location'), tr('v.l2')], [tr('f.distance'), tr('v.millionKm', { n: Math.round(km / 1e5) / 10 })], [tr('f.position'), tr('v.approx')]);
    } else if (ORBITERS.includes(L)) {
        f.push([tr('f.group'), tr(r.group)], [tr('f.norad'), r.key], [tr('f.altitude'), `${Math.round(r.alt / 1000).toLocaleString(loc())} km`], [tr('f.speed'), `${r.vel.toFixed(2)} km/s`]);
        if (r.rec?.no) f.push([tr('f.period'), `${(2 * Math.PI / r.rec.no).toFixed(1)} min`]);
        f.push([tr('f.position'), fmtPos(r.lat, r.lon)]);
        if (r.ytLink) f.push([tr('f.youtube'), r.ytLink]); // ISS live view
    } else {
        infoRows(r.info, f);
    }
    let img = r.image ? `${r.image}${r.image.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 30000)}` : r.logo || null; // logo: radio station
    let summary = null, link = null, photo = null;
    // Wikipedia: own article (telescopes) or the aircraft model article
    const ws = r.wikiTitle ? r : PLANES.includes(L) ? aircraftWiki(r) : null;
    if (ws?.wikiTitle === null) summary = tr('v.wikiLoading');
    else if (ws?.wikiTitle) {
        const w = ws.wiki?.lang === S.lang ? ws.wiki : null;
        if (!w) loadWiki(ws);
        img = w?.thumb || null; summary = w ? w.extract : tr('v.wikiLoading'); link = w?.url || null;
    } else if (r.qid) {
        // Wikidata item (museums): Wikipedia in the UI language, else English
        const w = r.qw?.lang === S.lang ? r.qw : null;
        if (!w) loadQidWiki(r);
        img = w?.thumb || img; summary = w ? w.extract : tr('v.wikiLoading'); link = w?.url || null;
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
    const legs = L === 'airports' ? airportLegItems(r.key) : null;
    // Airport info: departures/arrivals again after 5 s while it stays selected
    clearTimeout(aptLegTimer);
    if (legs) { const key = r.key; aptLegTimer = setTimeout(() => { if (selected?.key === key) pushInfo(); }, 5000); }
    notify('OnSelect', JSON.stringify({ layer: L, key: selected.key, title: r.label || r.key, fields: f, legs, image: photo ? null : img, video: r.video || null, embed: r.embed || null,
        canCockpit: MOVERS.includes(L), isRadio: L === 'radio', summary, link, photo: photo?.src || null, photoLink: photo?.link || null, photoBy: photo?.by || null }));
    setStreamMode(!!r.embed);
}
// YouTube stream open: globe at 24 fps so the video decoder gets CPU/GPU time (YouTube's own buffer can't be set from an embed)
function setStreamMode(on) {
    if (viewer) viewer.targetFrameRate = on ? 24 : undefined;
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
            key: m.key, lat: m.lat, lon: m.lon, label: m.name, stream: m.stream, logo: m.favicon || null,
            info: [['station', m.name], ['country', () => (m.cc && regionName(m.cc)) || m.country || '—'], ['genre', m.tags || '—'], ['codec', `${m.codec || '?'} ${m.bitrate ? m.bitrate + ' kbps' : ''}`.trim()]]
        }, 5, '#ff4fd8');
    }
    return m;
}
const isFav = key => (S.radioFav || []).some(f => f.key === key);
const radioPublic = m => ({
    key: m.key, name: m.name, country: (m.cc && regionName(m.cc)) || m.country || '', tags: m.tags,
    favicon: m.favicon, geo: m.lat != null && m.lon != null, fav: isFav(m.key)
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
    savePanelFilter('radio', radioQuery);
    radioOffset = 0; // new filter: page 1
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
        const p = new URLSearchParams({ hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true', limit: '1000' });
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
    if (my !== radioGen) return;
    radioList = list; // whole result: prev/next step through all of it
    radioOffset = Math.min(radioOffset, Math.max(0, Math.floor((list.length - 1) / LIST_PAGE) * LIST_PAGE));
    emitRadioPage();
}
let radioOffset = 0;
function emitRadioPage() {
    notify('OnRadioList', JSON.stringify({ total: radioList.length, offset: radioOffset, items: radioList.slice(radioOffset, radioOffset + LIST_PAGE).map(radioPublic) }));
}
export function radioPage(dir) {
    radioOffset = Math.max(0, Math.min(radioOffset + dir * LIST_PAGE, Math.floor((radioList.length - 1) / LIST_PAGE) * LIST_PAGE));
    emitRadioPage();
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
    // Show it on the globe when it has coordinates, else info box only (+ fly to its country)
    if (doSelect && store.radio.has(key)) select('radio', key, true);
    else if (doSelect) { radioInfoOnly(m); if (S.zoom.radio === true && m.cc) flyToCountry(m.cc); }
}
// Details folded open in the radio panel row
export function radioDetails(key) {
    const m = radioMeta.get(key);
    if (!m) return null;
    const fields = [[tr('f.country'), (m.cc && regionName(m.cc)) || m.country || '—'], [tr('f.genre'), m.tags || '—'],
        [tr('f.codec'), `${m.codec || '?'} ${m.bitrate ? m.bitrate + ' kbps' : ''}`.trim()],
        [tr('f.position'), m.lat != null && m.lon != null ? fmtPos(m.lat, m.lon) : tr('radio.noGeo')]];
    return JSON.stringify({ fields, summary: null, link: null, image: m.favicon || null });
}
// Station without coordinates: info box without a selection on the globe
function radioInfoOnly(m) {
    clearSelection(false);
    const fields = [[tr('f.station'), m.name], [tr('f.country'), (m.cc && regionName(m.cc)) || m.country || '—'], [tr('f.genre'), m.tags || '—'],
        [tr('f.codec'), `${m.codec || '?'} ${m.bitrate ? m.bitrate + ' kbps' : ''}`.trim()],
        [tr('f.position'), S.zoom.radio === true && m.cc ? tr('radio.countryPos', { c: regionName(m.cc) || m.cc }) : tr('radio.noGeo')]]; // flown to the country centre
    notify('OnSelect', JSON.stringify({ layer: 'radio', key: m.key, title: m.name, fields, image: m.favicon || null, video: null, canCockpit: false, isRadio: true,
        summary: null, link: null, photo: null, photoLink: null, photoBy: null }));
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
    stopTrack();
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
        // Addresses (house number, building, road): 300 m height
        const addr = /\d/.test(q) || ['house', 'building', 'road'].includes(r.addresstype);
        flyTo(Number(r.lon), Number(r.lat), addr ? 300 : Math.min(2e7, Math.max(3000, span * 111000 * 1.4)));
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
    if (S.envOverlay === 'power' || S.envOverlay === 'powerYear') addEnvLayer(); // country names are drawn into the image
    for (const l of LAYERS) if (lastStatus[l]) notify('OnLayerStatus', l, store[l].size, statusText(l));
    if (selected) pushInfo();
    else if (cityPick) cityPick.spot ? selectSpot(cityPick.lat, cityPick.lon) : cityPick.LABEL_X != null ? selectCountry(cityPick) : cityPick.rank != null && cityPick.pop == null ? selectRegion(cityPick) : selectCity(cityPick, false);
    if (radioMeta.size) { runRadioSearch(); radioNow(); }
    return getStrings();
}
export function setZoom(layer, on) { S.zoom[layer] = !!on; saveSettings(); }
export function setDetect(on, fromEngine = false) {
    S.detect = !!on; saveSettings();
    if (!S.detect && detectCtx) { detectCtx.clearRect(0, 0, detectCanvas.width, detectCanvas.height); orbNameHits = []; detectHits = []; }
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

// Aircraft trails on/off (panel button "Trails")
export function setTrails(on) { S.trails = !!on; saveSettings(); updateAirTrails(Date.now()); }
// Below 400 km: trail (max 50 km, from the received fixes) behind the aircraft in view nearest the screen centre.
// Budget for slow devices: fewer trails when an update takes too long, coarser steps when zoomed out, iOS less often
const AIR_TRAIL_H = 4e5, AIR_TRAIL_M = 50000, AIR_TRAIL_CAP = LITE ? 80 : 300, AIR_TRAIL_EVERY = LITE ? 2000 : 1000;
let airTrails = null, lastAirTrails = 0, airTrailMax = LITE ? 40 : 150;
// On the ground: the ground flag, or slow and low (many transponders never send the flag: taxiing, parked)
const onGround = r => r.ground || ((r.gs ?? 0) < 30 && (r.alt ?? 0) < 300);
const airTrailLines = new Map(); // layer:key -> polyline
function updateAirTrails(now) {
    const h = camHeight(), on = S.trails && !S.cockpit && h < AIR_TRAIL_H && (S.layers.flights || S.layers.military);
    if (!on) {
        if (airTrailLines.size) { airTrails.removeAll(); airTrailLines.clear(); }
        return;
    }
    const t0 = performance.now();
    airTrails ??= viewer.scene.primitives.add(new Cz.PolylineCollection());
    const step = h < 5e4 ? 5000 : h < 2e5 ? 10000 : 15000;
    const rect = viewer.camera.computeViewRectangle(), ctr = viewCenter(), c = new Cz.Cartographic();
    // View rectangle widened by the trail length (50 km ≈ 0.45° latitude)
    let wide = null;
    if (rect) {
        const dLat = AIR_TRAIL_M / R_EARTH, dLon = dLat / Math.max(0.1, Math.cos(Math.max(Math.abs(rect.north), Math.abs(rect.south))));
        wide = new Cz.Rectangle(rect.west - dLon, Math.max(-Math.PI / 2, rect.south - dLat), rect.east + dLon, Math.min(Math.PI / 2, rect.north + dLat));
    }
    // Candidates in (widened) view, nearest the centre first
    const cand = [];
    for (const l of Object.keys(AIR_DELAY)) {
        if (!S.layers[l]) continue;
        for (const r of store[l].values()) {
            const fx = r.fixes;
            if (!fx || fx.length < 2 || onGround(r) || r.listOk === false) continue; // filtered out in the panel: no trail
            const td = now - (r.delay ?? 0), p = airPos(r, td);
            // Icon up to 50 km outside the view: its trail may still be in view (checked per point below)
            if (wide && !Cz.Rectangle.contains(wide, Cz.Cartographic.fromDegrees(p[1], p[0], 0, c))) continue;
            const dx = (p[1] - ctr.lon) * Math.cos(toRad(p[0])), dy = p[0] - ctr.lat;
            const sel = selected?.layer === l && selected.key === r.key;
            cand.push({ l, r, td, p, d: sel ? -1 : dx * dx + dy * dy }); // selected always gets a trail
        }
    }
    cand.sort((a, b) => a.d - b.d);
    const seen = new Set();
    for (const { l, r, td, p } of cand.slice(0, Math.round(airTrailMax))) {
        // Back from the icon along the curve it flew, until 50 km or the oldest fix
        const pts = [Cz.Cartesian3.fromDegrees(p[1], p[0], p[2])], t0fix = r.fixes[0].t;
        let len = 0;
        for (let t = td - step; len < AIR_TRAIL_M; t -= step) {
            const tt = Math.max(t, t0fix), [a, b, al] = airPos(r, tt);
            const q = Cz.Cartesian3.fromDegrees(b, a, al), prev = pts[pts.length - 1], d = Cz.Cartesian3.distance(prev, q);
            if (len + d > AIR_TRAIL_M) { Cz.Cartesian3.lerp(prev, q, (AIR_TRAIL_M - len) / d, q); len = AIR_TRAIL_M; } // cut at exactly 50 km
            else len += d;
            pts.push(q);
            if (tt === t0fix) break;
        }
        if (pts.length < 2) continue;
        // Keep the trail until its tail has left the view too
        if (rect && !pts.some(q => Cz.Rectangle.contains(rect, Cz.Cartographic.fromCartesian(q, undefined, c)))) continue;
        const k = l + ':' + r.key;
        seen.add(k);
        const line = airTrailLines.get(k);
        if (line) line.positions = pts;
        else airTrailLines.set(k, airTrails.add({ positions: pts, width: LITE ? 1 : 1.5, material: Cz.Material.fromType('Color', { color: Cz.Color.fromCssColorString(DETECT_COLORS[l]).withAlpha(0.6) }) }));
    }
    for (const [k, line] of airTrailLines) if (!seen.has(k)) { airTrails.remove(line); airTrailLines.delete(k); }
    // Adapt to the device: > 8 ms → fewer trails, < 3 ms → more (up to the cap)
    const ms = performance.now() - t0;
    if (ms > 8) airTrailMax = Math.max(15, airTrailMax * 0.75);
    else if (ms < 3 && cand.length > airTrailMax) airTrailMax = Math.min(AIR_TRAIL_CAP, airTrailMax * 1.15);
}

// ---------- loop ----------
function tick() {
    const now = Date.now();
    for (const l of MOVERS) {
        if (!S.layers[l]) continue;
        for (const r of store[l].values()) {
            if (r.delayTarget === NEAR_DELAY && !(r.near > now - 30000)) r.delayTarget = AIR_DELAY[l]; // near feed stopped
            if (r.fixes && r.delay < r.delayTarget && !(r.liveUntil > now)) r.delay = Math.min(r.delayTarget, r.delay + (now - (lastTick || now)) * 0.25); // back from live: catch up slowly
            else if (r.fixes && r.delay > r.delayTarget && !(r.liveUntil > now)) r.delay = Math.max(r.delayTarget, r.delay - (now - (lastTick || now)) * 1.0); // near feed: run 2× until ~15 s behind
            const [la, lo, al] = posAt(r, now);
            r.bb.position = Cz.Cartesian3.fromDegrees(lo, la, al);
            if (r.fixes) { // icon points along the curve
                const [la2, lo2] = posAt(r, now + 2000), dx = (lo2 - lo) * Math.cos(toRad(la)), dy = la2 - la;
                if (Math.abs(dx) + Math.abs(dy) > 1e-6) { r.hdg = (toDeg(Math.atan2(dx, dy)) + 360) % 360; r.bb.rotation = -toRad(r.hdg); }
            }
        }
    }
    lastTick = now;
    if (now - lastAirTrails > AIR_TRAIL_EVERY) { lastAirTrails = now; updateAirTrails(now); }
    if (now - lastNear > NEAR_EVERY) { lastNear = now; loadNear().catch(() => { }); }
    if (S.layers.satellites && now % 1000 < 250) propagateSats();
    updateTzLabels();
    if (selected && now - lastTrail > 1000) {
        lastTrail = now;
        // No trail for trains, nor for aircraft on the ground (taxiing gives odd tracks)
        const sr = store[selected.layer].get(selected.key);
        const noTrail = selected.layer === 'trains' || selected.layer === 'ov' || (PLANES.includes(selected.layer) && sr && onGround(sr));
        if (noTrail) trail = [];
        else {
            const p = currentCartesian();
            if (p) { trail.push(p); if (trail.length > 600) trail.shift(); }
        }
    }
    if (S.layers.telescopes && now % 1000 < 250) propagateTelescopes();
    // Rings re-align to the Earth's rotation: the tracked one every second (smooth), the rest every 30 s
    if (S.layers.telescopes && now - lastTelOrbit > 30000) { lastTelOrbit = now; drawTelOrbits(); }
    else if (selected?.layer === 'telescopes' && now - lastOrbit > 1000) { lastOrbit = now; drawTelOrbit(store.telescopes.get(selected.key)); }
    if (S.layers.satellites && now - lastIssOrbit > (selected?.layer === 'satellites' ? 1000 : 30000)) { lastIssOrbit = now; drawIssOrbit(); }
    if (selected?.layer === 'satellites' && now - lastOrbit > 1000) { lastOrbit = now; const r = store.satellites.get(selected.key); if (r) drawOrbit(r); }
    if (selected && now - lastInfo > 2000) { lastInfo = now; pushInfo(); }
}
// 3D models (NASA 3D Resources) in real size (m); minimumPixelSize keeps them visible as an icon from far away
function hasModel(layer, key) { return !!MODELS[layer]?.[key]; } // true when the object has a 3D model
const MODELS = { satellites: { '25544': 'iss', '39084': 'landsat8', '25994': 'terra', '43613': 'icesat2' }, telescopes: { '20580': 'hubble', '25867': 'chandra', jwst: 'jwst', '33053': 'fermi', '28485': 'swift', '43435': 'tess' } };
const MODEL_SIZE = { iss: 109, hubble: 13.2, chandra: 19.5, jwst: 21.2, fermi: 8.5, swift: 5.6, tess: 4.0, landsat8: 5.2, terra: 16.7, icesat2: 10.0 }; // longest extent (m)
// Per-model rotation into flight attitude. ISS: modules along the motion, truss across it, flat over the Earth
// (as delivered the truss pointed forward and the modules up: plane on its edge). Maps x→y, y→z, z→x
const MODEL_FIX = { iss: Cz.Matrix4.fromRotation(new Cz.Matrix3(0, 0, 1, 1, 0, 0, 0, 1, 0)) };
const MODEL_MIN_PX = 8; // small: the model visibly shrinks with distance; far away the dot and label point it out
const models = [];
async function loadModels() {
    for (const [layer, keys] of Object.entries(MODELS)) {
        for (const [key, file] of Object.entries(keys)) {
            try {
                // No dynamic environment map: it is regenerated as the model moves (7.5 km/s), so the lighting flickered light/dark
                const m = await Cz.Model.fromGltfAsync({ url: `models/${file}.glb`, minimumPixelSize: MODEL_MIN_PX, show: false, id: { wv: { layer, key } }, environmentMapOptions: { enabled: false } });
                viewer.scene.primitives.add(m);
                models.push({ layer, key, m, hdg: 0 });
            } catch (e) { console.warn('model', file, e); }
        }
    }
}
// Every frame: model on the object's position, nose along its motion
function modelsStep() {
    const C3 = Cz.Cartesian3;
    for (const o of models) {
        const r = S.layers[o.layer] ? store[o.layer]?.get(o.key) : null;
        const p = r?.pos && r.pt?.show !== false ? r.pos : null;
        o.m.show = !!p;
        if (!p) continue;
        // Heading from the orbit itself (position 1 s ahead): frame-to-frame differences flipped when the position
        // was written twice in a frame, turning the model and flickering its shading
        const g = r.rec && sat ? satGeo(r, new Date(frameMs + 1000)) : null;
        if (g) {
            const inv = Cz.Matrix4.inverseTransformation(Cz.Transforms.eastNorthUpToFixedFrame(p), new Cz.Matrix4());
            const ahead = Cz.Matrix4.multiplyByPoint(inv, Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h), new C3()); // local east-north-up
            if (Math.hypot(ahead.x, ahead.y) > 1) o.hdg = Math.atan2(ahead.x, ahead.y); // from north, towards the motion
        }
        o.m.modelMatrix = Cz.Transforms.headingPitchRollToFixedFrame(p, new Cz.HeadingPitchRoll(o.hdg, 0, 0));
        const fix = MODEL_FIX[MODELS[o.layer][o.key]];
        if (fix) Cz.Matrix4.multiply(o.m.modelMatrix, fix, o.m.modelMatrix);
        // Close by: hide the dot, else it fights with the model's surface
        o.px ??= r.pt.pixelSize;
        const near = C3.distance(viewer.camera.positionWC, p) < MODEL_SIZE[MODELS[o.layer][o.key]] * 60;
        r.pt.pixelSize = near ? 0 : o.px;
        if (trackEntity && selected?.key === o.key) trackEntity.point.show = !near;
    }
}
function onPreRender(scene, time) {
    frameMs = time ? Cz.JulianDate.toDate(time).getTime() : Date.now(); // one instant for everything drawn this frame
    fadeOrbits();
    spinOrbit();
    // Selected satellite: its dot every frame (the rest once a second); else it jumps ~8 km per second against the smoothly following camera
    // Selected telescope: same per-frame move (dot + its label)
    // All telescopes every frame (only a few): a deselected one no longer jumps 7.5 km/s (L2: 110 km/s) away from the camera
    if (S.layers.telescopes && sat) {
        const now = new Date(frameMs), gmst = sat.gstime(now);
        for (const r of store.telescopes.values()) {
            if (!r.pt || r.pt.show === false) continue;
            let p = null;
            if (r.l2) p = l2Position(r.offset, frameMs);
            else { const g = satGeo(r, now, gmst); if (g) p = Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h); }
            if (p) r.pos = r.pt.position = r.lbl.position = p;
            // L2 line along with it (L2 sweeps ~110 km/s in the Earth-fixed frame): its own line in its own small collection,
            // created once and only moved, never removed and re-added (that made it flicker)
            if (p && r.l2) {
                l2Lines ??= viewer.scene.primitives.add(new Cz.PolylineCollection());
                // Points spaced geometrically from the telescope (100 m … 1.5 million km, fixed count): one straight segment from
                // 85 m to 1.5 million km from the camera flickered (depth along it is interpolated badly); checked live
                const dir = Cz.Cartesian3.normalize(p, new Cz.Cartesian3()), len = Cz.Cartesian3.magnitude(p), span = len - 8e6, pts = [p];
                for (let k = 0; k <= L2_LINE_PTS; k++) pts.push(Cz.Cartesian3.multiplyByScalar(dir, len - 100 * Math.pow(span / 100, k / L2_LINE_PTS), new Cz.Cartesian3()));
                // Solid, not dashed: the dash pattern broke down as well
                r.l2Line ??= l2Lines.add({ positions: pts, width: 1.5, material: Cz.Material.fromType('Color', { color: Cz.Color.fromCssColorString(TEL_COLOR).withAlpha(0.45) }) });
                r.l2Line.positions = pts;
                r.l2Line.show = r.listOk !== false;
            }
        }
    }
    // Satellites close to the camera every frame too (list refreshed once a second)
    if (camNear.length && sat && S.layers.satellites) {
        const now = new Date(frameMs), gmst = sat.gstime(now);
        for (const n of camNear) {
            const g = satGeo(n, now, gmst);
            if (g) n.pos = n.pt.position = Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h);
        }
    }
    if (selected?.layer === 'satellites' && sat) {
        const r = store.satellites.get(selected.key), p = r && currentCartesian();
        if (p) r.pos = r.pt.position = p; // r.pos also drives the detect box and label
        // Neighbours (docked craft, nearby satellites) every frame too: else they sweep ~8 km back and forth against the camera
        if (satNear.length) {
            const now = new Date(frameMs), gmst = sat.gstime(now);
            for (const n of satNear) {
                const g = satGeo(n, now, gmst);
                if (g) n.pos = n.pt.position = Cz.Cartesian3.fromRadians(g.lon, g.lat, g.h);
            }
        }
    }
    modelsStep();
    orbTrackStep();
    navStep();
    followStep();
    if (!S.cockpit || !selected) return;
    const r = store[selected.layer].get(selected.key);
    if (!r) return;
    const [la, lo, al] = posAt(r, Date.now());
    viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(lo, la, Math.max(al, 50) + 15), orientation: { heading: toRad(r.hdg ?? r.track ?? 0), pitch: toRad(-7), roll: 0 } });
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
        if (set === countryLabels && envLabels.length) continue; // env labels carry the names
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
    drawEnvLabels(ctx, occ, toWin, w, h); // on top
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
    const cells = new Map(), museumsFar = camHeight() > MUSEUM_TILE_H * 1.2;
    for (const l of LAYERS) {
        if (!S.layers[l]) continue;
        for (const r of store[l].values()) {
            if (museumsFar && l === 'museums' && !r.top) continue; // hidden by distance
            if (r.listOk === false) continue; // filtered out in its panel
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
    ctx.lineWidth = 1; ctx.font = `600 ${S.detectFont}px "Share Tech Mono", monospace`;
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3;
    const b = 11, drawn = [], hits = [];
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
        let tw = 0;
        if (!(r.lbl?.show && telLabels?.show)) { // telescopes have their own map label: box only
            const name = String(r.label || r.key).slice(0, 18);
            tw = detectText(ctx, MOVERS.includes(l) ? `${name} ${Math.round((r.gs || 0) * 3.6)} ${tr('u.kmh')}` : name, x + b + 3, y - b + 8);
        }
        hits.push([x - b - 2, Math.min(y - b, y - b + 8 - S.detectFont) - 2, 2 * b + 4 + (tw ? tw + 3 : 0), 2 * b + 4 + Math.max(0, S.detectFont - 8), l, r.key]); // box + label: click selects
    }
    detectHits = hits;
    drawOrbitNames(ctx, occ, toWin, w, h, drawn);
    detectShown = shownNow;
}
let detectHits = []; // [x, y, w, h, layer, key] of the boxes + labels drawn last frame
// Label text with a dark outline, optionally on a black plate: readable on any background (fillStyle = layer colour, set by the caller)
function detectText(ctx, text, x, y) {
    const lw = ctx.lineWidth, sb = ctx.shadowBlur, fs = ctx.fillStyle, px = S.detectFont;
    ctx.shadowBlur = 0;
    if (S.detectBg && S.detectBgAlpha > 0) {
        ctx.fillStyle = `rgba(0,0,0,${S.detectBgAlpha / 100})`;
        ctx.fillRect(x - 3, y - px * 0.9, ctx.measureText(text).width + 6, px * 1.25);
        ctx.fillStyle = fs;
    }
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.lineWidth = lw; ctx.shadowBlur = sb;
    return ctx.measureText(text).width;
}
// Detection on: name along the orbit line of a satellite/telescope whose object is off screen; a click on it selects the object
let orbNameHits = [];
function drawOrbitNames(ctx, occ, toWin, w, h, drawn) {
    orbNameHits = [];
    const targets = [];
    if (S.layers.telescopes) for (const r of store.telescopes.values()) if (!r.l2 && r.listOk !== false && r.orbLine) targets.push(['telescopes', r, r.orbLine]);
    const iss = store.satellites.get(ISS_ID);
    if (S.layers.satellites && iss && issOrbitEntity?.show) targets.push(['satellites', iss, issOrbitEntity]);
    const m = 10, taken = [], dist2 = Cz.Cartesian3.distanceSquared;
    for (const [l, r, line] of targets) {
        const pts = line.positions;
        if (!pts?.length || !r.pos || (selected?.layer === l && selected.key === r.key)) continue;
        const sp = occ.isPointVisible(r.pos) ? toWin(viewer.scene, r.pos, scratchWin) : null;
        if (sp && sp.x >= 0 && sp.y >= 0 && sp.x <= w && sp.y <= h) { r.nameP = null; continue; } // object itself in view
        const name = String(r.label || r.key).slice(0, 18), tw = ctx.measureText(name).width;
        // Spot on screen (arrow + whole text inside) and not behind the Earth
        const onScreen = p => { if (!occ.isPointVisible(p)) return null; const s = toWin(viewer.scene, p); return s && s.x >= m + 20 && s.x <= w - tw - 2 * m - 30 && s.y >= m + 28 && s.y <= h - m - 20 ? s : null; };
        let s = null, bi = -1;
        if (r.nameP) { // keep the held spot while it stays on screen: no hopping
            let bd = 1e30;
            for (let i = 0; i < pts.length; i++) { const d = dist2(pts[i], r.nameP); if (d < bd) { bd = d; bi = i; } }
            if (bd < 1e10) s = onScreen(pts[bi]);
        }
        if (!s) { // new spot: the visible orbit point closest to the object
            let bd = 1e30; bi = -1;
            for (let i = 0; i < pts.length; i++) { const d = dist2(pts[i], r.pos); if (d < bd) { const q = onScreen(pts[i]); if (q) { bd = d; bi = i; s = q; } } }
        }
        r.nameP = s ? pts[bi] : null;
        if (!s) continue;
        // Arrow: beside the line (normal to it, on the right side), tip on the line, name behind the tail
        const a = toWin(viewer.scene, pts[(bi + pts.length - 1) % pts.length]), c = toWin(viewer.scene, pts[(bi + 1) % pts.length]);
        let tx = a && c ? c.x - a.x : 1, ty = a && c ? c.y - a.y : 0;
        const tl = Math.hypot(tx, ty) || 1;
        let nx = -ty / tl, ny = tx / tl;
        if (nx < -0.01 || (Math.abs(nx) <= 0.01 && ny < 0)) { nx = -nx; ny = -ny; }
        const L = 20, tail = [s.x + nx * L, s.y + ny * L], tip = [s.x + nx * 2, s.y + ny * 2];
        if (drawn.some(([dx, dy]) => Math.abs(dx - tail[0]) < tw + 40 && Math.abs(dy - tail[1]) < 24) || taken.some(([ox, oy]) => Math.abs(ox - tail[0]) < tw + 40 && Math.abs(oy - tail[1]) < 24)) continue;
        taken.push(tail);
        ctx.strokeStyle = ctx.fillStyle = DETECT_COLORS[l];
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tail[0], tail[1]); ctx.lineTo(tip[0] + nx * 5, tip[1] + ny * 5); ctx.stroke();
        ctx.beginPath(); // head: 7 px long, 3.5 px half-width
        ctx.moveTo(tip[0], tip[1]);
        ctx.lineTo(tip[0] + nx * 7 - ny * 3.5, tip[1] + ny * 7 + nx * 3.5);
        ctx.lineTo(tip[0] + nx * 7 + ny * 3.5, tip[1] + ny * 7 - nx * 3.5);
        ctx.closePath(); ctx.fill();
        detectText(ctx, name, tail[0] + 5, tail[1] + 4);
        orbNameHits.push([tail[0] - 8, tail[1] - 12, tw + 20, 22, l, r.key]);
    }
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
    // Nav pad: tilt/turn around the screen centre
    const tilt = (navHeld.has('tiltup') ? 1 : 0) - (navHeld.has('tiltdown') ? 1 : 0);
    const turn = (navHeld.has('turnr') ? 1 : 0) - (navHeld.has('turnl') ? 1 : 0);
    // Tracking a satellite/telescope: keys and nav pad turn around it and zoom towards it (panning the globe lost it at once)
    if (orbTrack) {
        const cam = viewer.camera, dist = Cz.Cartesian3.magnitude(cam.position);
        const rx = navVel.x + turn, ry = navVel.y + tilt;
        if (rx) cam.rotateRight(rx * 0.8 * dt);
        if (ry) cam.rotateUp(ry * 0.6 * dt);
        if (navVel.z > 0 && dist > 2) cam.zoomIn(dist * 0.7 * navVel.z * dt);
        if (navVel.z < 0) cam.zoomOut(dist * 0.7 * -navVel.z * dt);
        return;
    }
    if (tilt || turn) orbit(turn * 1.2 * dt, tilt * 0.8 * dt);
    if (!navVel.x && !navVel.y && !navVel.z) return;
    const cam = viewer.camera, h = camHeight();
    // Move over the globe relative to the screen (heading-aware), keeping height and view angle
    const dx = navVel.x, dy = navVel.y;
    if (dx || dy) {
        stopTrack();
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
// Turn/tilt around the point in the screen centre; looking past the globe: tilt back down
function orbit(dHeading, dPitch) {
    const cam = viewer.camera, cv = viewer.scene.canvas;
    stopTrack();
    const target = cam.pickEllipsoid(new Cz.Cartesian2(cv.clientWidth / 2, cv.clientHeight / 2));
    if (!target) {
        cam.setView({ orientation: { heading: cam.heading + dHeading, pitch: Math.max(toRad(-90), cam.pitch - Math.abs(dPitch) - 0.02), roll: 0 } });
        return;
    }
    // Rotate in the target's east-north-up frame with Cesium's own rotate: starts exactly at the current view
    const axis = cam.constrainedAxis;
    cam.lookAtTransform(Cz.Transforms.eastNorthUpToFixedFrame(target));
    cam.constrainedAxis = Cz.Cartesian3.UNIT_Z; // local up: no passing over the top
    if (dHeading) cam.rotateRight(dHeading);
    if (dPitch) {
        const pos = cam.position.clone(), dir = cam.direction.clone(), up = cam.up.clone(), right = cam.right.clone();
        cam.rotateDown(dPitch);
        // Keep the camera at least 8° above the horizon of the target
        if (Math.asin(cam.position.z / Cz.Cartesian3.magnitude(cam.position)) < toRad(8)) {
            Cz.Cartesian3.clone(pos, cam.position); Cz.Cartesian3.clone(dir, cam.direction);
            Cz.Cartesian3.clone(up, cam.up); Cz.Cartesian3.clone(right, cam.right);
        }
    }
    cam.lookAtTransform(Cz.Matrix4.IDENTITY);
    cam.constrainedAxis = axis;
}
// Straight down, north up, over the current centre
function northDown() {
    if (S.cockpit) return;
    const c = viewCenter();
    stopTrack();
    viewer.camera.flyTo({ destination: Cz.Cartesian3.fromDegrees(c.lon, c.lat, Math.min(2.2e7, camHeight())), orientation: { heading: 0, pitch: toRad(-90), roll: 0 }, duration: 0.8 });
}
// On-screen nav pad (touch): hold a button to turn, tilt or zoom
function addNavPad() {
    const pad = document.createElement('div');
    pad.className = 'navpad';
    const cells = [['turnl', '⟲'], ['tiltup', '▲'], ['turnr', '⟳'], ['-', '−'], ['north', 'N'], ['+', '+'], [null], ['tiltdown', '▼'], [null]];
    for (const [k, txt] of cells) {
        const b = document.createElement(k ? 'button' : 'span');
        pad.appendChild(b);
        if (!k) continue;
        b.textContent = txt;
        if (k === 'north') { b.addEventListener('click', northDown); continue; }
        const stop = () => { navHeld.delete(k); b.classList.remove('held'); };
        b.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (!navHeld.size) navLast = performance.now();
            navHeld.add(k); b.classList.add('held');
            try { b.setPointerCapture(e.pointerId); } catch { }
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, stop);
    }
    pad.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(pad);
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
    ['airport', 'airports'], ['luchthaven', 'airports'], ['vliegveld', 'airports'], ['flughafen', 'airports'], ['aéroport', 'airports'], ['机场', 'airports'],
    ['vlucht', 'flights'], ['vliegtuig', 'flights'], ['flight', 'flights'], ['plane', 'flights'], ['flug', 'flights'], ['avion', 'flights'], ['vol ', 'flights'], ['航班', 'flights'], ['飞机', 'flights'],
    ['muse', 'museums'], ['musée', 'museums'], ['博物馆', 'museums'],
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
