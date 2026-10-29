// Camera lists without browser CORS, served as cameras-extra.json: { iceland, bc, nsw, nz }
// item: { id, lat, lon, name, image }
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const get = async url => {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r.json();
};

// Iceland: Vegagerðin (Icelandic Road Administration)
async function iceland() {
    const j = await get('https://gagnaveita.vegagerdin.is/api/vefmyndavelar2014_1');
    return (j || []).filter(c => c.Slod && Number.isFinite(c.Breidd) && Number.isFinite(c.Lengd))
        .map(c => ({ id: String(c.Maelist_nr ?? c.Slod), lat: c.Breidd, lon: c.Lengd, name: c.Skyring || c.Myndavel || '', image: c.Slod }));
}

// British Columbia: DriveBC
async function bc() {
    const j = await get('https://www.drivebc.ca/api/webcams/');
    return (j || []).filter(c => c.is_on && c.should_appear && c.location?.coordinates && c.links?.imageDisplay)
        .map(c => ({ id: String(c.id), lat: c.location.coordinates[1], lon: c.location.coordinates[0], name: c.caption || c.name || '',
            image: new URL(c.links.imageDisplay, 'https://www.drivebc.ca').href.replace(/\?t=\d+$/, '') }));
}

// New South Wales: Transport for NSW (GeoJSON)
async function nsw() {
    const j = await get('https://data.livetraffic.com/cameras/traffic-cam.json');
    return (j?.features || []).filter(f => f.properties?.href && f.geometry?.coordinates)
        .map(f => ({ id: f.id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], name: f.properties.title || f.properties.view || '', image: f.properties.href }));
}

// New Zealand: NZTA (XML)
async function nz() {
    const r = await fetch('https://trafficnz.info/service/traffic/rest/4/cameras/all', { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status} trafficnz`);
    const xml = await r.text(), tag = (s, t) => s.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];
    return (xml.match(/<camera>[\s\S]*?<\/camera>/g) || []).map(c => {
        const body = c.replace(/<journey>[\s\S]*?<\/journey>|<journeyLeg>[\s\S]*?<\/journeyLeg>|<region>[\s\S]*?<\/region>/g, '');
        return { id: tag(body, 'id'), lat: Number(tag(body, 'latitude')), lon: Number(tag(body, 'longitude')), offline: tag(body, 'offline') === 'true',
            name: (tag(body, 'name') || '').trim() + (tag(body, 'description') ? ` – ${tag(body, 'description')}` : ''),
            image: tag(body, 'imageUrl') ? new URL(tag(body, 'imageUrl'), 'https://trafficnz.info').href : null };
    }).filter(c => !c.offline && c.image && Number.isFinite(c.lat) && Number.isFinite(c.lon)).map(({ offline, ...c }) => c);
}

const SOURCES = { iceland, bc, nsw, nz };
export async function fetchCameras() {
    const names = Object.keys(SOURCES);
    const res = await Promise.allSettled(names.map(n => SOURCES[n]()));
    const out = {};
    res.forEach((p, i) => { if (p.status === 'fulfilled') out[names[i]] = p.value; else console.log(`${names[i]} cams:`, p.reason?.message); });
    return out;
}
