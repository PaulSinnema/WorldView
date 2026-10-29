// NOAA Coral Reef Watch bleaching alert area (7-day max, 5 km) as one global PNG (plate carrée, 4096×2048) → coral.png
// Browsers can't use the ERDDAP WMS directly (fails in some browsers), so the fetcher serves the image itself
const UA = 'WorldView-fetcher/1.0 (+https://flights.sinnema.ch)';
const URL_MAP = 'https://coastwatch.pfeg.noaa.gov/erddap/wms/NOAA_DHW/request?service=WMS&version=1.1.1&request=GetMap&styles=&format=image%2Fpng'
    + '&transparent=true&layers=dhw_5km%3ACRW_BAA_7D_MAX&bbox=-180,-90,180,90&width=4096&height=2048&srs=EPSG%3A4326';

export async function fetchCoral() {
    const r = await fetch(URL_MAP, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(180000) });
    if (!r.ok || !r.headers.get('content-type')?.includes('png')) throw new Error(`ERDDAP HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
}
