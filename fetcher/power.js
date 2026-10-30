// Electricity mix per European country (Energy-Charts, Fraunhofer ISE, CC BY 4.0) → power.json
// { t, c: { nl: { t, ci, ren, mix: { id: MW } } } }; ci = estimated g CO2-eq/kWh of generation (lifecycle, IPCC AR5 medians)
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const COUNTRIES = ['at', 'ba', 'be', 'bg', 'ch', 'cy', 'cz', 'de', 'dk', 'ee', 'es', 'fi', 'fr', 'ge', 'gr', 'hr', 'hu', 'ie', 'it', 'lt', 'lu', 'lv',
    'md', 'me', 'mk', 'nl', 'no', 'pl', 'pt', 'ro', 'rs', 'se', 'si', 'sk', 'ua', 'uk', 'xk'];
// g CO2-eq/kWh per source; ids not listed (load, trading, shares) are not generation
const EF = {
    nuclear: 12, solar: 45, wind_onshore: 11, wind_offshore: 12, hydro_run_of_river: 24, hydro_water_reservoir: 24, hydro_pumped_storage: 24,
    geothermal: 38, biomass: 230, waste: 400, fossil_gas: 490, fossil_coal_derived_gas: 820, fossil_oil: 650, fossil_hard_coal: 820,
    fossil_brown_coal_lignite: 1050, fossil_oil_shale: 1100, fossil_peat: 1000, others: 500
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function country(c) {
    let r;
    // Without dates the API returns the local "today" only: just after midnight that is still empty → ask yesterday + today
    const day = ms => new Date(Date.now() - ms).toISOString().slice(0, 10);
    const url = `https://api.energy-charts.info/v2/public_power?country=${c}&start=${day(86400000)}&end=${day(-86400000)}`;
    // Rate limited (429): wait and retry twice
    for (let i = 0; i < 3; i++) {
        r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
        if (r.status !== 429) break;
        await sleep(30000);
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    // Latest interval with generation data
    const row = [...(j.data || [])].reverse().find(d => Object.keys(d.values || {}).some(k => k in EF && d.values[k] != null));
    if (!row) return null;
    let mw = 0, g = 0;
    const mix = {};
    for (const [k, v] of Object.entries(row.values)) {
        if (!(k in EF) || !(v > 0)) continue;
        mix[k] = Math.round(v);
        mw += v; g += v * EF[k];
    }
    if (!mw) return null;
    const ren = row.values.renewable_share_of_generation;
    return { t: Math.round(Date.parse(row.timestamp) / 1000), ci: Math.round(g / mw), ren: ren == null ? null : Math.round(ren), mix };
}

// Countries that fail this round keep their previous value (data max 12 h old)
const last = {};
export async function fetchPower() {
    for (const k of COUNTRIES) {
        try { const v = await country(k); if (v) last[k] = v; } catch { /* keep previous */ }
        await sleep(6000); // fair use: the API rate-limits bursts
    }
    const c = Object.fromEntries(Object.entries(last).filter(([, v]) => Date.now() / 1000 - v.t < 12 * 3600));
    if (!Object.keys(c).length) throw new Error('no countries');
    return { t: Math.round(Date.now() / 1000), c };
}
