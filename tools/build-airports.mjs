// Builds the airport list from OurAirports (public domain): large and medium airports only
// Run: node tools/build-airports.mjs   → WorldView/wwwroot/data/airports.json { a: [[ident, lon, lat, name, large(0/1), iata, cc, city, wikiTitle]] }
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL_AP = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'WorldView', 'wwwroot', 'data');

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

const r = await fetch(URL_AP);
if (!r.ok) throw new Error(`airports: HTTP ${r.status}`);
const lines = (await r.text()).split(/\r?\n/).filter(Boolean);
const head = parseLine(lines[0]), col = Object.fromEntries(head.map((h, i) => [h, i]));
const a = [];
for (const l of lines.slice(1)) {
    const f = parseLine(l), type = f[col.type];
    if (type !== 'large_airport' && type !== 'medium_airport') continue;
    const lat = Number(f[col.latitude_deg]), lon = Number(f[col.longitude_deg]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const wiki = f[col.wikipedia_link].match(/en\.wikipedia\.org\/wiki\/(.+)$/)?.[1];
    a.push([f[col.icao_code] || f[col.ident], Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4, f[col.name], type === 'large_airport' ? 1 : 0,
        f[col.iata_code], f[col.iso_country], f[col.municipality], wiki ? decodeURIComponent(wiki).replace(/_/g, ' ') : '']);
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'airports.json'), JSON.stringify({ a }));
console.log(`airports: ${a.length} (${a.filter(x => x[4]).length} large), ${Math.round(statSync(join(OUT, 'airports.json')).size / 1024)} KB`);
