// axtran2/app.js
//
// The page: files and numbers in, a worker run, the result shown and
// offered as downloads. No storage, no canonical truth, no network.

import { residualChartSvg } from "../src/services/axtran2/residualChart.js";
import { runInWorker } from "../src/services/axtran2/workerRun.js";

const el = (id) => document.getElementById(id);
const status = (text, kind = "info") => { el("status").textContent = text; el("status").dataset.kind = kind; };
const fmt = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : "–");

let running = null;
let ticker = null;
let last = null;

// the run is a worker; stopping it is terminating the worker, nothing in
// the calculation has to cooperate. The page is told through the promise.
function cancel() {
	running?.cancel();
}

// the single-file build (tools/axtran2/bundle.mjs) carries the worker as
// source text; the served app loads it as a module beside this file
function createWorker() {
	return window.__AXTRAN2_WORKER_SOURCE
		? new Worker(URL.createObjectURL(new Blob([window.__AXTRAN2_WORKER_SOURCE], { type: "text/javascript" })))
		: new Worker("./worker.js", { type: "module" });
}

// what went wrong with the worker, said so that the next step is clear
function workerFailure(error) {
	if (error?.code === "WORKER_NOT_LOADED") {
		return `Das Rechenprogramm ließ sich nicht laden: der Server hat in ${error.attempts} Versuchen nicht alle Dateien geliefert. Gerechnet wurde nichts, der Plan ist unverändert. Noch einmal auf Optimieren, sonst die Seite neu laden.`;
	}
	if (error?.code === "WORKER_CRASHED") {
		return `Der Rechenlauf ist abgestürzt: ${error.message}${error.where ? ` (${error.where})` : ""}. Der Plan ist unverändert.`;
	}
	return String(error?.message ?? error);
}

function endPoseFromFields() {
	const e = el("endE").value.trim(), n = el("endN").value.trim(), t = el("endT").value.trim();
	if (!e && !n && !t) return null;
	const parts = [e, n, t].map((v) => Number(v.replace(",", ".")));
	if (parts.some((v) => !Number.isFinite(v))) throw new Error("Endpose: E, N und T müssen alle drei Zahlen sein, oder alle drei leer.");
	return { x: parts[0], y: parts[1], theta: Math.PI / 2 - parts[2] * (Math.PI / 200) };
}

async function readText(input) { return input.files?.[0] ? input.files[0].text() : ""; }

async function run() {
	const started = Date.now();
	// before the files are read: a second click must not start a second run
	el("run").disabled = true;
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
			hold: el("hold").value.trim(),
			holdRadii: el("holdRadii").checked,
			order: el("order").value === "budget" ? { budget: Number(el("budget").value) || 0 } : el("order").value,
		};
		const bytes = await traFile.arrayBuffer();
		el("cancel").classList.remove("hidden");
		el("result").classList.add("hidden");
		status("Rechnet …");
		let note = "";
		ticker = setInterval(() => status(`Rechnet … ${Math.round((Date.now() - started) / 1000)} s${note}`), 1000);
		running?.cancel();
		const id = String(started);
		// a worker whose script did not arrive has computed nothing: the start is
		// repeated, each time with its own copy of the bytes (a post hands them over)
		running = runInWorker({
			create: createWorker,
			attempts: 4,
			pauseMs: 400,
			job: () => {
				const copy = bytes.slice(0);
				return { message: { id, bytes: copy, name: traFile.name, points: pointsText, zwang: zwangText || [], options }, transfer: [copy] };
			},
			onRetry: ({ attempt, attempts }) => {
				note = `, das Rechenprogramm lädt noch einmal (Versuch ${attempt} von ${attempts})`;
				status(`Rechnet …${note}`);
			},
		});
		const message = await running.promise;
		clearInterval(ticker);
		if (!message.ok) throw new Error(`${message.code}: ${message.message}`);
		last = message;
		show(message);
		status(`Fertig nach ${fmt(message.seconds, 1)} s.${message.attempts > 1 ? ` Das Rechenprogramm lud erst im ${message.attempts}. Versuch.` : ""}`, "ok");
	} catch (error) {
		clearInterval(ticker);
		const cancelled = error?.code === "CANCELLED";
		status(cancelled ? `Abgebrochen nach ${Math.round((Date.now() - started) / 1000)} s. Der Plan ist unverändert.` : workerFailure(error), cancelled ? "info" : "error");
	} finally {
		running = null;
		el("cancel").classList.add("hidden");
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
	const o = report.order;
	const cost = o?.lengthCost === null || o === null ? null : Math.abs(o.lengthCost) < 5e-4 ? 0 : o.lengthCost;
	el("orderResult").textContent = o ? `Ordnung ${o.order}: ${o.phases.map((p) => `${p.label} ${p.status}${p.iterations === null ? "" : " nach " + p.iterations}`).join(", ")}.${cost === null ? "" : cost === 0 ? " Die Punkte haben keine Länge gegenüber der kürzesten zulässigen Trasse gekostet." : ` Die Punkte kosten ${cost > 0 ? "+" : ""}${fmt(cost)} m gegenüber der kürzesten zulässigen Trasse.`}${o.noBudget.length ? " Die Längenstufe hat kein Budget weitergegeben; die Punkte haben allein entschieden." : ""}` : "";
	const c = report.cant;
	const worst = c.arcs.filter((a) => !a.after.ok).sort((a, b) => b.after.deficiencyMm - a.after.deficiencyMm).slice(0, 5);
	const sp = report.input.speed;
	const admits = c.admissibleSpeedKmh === null ? "" : ` Die Bögen selbst lassen bis V ${Math.floor(c.admissibleSpeedKmh)} km/h zu (${c.limitingArc.id}, R ${fmt(Math.abs(c.limitingArc.radius), 0)} m, u ${fmt(c.limitingArc.cantMm, 0)} mm).`;
	el("speedResult").textContent = sp.basis === "given" ? `Geschwindigkeit: V ${sp.kmh} km/h, wie vorgegeben.${admits}`
		: sp.basis === "turnout" ? `Geschwindigkeit: V ${sp.kmh} km/h angenommen, weil der Zweig der ${sp.turnout.designation} (Satz ${sp.turnout.records.join(", ")}) nicht mehr zulässt (Ril 800.0120A01).${admits} Ändern im Feld Entwurfsgeschwindigkeit.`
		: `Geschwindigkeit: V ${sp.kmh} km/h angenommen, das schnellste Hauptbahn-Profil, das Radien und Längen der Trasse zulassen.${admits} Ändern im Feld Entwurfsgeschwindigkeit.`;
	el("cantResult").textContent = `Überhöhung: ${c.present ? "aus der Datei übernommen, vom Fit nicht verändert" : "die Datei trägt keine"}. Bei V ${c.speedKmh} km/h und zulässigem Fehlbetrag ${fmt(c.maximumDeficiencyMm, 0)} mm liegen nach dem Fit ${c.exceededAfter} von ${c.arcs.length} Bögen darüber (vorher ${c.exceededBefore}).${worst.length ? ` Am stärksten: ${worst.map((a) => `${a.id} mit ${fmt(a.after.deficiencyMm, 0)} mm bei R ${fmt(Math.abs(a.after.radius), 0)} m und u ${fmt(a.cantMm, 0)} mm`).join(", ")}.` : ""}${c.excessiveCant ? ` ${c.excessiveCant} Bögen tragen mehr als die ${fmt(c.maximumCantMm, 0)} mm der EBO.` : ""}`;
	const rule = (z) => z.enforcement === "at-least" ? "mindestens" : z.enforcement === "at-most" ? "höchstens" : "verlangt";
	el("zwangResult").textContent = zw.length ? "Zwangspunkte: " + zw.map((z) => `${z.name} ${fmt(z.offset, 4)} m (${rule(z)} ${fmt(z.target)} m${z.within === false ? ", verletzt" : ""})`).join(", ") : "";
	const span = (records) => (records.length > 1 ? `Sätze ${records[0]}–${records[records.length - 1]}` : `Satz ${records[0]}`);
	const inp = report.input;
	el("holdResult").textContent = [
		inp.turnouts.length ? `Weichen erkannt: ${inp.turnouts.map((t) => `${span(t.records)} ${t.designation} (${t.held ? "gehalten" : "nicht gehalten"})`).join(", ")}.${inp.turnouts.some((t) => !t.held) ? " Das Wort Weichen im Feld Sätze halten hält sie fest." : ""}` : "",
		inp.heldRecords.length ? `Gehalten wie in der Datei: Satz ${inp.heldRecords.map((h) => h.record).join(", ")}.` : "",
		inp.holdRadii ? "Alle Radien gehalten, nur die Längen sind frei." : "",
	].filter(Boolean).join(" ");
	// the curve: the residualChartSvg string is built from numbers only and
	// escapes its labels, so it is safe to set as markup
	el("chart").innerHTML = residualChartSvg(report.points, { tolerance: Number(el("tolerance").value) || 0.15 }) || "<p>Keine Kurve: zu wenige Punkte mit Fußpunkt.</p>";
	const table = el("residuals");
	table.replaceChildren();
	const head = document.createElement("tr");
	const remarks = report.points.some((p) => p.remark);
	for (const h of ["Punkt", "Station", "vorher [m]", "nachher [m]", "Residuum [m]", "innerhalb", ...(remarks ? ["Bemerkung"] : [])]) { const th = document.createElement("th"); th.textContent = h; head.append(th); }
	table.append(head);
	const rows = report.points.slice(0, 40);
	for (const p of rows) {
		const tr = document.createElement("tr");
		for (const v of [p.name + (p.kind === "zwangspunkt" ? " (Z)" : p.kind === "excluded" ? " (draußen)" : ""), p.station === null ? "–" : fmt(p.station, 1), fmt(p.offsetBefore), fmt(p.offset), fmt(p.residual), p.within === null ? "–" : p.within ? "ja" : "nein", ...(remarks ? [p.remark ?? ""] : [])]) { const td = document.createElement("td"); td.textContent = String(v); tr.append(td); }
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
el("order").addEventListener("change", () => el("budget").classList.toggle("hidden", el("order").value !== "budget"));
el("cancel").addEventListener("click", cancel);
el("reset").addEventListener("click", () => { for (const id of ["tra", "points", "zwang", "endE", "endN", "endT", "speed", "hold"]) el(id).value = ""; el("holdRadii").checked = false; el("order").value = "points"; el("budget").classList.add("hidden"); el("result").classList.add("hidden"); status(""); last = null; });
el("dlTra").addEventListener("click", () => last && download((last.report.input.tra || "plan.TRA").replace(/\.tra$/i, "") + "_axtran2.TRA", last.tra, "application/octet-stream"));
el("dlReport").addEventListener("click", () => last && download("report.json", JSON.stringify(last.report, null, 2), "application/json"));
el("dlCsv").addEventListener("click", () => last && download("residuen.csv", last.csv, "text/csv"));
