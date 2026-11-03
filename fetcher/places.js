// Nearest town of a point: GeoNames cities5000 (CC BY 4.0, places with ≥ 5,000 inhabitants), loaded once
import { inflateRawSync } from 'node:zlib';

const URL_ZIP = 'https://download.geonames.org/export/dump/cities5000.zip';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const MAX_KM = 15; // further away: no place
const CELL = 1;    // grid cell in degrees

let grid = null, loading = null;

// First file of a zip archive (stored or deflated), via the central directory
function unzipFirst(buf) {
    let eocd = buf.length - 22;
    while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error('zip: no central directory');
    const cd = buf.readUInt32LE(eocd + 16);
    const method = buf.readUInt16LE(cd + 10), size = buf.readUInt32LE(cd + 20), local = buf.readUInt32LE(cd + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    return method === 0 ? data : inflateRawSync(data);
}

async function load() {
    const r = await fetch(URL_ZIP, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(180000) });
    if (!r.ok) throw new Error(`GeoNames HTTP ${r.status}`);
    const text = unzipFirst(Buffer.from(await r.arrayBuffer())).toString('utf8');
    const g = new Map();
    for (const line of text.split('\n')) {
        const x = line.split('\t');
        if (x.length < 15) continue;
        if (/^PPL[XHQW]$/.test(x[7])) continue; // city districts, historical/abandoned places
        if (/^\S+ \d{1,2}( |$)/.test(x[1])) continue; // arrondissements ("Paris 01 Louvre", "Lyon 03")
        const lat = +x[4], lon = +x[5];
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const k = `${Math.floor(lon / CELL)}_${Math.floor(lat / CELL)}`;
        if (!g.has(k)) g.set(k, []);
        g.get(k).push([lon, lat, x[1]]);
    }
    return g;
}
export async function loadPlaces() {
    if (grid) return;
    loading ??= load().then(g => { grid = g; }).finally(() => { loading = null; });
    await loading;
}

// Name of the nearest town within MAX_KM, '' when none, null when not loaded
export function placeOf(lon, lat) {
    if (!grid) return null;
    const cx = Math.floor(lon / CELL), cy = Math.floor(lat / CELL), kx = Math.cos(lat * Math.PI / 180);
    let best = '', bd = (MAX_KM / 111) ** 2;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const [x, y, name] of grid.get(`${cx + dx}_${cy + dy}`) || []) {
            const d = ((x - lon) * kx) ** 2 + (y - lat) ** 2;
            if (d < bd) { bd = d; best = name; }
        }
    }
    return best;
}
