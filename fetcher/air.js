// Air quality sensors → air.json: Sensor.Community (keyless) + OpenAQ (OPENAQ_API_KEY)
// row: [id, lat, lon, pm25, pm10, tempC, humidity, source]
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const r1 = v => v == null || !Number.isFinite(+v) ? null : Math.round(+v * 10) / 10;
const r4 = v => Math.round(+v * 1e4) / 1e4;
const get = async (url, headers = {}) => {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split('?')[0]}`);
    return r.json();
};

// Sensor.Community: latest 5-minute averages, dust + temperature merged per location (outdoor only)
export async function fetchSensorCommunity() {
    const [dust, temp] = await Promise.all([
        get('https://data.sensor.community/static/v2/data.dust.min.json'),
        get('https://data.sensor.community/static/v2/data.temp.min.json')]);
    const byLoc = new Map();
    const at = s => {
        const l = s.location;
        if (!l || l.indoor || !l.latitude || !l.longitude) return null;
        let o = byLoc.get(l.id);
        if (!o) byLoc.set(l.id, o = { id: `sc-${l.id}`, lat: r4(l.latitude), lon: r4(l.longitude) });
        return o;
    };
    for (const s of dust) { const o = at(s); if (!o) continue; for (const v of s.sensordatavalues || []) { if (v.value_type === 'P2') o.pm25 = r1(v.value); if (v.value_type === 'P1') o.pm10 = r1(v.value); } }
    for (const s of temp) { const o = at(s); if (!o) continue; for (const v of s.sensordatavalues || []) { if (v.value_type === 'temperature') o.t = r1(v.value); if (v.value_type === 'humidity') o.h = r1(v.value); } }
    // Drop obvious sensor errors (negative or saturated values)
    return [...byLoc.values()].filter(o => o.pm25 == null || (o.pm25 >= 0 && o.pm25 < 1000))
        .map(o => [o.id, o.lat, o.lon, o.pm25 ?? null, o.pm10 ?? null, o.t ?? null, o.h ?? null, 'Sensor.Community']);
}

// OpenAQ v3: latest PM2.5 (parameter 2) of all locations, paged
let oaqLogged = false;
export async function fetchOpenAq(key) {
    if (!key) return [];
    const rows = [];
    for (let page = 1; page <= 30; page++) {
        const j = await get(`https://api.openaq.org/v3/parameters/2/latest?limit=1000&page=${page}`, { 'X-API-Key': key });
        const res = j?.results || [];
        if (!oaqLogged && res[0]) { oaqLogged = true; console.log('OpenAQ sample', JSON.stringify(res[0])); }
        for (const m of res) {
            const c = m.coordinates;
            // Only recent values (last 3 hours)
            if (!c || m.value == null || m.value < 0 || Date.now() - Date.parse(m.datetime?.utc) > 3 * 3600000) continue;
            rows.push([`oaq-${m.locationsId ?? m.sensorsId}`, r4(c.latitude), r4(c.longitude), r1(m.value), null, null, null, 'OpenAQ']);
        }
        if (res.length < 1000) break;
    }
    return rows;
}
