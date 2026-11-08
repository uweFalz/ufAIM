// axtran2/app.js
//
// The page: files and numbers in, a worker run, the result shown and
// offered as downloads. No storage, no canonical truth, no network.

import { residualChartSvg } from "../src/services/axtran2/residualChart.js";
import { runInWorker } from "../src/services/axtran2/workerRun.js";
import { alignmentPictureModel, alignmentPictureSvg, pictureProbe, pictureReadout, recordGroup, holdMap } from "../src/services/axtran2/alignmentPicture.js";
import { recordListHtml } from "../src/services/axtran2/recordList.js";
import { formatHold } from "../src/services/axtran2/heldRecords.js";
import { parseAllEdits, formatEdits, isInsertKey, insertOf, INSERT_TYPES, TRANSITION_FAMILIES } from "../src/services/axtran2/recordEdits.js";

const el = (id) => document.getElementById(id);
const status = (text, kind = "info") => { el("status").textContent = text; el("status").dataset.kind = kind; };
const fmt = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : "–");

let running = null;
let ticker = null;
let last = null;
// the picture: its model, how wide it is drawn, and the locks set but not yet computed
const picture = { model: null, width: 0, zoom: 1, wanted: null, edits: null, insertAfter: null };
// a lock recomputes on its own while a run is this quick; a long run waits for Optimieren
const LIVE_SECONDS = 3;

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
		last = message;
		picture.wanted = null;
		picture.edits = null;
		picture.insertAfter = null;
		show(message);
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
		status(cancelled ? `Abgebrochen nach ${Math.round((Date.now() - started) / 1000)} s. Der Plan ist unverändert.`
			: refused ? `${what} wurde nicht ${change.what === "value" ? "übernommen" : "gesetzt"}: so bliebe zu wenig frei, um Anfang und Ende der Trasse noch zu treffen.`
			: change ? `${what} wurde nicht ${change.what === "value" ? "übernommen" : "gesetzt"}. ${workerFailure(error)}` : workerFailure(error), cancelled ? "info" : "error");
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
		inp.turnouts.length ? `Weichen erkannt: ${inp.turnouts.map((t) => `${t.inserted ? `eingefügt nach Satz ${t.inserted.after}` : span(t.records)} ${t.designation} (${t.held ? "gehalten" : "nicht gehalten"})`).join(", ")}.${inp.turnouts.some((t) => !t.held) ? " Das Wort Weichen im Feld Sätze halten hält sie fest." : ""}` : "",
		inp.heldRecords.length ? `Gehalten wie in der Datei: ${formatHold(inp.heldRecords)} (L nur die Länge, R nur der Radius).` : "",
		inp.edits?.length ? `Gestartet mit geänderten Werten statt der Datei: ${formatEdits(inp.edits)}.` : "",
		inp.structure?.removed?.length ? `Herausgenommen: Satz ${inp.structure.removed.join(", ")}.` : "",
		inp.structure?.inserted?.length ? `Eingefügt: ${inp.structure.inserted.map((i) => `nach Satz ${i.after} ${i.turnout ? `${i.turnout} (${i.part === "arc" ? "Bogen" : i.part === "arc2" ? "zweiter Bogen" : i.part === "straight" ? "Gerade" : "Endstück"})` : INSERT_TYPES[i.type]}${i.family && i.family !== "clothoid" ? ` (${TRANSITION_FAMILIES[i.family]})` : ""} ${fmt(i.length, 2)} m${i.radius !== null ? `, R ${fmt(i.radius, 0)}` : ""}`).join("; ")}.` : "",
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
	const values = new Map((inp.edits ?? []).map((e) => [e.record, { ...(e.length !== null ? { length: e.length } : {}), ...(e.radius !== null ? { radius: e.radius } : {}), ...(e.family ? { family: e.family } : {}) }]));
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
function applyEdits(all, what) {
	const previous = fieldsOfLastRun(what);
	picture.insertAfter = null;
	el("edits").value = formatEdits(all);
	if (last.seconds <= LIVE_SECONDS) { run({ change: previous }); return true; }
	picture.edits = el("edits").value;
	drawPicture();
	status(`${what === "value" ? "Wert" : "Änderung"} vorgemerkt (Werte ändern: ${el("edits").value || "keine"}). Der letzte Lauf dauerte ${fmt(last.seconds, 0)} s, darum rechnet das nicht von selbst neu: Optimieren rechnet.`);
	return true;
}

// A value typed in the list: the length, radius or type a record starts from
// in the next fit; for an inserted record its token. Returns whether the value was taken.
function editValue(key, field, text) {
	if (!last || !picture.model || running) return false;
	const record = picture.model.records.find((r) => String(r.number) === String(key));
	if (!record || !record.lockable || record.turnout) return false;
	const value = field === "family" ? String(text) : Number(String(text).trim().replace("−", "-").replace(",", "."));
	if (field !== "family" && (!Number.isFinite(value) || (field === "length" ? !(value > 0) : !(Math.abs(value) > 0)))) {
		status(field === "length" ? `„${text}“ ist keine Länge: eine Zahl größer als null, Dezimalkomma erlaubt.` : `„${text}“ ist kein Radius: eine Zahl ungleich null, mit dem Vorzeichen der Datei.`, "error");
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
		const spec = { type, radius, ...(radiusEnd ? { radiusEnd } : {}), ratio: Number(ratio), side: form.elements.wside.value, orientation: form.elements.worient.value };
		const mainText = String(form.elements.wmain.value).trim();
		if (mainText) {
			const mainRadius = read("wmain");
			if (!(Math.abs(mainRadius) > 0)) { status("Der Radius des Stammgleises ist eine Zahl ungleich null, mit dem Vorzeichen der Datei; leer für eine gerade Weiche.", "error"); return false; }
			spec.mainRadius = mainRadius;
		}
		if (!all.inserted.has(after)) all.inserted.set(after, []);
		all.inserted.get(after).push(spec);
		return applyEdits(all, "structure");
	}
	if (type === "crossing") {
		const [kind, rest] = form.elements.kshape.value.split(":");
		const [radius, ratio] = rest.split("-1/").map(Number);
		if (!all.inserted.has(after)) all.inserted.set(after, []);
		all.inserted.get(after).push({ type, kind, radius, ratio, side: form.elements.kside.value, route: form.elements.kroute.value });
		return applyEdits(all, "structure");
	}
	const spec = { type, length: read("len") };
	if (!(spec.length > 0)) { status("Die Länge des neuen Satzes muss größer als null sein.", "error"); return false; }
	if (type === "arc") { spec.radius = read("rad"); if (!(Math.abs(spec.radius) > 0)) { status("Der Bogen braucht einen Radius ungleich null, mit dem Vorzeichen der Datei.", "error"); return false; } }
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
// edits name records of one file: another file starts without them
el("tra").addEventListener("change", () => { el("edits").value = ""; });
const ZOOMS = [1, 2, 4, 8];
el("zoomIn").addEventListener("click", () => { picture.zoom = ZOOMS[Math.min(ZOOMS.indexOf(picture.zoom) + 1, ZOOMS.length - 1)]; drawPicture(); });
el("zoomOut").addEventListener("click", () => { picture.zoom = ZOOMS[Math.max(ZOOMS.indexOf(picture.zoom) - 1, 0)]; drawPicture(); });
// the picture follows the page's width
let redraw = 0;
new ResizeObserver(() => { cancelAnimationFrame(redraw); redraw = requestAnimationFrame(() => { if (last && !el("result").classList.contains("hidden")) drawPicture(); }); }).observe(el("pictureWrap"));
el("order").addEventListener("change", () => el("budget").classList.toggle("hidden", el("order").value !== "budget"));
el("cancel").addEventListener("click", cancel);
el("reset").addEventListener("click", () => { for (const id of ["tra", "points", "zwang", "endE", "endN", "endT", "speed", "hold", "edits"]) el(id).value = ""; el("holdRadii").checked = false; el("order").value = "points"; el("budget").classList.add("hidden"); el("result").classList.add("hidden"); status(""); last = null; picture.model = null; picture.wanted = null; picture.edits = null; picture.insertAfter = null; picture.zoom = 1; });
el("dlTra").addEventListener("click", () => last && download((last.report.input.tra || "plan.TRA").replace(/\.tra$/i, "") + "_axtran2.TRA", last.tra, "application/octet-stream"));
el("dlReport").addEventListener("click", () => last && download("report.json", JSON.stringify(last.report, null, 2), "application/json"));
el("dlCsv").addEventListener("click", () => last && download("residuen.csv", last.csv, "text/csv"));
