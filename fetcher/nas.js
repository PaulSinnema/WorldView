// WorldView fetcher for NAS/Docker: same snapshots as the Worker, uploaded to R2 via S3 API
import { AwsClient } from 'aws4fetch';
import { openskyToken, fetchOpensky, fetchMilitary } from './core.js';

const env = process.env;
const r2 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
const base = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET || 'worldview-data'}`;
const interval = Number(env.OPENSKY_INTERVAL_S || 120) * 1000;
let lastOpensky = 0;

const log = m => console.log(new Date().toISOString(), m);

async function put(key, snap) {
    const r = await r2.fetch(`${base}/${key}`, {
        method: 'PUT',
        body: JSON.stringify(snap),
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30', 'x-amz-meta-fetched': String(Math.floor(Date.now() / 1000)) }
    });
    if (!r.ok) throw new Error(`R2 ${key} HTTP ${r.status}`);
}

async function run() {
    if (Date.now() - lastOpensky >= interval) {
        lastOpensky = Date.now(); // also on failure: respect credit budget
        try {
            const s = await fetchOpensky(await openskyToken(env.OPENSKY_CLIENT_ID, env.OPENSKY_CLIENT_SECRET));
            await put('flights.json', s);
            log(`flights: ${s.ac.length}`);
        } catch (e) { log(`flights: ${e.message}`); }
    }
    try {
        const m = await fetchMilitary();
        await put('military.json', m);
        log(`military: ${m.ac.length}`);
    } catch (e) { log(`military: ${e.message}`); }
}

for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) if (!env[k]) { log(`ontbreekt: ${k}`); process.exit(1); }
run();
setInterval(run, 60000);
