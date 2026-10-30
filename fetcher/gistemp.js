// Monthly surface temperature anomaly from NASA GISTEMP v4 (1200 km smoothing, 2° grid, no key), rebased to 1991–2020
// Served as tempanom.json: { t, month, w, s, step, nx, ny, v: [°C anomaly ×10, rows from south to north] }
import { gunzipSync } from 'node:zlib';

const URL_NC = 'https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
let lastMod = null, cache = null;

// Minimal netCDF classic (CDF-1/2) header reader: { dims, vars: { name: { dims, type, begin, at } } }
function parseNc(b) {
    if (b.toString('latin1', 0, 3) !== 'CDF') throw new Error('GISTEMP: not netCDF classic');
    const ver = b[3];
    let p = 4;
    const i32 = () => { const v = b.readInt32BE(p); p += 4; return v; };
    const name = () => { const n = i32(), s = b.toString('utf8', p, p + n); p += Math.ceil(n / 4) * 4; return s; };
    const SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 4, 6: 8 };
    const vals = (t, n) => {
        const o = [];
        for (let i = 0; i < n; i++) { const q = p + i * SZ[t]; o.push(t === 1 ? b.readInt8(q) : t === 2 ? b[q] : t === 3 ? b.readInt16BE(q) : t === 4 ? b.readInt32BE(q) : t === 5 ? b.readFloatBE(q) : b.readDoubleBE(q)); }
        p += Math.ceil(n * SZ[t] / 4) * 4;
        return t === 2 ? String.fromCharCode(...o) : o;
    };
    const list = fn => { i32(); const n = i32(), o = []; for (let i = 0; i < n; i++) o.push(fn()); return o; }; // tag + count (absent = 0, 0)
    const attrs = () => Object.fromEntries(list(() => { const k = name(), t = i32(), n = i32(); return [k, vals(t, n)]; }));
    i32(); // numrecs
    const dims = list(() => ({ name: name(), len: i32() }));
    attrs(); // global attributes
    const vars = {};
    for (const v of list(() => {
        const nm = name(), nd = i32(), ids = [];
        for (let i = 0; i < nd; i++) ids.push(i32());
        const at = attrs(), type = i32();
        i32(); // vsize
        const begin = ver === 2 ? (p += 8, Number(b.readBigInt64BE(p - 8))) : i32();
        return { name: nm, dims: ids.map(i => dims[i]), type, begin, at };
    })) vars[v.name] = v;
    return vars;
}

// Re-downloads only when the file changed (monthly update, ≈ 25 MB)
export async function fetchTempAnomaly() {
    const r = await fetch(URL_NC, { headers: { 'User-Agent': UA, ...(cache && lastMod ? { 'If-Modified-Since': lastMod } : {}) } });
    if (r.status === 304 && cache) return { ...cache, t: Math.round(Date.now() / 1000) };
    if (!r.ok) throw new Error(`GISTEMP HTTP ${r.status}`);
    const b = gunzipSync(Buffer.from(await r.arrayBuffer()));
    const V = parseNc(b), T = V.tempanomaly, time = V.time;
    if (!T || !time || T.type !== 3) throw new Error('GISTEMP: unexpected layout');
    const nt = T.dims[0].len, ny = T.dims[1].len, nx = T.dims[2].len, cells = nx * ny;
    const scale = T.at.scale_factor?.[0] ?? 1, fill = T.at._FillValue?.[0] ?? 32767;
    const at = (t, i) => { const v = b.readInt16BE(T.begin + (t * cells + i) * 2); return v === fill ? null : v * scale; };
    const lat0 = b.readFloatBE(V.lat.begin), lon0 = b.readFloatBE(V.lon.begin), step = b.readFloatBE(V.lat.begin + 4) - lat0;
    // Month of each record (days since 1800-01-01)
    const month = t => new Date(Date.UTC(1800, 0, 1) + b.readInt32BE(time.begin + t * 4) * 86400000);
    // Latest month with data (the last record can be empty right after a new month)
    let last = nt - 1;
    for (; last > 0; last--) { let c = 0; for (let i = 0; i < cells; i++) if (at(last, i) != null) c++; if (c > cells / 10) break; }
    const m = month(last).getUTCMonth();
    // Climatology 1991–2020 of that calendar month per cell
    const sum = new Float64Array(cells), cnt = new Uint8Array(cells);
    for (let t = 0; t < nt; t++) {
        const d = month(t), y = d.getUTCFullYear();
        if (y < 1991 || y > 2020 || d.getUTCMonth() !== m) continue;
        for (let i = 0; i < cells; i++) { const v = at(t, i); if (v != null) { sum[i] += v; cnt[i]++; } }
    }
    const v = new Array(cells);
    for (let i = 0; i < cells; i++) { const x = at(last, i); v[i] = x == null || cnt[i] < 20 ? null : Math.round((x - sum[i] / cnt[i]) * 10); }
    lastMod = r.headers.get('last-modified');
    cache = { t: Math.round(Date.now() / 1000), month: month(last).toISOString().slice(0, 7), w: lon0, s: lat0, step, nx, ny, v };
    return cache;
}
