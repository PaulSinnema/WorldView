# Upload the static datasets (static\ in the repo root) to the VPS: /opt/fetcher/static, served as https://flights.sinnema.ch/static/
# Run from the repo root: .\tools\upload-static.ps1   (needs OpenSSH: ssh/scp in PATH)
param([string]$VpsHost = 'root@flights.sinnema.ch')

$src = Join-Path $PSScriptRoot '..\static'
if (-not (Test-Path $src)) { throw "No static folder: $src" }

# Fresh copy next to the live one, then swap + restart Caddy (bind mount follows the new folder)
ssh $VpsHost 'rm -rf /opt/fetcher/static.new && mkdir -p /opt/fetcher/static.new'
if ($LASTEXITCODE) { throw 'ssh failed' }
scp -r -q "$src\*" "${VpsHost}:/opt/fetcher/static.new/"
if ($LASTEXITCODE) { throw 'scp failed' }
ssh $VpsHost 'cd /opt/fetcher && rm -rf static.old && (mv static static.old 2>/dev/null; true) && mv static.new static && chmod -R a+rX static && rm -rf static.old && docker compose restart caddy && du -sh static'
if ($LASTEXITCODE) { throw 'swap failed' }
Write-Host 'Static datasets uploaded.'
