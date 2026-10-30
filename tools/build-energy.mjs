// Yearly electricity CO2 intensity and renewable share per country: Our World in Data energy dataset (Ember, CC BY 4.0)
// Run: node tools/build-energy.mjs   → WorldView/wwwroot/data/energy-year.json  { ISO3: [year, gCO2/kWh, renewable %] }
import { writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL_CSV = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'WorldView', 'wwwroot', 'data', 'energy-year.json');

const r = await fetch(URL_CSV);
if (!r.ok) throw new Error(`OWID HTTP ${r.status}`);
const [head, ...lines] = (await r.text()).split('\n');
const cols = head.split(','), col = n => cols.indexOf(n);
const iIso = col('iso_code'), iYear = col('year'), iCi = col('carbon_intensity_elec'), iRen = col('renewables_share_elec');
const out = {};
for (const line of lines) {
    const x = line.split(','); // no quoted commas in the used columns' rows before them (country names may be quoted, they come first)
    const off = x.length - cols.length; // quoted names with commas shift the columns
    const iso = x[iIso + off], year = +x[iYear + off], ci = parseFloat(x[iCi + off]), ren = parseFloat(x[iRen + off]);
    if (!iso || iso.startsWith('OWID') && iso !== 'OWID_KOS' || !Number.isFinite(ci)) continue;
    // Latest year with a carbon intensity
    if (!out[iso] || year > out[iso][0]) out[iso] = [year, Math.round(ci), Number.isFinite(ren) ? Math.round(ren) : null];
}
writeFileSync(OUT, JSON.stringify(out));
console.log('energy-year.json', Object.keys(out).length, 'countries', Math.round(statSync(OUT).size / 1024) + ' KB');
