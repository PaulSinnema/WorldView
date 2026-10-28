# WorldView fetcher

One fetcher, one snapshot, served from the CDN. The data sources get a constant load (1 request per minute), however many people use WorldView.

```
OpenSky / adsb.lol  ←  fetcher (Worker or NAS)  →  R2: flights.json + military.json  →  data.sinnema.ch (CDN)  →  WorldView
```

## 1. Cloudflare (one-off)

1. **Move the domain to Cloudflare**: Add a domain → `sinnema.ch` → Free plan. Check that the MX/SPF/DKIM/DMARC records and the website records have been copied over. Turn DNSSEC off at your registrar first, then switch the nameservers.
2. **Create the R2 bucket**: R2 → Create bucket → `worldview-data`.
3. **Custom domain**: bucket → Settings → Custom Domains → `data.sinnema.ch`.
4. **CORS**: bucket → Settings → CORS policy → paste the contents of `r2-cors.json`.
5. **Cache rule** (needed, because `.json` is not cached by default): Caching → Cache Rules → Create:
   - When: Hostname equals `data.sinnema.ch`
   - Then: Eligible for cache, Edge TTL = *Use cache-control header if present*.

## 2. OpenSky account (free, recommended)

opensky-network.org → Account → API Client → create one. You get a `client_id` and a `client_secret`.
Without an account you only get 400 credits a day, which is one global snapshot every ~15 min (then set `OPENSKY_INTERVAL_S = "900"`).

## 3a. Deploy the Worker (default)

```
cd C:\Projects\WorldView\fetcher
npm install
npx wrangler login
npx wrangler secret put OPENSKY_CLIENT_ID
npx wrangler secret put OPENSKY_CLIENT_SECRET
npx wrangler deploy
```

Check: open the Worker URL (`https://worldview-fetcher.<subdomain>.workers.dev`). It shows the age of the snapshots.
Also check `https://data.sinnema.ch/flights.json`.

## 3b. NAS fallback (if OpenSky/adsb.lol block the Worker)

Remove the cron trigger from the Worker first (otherwise both of them write).
R2 → Manage API tokens → create a token with *Object Read & Write* on `worldview-data`.

Synology Container Manager → Project → create one from this folder, or:

```
docker build -t worldview-fetcher .
docker run -d --restart unless-stopped --name worldview-fetcher \
  -e R2_ACCOUNT_ID=... -e R2_ACCESS_KEY_ID=... -e R2_SECRET_ACCESS_KEY=... \
  -e OPENSKY_CLIENT_ID=... -e OPENSKY_CLIENT_SECRET=... \
  worldview-fetcher
```

Outgoing traffic only; no port needs to be opened.

## Snapshot format

- `flights.json`: `{ t, src, ac: [[icao, call, lat, lon, altM, gsMs, track, ground, country, squawk, tPos], …] }`
- `military.json`: `{ t, src, ac: [[hex, call, lat, lon, altM, gsMs, track, ground, reg, type, squawk, tPos], …] }`
