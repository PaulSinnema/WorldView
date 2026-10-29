// Detailed coastlines from OpenStreetMap (osmdata.openstreetmap.de, ODbL), tiled per 5°
// Run: node --max-old-space-size=6000 tools/build-coast.mjs   → WorldView/wwwroot/data/coast/*.json + coast-index.json
// Streams the ~900 MB zip: download to a temp file, inflate the .shp entry and parse PolyLine records on the fly
import { createWriteStream, createReadStream, openSync, readSync, fstatSync, closeSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createInflateRaw } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL_ZIP = 'https://osmdata.openstreetmap.de/download/coastlines-split-4326.zip';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'WorldView', 'wwwroot', 'data');
const TMP = join(tmpdir(), 'osm-coastlines.zip');
const TOL = 0.0008;      // ≈ 80 m
const MIN_EXTENT = 0.01; // skip islets smaller than ≈ 1 km
const SCALE = 10000, TILE = 5;

if (!process.argv.includes('--keep')) {
    const r = await fetch(URL_ZIP);
    if (!r.ok) throw new Error(`coastlines HTTP ${r.status}`);
    await pipeline(Readable.fromWeb(r.body), createWriteStream(TMP));
}

// Find the .shp entry via the central directory
const fd = openSync(TMP, 'r'), size = fstatSync(fd).size;
const tail = Buffer.alloc(Math.min(size, 70000)); readSync(fd, tail, 0, tail.length, size - tail.length);
const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16);
const cd = Buffer.alloc(cdSize); readSync(fd, cd, 0, cdSize, cdOff);
let entry = null;
for (let p = 0; p < cd.length && cd.readUInt32LE(p) === 0x02014b50;) {
    const method = cd.readUInt16LE(p + 10), csize = cd.readUInt32LE(p + 20);
    const nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32);
    const off = cd.readUInt32LE(p + 42), name = cd.toString('utf8', p + 46, p + 46 + nlen);
    if (name.endsWith('.shp')) entry = { method, csize, off, name };
    p += 46 + nlen + xlen + clen;
}
if (!entry) throw new Error('no .shp in zip');
const lh = Buffer.alloc(30); readSync(fd, lh, 0, 30, entry.off); closeSync(fd);
const start = entry.off + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
console.log('shp', entry.name, Math.round(entry.csize / 1e6) + ' MB compressed');

function simplify(pts, tol) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
        const [a, b] = stack.pop();
        const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
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

const tiles = new Map();
const tileOf = ([x, y]) => `${Math.floor(x / TILE)}_${Math.floor(y / TILE)}`;
const emit = (k, pts) => {
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
let lines = 0, kept = 0;
function addLine(pts) {
    lines++;
    // Closed rings = whole islands: skip tiny ones. Open lines are pieces of longer coasts: always keep
    const closed = pts.length > 3 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1];
    if (closed) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 - x0 < MIN_EXTENT && y1 - y0 < MIN_EXTENT) return;
    }
    kept++;
    // Closed rings collapse in Douglas-Peucker: simplify both halves
    const h = Math.floor(pts.length / 2);
    const s = closed ? [...simplify(pts.slice(0, h + 1), TOL), ...simplify(pts.slice(h), TOL).slice(1)] : simplify(pts, TOL);
    // Split over 5° tiles (shared vertex at a tile change: no gaps)
    let cur = [s[0]], k = tileOf(s[0]);
    for (let i = 1; i < s.length; i++) {
        const t = tileOf(s[i]);
        cur.push(s[i]);
        if (t !== k) { emit(k, cur); cur = [s[i - 1], s[i]]; k = t; }
    }
    emit(k, cur);
}

// Shapefile stream parser: 100-byte header, then records [num BE, len BE (16-bit words)] + content
let buf = Buffer.alloc(0), headerDone = false;
const inflate = createReadStream(TMP, { start, end: start + entry.csize - 1 }).pipe(entry.method === 8 ? createInflateRaw() : new (await import('node:stream')).PassThrough());
for await (const chunk of inflate) {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    let p = 0;
    if (!headerDone) { if (buf.length < 100) continue; p = 100; headerDone = true; }
    while (buf.length - p >= 8) {
        const len = buf.readInt32BE(p + 4) * 2;
        if (buf.length - p - 8 < len) break;
        const c = p + 8;
        if (buf.readInt32LE(c) === 3) { // PolyLine
            const nParts = buf.readInt32LE(c + 36), nPts = buf.readInt32LE(c + 40);
            const partsAt = c + 44, ptsAt = partsAt + nParts * 4;
            for (let i = 0; i < nParts; i++) {
                const a = buf.readInt32LE(partsAt + i * 4), b = i + 1 < nParts ? buf.readInt32LE(partsAt + (i + 1) * 4) : nPts;
                const pts = [];
                for (let j = a; j < b; j++) pts.push([buf.readDoubleLE(ptsAt + j * 16), buf.readDoubleLE(ptsAt + j * 16 + 8)]);
                if (pts.length > 1) addLine(pts);
            }
        }
        p = c + len;
    }
    buf = buf.subarray(p);
}

const dir = join(OUT, 'coast');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
let total = 0;
for (const [k, l] of tiles) { const s = JSON.stringify({ s: SCALE, l }); total += s.length; writeFileSync(join(dir, `${k}.json`), s); }
writeFileSync(join(OUT, 'coast-index.json'), JSON.stringify({ tile: TILE, tiles: [...tiles.keys()] }));
console.log(`lines ${lines}, kept ${kept}, tiles ${tiles.size}, total ${Math.round(total / 1024 / 1024)} MB`);
if (!process.argv.includes('--keep')) rmSync(TMP, { force: true });
