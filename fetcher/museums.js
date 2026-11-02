// Museums: OpenStreetMap tourism=museum via Overpass (ODbL), worldwide in 30° boxes (dense boxes split automatically)
// row: [id, lon, lat, name, typeIndex, wikidata, website, openingHours]
// Returns { index: { tile, tiles, types, top }, tiles: Map key -> rows }; top = museums with a Wikipedia article (max TOP)
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const TILE = 5, TOP = 6000;
const TYPES = ['art', 'history', 'local', 'science', 'technology', 'natural_history', 'military', 'transport', 'railway', 'open_air', 'archaeological', 'other'];
const r4 = v => Math.round(v * 1e4) / 1e4;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = m => console.log(new Date().toISOString(), m);

// One box; null = too big (timeout/size), caller splits it
async function query(s, w, n, e) {
    const q = `[out:json][timeout:180][maxsize:536870912];nwr["tourism"="museum"](${s},${w},${n},${e});out center tags;`;
    for (let attempt = 0; attempt < 4; attempt++) {
        const r = await fetch(OVERPASS, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
        if (r.status === 429 || r.status === 503) { await sleep(30000 * (attempt + 1)); continue; } // busy: wait
        if (r.status === 504) return null;
        if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`);
        const j = await r.json();
        if (j.remark && /runtime error|timed out|out of memory/i.test(j.remark)) return null;
        return j.elements || [];
    }
    throw new Error('Overpass keeps refusing (rate limit)');
}
async function collect(s, w, n, e, depth = 0) {
    const els = await query(s, w, n, e);
    await sleep(2000);
    if (els) return els;
    if (depth >= 4) { log(`museums: ${s},${w},${n},${e} skipped (too dense)`); return []; }
    const ms = (s + n) / 2, mw = (w + e) / 2, out = [];
    for (const [a, b, c, d] of [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]]) out.push(...await collect(a, b, c, d, depth + 1));
    return out;
}

export async function fetchMuseums() {
    const els = [];
    for (let s = -90; s < 90; s += 30) for (let w = -180; w < 180; w += 30) els.push(...await collect(s, w, s + 30, w + 30));
    // Rows, deduplicated (node + building of the same museum)
    const seen = new Set(), rows = [], hasWiki = new Set();
    for (const el of els) {
        const t = el.tags || {}, lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
        const name = t.name || t['name:en'];
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const id = el.type[0] + el.id, dup = `${name}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
        if (seen.has(id) || seen.has(dup)) continue;
        seen.add(id); seen.add(dup);
        let ti = TYPES.indexOf((t['museum:type'] || t.museum || '').split(';')[0].trim());
        if (ti < 0) ti = TYPES.length - 1;
        const qid = /^Q\d+$/.test(t.wikidata || '') ? t.wikidata : '';
        rows.push([id, r4(lon), r4(lat), name, ti, qid, t.website || t['contact:website'] || '', t.opening_hours || '']);
        if (qid && t.wikipedia) hasWiki.add(id);
    }
    if (rows.length < 1000) throw new Error(`only ${rows.length} museums (Overpass incomplete?)`); // keep the old files
    const tiles = new Map();
    for (const row of rows) {
        const k = `${Math.floor(row[1] / TILE)}_${Math.floor(row[2] / TILE)}`;
        if (!tiles.has(k)) tiles.set(k, []);
        tiles.get(k).push(row);
    }
    // Overview: museums with a Wikipedia article, spread evenly when there are more than TOP
    let top = rows.filter(r => hasWiki.has(r[0]));
    if (top.length > TOP) { const step = top.length / TOP; top = Array.from({ length: TOP }, (_, i) => top[Math.floor(i * step)]); }
    return { index: { t: Math.round(Date.now() / 1000), tile: TILE, tiles: [...tiles.keys()], types: TYPES, top }, tiles, count: rows.length };
}
