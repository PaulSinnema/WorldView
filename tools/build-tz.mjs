// Builds compact time zone outlines + one label point per zone from Natural Earth 10m (public domain)
// Run: node tools/build-tz.mjs   → WorldView/wwwroot/data/timezones.json { s, l: rings, lz: zone index per ring, z: [[zone, lon, lat]] }
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL_TZ = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_time_zones.geojson';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'WorldView', 'wwwroot', 'data');
const SCALE = 100, TOL = 0.05; // ≈ 5 km: outlines only

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
// Signed area + centroid of a ring (planar degrees, fine for label placement)
function ringCentroid(r) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
        a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
    }
    return a ? { area: Math.abs(a / 2), x: cx / (3 * a), y: cy / (3 * a) } : { area: 0, x: r[0][0], y: r[0][1] };
}

const r = await fetch(URL_TZ);
if (!r.ok) throw new Error(`time zones: HTTP ${r.status}`);
const features = (await r.json()).features;
const lines = [], lineZone = [], best = new Map(); // zone -> { area, x, y }
for (const f of features) {
    const g = f.geometry, zone = f.properties.zone;
    if (!g || !Number.isFinite(zone)) continue;
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
        const outer = poly[0], c = ringCentroid(outer);
        if (c.area > (best.get(zone)?.area ?? 0)) best.set(zone, c);
        const d = []; let px = 0, py = 0;
        // Closed ring: simplify both halves (endpoints equal would collapse it)
        const h = Math.floor(outer.length / 2), ring = [...simplify(outer.slice(0, h + 1), TOL), ...simplify(outer.slice(h), TOL).slice(1)];
        for (const [x, y] of ring.map(([x, y]) => [Math.round(x * SCALE), Math.round(y * SCALE)])) {
            if (d.length && x === px && y === py) continue;
            d.push(x - px, y - py); px = x; py = y;
        }
        if (d.length >= 6) { lines.push(d); lineZone.push(zone); }
    }
}
const z = [...best].sort((a, b) => a[0] - b[0]).map(([zone, c]) => [zone, Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100]);
// lz: per line (closed ring) the index into z, for filling and highlighting
const zi = new Map(z.map(([zone], i) => [zone, i]));
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'timezones.json'), JSON.stringify({ s: SCALE, l: lines, lz: lineZone.map(v => zi.get(v)), z }));
console.log(`time zones: ${z.length} zones, ${lines.length} lines, ${Math.round(statSync(join(OUT, 'timezones.json')).size / 1024)} KB`);
