// Camera lists without browser CORS, served as cameras-extra.json: { iceland: [...], bc: [...] }
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

export async function fetchCameras() {
    const [is, b] = await Promise.allSettled([iceland(), bc()]);
    const out = {};
    if (is.status === 'fulfilled') out.iceland = is.value; else console.log('iceland cams:', is.reason?.message);
    if (b.status === 'fulfilled') out.bc = b.value; else console.log('bc cams:', b.reason?.message);
    return out;
}
