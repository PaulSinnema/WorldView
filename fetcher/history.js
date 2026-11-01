// Per-aircraft track history for the trails in the app: only what a 50 km trail behind the (delayed) icon needs
const TRAIL_M = 50000;
const R = 6371000, rad = d => d * Math.PI / 180;
const dist = (a, b) => {
    const x = rad(b[2] - a[2]) * Math.cos(rad((a[1] + b[1]) / 2)), y = rad(b[1] - a[1]);
    return Math.hypot(x, y) * R;
};

// delayS: how far the app shows this feed behind real time (icon is that far behind the newest fix)
export function makeHistory(delayS) { return { m: new Map(), delayS }; }

// rows: feed rows [id, call, lat, lon, altM, gsMs, track, ground, ...], tIdx: index of the position time (s)
// Returns Map id -> flat [ageS, lat, lon, alt, gs, track] × n (older fixes, oldest first; age before the row's time)
export function trackHistory(h, rows, tIdx, snapT) {
    const out = new Map();
    for (const a of rows) {
        const id = a[0], t = a[tIdx] || snapT;
        if (a[7]) { h.m.delete(id); continue; } // on the ground: no trail
        let e = h.m.get(id);
        if (!e) h.m.set(id, e = { fx: [], seen: 0 });
        e.seen = snapT;
        if (e.fx.length && t - e.fx[e.fx.length - 1][0] > 600) e.fx = []; // gap > 10 min: start over
        if (!e.fx.length || t > e.fx[e.fx.length - 1][0]) e.fx.push([t, a[2], a[3], a[4], a[5], a[6]]);
        // Keep fixes until 50 km + the delay distance back from the newest, plus the one beyond (curve end)
        const limit = TRAIL_M + (a[5] || 0) * h.delayS;
        let len = 0, i = e.fx.length - 1;
        while (i > 0 && len < limit) { len += dist(e.fx[i], e.fx[i - 1]); i--; }
        if (i > 0) e.fx = e.fx.slice(i);
        const flat = [];
        for (const f of e.fx) if (f[0] < t) flat.push(t - f[0], f[1], f[2], f[3], f[4], f[5]);
        if (flat.length) out.set(id, flat);
    }
    for (const [id, e] of h.m) if (snapT - e.seen > 300) h.m.delete(id); // gone for 5 min
    return out;
}
