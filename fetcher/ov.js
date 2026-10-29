// Dutch public transport (bus/tram/metro/ferry) via OVapi GTFS-Realtime + static GTFS (routes only)
// row: [id, line, lat, lon, speedMs, heading, operator, mode, tPos, vehicle]
import { inflateRawSync } from 'node:zlib';

const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const RT_URL = 'https://gtfs.ovapi.nl/nl/vehiclePositions.pb';
const GTFS_URL = 'https://gtfs.ovapi.nl/nl/gtfs-nl.zip';
const r5 = v => Math.round(v * 1e5) / 1e5;

// ---------- minimal protobuf reader ----------
function* fields(buf, start = 0, end = buf.length) {
    let p = start;
    const varint = () => {
        let v = 0, mul = 1, b;
        do { b = buf[p++]; v += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80);
        return v;
    };
    while (p < end) {
        const key = varint(), no = Math.floor(key / 8), wt = key & 7;
        if (wt === 0) yield [no, wt, varint()];
        else if (wt === 1) { yield [no, wt, buf.readDoubleLE(p)]; p += 8; }
        else if (wt === 2) { const len = varint(); yield [no, wt, [p, p + len]]; p += len; }
        else if (wt === 5) { yield [no, wt, buf.readFloatLE(p)]; p += 4; }
        else throw new Error(`protobuf wire type ${wt}`);
    }
}
const str = (buf, [a, b]) => buf.toString('utf8', a, b);
function msg(buf, range, spec) {
    // spec: field number -> [name, kind]; kind: 's' string, 'n' number, object = nested spec
    const out = {};
    for (const [no, , v] of fields(buf, range[0], range[1])) {
        const s = spec[no];
        if (!s) continue;
        const [name, kind] = s;
        out[name] = typeof kind === 'object' ? msg(buf, v, kind) : kind === 's' ? str(buf, v) : v;
    }
    return out;
}
const VEHICLE_POSITION = {
    1: ['trip', { 1: ['tripId', 's'], 5: ['routeId', 's'] }],
    2: ['pos', { 1: ['lat', 'n'], 2: ['lon', 'n'], 3: ['bearing', 'n'], 5: ['speed', 'n'] }],
    5: ['ts', 'n'],
    8: ['veh', { 1: ['id', 's'], 2: ['label', 's'] }]
};

// ---------- static GTFS: read only routes.txt/agency.txt from the 200 MB zip via HTTP ranges ----------
async function range(url, from, to) {
    const r = await fetch(url, { headers: { Range: `bytes=${from}-${to}`, 'User-Agent': UA } });
    if (r.status !== 206) throw new Error(`range HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
}
async function zipEntries(url, names) {
    const head = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
    const size = Number(head.headers.get('content-length'));
    const tail = await range(url, Math.max(0, size - 65557), size - 1);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error('zip: no EOCD');
    const cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16);
    const cd = await range(url, cdOff, cdOff + cdSize - 1);
    const out = {};
    for (let p = 0; p < cd.length && cd.readUInt32LE(p) === 0x02014b50;) {
        const method = cd.readUInt16LE(p + 10), csize = cd.readUInt32LE(p + 20);
        const nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32);
        const off = cd.readUInt32LE(p + 42), name = cd.toString('utf8', p + 46, p + 46 + nlen);
        p += 46 + nlen + xlen + clen;
        if (!names.includes(name)) continue;
        const lh = await range(url, off, off + 29);
        const start = off + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
        const data = await range(url, start, start + csize - 1);
        out[name] = (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    return out;
}
function csv(text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
    const split = l => { const r = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { r.push(cur); cur = ''; } else cur += ch; } r.push(cur); return r; };
    const head = split(lines[0]);
    return lines.slice(1).map(l => { const v = split(l); return Object.fromEntries(head.map((h, i) => [h, v[i] ?? ''])); });
}

const MODES = { 0: 'tram', 1: 'metro', 2: 'train', 3: 'bus', 4: 'ferry', 900: 'tram', 401: 'metro', 700: 'bus', 1000: 'ferry', 1200: 'ferry' };
let routes = new Map(); // route_id -> [line, operator, mode]
export async function loadOvRoutes() {
    const f = await zipEntries(GTFS_URL, ['routes.txt', 'agency.txt']);
    const agency = new Map(csv(f['agency.txt'] || '').map(a => [a.agency_id, a.agency_name]));
    routes = new Map(csv(f['routes.txt'] || '').map(r => [r.route_id,
        [r.route_short_name || r.route_long_name || '', agency.get(r.agency_id) || r.agency_id || '', MODES[r.route_type] || 'bus']]));
    return routes.size;
}

// ---------- realtime ----------
const prev = new Map(); // id -> { lat, lon, t, h, v }
export async function fetchOv() {
    const r = await fetch(RT_URL, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`OVapi HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const rows = [], now = Math.round(Date.now() / 1000);
    for (const [no, , v] of fields(buf)) {
        if (no !== 2) continue; // FeedMessage.entity
        let vp = null;
        for (const [eno, , ev] of fields(buf, v[0], v[1])) if (eno === 4) vp = msg(buf, ev, VEHICLE_POSITION);
        if (!vp?.pos || !Number.isFinite(vp.pos.lat) || !vp.pos.lat) continue;
        const rt = routes.get(vp.trip?.routeId) || ['', '', 'bus'];
        if (rt[2] === 'train') continue; // trains come from the train layer
        const id = `ov-${vp.veh?.id || vp.trip?.tripId}`, t = vp.ts || now;
        const { lat, lon } = vp.pos;
        // Missing speed/bearing: derive from the previous fix
        let h = Number.isFinite(vp.pos.bearing) ? vp.pos.bearing : null, s = Number.isFinite(vp.pos.speed) ? vp.pos.speed : null;
        const p = prev.get(id);
        if (p && t > p.t) {
            const dLat = (lat - p.lat) * 111320, dLon = (lon - p.lon) * 111320 * Math.cos(lat * Math.PI / 180), d = Math.hypot(dLat, dLon);
            if (d > 15) { h ??= (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360; s ??= Math.min(40, d / (t - p.t)); }
            else s ??= 0;
        }
        h ??= p?.h ?? null; s ??= p?.v ?? 0;
        if (!p || t > p.t) prev.set(id, { lat, lon, t, h, v: s });
        rows.push([id, rt[0], r5(lat), r5(lon), h != null ? Math.round(s * 10) / 10 : 0, h != null ? Math.round(h) : 0,
            rt[1], rt[2], t, vp.veh?.label || vp.veh?.id || '']);
    }
    const ids = new Set(rows.map(x => x[0]));
    for (const k of prev.keys()) if (!ids.has(k)) prev.delete(k);
    return rows;
}
