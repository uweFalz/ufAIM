// axtran2/app.js
//
// The page: files and numbers in, a worker run, the result shown and
// offered as downloads. No storage, no canonical truth, no network.

const el = (id) => document.getElementById(id);
const status = (text, kind = "info") => { el("status").textContent = text; el("status").dataset.kind = kind; };
const fmt = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : "–");

let worker = null;
let ticker = null;
let last = null;

function endPoseFromFields() {
	const e = el("endE").value.trim(), n = el("endN").value.trim(), t = el("endT").value.trim();
	if (!e && !n && !t) return null;
	const parts = [e, n, t].map((v) => Number(v.replace(",", ".")));
	if (parts.some((v) => !Number.isFinite(v))) throw new Error("Endpose: E, N und T müssen alle drei Zahlen sein, oder alle drei leer.");
	return { x: parts[0], y: parts[1], theta: Math.PI / 2 - parts[2] * (Math.PI / 200) };
}

async function readText(input) { return input.files?.[0] ? input.files[0].text() : ""; }

async function run() {
	try {
		const traFile = el("tra").files?.[0];
		if (!traFile) throw new Error("Eine TRA-Datei fehlt.");
		const pointsText = await readText(el("points"));
		if (!pointsText.trim()) throw new Error("Das Aufmaß fehlt.");
		const zwangText = await readText(el("zwang"));
		const options = {
			tolerance: Number(el("tolerance").value) || 0.15,
			zwangTolerance: Number(el("zwangTolerance").value) || 0.01,
			speedKmh: el("speed").value ? Number(el("speed").value) : null,
			maxIterations: Number(el("iterations").value) || 1000,
			endPose: endPoseFromFields(),
		};
		const bytes = await traFile.arrayBuffer();
		el("run").disabled = true;
		el("result").classList.add("hidden");
		const started = Date.now();
		status("Rechnet …");
		ticker = setInterval(() => status(`Rechnet … ${Math.round((Date.now() - started) / 1000)} s`), 1000);
		worker?.terminate();
		// the single-file build (tools/axtran2/bundle.mjs) carries the worker as
		// source text; the served app loads it as a module beside this file
		worker = window.__AXTRAN2_WORKER_SOURCE
			? new Worker(URL.createObjectURL(new Blob([window.__AXTRAN2_WORKER_SOURCE], { type: "text/javascript" })))
			: new Worker("./worker.js", { type: "module" });
		const id = String(started);
		const message = await new Promise((resolve, reject) => {
			worker.onmessage = (event) => (event.data.id === id ? resolve(event.data) : null);
			worker.onerror = (event) => reject(new Error(event.message || "Der Rechenlauf ist abgestürzt."));
			worker.postMessage({ id, bytes, name: traFile.name, points: pointsText, zwang: zwangText || [], options }, [bytes]);
		});
		clearInterval(ticker);
		if (!message.ok) throw new Error(`${message.code}: ${message.message}`);
		last = message;
		show(message);
		status(`Fertig nach ${fmt(message.seconds, 1)} s.`, "ok");
	} catch (error) {
		clearInterval(ticker);
		status(String(error?.message ?? error), "error");
	} finally {
		el("run").disabled = false;
	}
}

function show({ report, csv }) {
	const { verdict, fit, input } = report;
	el("verdict").textContent = `${input.tra}: ${input.elements} Elemente, ${input.free} freie Größen, ${input.points} Punkte im Fit${input.excludedPoints?.length ? ` (${input.excludedPoints.length} ohne Fußpunkt am Plan ausgeschlossen)` : ""}, V ${input.speedKmh} km/h. Verdikt: ${verdict.status}${verdict.reason ? " / " + verdict.reason : ""} nach ${verdict.iterations} Schritten.`;
	const measured = report.points.filter((p) => p.kind === "measured");
	const before = measured.map((p) => p.offsetBefore).filter(Number.isFinite);
	const after = measured.map((p) => p.offset).filter(Number.isFinite);
	const maxAbs = (a) => (a.length ? Math.max(...a.map(Math.abs)) : NaN);
	const rms = (a) => (a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : NaN);
	el("numbers").replaceChildren(...[
		[`${fmt(rms(before))} m`, `rms vorher, max ${fmt(maxAbs(before), 2)} m`],
		[`${fmt(rms(after))} m`, `rms nachher, max ${fmt(maxAbs(after))} m`],
		[`${fit.outsideTolerance} von ${measured.length}`, "außerhalb der Toleranz"],
		[Number.isFinite(fit.endPoseDistance) ? fit.endPoseDistance.toExponential(1) + " m" : "–", "Endpose"],
		[`${fit.lengthChange >= 0 ? "+" : ""}${fmt(fit.lengthChange)} m`, "Längenänderung"],
	].map(([big, small]) => { const d = document.createElement("div"); d.className = "number"; const b = document.createElement("b"); b.textContent = big; const s = document.createElement("span"); s.textContent = small; d.append(b, s); return d; }));
	const zw = report.points.filter((p) => p.kind === "zwangspunkt");
	el("zwangResult").textContent = zw.length ? "Zwangspunkte: " + zw.map((z) => `${z.name} ${fmt(z.offset, 4)} m (verlangt ${fmt(z.target)} m)`).join(", ") : "";
	const table = el("residuals");
	table.replaceChildren();
	const head = document.createElement("tr");
	for (const h of ["Punkt", "Station", "vorher [m]", "nachher [m]", "Residuum [m]", "innerhalb"]) { const th = document.createElement("th"); th.textContent = h; head.append(th); }
	table.append(head);
	const rows = report.points.slice(0, 40);
	for (const p of rows) {
		const tr = document.createElement("tr");
		for (const v of [p.name + (p.kind === "zwangspunkt" ? " (Z)" : p.kind === "excluded" ? " (draußen)" : ""), p.station === null ? "–" : fmt(p.station, 1), fmt(p.offsetBefore), fmt(p.offset), fmt(p.residual), p.within === null ? "–" : p.within ? "ja" : "nein"]) { const td = document.createElement("td"); td.textContent = String(v); tr.append(td); }
		table.append(tr);
	}
	el("more").textContent = report.points.length > rows.length ? `… und ${report.points.length - rows.length} weitere in residuen.csv.` : "";
	el("result").classList.remove("hidden");
	void csv;
}

function download(name, data, type) {
	const url = URL.createObjectURL(new Blob([data], { type }));
	const a = document.createElement("a"); a.href = url; a.download = name; a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

el("run").addEventListener("click", run);
el("reset").addEventListener("click", () => { for (const id of ["tra", "points", "zwang", "endE", "endN", "endT", "speed"]) el(id).value = ""; el("result").classList.add("hidden"); status(""); last = null; });
el("dlTra").addEventListener("click", () => last && download((last.report.input.tra || "plan.TRA").replace(/\.tra$/i, "") + "_axtran2.TRA", last.tra, "application/octet-stream"));
el("dlReport").addEventListener("click", () => last && download("report.json", JSON.stringify(last.report, null, 2), "application/json"));
el("dlCsv").addEventListener("click", () => last && download("residuen.csv", last.csv, "text/csv"));
