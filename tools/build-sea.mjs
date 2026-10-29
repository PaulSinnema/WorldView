// Coastlines (Natural Earth 10m, public domain) and maritime boundaries (Marine Regions EEZ boundaries, CC BY 4.0)
// Run: node tools/build-sea.mjs   → WorldView/wwwroot/data/coastline.json, eez.json
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'WorldView', 'wwwroot', 'data');
const SCALE = 1000, TOL = 0.005; // ≈ 500 m

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
// Closed rings collapse in Douglas-Peucker (equal endpoints): simplify both halves
const simplifyAny = (p, tol) => {
    const closed = p.length > 3 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1];
    if (!closed) return simplify(p, tol);
    const h = Math.floor(p.length / 2);
    return [...simplify(p.slice(0, h + 1), tol), ...simplify(p.slice(h), tol).slice(1)];
};
function encode(lines) {
    const out = [];
    for (const p of lines) {
        const d = []; let px = 0, py = 0;
        for (const [x, y] of simplifyAny(p, TOL).map(([x, y]) => [Math.round(x * SCALE), Math.round(y * SCALE)])) {
            if (d.length && x === px && y === py) continue;
            d.push(x - px, y - py); px = x; py = y;
        }
        if (d.length >= 4) out.push(d);
    }
    return out;
}
const parts = g => !g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];

mkdirSync(OUT, { recursive: true });

// Coastlines
const coast = await (await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_coastline.geojson')).json();
writeFileSync(join(OUT, 'coastline.json'), JSON.stringify({ s: SCALE, l: encode(coast.features.flatMap(f => parts(f.geometry))) }));

// Maritime boundaries between states + 200 NM limits; baselines and connection lines skipped
const wfs = 'https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json&typeName=MarineRegions:eez_boundaries';
const eez = await (await fetch(wfs)).json();
const kind = t => /baseline|connection/i.test(t) ? null : /^200 NM$|^12 NM$/i.test(t) ? 'limit' : /unsettled|unilateral/i.test(t) ? 'disputed' : 'agreed';
const groups = { agreed: [], limit: [], disputed: [] };
for (const f of eez.features) { const k = kind(f.properties.line_type || ''); if (k) groups[k].push(...parts(f.geometry)); }
writeFileSync(join(OUT, 'eez.json'), JSON.stringify({ s: SCALE, agreed: encode(groups.agreed), limit: encode(groups.limit), disputed: encode(groups.disputed) }));

for (const f of ['coastline.json', 'eez.json']) console.log(f, Math.round(statSync(join(OUT, f)).size / 1024) + ' KB');
