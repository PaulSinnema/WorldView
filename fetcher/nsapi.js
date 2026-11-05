// On-demand API via Caddy: NS train composition + images GET /ns/train/{nr} (cached 5 min),
// live position of one aircraft GET /live/{hex} (adsb.lol, cached 3 s so many viewers make one request),
// flight legs GET /airport/{icao} (5 s) and /leg/{hex} (30 s) from legs.js
import { createServer } from 'node:http';
import { fetchHex, fetchPoint } from './core.js';
import { airportLegs, aircraftLegs, airportPos, trackLegs } from './legs.js';
import { route, cachedRoute, owner } from './routes.js';

// Airport lists: planned destination (departures) / origin (arrivals) from cached routes that fit this airport; missing ones fetched in the background
function withRoutes(body) {
    const plan = (call, side, other) => {
        const r = cachedRoute(call);
        if (!r && call) route(call);
        return r && r[side]?.icao === body.icao ? r[other]?.icao || null : null;
    };
    return {
        ...body,
        dep: body.dep.map(x => x[5] ? x : [...x, plan(x[1], 'from', 'to')]),
        arr: body.arr.map(x => x[5] ? x : [...x, plan(x[1], 'to', 'from')])
    };
}

const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const TTL = 5 * 60000;
const cache = new Map(); // nr -> { t, body }
const LIVE_TTL = 3000, live = new Map(); // hex -> { t, p }
const aptCache = new Map(); // icao -> { t, body } (5 s; airportLegs scans all legs)

// Aircraft near a point for zoomed-in views GET /near/{lat}/{lon}/{nm} (0.5° grid, fixed radii, adsb.lol):
// cached 8 s per area, at most 6 upstream calls per 10 s, 60 s pause after a 429; else the last answer (or empty)
const NEAR_TTL = 8000, near_ = new Map(); // key -> { t, p }
let nearCalls = [], nearPauseUntil = 0;
async function near(lat, lon, nm) {
    if (Math.abs(lat) > 89.5 || Math.abs(lon) > 180) return { ac: [] };
    const k = `${lat}/${lon}/${nm}`, c = near_.get(k), now = Date.now();
    if (c && now - c.t < NEAR_TTL) return c.p;
    nearCalls = nearCalls.filter(t => now - t < 10000);
    if (now < nearPauseUntil || nearCalls.length >= 6) return c ? c.p : { ac: [], busy: true };
    nearCalls.push(now);
    // Every fresh answer also feeds the leg detection: take-offs/landings wherever someone is zoomed in, seconds behind
    const p = fetchPoint(lat, lon, nm).then(j => { trackLegs(j.ac, { call: 1, reg: 8, type: 9, t: 11 }, j.t); return j; }).catch(e => {
        if (/429/.test(e.message)) nearPauseUntil = Date.now() + 60000;
        console.log(new Date().toISOString(), `near ${k}: ${e.message}`);
        return c ? c.p : { ac: [], busy: true };
    });
    if (near_.size > 300) near_.clear();
    near_.set(k, { t: now, p });
    return p;
}

const imgOf = a => typeof a === 'string' ? a : a?.url || null;

async function trainInfo(key, nr) {
    const r = await fetch(`https://gateway.apiportal.ns.nl/virtual-train-api/api/v1/trein/${nr}?features=zitplaats`,
        { headers: { 'Ocp-Apim-Subscription-Key': key, 'User-Agent': UA, Accept: 'application/json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`NS trein HTTP ${r.status}`);
    const j = await r.json();

    const mats = j.materieeldelen || [];
    const sum = f => mats.reduce((a, m) => a + (m.zitplaatsen?.[f] || 0), 0);
    return {
        type: [...new Set(mats.map(m => m.type).filter(Boolean))].join(' + '),
        operator: j.vervoerder || null,
        img: mats.map(m => imgOf(m.afbeelding)).find(Boolean) || null,
        parts: mats.map(m => `${m.type || ''} ${m.materieelnummer || ''}`.trim()).filter(Boolean),
        seats1: sum('zitplaatsEersteKlas') + sum('klapstoelEersteKlas') || null,
        seats2: sum('zitplaatsTweedeKlas') + sum('klapstoelTweedeKlas') || null,
        bikes: sum('fietsplekken') || null,
        cars: j.lengte || null,           // number of carriages
        meters: j.lengteInMeters || null,
        facilities: [...new Set(mats.flatMap(m => m.faciliteiten || []))]
    };
}

export function startNsApi(key, port = 8080) {
    createServer(async (req, res) => {
        const path = req.url.split('?')[0], m = /^\/ns\/train\/(\d{1,6})$/.exec(path);
        const send = (code, body, maxAge = 300) => {
            res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` });
            res.end(JSON.stringify(body));
        };
        const lm = /^\/live\/(~?[0-9a-f]{6})$/i.exec(path);
        if (lm) {
            const hex = lm[1].toLowerCase(), c = live.get(hex);
            if (c && Date.now() - c.t < LIVE_TTL) return send(200, await c.p, 2);
            const p = fetchHex(hex).then(j => { trackLegs(j.ac, { call: 1, reg: 8, type: 9, t: 11 }, j.t); return j; }).catch(e => { console.log(new Date().toISOString(), `live ${hex}: ${e.message}`); return { ac: [] }; });
            if (live.size > 500) live.clear();
            live.set(hex, { t: Date.now(), p });
            return send(200, await p, 2);
        }
        // Departures/arrivals of an airport (last 6 h) and the legs of one aircraft (24 h), from memory (legs.js)
        const am = /^\/airport\/([0-9A-Z-]{3,8})$/i.exec(path);
        if (am) {
            const id = am[1].toUpperCase(), c = aptCache.get(id);
            if (c && Date.now() - c.t < 5000) return send(200, c.body, 5);
            if (aptCache.size > 2000) aptCache.clear();
            // Open info box: live traffic around the airport (adsb.lol, seconds behind) on top of the 90 s OpenSky snapshots
            const p = airportPos(id);
            if (p) await near(Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2, 50);
            const body = withRoutes(airportLegs(id));
            aptCache.set(id, { t: Date.now(), body });
            return send(200, body, 5);
        }
        // Planned route (callsign) and registered owner (hex) from adsbdb, cached on the fetcher
        const fm = /^\/flight\/([0-9a-f]{6})$/i.exec(path);
        if (fm) {
            const call = new URLSearchParams(req.url.split('?')[1] || '').get('call') || '';
            const [r, o] = await Promise.all([route(call), owner(fm[1])]);
            return send(200, { route: r, owner: o }, 60);
        }
        const hm = /^\/leg\/(~?[0-9a-f]{6})$/i.exec(path);
        if (hm) return send(200, aircraftLegs(hm[1].toLowerCase()), 30);
        const nm = /^\/near\/(-?\d{1,2}(?:\.5)?)\/(-?\d{1,3}(?:\.5)?)\/(25|50|100|150|250)$/.exec(path);
        if (nm) return send(200, await near(+nm[1], +nm[2], +nm[3]), 4);
        if (!m || !key) return send(404, { error: 'not found' });
        const nr = m[1], c = cache.get(nr);
        if (c && Date.now() - c.t < TTL) return send(200, c.body);
        try {
            const body = await trainInfo(key, nr);
            if (cache.size > 2000) cache.clear();
            cache.set(nr, { t: Date.now(), body });
            send(200, body);
        } catch (e) { console.log(new Date().toISOString(), `ns train ${nr}: ${e.message}`); send(502, { error: 'upstream' }); }
    }).listen(port);
}
