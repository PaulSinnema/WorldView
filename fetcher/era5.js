// Near-surface temperature anomaly from ERA5 (Copernicus Climate Data Store, CDS): latest available day vs 1991–2020 for that month
// Served as tempanom.json: { t, day, w, s, step, nx, ny, v: [°C anomaly ×10, rows from south to north] }
// Needs a CDS personal access token (CDS_API_KEY) and the ERA5 licence accepted
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requestData, eachGrib, toGrid } from './ozone.js';

const CDS = 'https://cds.climate.copernicus.eu/api/retrieve/v1';
const NX = 360, NY = 180;

// Sum fields on the 1° grid (in °C)
function accumulate(buf) {
    const sum = new Float64Array(NX * NY), cnt = new Uint16Array(NX * NY);
    const n = eachGrib(buf, g => {
        const { v } = toGrid(g, x => x - 273.15);
        for (let i = 0; i < v.length; i++) if (v[i] != null) { sum[i] += v[i]; cnt[i]++; }
    });
    return { mean: Array.from(sum, (s, i) => cnt[i] ? s / cnt[i] : null), n };
}

// Monthly climatology 1991–2020 (cached per month on disk, computed once)
async function climatology(key, dataDir, month) {
    const file = join(dataDir, `era5-clim-${month}.json`);
    try { return JSON.parse(await readFile(file, 'utf8')); } catch { /* not cached yet */ }
    const years = Array.from({ length: 30 }, (_, i) => String(1991 + i));
    const buf = await requestData(CDS, key, 'reanalysis-era5-single-levels-monthly-means', {
        product_type: ['monthly_averaged_reanalysis'], variable: ['2m_temperature'], year: years, month: [month], time: ['00:00'],
        data_format: 'grib', download_format: 'unarchived'
    });
    const { mean, n } = accumulate(buf);
    if (n < 25) throw new Error(`ERA5 climatology: ${n} fields`);
    await writeFile(file, JSON.stringify(mean));
    return mean;
}

// ERA5(T) lags about 5 days: take the day 6 days ago, mean of 00/06/12/18 UTC
export async function fetchTempAnomaly(key, dataDir) {
    const d = new Date(Date.now() - 6 * 86400000), day = d.toISOString().slice(0, 10);
    const [y, m, dd] = day.split('-');
    const clim = await climatology(key, dataDir, m);
    const buf = await requestData(CDS, key, 'reanalysis-era5-single-levels', {
        product_type: ['reanalysis'], variable: ['2m_temperature'], year: [y], month: [m], day: [dd],
        time: ['00:00', '06:00', '12:00', '18:00'], data_format: 'grib', download_format: 'unarchived'
    });
    const { mean, n } = accumulate(buf);
    if (!n) throw new Error('ERA5: no fields');
    const v = mean.map((x, i) => x == null || clim[i] == null ? null : Math.round((x - clim[i]) * 10));
    return { t: Math.round(Date.now() / 1000), day, w: -179.5, s: -89.5, step: 1, nx: NX, ny: NY, v };
}
