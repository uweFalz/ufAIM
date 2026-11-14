// Recomputes AT 412 975 B (Hasslinger) against the coupling used in the
// playground. Run from the repository root: node <this file>
import fs from "node:fs";
import { createTransitionLibraryService } from "../../../../../src/services/transition-library/index.js";

const db = JSON.parse(fs.readFileSync(new URL("../../../../../src/domain/transition/transitionLookup.json", import.meta.url), "utf8"));
const service = createTransitionLibraryService({ catalogue: db });
// the patent gives tan(Z/2) = Z/2 = 4.49340946, so Z is twice that value
const Z = 2 * 4.49340946, P = Math.PI;
// normalised functions (2) to (7) of the patent
const F = {
	2: (x) => x ** 4 * (35 - 84 * x + 70 * x * x - 20 * x ** 3),
	3: (x) => x * x * (-2 * x + 3) + (6 / (Z * Z)) * (2 * x - 1 + Math.cos(Z * x) - (2 / Z) * Math.sin(Z * x)),
	4: (x) => 0.25 * ((1 / (12 - P * P)) * (P * P * x * x * (2 * x - 3) + 6 * (1 - Math.cos(P * x)))) + 0.75 * (x - Math.sin(2 * P * x) / (2 * P)),
	5: (x) => (15 / (15 - P * P)) * (x - Math.sin(2 * P * x) / (2 * P)) - ((P * P) / (15 - P * P)) * x ** 3 * (6 * x * x - 15 * x + 10),
	6: (x) => (5 / (10 - P * P)) * (1 - Math.cos(P * x)) - ((P * P) / (2 * (10 - P * P))) * x * x * (2 * x ** 3 - 5 * x * x + 5),
	7: (x) => x ** 5 * (126 - 420 * x + 540 * x * x - 315 * x ** 3 + 70 * x ** 4),
};
console.log("A. database entries named vienna* against the patent functions (as curvature, whole transition)");
for (const id of Object.keys(db.transition).filter((key) => /vien/i.test(key))) {
	const t = db.transition[id];
	const d = service.describeDraft({ halfWave1: t.halfWave1, halfWave2: t.halfWave2, normLengthPartition: t.normLengthPartition });
	const best = Object.entries(F).map(([n, f]) => [n, Math.max(...d.samples.map((p) => Math.abs(p.k - f(p.u))))]).sort((a, b) => a[1] - b[1])[0];
	console.log(`  ${id} (${t.halfWave1}): closest patent function (${best[0]}), largest deviation ${best[1].toExponential(2)}`);
}
console.log("B. the patent's table: l = 200 m, R1 = -2000 m, u1 = -64 mm, R2 = 800 m, u2 = 160 mm, b = 1.5 m, function (2)");
const f = F[2], f2 = (x) => 420 * x * x - 1680 * x ** 3 + 2100 * x ** 4 - 840 * x ** 5;
const k1 = -0.5e-3, dk = 1.75e-3, dp = 0.224 / 1.5, L = 200;
const table = { 4: -5.010315e-1, 20: -5.135152e-1, 40: -4.850001e-1, 80: -2.537805e-2, 100: 3.75e-1, 140: 1.079224, 172: 1.262949, 196: 1.251032 };
const x4 = 4 / L;
const h = ((k1 + dk * f(x4) - table[4] * 1e-3) * L * L) / (dp * f2(x4));
console.log(`  h read back from the row s = 4 m: ${h.toFixed(4)} m`);
let worst = 0;
for (const [s, kt] of Object.entries(table)) {
	const x = s / L; const k = (k1 + dk * f(x) - (1.8 * dp * f2(x)) / L / L) * 1e3;
	worst = Math.max(worst, Math.abs(k - kt));
	console.log(`  s = ${s} m: computed ${k.toExponential(6)} 1/km, patent ${kt.toExponential(6)} 1/km`);
}
console.log(`  largest deviation with h = 1.8 m: ${worst.toExponential(2)} 1/km`);
const e2 = (1.8 * dp) / (dk * L * L);
console.log(`  eps^2 = h*dPsi/(dKappa*l^2) = ${e2.toFixed(5)}, eps = ${Math.sqrt(e2).toFixed(4)}`);
console.log("C. normalised curvature k = f - eps^2 f'' for function (2)");
for (const [name, value] of [["patent table", e2], ["playground default", 0.018]]) {
	const ks = Array.from({ length: 1001 }, (_, i) => f(i / 1000) - value * f2(i / 1000));
	console.log(`  ${name}, eps^2 = ${value.toFixed(5)}: min ${Math.min(...ks).toFixed(4)}, max ${Math.max(...ks).toFixed(4)}`);
}
