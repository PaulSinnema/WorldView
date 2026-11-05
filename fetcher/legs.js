// Flight legs from observed take-offs and landings at airports (no database: memory + /state/legs-state.json)
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const STATE = process.env.STATE_DIR || '/state';
const KEEP_MS = 24 * 3600000;       // finished legs kept for 24 h
const OPEN_MAX_S = 20 * 3600;       // open leg without a landing: closed as "unknown" after 20 h unseen
const GONE_S = 300;                 // unseen this long after a low approach: landed there
const GROUND_KM = 5, LOW_KM = 15, APP_KM = 10;
const DEP_AGL = 900, APP_AGL = 600, GA_AGL = 1500; // metres above the airport
const R = 6371, rad = d => d * Math.PI / 180;

// Airports in a 1° grid: [icao, lon, lat, elevM]
let grid = new Map(), pos = new Map();
const cell = (lat, lon) => `${Math.floor(lat)}_${Math.floor(lon)}`;
export function setAirports(rows) {
    const g = new Map(), p = new Map();
    for (const a of rows || []) {
        const k = cell(a[2], a[1]);
        if (!g.has(k)) g.set(k, []);
        g.get(k).push([a[0], a[1], a[2], a[9] ?? 0]);
        p.set(a[0], [a[2], a[1]]);
    }
    grid = g; pos = p;
}
// [lat, lon] of an airport, or undefined
export const airportPos = icao => pos.get(icao);
function km(lat1, lon1, lat2, lon2) {
    const x = rad(lon2 - lon1) * Math.cos(rad((lat1 + lat2) / 2)), y = rad(lat2 - lat1);
    return Math.hypot(x, y) * R;
}
// Nearest airport within maxKm: { icao, d, elev } or null
function nearest(lat, lon, maxKm) {
    let best = null;
    const la = Math.floor(lat), lo = Math.floor(lon);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        for (const a of grid.get(`${la + i}_${(((lo + j + 180) % 360) + 360) % 360 - 180}`) || []) {
            const d = km(lat, lon, a[2], a[1]);
            if (d <= maxKm && (!best || d < best.d)) best = { icao: a[0], d, elev: a[3] };
        }
    }
    return best;
}

// Per aircraft: { t, alt, g, leg: {dep, depT, call, reg, type} | null, gnd: {apt, t}, cand: {apt, t, alt}, app: {apt, t} }
const ac = new Map();
let done = []; // finished legs: [hex, call, reg, type, dep, depT, arr, arrT]
let dirty = false;

function finish(hex, e, arr, arrT) {
    const l = e.leg || { dep: null, depT: null, call: e.call, reg: e.reg, type: e.type };
    done.push([hex, l.call || e.call || '', l.reg || e.reg || '', l.type || e.type || '', l.dep, l.depT, arr, arrT]);
    e.leg = null; e.app = null; dirty = true;
}
function depart(e, apt, t) {
    e.leg = { dep: apt, depT: t, call: e.call, reg: e.reg, type: e.type };
    e.gnd = null; e.cand = null; e.app = null; dirty = true;
}

// One position: hex, call, reg, type, lat, lon, altM, gsMs, ground (bool), t (s)
function observe(hex, call, reg, type, lat, lon, alt, gs, ground, t) {
    let e = ac.get(hex);
    if (!e) ac.set(hex, e = { t: 0, alt: null, g: null, leg: null, gnd: null, cand: null, app: null });
    if (t <= e.t) return; // same or older fix (several feeds)
    if (call) e.call = call;
    if (reg) e.reg = reg;
    if (type) e.type = type;
    if (e.leg && call) e.leg.call = call;
    const prevAlt = e.alt, prevG = e.g;
    e.t = t; e.alt = ground ? null : alt; e.g = ground;
    if (ground) {
        if (e.leg && t - e.leg.depT < 300) return; // ground flicker right after take-off
        const n = nearest(lat, lon, GROUND_KM);
        if (!n) return;
        // Landed: from the air, after a low approach, or first seen on the ground after a gap
        if (e.leg && (prevG === false || t - e.leg.depT > 1800)) finish(hex, e, n.icao, t);
        else if (!e.leg && e.app && t - e.app.t < 900) finish(hex, e, n.icao, t);
        e.gnd = { apt: n.icao, t }; e.cand = null; e.app = null;
        return;
    }
    const n = nearest(lat, lon, LOW_KM), agl = n ? alt - n.elev : Infinity;
    // Take-off after being seen on the ground (5 km, last 15 min); a real climb, not a flicker
    if (e.gnd && t - e.gnd.t < 900 && (agl > 60 || gs > 50)) { if (e.leg) finish(hex, e, e.gnd.apt, e.gnd.t); depart(e, e.gnd.apt, t); return; }
    if (e.gnd && t - e.gnd.t >= 900) e.gnd = null;
    // No ground fix (many fields lack ground receivers, 90 s snapshots): low near an airport, then 150 m higher within 10 min
    if (e.cand) {
        if (t - e.cand.t > 600) e.cand = null;
        else if (alt > e.cand.alt + 150) { if (e.leg) finish(hex, e, null, null); depart(e, e.cand.apt, e.cand.t); return; }
    }
    // Not during an approach: a go-around is no departure
    if (n && !e.app && agl < DEP_AGL && n.d < LOW_KM && (prevAlt == null || alt >= prevAlt) && (!e.leg || t - e.leg.depT > 1800)) e.cand ??= { apt: n.icao, t, alt };
    // Approach: low and descending near an airport; a climb back up is a go-around
    if (n && agl < APP_AGL && n.d < APP_KM && prevAlt != null && alt < prevAlt - 50) e.app = { apt: n.icao, t };
    else if (e.app && (!n || agl > GA_AGL)) e.app = null;
}

// Feed rows → observations; idx: { call, reg, type, t } column numbers (civil and military rows differ)
export function trackLegs(rows, idx, snapT) {
    for (const a of rows) observe(a[0], a[idx.call] || '', a[idx.reg] || '', a[idx.type] || '', a[2], a[3], a[4] || 0, a[5] || 0, !!a[7], a[idx.t] || snapT);
    const now = snapT;
    for (const [hex, e] of ac) {
        const gone = now - e.t;
        if (e.app && gone > GONE_S && e.t - e.app.t < GONE_S) { finish(hex, e, e.app.apt, e.app.t); continue; }
        if (gone > OPEN_MAX_S) { if (e.leg) finish(hex, e, null, null); ac.delete(hex); }
        else if (!e.leg && gone > 3600) ac.delete(hex); // nothing open: forget after an hour
    }
    const cut = (Date.now() - KEEP_MS) / 1000;
    if (done.length && (done[0][7] ?? done[0][5] ?? 0) < cut) done = done.filter(l => (l[7] ?? l[5] ?? 0) >= cut);
}

// Departures and arrivals of one airport, last `hours`, newest first
// dep: [hex, call, reg, type, depT, arr|null, airborne 0/1], arr: [hex, call, reg, type, arrT, dep|null]
export function airportLegs(icao, hours = 6) {
    const cut = Date.now() / 1000 - hours * 3600, dep = [], arr = [];
    for (const l of done) {
        if (l[4] === icao && l[5] >= cut) dep.push([l[0], l[1], l[2], l[3], l[5], l[6], 0]);
        if (l[6] === icao && l[7] >= cut) arr.push([l[0], l[1], l[2], l[3], l[7], l[4]]);
    }
    for (const [hex, e] of ac) if (e.leg?.dep === icao && e.leg.depT >= cut) dep.push([hex, e.leg.call || '', e.leg.reg || '', e.leg.type || '', e.leg.depT, null, 1]);
    dep.sort((a, b) => b[4] - a[4]); arr.sort((a, b) => b[4] - a[4]);
    return { icao, hours, dep: dep.slice(0, 300), arr: arr.slice(0, 300) };
}
// One aircraft: open leg and the legs of the last 24 h [dep, depT, arr, arrT], oldest first
export function aircraftLegs(hex) {
    const e = ac.get(hex);
    return { hex, leg: e?.leg ? { dep: e.leg.dep, depT: e.leg.depT } : null, legs: done.filter(l => l[0] === hex).map(l => [l[4], l[5], l[6], l[7]]) };
}

// Persistence: written every 5 min and on SIGTERM, read once at start
const FILE = join(STATE, 'legs-state.json');
export async function saveLegs(force = false) {
    if (!dirty && !force) return;
    await mkdir(STATE, { recursive: true });
    const tmp = `${FILE}.tmp`;
    await writeFile(tmp, JSON.stringify({ t: Math.round(Date.now() / 1000), ac: [...ac], done }));
    await rename(tmp, FILE);
    dirty = false;
}
export async function loadLegs() {
    try {
        const s = JSON.parse(await readFile(FILE, 'utf8'));
        for (const [hex, e] of s.ac || []) ac.set(hex, e);
        done = s.done || [];
        return `${ac.size} aircraft, ${done.length} legs`;
    } catch { return 'no saved state'; }
}
export const legStats = () => `${[...ac.values()].filter(e => e.leg).length} open, ${done.length} done`;
