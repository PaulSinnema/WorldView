// Ammonia (NH3) grid over Europe from Open-Meteo (CAMS Europe), served as nh3.json
// { t, w, s, step, nx, ny, v: [µg/m³ row by row from south to north, west to east] }
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
// CAMS Europe domain 25°W–44°E, 30–71°N at 1° (72°N/45°E give "no data"): 2,940 points; every 8 h ≈ 8,800 of 10,000 free calls/day
export const NH3_GRID = { w: -25, s: 30, step: 1, nx: 70, ny: 42 };
const BATCH = 100, PAUSE_MS = 12000; // ≈ 500 locations per minute (free limit 600/min)
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function fetchNh3() {
    const { w, s, step, nx, ny } = NH3_GRID, pts = [];
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) pts.push([(s + y * step).toFixed(2), (w + x * step).toFixed(2)]);
    const v = [];
    for (let i = 0; i < pts.length; i += BATCH) {
        if (i) await sleep(PAUSE_MS);
        const b = pts.slice(i, i + BATCH);
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${b.map(p => p[0]).join(',')}&longitude=${b.map(p => p[1]).join(',')}&current=ammonia&domains=cams_europe`;
        const r = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
        const j = await r.json();
        // Results come back in request order
        for (const o of Array.isArray(j) ? j : [j]) v.push(o?.current?.ammonia ?? null);
    }
    return { t: Math.round(Date.now() / 1000), w, s, step, nx, ny, v: v.map(x => x == null ? null : Math.round(x * 10) / 10) };
}
