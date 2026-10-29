// Copernicus CAMS grids via the Atmosphere Data Store (ADS): total ozone (DU), XCO2 (ppm), XCH4 (ppb); whole Earth incl. polar night
// Served as ozone.json / co2.json / ch4.json: { t, valid, w, s, step, nx, ny, v: [rows from south to north, west to east] }
// Needs a free ADS account (personal access token) and the dataset licence accepted on its download page
const ADS = 'https://ads.atmosphere.copernicus.eu/api/retrieve/v1';
const DATASET = 'cams-global-atmospheric-composition-forecasts';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const DU = 2.1415e-5; // kg/m² per Dobson unit
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Yesterday's 00 UTC run, +24 h = today 00 UTC (runs are complete well within a day)
const runDate = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const validOf = run => `${new Date(Date.parse(run) + 86400000).toISOString().slice(0, 10)}T00:00Z`;
export async function fetchOzone(key) {
    const run = runDate();
    const g = await camsGrib(key, DATASET, { variable: ['total_column_ozone'], date: [`${run}/${run}`], time: ['00:00'], leadtime_hour: ['24'], type: ['forecast'], data_format: 'grib' });
    return { t: Math.round(Date.now() / 1000), valid: validOf(run), ...toGrid(g, v => Math.round(v / DU)) };
}
// Greenhouse gases (CAMS global greenhouse gas forecasts): column-mean mole fraction, XCO2 in ppm and XCH4 in ppb
const GHG = 'cams-global-greenhouse-gas-forecasts';
// Unit check: the data may come as mole fraction (mol/mol) or already in ppm/ppb
const toUnit = (g, expect) => { const s = [...g.values].filter(Number.isFinite).sort((a, b) => a - b); const med = s[s.length >> 1] || 0; let f = 1; while (med > 0 && med * f < expect / 30 && f < 1e12) f *= 1000; return f; };
async function fetchGhg(key, variable, expect, round) {
    const run = runDate();
    const g = await camsGrib(key, GHG, { variable: [variable], date: [`${run}/${run}`], leadtime_hour: ['24'], data_format: 'grib' });
    const f = toUnit(g, expect);
    return { t: Math.round(Date.now() / 1000), valid: validOf(run), ...toGrid(g, v => round(v * f)) };
}
export const fetchCo2 = key => fetchGhg(key, 'co2_column_mean_molar_fraction', 420, v => Math.round(v * 10) / 10); // ppm
export const fetchCh4 = key => fetchGhg(key, 'ch4_column_mean_molar_fraction', 1900, v => Math.round(v)); // ppb

// Submit an ADS request, wait for the job, download the GRIB and decode it
const camsGrib = async (key, dataset, inputs) => decodeGrib(await requestData(ADS, key, dataset, inputs));
// Copernicus data store request (ADS and CDS share this API): submit, poll the job, download the result
export async function requestData(base, key, dataset, inputs) {
    const headers = { 'PRIVATE-TOKEN': key, 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' };
    let r = await fetch(`${base}/processes/${dataset}/execution`, { method: 'POST', headers, body: JSON.stringify({ inputs }) });
    if (!r.ok) throw new Error(`ADS submit HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    let job = await r.json();
    const jobUrl = job.links?.find(l => l.rel === 'monitor')?.href || `${base}/jobs/${job.jobID}`;
    // Queue: poll up to 30 min
    for (let i = 0; i < 180 && job.status !== 'successful'; i++) {
        if (['failed', 'rejected', 'dismissed', 'deleted'].includes(job.status)) throw new Error(`ADS job ${job.status}`);
        await sleep(10000);
        r = await fetch(jobUrl, { headers });
        if (!r.ok) throw new Error(`ADS job HTTP ${r.status}`);
        job = await r.json();
    }
    if (job.status !== 'successful') throw new Error('ADS job timeout');
    r = await fetch(`${jobUrl}/results`, { headers });
    if (!r.ok) throw new Error(`ADS results HTTP ${r.status}`);
    const href = new URL((await r.json())?.asset?.value?.href, jobUrl).href;
    // Download link points at storage: no token needed there
    r = await fetch(href, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`ADS download HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
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

// Minimal GRIB decoder (edition 1 and 2, regular lat/lon, simple packing, no bitmap): first message only
// Returns { ni, nj, la1, lo1, di, dj (signed: direction of rows), values }
const sm = (v, bits) => (v & (1 << (bits - 1))) ? -(v & ((1 << (bits - 1)) - 1)) : v; // sign-magnitude
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
            if (b.readUInt16BE(p + 9) !== 0) throw new Error('GRIB2 packing is not simple');
            pack = { n: b.readUInt32BE(p + 5), R: b.readFloatBE(p + 11), E: sm(b.readUInt16BE(p + 15), 16), D: sm(b.readUInt16BE(p + 17), 16), nbits: b[p + 19] };
        } else if (sec === 6 && b[p + 5] !== 255) throw new Error('GRIB2 bitmap not supported');
        else if (sec === 7) {
            if (!grid || !pack) throw new Error('GRIB2 sections missing');
            return { ...grid, values: unpack(b, p + 5, pack.n, pack.nbits, pack.R, pack.E, pack.D), end };
        }
        p += len;
    }
    throw new Error('GRIB2 data section missing');
}
// All messages in a file, one at a time (keeps memory low): fn(field) per message
export function eachGrib(b, fn) {
    let from = 0, n = 0;
    while (b.indexOf('GRIB', from) >= 0) { const g = decodeGrib(b, from); fn(g); from = g.end; n++; }
    return n;
}
