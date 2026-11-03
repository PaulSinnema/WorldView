// Airports from OurAirports (public domain): large and medium only, served as airports.json
// { a: [[ident, lon, lat, name, large(0/1), iata, cc, city, enwiki title]] }
const URL_AP = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';

// CSV line → fields (quoted fields may contain commas and "")
function parseLine(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
        else if (c === '"') q = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
    }
    out.push(cur);
    return out;
}

export async function fetchAirports() {
    const r = await fetch(URL_AP, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`OurAirports HTTP ${r.status}`);
    const lines = (await r.text()).split(/\r?\n/).filter(Boolean);
    const col = Object.fromEntries(parseLine(lines[0]).map((h, i) => [h, i]));
    const a = [];
    for (const l of lines.slice(1)) {
        const f = parseLine(l), type = f[col.type];
        if (type !== 'large_airport' && type !== 'medium_airport') continue;
        const lat = Number(f[col.latitude_deg]), lon = Number(f[col.longitude_deg]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const wiki = f[col.wikipedia_link].match(/en\.wikipedia\.org\/wiki\/(.+)$/)?.[1];
        let title = '';
        try { title = wiki ? decodeURIComponent(wiki).replace(/_/g, ' ') : ''; } catch { title = ''; }
        a.push([f[col.icao_code] || f[col.ident], Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4, f[col.name], type === 'large_airport' ? 1 : 0,
            f[col.iata_code], f[col.iso_country], f[col.municipality], title]);
    }
    if (a.length < 3000) throw new Error(`only ${a.length} airports`);
    return { t: Math.round(Date.now() / 1000), a };
}
