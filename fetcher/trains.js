// Live train positions: NS (Netherlands, API key), Digitraffic (Finland), Amtraker (US/Canada)
// row: [id, label, lat, lon, speedMs, heading, country, operator, tPos]
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const r5 = v => Math.round(v * 1e5) / 1e5;
let nsLogged = false;

export async function fetchNs(key) {
    if (!key) return [];
    const headers = { 'Ocp-Apim-Subscription-Key': key, 'User-Agent': UA, Accept: 'application/json' };
    let r = await fetch('https://gateway.apiportal.ns.nl/virtual-train-api/api/vehicle', { headers });
    if (r.status === 404) r = await fetch('https://gateway.apiportal.ns.nl/virtual-train-api/vehicle', { headers });
    if (!r.ok) throw new Error(`NS HTTP ${r.status}`);
    const j = await r.json();
    const list = j?.payload?.treinen ?? j?.treinen ?? (Array.isArray(j?.payload) ? j.payload : []);
    // Log one record once to verify the field names
    if (!nsLogged && list[0]) { nsLogged = true; console.log('NS sample', JSON.stringify(list[0])); }
    const now = Math.round(Date.now() / 1000);
    return list
        .filter(t => Number.isFinite(t.lat) && Number.isFinite(t.lng))
        .map(t => {
            const nr = t.treinNummer ?? t.ritId ?? '';
            return [`ns-${nr || `${t.lat},${t.lng}`}`, `${t.type || 'NS'} ${nr}`.trim(), r5(t.lat), r5(t.lng),
                Math.round((t.snelheid || 0) / 3.6 * 10) / 10, Math.round(t.richting || 0), 'NL', 'NS', now];
        });
}

// Digitraffic has no heading: derive it from the previous position
const fiPrev = new Map();
function bearing([la1, lo1], [la2, lo2]) {
    const rad = Math.PI / 180, dLo = (lo2 - lo1) * rad;
    const y = Math.sin(dLo) * Math.cos(la2 * rad);
    const x = Math.cos(la1 * rad) * Math.sin(la2 * rad) - Math.sin(la1 * rad) * Math.cos(la2 * rad) * Math.cos(dLo);
    return (Math.atan2(y, x) / rad + 360) % 360;
}
function trackHeading(prev, id, lat, lon) {
    const p = prev.get(id);
    if (!p || Math.hypot(lat - p.pos[0], (lon - p.pos[1]) * Math.cos(lat * Math.PI / 180)) < 0.0003) {
        if (!p) prev.set(id, { pos: [lat, lon], h: null });
        return p?.h ?? null; // moved < ~30 m: keep last heading
    }
    const h = bearing(p.pos, [lat, lon]);
    prev.set(id, { pos: [lat, lon], h });
    return h;
}
const fiHeading = (id, lat, lon) => trackHeading(fiPrev, id, lat, lon);
const prune = (prev, rows) => { const ids = new Set(rows.map(r => r[0])); for (const k of prev.keys()) if (!ids.has(k)) prev.delete(k); };

export async function fetchFinland() {
    const r = await fetch('https://rata.digitraffic.fi/api/v1/train-locations/latest/', { headers: { 'Digitraffic-User': 'WorldView/sinnema.ch', 'User-Agent': UA } });
    if (!r.ok) throw new Error(`Digitraffic HTTP ${r.status}`);
    const j = await r.json();
    const rows = (Array.isArray(j) ? j : [])
        .filter(t => t.location?.coordinates?.length === 2)
        .map(t => {
            const [lon, lat] = t.location.coordinates, id = `fi-${t.trainNumber}-${t.departureDate}`;
            const h = Number.isFinite(t.heading) ? t.heading : fiHeading(id, lat, lon);
            // Unknown heading: speed 0 (no dead reckoning)
            return [id, `VR ${t.trainNumber}`, r5(lat), r5(lon),
                h != null ? Math.round((t.speed || 0) / 3.6 * 10) / 10 : 0, h != null ? Math.round(h) : 0,
                'FI', 'VR', Math.round(Date.parse(t.timestamp) / 1000) || Math.round(Date.now() / 1000)];
        });
    prune(fiPrev, rows); // forget trains that are gone
    return rows;
}

// Amtrak + Brightline + VIA Rail via the Amtraker API (unofficial, from Amtrak's own map)
// Extra fields: [9] route, [10] from, [11] to
const usPrev = new Map();
const COMPASS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
export async function fetchAmtrak() {
    const r = await fetch('https://api-v3.amtraker.com/v3/trains', { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`Amtraker HTTP ${r.status}`);
    const j = await r.json();
    const rows = Object.values(j || {}).flat()
        .filter(t => t?.trainState === 'Active' && Number.isFinite(t.lat) && Number.isFinite(t.lon))
        .map(t => {
            const id = `us-${t.trainID}`;
            // Own bearing is finer than the 8-point compass
            const h = trackHeading(usPrev, id, t.lat, t.lon) ?? COMPASS[t.heading] ?? null;
            const op = t.provider || 'Amtrak';
            return [id, `${op} ${t.trainNum}`, r5(t.lat), r5(t.lon),
                h != null ? Math.round((t.velocity || 0) * 0.44704 * 10) / 10 : 0, h != null ? Math.round(h) : 0,
                op === 'Via' ? 'CA' : 'US', op, Math.round(Date.parse(t.lastValTS) / 1000) || Math.round(Date.now() / 1000),
                t.routeName || '', t.origName || '', t.destName || ''];
        });
    prune(usPrev, rows);
    return rows;
}
