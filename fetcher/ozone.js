// Total ozone column (DU) from the NOAA GFS analysis via NOMADS (no key); whole Earth incl. polar night (model assimilates satellite data)
// Served as ozone.json: { t, valid, w, s, step, nx, ny, v: [rows from south to north, west to east] }
const NOMADS = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_1p00.pl';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';

// Latest GFS run that is on the server (runs every 6 h, published ≈ 4 h later): try newest first
export async function fetchOzone() {
    let err;
    for (let back = 4; back <= 28; back += 6) {
        const run = new Date(Date.now() - back * 3600000);
        run.setUTCHours(Math.floor(run.getUTCHours() / 6) * 6, 0, 0, 0);
        const ymd = run.toISOString().slice(0, 10).replace(/-/g, ''), hh = String(run.getUTCHours()).padStart(2, '0');
        const url = `${NOMADS}?dir=%2Fgfs.${ymd}%2F${hh}%2Fatmos&file=gfs.t${hh}z.pgrb2.1p00.f000&var_TOZNE=on&all_lev=on`;
        try {
            const r = await fetch(url, { headers: { 'User-Agent': UA } });
            if (!r.ok) throw new Error(`GFS ${ymd}/${hh} HTTP ${r.status}`);
            const g = decodeGrib(Buffer.from(await r.arrayBuffer()));
            return { t: Math.round(Date.now() / 1000), valid: run.toISOString().slice(0, 16) + 'Z', ...toGrid(g, v => Math.round(v)) };
        } catch (e) { err = e; } // not published yet: previous run
    }
    throw err;
}

// Resample the model grid to 1° cell centres (nearest point), values converted by conv
export function toGrid(g, conv) {
    const nx = 360, ny = 180, w = -179.5, s = -89.5, v = new Array(nx * ny);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const lat = s + y, lon = w + x;
        const j = Math.round((lat - g.la1) / g.dj), i = Math.round((((lon - g.lo1) % 360) + 360) % 360 / g.di) % g.ni;
        const val = j >= 0 && j < g.nj ? g.values[j * g.ni + i] : null;
        v[y * nx + x] = val == null || !Number.isFinite(val) ? null : conv(val);
    }
    return { w, s, step: 1, nx, ny, v };
}

// Minimal GRIB decoder (edition 1 and 2, regular lat/lon, simple or complex packing, no bitmap): first message from 'from'
// Returns { ni, nj, la1, lo1, di, dj (signed: direction of rows), values, end }
const sm = (v, bits) => v >= 2 ** (bits - 1) ? -(v - 2 ** (bits - 1)) : v; // sign-magnitude
function ibmFloat(b, o) {
    const sign = b[o] & 0x80 ? -1 : 1, exp = (b[o] & 0x7f) - 64, mant = (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
    return sign * mant / 2 ** 24 * 16 ** exp;
}
function unpack(b, o, n, nbits, R, E, D) {
    const out = new Float64Array(n), f = 2 ** E, d = 10 ** D;
    let bit = o * 8;
    for (let k = 0; k < n; k++) {
        let x = 0;
        for (let q = 0; q < nbits; q++, bit++) x = x * 2 + ((b[bit >> 3] >> (7 - (bit & 7))) & 1);
        out[k] = (R + x * f) / d;
    }
    return out;
}
// Bit stream reader (MSB first)
function bits(b, o) {
    let bit = o * 8;
    return {
        read(n) { let x = 0; for (let q = 0; q < n; q++, bit++) x = x * 2 + ((b[bit >> 3] >> (7 - (bit & 7))) & 1); return x; },
        align() { bit = Math.ceil(bit / 8) * 8; }
    };
}
// GRIB2 complex packing (template 5.2) and with spatial differencing (5.3); s5 = section 5 start, o = data start
function unpackComplex(b, s5, o, n) {
    const tmpl = b.readUInt16BE(s5 + 9), R = b.readFloatBE(s5 + 11), E = sm(b.readUInt16BE(s5 + 15), 16), D = sm(b.readUInt16BE(s5 + 17), 16), nb = b[s5 + 19];
    if (b[s5 + 22]) throw new Error('GRIB2 missing values not supported');
    const NG = b.readUInt32BE(s5 + 31), wRef = b[s5 + 35], wBits = b[s5 + 36], lRef = b.readUInt32BE(s5 + 37), lInc = b[s5 + 41], lLast = b.readUInt32BE(s5 + 42), lBits = b[s5 + 46];
    const order = tmpl === 3 ? b[s5 + 47] : 0, oct = tmpl === 3 ? b[s5 + 48] : 0;
    const r = bits(b, o), ext = [];
    for (let k = 0; k < (order ? order + 1 : 0); k++) ext.push(sm(r.read(oct * 8), oct * 8)); // first values + minimum
    const refs = new Array(NG), ws = new Array(NG), ls = new Array(NG);
    for (let g = 0; g < NG; g++) refs[g] = r.read(nb);
    r.align();
    for (let g = 0; g < NG; g++) ws[g] = wRef + r.read(wBits);
    r.align();
    for (let g = 0; g < NG; g++) ls[g] = lRef + r.read(lBits) * lInc;
    r.align();
    ls[NG - 1] = lLast;
    const X = new Float64Array(n);
    let k = 0;
    for (let g = 0; g < NG; g++) for (let j = 0; j < ls[g] && k < n; j++) X[k++] = refs[g] + (ws[g] ? r.read(ws[g]) : 0);
    if (k !== n) throw new Error(`GRIB2 complex packing: ${k} of ${n} values`);
    if (order === 1) { X[0] = ext[0]; for (let i = 1; i < n; i++) X[i] += ext[1] + X[i - 1]; }
    if (order === 2) { X[0] = ext[0]; X[1] = ext[1]; for (let i = 2; i < n; i++) X[i] += ext[2] + 2 * X[i - 1] - X[i - 2]; }
    const f = 2 ** E, d = 10 ** D;
    for (let i = 0; i < n; i++) X[i] = (R + X[i] * f) / d;
    return X;
}
export function decodeGrib(b, from = 0) {
    const start = b.indexOf('GRIB', from);
    if (start < 0) throw new Error('no GRIB data');
    const ed = b[start + 7];
    const u24 = o => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
    const end = ed === 1 ? start + u24(start + 4) : start + Number(b.readBigUInt64BE(start + 8)); // message end (next message)
    if (ed === 1) {
        let p = start + 8;
        const pdsLen = u24(p), flag = b[p + 7], D = sm(b.readUInt16BE(p + 26), 16);
        if (!(flag & 0x80)) throw new Error('GRIB1 without grid section');
        if (flag & 0x40) throw new Error('GRIB1 bitmap not supported');
        p += pdsLen;
        const gdsLen = u24(p);
        if (b[p + 5] !== 0) throw new Error('GRIB1 grid is not lat/lon');
        const ni = b.readUInt16BE(p + 6), nj = b.readUInt16BE(p + 8);
        const la1 = sm(u24(p + 10), 24) / 1000, lo1 = sm(u24(p + 13), 24) / 1000;
        const di = b.readUInt16BE(p + 23) / 1000, dj = b.readUInt16BE(p + 25) / 1000, scan = b[p + 27];
        p += gdsLen;
        const E = sm(b.readUInt16BE(p + 4), 16), R = ibmFloat(b, p + 6), nbits = b[p + 10];
        return { ni, nj, la1, lo1, di, dj: scan & 0x40 ? dj : -dj, values: unpack(b, p + 11, ni * nj, nbits, R, E, D), end };
    }
    if (ed !== 2) throw new Error(`GRIB edition ${ed}`);
    let p = start + 16, grid = null, pack = null;
    while (p < b.length - 4 && b.toString('latin1', p, p + 4) !== '7777') {
        const len = b.readUInt32BE(p), sec = b[p + 4];
        if (sec === 3) {
            if (b.readUInt16BE(p + 12) !== 0) throw new Error('GRIB2 grid is not lat/lon');
            const t = p + 14; // template 3.0 (octet 15 = index 14)
            const ni = b.readUInt32BE(t + 16), nj = b.readUInt32BE(t + 20);
            const la1 = sm(b.readUInt32BE(t + 32), 32) / 1e6, lo1 = sm(b.readUInt32BE(t + 36), 32) / 1e6;
            const di = b.readUInt32BE(t + 49) / 1e6, dj = b.readUInt32BE(t + 53) / 1e6, scan = b[t + 57];
            grid = { ni, nj, la1, lo1, di, dj: scan & 0x40 ? dj : -dj };
        } else if (sec === 5) {
            const tmpl = b.readUInt16BE(p + 9);
            if (![0, 2, 3].includes(tmpl)) throw new Error(`GRIB2 packing template ${tmpl} not supported`);
            pack = { s5: p, tmpl, n: b.readUInt32BE(p + 5), R: b.readFloatBE(p + 11), E: sm(b.readUInt16BE(p + 15), 16), D: sm(b.readUInt16BE(p + 17), 16), nbits: b[p + 19] };
        } else if (sec === 6 && b[p + 5] !== 255) throw new Error('GRIB2 bitmap not supported');
        else if (sec === 7) {
            if (!grid || !pack) throw new Error('GRIB2 sections missing');
            const values = pack.tmpl ? unpackComplex(b, pack.s5, p + 5, pack.n) : unpack(b, p + 5, pack.n, pack.nbits, pack.R, pack.E, pack.D);
            return { ...grid, values, end };
        }
        p += len;
    }
    throw new Error('GRIB2 data section missing');
}
