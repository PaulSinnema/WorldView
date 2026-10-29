// On-demand NS train composition + images: GET /ns/train/{nr} (via Caddy), cached 5 min
import { createServer } from 'node:http';

const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const TTL = 5 * 60000;
const cache = new Map(); // nr -> { t, body }

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
        const m = /^\/ns\/train\/(\d{1,6})$/.exec(req.url.split('?')[0]);
        const send = (code, body) => {
            res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
            res.end(JSON.stringify(body));
        };
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
