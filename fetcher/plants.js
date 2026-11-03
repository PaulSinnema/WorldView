// Power plants: WRI Global Power Plant Database v1.3 (CC BY 4.0)
// Returns { fuels: [...], p: [[lon, lat, MW, fuelIndex, name, owner, year, country], ...] } sorted by capacity (largest first)
const URL_CSV = 'https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const FUELS = ['Solar', 'Wind', 'Hydro', 'Nuclear', 'Gas', 'Coal', 'Oil', 'Biomass', 'Waste', 'Geothermal', 'Storage', 'Wave and Tidal', 'Cogeneration', 'Petcoke', 'Other'];
const r4 = v => Math.round(v * 1e4) / 1e4;

// CSV with quoted fields
function parseCsv(text) {
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
            else f += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(f); f = ''; }
        else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
        else if (c !== '\r') f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
}

export async function fetchPlants() {
    const r = await fetch(URL_CSV, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error(`GPPD HTTP ${r.status}`);
    const [head, ...rows] = parseCsv(await r.text());
    const col = Object.fromEntries(head.map((h, i) => [h, i]));
    const p = [];
    for (const x of rows) {
        const lat = +x[col.latitude], lon = +x[col.longitude], mw = +x[col.capacity_mw];
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(mw > 0)) continue;
        let fi = FUELS.indexOf(x[col.primary_fuel]);
        if (fi < 0) fi = FUELS.length - 1;
        const year = Math.round(+x[col.commissioning_year]) || 0;
        p.push([r4(lon), r4(lat), Math.round(mw * 10) / 10, fi, x[col.name], x[col.owner] || '', year, x[col.country_long]]);
    }
    if (p.length < 10000) throw new Error(`only ${p.length} plants`); // keep the old file
    p.sort((a, b) => b[2] - a[2]);
    return { fuels: FUELS, p };
}
