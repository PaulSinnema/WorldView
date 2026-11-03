// Museums: OpenStreetMap tourism=museum via Overpass (ODbL), worldwide in 30° boxes (dense boxes split automatically)
// row: [id, lon, lat, name, typeIndex, wikidata, website, openingHours, wiki(0/1), country ISO2]
// Boxes are fetched one at a time (nearest to UTC+1 first); server.js writes each box's 5° tiles right away
import { loadCountries, countryOf } from './countries.js';

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
export const TILE = 5, BOX = 30;
const TOP = 6000;
const TYPES = ['art', 'history', 'local', 'science', 'technology', 'natural_history', 'military', 'transport', 'railway', 'open_air', 'archaeological', 'other'];
const r4 = v => Math.round(v * 1e4) / 1e4;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = m => console.log(new Date().toISOString(), m);

// All 30° boxes as [south, west], nearest to UTC+1 (Central Europe, 50°N 15°E) first
export const BOXES = (() => {
    const b = [];
    for (let s = -90; s < 90; s += BOX) for (let w = -180; w < 180; w += BOX) b.push([s, w]);
    const dist = ([s, w]) => { const dl = Math.abs(w + BOX / 2 - 15); return Math.hypot(s + BOX / 2 - 50, Math.min(dl, 360 - dl)); };
    return b.sort((a, c) => dist(a) - dist(c));
})();

export const tileKey = (lon, lat) => `${Math.floor(lon / TILE)}_${Math.floor(lat / TILE)}`;
// Tile key "x_y" lies inside box [s, w]
export function tileInBox(k, s, w) {
    const [x, y] = k.split('_').map(Number);
    return x >= w / TILE && x < (w + BOX) / TILE && y >= s / TILE && y < (s + BOX) / TILE;
}

// One box; null = too big (timeout/size), caller splits it
let mirror = 0, failures = 0;
async function query(s, w, n, e) {
    const q = `[out:json][timeout:120];nwr["tourism"="museum"](${s},${w},${n},${e});out center tags;`;
    for (let attempt = 0; attempt < 9; attempt++) {
        // After each round past all servers: back off (30 s, 60 s)
        if (attempt && attempt % MIRRORS.length === 0) await sleep(30000 * attempt / MIRRORS.length);
        const url = MIRRORS[mirror % MIRRORS.length], host = new URL(url).host;
        let r, j;
        try {
            r = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(180000) });
        } catch (err) { log(`museums: ${host} ${err.message} (${s},${w},${n},${e})`); mirror++; continue; } // network/timeout: next server
        if (r.status === 504) { // query too heavy: caller splits
            log(`museums: ${host} HTTP 504 (${s},${w},${n},${e}), splitting`);
            mirror++;
            if (++failures > 20) throw new Error('Overpass unavailable');
            return null;
        }
        if (!r.ok) { log(`museums: ${host} HTTP ${r.status} (${s},${w},${n},${e})`); mirror++; continue; } // busy/overloaded: next server
        try { j = await r.json(); } catch { mirror++; continue; } // HTML error page
        if (j.remark && /runtime error|timed out|out of memory/i.test(j.remark)) return null;
        return j.elements || [];
    }
    throw new Error('all Overpass servers busy');
}
async function collect(s, w, n, e, depth = 0) {
    const els = await query(s, w, n, e);
    await sleep(2000);
    if (els) return els;
    if (depth >= 4) { log(`museums: ${s},${w},${n},${e} skipped (too dense)`); return []; }
    const ms = (s + n) / 2, mw = (w + e) / 2, out = [];
    for (const [a, b, c, d] of [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]]) out.push(...await collect(a, b, c, d, depth + 1));
    return out;
}

// One 30° box → { tiles: Map key -> rows, count }; throws when Overpass fails
export async function fetchBox(s, w) {
    failures = 0;
    await loadCountries().catch(e => log(`museums: countries ${e.message}`)); // without: country filled in later
    const els = await collect(s, w, s + BOX, w + BOX);
    const seen = new Set(), tiles = new Map();
    let count = 0;
    for (const el of els) {
        const t = el.tags || {}, lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
        const name = t.name || t['name:en'];
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const la = r4(lat), lo = r4(lon);
        if (la < s || la >= s + BOX || lo < w || lo >= w + BOX) continue; // on the edge: belongs to the neighbouring box
        // Deduplicate (node + building of the same museum)
        const id = el.type[0] + el.id, dup = `${name}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
        if (seen.has(id) || seen.has(dup)) continue;
        seen.add(id); seen.add(dup);
        let ti = TYPES.indexOf((t['museum:type'] || t.museum || '').split(';')[0].trim());
        if (ti < 0) ti = TYPES.length - 1;
        const qid = /^Q\d+$/.test(t.wikidata || '') ? t.wikidata : '';
        const k = tileKey(lo, la);
        if (!tiles.has(k)) tiles.set(k, []);
        const cc = countryOf(lo, la, (t['addr:country'] || '').toUpperCase());
        const row = [id, lo, la, name, ti, qid, t.website || t['contact:website'] || '', t.opening_hours || '', qid && t.wikipedia ? 1 : 0];
        if (cc !== null) row.push(cc); // no country map: fillCountries adds it later
        tiles.get(k).push(row);
        count++;
    }
    return { tiles, count };
}

// Missing country fields (tiles from before 1.19.0) → filled in; returns true when rows changed
export async function fillCountries(rows) {
    if (rows.every(r => r.length >= 10)) return false;
    await loadCountries();
    for (const r of rows) if (r.length < 10) { r[8] ??= 0; r[9] = countryOf(r[1], r[2]) ?? ''; }
    return true;
}

// Index from all tiles on disk; top = museums with a Wikipedia article, spread evenly when there are more than TOP
// countries = { ISO2: count }; byCountry = Map ISO2 -> rows (for museums/cc/{ISO2}.json)
export function buildIndex(tiles) {
    let top = [];
    const byCountry = new Map();
    for (const rows of tiles.values()) for (const r of rows) {
        if (r[8]) top.push(r);
        const cc = r[9] || '';
        if (!cc) continue;
        if (!byCountry.has(cc)) byCountry.set(cc, []);
        byCountry.get(cc).push(r);
    }
    if (top.length > TOP) { const step = top.length / TOP; top = Array.from({ length: TOP }, (_, i) => top[Math.floor(i * step)]); }
    const countries = Object.fromEntries([...byCountry].map(([cc, rows]) => [cc, rows.length]));
    return { index: { t: Math.round(Date.now() / 1000), tile: TILE, tiles: [...tiles.keys()], types: TYPES, countries, top }, byCountry };
}
