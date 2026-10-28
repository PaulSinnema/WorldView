// Detailed land borders from geoBoundaries CGAZ ADM0 (CC BY 4.0), tiled per 5°
// Run: node --max-old-space-size=6000 tools/build-borders.mjs   → WorldView/wwwroot/data/borders/*.json
import { createReadStream, createWriteStream, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL_CGAZ = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM0.geojson';
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'WorldView', 'wwwroot', 'data');
const src = join(tmpdir(), 'cgaz-adm0.geojson');

// ~400 MB source: stream to a temp file
const res = await fetch(URL_CGAZ);
if (!res.ok) throw new Error(`CGAZ HTTP ${res.status}`);
await pipeline(Readable.fromWeb(res.body), createWriteStream(src));

const Q = 1e6;              // vertex matching grid (~0.1 m)
const SIMPLIFY = 0.0004;    // ≈ 40 m
const SCALE = 10000;        // output precision ≈ 10 m
const TILE = 5;

// Read one country per line (ogr2ogr GeoJSON layout)
const countries = [];
const rl = createInterface({ input: createReadStream(src), crlfDelay: Infinity });
for await (let line of rl) {
    line = line.trim();
    if (!line.startsWith('{ "type": "Feature"')) continue;
    if (line.endsWith(',')) line = line.slice(0, -1);
    const f = JSON.parse(line), g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const rings = [];
    for (const p of polys) for (const r of p) rings.push(r.map(([x, y]) => [Math.round(x * Q), Math.round(y * Q)]));
    countries.push({ id: f.properties.shapeGroup, rings });
}
console.log('countries', countries.length);

// Edge -> owning country index, or -1 when shared by two countries (= land border)
const ek = (a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) ? `${a[0]},${a[1]},${b[0]},${b[1]}` : `${b[0]},${b[1]},${a[0]},${a[1]}`;
const edges = new Map();
countries.forEach((c, ci) => {
    for (const r of c.rings) for (let i = 1; i < r.length; i++) {
        const k = ek(r[i - 1], r[i]);
        const v = edges.get(k);
        if (v === undefined) edges.set(k, ci);
        else if (v !== ci && v !== -1) edges.set(k, -1);
    }
});

// Runs of consecutive shared edges; each edge emitted once
const done = new Set(), runs = [];
countries.forEach(c => {
    for (const r of c.rings) {
        let run = null;
        for (let i = 1; i < r.length; i++) {
            const k = ek(r[i - 1], r[i]);
            if (edges.get(k) === -1 && !done.has(k)) {
                done.add(k);
                if (!run) run = [r[i - 1]];
                run.push(r[i]);
            } else if (run) { runs.push(run); run = null; }
        }
        if (run) runs.push(run);
    }
});
console.log('border runs', runs.length);

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

// Split runs over 5° tiles (segment crossing a tile edge goes into both: no gaps)
const tiles = new Map();
const tileOf = ([x, y]) => `${Math.floor(x / TILE)}_${Math.floor(y / TILE)}`;
const emit = (k, pts) => {
    if (pts.length < 2) return;
    const d = []; let px = 0, py = 0;
    for (const [x, y] of pts) {
        const ix = Math.round(x * SCALE), iy = Math.round(y * SCALE);
        if (d.length && ix === px && iy === py) continue;
        d.push(ix - px, iy - py); px = ix; py = iy;
    }
    if (d.length < 4) return;
    if (!tiles.has(k)) tiles.set(k, []);
    tiles.get(k).push(d);
};
for (const run of runs) {
    const pts = simplify(run.map(([x, y]) => [x / Q, y / Q]), SIMPLIFY);
    let cur = [pts[0]], k = tileOf(pts[0]);
    for (let i = 1; i < pts.length; i++) {
        const t = tileOf(pts[i]);
        cur.push(pts[i]);
        if (t !== k) { emit(k, cur); cur = [pts[i - 1], pts[i]]; k = t; }
    }
    emit(k, cur);
}

const dir = join(out, 'borders');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
let total = 0;
for (const [k, l] of tiles) { const s = JSON.stringify({ s: SCALE, l }); total += s.length; writeFileSync(join(dir, `${k}.json`), s); }
writeFileSync(join(out, 'borders-index.json'), JSON.stringify({ tile: TILE, tiles: [...tiles.keys()] }));
console.log('tiles', tiles.size, 'total', Math.round(total / 1024) + ' KB');
rmSync(src, { force: true });
