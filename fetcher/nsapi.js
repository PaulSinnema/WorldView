// On-demand API via Caddy: NS train composition + images GET /ns/train/{nr} (cached 5 min),
// live position of one aircraft GET /live/{hex} (adsb.lol, cached 3 s so many viewers make one request)
import { createServer } from 'node:http';
import { fetchHex } from './core.js';

const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const TTL = 5 * 60000;
const cache = new Map(); // nr -> { t, body }
const LIVE_TTL = 3000, live = new Map(); // hex -> { t, p }

const imgOf = a => typeof a === 'string' ? a : a?.url || null;

async function trainInfo(key, nr) {
    const r = await fetch(`https://gateway.apiportal.ns.nl/virtual-train-api/api/v1/trein/${nr}?features=zitplaats`,
        { headers: { 'Ocp-Apim-Subscription-Key': key, 'User-Agent': UA, Accept: 'application/json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`NS trein HTTP ${r.status}`);
    const j = await r.json();

    const mats = j.materieeldelen || [];
    const sum = f => mats.reduce((a, m) => a + (m.zitplaatsen?.[f] || 0), 0);
    return {
        type: [...new Set(mats.map(m => m.type).filter(Boolean))].join(' + '),
        operator: j.vervoerder || null,
        img: mats.map(m => imgOf(m.afbeelding)).find(Boolean) || null,
        parts: mats.map(m => `${m.type || ''} ${m.materieelnummer || ''}`.trim()).filter(Boolean),
        seats1: sum('zitplaatsEersteKlas') + sum('klapstoelEersteKlas') || null,
        seats2: sum('zitplaatsTweedeKlas') + sum('klapstoelTweedeKlas') || null,
        bikes: sum('fietsplekken') || null,
        cars: j.lengte || null,           // number of carriages
        meters: j.lengteInMeters || null,
        facilities: [...new Set(mats.flatMap(m => m.faciliteiten || []))]
    };
}

export function startNsApi(key, port = 8080) {
    createServer(async (req, res) => {
        const path = req.url.split('?')[0], m = /^\/ns\/train\/(\d{1,6})$/.exec(path);
        const send = (code, body, maxAge = 300) => {
            res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` });
            res.end(JSON.stringify(body));
        };
        const lm = /^\/live\/(~?[0-9a-f]{6})$/i.exec(path);
        if (lm) {
            const hex = lm[1].toLowerCase(), c = live.get(hex);
            if (c && Date.now() - c.t < LIVE_TTL) return send(200, await c.p, 2);
            const p = fetchHex(hex).catch(e => { console.log(new Date().toISOString(), `live ${hex}: ${e.message}`); return { ac: [] }; });
            if (live.size > 500) live.clear();
            live.set(hex, { t: Date.now(), p });
            return send(200, await p, 2);
        }
        if (!m || !key) return send(404, { error: 'not found' });
        const nr = m[1], c = cache.get(nr);
        if (c && Date.now() - c.t < TTL) return send(200, c.body);
        try {
            const body = await trainInfo(key, nr);
            if (cache.size > 2000) cache.clear();
            cache.set(nr, { t: Date.now(), body });
            send(200, body);
        } catch (e) { console.log(new Date().toISOString(), `ns train ${nr}: ${e.message}`); send(502, { error: 'upstream' }); }
    }).listen(port);
}
