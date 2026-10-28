// WorldView fetcher for a VPS (netcup): writes snapshots + 10° tiles to /data, served by Caddy
import { mkdir, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { openskyToken, fetchOpensky, fetchMilitary } from './core.js';

const env = process.env;
const DATA = env.DATA_DIR || '/data';
const TILE = 10;
const interval = Number(env.OPENSKY_INTERVAL_S || 120) * 1000;
let lastOpensky = 0, token = null, tokenAt = 0;

const log = m => console.log(new Date().toISOString(), m);

// Atomic write: readers never see a half-written file
async function put(rel, obj) {
    const file = join(DATA, rel), tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(obj));
    await rename(tmp, file);
}

// Split civil snapshot into 10° tiles: {t, src, tile, keys}, flights/x_y.json
async function writeFlights(snap) {
    const tiles = new Map();
    for (const a of snap.ac) {
        const k = `${Math.floor(a[3] / TILE)}_${Math.floor(a[2] / TILE)}`;
        if (!tiles.has(k)) tiles.set(k, []);
        tiles.get(k).push(a);
    }
    await mkdir(join(DATA, 'flights'), { recursive: true });
    for (const [k, ac] of tiles) await put(`flights/${k}.json`, { t: snap.t, src: snap.src, ac });
    // Remove tiles that are empty now
    for (const f of await readdir(join(DATA, 'flights'))) {
        if (f.endsWith('.json') && !tiles.has(f.slice(0, -5))) await unlink(join(DATA, 'flights', f)).catch(() => { });
    }
    await put('flights-index.json', { t: snap.t, src: snap.src, tile: TILE, tiles: [...tiles.keys()], count: snap.ac.length });
    await put('flights.json', snap);
}

async function getToken() {
    // OpenSky tokens live ~30 min; renew after 25
    if (token && Date.now() - tokenAt < 25 * 60000) return token;
    token = await openskyToken(env.OPENSKY_CLIENT_ID, env.OPENSKY_CLIENT_SECRET);
    tokenAt = Date.now();
    return token;
}

async function run() {
    if (Date.now() - lastOpensky >= interval) {
        lastOpensky = Date.now(); // also on failure: respect credit budget
        try {
            const s = await fetchOpensky(await getToken());
            await writeFlights(s);
            log(`flights: ${s.ac.length}`);
        } catch (e) { token = null; log(`flights: ${e.message}`); }
    }
    try {
        const m = await fetchMilitary();
        await put('military.json', m);
        log(`military: ${m.ac.length}`);
    } catch (e) { log(`military: ${e.message}`); }
}

await mkdir(DATA, { recursive: true });
run();
setInterval(run, 60000);
