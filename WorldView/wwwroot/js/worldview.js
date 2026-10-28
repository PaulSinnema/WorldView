// WorldView globe engine: CesiumJS + keyless public feeds
const Cz = window.Cesium;
const SETTINGS_KEY = 'wv-settings';
const LAYERS = ['flights', 'military', 'satellites', 'telescopes', 'quakes', 'fires', 'launches', 'radio', 'cameras'];
const ORBITERS = ['satellites', 'telescopes'];
const TEL_COLOR = '#00e5ff';
// Earth-orbiting space telescopes (NORAD id, name)
const TELESCOPES = [[20580, 'Hubble'], [25867, 'Chandra'], [25989, 'XMM-Newton'], [33053, 'Fermi'], [28485, 'Swift'], [38358, 'NuSTAR'], [43435, 'TESS'], [49954, 'IXPE'], [57800, 'XRISM'], [27540, 'INTEGRAL']];
// Sun-Earth L2 telescopes: no TLE, shown at approximate L2 (offset avoids overlap)
const L2_TELESCOPES = [['jwst', 'James Webb (JWST)', 3e8], ['euclid', 'Euclid', -3e8]];
const L2_DIST = 1.5e9;
const STYLE_KEYS = ['normal', 'crt', 'nvg', 'flir', 'ironbow', 'noir', 'snow'];
const BILLBOARD_LAYERS = ['flights', 'military', 'launches', 'cameras'];
const MOVERS = ['flights', 'military'];
const FT = 0.3048, R_EARTH = 6371000;
const FEED_URL = 'https://data.sinnema.ch';
const DETECT_COLORS = { flights: '#3fd0ff', military: '#ffb020', satellites: '#ffffff', quakes: '#ff5050', fires: '#ff7a1a', launches: '#c080ff', radio: '#ff4fd8', cameras: '#ff3b3b', telescopes: '#00e5ff' };
const SAT_GROUPS = [['stations', '#ff5a5a', 'Ruimtestation'], ['visual', '#ffffff', 'Helder zichtbaar'], ['gps-ops', '#4cff8a', 'GPS'], ['weather', '#5ac8ff', 'Weersatelliet'], ['science', '#ffd23f', 'Wetenschap'], ['geo', '#b07aff', 'Geostationair']];
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
const S = { layers: {}, style: 'normal', basemap: 'esri', ionToken: '', hud: true, detect: false, daynight: true, nightLight: 60, zoom: {}, cockpit: false };
// Per layer: zoom/follow on click
const ZOOM_DEFAULT = { flights: false, military: false, satellites: false, telescopes: false, quakes: false, fires: false, launches: false, radio: false, cameras: false };
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
let radioOrder = [];
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
    } else if (kind === 'rocket') {
        g.moveTo(0, -14); g.lineTo(5, -4); g.lineTo(5, 8); g.lineTo(9, 14); g.lineTo(-9, 14); g.lineTo(-5, 8); g.lineTo(-5, -4); g.closePath();
    } else {
        g.rect(-11, -7, 16, 14); g.moveTo(5, -3); g.lineTo(12, -8); g.lineTo(12, 8); g.lineTo(5, 3); g.closePath();
    }
    g.fill(); g.stroke();
    return c.toDataURL(); // shared atlas entry via URL id
}
const icon = (kind, color) => icons[kind + color] ??= makeIcon(kind, color);

// ---------- basemap ----------
function imagery(name) {
    if (name === 'dark') return new Cz.UrlTemplateImageryProvider({ url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', subdomains: 'abcd', maximumLevel: 19, credit: '© OpenStreetMap contributors © CARTO' });
    if (name === 'osm') return new Cz.UrlTemplateImageryProvider({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maximumLevel: 19, credit: '© OpenStreetMap contributors' });
    return new Cz.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maximumLevel: 19, credit: 'Esri, Maxar, Earthstar Geographics' });
}
export async function setBasemap(name) {
    if (name === 'google' && !S.ionToken) return `${S.basemap}|Google 3D vereist een Cesium ion-token (POWER UP).`;
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
            return `esri|Google 3D niet beschikbaar: ${e?.message ?? e}`;
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
}
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
    if (!Cz) throw new Error('CesiumJS kon niet worden geladen (controleer de internetverbinding).');
    dotnet = ref;
    loadSettings();
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
    scene.postProcessStages.fxaa.enabled = true;
    scene.screenSpaceCameraController.minimumZoomDistance = 30;
    // Keep sun lighting at every zoom level (default lights everything below 10,000 km)
    const globe = scene.globe;
    globe.lightingFadeOutDistance = 1; globe.lightingFadeInDistance = 2;
    // Ground atmosphere turns the night side pitch black; plain shading keeps contours visible
    globe.showGroundAtmosphere = false;
    addNightLayer();
    setDayNight(S.daynight);
    if (S.ionToken) { try { scene.setTerrain(Cz.Terrain.fromWorldTerrain()); } catch { } }
    if (S.basemap === 'google') { const r = await setBasemap('google'); const msg = r.split('|')[1]; if (msg) toast(msg); }

    for (const l of LAYERS) {
        coll[l] = scene.primitives.add(BILLBOARD_LAYERS.includes(l) ? new Cz.BillboardCollection() : new Cz.PointPrimitiveCollection());
        coll[l].show = S.layers[l];
    }
    telLabels = scene.primitives.add(new Cz.LabelCollection());
    telOrbits = scene.primitives.add(new Cz.PolylineCollection());
    telLabels.show = telOrbits.show = S.layers.telescopes;
    // L2 lies at ~1.5 million km: extend the far plane
    viewer.camera.frustum.far = 1e10;

    detectCanvas = document.createElement('canvas');
    detectCanvas.className = 'detect';
    document.body.appendChild(detectCanvas);
    detectCtx = detectCanvas.getContext('2d');

    const handler = new Cz.ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction(e => {
        const p = scene.pick(e.position);
        if (p?.id?.wv) select(p.id.wv.layer, p.id.wv.key, true);
    }, Cz.ScreenSpaceEventType.LEFT_CLICK);

    window.addEventListener('keydown', onKey);
    scene.preRender.addEventListener(onPreRender);
    scene.postRender.addEventListener(onPostRender);
    setInterval(tick, 250);

    if (cam) viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(cam[1], cam[0], cam[2]), orientation: { heading: toRad(cam[3] || 0), pitch: toRad(cam[4] ?? -90), roll: 0 } });
    else viewer.camera.setView({ destination: Cz.Cartesian3.fromDegrees(8, 38, 2.2e7) });

    setStyle(S.style);
    for (const l of LAYERS) if (S.layers[l]) startLayer(l);

    return JSON.stringify({ layers: S.layers, style: S.style, basemap: S.basemap, ionToken: S.ionToken, hud: S.hud, detect: S.detect, dayNight: S.daynight, nightLight: S.nightLight, zoom: S.zoom, gpu: gpuName });
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
            toast('Geen GPU-versnelling actief: zet hardwareversnelling aan in de browser');
        }
    } catch { }
}
export const getGpu = () => gpuName;

// ---------- layers ----------
const LOADERS = { flights: loadFlights, military: loadMilitary, satellites: loadSatellites, telescopes: loadTelescopes, quakes: loadQuakes, fires: loadFires, launches: loadLaunches, radio: loadRadio, cameras: loadCameras };

export function setLayer(name, on) { applyLayer(name, on, false); }
function applyLayer(name, on, fromEngine) {
    if (!LAYERS.includes(name)) return;
    S.layers[name] = on; saveSettings();
    coll[name].show = on;
    if (name === 'telescopes') telLabels.show = telOrbits.show = on;
    if (on) startLayer(name); else stopLayer(name);
    if (!on && selected?.layer === name) clearSelection();
    if (fromEngine) notify('OnLayerChanged', name, on);
}
function startLayer(name) {
    const my = (gen[name] = (gen[name] || 0) + 1);
    const run = async () => {
        if (gen[name] !== my || !S.layers[name]) return;
        let next = 0;
        try { next = await LOADERS[name](); } catch (e) { report(name, `fout: ${e?.message ?? e}`); next = 60000; }
        if (next > 0 && gen[name] === my && S.layers[name]) setTimeout(run, next);
    };
    run();
}
function stopLayer(name) { gen[name] = (gen[name] || 0) + 1; }
function report(name, status) { notify('OnLayerStatus', name, store[name].size, status || ''); }
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
// civil: [icao, call, lat, lon, altM, gsMs, track, ground, country, squawk, tPos]
function fromFeedCivil(a, t) {
    return {
        key: a[0], lat: a[2], lon: a[3], alt: a[4], gs: a[5], track: a[6], ground: !!a[7], mil: false, t: (a[10] || t) * 1000,
        label: a[1] || a[0],
        info: { Callsign: a[1] || '—', Land: a[8] || '—', ICAO: a[0], Squawk: a[9] || '—' }
    };
}
// military: [hex, call, lat, lon, altM, gsMs, track, ground, reg, type, squawk, tPos]
function fromFeedMil(a, t) {
    return {
        key: a[0], lat: a[2], lon: a[3], alt: a[4], gs: a[5], track: a[6], ground: !!a[7], mil: true, t: (a[11] || t) * 1000,
        label: a[1] || a[8] || a[0],
        info: { Callsign: a[1] || '—', Registratie: a[8] || '—', Type: a[9] || '—', ICAO: a[0], Squawk: a[10] || '—' }
    };
}
// 30 s bucket keeps the CDN cache key shared by all users
const getFeed = name => tryJson(`${FEED_URL}/${name}.json?b=${Math.floor(Date.now() / 30000)}`, 20000);
const ageText = t => `${Math.max(0, Math.round(Date.now() / 1000 - t))} s oud`;
async function loadFlights() {
    const j = await getFeed('flights');
    if (!j?.ac) { report('flights', 'datafeed niet bereikbaar, nieuwe poging…'); return 30000; }
    merge('flights', j.ac.map(a => fromFeedCivil(a, j.t)).filter(f => !store.military.has(f.key)), 'plane', '#3fd0ff');
    report('flights', `${j.src}, ${ageText(j.t)}`);
    return 30000;
}
async function loadMilitary() {
    const j = await getFeed('military');
    if (!j?.ac) { report('military', 'datafeed niet bereikbaar, nieuwe poging…'); return 30000; }
    merge('military', j.ac.map(a => fromFeedMil(a, j.t)), 'plane', '#ffb020');
    report('military', `${j.src}, ${ageText(j.t)}`);
    return 30000;
}
function merge(layer, list, kind, color) {
    const m = store[layer], col = coll[layer], now = Date.now(), img = icon(kind, color);
    for (const f of list) {
        let r = m.get(f.key);
        if (!r) {
            r = f;
            r.bb = col.add({ image: img, scale: 0.7, alignedAxis: Cz.Cartesian3.UNIT_Z, scaleByDistance: new Cz.NearFarScalar(2e5, 1.0, 1.5e7, 0.45), id: { wv: { layer, key: f.key } } });
            m.set(f.key, r);
        } else Object.assign(r, f);
        r.t = Math.min(f.t || now, now); r.seen = now;
        r.bb.rotation = -toRad(r.track || 0);
        r.bb.position = Cz.Cartesian3.fromDegrees(r.lon, r.lat, r.alt);
    }
    for (const [k, r] of m) if (now - r.seen > 120000) { col.remove(r.bb); m.delete(k); }
    validateSel(layer);
}
function posAt(r, now) {
    if (!r.gs || r.ground) return [r.lat, r.lon, r.alt];
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
    report('satellites', store.satellites.size ? 'CelesTrak (SGP4)' : 'bron niet bereikbaar, nieuwe poging…');
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
            r.lbl = telLabels.add({ text: r.label, font: '12px "Share Tech Mono", monospace', fillColor: color, outlineColor: Cz.Color.BLACK, outlineWidth: 2, style: Cz.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cz.Cartesian2(8, -8), horizontalOrigin: Cz.HorizontalOrigin.LEFT });
            store.telescopes.set(r.key, r);
        };
        const tles = await Promise.all(TELESCOPES.map(([id]) => tleById(id).catch(() => null)));
        TELESCOPES.forEach(([id, name], i) => {
            const lines = (tles[i] || '').split(/\r?\n/).map(s => s.trimEnd()).filter(Boolean);
            if (lines.length < 3 || !lines[1].startsWith('1 ') || !lines[2].startsWith('2 ')) return;
            let rec;
            try { rec = sat.twoline2satrec(lines[1], lines[2]); } catch { return; }
            addTel({ key: String(id), label: name, rec, group: 'Ruimtetelescoop', color: TEL_COLOR, lat: 0, lon: 0, alt: 0, vel: 0 });
        });
        for (const [key, name, offset] of L2_TELESCOPES) addTel({ key, label: name, l2: true, offset, group: 'Ruimtetelescoop (L2)' });
        propagateTelescopes();
        drawTelOrbits();
    }
    const n = [...store.telescopes.values()].filter(r => !r.l2).length;
    report('telescopes', n ? `CelesTrak (SGP4) + ${L2_TELESCOPES.length} op L2 (bij benadering)` : 'bron niet bereikbaar, nieuwe poging…');
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
    if (!j) { report('quakes', 'bron niet bereikbaar, nieuwe poging…'); return 120000; }
    clearLayer('quakes');
    for (const f of j.features || []) {
        const [lon, lat, depth] = f.geometry.coordinates, m = f.properties.mag ?? 0, p = f.properties;
        addPoint('quakes', {
            key: f.id, lat, lon, label: `M${m.toFixed(1)} ${p.place ?? ''}`.trim(),
            info: { Magnitude: m.toFixed(1), Diepte: `${Math.round(depth)} km`, Tijd: new Date(p.time).toLocaleString('nl-NL'), Locatie: p.place ?? '—', Tsunami: p.tsunami ? 'waarschuwing' : 'nee' }
        }, 4 + Math.max(0, m) * 3, m >= 5 ? '#ff3030' : m >= 3 ? '#ff9a2a' : '#ffe14d');
    }
    validateSel('quakes');
    report('quakes', 'USGS, laatste 24 uur');
    return 300000;
}
async function loadFires() {
    const j = await tryJson('https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&days=30', 25000);
    if (!j) { report('fires', 'bron niet bereikbaar, nieuwe poging…'); return 300000; }
    clearLayer('fires');
    for (const e of j.events || []) {
        const g = e.geometry?.[e.geometry.length - 1];
        if (!g || g.type !== 'Point') continue;
        const info = { Naam: e.title, Datum: new Date(g.date).toLocaleDateString('nl-NL'), Bron: (e.sources || []).map(s => s.id).join(', ') || '—' };
        if (g.magnitudeValue) info.Omvang = `${g.magnitudeValue} ${g.magnitudeUnit || ''}`.trim();
        addPoint('fires', { key: e.id, lat: g.coordinates[1], lon: g.coordinates[0], label: e.title, info }, 8, '#ff7a1a');
    }
    validateSel('fires');
    report('fires', 'NASA EONET, open branden');
    return 1800000;
}
async function loadLaunches() {
    const ck = 'wv-ll2';
    let list = null;
    try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && Date.now() - c.t < 3600000) list = c.d; } catch { }
    if (!list) {
        const j = await tryJson('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=40&mode=normal', 25000);
        if (!j?.results) { report('launches', 'bron niet bereikbaar (limiet?), nieuwe poging…'); return 600000; }
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
            info: { Missie: l.name, Tijdstip: new Date(l.net).toLocaleString('nl-NL'), Status: l.status || '—', Aanbieder: l.provider || '—', Raket: l.rocket || '—', Platform: l.pad || '—', Locatie: l.loc || '—', Omschrijving: (l.mission || '—').slice(0, 280) }
        }, img, 0.8);
    }
    validateSel('launches');
    report('launches', 'Launch Library 2, komende lanceringen');
    return 3600000;
}
async function loadRadio() {
    if (store.radio.size) { report('radio', 'Radio Browser'); return 0; }
    let j = null;
    for (const h of RADIO_HOSTS) {
        j = await tryJson(`${h}/json/stations/search?has_geo_info=true&hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=750`, 15000);
        if (j) break;
    }
    if (!j) { report('radio', 'bron niet bereikbaar, nieuwe poging…'); return 120000; }
    for (const s of j) {
        if (!s.url_resolved?.startsWith('https:') || s.geo_lat == null || s.geo_long == null || store.radio.has(s.stationuuid)) continue;
        const name = (s.name || '').trim();
        addPoint('radio', {
            key: s.stationuuid, lat: s.geo_lat, lon: s.geo_long, label: name, stream: s.url_resolved,
            info: { Zender: name, Land: s.country || '—', Genre: (s.tags || '').split(',').slice(0, 4).join(', ') || '—', Codec: `${s.codec || '?'} ${s.bitrate ? s.bitrate + ' kbps' : ''}`.trim() }
        }, 5, '#ff4fd8');
    }
    radioOrder = [...store.radio.values()].sort((a, b) => a.lon - b.lon).map(r => r.key);
    report('radio', 'Radio Browser');
    return 0;
}
// Public traffic cameras: keyless, CORS-enabled lists; each returns [{id, lat, lon, name, image, video?}]
const CAMERA_SOURCES = [
    {
        name: 'Londen', owner: 'Transport for London', load: async () => {
            const j = await tryJson('https://api.tfl.gov.uk/Place/Type/JamCam', 25000);
            return j?.map(c => {
                const p = Object.fromEntries((c.additionalProperties || []).map(x => [x.key, x.value]));
                return { id: c.id, lat: c.lat, lon: c.lon, name: c.commonName, image: p.imageUrl, video: p.videoUrl };
            });
        }
    },
    {
        name: 'Finland', owner: 'Fintraffic', load: async () => {
            const j = await tryJson('https://tie.digitraffic.fi/api/weathercam/v1/stations', 25000);
            return j?.features?.map(f => {
                const preset = f.properties.presets?.find(p => p.inCollection) ?? f.properties.presets?.[0];
                return preset && { id: f.id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], name: f.properties.name.replace(/_/g, ' '), image: `https://weathercam.digitraffic.fi/${preset.id}.jpg` };
            });
        }
    },
    {
        name: 'Californië', owner: 'Caltrans', load: async () => {
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
        name: 'Austin', owner: 'City of Austin', load: async () => {
            const j = await tryJson("https://data.austintexas.gov/resource/b4k4-adkb.json?$where=camera_status='TURNED_ON'&$limit=5000", 25000);
            return j?.filter(c => c.location?.coordinates && c.screenshot_address)
                .map(c => ({ id: c.camera_id, lat: c.location.coordinates[1], lon: c.location.coordinates[0], name: (c.location_name || c.camera_id).trim(), image: c.screenshot_address }));
        }
    },
    {
        name: 'Calgary', owner: 'City of Calgary', load: async () => {
            const j = await tryJson('https://data.calgary.ca/resource/k7p9-kppz.json?$limit=1000', 25000);
            return j?.filter(c => c.point?.coordinates && c.camera_url?.url)
                .map(c => ({ id: c.camera_url.url, lat: c.point.coordinates[1], lon: c.point.coordinates[0], name: c.camera_location, image: c.camera_url.url }));
        }
    },
    {
        name: 'Hongkong', owner: 'Transport Department HK', load: async () => {
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
async function loadCameras() {
    if (store.cameras.size) return 0;
    const img = icon('camera', '#ff3b3b');
    const results = await Promise.all(CAMERA_SOURCES.map(async s => ({ s, list: await s.load().catch(() => null) })));
    const ok = [], failed = [];
    for (const { s, list } of results) {
        const valid = (list || []).filter(c => c && c.image && Number.isFinite(c.lat) && Number.isFinite(c.lon));
        if (!valid.length) { failed.push(s.name); continue; }
        ok.push(`${s.name} ${valid.length}`);
        for (const c of valid) {
            const key = `${s.name}:${c.id}`;
            if (store.cameras.has(key)) continue;
            addBillboard('cameras', {
                key, lat: c.lat, lon: c.lon, label: c.name, image: c.image, video: c.video || null,
                info: { Camera: c.name, Regio: s.name, Beheerder: s.owner }
            }, img, 0.6);
        }
    }
    report('cameras', ok.join(' · ') + (failed.length ? ` · niet bereikbaar: ${failed.join(', ')}` : ''));
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
    if (layer === 'radio') playRadio(r);
    pushInfo();
}
export function clearSelection(notifyUi = true) {
    if (S.cockpit) setCockpit(false);
    if (viewer) viewer.trackedEntity = undefined;
    if (trackEntity) viewer.entities.remove(trackEntity);
    if (orbitEntity) viewer.entities.remove(orbitEntity);
    if (selected?.layer === 'radio') stopRadio();
    trackEntity = orbitEntity = null; selected = null; trail = [];
    if (notifyUi) notify('OnSelect', null);
}
function fmtPos(lat, lon) { return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'Z'} ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'O' : 'W'}`; }
function countdown(net) {
    const ms = new Date(net).getTime() - Date.now(), a = Math.abs(ms);
    const d = Math.floor(a / 86400000), h = Math.floor(a / 3600000) % 24, m = Math.floor(a / 60000) % 60;
    return `${ms >= 0 ? 'T-' : 'T+'}${d ? d + 'd ' : ''}${h}u ${m}m`;
}
function pushInfo() {
    if (!selected) return;
    const L = selected.layer, r = store[L].get(selected.key);
    if (!r) return;
    const f = [];
    if (MOVERS.includes(L)) {
        const [la, lo] = posAt(r, Date.now());
        for (const [k, v] of Object.entries(r.info)) f.push([k, String(v)]);
        f.push(['Hoogte', r.ground ? 'aan de grond' : `${Math.round(r.alt).toLocaleString('nl-NL')} m (FL${Math.round(r.alt / FT / 100)})`]);
        f.push(['Snelheid', `${Math.round(r.gs * 3.6)} km/u`], ['Koers', `${Math.round(r.track || 0)}°`], ['Positie', fmtPos(la, lo)]);
    } else if (r.l2) {
        const km = Cz.Cartesian3.magnitude(l2Position(r.offset)) / 1000;
        f.push(['Groep', r.group], ['Locatie', 'Zon-aarde Lagrangepunt L2'], ['Afstand', `± ${Math.round(km / 1e5) / 10} mln km`], ['Positie', 'bij benadering (geen baangegevens)']);
    } else if (ORBITERS.includes(L)) {
        f.push(['Groep', r.group], ['NORAD', r.key], ['Hoogte', `${Math.round(r.alt / 1000).toLocaleString('nl-NL')} km`], ['Snelheid', `${r.vel.toFixed(2)} km/s`]);
        if (r.rec?.no) f.push(['Omlooptijd', `${(2 * Math.PI / r.rec.no).toFixed(1)} min`]);
        f.push(['Positie', fmtPos(r.lat, r.lon)]);
    } else {
        for (const [k, v] of Object.entries(r.info || {})) f.push([k, String(v)]);
        if (L === 'launches' && r.net) f.splice(2, 0, ['Countdown', countdown(r.net)]);
    }
    const img = r.image ? `${r.image}${r.image.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 30000)}` : null;
    notify('OnSelect', JSON.stringify({ layer: L, key: selected.key, title: r.label || r.key, fields: f, image: img, video: r.video || null, canCockpit: MOVERS.includes(L), isRadio: L === 'radio' }));
}

// ---------- radio ----------
function playRadio(r) {
    stopRadio();
    audio = new Audio(r.stream);
    audio.play().catch(() => toast('Zender kon niet worden afgespeeld'));
}
export function stopRadio() { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; } }
export function tuneRadio(i) {
    const key = radioOrder[i];
    if (!key) return '';
    select('radio', key, true);
    return store.radio.get(key)?.label ?? '';
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
    const j = await tryJson('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), 12000);
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
        catch (e) { toast(`Optiek niet beschikbaar: ${e?.message ?? e}`); }
    }
    if (fromEngine) notify('OnStyleChanged', name);
}
export function setHud(on) { S.hud = !!on; saveSettings(); }
export function setZoom(layer, on) { S.zoom[layer] = !!on; saveSettings(); }
export function setDetect(on, fromEngine = false) {
    S.detect = !!on; saveSettings();
    if (!S.detect && detectCtx) detectCtx.clearRect(0, 0, detectCanvas.width, detectCanvas.height);
    if (fromEngine) notify('OnToggle', 'detect', S.detect);
}
export function setCockpit(on) {
    if (on && !(selected && MOVERS.includes(selected.layer))) { toast('Selecteer eerst een vliegtuig'); on = false; }
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
    if (selected && now - lastTrail > 1000) {
        lastTrail = now;
        const p = currentCartesian();
        if (p) { trail.push(p); if (trail.length > 600) trail.shift(); }
    }
    if (S.layers.telescopes && now % 1000 < 250) propagateTelescopes();
    if (S.layers.telescopes && now - lastTelOrbit > 30000) { lastTelOrbit = now; drawTelOrbits(); }
    if (selected?.layer === 'satellites' && now - lastOrbit > 10000) { lastOrbit = now; const r = store.satellites.get(selected.key); if (r) drawOrbit(r); }
    if (selected && now - lastInfo > 2000) { lastInfo = now; pushInfo(); }
}
function onPreRender() {
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
    if (S.detect && now - lastDetect > 100) {
        lastDetect = now;
        // Never let the overlay break Cesium's render loop
        try { drawDetect(); } catch (e) { console.warn('detect', e); setDetect(false, true); toast(`Detectie uitgeschakeld: ${e?.message ?? e}`); }
    }
}
function drawDetect() {
    const cv = detectCanvas, dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = detectCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const occ = new Cz.EllipsoidalOccluder(Cz.Ellipsoid.WGS84, viewer.camera.positionWC);
    const toWin = Cz.SceneTransforms.worldToWindowCoordinates ?? Cz.SceneTransforms.wgs84ToWindowCoordinates;
    const items = [];
    for (const l of LAYERS) {
        if (!S.layers[l]) continue;
        for (const r of store[l].values()) {
            const p = r.bb ? r.bb.position : r.pos;
            if (!p || !occ.isPointVisible(p)) continue;
            const s = toWin(viewer.scene, p);
            if (!s || s.x < 0 || s.y < 0 || s.x > w || s.y > h) continue;
            items.push([Math.hypot(s.x - w / 2, s.y - h / 2), s.x, s.y, r, l]);
        }
    }
    items.sort((a, b) => a[0] - b[0]);
    ctx.lineWidth = 1; ctx.font = '10px "Share Tech Mono", monospace';
    const b = 11, drawn = [];
    for (const [, x, y, r, l] of items) {
        // Declutter: skip targets overlapping an already boxed one
        if (drawn.length >= 60) break;
        if (drawn.some(([dx, dy]) => Math.abs(dx - x) < 90 && Math.abs(dy - y) < 26)) continue;
        drawn.push([x, y]);
        ctx.strokeStyle = ctx.fillStyle = DETECT_COLORS[l];
        ctx.beginPath();
        for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.moveTo(x + dx * b, y + dy * (b - 5)); ctx.lineTo(x + dx * b, y + dy * b); ctx.lineTo(x + dx * (b - 5), y + dy * b);
        }
        ctx.stroke();
        ctx.fillText(String(r.label || r.key).slice(0, 18), x + b + 3, y - b + 8);
    }
}
function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '7') setStyle(STYLE_KEYS[+k - 1], true);
    else if (k === 'h') { setHud(!S.hud); notify('OnToggle', 'hud', S.hud); }
    else if (k === 'd') setDetect(!S.detect, true);
    else if (k === 'n') setDayNight(!S.daynight, true);
    else if (k === 'c') setCockpit(!S.cockpit);
    else if (k === 'escape') { if (S.cockpit) setCockpit(false); else clearSelection(); }
    else return;
    e.preventDefault();
}

// ---------- voice (Web Speech API) ----------
const VOICE_LAYERS = [['vlucht', 'flights'], ['vliegtuig', 'flights'], ['flight', 'flights'], ['plane', 'flights'], ['milit', 'military'], ['satelliet', 'satellites'], ['satellite', 'satellites'], ['telescoop', 'telescopes'], ['telescope', 'telescopes'], ['aardbeving', 'quakes'], ['earthquake', 'quakes'], ['bosbrand', 'fires'], ['brand', 'fires'], ['fire', 'fires'], ['lancering', 'launches'], ['launch', 'launches'], ['radio', 'radio'], ['camera', 'cameras']];
const VOICE_STYLES = [['nacht', 'nvg'], ['night', 'nvg'], ['nvg', 'nvg'], ['ironbow', 'ironbow'], ['thermisch', 'flir'], ['thermal', 'flir'], ['flir', 'flir'], ['crt', 'crt'], ['noir', 'noir'], ['zwart', 'noir'], ['sneeuw', 'snow'], ['snow', 'snow'], ['normaal', 'normal'], ['normal', 'normal']];
async function handleVoice(text) {
    const t = text.toLowerCase().trim();
    let reply = 'niet begrepen';
    const go = t.match(/(?:ga naar|vlieg naar|breng me naar|neem me mee naar|take me to|fly to|go to)\s+(.+)/);
    const layer = VOICE_LAYERS.find(([w]) => t.includes(w));
    const style = VOICE_STYLES.find(([w]) => t.includes(w));
    if (go) { const r = await search(go[1]); reply = r ? `→ ${r}` : 'locatie niet gevonden'; }
    else if (/(uitzoom|zoom out|wereldbeeld|globe|reset)/.test(t)) { resetGlobe(); reply = '→ globe'; }
    else if (layer) { const on = !/\b(uit|off|verberg|hide)\b/.test(t); applyLayer(layer[1], on, true); reply = `→ ${layer[1]} ${on ? 'aan' : 'uit'}`; }
    else if (style) { setStyle(style[1], true); reply = `→ ${style[1]}`; }
    else if (t.includes('hud')) { setHud(!S.hud); notify('OnToggle', 'hud', S.hud); reply = '→ HUD'; }
    else if (t.includes('detect')) { setDetect(!S.detect, true); reply = '→ detectie'; }
    else if (t.includes('cockpit')) { setCockpit(true); reply = '→ cockpit'; }
    notify('OnVoice', text, reply);
}
export function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    const r = new SR();
    r.lang = (navigator.language || '').startsWith('nl') ? 'nl-NL' : 'en-US';
    r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = e => handleVoice(e.results[0][0].transcript);
    r.onerror = e => toast(`Spraak: ${e.error}`);
    r.onend = () => notify('OnToggle', 'listening', false);
    r.start();
    return true;
}
