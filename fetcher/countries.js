// Country (ISO 3166-1 alpha-2) of a point: Natural Earth 50m admin 0 (public domain), loaded once
const URL_NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const NEAR = 0.5; // degrees: points just outside the simplified coast get the nearest country

let countries = null, loading = null;

async function load() {
    const r = await fetch(URL_NE, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error(`Natural Earth HTTP ${r.status}`);
    const out = [];
    for (const f of (await r.json()).features) {
        const p = f.properties, g = f.geometry;
        // ISO_A2 is -99 for e.g. France and Norway; ISO_A2_EH has them
        const cc = [p.ISO_A2_EH, p.ISO_A2, p.WB_A2].find(c => /^[A-Z]{2}$/.test(c || ''));
        if (!cc || !g) continue;
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        for (const rings of polys) {
            let w = 180, s = 90, e = -180, n = -90;
            for (const [x, y] of rings[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
            out.push({ cc, rings, w, s, e, n });
        }
    }
    return out;
}
export async function loadCountries() {
    if (countries) return;
    loading ??= load().then(c => { countries = c; }).finally(() => { loading = null; });
    await loading;
}

// Ray casting; holes (rings 1..) excluded
function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

// ISO2, '' when none, null when the map isn't loaded; fallback = OSM addr:country, then nearest coast within NEAR
export function countryOf(lon, lat, fallback = '') {
    if (!countries) return null;
    for (const c of countries) {
        if (lon < c.w || lon > c.e || lat < c.s || lat > c.n) continue;
        if (inRing(lon, lat, c.rings[0]) && !c.rings.slice(1).some(h => inRing(lon, lat, h))) return c.cc;
    }
    if (/^[A-Z]{2}$/.test(fallback)) return fallback;
    let best = '', bd = NEAR * NEAR;
    for (const c of countries) {
        if (lon < c.w - NEAR || lon > c.e + NEAR || lat < c.s - NEAR || lat > c.n + NEAR) continue;
        for (const [x, y] of c.rings[0]) {
            const d = (x - lon) ** 2 + (y - lat) ** 2;
            if (d < bd) { bd = d; best = c.cc; }
        }
    }
    return best;
}
