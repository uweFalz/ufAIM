// TransEd playground: presentation and workflow only. Everything it shows is
// computed by src/services/transition-library on the repository's
// transitionDB. No network; the user's own library is kept in the browser's
// local storage when that is available, and travels as a file.

import transitionLookup from "../src/domain/transition/transitionLookup.json" with { type: "json" };
import {
	DEFAULT_COUPLING_ASSUMPTION,
	DEFAULT_REQUIRED_SMOOTHNESS_ORDER,
	FUNCTION_SERIES,
	couplingPlotSvg,
	createTransitionLibraryService,
	formatRange,
	klauderName,
	klauderTerms,
	functionPlotSvg,
	plotParameterAt,
	plotSeries,
	transitionPlotSvg,
} from "../src/services/transition-library/index.js";

const STORAGE_KEY = "ufaim.transed.userLibrary.v1";
const el = (id) => document.getElementById(id);
const service = createTransitionLibraryService({ catalogue: transitionLookup });

const state = {
	halfWave1: "HW_BLOSS",
	halfWave2: "HW_BLOSS",
	w1: 0.5,
	w2: 0.5,
	assumption: { ...DEFAULT_COUPLING_ASSUMPTION },
	requiredOrder: DEFAULT_REQUIRED_SMOOTHNESS_ORDER,
	draft: null,
	mode: "2",
	fn: { kind: "poly", coeff: "0, 0, 3, -2", m: Math.PI, n: 0, a: 0, b: 0.5, x0: -0.25, x1: 1.25, draft: null },
	hw: { combine: "add", source: "kappa", quantity: "curvature", terms: [{ factor: 1, fn: "BLOSS", a: 0, b: 0.5, power: 1 }], draft: null },
};

function say(node, text, kind = "") {
	node.textContent = text;
	if (kind) node.dataset.kind = kind; else delete node.dataset.kind;
}

const REFUSALS = {
	USER_LIBRARY_ID_INVALID: "Die Kennung beginnt mit einem Buchstaben und enthält nur Buchstaben, Ziffern und Unterstrich; Transitionen schreiben sich klein.",
	USER_LIBRARY_INTERVAL_INVALID: "Das Intervall braucht zwei verschiedene Zahlen.",
	USER_LIBRARY_STRUCTURE_INVALID: "Die Definition ist so nicht auswertbar.",
	USER_LIBRARY_REFERENCE_MISSING: "Ein verwendeter Eintrag fehlt.",
	USER_LIBRARY_HALFWAVE_UNSUITABLE: "Als Halbwelle ungeeignet: Sie muss endlich sein und von einem Anfangswert zu einem anderen Endwert laufen.",
	USER_LIBRARY_TRANSITION_UNSUITABLE: "Die Transition lässt sich so nicht aufbauen.",
	USER_LIBRARY_BUILT_IN_IMMUTABLE: "Diese Kennung gehört einem eingebauten Eintrag. Eingebaute Einträge bleiben unverändert.",
	USER_LIBRARY_QUANTITY_MIXED: "Beide Halbwellen müssen dieselbe Größe beschreiben, Krümmung oder Überhöhung.",
	USER_LIBRARY_RECORD_IN_USE: "Der Eintrag wird noch verwendet.",
	USER_LIBRARY_RECORD_EXISTS: "Ein eigener Eintrag mit dieser Kennung hat eine andere Definition. Mit „vorhandene Einträge ersetzen“ wird er überschrieben.",
	USER_LIBRARY_FILE_INVALID: "Die Datei ist keine Bibliothek in der Form der transitionDB.",
	TRANSITION_PARTITION_INVALID: "Die Aufteilung muss aus drei Anteilen zwischen 0 und 1 bestehen, die zusammen 1 ergeben.",
};
const refusal = (result) => `${REFUSALS[result.code] ?? ""} (${result.reason})`.trim();

function round3(value) {
	return Math.round(Number(value) * 1000) / 1000;
}

function partition() {
	const w1 = round3(state.w1);
	const w2 = round3(state.w2);
	return [w1, round3(w2 - w1), round3(1 - w2)];
}

// --- storage -----------------------------------------------------------

function storedLibrary() {
	try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { return null; }
}

function storeLibrary() {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(service.exportUserLibrary())); return true; } catch { return false; }
}

// --- selects -----------------------------------------------------------

function option(value, text) {
	const node = document.createElement("option");
	node.value = value;
	node.textContent = text;
	return node;
}

function fillSelects() {
	const presets = service.listPresets();
	el("template").replaceChildren(option("", "— frei —"), ...presets.map((preset) => option(preset.id, `${preset.label}${preset.origin === "user" ? " · eigen" : ""}`)));
	const halfWaves = service.listHalfWaves();
	for (const id of ["hwIn", "hwOut"]) {
		el(id).replaceChildren(...halfWaves.map((hw) => option(hw.id, [hw.id, hw.source === "kappa" ? null : `über ${hw.source}`, hw.quantity === "cant" ? "Überhöhung" : null, hw.origin === "user" ? "eigen" : null].filter(Boolean).join(" · "))));
	}
	if (halfWaves.some((hw) => hw.id === state.halfWave1)) el("hwIn").value = state.halfWave1; else state.halfWave1 = el("hwIn").value;
	if (halfWaves.some((hw) => hw.id === state.halfWave2)) el("hwOut").value = state.halfWave2; else state.halfWave2 = el("hwOut").value;
	const functions = service.listSimpleFunctions();
	el("fnTemplate").replaceChildren(option("", "— frei —"), ...functions.map((fn) => option(fn.id, `${fn.id}${fn.origin === "user" ? " · eigen" : ""}`)));
	for (const term of state.hw.terms) if (!functions.some((fn) => fn.id === term.fn)) term.fn = functions[0].id;
	renderTermRows();
}

function applyTemplate(presetId) {
	const record = service.getCatalogue().records.transition.find((entry) => entry.id === presetId)?.value;
	if (!record) return;
	state.halfWave1 = record.halfWave1;
	state.halfWave2 = record.halfWave2;
	const part = record.normLengthPartition ?? [0, 1, 0];
	state.w1 = round3(part[0]);
	state.w2 = round3(Number(part[0]) + Number(part[1]));
	el("hwIn").value = state.halfWave1;
	el("hwOut").value = state.halfWave2;
	render();
}

// --- rendering ---------------------------------------------------------

function syncInputs() {
	for (const [key, ids] of [["w1", ["w1", "w1Range"]], ["w2", ["w2", "w2Range"]]]) {
		for (const id of ids) if (document.activeElement !== el(id)) el(id).value = String(round3(state[key]));
	}
	const [a, c, b] = partition();
	el("partition").textContent = `${a} · ${c} · ${b}`;
	el("aHeight").value = String(state.assumption.referenceHeight);
	el("aCant").value = String(Math.round(state.assumption.endCant * 1000));
	el("aRadius").value = String(state.assumption.radius);
	el("aLength").value = String(state.assumption.length);
	el("smoothOrder").value = String(state.requiredOrder);
}

// Legend of the κ/κ′/κ″ picture, named after the reading of the halfWaves.
function seriesLegend(reading, ranges) {
	return `<span data-reading="${reading.quantity}">gelesen als ${reading.name}</span>`
		+ reading.series.map((series) => `<span><b style="color:${series.color}">${series.label}</b> ${formatRange(ranges[series.key])}</span>`).join("");
}

const DERIVATIVE_NAMES = ["", "f′", "f″", "f‴"];
const endValue = (value) => { const rounded = Number(Number(value).toPrecision(3)); return Object.is(rounded, -0) || Math.abs(rounded) < 5e-4 ? "0" : String(rounded); };

// Verdict on the ramp ends: how far the ramp is smooth and what was asked for.
function rampVerdict(suitability) {
	const { order, requiredOrder, suitable } = suitability;
	if (order === 0) return "Rampe knickt an den Enden";
	const reached = order === 1 ? "Rampe läuft tangential ein" : `Rampe läuft glatt ein, bis ${DERIVATIVE_NAMES[order]}`;
	return suitable ? reached : `${reached}; ${DERIVATIVE_NAMES[order + 1]} springt, verlangt ist bis ${DERIVATIVE_NAMES[requiredOrder]}`;
}

function render() {
	syncInputs();
	const draft = service.describeDraft({ halfWave1: state.halfWave1, halfWave2: state.halfWave2, normLengthPartition: partition(), assumption: state.assumption, requiredOrder: state.requiredOrder });
	state.draft = draft.ok ? draft : null;
	if (!draft.ok) {
		el("plot").replaceChildren();
		el("legend").replaceChildren();
		el("couplingPlot").replaceChildren();
		el("couplingLegend").replaceChildren();
		el("couplingText").textContent = "";
		say(el("draftMessage"), `Nicht baubar: ${refusal(draft)}`, "error");
		return;
	}
	say(el("draftMessage"), "");
	const reading = plotSeries(draft.coupling.given);
	const picture = transitionPlotSvg({ samples: draft.samples, w1: state.w1, w2: state.w2, quantity: reading.quantity });
	el("plot").innerHTML = picture.svg;
	el("legend").innerHTML = seriesLegend(reading, picture.ranges);

	const c = draft.coupling;
	el("readAs").value = c.given;
	const given = c.given === "cant" ? "Überhöhung" : "Krümmung";
	const derived = c.derived === "cant" ? "Überhöhung" : "Krümmung";
	el("couplingText").innerHTML = `Diese Kombination ist als <b>${given}</b> erklärt. Daraus folgt die <b>${derived}</b>. `
		+ `<span class="verdict" data-ok="${c.suitability.suitable}" data-order="${c.suitability.order}">${rampVerdict(c.suitability)}</span>`;
	el("couplingPlot").innerHTML = couplingPlotSvg({ samples: c.samples, given: c.given }).svg;
	el("couplingLegend").innerHTML = [
		`<span><b style="color:#0F9D94">Krümmung</b> ${formatRange(c.curvatureRange)}</span>`,
		`<span><b style="color:#C8572A">Überhöhung</b> Steigung am Anfang ${c.endSlopes.start.toFixed(3)}, am Ende ${c.endSlopes.end.toFixed(3)}</span>`,
		...c.suitability.checks.slice(1).map((check) => `<span data-check="${check.order}" data-ok="${check.ok}">${DERIVATIVE_NAMES[check.order]} am Anfang ${endValue(check.start)}, am Ende ${endValue(check.end)} (Grenze ${endValue(check.limit)})</span>`),
		`<span>ε = ${c.epsilon.toFixed(3)}</span>`,
	].join("");
}

const LEVEL_NAMES = { simpleFcn: "Funktion", protoFcn: "Prototyp", halfWave: "Halbwelle", transition: "Transition" };

function describeRecord(level, value) {
	if (level === "transition") return `${value.halfWave1} · Kern · ${value.halfWave2}, Aufteilung ${value.normLengthPartition.join(" · ")}${value.label ? `, „${value.label}“` : ""}`;
	if (level === "halfWave") return `${value.proto} beschreibt ${value.source ?? "kappa"}, ${value.quantity === "cant" ? "Überhöhung" : "Krümmung"}`;
	if (level === "simpleFcn") return value.op === "poly" ? `Polynom [${value.coeff.join(", ")}]` : `${value.op}(${value.m ?? 1}·x + ${value.n ?? 0})`;
	return value.op === "ref" ? `${value.id} auf [${value.crop.join(", ")}]` : `${value.op === "add" ? "Summe" : value.op === "mul" ? "Produkt" : value.op} aus ${[...new Set(JSON.stringify(value).match(/"id":"[^"]+"/g)?.map((m) => m.slice(6, -1)) ?? [])].join(", ")}`;
}

function renderLibrary() {
	const library = service.exportUserLibrary();
	const table = el("library");
	const levels = ["transition", "halfWave", "protoFcn", "simpleFcn"];
	const total = levels.reduce((sum, level) => sum + Object.keys(library[level]).length, 0);
	if (!total) {
		table.innerHTML = "<tr><td>Noch keine eigenen Einträge.</td></tr>";
	} else {
		table.innerHTML = "<tr><th>Ebene</th><th>Kennung</th><th>Inhalt</th><th></th></tr>";
		for (const level of levels) {
			for (const [id, value] of Object.entries(library[level])) {
				const tr = document.createElement("tr"); tr.dataset.level = level; tr.dataset.id = id;
				for (const text of [LEVEL_NAMES[level], id, describeRecord(level, value)]) { const td = document.createElement("td"); td.textContent = text; tr.append(td); }
				const td = document.createElement("td"); td.style.whiteSpace = "nowrap";
				if (level === "transition") { const load = document.createElement("button"); load.className = "ghost"; load.textContent = "Laden"; load.dataset.load = id; load.style.marginRight = "6px"; td.append(load); }
				const remove = document.createElement("button"); remove.className = "ghost"; remove.textContent = "Entfernen"; remove.dataset.remove = id; remove.dataset.level = level;
				td.append(remove); tr.append(td); table.append(tr);
			}
		}
	}
	el("storageNote").textContent = storeLibrary() ? "Der Browser merkt sich die Bibliothek auf diesem Gerät. Dauerhaft und zum Weitergeben ist die gesicherte Datei." : "Dieser Browser merkt sich nichts; bitte als Datei sichern.";
}

// --- mode switch --------------------------------------------------------

function showMode(mode) {
	state.mode = String(mode);
	for (const node of document.querySelectorAll("[data-mode]")) node.hidden = node.dataset.mode !== state.mode;
	for (const node of document.querySelectorAll("[data-mode-button]")) node.setAttribute("aria-pressed", String(node.dataset.modeButton === state.mode));
	if (state.mode === "0") renderFunction();
	if (state.mode === "1") renderHalfWave();
	if (state.mode === "2") render();
}

// --- mode 0: function with argument interval ----------------------------

function functionValue() {
	const fn = state.fn;
	if (fn.kind === "poly") {
		const coeff = String(fn.coeff).split(/[\s,;]+/).filter(Boolean).map((text) => Number(text.replace(",", ".")));
		if (!coeff.length || !coeff.every(Number.isFinite)) return null;
		return { op: "poly", coeff };
	}
	if (!Number.isFinite(fn.m) || !Number.isFinite(fn.n)) return null;
	return { op: fn.kind, m: fn.m, n: fn.n };
}

function syncFunctionInputs() {
	const fn = state.fn;
	el("fnKind").value = fn.kind;
	for (const node of document.querySelectorAll("[data-fn]")) node.hidden = (node.dataset.fn === "poly") !== (fn.kind === "poly");
	for (const [id, value] of [["fnCoeff", fn.coeff], ["fnM", fn.m], ["fnN", fn.n], ["fnA", fn.a], ["fnB", fn.b], ["fnX0", fn.x0], ["fnX1", fn.x1]]) {
		if (document.activeElement !== el(id)) el(id).value = String(value);
	}
}

function renderFunction() {
	syncFunctionInputs();
	const fn = state.fn;
	const value = functionValue();
	const draft = value
		? service.describeFunction({ value, interval: [fn.a, fn.b], range: [fn.x0, fn.x1] })
		: { ok: false, code: "USER_LIBRARY_STRUCTURE_INVALID", reason: "parameters are not numbers" };
	fn.draft = draft.ok ? draft : null;
	if (!draft.ok) {
		el("fnPlot").replaceChildren(); el("fnLegend").replaceChildren();
		say(el("fnMessage"), `Nicht darstellbar: ${refusal(draft)}`, "error");
		return;
	}
	const picture = functionPlotSvg({ samples: draft.samples, frame: draft.frame });
	el("fnPlot").innerHTML = picture.svg;
	const f = draft.frame;
	el("fnLegend").innerHTML = FUNCTION_SERIES.map((series) => `<span><b style="color:${series.color}">${series.label}</b> ${formatRange(picture.ranges[series.key])}</span>`).join("")
		+ `<span><b style="color:var(--accent)">Rahmen</b> x von ${round3(f.a)} bis ${round3(f.b)}, Werte von ${round3(f.fa)} bis ${round3(f.fb)}</span>`;
	say(el("fnMessage"), draft.usableAsPiece ? "" : "In diesem Intervall hat die Funktion an beiden Enden denselben Wert. Als Halbwelle taugt der Ausschnitt so nicht.", draft.usableAsPiece ? "" : "error");
}

function applyFunctionTemplate(id) {
	const entry = service.listSimpleFunctions().find((candidate) => candidate.id === id);
	if (!entry) return;
	const fn = state.fn;
	if (entry.value.op === "poly") { fn.kind = "poly"; fn.coeff = entry.value.coeff.join(", "); }
	else if (entry.value.op === "sin" || entry.value.op === "cos") { fn.kind = entry.value.op; fn.m = Number(entry.value.m ?? 1); fn.n = Number(entry.value.n ?? 0); }
	else return;
	[fn.a, fn.b] = entry.interval;
	const lo = Math.min(fn.a, fn.b); const hi = Math.max(fn.a, fn.b); const pad = (hi - lo) * 0.5;
	fn.x0 = round3(lo - pad); fn.x1 = round3(hi + pad);
	renderFunction();
}

function saveFunction() {
	const id = el("fnId").value.trim();
	const value = functionValue();
	if (!value) { say(el("fnSaveMessage"), "Nicht gespeichert: Die Parameter sind keine Zahlen.", "error"); return; }
	const records = [
		{ level: "simpleFcn", id, value },
		{ level: "protoFcn", id: `PROTO_${id}`, value: { op: "ref", id, crop: [state.fn.a, state.fn.b] } },
	];
	if (el("fnAsHalfWave").checked) {
		const quantity = el("fnQuantity").value;
		records.push({ level: "halfWave", id: `HW_${id}`, value: { proto: `PROTO_${id}`, source: el("fnSource").value, ...(quantity === "cant" ? { quantity } : {}) } });
	}
	const result = service.putUserRecords(records);
	if (!result.ok) { say(el("fnSaveMessage"), `Nicht gespeichert: ${refusal(result)}`, "error"); return; }
	say(el("fnSaveMessage"), `Gespeichert: ${result.records.map((record) => record.id).join(", ")}.`, "ok");
	fillSelects(); renderLibrary();
}

// --- mode 1: halfWave composer ------------------------------------------

function halfWaveTree() {
	const terms = state.hw.terms.map((term) => {
		let node = { op: "ref", id: term.fn, crop: [Number(term.a), Number(term.b)] };
		if (Number(term.power) !== 1) node = { op: "pow", base: node, exp: Number(term.power) };
		if (Number(term.factor) !== 1) node = { op: "mul", args: [{ op: "const", value: Number(term.factor) }, node] };
		return node;
	});
	if (terms.length === 1) return terms[0];
	return { op: state.hw.combine, args: terms };
}

function renderTermRows() {
	const functions = service.listSimpleFunctions();
	const table = el("hwTerms");
	table.innerHTML = "<tr><th>Faktor</th><th>Funktion</th><th>von</th><th>bis</th><th>Potenz</th><th></th></tr>";
	state.hw.terms.forEach((term, index) => {
		const tr = document.createElement("tr");
		const cell = (node) => { const td = document.createElement("td"); td.append(node); tr.append(td); };
		const number = (key, step) => { const input = document.createElement("input"); input.type = "number"; input.step = step; input.value = String(term[key]); input.dataset.term = String(index); input.dataset.key = key; input.setAttribute("aria-label", `${key} Glied ${index + 1}`); return input; };
		cell(number("factor", "any"));
		const select = document.createElement("select"); select.dataset.term = String(index); select.dataset.key = "fn"; select.setAttribute("aria-label", `Funktion Glied ${index + 1}`);
		select.append(...functions.map((fn) => option(fn.id, `${fn.id}${fn.origin === "user" ? " · eigen" : ""}`))); select.value = term.fn;
		cell(select); cell(number("a", "0.01")); cell(number("b", "0.01")); cell(number("power", "1"));
		const remove = document.createElement("button"); remove.className = "ghost"; remove.textContent = "Entfernen"; remove.dataset.removeTerm = String(index); remove.disabled = state.hw.terms.length === 1;
		cell(remove); table.append(tr);
	});
}

function renderHalfWave() {
	el("hwCombine").value = state.hw.combine; el("hwSource").value = state.hw.source; el("hwQuantity").value = state.hw.quantity;
	const draft = service.describeHalfWave({ proto: halfWaveTree(), source: state.hw.source, quantity: state.hw.quantity });
	state.hw.draft = draft.ok ? draft : null;
	if (!draft.ok) {
		el("hwPlot").replaceChildren(); el("hwLegend").replaceChildren();
		say(el("hwMessage"), `Nicht baubar: ${refusal(draft)}`, "error");
		return;
	}
	say(el("hwMessage"), "");
	const reading = plotSeries(draft.quantity);
	const picture = transitionPlotSvg({ samples: draft.samples, quantity: reading.quantity });
	el("hwPlot").innerHTML = picture.svg;
	el("hwLegend").innerHTML = seriesLegend(reading, picture.ranges)
		+ `<span>Steigung am Anfang ${draft.endSlopes.start.toFixed(3)}, am Ende ${draft.endSlopes.end.toFixed(3)}</span>`;
}

function saveHalfWave() {
	const id = el("hwId").value.trim();
	const quantity = state.hw.quantity;
	const result = service.putUserRecords([
		{ level: "protoFcn", id: `PROTO_${id}`, value: halfWaveTree() },
		{ level: "halfWave", id: `HW_${id}`, value: { proto: `PROTO_${id}`, source: state.hw.source, ...(quantity === "cant" ? { quantity } : {}) } },
	]);
	if (!result.ok) { say(el("hwSaveMessage"), `Nicht gespeichert: ${refusal(result)}`, "error"); return; }
	say(el("hwSaveMessage"), `Gespeichert: ${result.records.map((record) => record.id).join(", ")}.`, "ok");
	fillSelects(); renderLibrary();
}

// --- events ------------------------------------------------------------

function setCut(which, value) {
	let w1 = which === "w1" ? value : state.w1;
	let w2 = which === "w2" ? value : state.w2;
	w1 = Math.max(0, Math.min(1, round3(w1)));
	w2 = Math.max(0, Math.min(1, round3(w2)));
	if (w1 > w2) { if (which === "w1") w1 = w2; else w2 = w1; }
	state.w1 = w1; state.w2 = w2;
	el("template").value = "";
	render();
}

for (const [which, ids] of [["w1", ["w1", "w1Range"]], ["w2", ["w2", "w2Range"]]]) {
	for (const id of ids) el(id).addEventListener("input", () => { const v = Number(el(id).value); if (Number.isFinite(v)) setCut(which, v); });
}
el("template").addEventListener("change", () => applyTemplate(el("template").value));
el("hwIn").addEventListener("change", () => { state.halfWave1 = el("hwIn").value; el("template").value = ""; render(); });
el("hwOut").addEventListener("change", () => { state.halfWave2 = el("hwOut").value; el("template").value = ""; render(); });

el("smoothOrder").addEventListener("change", () => { state.requiredOrder = Number(el("smoothOrder").value); render(); });
for (const [id, key, factor] of [["aHeight", "referenceHeight", 1], ["aCant", "endCant", 0.001], ["aRadius", "radius", 1], ["aLength", "length", 1]]) {
	el(id).addEventListener("change", () => {
		const value = Number(el(id).value) * factor;
		if (Number.isFinite(value) && value > 0) state.assumption[key] = value;
		render();
	});
}

// drag a cut line in the picture: the nearer one follows the pointer
let dragging = null;
function parameterOf(event) {
	const svg = el("plot").querySelector("svg");
	const box = svg.getBoundingClientRect();
	return plotParameterAt((event.clientX - box.left) / box.width);
}
el("plot").addEventListener("pointerdown", (event) => {
	if (!el("plot").querySelector("svg")) return;
	const u = parameterOf(event);
	dragging = Math.abs(u - state.w1) <= Math.abs(u - state.w2) ? "w1" : "w2";
	if (state.w1 === state.w2) dragging = u < state.w1 ? "w1" : "w2";
	try { el("plot").setPointerCapture(event.pointerId); } catch { /* no active pointer: the drag still follows moves over the picture */ }
	setCut(dragging, u);
	event.preventDefault();
});
el("plot").addEventListener("pointermove", (event) => { if (dragging) setCut(dragging, parameterOf(event)); });
for (const type of ["pointerup", "pointercancel"]) el("plot").addEventListener(type, () => { dragging = null; });

el("save").addEventListener("click", () => {
	const id = el("saveId").value.trim();
	const label = el("saveLabel").value.trim();
	const result = service.putUserRecord({ level: "transition", id, value: { ...(label ? { label } : {}), halfWave1: state.halfWave1, halfWave2: state.halfWave2, normLengthPartition: partition() } });
	if (!result.ok) { say(el("saveMessage"), `Nicht gespeichert: ${refusal(result)}`, "error"); return; }
	say(el("saveMessage"), result.status === "updated" ? `„${id}“ aktualisiert.` : `„${id}“ gespeichert.`, "ok");
	fillSelects(); el("template").value = id; renderLibrary();
});

el("library").addEventListener("click", (event) => {
	const { load, remove, level } = event.target.dataset ?? {};
	if (load) { showMode("2"); el("template").value = load; applyTemplate(load); }
	if (remove) {
		const result = service.removeUserRecord({ level, id: remove });
		say(el("libraryMessage"), result.ok ? `„${remove}“ entfernt.` : `Nicht entfernt: ${refusal(result)}`, result.ok ? "ok" : "error");
		fillSelects(); renderLibrary(); showMode(state.mode);
	}
});

for (const button of document.querySelectorAll("[data-mode-button]")) button.addEventListener("click", () => showMode(button.dataset.modeButton));

// mode 0
el("fnTemplate").addEventListener("change", () => applyFunctionTemplate(el("fnTemplate").value));
el("fnKind").addEventListener("change", () => { state.fn.kind = el("fnKind").value; el("fnTemplate").value = ""; renderFunction(); });
el("fnCoeff").addEventListener("input", () => { state.fn.coeff = el("fnCoeff").value; el("fnTemplate").value = ""; renderFunction(); });
for (const [id, key] of [["fnM", "m"], ["fnN", "n"], ["fnA", "a"], ["fnB", "b"], ["fnX0", "x0"], ["fnX1", "x1"]]) {
	el(id).addEventListener("input", () => { const v = Number(el(id).value); if (el(id).value !== "" && Number.isFinite(v)) { state.fn[key] = v; if (key === "m" || key === "n") el("fnTemplate").value = ""; renderFunction(); } });
}
let framing = false;
function argumentOf(event) {
	const box = el("fnPlot").querySelector("svg").getBoundingClientRect();
	return round3(state.fn.x0 + plotParameterAt((event.clientX - box.left) / box.width) * (state.fn.x1 - state.fn.x0));
}
el("fnPlot").addEventListener("pointerdown", (event) => {
	if (!el("fnPlot").querySelector("svg")) return;
	framing = true;
	try { el("fnPlot").setPointerCapture(event.pointerId); } catch { /* no active pointer */ }
	state.fn.a = argumentOf(event); state.fn.b = state.fn.a;
	event.preventDefault();
});
el("fnPlot").addEventListener("pointermove", (event) => { if (framing) { state.fn.b = argumentOf(event); renderFunction(); } });
for (const type of ["pointerup", "pointercancel"]) el("fnPlot").addEventListener(type, () => { if (framing) { framing = false; renderFunction(); } });
el("fnSave").addEventListener("click", saveFunction);

// mode 1
el("hwCombine").addEventListener("change", () => { state.hw.combine = el("hwCombine").value; renderHalfWave(); });
el("hwSource").addEventListener("change", () => { state.hw.source = el("hwSource").value; renderHalfWave(); });
el("hwQuantity").addEventListener("change", () => { state.hw.quantity = el("hwQuantity").value; renderHalfWave(); });
el("hwAddTerm").addEventListener("click", () => {
	const fn = service.listSimpleFunctions().find((entry) => entry.id === "IDENT") ?? service.listSimpleFunctions()[0];
	state.hw.terms.push({ factor: 1, fn: fn.id, a: fn.interval[0], b: fn.interval[1], power: 1 });
	renderTermRows(); renderHalfWave();
});
el("hwTerms").addEventListener("input", (event) => {
	const { term, key } = event.target.dataset ?? {};
	if (term === undefined || !key || key === "fn") return;
	const v = Number(event.target.value);
	if (event.target.value !== "" && Number.isFinite(v)) { state.hw.terms[Number(term)][key] = v; renderHalfWave(); }
});
el("hwTerms").addEventListener("change", (event) => {
	const { term, key } = event.target.dataset ?? {};
	if (key !== "fn") return;
	const entry = service.listSimpleFunctions().find((fn) => fn.id === event.target.value);
	Object.assign(state.hw.terms[Number(term)], { fn: entry.id, a: entry.interval[0], b: entry.interval[1] });
	renderTermRows(); renderHalfWave();
});
el("hwTerms").addEventListener("click", (event) => {
	const index = event.target.dataset?.removeTerm;
	if (index === undefined || state.hw.terms.length === 1) return;
	state.hw.terms.splice(Number(index), 1);
	renderTermRows(); renderHalfWave();
});
el("hwSave").addEventListener("click", saveHalfWave);
el("readAs").addEventListener("change", () => {
	// Both halfWaves change together: a transition describes one quantity.
	const quantity = el("readAs").value;
	const ids = [];
	for (const id of [state.halfWave1, state.halfWave2]) {
		const result = service.declareHalfWaveAs({ id, quantity });
		if (!result.ok) { say(el("readAsMessage"), `Nicht umgestellt: ${refusal(result)}`, "error"); fillSelects(); renderLibrary(); render(); return; }
		ids.push(result);
	}
	[state.halfWave1, state.halfWave2] = ids.map((result) => result.id);
	const created = [...new Set(ids.filter((result) => result.changed).map((result) => result.id))];
	say(el("readAsMessage"), `Gelesen als ${quantity === "cant" ? "Überhöhung" : "Krümmung"}: ${[...new Set(ids.map((result) => result.id))].join(", ")}.${created.length ? ` Neu in der eigenen Bibliothek: ${created.join(", ")}.` : ""}`, "ok");
	el("template").value = "";
	storeLibrary(); fillSelects(); renderLibrary(); render();
});
el("klApply").addEventListener("click", () => {
	// The generator only fills the composer: the user sees the three factors
	// and can change them before saving.
	const built = klauderTerms({ m: el("klM").value, n: el("klN").value });
	if (!built.ok) { say(el("klMessage"), "Nicht eingesetzt: m und n sind ganze Zahlen von 0 bis 24.", "error"); return; }
	Object.assign(state.hw, { combine: built.combine, source: built.source, terms: built.terms.map((term) => ({ ...term })) });
	el("hwId").value = klauderName(built);
	say(el("klMessage"), `Eingesetzt: m = ${built.m}, n = ${built.n}. Das Ergebnis beschreibt κ″.`, "ok");
	renderTermRows(); renderHalfWave();
});

el("export").addEventListener("click", () => {
	const url = URL.createObjectURL(new Blob([JSON.stringify(service.exportUserLibrary(), null, "\t")], { type: "application/json" }));
	const a = document.createElement("a"); a.href = url; a.download = "transed-bibliothek.json"; a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
});

el("importButton").addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); el("import").click(); } });
el("import").addEventListener("change", async () => {
	const file = el("import").files?.[0];
	if (!file) return;
	let library;
	try { library = JSON.parse(await file.text()); } catch { say(el("libraryMessage"), "Die Datei ist kein lesbares JSON.", "error"); el("import").value = ""; return; }
	const result = service.importUserLibrary(library, { replace: el("replace").checked });
	say(el("libraryMessage"), result.ok ? (result.changed ? `${result.imported.length} Einträge geladen.` : "Nichts Neues in der Datei.") : `Nicht geladen: ${refusal(result)}`, result.ok ? "ok" : "error");
	el("import").value = "";
	fillSelects(); renderLibrary(); showMode(state.mode);
});

// --- start -------------------------------------------------------------

const stored = storedLibrary();
if (stored) {
	const loaded = service.importUserLibrary(stored);
	if (!loaded.ok) say(el("libraryMessage"), `Die gemerkte Bibliothek passt nicht mehr: ${refusal(loaded)}`, "error");
}
fillSelects();
el("template").value = "bloss";
renderLibrary();
showMode("2");
window.__transed = { service, state };
