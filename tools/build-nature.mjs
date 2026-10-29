// Names of seas, rivers, lakes, mountains and landscapes (Natural Earth 10m, public domain)
// Run: node tools/build-nature.mjs   → WorldView/wwwroot/data/nature.json
// Row: [kind, lon, lat, minZoom, name, {lang: name}?, elevation?]; kind o=sea, r=river, l=lake, p=peak, m=landscape
import { writeFileSync, mkdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'WorldView', 'wwwroot', 'data');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
const LANGS = ['en', 'nl', 'de', 'fr', 'zh'];
const LOCAL = process.env.NE_DIR; // optional folder with the .geojson files

async function load(name) {
    if (LOCAL && existsSync(join(LOCAL, name + '.geojson'))) return JSON.parse(readFileSync(join(LOCAL, name + '.geojson'), 'utf8'));
    const r = await fetch(NE + name + '.geojson');
    if (!r.ok) throw new Error(`${name} HTTP ${r.status}`);
    return r.json();
}
// Case-insensitive property access (regions_polys uses upper case)
const prop = (p, k) => p[k] ?? p[k.toUpperCase()];
const r3 = v => Math.round(v * 1000) / 1000;

function names(p) {
    const base = prop(p, 'name'), o = {};
    for (const l of LANGS) { const v = prop(p, 'name_' + l); if (v && v !== base) o[l] = v; }
    return Object.keys(o).length ? o : null;
}
// Distance from point to ring boundary (degrees, good enough for label placement)
function edgeDist(x, y, ring) {
    let best = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[j], [bx, by] = ring[i], dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-12)));
        const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
        if (d < best) best = d;
    }
    return best;
}
function inside(x, y, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
}
// Label point: interior point farthest from the edge of the largest polygon (coarse grid + refinement)
function labelPoint(g) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    let ring = null, area = -1;
    for (const p of polys) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const a = (x1 - x0) * (y1 - y0);
        if (a > area) { area = a; ring = p[0]; }
    }
    if (!ring) return null;
    // Thin out huge rings for speed
    const step = Math.max(1, Math.floor(ring.length / 600));
    const rr = ring.filter((_, i) => i % step === 0);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of rr) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let best = [(x0 + x1) / 2, (y0 + y1) / 2], bd = -1, w = (x1 - x0) / 2, h = (y1 - y0) / 2, cx = best[0], cy = best[1];
    for (let it = 0; it < 4; it++) {
        const N = 14;
        for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
            const x = cx - w + 2 * w * i / N, y = cy - h + 2 * h * j / N;
            if (!inside(x, y, rr)) continue;
            const d = edgeDist(x, y, rr);
            if (d > bd) { bd = d; best = [x, y]; }
        }
        [cx, cy] = best; w /= 3; h /= 3;
    }
    return best;
}
// Midpoint (by length) of the longest part of a line
function linePoint(g) {
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    let best = null, bl = -1;
    for (const p of parts) {
        let l = 0;
        for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (l > bl) { bl = l; best = p; }
    }
    if (!best) return null;
    let half = bl / 2;
    for (let i = 1; i < best.length; i++) {
        const s = Math.hypot(best[i][0] - best[i - 1][0], best[i][1] - best[i - 1][1]);
        if (half <= s) { const t = half / (s || 1); return [best[i - 1][0] + t * (best[i][0] - best[i - 1][0]), best[i - 1][1] + t * (best[i][1] - best[i - 1][1])]; }
        half -= s;
    }
    return best[0];
}

const rows = [], seen = new Set();
function add(kind, pt, z, p, ele) {
    const name = prop(p, 'name');
    if (!pt || !name || !Number.isFinite(pt[0])) return;
    // Same name close by (rivers in several pieces, duplicate lakes): keep the first
    const key = `${kind}|${name}|${Math.round(pt[0] / 2)}|${Math.round(pt[1] / 2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const row = [kind, r3(pt[0]), r3(pt[1]), Math.round((Number(z) || 8) * 10) / 10, name];
    const n = names(p);
    if (n || ele) row.push(n || 0);
    if (ele) row.push(Math.round(ele));
    rows.push(row);
}

const SKIP_REGION = /^(Island|Island group|Coast|Continent|Lake|Dragons-be-here)$/;
for (const f of (await load('ne_10m_geography_marine_polys')).features) {
    if (f.properties.featurecla === 'reef') continue;
    add('o', labelPoint(f.geometry), f.properties.min_label, f.properties);
}
for (const f of (await load('ne_10m_geography_regions_polys')).features) {
    if (SKIP_REGION.test(prop(f.properties, 'featurecla') || '')) continue;
    add('m', labelPoint(f.geometry), prop(f.properties, 'min_label'), f.properties);
}
for (const f of (await load('ne_10m_geography_regions_elevation_points')).features) {
    const p = f.properties;
    if (!/mountain|spot elevation|pass/.test(p.featurecla)) continue;
    add('p', f.geometry.coordinates, p.min_zoom, p, p.elevation);
}
for (const n of ['ne_10m_lakes', 'ne_10m_lakes_europe'])
    for (const f of (await load(n)).features) add('l', labelPoint(f.geometry), f.properties.min_label ?? f.properties.min_zoom, f.properties);
for (const n of ['ne_10m_rivers_europe', 'ne_10m_rivers_lake_centerlines']) // Europe first: has translations
    for (const f of (await load(n)).features) {
        if (f.properties.featurecla === 'Lake Centerline') continue;
        add('r', linePoint(f.geometry), f.properties.min_label ?? f.properties.min_zoom, f.properties);
    }

// Most important first (lowest zoom), so the client can declutter in order
rows.sort((a, b) => a[3] - b[3]);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'nature.json'), JSON.stringify(rows));
console.log('nature.json', rows.length, 'names', Math.round(statSync(join(OUT, 'nature.json')).size / 1024) + ' KB');
