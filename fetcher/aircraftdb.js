// Aircraft database (tar1090-db, from Mictronics): ICAO hex -> registration + ICAO type code
import { gunzipSync } from 'node:zlib';

const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const BASE = 'https://raw.githubusercontent.com/wiedehopf/tar1090-db';
const DB_URL = `${BASE}/csv/aircraft.csv.gz`;
const TYPES_URL = `${BASE}/master/db/icao_aircraft_types2.js`;

let db = new Map(); // hex -> "reg;type"

async function getGz(url) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8');
}

// Rows: hex;reg;type;flags;desc;year;owner;
export async function loadAircraftDb() {
    const csv = await getGz(DB_URL), m = new Map();
    for (const line of csv.split('\n')) {
        const [hex, reg, type] = line.split(';');
        if (!hex || (!reg && !type)) continue;
        m.set(hex.toLowerCase(), `${reg || ''};${type && type !== 'ZZZZ' ? type : ''}`);
    }
    db = m;
    return m.size;
}

// ICAO type code -> model name, e.g. B738 -> "BOEING 737-800"
export async function loadTypes() {
    const j = JSON.parse(await getGz(TYPES_URL));
    const out = {};
    for (const [code, v] of Object.entries(j)) if (v?.[0]) out[code] = v[0];
    return out;
}

export function lookup(hex) {
    const v = db.get(hex);
    return v ? v.split(';') : ['', ''];
}
