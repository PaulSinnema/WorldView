// Builds compact province/state borders, province labels and cities from Natural Earth 10m (public domain)
// Run: node tools/build-geo.mjs   → writes WorldView/wwwroot/data/*.json
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const SRC = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'WorldView', 'wwwroot', 'data');
const q = v => Math.round(v * 100) / 100; // ~1 km precision

async function read(name) {
    const r = await fetch(SRC + name);
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return (await r.json()).features;
}

// Douglas-Peucker in degrees
function simplify(pts, tol) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
        const [a, b] = stack.pop();
        const [ax, ay] = pts[a], [bx, by] = pts[b];
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
        let max = 0, idx = -1;
        for (let i = a + 1; i < b; i++) {
            const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
            if (d > max) { max = d; idx = i; }
        }
        if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    return pts.filter((_, i) => keep[i]);
}

mkdirSync(OUT, { recursive: true });

// Lines: { s: scale, l: [[dx, dy, ...] delta-encoded integers (degrees * s)] }
// 0.003° tolerance ≈ 300 m: keeps towns near borders on the correct side
const SCALE = 1000;
function encodeLines(features, tol) {
    const out = [];
    for (const f of features) {
        const g = f.geometry;
        if (!g) continue;
        for (const p of g.type === 'LineString' ? [g.coordinates] : g.coordinates) {
            const d = []; let px = 0, py = 0;
            for (const [x, y] of simplify(p, tol).map(([x, y]) => [Math.round(x * SCALE), Math.round(y * SCALE)])) {
                if (d.length && x === px && y === py) continue;
                d.push(x - px, y - py); px = x; py = y;
            }
            if (d.length >= 4) out.push(d);
        }
    }
    return { s: SCALE, l: out };
}
writeFileSync(join(OUT, 'admin0-lines.json'), JSON.stringify(encodeLines(await read('ne_10m_admin_0_boundary_lines_land.geojson'), 0.003)));
writeFileSync(join(OUT, 'admin1-lines.json'), JSON.stringify(encodeLines(await read('ne_10m_admin_1_states_provinces_lines.geojson'), 0.003)));

// Province labels: [name, lon, lat, scalerank] (tiniest units dropped)
const labels = (await read('ne_10m_admin_1_label_points.geojson'))
    .filter(f => f.geometry && f.properties.name && (f.properties.scalerank ?? 10) <= 10)
    .map(f => [f.properties.name, q(f.geometry.coordinates[0]), q(f.geometry.coordinates[1]), f.properties.scalerank ?? 10]);
writeFileSync(join(OUT, 'admin1-labels.json'), JSON.stringify(labels));

// Cities: GeoNames cities1000 (CC BY 4.0), all places with 1000+ inhabitants
// Row: [name, lon, lat, population, capital 2=national 1=province 0=none]
const zip = Buffer.from(await (await fetch('https://download.geonames.org/export/dump/cities1000.zip')).arrayBuffer());
// Skip neighbourhoods (PPLX) and historical/abandoned/destroyed places
const SKIP = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']);
const rows = unzipFirst(zip).toString('utf8').split('\n').map(l => l.split('\t')).filter(c => c.length > 14 && c[1] && !SKIP.has(c[7]));
// Province names (admin1) and time zones as shared lookup tables
const adminNames = new Map();
for (const l of (await (await fetch('https://download.geonames.org/export/dump/admin1CodesASCII.txt')).text()).split('\n')) {
    const [code, name] = l.split('\t');
    if (code && name) adminNames.set(code, name);
}
const admins = [], adminIdx = new Map(), tzs = [], tzIdx = new Map();
const idxOf = (map, list, v) => { if (!v) return -1; if (!map.has(v)) { map.set(v, list.length); list.push(v); } return map.get(v); };
// Row: [name, lon, lat, pop, cap, geonameId, country, adminIdx, elevation, tzIdx]
const cities = rows.map(c => [c[1], Math.round(+c[5] * 1000) / 1000, Math.round(+c[4] * 1000) / 1000, +c[14] || 0,
    c[7] === 'PPLC' ? 2 : c[7] === 'PPLA' ? 1 : 0, +c[0], c[8],
    idxOf(adminIdx, admins, adminNames.get(`${c[8]}.${c[10]}`)), c[15] ? +c[15] : (+c[16] > -9999 ? +c[16] : null), idxOf(tzIdx, tzs, c[17])])
    .sort((a, b) => b[3] - a[3]);

// Overview: big cities and capitals, always loaded
const top = cities.filter(c => c[3] >= 300000 || c[4] === 2);
// Detail: 5° tiles, loaded when zoomed in
const TILE = 5, tiles = new Map();
for (const c of cities) {
    if (c[3] >= 300000 || c[4] === 2) continue;
    const k = `${Math.floor(c[1] / TILE)}_${Math.floor(c[2] / TILE)}`;
    if (!tiles.has(k)) tiles.set(k, []);
    tiles.get(k).push(c);
}
const cdir = join(OUT, 'cities');
mkdirSync(cdir, { recursive: true });
for (const [k, list] of tiles) writeFileSync(join(cdir, `${k}.json`), JSON.stringify(list));
writeFileSync(join(OUT, 'cities-top.json'), JSON.stringify({ tile: TILE, tiles: [...tiles.keys()], admins, tzs, top }));
console.log(`cities ${cities.length}, top ${top.length}, tiles ${tiles.size}`);

for (const f of ['admin0-lines.json', 'admin1-lines.json', 'admin1-labels.json', 'cities-top.json'])
    console.log(f, Math.round(statSync(join(OUT, f)).size / 1024) + ' KB');

// Minimal ZIP reader: first entry via central directory
function unzipFirst(buf) {
    let e = buf.length - 22;
    while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
    const cd = buf.readUInt32LE(e + 16);
    const method = buf.readUInt16LE(cd + 10), size = buf.readUInt32LE(cd + 20), off = buf.readUInt32LE(cd + 42);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = buf.subarray(start, start + size);
    return method === 8 ? inflateRawSync(data) : data;
}
