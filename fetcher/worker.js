// WorldView fetcher as Cloudflare cron Worker: writes snapshots to R2, served via data.sinnema.ch CDN
import { openskyToken, fetchOpensky, fetchMilitary } from './core.js';

export default {
    async scheduled(event, env, ctx) { ctx.waitUntil(run(env)); },
    // Health check: shows snapshot ages
    async fetch(request, env) {
        const out = {};
        for (const k of ['flights.json', 'military.json']) {
            const h = await env.FEED.head(k);
            out[k] = h ? `${Math.round(Date.now() / 1000 - Number(h.customMetadata?.fetched || 0))} s oud` : 'ontbreekt';
        }
        return Response.json(out);
    }
};

async function run(env) {
    const now = Math.floor(Date.now() / 1000);
    const interval = Number(env.OPENSKY_INTERVAL_S || 120);
    const meta = await env.FEED.head('flights.json');
    // OpenSky only every interval (credit budget); military every run
    if (now - Number(meta?.customMetadata?.fetched || 0) >= interval - 15) {
        try { await put(env, 'flights.json', await fetchOpensky(await openskyToken(env.OPENSKY_CLIENT_ID, env.OPENSKY_CLIENT_SECRET))); }
        catch (e) { console.log(`flights: ${e.message}`); }
    }
    try { await put(env, 'military.json', await fetchMilitary()); }
    catch (e) { console.log(`military: ${e.message}`); }
}

async function put(env, key, snap) {
    await env.FEED.put(key, JSON.stringify(snap), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=30' },
        customMetadata: { fetched: String(Math.floor(Date.now() / 1000)), count: String(snap.ac.length) }
    });
}
