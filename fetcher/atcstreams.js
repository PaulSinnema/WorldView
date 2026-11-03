// Live airport streams with ATC audio on YouTube, served as atc-streams.json
// item: { id, icao, lat, lon, name, title, channel }
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// Airports per channel; a live stream whose title matches gets that airport's position
const CHANNELS = [
    {
        // Found by the live search (handle has no uploads); airports used for matching
        handle: null, channel: 'Flightradar24', airports: [
            ['KLAS', 'Las Vegas', 36.0840, -115.1537, /las vegas|\bLAS\b/i],
            ['TNCM', 'Sint Maarten', 18.0410, -63.1089, /maarten|\bSXM\b/i],
            ['GCRR', 'Lanzarote', 28.9455, -13.6052, /lanzarote|\bACE\b/i],
            ['KMSY', 'New Orleans', 29.9934, -90.2580, /new orleans|\bMSY\b/i],
            ['KLGA', 'New York LaGuardia', 40.7769, -73.8740, /laguardia|\bLGA\b/i],
            ['KRNO', 'Reno', 39.4991, -119.7681, /reno|\bRNO\b/i],
            ['EGLL', 'London Heathrow', 51.4700, -0.4543, /heathrow|\bLHR\b/i],
            ['KMKE', 'Milwaukee', 42.9472, -87.8966, /milwaukee|\bMKE\b/i]
        ]
    },
    {
        handle: null, channel: 'Airline Videos Live', airports: [
            ['KLAX', 'Los Angeles', 33.9416, -118.4085, /\bLAX\b|los angeles/i],
            ['KMIA', 'Miami', 25.7959, -80.2870, /miami|\bMIA\b/i]
        ]
    },
    {
        // Not 24/7: shows only while the channel is streaming
        handle: '@AMSLIVE', channel: 'AMS LIVE', airports: [
            ['EHAM', 'Amsterdam Schiphol', 52.3105, 4.7683, /./]
        ]
    }
];

// ytInitialData from the channel's Streams tab (consent cookie avoids the EU consent page)
async function channelData(handle) {
    const r = await fetch(`https://www.youtube.com/${handle}/streams`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en', Cookie: 'SOCS=CAI; CONSENT=YES+1' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${handle}`);
    const html = await r.text();
    const m = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
    if (!m) throw new Error(`no ytInitialData ${handle} (${html.length} bytes, ${r.url})`);
    const data = JSON.parse(m[1]);
    data.__debug = { url: r.url, bytes: html.length, videoIds: (html.match(/"videoId":"/g) || []).length, live: (html.match(/LIVE/g) || []).length };
    return data;
}

// Diagnostics when a channel yields nothing: page facts + selected tab + first video-like objects
function debugInfo(root) {
    const tabs = root?.contents?.twoColumnBrowseResultsRenderer?.tabs?.map(t => `${t.tabRenderer?.title ?? '?'}${t.tabRenderer?.selected ? '*' : ''}`) ?? [];
    const samples = [];
    const walk = o => {
        if (!o || typeof o !== 'object' || samples.length >= 3) return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        if (typeof o.videoId === 'string' || typeof o.contentId === 'string') { samples.push(JSON.stringify(o).slice(0, 1500)); return; }
        for (const v of Object.values(o)) walk(v);
    };
    walk(root);
    return { ...root?.__debug, tabs, alerts: JSON.stringify(root?.alerts ?? '').slice(0, 300), samples };
}

// All videos in the tree that are live now: [{ id, title }]
function liveVideos(root) {
    const out = new Map();
    const walk = o => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        const id = typeof o.videoId === 'string' ? o.videoId : typeof o.contentId === 'string' ? o.contentId : null;
        const title = o.title?.runs?.[0]?.text ?? o.title?.simpleText ?? o.metadata?.lockupMetadataViewModel?.title?.content;
        if (id?.length === 11 && title) {
            const s = JSON.stringify(o);
            if (/"(LIVE|BADGE_STYLE_TYPE_LIVE_NOW|THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE)"/.test(s) && !out.has(id)) out.set(id, title);
            return;
        }
        for (const v of Object.values(o)) walk(v);
    };
    walk(root);
    return [...out].map(([id, title]) => ({ id, title }));
}

// YouTube Data API v3: the channel's uploads (incl. live streams), newest first, then their live status; 1 unit per call
const UPLOAD_PAGES = 4; // 200 newest uploads per channel
async function api(path, key) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}&key=${encodeURIComponent(key)}`);
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`YouTube API HTTP ${r.status}: ${j?.error?.message || ''}`);
    return j;
}
// Channel id + uploads playlist from the handle (1 unit), cached
const resolved = new Map();
async function uploadsOf(c, key) {
    if (resolved.has(c.handle)) return resolved.get(c.handle);
    const j = await api(`channels?part=id,contentDetails&forHandle=${encodeURIComponent(c.handle)}`, key);
    const ch = j.items?.[0], up = ch?.contentDetails?.relatedPlaylists?.uploads;
    if (!up) throw new Error(`channel ${c.handle} not found`);
    const v = { id: ch.id, uploads: up };
    resolved.set(c.handle, v);
    return v;
}
// Live search across all channels (100 units), every 6 h: finds streams on channels not listed here
const SEARCH_EVERY = 6 * 3600000, SEARCH_QUERIES = ['airport live ATC', 'flightradar24 live'];
let searchAt = 0, searchHits = [];
async function searchLive(key) {
    if (Date.now() - searchAt < SEARCH_EVERY) return searchHits;
    searchAt = Date.now();
    const hits = new Map();
    for (const q of SEARCH_QUERIES) {
        const j = await api(`search?part=snippet&eventType=live&type=video&maxResults=50&q=${encodeURIComponent(q)}`, key);
        for (const i of j.items || []) if (i.id?.videoId) hits.set(i.id.videoId, { id: i.id.videoId, title: i.snippet?.title || '', channel: i.snippet?.channelTitle || '' });
    }
    return (searchHits = [...hits.values()]);
}
async function apiLive(c, key) {
    const { uploads } = await uploadsOf(c, key), ids = [];
    let page = '';
    for (let i = 0; i < UPLOAD_PAGES; i++) {
        const j = await api(`playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50${page ? `&pageToken=${page}` : ''}`, key);
        for (const it of j.items || []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
        if (!(page = j.nextPageToken)) break;
    }
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
        const j = await api(`videos?part=snippet&id=${ids.slice(i, i + 50).join(',')}`, key);
        for (const v of j.items || []) if (v.snippet?.liveBroadcastContent === 'live') out.push({ id: v.id, title: v.snippet.title || '' });
    }
    c.checked = ids.length;
    return out;
}

// Airport from a stream title via airports.json rows [ident, lon, lat, name, large, iata, cc, city, wiki]:
// ICAO (4 capitals), IATA (3 capitals, not a common word), core name ("amsterdam schiphol"), a distinctive name word ("heathrow"),
// else "<city> airport"; names, words and cities only from large airports and only when unambiguous
const IATA_STOP = new Set(['LIVE', 'ATC', 'CAM', 'SKY', 'BIG', 'JET', 'NEW', 'THE', 'AND', 'FOR', 'PTZ', 'ADS', 'TWR', 'APP', 'GND', 'DEP', 'ARR', 'RWY', 'USA', 'UTC', 'GMT', 'SUN', 'DAY', 'AIR', 'TOP', 'ONE', 'TWO', 'WEB', 'HDR', 'FPV', 'VFR', 'IFR', 'FAA', 'KLM', 'BBC', 'CNN', 'NOW']);
const WORD_STOP = new Set(['national', 'municipal', 'county', 'general', 'airbase', 'international', 'regional', 'station', 'island', 'islands', 'central', 'memorial', 'northern', 'southern', 'eastern', 'western', 'airport']);
// Lower case without accents (Václav → vaclav, Zürich → zurich)
const plain = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const coreName = n => plain(n).replace(/\b(international|intl|regional|airport|aeropuerto|aéroport|aeroporto|flughafen|luchthaven|airfield|air base|de|del|da|di)\b/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const cityKeys = r => { const c = plain(r[7] || '').trim(), first = c.split(/[\s,/(-]+/)[0]; return !c ? [] : first && first !== c ? [c, first] : [c]; };
// Same key for two airports: keep the one whose name contains the key, else ambiguous (null)
function put(m, k, r) {
    if (!m.has(k)) { m.set(k, r); return; }
    const o = m.get(k);
    if (o === r) return;
    const a = !!o && plain(o[3]).includes(k), b = plain(r[3]).includes(k);
    m.set(k, a && !b ? o : b && !a ? r : null);
}
function airportIndex(rows) {
    const icao = new Map(), iata = new Map(), city = new Map(), names = new Map(), words = new Map();
    for (const r of rows || []) {
        if (/^[A-Z]{4}$/.test(r[0]) && !IATA_STOP.has(r[0])) icao.set(r[0], r);
        if (r[5] && !IATA_STOP.has(r[5]) && (!iata.has(r[5]) || r[4])) iata.set(r[5], r);
        for (const k of cityKeys(r)) put(city, k, r); // "<city> airport": medium airports too
        if (!r[4]) continue;
        const n = coreName(r[3]);
        if (n.length >= 6) put(names, n, r);
        for (const w of n.split(' ')) if (w.length >= 6 && !WORD_STOP.has(w)) put(words, w, r);
    }
    return { icao, iata, city, names, words };
}
// Search hits only count with an aviation word in the title (else "Golden", "Aurora", "Harbor" hit airports)
const AVIATION = /airport|aeropuerto|aeroporto|aéroport|flughafen|luchthaven|runway|\batc\b|tower|plane ?spott|aviation|landings?\b|takeoffs?\b|\bradar\b|空港|機場|机场/i;
function matchAirport(title, idx) {
    if (!AVIATION.test(title)) return null;
    for (const w of title.match(/\b[A-Z]{4}\b/g) || []) if (idx.icao.has(w)) return idx.icao.get(w);
    for (const w of title.match(/\b[A-Z]{3}\b/g) || []) if (idx.iata.has(w)) return idx.iata.get(w);
    const low = plain(title);
    for (const [n, r] of idx.names) if (r && low.includes(n)) return r;
    for (const w of low.split(/[^\p{L}]+/u)) if (idx.words.get(w)) return idx.words.get(w);
    for (const [c, r] of idx.city) if (r && c.length > 3 && low.includes(`${c} airport`)) return r;
    return null;
}

// With an API key the Data API, else the channel page (often stripped for servers)
export async function fetchAtcStreams(key, airportRows) {
    const res = await Promise.allSettled(CHANNELS.map(async c => {
        if (!c.handle) return { c, vids: [], debug: null };
        if (key) return { c, vids: await apiLive(c, key), debug: null };
        const d = await channelData(c.handle);
        return { c, vids: liveVideos(d), debug: debugInfo(d) };
    }));
    const streams = [], log = [], debug = {};
    res.forEach((p, i) => {
        if (p.status !== 'fulfilled') { log.push(`${CHANNELS[i].channel}: ${p.reason?.message}`); debug[CHANNELS[i].channel] = p.reason?.message; return; }
        const { c, vids } = p.value;
        if (!c.handle) return;
        if (!vids.length) debug[c.channel] = p.value.debug;
        let n = 0;
        for (const v of vids) {
            const a = c.airports.find(x => x[4].test(v.title));
            if (!a) continue;
            // Several streams at one airport: spread them slightly so all can be clicked
            const same = streams.filter(s => s.icao === a[0]).length;
            streams.push({ id: v.id, icao: a[0], lat: a[2] + same * 0.004, lon: a[3] + same * 0.004, name: a[1], title: v.title, channel: c.channel });
            n++;
        }
        log.push(`${c.channel} ${n}/${vids.length}${c.checked != null ? ` of ${c.checked} uploads` : ''}`);
        if (vids.length > n) debug[c.channel] = { unmatched: vids.filter(v => !c.airports.some(x => x[4].test(v.title))).map(v => v.title) };
    });
    // Live search: any channel, matched against all known airports (only video ids not found above)
    if (key) {
        try {
            const hits = await searchLive(key), all = CHANNELS.flatMap(c => c.airports), idx = airportIndex(airportRows);
            const unmatched = [];
            let n = 0;
            for (const h of hits) {
                if (streams.some(s => s.id === h.id)) continue;
                // Known list first (AMS LIVE's catch-all is per channel only), then all airports
                let a = all.find(x => x[4] !== CHANNELS.at(-1).airports[0][4] && x[4].test(h.title));
                if (!a) { const r = matchAirport(h.title, idx); if (r) a = [r[0], r[3], r[2], r[1]]; }
                if (!a) { unmatched.push(`${h.channel}: ${h.title}`); continue; }
                const same = streams.filter(s => s.icao === a[0]).length;
                streams.push({ id: h.id, icao: a[0], lat: a[2] + same * 0.004, lon: a[3] + same * 0.004, name: a[1], title: h.title, channel: h.channel });
                n++;
            }
            log.push(`search ${n}/${hits.length}`);
            debug.unmatched = unmatched;
        } catch (e) { log.push(`search: ${e.message}`); }
    }
    return { streams, log: log.join(', '), debug };
}
