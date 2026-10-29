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

// Raise on every fetcher change (logged at start, served as /status.json)
const VERSION = '1.5.0';
const env = process.env;
const DATA = env.DATA_DIR || '/data';
const TILE = 10;
const interval = Number(env.OPENSKY_INTERVAL_S || 120) * 1000;
let lastOpensky = 0, token = null, tokenAt = 0;
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
async function refreshAir() {
    if (Date.now() - lastAir < 5 * 60000) return;
    lastAir = Date.now();
    if (env.OPENAQ_API_KEY && Date.now() - lastOaq >= 30 * 60000) {
        lastOaq = Date.now();
        try { oaqRows = await fetchOpenAq(env.OPENAQ_API_KEY); } catch (e) { log(`openaq: ${e.message}`); }
    }
    try {
        const sc = await fetchSensorCommunity();
        await put('air.json', { t: Math.round(Date.now() / 1000), src: oaqRows.length ? 'Sensor.Community · OpenAQ' : 'Sensor.Community', a: [...sc, ...oaqRows] });
        log(`air: ${sc.length} + openaq ${oaqRows.length}`);
    } catch (e) { log(`air: ${e.message}`); }
}

async function run() {
    await refreshDb();
    await refreshOvRoutes();
    await refreshCameras();
    await refreshAir();
    if (Date.now() - lastOpensky >= interval) {
        lastOpensky = Date.now(); // also on failure: respect credit budget
        try {
            const s = await fetchOpensky(await getToken());
            // civil row + [reg, type] from the aircraft database
            for (const a of s.ac) a.push(...lookup(a[0]));
            await writeFlights(s);
            log(`flights: ${s.ac.length}`);
        } catch (e) { token = null; log(`flights: ${e.message}`); }
    }
    try {
        const m = await fetchMilitary();
        await put('military.json', m);
        log(`military: ${m.ac.length}`);
    } catch (e) { log(`military: ${e.message}`); }
    // Trains: each source on its own, a failing one doesn't block the other
    const [ns, fi, us] = await Promise.allSettled([fetchNs(env.NS_API_KEY), fetchFinland(), fetchAmtrak()]);
    for (const [n, p] of [['ns', ns], ['finland', fi], ['amtrak', us]]) if (p.status === 'rejected') log(`${n}: ${p.reason?.message}`);
    // NS sometimes returns a partial list: keep the previous one then
    let nsList = ns.value || [];
    if (nsList.length < lastNs.length * 0.6 && Date.now() - lastNsAt < 5 * 60000) nsList = lastNs;
    else if (nsList.length) { lastNs = nsList; lastNsAt = Date.now(); }
    const tr = [...nsList, ...(fi.value || []), ...(us.value || [])];
    try { await put('trains.json', { t: Math.round(Date.now() / 1000), src: 'NS · Digitraffic (CC BY 4.0) · Amtraker', tr }); log(`trains: ${tr.length}`); }
    catch (e) { log(`trains: ${e.message}`); }
    try {
        const ov = await fetchOv();
        await put('ov.json', { t: Math.round(Date.now() / 1000), src: 'OVapi (NDOV)', ov });
        log(`ov: ${ov.length}`);
    } catch (e) { log(`ov: ${e.message}`); }
}

await mkdir(DATA, { recursive: true });
log(`WorldView fetcher v${VERSION}`);
await put('status.json', { version: VERSION, started: new Date().toISOString() });
startNsApi(env.NS_API_KEY);
run();
setInterval(run, 60000);
