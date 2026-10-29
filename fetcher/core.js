// Shared snapshot builder for the WorldView flight feed (Cloudflare Worker + NAS container)
const UA = 'WorldView-fetcher/1.0 (+https://data.sinnema.ch)';
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const FT = 0.3048, KN = 0.514444;
const r4 = v => Math.round(v * 1e4) / 1e4;

export async function openskyToken(clientId, clientSecret) {
    if (!clientId || !clientSecret) return null;
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
    const r = await fetch(TOKEN_URL, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA } });
    if (!r.ok) throw new Error(`OpenSky token HTTP ${r.status}`);
    return (await r.json()).access_token;
}

// civil row: [icao, call, lat, lon, altM, gsMs, track, ground, country, squawk, tPos] (+ reg, type in server.js)
export async function fetchOpensky(token) {
    const headers = { 'User-Agent': UA, Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch('https://opensky-network.org/api/states/all', { headers });
    if (!r.ok) throw new Error(`OpenSky HTTP ${r.status}`);
    const j = await r.json();
    const ac = (j.states || [])
        .filter(s => s[5] != null && s[6] != null)
        .map(s => [s[0], (s[1] || '').trim(), r4(s[6]), r4(s[5]), Math.round(s[13] ?? s[7] ?? 0), Math.round((s[9] || 0) * 10) / 10,
            Math.round(s[10] || 0), s[8] ? 1 : 0, s[2] || '', s[14] || '', s[3] ?? j.time]);
    return { t: j.time, src: 'OpenSky Network', ac };
}

// military row: [hex, call, lat, lon, altM, gsMs, track, ground, reg, type, squawk, tPos]
export async function fetchMilitary() {
    const r = await fetch('https://api.adsb.lol/v2/mil', { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`adsb.lol HTTP ${r.status}`);
    const j = await r.json();
    const now = Math.round((j.now ?? Date.now()) / 1000);
    const ac = (j.ac || [])
        .filter(a => a.lat != null && a.lon != null)
        .map(a => {
            const ground = a.alt_baro === 'ground';
            return [a.hex, (a.flight || '').trim(), r4(a.lat), r4(a.lon), ground ? 0 : Math.round((Number(a.alt_baro) || Number(a.alt_geom) || 0) * FT),
                Math.round((a.gs || 0) * KN * 10) / 10, Math.round(a.track ?? a.true_heading ?? 0), ground ? 1 : 0,
                a.r || '', a.t || '', a.squawk || '', Math.round(now - (a.seen_pos || 0))];
        });
    return { t: now, src: 'adsb.lol (ODbL)', ac };
}
