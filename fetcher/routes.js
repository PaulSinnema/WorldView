// Planned route per callsign and aircraft owner per hex from adsbdb.com (no CORS for browsers), cached in memory
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const API = 'https://api.adsbdb.com/v0';
const ROUTE_TTL = 12 * 3600000, AC_TTL = 7 * 86400000, MISS_TTL = 6 * 3600000;
const routes = new Map(), owners = new Map(), pending = new Map(); // key -> { t, v }; key -> promise
let calls = []; // upstream call times: at most 10 per 10 s

const apt = a => a ? { icao: a.icao_code, iata: a.iata_code || '', name: a.name || '', city: a.municipality || '', cc: a.country_iso_name || '', lat: a.latitude, lon: a.longitude } : null;

// One upstream lookup, shared by concurrent requests; null when over the limit (not cached, asked again later)
async function lookup(map, key, path, parse, ttl) {
    const c = map.get(key);
    if (c && Date.now() - c.t < (c.v ? ttl : MISS_TTL)) return c.v;
    if (pending.has(path)) return pending.get(path);
    const now = Date.now();
    calls = calls.filter(t => now - t < 10000);
    if (calls.length >= 10) return c?.v ?? null;
    calls.push(now);
    const p = (async () => {
        try {
            const r = await fetch(`${API}/${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
            if (r.status === 404) { map.set(key, { t: Date.now(), v: null }); return null; }
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const v = parse((await r.json()).response);
            if (map.size > 50000) map.clear();
            map.set(key, { t: Date.now(), v });
            return v;
        } catch (e) { console.log(new Date().toISOString(), `adsbdb ${path}: ${e.message}`); return c?.v ?? null; }
        finally { pending.delete(path); }
    })();
    pending.set(path, p);
    return p;
}

// { airline: {name, iata, icao, cc}, from: apt, to: apt } or null
export function route(call) {
    call = (call || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(call)) return Promise.resolve(null);
    return lookup(routes, call, `callsign/${call}`, r => {
        const f = r?.flightroute;
        if (!f?.origin || !f?.destination) return null;
        const al = f.airline;
        return { airline: al ? { name: al.name, iata: al.iata || '', icao: al.icao || '', cc: al.country_iso || '' } : null, from: apt(f.origin), to: apt(f.destination) };
    }, ROUTE_TTL);
}
// Cached route only (no upstream call): for the airport lists
export function cachedRoute(call) { return routes.get((call || '').trim().toUpperCase())?.v ?? null; }

// { owner, cc, model } or null
export function owner(hex) {
    hex = (hex || '').toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(hex)) return Promise.resolve(null);
    return lookup(owners, hex, `aircraft/${hex}`, r => {
        const a = r?.aircraft;
        return a ? { owner: a.registered_owner || '', cc: a.registered_owner_country_iso_name || '', model: [a.manufacturer, a.type].filter(Boolean).join(' ') } : null;
    }, AC_TTL);
}
