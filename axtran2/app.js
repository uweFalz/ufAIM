// axtran2/app.js
//
// The page: files and numbers in, a worker run, the result shown and
// offered as downloads. No storage, no canonical truth, no network.

import { residualChartSvg } from "../src/services/axtran2/residualChart.js";
import { runInWorker } from "../src/services/axtran2/workerRun.js";
import { alignmentPictureModel, alignmentPictureSvg, pictureProbe, pictureReadout, recordGroup, holdMap, holdTyped } from "../src/services/axtran2/alignmentPicture.js";
import { recordListHtml, describeLimit, endMiss } from "../src/services/axtran2/recordList.js";
import { formatHold } from "../src/services/axtran2/heldRecords.js";
import { parseAllEdits, formatEdits, isInsertKey, insertOf, INSERT_TYPES, TRANSITION_FAMILIES } from "../src/services/axtran2/recordEdits.js";
import { PROJECT_LINES, FILE_LINES, assignProjectFiles, describeTra, describeGra, projectLinesModel, projectTableHtml, fitSummary, gradientSummary } from "../src/services/axtran2/trackProject.js";
import { fitGraFromBytes } from "../src/services/axtran2/fitGraCore.js";

const el = (id) => document.getElementById(id);
// what the list or the picture could not take is said at the list as well: the status line is a
// screen above it, and a field that only went back to its value said nothing
const listNote = (text = "") => { el("listNote").textContent = text; el("listNote").classList.toggle("hidden", !text); };
const status = (text, kind = "info") => { el("status").textContent = text; el("status").dataset.kind = kind; listNote(); };
const refuse = (text) => { status(text, "error"); listNote(text); };
const fmt = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : "–");

let running = null;
let ticker = null;
let last = null;
// the picture: its model, how wide it is drawn, and the locks set but not yet computed
const picture = { model: null, width: 0, zoom: 1, wanted: null, edits: null, insertAfter: null };
// a lock recomputes on its own while a run is this quick; a long run waits for Optimieren
const LIVE_SECONDS = 3;

// The 7L project: up to seven lines, five of them files. The form below works on one
// axis at a time - the active line; every axis keeps its own Aufmaß, its own fields
// and its own result, and takes them back when it becomes the active one again.
const AXES = PROJECT_LINES.filter((line) => line.kind === "TRA").map((line) => line.key);
const LINE_FIELDS = ["tolerance", "zwangTolerance", "speed", "hold", "edits", "iterations", "order", "budget", "endE", "endN", "endT"];
const newLine = () => ({ file: null, description: null, error: null, assumed: false, points: null, zwang: null, fields: null, last: null, gradient: null });
const project = { active: "re-TRA", lines: new Map(FILE_LINES.map((key) => [key, newLine()])) };
const setFiles = (input, file) => { const transfer = new DataTransfer(); if (file) transfer.items.add(file); input.files = transfer.files; };

function drawProject() {
	const state = {};
	for (const [key, line] of project.lines) {
		const active = key === project.active;
		const result = active ? last : line.last;
		state[key] = { file: line.file?.name ?? null, description: line.description, error: line.error, assumed: line.assumed,
			points: Boolean(active ? el("points").files?.[0] : line.points), ...(result ? { fit: fitSummary(result.report) } : {}),
			...(line.gradient ? { gradient: gradientSummary(line.gradient.report) } : {}) };
	}
	// built from numbers and escaped labels: safe to set as markup
	el("projectLines").innerHTML = projectTableHtml(projectLinesModel(state, project.active));
	const line = PROJECT_LINES.find((l) => l.key === project.active);
	el("activeLine").textContent = `– ${project.active}, ${line.words}`;
}

/** what a file holds, kept on its line; an unreadable file says why */
async function describeLine(line, kind) {
	line.description = null; line.error = null;
	if (!line.file) return;
	try {
		const bytes = new Uint8Array(await line.file.arrayBuffer());
		line.description = kind === "TRA" ? describeTra(bytes) : await describeGra(bytes, line.file.name);
	} catch (error) { line.error = String(error?.message ?? error); }
}

/** the active axis' Aufmaß, fields and result go back onto its line */
function saveActive() {
	const line = project.lines.get(project.active);
	line.points = el("points").files?.[0] ?? null;
	line.zwang = el("zwang").files?.[0] ?? null;
	line.fields = { ...Object.fromEntries(LINE_FIELDS.map((id) => [id, el(id).value])), holdRadii: el("holdRadii").checked };
	line.last = last;
}

/** another axis becomes the one the form works on */
function switchLine(key) {
	if (!AXES.includes(key) || key === project.active) return false;
	if (running) { status("Ein Lauf rechnet noch: die Linie wechselt danach.", "info"); return false; }
	saveActive();
	project.active = key;
	const line = project.lines.get(key);
	setFiles(el("tra"), line.file); setFiles(el("points"), line.points); setFiles(el("zwang"), line.zwang);
	if (line.fields) { for (const id of LINE_FIELDS) el(id).value = line.fields[id]; el("holdRadii").checked = line.fields.holdRadii; }
	// a line seen for the first time: the tolerances and the order stay as they are, what names records or a place does not
	else { for (const id of ["speed", "hold", "edits", "endE", "endN", "endT"]) el(id).value = ""; el("holdRadii").checked = false; }
	el("budget").classList.toggle("hidden", el("order").value !== "budget");
	last = line.last;
	picture.model = null; picture.wanted = null; picture.edits = null; picture.insertAfter = null;
	if (last) show(last); else el("result").classList.add("hidden");
	drawProject();
	status(`${key}: ${line.file ? line.file.name : "noch keine Datei"}${last ? ", mit dem Ergebnis des letzten Laufs" : ""}.`);
	return true;
}

/** the files of a project onto their lines */
async function loadProject(files) {
	if (running || files.length === 0) return;
	saveActive();
	const byName = new Map(files.map((file) => [file.name, file]));
	const taken = Object.fromEntries([...project.lines].filter(([, line]) => line.file).map(([key, line]) => [key, line.file.name]));
	const assigned = assignProjectFiles(files.map((file) => file.name), taken);
	for (const [key, name] of Object.entries(assigned.lines)) {
		const line = project.lines.get(key);
		// another file on the line: its Aufmaß stays, what named the old file's records goes
		Object.assign(line, { file: byName.get(name), assumed: assigned.assumed.some((a) => a.name === name), last: null, gradient: null, fields: line.fields ? { ...line.fields, hold: "", edits: "" } : null });
		await describeLine(line, key.endsWith("TRA") ? "TRA" : "GRA");
		if (key === project.active) { setFiles(el("tra"), line.file); el("hold").value = ""; el("edits").value = ""; last = null; el("result").classList.add("hidden"); }
	}
	el("projectNote").textContent = [
		...assigned.assumed.map((a) => `${a.name} als ${a.line} genommen: der Name nennt weder KM noch RE noch LI.`),
		assigned.unassigned.length ? `Nicht zugeordnet: ${assigned.unassigned.map((u) => `${u.name} (${u.why})`).join("; ")}.` : "",
	].filter(Boolean).join(" ");
	// the form works on an axis that has a file, if there is one
	const firstLoaded = AXES.find((key) => project.lines.get(key).file);
	if (!project.lines.get(project.active).file && firstLoaded && switchLine(firstLoaded)) return;
	drawProject();
	status(`Projekt: ${[...project.lines.values()].filter((line) => line.file).length} von ${FILE_LINES.length} Dateien geladen.`);
}

// The gradient of a track adjusted to the measured heights: the heights come from the Aufmaß of the
// track's axis, a point's place from its foot on the line the gradient is stationed along - the
// kilometre line where it carries the gradient's stations, the track's own axis otherwise. Quick
// (a linear least squares), so it runs on the page.
async function fitGradientLine(key) {
	if (running) { status("Ein Lauf rechnet noch: die Gradiente danach.", "info"); return; }
	const gradient = project.lines.get(key);
	if (!gradient?.file || gradient.error) return;
	saveActive();
	const track = key.slice(0, 2);
	const axis = project.lines.get(`${track}-TRA`);
	try {
		if (!axis.points) throw new Error(`das Aufmaß von ${track}-TRA fehlt. Die Höhen kommen aus dem Aufmaß der Achse dieses Gleises: „bearbeiten“ an ${track}-TRA, dann das Aufmaß wählen`);
		const graBytes = new Uint8Array(await gradient.file.arrayBuffer());
		const points = await axis.points.text();
		const options = { tolerance: Number(el("heightTolerance").value) || 0.02, hold: el("breakHold").value.trim(), heightOffset: Number(String(el("heightOffset").value).trim().replace("−", "-").replace(",", ".")) || 0 };
		const lines = [["km-TRA", project.lines.get("km-TRA")], [`${track}-TRA`, axis]].filter(([, line]) => line.file && !line.error);
		if (lines.length === 0) throw new Error("keine Achse ist geladen, an der die Gradiente stationiert sein kann (km-TRA oder die Achse des Gleises)");
		let found = null;
		const off = [];
		for (const [lineKey, line] of lines) {
			try {
				const result = await fitGraFromBytes({ graBytes, graName: gradient.file.name, lineBytes: new Uint8Array(await line.file.arrayBuffer()), lineName: line.file.name, points, ...options });
				found = { report: result.report, gra: result.gra, csv: result.csv, lineKey };
				break;
			} catch (error) { if (error?.code !== "GRADIENT_OFF_LINE") throw error; off.push(`${lineKey} (${line.file.name})`); }
		}
		if (!found) throw new Error(`die Stationen der Gradiente liegen auf keiner geladenen Achse: ${off.join(", ")}`);
		gradient.gradient = found;
		showGradient(key);
		drawProject();
		const f = found.report.fit;
		status(`${key} ausgeglichen: rms ${fmt(f.rmsAfter)} m (vorher ${fmt(f.rmsBefore)} m), stationiert an ${found.lineKey}.`, "ok");
	} catch (error) {
		status(`${key}: ${String(error?.message ?? error)}.`, "error");
	}
}

let gradientShown = null;
function showGradient(key) {
	const result = project.lines.get(key)?.gradient;
	if (!result) { el("gradientResult").classList.add("hidden"); gradientShown = null; return; }
	gradientShown = key;
	const { report } = result;
	const { input, fit, verdict, checks } = report;
	el("gradientTitle").textContent = `Gradiente: ${key}`;
	el("gradientVerdict").textContent = `${input.gra}: ${input.breaks} Neigungswechsel, ${input.free} Höhen frei, ${input.points} von ${input.listed} Punkten mit Höhe auf der Gradiente. Stationiert an ${result.lineKey} (${input.stationing.line}); die Gradiente beginnt ${fmt(input.stationing.gradientBeginsAt, 2)} m hinter deren Anfang${input.kilometreJumps ? `, ${input.kilometreJumps} Kilometersprünge` : ""}. Verdikt: ${verdict.status} nach ${verdict.iterations} Schritten.`;
	el("gradientNumbers").replaceChildren(...[
		[`${fmt(fit.rmsBefore)} m`, `rms vorher, max ${fmt(fit.maxBefore)} m`],
		[`${fmt(fit.rmsAfter)} m`, `rms nachher, max ${fmt(fit.maxAfter)} m`],
		[`${fit.outsideAfter} von ${input.points}`, `außerhalb der Toleranz (vorher ${fit.outsideBefore})`],
		[`${fmt(checks.steepestPermille, 2)} ‰`, "steilste Neigung nach dem Ausgleich"],
	].map(([big, small]) => { const d = document.createElement("div"); d.className = "number"; const b = document.createElement("b"); b.textContent = big; const s = document.createElement("span"); s.textContent = small; d.append(b, s); return d; }));
	const undetermined = report.breaks.filter((b) => b.free && b.determined === false);
	el("gradientNotes").textContent = [
		undetermined.length ? `Ohne Messung am Plan geblieben: Neigungswechsel ${undetermined.map((b) => b.number).join(", ")}.` : "",
		input.excluded.length ? `Nicht im Ausgleich: ${input.excluded.length} Punkte (${[...new Set(input.excluded.map((e) => e.why))].join("; ")}).` : "",
		checks.overlaps.length ? `Ausrundungen überschneiden sich zwischen den Neigungswechseln ${checks.overlaps.map((o) => `${o.between[0]} und ${o.between[1]} (um ${fmt(o.by, 2)} m)`).join(", ")}.` : "",
		input.carriedRecords ? `${input.carriedRecords} Rampensätze hinter den Neigungswechseln sind unverändert übernommen.` : "",
	].filter(Boolean).join(" ");
	const table = el("gradientBreaks");
	table.replaceChildren();
	const head = document.createElement("tr");
	for (const h of ["Nr", "Station", "Höhe Plan [m]", "Höhe Ausgleich [m]", "Änderung [mm]", "Neigung danach [‰]", "Ausrundung", "Punkte", "Stand"]) { const th = document.createElement("th"); th.textContent = h; head.append(th); }
	table.append(head);
	for (const b of report.breaks) {
		const tr = document.createElement("tr");
		const rounding = b.holds === "radius" ? `R ${fmt(b.radiusAfter, 0)} gehalten, T ${fmt(b.tangentAfter, 2)}` : b.holds === "tangent" ? `T ${fmt(b.tangentAfter, 2)} gehalten, R ${fmt(b.radiusAfter, 0)}` : "–";
		const state = !b.free ? b.why : b.determined === false ? "frei, ohne Messung am Plan" : "frei";
		const changed = Math.abs(b.change) > 5e-5;
		[b.number, fmt(b.station, 3), fmt(b.heightBefore, 4), fmt(b.heightAfter, 4), changed ? `${b.change >= 0 ? "+" : ""}${fmt(b.change * 1000, 1)}` : "0", b.gradeAfter === null ? "–" : fmt(Math.abs(b.gradeAfter) < 5e-7 ? 0 : b.gradeAfter * 1000, 3), rounding, b.points, state].forEach((v, c) => {
			const td = document.createElement("td"); td.textContent = String(v); if (c >= 1 && c <= 5) td.className = c === 3 && changed ? "num changed" : "num"; tr.append(td);
		});
		table.append(tr);
	}
	// the chart is built from numbers only and escapes its labels: safe to set as markup
	el("gradientChart").innerHTML = residualChartSvg(report.points.map((p) => ({ kind: "measured", station: p.u, offsetBefore: p.before, offset: p.after, within: p.within })), { tolerance: input.tolerance }) || "<p>Keine Kurve: zu wenige Punkte.</p>";
	el("gradientResult").classList.remove("hidden");
}

/** every axis that has its file and its Aufmaß, one after the other */
async function runAll() {
	if (running) return;
	saveActive();
	const todo = AXES.filter((key) => { const line = project.lines.get(key); return line.file && line.points; });
	if (todo.length === 0) { status("Keine Achse hat Datei und Aufmaß: „bearbeiten“ an einer Achse, dann ihr Aufmaß wählen.", "error"); return; }
	const done = [];
	for (const key of todo) {
		switchLine(key);
		const before = last;
		await run();
		done.push(last && last !== before ? `${key} ${last.report.verdict.status}` : `${key} nicht gerechnet (${el("status").textContent})`);
	}
	status(`Achsen gerechnet: ${done.join("; ")}.`, done.some((d) => d.includes("nicht gerechnet")) ? "error" : "ok");
}

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

// `lock`: the run a click on a lock started. The result stays on the page
// while it runs, and a hold the fit refuses is taken back.
// `change`: a lock or a value from the picture or the list started this run; what the
// fields held before, to go back to if the fit refuses it
async function run({ change = null } = {}) {
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
			edits: el("edits").value.trim(),
			order: el("order").value === "budget" ? { budget: Number(el("budget").value) || 0 } : el("order").value,
		};
		const bytes = await traFile.arrayBuffer();
		el("cancel").classList.remove("hidden");
		if (!change) el("result").classList.add("hidden");
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
		if (!message.ok) throw Object.assign(new Error(`${message.code}: ${message.message}`), { code: message.code });
		// a value or a lock the geometry cannot close is not taken: the picture stays with the last fit
		const miss = change ? endMiss(message.report) : null;
		if (miss !== null) throw Object.assign(new Error("the fit does not reach the end"), { code: "END_NOT_REACHED", miss });
		last = message;
		project.lines.get(project.active).last = message;
		picture.wanted = null;
		picture.edits = null;
		picture.insertAfter = null;
		show(message);
		drawProject();
		status(`Fertig nach ${fmt(message.seconds, 1)} s.${message.attempts > 1 ? ` Das Rechenprogramm lud erst im ${message.attempts}. Versuch.` : ""}`, "ok");
	} catch (error) {
		clearInterval(ticker);
		const cancelled = error?.code === "CANCELLED";
		if (change) {
			// the picture shows the last fit: the fields go back to what that fit had
			el("hold").value = change.hold;
			el("edits").value = change.edits;
			picture.wanted = null;
			picture.edits = null;
			drawPicture();
		}
		const what = change?.what === "value" ? "Der Wert" : "Das Schloss";
		const refused = change && (error?.code === "NOTHING_FREE" || error?.code === "OVER_CONSTRAINED");
		const unclosed = change && error?.code === "END_NOT_REACHED";
		status(cancelled ? `Abgebrochen nach ${Math.round((Date.now() - started) / 1000)} s. Der Plan ist unverändert.`
			: unclosed ? `${what} wurde nicht ${change.what === "value" ? "übernommen" : "gesetzt"}: so erreicht die Trasse ihr Ende nicht mehr, der Fit endete ${fmt(error.miss, error.miss < 1 ? 3 : 1)} m daneben. Was sonst gehalten ist, lässt dafür zu wenig Spiel${change.what === "value" ? "; ein Wert näher am Bestand oder ein gelöstes Schloss hilft" : ""}. Bild und Liste zeigen den letzten Fit.`
			: refused ? `${what} wurde nicht ${change.what === "value" ? "übernommen" : "gesetzt"}: so bliebe zu wenig frei, um Anfang und Ende der Trasse noch zu treffen.`
			: change ? `${what} wurde nicht ${change.what === "value" ? "übernommen" : "gesetzt"}. ${workerFailure(error)}` : workerFailure(error), cancelled ? "info" : "error");
		if (change && !cancelled) listNote(el("status").textContent);
	} finally {
		running = null;
		el("cancel").classList.add("hidden");
		el("run").disabled = false;
	}
}

function show({ report, csv }) {
	const { verdict, fit, input } = report;
	el("verdict").textContent = `${input.tra}: ${input.elements} Elemente, ${input.free} freie Größen, ${input.points} Punkte im Fit${input.excludedPoints?.length ? ` (${input.excludedPoints.length} ohne Fußpunkt am Plan ausgeschlossen)` : ""}, V ${input.speedKmh} km/h. Verdikt: ${verdict.status}${verdict.reason ? " / " + verdict.reason : ""} nach ${verdict.iterations} Schritten.${fit.atLimits?.length ? ` An der Grenze: ${fit.atLimits.map((l) => `${l.records.length === 1 ? "Satz" : "Sätze"} ${l.records.join(", ")}: ${describeLimit(l)}`).join("; ")}.` : ""}`;
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
		: sp.basis === "turnout" ? `Geschwindigkeit: V ${sp.kmh} km/h angenommen, weil ${/, Stammgleis$/.test(sp.turnout.designation) ? "das Stammgleis der" : /^Kr\b|gerade Fahrt/.test(sp.turnout.designation) ? "die gerade Fahrt über die" : "der Zweig der"} ${sp.turnout.designation.replace(/, Stammgleis$/, "")} (Satz ${sp.turnout.records.join(", ")}) nicht mehr zulässt (Ril 800.0120A01).${admits} Ändern im Feld Entwurfsgeschwindigkeit.`
		: `Geschwindigkeit: V ${sp.kmh} km/h angenommen, das schnellste Hauptbahn-Profil, das Radien und Längen der Trasse zulassen.${admits} Ändern im Feld Entwurfsgeschwindigkeit.`;
	el("cantResult").textContent = `Überhöhung: ${c.present ? "aus der Datei übernommen, vom Fit nicht verändert" : "die Datei trägt keine"}. Bei V ${c.speedKmh} km/h und zulässigem Fehlbetrag ${fmt(c.maximumDeficiencyMm, 0)} mm liegen nach dem Fit ${c.exceededAfter} von ${c.arcs.length} Bögen darüber (vorher ${c.exceededBefore}).${worst.length ? ` Am stärksten: ${worst.map((a) => `${a.id} mit ${fmt(a.after.deficiencyMm, 0)} mm bei R ${fmt(Math.abs(a.after.radius), 0)} m und u ${fmt(a.cantMm, 0)} mm`).join(", ")}.` : ""}${c.excessiveCant ? ` ${c.excessiveCant} Bögen tragen mehr als die ${fmt(c.maximumCantMm, 0)} mm der EBO.` : ""}`;
	const rule = (z) => z.enforcement === "at-least" ? "mindestens" : z.enforcement === "at-most" ? "höchstens" : "verlangt";
	el("zwangResult").textContent = zw.length ? "Zwangspunkte: " + zw.map((z) => `${z.name} ${fmt(z.offset, 4)} m (${rule(z)} ${fmt(z.target)} m${z.within === false ? ", verletzt" : ""})`).join(", ") : "";
	const span = (records) => (records.length > 1 ? `Sätze ${records[0]}–${records[records.length - 1]}` : `Satz ${records[0]}`);
	const inp = report.input;
	el("holdResult").textContent = [
		inp.turnouts.length ? `Weichen: ${inp.turnouts.map((t) => `${t.inserted ? `eingefügt nach Satz ${t.inserted.after}` : span(t.records)} ${t.designation} (${t.declared ? `Typ gesetzt, erkannt war ${t.declared.was ?? "keine Weiche"}; ` : t.inserted ? "" : "erkannt, "}${t.held ? "gehalten" : "nicht gehalten"})`).join(", ")}.${inp.turnouts.some((t) => !t.held) ? " Das Wort Weichen im Feld Sätze halten hält sie fest." : ""}` : "",
		inp.releasedTurnouts?.length ? `Keine Weiche mehr: ${inp.releasedTurnouts.map((t) => `${span(t.records)} (erkannt war ${t.designation})`).join(", ")}.` : "",
		inp.heldRecords.length ? `Gehalten wie in der Datei: ${formatHold(inp.heldRecords)} (L nur die Länge, R nur der Radius).` : "",
		inp.edits?.length ? `Gestartet mit geänderten Werten statt der Datei: ${formatEdits(inp.edits)}.` : "",
		inp.structure?.removed?.length ? `Herausgenommen: Satz ${inp.structure.removed.join(", ")}.` : "",
		inp.structure?.inserted?.length ? `Eingefügt: ${inp.structure.inserted.map((i) => `nach Satz ${i.after} ${i.turnout && i.part === "main" ? i.turnout : i.turnout ? `${i.turnout} (${i.part === "arc" ? "Bogen" : i.part === "arc2" ? "zweiter Bogen" : i.part === "transition" ? "Klothoide" : i.part === "junction" ? "Anfangskrümmung, 0 m" : i.part === "straight" ? "Gerade" : "Endstück"})` : INSERT_TYPES[i.type]}${i.family && i.family !== "clothoid" ? ` (${TRANSITION_FAMILIES[i.family]})` : ""} ${fmt(i.length, 2)} m${i.radius !== null ? `, R ${fmt(i.radius, 0)}` : ""}`).join("; ")}.` : "",
		inp.holdRadii ? "Alle Radien gehalten, nur die Längen sind frei." : "",
	].filter(Boolean).join(" ");
	drawPicture();
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

// The picture is built from the report's numbers and escapes its labels, so
// it is safe to set as markup. Its width follows the page and the zoom; text
// and locks keep their size, so a wider picture has room for more locks.
function drawPicture() {
	if (!last) return;
	picture.model = alignmentPictureModel(last.report);
	if (!picture.model) { el("picture").innerHTML = "<p style=\"padding:0 12px\">Kein Bild: der Bericht trägt keine Elemente.</p>"; return; }
	picture.width = Math.max(640, Math.round((el("pictureWrap").clientWidth || 1000) * picture.zoom));
	el("picture").innerHTML = alignmentPictureSvg(picture.model, { width: picture.width, held: picture.wanted });
	el("zoomValue").textContent = `${picture.zoom}×`;
	drawList();
}

// the listing shows the same hold as the picture, from the same model
function drawList() {
	el("records").innerHTML = picture.model ? recordListHtml(picture.model, { held: picture.wanted, edits: picture.edits, insertAfter: picture.insertAfter }) : "";
	// the insert form shows the fields its kind needs
	const form = el("records").querySelector("form[data-insert-after]");
	if (form) { const kind = () => { for (const l of form.querySelectorAll("label[data-for]")) l.hidden = !l.dataset.for.split(" ").includes(form.elements.kind.value); }; form.elements.kind.addEventListener("change", kind); kind(); form.elements.len.focus(); }
}

function pictureX(event) {
	const svg = el("picture").querySelector("svg");
	if (!svg || !picture.model) return null;
	const box = svg.getBoundingClientRect();
	return ((event.clientX - box.left) / box.width) * picture.width;
}

function pictureMove(event) {
	const px = pictureX(event);
	const probe = px === null ? null : pictureProbe(picture.model, picture.width, px);
	const part = (role) => el("picture").querySelector(`[data-role="${role}"]`);
	const set = (node, attributes) => { if (node) for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, String(v)); };
	if (!probe) {
		for (const role of ["cursor", "highlight", "point"]) set(part(role), { visibility: "hidden" });
		el("pictureReadout").textContent = "";
		return;
	}
	set(part("cursor"), { x1: probe.x, x2: probe.x, visibility: "visible" });
	const column = probe.record && el("picture").querySelector(`rect[data-record="${probe.record.number}"]`);
	set(part("highlight"), column ? { x: column.getAttribute("x"), width: column.getAttribute("width"), visibility: "visible" } : { visibility: "hidden" });
	set(part("point"), probe.point ? { cx: probe.pointX, cy: probe.pointY, visibility: "visible" } : { visibility: "hidden" });
	el("pictureReadout").textContent = pictureReadout(picture.model, probe);
}

// A click on a record, its lock or its box: the quantity named, or the whole
// record; a turnout moves as one, whole. The field Sätze halten is the one
// place the hold is kept; the lock writes into it, and what is typed there is
// what the next run holds. Returns whether the click was taken.
function toggleLock(number, quantity = "both") {
	if (!last || !picture.model || running) return false;
	const record = picture.model.records.find((r) => r.number === number);
	if (!record || !record.lockable) return false;
	const wanted = holdMap(picture.model, picture.wanted);
	const group = recordGroup(picture.model, number);
	const whole = quantity === "both" || group.length > 1 || record.turnout || !record.hasRadius;
	const quantities = whole ? ["length", "radius"] : [quantity];
	const on = group.every((n) => quantities.every((q) => wanted.get(n)?.[q]));
	for (const n of group) {
		const q = { ...(wanted.get(n) ?? { length: false, radius: false }) };
		for (const name of quantities) q[name] = !on;
		q.length || q.radius ? wanted.set(n, q) : wanted.delete(n);
	}
	const previous = fieldsOfLastRun("lock");
	el("hold").value = formatHold(wanted);
	if (last.seconds <= LIVE_SECONDS) { run({ change: previous }); return true; }
	// a long fit does not start unasked: the lock is noted, dashed, until Optimieren
	picture.wanted = wanted;
	drawPicture();
	status(`Schloss vorgemerkt (Sätze halten: ${el("hold").value || "keine"}). Der letzte Lauf dauerte ${fmt(last.seconds, 0)} s, darum rechnet ein Schloss nicht von selbst neu: Optimieren rechnet.`);
	return true;
}

// The edits the last fit started from, read back from its report: the
// values, the records taken out, the records and turnouts put in
function editsOfLastRun() {
	const inp = last.report.input;
	// `turnout` only where a type was declared: null for "keine", else the spec
	const values = new Map((inp.edits ?? []).map((e) => [e.record, { ...(e.length !== null ? { length: e.length } : {}), ...(e.radius !== null ? { radius: e.radius } : {}), ...(e.family ? { family: e.family } : {}), ...(e.turnout !== undefined ? { turnout: e.turnout } : {}) }]));
	const inserted = new Map();
	const put = (after, index, spec) => { const list = inserted.get(after) ?? []; list[index - 1] = spec; inserted.set(after, list); };
	for (const i of inp.structure?.inserted ?? []) if (!i.turnout) put(i.after, i.index, { type: i.type, length: i.length, ...(i.radius !== null ? { radius: i.radius } : {}), ...(i.family ? { family: i.family } : {}) });
	for (const t of inp.structure?.turnouts ?? []) put(t.after, t.index, t.route ? { type: "crossing", kind: t.kind, radius: t.radius, ratio: t.ratio, side: t.side, route: t.route } : { type: "turnout", radius: t.radius, ...(t.radiusEnd ? { radiusEnd: t.radiusEnd } : {}), ratio: t.ratio, side: t.side, orientation: t.orientation, ...(t.bent ? { mainRadius: t.bent.mainRadius } : {}) });
	return { values, removed: new Set(inp.structure?.removed ?? []), inserted };
}

/** what the fields said for the last fit: where a refused change goes back to */
function fieldsOfLastRun(what) {
	return { what, hold: formatHold(last.report.input.heldRecords), edits: formatEdits(editsOfLastRun()) };
}

// The edits as they stand: typed and not yet computed, else what the last fit started from
function editsNow() {
	return parseAllEdits(picture.edits ?? editsOfLastRun());
}

// Edits changed from the list: the field Werte ändern is the one place they are
// kept; it is written, and the fit runs again if the last one was short, else
// the change is noted until Optimieren. `what` names it for the message.
// `hold`: the hold that goes with it (a typed value is held), written to Sätze halten.
function applyEdits(all, what, hold = null) {
	const previous = fieldsOfLastRun(what);
	picture.insertAfter = null;
	el("edits").value = formatEdits(all);
	if (hold) el("hold").value = formatHold(hold);
	if (last.seconds <= LIVE_SECONDS) { run({ change: previous }); return true; }
	picture.edits = el("edits").value;
	if (hold) picture.wanted = hold;
	drawPicture();
	status(`${what === "value" ? "Wert" : "Änderung"} vorgemerkt (Werte ändern: ${el("edits").value || "keine"}${hold ? `; Sätze halten: ${el("hold").value || "keine"}` : ""}). Der letzte Lauf dauerte ${fmt(last.seconds, 0)} s, darum rechnet das nicht von selbst neu: Optimieren rechnet.`);
	return true;
}

// A value typed in the list: the length, radius or type a record starts from
// in the next fit; for an inserted record its token. A typed length or radius of a
// record of the file is held as well - its box shows it and lets it go again (a value
// only started from went back to the fit's own; Uwe, 2026-11-12). Returns whether the
// value was taken.
function editValue(key, field, text) {
	if (!last || !picture.model || running) return false;
	const record = picture.model.records.find((r) => String(r.number) === String(key));
	if (!record || !record.lockable) return false;
	if (field === "turnout" || field === "turnoutMain") return editTurnout(record, field, text);
	if (record.turnout) return false;
	const value = field === "family" ? String(text) : Number(String(text).trim().replace("−", "-").replace(",", "."));
	if (field !== "family" && (!Number.isFinite(value) || (field === "length" ? !(value > 0) : !(Math.abs(value) > 0)))) {
		refuse(field === "length" ? `„${text}“ ist keine Länge: eine Zahl größer als null, Dezimalkomma erlaubt.` : `„${text}“ ist kein Radius: eine Zahl ungleich null, mit dem Vorzeichen der Datei.`);
		drawList();
		return false;
	}
	// the sign is the side the arc turns to: a value does not change it
	if (field === "radius" && !isInsertKey(key) && Number.isFinite(record.fileRadius) && record.fileRadius !== 0 && Math.sign(value) !== Math.sign(record.fileRadius)) {
		refuse(`„${text}“ wurde nicht übernommen: der Radius von Satz ${record.number} ist in der Datei ${record.fileRadius < 0 ? "negativ" : "positiv"} (${fmt(record.fileRadius, 0)} m), und das Vorzeichen ist die Seite, nach der der Bogen dreht. Gemeint ist wohl ${fmt(-value, 0)}.`);
		drawList();
		return false;
	}
	const all = editsNow();
	if (isInsertKey(key)) {
		const { after, index } = insertOf(key);
		const spec = all.inserted.get(after)?.[index - 1];
		if (!spec) return false;
		spec[field] = value;
		return applyEdits(all, "value");
	}
	const number = Number(key);
	const file = field === "length" ? record.fileLength : field === "radius" ? record.fileRadius : record.fileFamily;
	const entry = { ...(all.values.get(number) ?? {}) };
	// back at the file's value, as the list shows it (centimetres, whole metres of radius), the edit is gone
	const same = field === "family" ? value === file : Math.abs(value - file) < (field === "length" ? 0.005 : 0.5);
	if (same) delete entry[field]; else entry[field] = value;
	Object.keys(entry).length ? all.values.set(number, entry) : all.values.delete(number);
	return applyEdits(all, "value", field === "family" ? null : holdTyped(picture.model, picture.wanted, number, field));
}

// A turnout's type chosen on an arc of the file, or the main track's radius beside
// it: "3W=300-1/9:auf-800" in the field Werte ändern, "3W=keine" for no turnout where
// the recognition found one; the type the recognition found, straight, is no edit.
function editTurnout(record, field, text) {
	if (record.inserted || isInsertKey(record.number)) return false;
	const all = editsNow();
	const number = Number(record.number);
	const entry = { ...(all.values.get(number) ?? {}) };
	const fileRef = /(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)-1:(\d+(?:\.\d+)?)/.exec(record.fileTurnout ?? "");
	// what stands now: the declaration, else what the recognition found on the record
	const current = entry.turnout !== undefined ? entry.turnout : fileRef ? { radius: Number(fileRef[1].split("/")[0]), ...(fileRef[1].includes("/") ? { radiusEnd: Number(fileRef[1].split("/")[1]) } : {}), ratio: Number(fileRef[2]) } : null;
	let next;
	if (field === "turnout") {
		const ref = String(text).trim();
		if (ref === "") next = null;
		else {
			const [radii, ratio] = ref.split("-1/");
			const [radius, radiusEnd] = radii.split("/").map(Number);
			next = { radius, ...(radiusEnd ? { radiusEnd } : {}), ratio: Number(ratio), ...(current?.mainRadius !== undefined && current?.mainRadius !== null ? { mainRadius: current.mainRadius } : {}) };
		}
	} else {
		if (!current) return false;
		const mainText = String(text).trim();
		const mainRadius = mainText === "" ? null : Number(mainText.replace("−", "-").replace(",", "."));
		if (mainRadius !== null && !(Math.abs(mainRadius) > 0)) { refuse("Der Radius des Stammgleises ist eine Zahl ungleich null, mit dem Vorzeichen der Datei; leer für eine gerade Weiche."); drawList(); return false; }
		next = { ...current };
		if (mainRadius === null) delete next.mainRadius; else next.mainRadius = mainRadius;
	}
	// the type the recognition found, unbent, is the file's: no edit
	const same = next === null ? !fileRef : fileRef && `${next.radius}${next.radiusEnd ? `/${next.radiusEnd}` : ""}-1/${next.ratio}` === `${fileRef[1]}-1/${fileRef[2]}` && next.mainRadius === undefined && next.orientation === undefined;
	if (same) delete entry.turnout; else entry.turnout = next;
	Object.keys(entry).length ? all.values.set(number, entry) : all.values.delete(number);
	return applyEdits(all, "value");
}

// A button in the list: a record out, back in, a put-in record dropped, the form to put one in
function structureAction(action, key) {
	if (!last || !picture.model || running) return false;
	const all = editsNow();
	if (action === "remove") { all.removed.add(Number(key)); return applyEdits(all, "structure"); }
	if (action === "restore") { all.removed.delete(Number(key)); return applyEdits(all, "structure"); }
	if (action === "drop") {
		const { after, index } = insertOf(key);
		const list = all.inserted.get(after) ?? [];
		list.splice(index - 1, 1);
		list.length ? all.inserted.set(after, list) : all.inserted.delete(after);
		return applyEdits(all, "structure");
	}
	if (action === "insert-after") { picture.insertAfter = picture.insertAfter === Number(key) ? null : Number(key); drawList(); return true; }
	if (action === "cancel") { picture.insertAfter = null; drawList(); return true; }
	return false;
}

// The form under a row: what goes in after that record
function insertFromForm(form) {
	if (!last || !picture.model || running) return false;
	const after = Number(form.dataset.insertAfter);
	const read = (name) => Number(String(form.elements[name].value).trim().replace("−", "-").replace(",", "."));
	const type = form.elements.kind.value;
	const all = editsNow();
	if (type === "turnout") {
		// "190-1/9", or "7000/6000-1/42" for a branch of two radii
		const [radii, ratio] = form.elements.wshape.value.split("-1/");
		const [radius, radiusEnd] = radii.split("/").map(Number);
		const spec = { type, radius, ...(radiusEnd ? { radiusEnd } : {}), ratio: Number(ratio), side: form.elements.wside.value, orientation: form.elements.worient.value, ...(form.elements.wroute.value === "main" ? { route: "main" } : {}) };
		if (spec.route === "main" && spec.orientation !== "arc") spec.orientation = "WA"; // the main track reads the same from both ends
		const mainText = String(form.elements.wmain.value).trim();
		if (mainText) {
			const mainRadius = read("wmain");
			if (!(Math.abs(mainRadius) > 0)) { refuse("Der Radius des Stammgleises ist eine Zahl ungleich null, mit dem Vorzeichen der Datei; leer für eine gerade Weiche."); return false; }
			spec.mainRadius = mainRadius;
		}
		if (!all.inserted.has(after)) all.inserted.set(after, []);
		all.inserted.get(after).push(spec);
		return applyEdits(all, "structure");
	}
	if (type === "crossing") {
		// "DKW:190-1/9", or "Kr:1/9" for a plain crossing (no side, no route)
		const [kind, rest] = form.elements.kshape.value.split(":");
		if (!all.inserted.has(after)) all.inserted.set(after, []);
		if (kind === "Kr") all.inserted.get(after).push({ type, kind, radius: null, ratio: Number(rest.slice(2)), side: null, route: "straight" });
		else {
			const [radius, ratio] = rest.split("-1/").map(Number);
			all.inserted.get(after).push({ type, kind, radius, ratio, side: form.elements.kside.value, route: form.elements.kroute.value });
		}
		return applyEdits(all, "structure");
	}
	const spec = { type, length: read("len") };
	if (!(spec.length > 0)) { refuse("Die Länge des neuen Satzes muss größer als null sein."); return false; }
	if (type === "arc") { spec.radius = read("rad"); if (!(Math.abs(spec.radius) > 0)) { refuse("Der Bogen braucht einen Radius ungleich null, mit dem Vorzeichen der Datei."); return false; } }
	if (type === "transition") spec.family = form.elements.fam.value;
	if (!all.inserted.has(after)) all.inserted.set(after, []);
	all.inserted.get(after).push(spec);
	return applyEdits(all, "structure");
}

function download(name, data, type) {
	const url = URL.createObjectURL(new Blob([data], { type }));
	const a = document.createElement("a"); a.href = url; a.download = name; a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

el("run").addEventListener("click", () => run());
el("picture").addEventListener("mousemove", pictureMove);
el("picture").addEventListener("mouseleave", () => pictureMove({ clientX: -1e9 }));
el("picture").addEventListener("click", (event) => {
	const target = event.target.closest?.("[data-record]");
	if (target) toggleLock(Number(target.dataset.record), target.dataset.quantity ?? "both");
});
// a box in the listing is the same click; one not taken (a run in progress) is drawn back
el("records").addEventListener("change", (event) => {
	const field = event.target.closest?.("[data-field]");
	if (field) { if (!editValue(field.dataset.record, field.dataset.field, field.value)) drawList(); return; }
	const box = event.target.closest?.("input[data-record]");
	if (box && !toggleLock(Number(box.dataset.record), box.dataset.quantity ?? "both")) drawList();
});
el("records").addEventListener("click", (event) => {
	const button = event.target.closest?.("button[data-action]");
	if (button && !button.disabled) structureAction(button.dataset.action, button.dataset.record);
});
el("records").addEventListener("submit", (event) => {
	const form = event.target.closest?.("form[data-insert-after]");
	if (form) { event.preventDefault(); insertFromForm(form); }
});
// Enter in a field is the change, without leaving it
el("records").addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.matches?.("[data-field]")) event.target.blur(); });
// edits name records of one file: another file starts without them, and is the active line's file
el("tra").addEventListener("change", async () => {
	el("edits").value = "";
	const line = project.lines.get(project.active);
	Object.assign(line, { file: el("tra").files?.[0] ?? null, assumed: false, last: null });
	last = null;
	el("result").classList.add("hidden");
	await describeLine(line, "TRA");
	drawProject();
});
el("points").addEventListener("change", drawProject);
el("project").addEventListener("change", async () => { const files = [...(el("project").files ?? [])]; el("project").value = ""; await loadProject(files); });
el("projectLines").addEventListener("click", (event) => {
	const adjust = event.target.closest?.("button[data-gradient]");
	if (adjust) { fitGradientLine(adjust.dataset.gradient); return; }
	const button = event.target.closest?.("button[data-line]");
	if (button) switchLine(button.dataset.line);
});
const gradientNow = () => (gradientShown ? project.lines.get(gradientShown)?.gradient : null);
el("dlGra").addEventListener("click", () => { const g = gradientNow(); if (g) download((g.report.input.gra || "gradient.GRA").replace(/\.gra$/i, "") + "_axtran2.GRA", g.gra, "application/octet-stream"); });
el("dlGraReport").addEventListener("click", () => { const g = gradientNow(); if (g) download("gradiente_report.json", JSON.stringify(g.report, null, 2), "application/json"); });
el("dlGraCsv").addEventListener("click", () => { const g = gradientNow(); if (g) download("hoehen.csv", g.csv, "text/csv"); });
el("runAll").addEventListener("click", runAll);
const ZOOMS = [1, 2, 4, 8];
el("zoomIn").addEventListener("click", () => { picture.zoom = ZOOMS[Math.min(ZOOMS.indexOf(picture.zoom) + 1, ZOOMS.length - 1)]; drawPicture(); });
el("zoomOut").addEventListener("click", () => { picture.zoom = ZOOMS[Math.max(ZOOMS.indexOf(picture.zoom) - 1, 0)]; drawPicture(); });
// the picture follows the page's width
let redraw = 0;
new ResizeObserver(() => { cancelAnimationFrame(redraw); redraw = requestAnimationFrame(() => { if (last && !el("result").classList.contains("hidden")) drawPicture(); }); }).observe(el("pictureWrap"));
el("order").addEventListener("change", () => el("budget").classList.toggle("hidden", el("order").value !== "budget"));
el("cancel").addEventListener("click", cancel);
el("reset").addEventListener("click", () => { for (const id of ["tra", "points", "zwang", "endE", "endN", "endT", "speed", "hold", "edits"]) el(id).value = ""; el("holdRadii").checked = false; el("order").value = "points"; el("budget").classList.add("hidden"); el("result").classList.add("hidden"); status(""); last = null; picture.model = null; picture.wanted = null; picture.edits = null; picture.insertAfter = null; picture.zoom = 1;
	// and the project: every line empty, the right axis the one to work on
	for (const key of FILE_LINES) project.lines.set(key, newLine()); project.active = "re-TRA"; el("project").value = ""; el("projectNote").textContent = ""; showGradient(null); drawProject(); });
drawProject();
el("dlTra").addEventListener("click", () => last && download((last.report.input.tra || "plan.TRA").replace(/\.tra$/i, "") + "_axtran2.TRA", last.tra, "application/octet-stream"));
el("dlReport").addEventListener("click", () => last && download("report.json", JSON.stringify(last.report, null, 2), "application/json"));
el("dlCsv").addEventListener("click", () => last && download("residuen.csv", last.csv, "text/csv"));
