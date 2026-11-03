// Yearly electricity CO2 intensity and renewable share per country: Our World in Data energy dataset (Ember, CC BY 4.0)
// Returns { ISO3: [year, gCO2/kWh, renewable %] } (latest year with a carbon intensity)
const URL_CSV = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';

export async function fetchEnergyYear() {
    const r = await fetch(URL_CSV, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error(`OWID HTTP ${r.status}`);
    const [head, ...lines] = (await r.text()).split('\n');
    const cols = head.split(','), col = n => cols.indexOf(n);
    const iIso = col('iso_code'), iYear = col('year'), iCi = col('carbon_intensity_elec'), iRen = col('renewables_share_elec');
    const out = {};
    for (const line of lines) {
        const x = line.split(',');
        const off = x.length - cols.length; // quoted country names with commas shift the columns
        const iso = x[iIso + off], year = +x[iYear + off], ci = parseFloat(x[iCi + off]), ren = parseFloat(x[iRen + off]);
        if (!iso || iso.startsWith('OWID') && iso !== 'OWID_KOS' || !Number.isFinite(ci)) continue;
        if (!out[iso] || year > out[iso][0]) out[iso] = [year, Math.round(ci), Number.isFinite(ren) ? Math.round(ren) : null];
    }
    if (Object.keys(out).length < 100) throw new Error(`only ${Object.keys(out).length} countries`); // keep the old file
    return out;
}
