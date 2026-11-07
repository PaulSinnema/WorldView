// Preload for the build scripts (node --import ./tools/retry-fetch.mjs): global fetch retried on network errors, timeouts, 429 and 5xx
// Up to FETCH_RETRIES (default 20) retries, wait 5 s doubling to at most 60 s between tries
const MAX = Number(process.env.FETCH_RETRIES || 20);
const base = globalThis.fetch;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const retryable = s => s === 408 || s === 429 || s >= 500;
console.log(`retry-fetch: active, up to ${MAX} retries per fetch`); // shows in the log that the preload is loaded

globalThis.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    for (let i = 0; ; i++) {
        let why;
        try {
            const r = await base(input, init);
            if (!retryable(r.status) || i >= MAX) return r;
            why = `HTTP ${r.status}`;
            await r.body?.cancel().catch(() => { });
        } catch (e) {
            if (i >= MAX) throw e;
            why = `${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`;
        }
        const wait = Math.min(60000, 5000 * 2 ** i);
        console.log(`fetch ${url}: ${why}, retry ${i + 1}/${MAX} in ${wait / 1000} s`);
        await sleep(wait);
    }
};
