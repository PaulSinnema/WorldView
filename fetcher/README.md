# WorldView flight server (netcup VPS)

One fetcher, one snapshot, served by Caddy. The sources get a constant load, however many people use WorldView.

```
OpenSky / adsb.lol  ←  fetcher (Docker)  →  /data: flights.json, flights/x_y.json (10° tiles), military.json
                                          →  Caddy (HTTPS)  →  https://flights.sinnema.ch  →  WorldView
```

## 1. Order the VPS

netcup → VPS 250 G11s (or bigger) → location **Amsterdam** or Nuremberg → image **Debian 12** (or Ubuntu 24.04).
After delivery you get the server's **IPv4 (and IPv6) address** and root access by email.

## 2. DNS at mijn.host

sinnema.ch uses the nameservers of mijn.host, so add the record there:

1. Log in at mijn.host → **Domains** → `sinnema.ch` → **DNS**.
2. Add a record:
   - Type **A**, name **flights**, value **<IPv4 of the VPS>**, TTL 3600
   - If you got an IPv6 address: type **AAAA**, name **flights**, value **<IPv6 of the VPS>**
3. Save. Leave your existing records (website, mail) alone.

Check (after a few minutes up to an hour): `nslookup flights.sinnema.ch` returns the IP of the VPS.

## 3. OpenSky account (free)

opensky-network.org → Account → API Client → create one. You get a `client_id` and a `client_secret`.
(Without one you get 400 credits/day: set `OPENSKY_INTERVAL_S=900`.)

## 4. Install on the VPS

Log in with `ssh root@<IPv4>` and run:

```
apt update && apt -y upgrade
apt -y install curl git ufw
curl -fsSL https://get.docker.com | sh      # Docker + compose plugin (official script)
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

mkdir -p /opt && cd /opt
git clone https://github.com/<your-account>/WorldView.git
cd WorldView/fetcher
cp .env.example .env
nano .env            # fill in OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET
docker compose up -d --build
```

Without GitHub: copy the `fetcher` folder with WinSCP to `/opt/WorldView/fetcher`.

## 5. Check

- `docker compose logs -f fetcher` → every minute `military: …` and every 2 min `flights: …`
- In your browser: `https://flights.sinnema.ch/flights-index.json`
- Caddy requests the HTTPS certificate on first start. This only works when the DNS record from step 2 is active.

## Maintenance

- Updates: `cd /opt/WorldView && git pull && cd fetcher && docker compose up -d --build`
- Docker restarts everything automatically after a reboot.
- Traffic: VPS 250 includes unlimited traffic. Users only fetch the 10° tiles they are looking at (≈10–40 KB, gzip); zoomed out, the world file (≈360 KB) once a minute.
