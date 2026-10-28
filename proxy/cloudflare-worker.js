// WorldView CORS proxy for Cloudflare Workers (free tier). Only allowlisted hosts.
// Deploy: dash.cloudflare.com > Workers > Create > paste this > Deploy; put the worker URL in WorldView POWER UP.
const ALLOWED = ['api.adsb.lol', 'opensky-network.org'];

export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
        if (request.method !== 'GET') return new Response('method not allowed', { status: 405, headers: cors() });

        let target;
        try { target = new URL(new URL(request.url).searchParams.get('url') || ''); }
        catch { return new Response('bad url', { status: 400, headers: cors() }); }
        if (target.protocol !== 'https:' || !ALLOWED.includes(target.hostname))
            return new Response('host not allowed', { status: 403, headers: cors() });

        const upstream = await fetch(target, { headers: { 'User-Agent': 'WorldView-proxy/1.0', 'Accept': 'application/json' }, cf: { cacheTtl: 5 } });
        const headers = new Headers(upstream.headers);
        for (const [k, v] of Object.entries(cors())) headers.set(k, v);
        return new Response(upstream.body, { status: upstream.status, headers });
    }
};

function cors() {
    return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'no-store' };
}
