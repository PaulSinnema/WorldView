// WorldView fetcher for a VPS (netcup): writes snapshots + 10° tiles to /data, served by Caddy
import { mkdir, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { openskyToken, fetchOpensky, fetchMilitary } from './core.js';
import { loadAircraftDb, loadTypes, lookup } from './aircraftdb.js';
import { fetchNs, fetchFinland, fetchAmtrak } from './trains.js';
import { startNsApi } from './nsapi.js';
import { loadOvRoutes, fetchOv } from './ov.js';
import { fetchCameras } from './cameras.js';
import { fetchSensorCommunity, fetchOpenAq } from './air.js';
import { fetchNh3 } from './nh3.js';
import { fetchOzone } from './ozone.js';
import { fetchPower } from './power.js';
import { fetchTempAnomaly } from './gistemp.js';
import { fetchCoral } from './coral.js';

// Raise on every fetcher change (logged at start, served as /status.json)
const VERSION = '1.12.0';
const env = process.env;
const DATA = env.DATA_DIR || '/data';
const TILE = 10;
const interval = Number(env.OPENSKY_INTERVAL_S || 90) * 1000;
let token = null, tokenAt = 0;
let lastNs = [], lastNsAt = 0;

const log = m => console.log(new Date().toISOString(), m);

// Atomic write: readers never see a half-written file
async function put(rel, obj) {
    const file = join(DATA, rel), tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(obj));
    await rename(tmp, file);
}

// Split civil snapshot into 10° tiles: {t, src, tile, keys}, flights/x_y.json
async function writeFlights(snap) {
    const tiles = new Map();
    for (const a of snap.ac) {
        const k = `${Math.floor(a[3] / TILE)}_${Math.floor(a[2] / TILE)}`;
        if (!tiles.has(k)) tiles.set(k, []);
        tiles.get(k).push(a);
    }
    await mkdir(join(DATA, 'flights'), { recursive: true });
    for (const [k, ac] of tiles) await put(`flights/${k}.json`, { t: snap.t, src: snap.src, ac });
    // Remove tiles that are empty now
    for (const f of await readdir(join(DATA, 'flights'))) {
        if (f.endsWith('.json') && !tiles.has(f.slice(0, -5))) await unlink(join(DATA, 'flights', f)).catch(() => { });
    }
    await put('flights-index.json', { t: snap.t, src: snap.src, tile: TILE, tiles: [...tiles.keys()], count: snap.ac.length });
    await put('flights.json', snap);
}

async function getToken() {
    // OpenSky tokens live ~30 min; renew after 25
    if (token && Date.now() - tokenAt < 25 * 60000) return token;
    token = await openskyToken(env.OPENSKY_CLIENT_ID, env.OPENSKY_CLIENT_SECRET);
    tokenAt = Date.now();
    return token;
}

// Weekly refresh of the aircraft database + type names (types.json for the browser)
let lastDb = 0;
async function refreshDb() {
    if (Date.now() - lastDb < 7 * 86400000) return;
    lastDb = Date.now();
    try { log(`aircraft db: ${await loadAircraftDb()}`); } catch (e) { lastDb -= 6 * 86400000; log(`aircraft db: ${e.message}`); }
    try { await put('types.json', await loadTypes()); log('types: ok'); } catch (e) { log(`types: ${e.message}`); }
}

// Daily refresh of the Dutch PT routes (line numbers, operators)
let lastOvRoutes = 0;
async function refreshOvRoutes() {
    if (Date.now() - lastOvRoutes < 86400000) return;
    lastOvRoutes = Date.now();
    try { log(`ov routes: ${await loadOvRoutes()}`); } catch (e) { lastOvRoutes -= 23 * 3600000; log(`ov routes: ${e.message}`); }
}

// Hourly: camera lists that browsers can't fetch themselves (no CORS)
let lastCams = 0;
async function refreshCameras() {
    if (Date.now() - lastCams < 3600000) return;
    lastCams = Date.now();
    try {
        const c = await fetchCameras();
        if (Object.keys(c).length) await put('cameras-extra.json', c);
        log(`cameras: ${Object.entries(c).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
    } catch (e) { log(`cameras: ${e.message}`); }
}

// Air quality: Sensor.Community every 5 min, OpenAQ every 30 min (rate limits)
let lastAir = 0, lastOaq = 0, oaqRows = [];
const oaqKey = env.OPENAQ_API_KEY || env.OPENAQ_KEY; // both names accepted
async function refreshAir() {
    if (Date.now() - lastAir < 5 * 60000) return;
    lastAir = Date.now();
    if (oaqKey && Date.now() - lastOaq >= 30 * 60000) {
        lastOaq = Date.now();
        try { oaqRows = await fetchOpenAq(oaqKey); } catch (e) { log(`openaq: ${e.message}`); }
    }
    try {
        const sc = await fetchSensorCommunity();
        await put('air.json', { t: Math.round(Date.now() / 1000), src: oaqRows.length ? 'Sensor.Community · OpenAQ' : 'Sensor.Community', a: [...sc, ...oaqRows] });
        log(`air: ${sc.length} + openaq ${oaqRows.length}`);
    } catch (e) { log(`air: ${e.message}`); }
}

// Ammonia grid Europe every 8 hours; runs in the background (≈ 6 min, throttled) so the other feeds keep going
let lastNh3 = 0, nh3Busy = false;
function refreshNh3() {
    if (nh3Busy || Date.now() - lastNh3 < 8 * 3600000) return;
    lastNh3 = Date.now(); nh3Busy = true;
    fetchNh3()
        .then(async d => { await put('nh3.json', d); log(`nh3: ${d.v.filter(x => x != null).length}`); })
        .catch(e => { lastNh3 -= 7 * 3600000; log(`nh3: ${e.message}`); }) // retry in an hour
        .finally(() => { nh3Busy = false; });
}

// Each feed on its own schedule; a slow one never delays the others
const due = {}, busy = {};
function every(name, ms, fn) {
    const now = Date.now();
    if (busy[name] || now < (due[name] || 0)) return;
    due[name] = now + ms; busy[name] = true; // also on failure: respect rate limits
    // Network errors ("fetch failed") carry the real reason in e.cause
    Promise.resolve().then(fn).catch(e => {
        log(`${name}: ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`);
        if (ms > 30 * 60000) due[name] = Date.now() + 30 * 60000; // slow feeds: retry in 30 min
    }).finally(() => { busy[name] = false; });
}

async function updateFlights() {
    await dbFirst; // registrations/types need the aircraft database
    try {
        const s = await fetchOpensky(await getToken());
        // civil row + [reg, type] from the aircraft database
        for (const a of s.ac) a.push(...lookup(a[0]));
        await writeFlights(s);
        log(`flights: ${s.ac.length}`);
    } catch (e) { token = null; throw e; }
}
async function updateMilitary() {
    const m = await fetchMilitary();
    await put('military.json', m);
    log(`military: ${m.ac.length}`);
}

// Trains: each source on its own interval; trains.json combines the latest of each (dropped after 5 min without data)
const trainParts = { ns: { rows: [], at: 0 }, finland: { rows: [], at: 0 }, amtrak: { rows: [], at: 0 } };
async function writeTrains() {
    const fresh = Object.values(trainParts).filter(p => Date.now() - p.at < 5 * 60000);
    const tr = fresh.flatMap(p => p.rows);
    await put('trains.json', { t: Math.round(Date.now() / 1000), src: 'NS · Digitraffic (CC BY 4.0) · Amtraker', tr });
    return tr.length;
}
async function updateTrains(name, fetchFn) {
    try {
        let rows = await fetchFn() || [];
        // NS sometimes returns a partial list: keep the previous one then
        if (name === 'ns') {
            if (rows.length < lastNs.length * 0.6 && Date.now() - lastNsAt < 5 * 60000) rows = lastNs;
            else if (rows.length) { lastNs = rows; lastNsAt = Date.now(); }
        }
        trainParts[name] = { rows, at: Date.now() };
        log(`${name}: ${rows.length}, trains: ${await writeTrains()}`);
    } catch (e) { await writeTrains(); throw e; }
}

async function updateOv() {
    await ovRoutesFirst; // line numbers/operators
    const ov = await fetchOv();
    await put('ov.json', { t: Math.round(Date.now() / 1000), src: 'OVapi (NDOV)', ov });
    log(`ov: ${ov.length}`);
}

function tick() {
    every('slow', 60000, async () => { await refreshDb(); await refreshOvRoutes(); await refreshCameras(); await refreshAir(); refreshNh3(); });
    every('flights', interval, updateFlights);
    every('military', 20000, updateMilitary);
    every('ns', 30000, () => updateTrains('ns', () => fetchNs(env.NS_API_KEY)));
    every('finland', 15000, () => updateTrains('finland', fetchFinland));
    every('amtrak', 60000, () => updateTrains('amtrak', fetchAmtrak));
    every('ov', 15000, updateOv);
    every('coral', 6 * 3600000, async () => {
        const png = await fetchCoral(), file = join(DATA, 'coral.png');
        await writeFile(`${file}.tmp`, png); await rename(`${file}.tmp`, file);
        log(`coral: ${Math.round(png.length / 1024)} KB`);
    });
    // Total ozone (NOAA GFS) every 6 hours, temperature anomaly (NASA GISTEMP, monthly) checked daily
    every('ozone', 6 * 3600000, async () => { const d = await fetchOzone(); await put('ozone.json', d); log(`ozone: ${d.valid}`); });
    every('tempanom', 24 * 3600000, async () => { const d = await fetchTempAnomaly(); await put('tempanom.json', d); log(`tempanom: ${d.month}`); });
    every('power', 30 * 60000, async () => { const d = await fetchPower(); await put('power.json', d); log(`power: ${Object.keys(d.c).length} countries`); });
}

await mkdir(DATA, { recursive: true });
log(`WorldView fetcher v${VERSION}`);
// Optional keys: say which features stay off
for (const [k, what] of [['OPENSKY_CLIENT_ID', 'civil flights'], ['NS_API_KEY', 'NS trains'], ['OPENAQ_API_KEY', 'OpenAQ stations']]) {
    if (!env[k] && !(k === 'OPENAQ_API_KEY' && env.OPENAQ_KEY)) log(`no ${k} in .env: ${what} disabled`);
}
// keys: which optional data sources are configured (the app greys out layers that need a missing key)
await put('status.json', { version: VERSION, started: new Date().toISOString(), keys: {} });
startNsApi(env.NS_API_KEY);
// First load of the databases (the slow loop skips them while they're fresh)
const dbFirst = refreshDb().catch(() => { });
const ovRoutesFirst = refreshOvRoutes().catch(() => { });
tick();
setInterval(tick, 5000);
