// WorldView fetcher for a VPS (netcup): writes snapshots + 10° tiles to /data, served by Caddy
import { mkdir, writeFile, rename, readdir, unlink, readFile, stat } from 'node:fs/promises';
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
import { makeHistory, trackHistory } from './history.js';
import { BOXES, fetchBox, tileInBox, buildIndex, fillPlaces } from './museums.js';
import { fetchEnergyYear } from './energy.js';
import { fetchPlants } from './plants.js';
import { fetchAtcStreams } from './atcstreams.js';
import { fetchAirports } from './airports.js';
import { setAirports, trackLegs, saveLegs, loadLegs, legStats } from './legs.js';

// Raise on every fetcher change (logged at start, served as /status.json)
const VERSION = '1.27.1';
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

// Track history for trails, same delay as the app (civil 140 s, military 45 s)
const civHist = makeHistory(140), milHist = makeHistory(45);

// Split civil snapshot into 10° tiles: {t, src, tile, keys}, flights/x_y.json
// Tile rows get the track history as element 13; flights.json (overview) stays without
async function writeFlights(snap) {
    const hist = trackHistory(civHist, snap.ac, 10, snap.t);
    const tiles = new Map();
    for (const a of snap.ac) {
        const k = `${Math.floor(a[3] / TILE)}_${Math.floor(a[2] / TILE)}`;
        if (!tiles.has(k)) tiles.set(k, []);
        const hh = hist.get(a[0]);
        tiles.get(k).push(hh ? [...a.slice(0, 13), ...Array(Math.max(0, 13 - a.length)).fill(null), hh] : a);
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

// Museums (OSM via Overpass): each 30° box every 30 days, nearest to UTC+1 first; failed boxes retried hourly
// museums-state.json = { "s_w": last success (ms) }; every finished box updates its tiles and the index at once
const MUSEUMS_EVERY = 30 * 86400000;
async function readJson(rel) {
    try { return JSON.parse(await readFile(join(DATA, rel), 'utf8')); } catch { return null; }
}
// Index + per-country files (museums/cc/{ISO2}.json) from all tiles; tiles without country field get it here
async function writeMuseumIndex() {
    const tiles = new Map();
    let filled = 0;
    for (const f of await readdir(join(DATA, 'museums'))) {
        if (!f.endsWith('.json')) continue;
        const k = f.slice(0, -5), rows = await readJson(`museums/${f}`) || [];
        try { if (await fillPlaces(rows)) { await put(`museums/${f}`, rows); filled++; } } catch (e) { log(`museums: places ${e.message}`); }
        tiles.set(k, rows);
    }
    const { index, byCountry } = buildIndex(tiles);
    const ccDir = join(DATA, 'museums', 'cc');
    await mkdir(ccDir, { recursive: true });
    for (const [cc, rows] of byCountry) await put(`museums/cc/${cc}.json`, rows);
    for (const f of await readdir(ccDir)) {
        if (f.endsWith('.json') && !byCountry.has(f.slice(0, -5))) await unlink(join(ccDir, f)).catch(() => { });
    }
    await put('museums-index.json', index); // last: the app only sees complete sets
    if (filled) log(`museums: country/place added to ${filled} tiles`);
    return index;
}
async function refreshMuseums() {
    const dir = join(DATA, 'museums');
    await mkdir(dir, { recursive: true });
    // Index from before 1.20.0 (no country/place): rebuild once from the tiles on disk
    const oldIdx = await readJson('museums-index.json');
    if (oldIdx && (oldIdx.fields || 0) < 11) await writeMuseumIndex();
    const state = await readJson('museums-state.json') || {};
    let fails = 0;
    for (const [s, w] of BOXES) {
        const key = `${s}_${w}`;
        if (Date.now() - (state[key] || 0) < MUSEUMS_EVERY) continue;
        try {
            const box = await fetchBox(s, w);
            const old = (await readdir(dir)).filter(f => f.endsWith('.json') && tileInBox(f.slice(0, -5), s, w));
            let oldCount = 0;
            for (const f of old) oldCount += (await readJson(`museums/${f}`) || []).length;
            if (oldCount > 100 && box.count < oldCount / 2) throw new Error(`only ${box.count} (was ${oldCount}), old tiles kept`);
            for (const [k, rows] of box.tiles) await put(`museums/${k}.json`, rows);
            for (const f of old) if (!box.tiles.has(f.slice(0, -5))) await unlink(join(dir, f)).catch(() => { });
            state[key] = Date.now();
            await put('museums-state.json', state);
            const idx = await writeMuseumIndex();
            log(`museums: box ${key} ${box.count} in ${box.tiles.size} tiles; total ${idx.tiles.length} tiles, overview ${idx.top.length}`);
            fails = 0;
        } catch (e) {
            log(`museums: box ${key} failed: ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`);
            if (++fails >= 3) { log('museums: 3 boxes failed in a row, retry in an hour'); break; }
        }
    }
}

// Rare datasets: fetched only when missing or older than maxAge (checked daily)
async function refreshRare(rel, maxAge, fn, force = false) {
    const s = await stat(join(DATA, rel)).catch(() => null);
    if (s && !force && Date.now() - s.mtimeMs < maxAge) return;
    await put(rel, await fn());
    log(`${rel}: updated`);
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
        trackLegs(s.ac, { call: 1, reg: 11, type: 12, t: 10 }, s.t);
        await writeFlights(s);
        log(`flights: ${s.ac.length}, legs: ${legStats()}`);
    } catch (e) { token = null; throw e; }
}
async function updateMilitary() {
    const m = await fetchMilitary();
    trackLegs(m.ac, { call: 1, reg: 8, type: 9, t: 11 }, m.t);
    // Track history as element 12 of each row
    const hist = trackHistory(milHist, m.ac, 11, m.t);
    m.ac = m.ac.map(a => hist.has(a[0]) ? [...a.slice(0, 12), ...Array(Math.max(0, 12 - a.length)).fill(null), hist.get(a[0])] : a);
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
    every('museums', 3600000, refreshMuseums); // hourly check; only due boxes are fetched
    every('energy', 86400000, () => refreshRare('energy-year.json', 365 * 86400000, fetchEnergyYear));
    every('plants', 86400000, () => refreshRare('plants.json', 365 * 86400000, fetchPlants));
    // Monthly; at once when the file lacks the elevation (element 9, fetcher 1.25.0); legs need the list
    every('airports', 86400000, async () => {
        const old = await readJson('airports.json');
        await refreshRare('airports.json', 30 * 86400000, fetchAirports, !!old?.a?.length && old.a[0].length < 10);
        setAirports((await readJson('airports.json'))?.a);
    });
    every('legs', 5 * 60000, () => saveLegs());
    // YouTube airport streams with ATC audio: live video IDs change when a stream restarts
    // With YOUTUBE_API_KEY: ≈ 24 units per run (uploads + live status), far below the 10,000 daily quota
    every('atc', 30 * 60000, async () => {
        const d = await fetchAtcStreams(env.YOUTUBE_API_KEY, (await readJson('airports.json'))?.a);
        if (d.streams.length || d.iss) await put('atc-streams.json', { t: Math.round(Date.now() / 1000), streams: d.streams, iss: d.iss });
        await put('atc-debug.json', { t: new Date().toISOString(), debug: d.debug }); // temporary: why a channel gives nothing
        log(`atc streams: ${d.streams.length} (${d.log})`);
    });
    every('power', 30 * 60000, async () => { const d = await fetchPower(); await put('power.json', d); log(`power: ${Object.keys(d.c).length} countries`); });
}

await mkdir(DATA, { recursive: true });
log(`WorldView fetcher v${VERSION}`);
// Optional keys: say which features stay off
for (const [k, what] of [['OPENSKY_CLIENT_ID', 'civil flights'], ['NS_API_KEY', 'NS trains'], ['OPENAQ_API_KEY', 'OpenAQ stations'], ['YOUTUBE_API_KEY', 'reliable ATC streams (page scraping instead)']]) {
    if (!env[k] && !(k === 'OPENAQ_API_KEY' && env.OPENAQ_KEY)) log(`no ${k} in .env: ${what} disabled`);
}
// keys: which optional data sources are configured (the app greys out layers that need a missing key)
await put('status.json', { version: VERSION, started: new Date().toISOString(), keys: {} });
startNsApi(env.NS_API_KEY);
// First load of the databases (the slow loop skips them while they're fresh)
const dbFirst = refreshDb().catch(() => { });
const ovRoutesFirst = refreshOvRoutes().catch(() => { });
log(`legs: ${await loadLegs()}`);
setAirports((await readJson('airports.json'))?.a);
// docker stop / compose up send SIGTERM: save the legs first
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => {
    try { await saveLegs(true); log('legs: saved'); } catch (e) { log(`legs: ${e.message}`); }
    process.exit(0);
});
tick();
setInterval(tick, 5000);
