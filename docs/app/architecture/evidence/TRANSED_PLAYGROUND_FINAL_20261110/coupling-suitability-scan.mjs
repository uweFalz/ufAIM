import { readFileSync } from "node:fs";
const root = new URL("../../../../../", import.meta.url).pathname;
const { KappaFcnBuilder } = await import(root + "src/aim-core/transition/runtime/KappaFcnBuilder.js");
const { createTransitionQueryService } = await import(root + "src/aim-core/transition/query/createTransitionQueryService.js");
const { RegistryResolver } = await import(root + "src/aim-core/transition/registry/RegistryResolver.js");
const db = JSON.parse(readFileSync(root + "src/domain/transition/transitionLookup.json", "utf8"));
const svc = createTransitionQueryService({ db, registryResolver: new RegistryResolver(db) });
function solve(k, eps, n = 4000) {
	const h = 1 / n, a = -(eps * eps) / (h * h), b = 1 + 2 * eps * eps / (h * h);
	const m = n - 1, d = new Array(m), cp = new Array(m), dp = new Array(m);
	for (let i = 0; i < m; i++) d[i] = k((i + 1) * h);
	d[m - 1] -= a;
	cp[0] = a / b; dp[0] = d[0] / b;
	for (let i = 1; i < m; i++) { const den = b - a * cp[i - 1]; cp[i] = a / den; dp[i] = (d[i] - a * dp[i - 1]) / den; }
	const f = new Array(n + 1).fill(0); f[n] = 1; f[m] = dp[m - 1];
	for (let i = m - 1; i >= 1; i--) f[i] = dp[i - 1] - cp[i - 1] * f[i + 1];
	// one-sided 2nd-order end slopes
	return { s0: (-3 * f[0] + 4 * f[1] - f[2]) / (2 * h), s1: (3 * f[n] - 4 * f[n - 1] + f[n - 2]) / (2 * h) };
}
const rows = [];
for (const id of Object.keys(db.transition)) {
	try {
		const p = KappaFcnBuilder.buildPresetFromDescriptor(svc.getPresetSpec(id).descriptor);
		const k = (x) => p.kappa(x);
		let kmin = Infinity; for (let i = 0; i <= 400; i++) kmin = Math.min(kmin, k(i / 400));
		const at = solve(k, 0.134);
		let best = { eps: 0, v: Infinity };
		for (let e = 0.01; e <= 0.4001; e += 0.005) { const r = solve(k, e, 2000); const v = Math.hypot(r.s0, r.s1); if (v < best.v) best = { eps: e, v }; }
		rows.push([id, kmin.toFixed(3), at.s0.toFixed(3), at.s1.toFixed(3), best.eps.toFixed(3), best.v.toFixed(3)]);
	} catch (e) { rows.push([id, "ERR " + String(e.message).slice(0, 40)]); }
}
console.log("id | min k | f'(0) | f'(1) @eps .134 | best eps | residual slope");
for (const r of rows) console.log(r.join(" | "));
// control: synthetic Wiener Bogen built for eps0 = 0.134
const f7 = (x) => 35 * x ** 4 - 84 * x ** 5 + 70 * x ** 6 - 20 * x ** 7;
const f7dd = (x) => 420 * x ** 2 - 1680 * x ** 3 + 2100 * x ** 4 - 840 * x ** 5;
const kW = (x) => f7(x) - 0.134 ** 2 * f7dd(x);
for (const e of [0.08, 0.134, 0.2]) { const r = solve(kW, e); console.log("control Wiener(eps0=.134) @eps", e, r.s0.toFixed(4), r.s1.toFixed(4)); }
let km = Infinity; for (let i = 0; i <= 400; i++) km = Math.min(km, kW(i / 400)); console.log("control min k", km.toFixed(4));
