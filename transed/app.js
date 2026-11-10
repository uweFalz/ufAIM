// TransEd playground: presentation and workflow only. Everything it shows is
// computed by src/services/transition-library on the repository's
// transitionDB. No network; the user's own library is kept in the browser's
// local storage when that is available, and travels as a file.

import transitionLookup from "../src/domain/transition/transitionLookup.json" with { type: "json" };
import {
	DEFAULT_COUPLING_ASSUMPTION,
	PLOT_SERIES,
	couplingPlotSvg,
	createTransitionLibraryService,
	formatRange,
	plotParameterAt,
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
	draft: null,
};

function say(node, text, kind = "") {
	node.textContent = text;
	if (kind) node.dataset.kind = kind; else delete node.dataset.kind;
}

const REFUSALS = {
	USER_LIBRARY_ID_INVALID: "Die Kennung beginnt mit einem Kleinbuchstaben und enthält nur Kleinbuchstaben, Ziffern und Unterstrich.",
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
	el("hwIn").value = state.halfWave1;
	el("hwOut").value = state.halfWave2;
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
}

function render() {
	syncInputs();
	const draft = service.describeDraft({ halfWave1: state.halfWave1, halfWave2: state.halfWave2, normLengthPartition: partition(), assumption: state.assumption });
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
	const picture = transitionPlotSvg({ samples: draft.samples, w1: state.w1, w2: state.w2 });
	el("plot").innerHTML = picture.svg;
	el("legend").innerHTML = PLOT_SERIES.map((series) => `<span><b style="color:${series.color}">${series.label}</b> ${formatRange(picture.ranges[series.key])}</span>`).join("");

	const c = draft.coupling;
	const given = c.given === "cant" ? "Überhöhung" : "Krümmung";
	const derived = c.derived === "cant" ? "Überhöhung" : "Krümmung";
	el("couplingText").innerHTML = `Diese Kombination ist als <b>${given}</b> erklärt. Daraus folgt die <b>${derived}</b>. `
		+ `<span class="verdict" data-ok="${c.suitability.suitable}">${c.suitability.suitable ? "Rampe läuft tangential ein" : "Rampe knickt an den Enden"}</span>`;
	el("couplingPlot").innerHTML = couplingPlotSvg({ samples: c.samples, given: c.given }).svg;
	el("couplingLegend").innerHTML = [
		`<span><b style="color:#0F9D94">Krümmung</b> ${formatRange(c.curvatureRange)}</span>`,
		`<span><b style="color:#C8572A">Überhöhung</b> Steigung am Anfang ${c.endSlopes.start.toFixed(3)}, am Ende ${c.endSlopes.end.toFixed(3)}</span>`,
		`<span>ε = ${c.epsilon.toFixed(3)}</span>`,
	].join("");
}

function renderLibrary() {
	const user = service.getCatalogue().userLibrary;
	const rows = service.listPresets().filter((preset) => preset.origin === "user");
	const table = el("library");
	if (!rows.length) {
		table.innerHTML = "<tr><td>Noch keine eigenen Transitionen.</td></tr>";
	} else {
		const catalogue = service.getCatalogue().records.transition;
		table.innerHTML = "<tr><th>Kennung</th><th>Bezeichnung</th><th>Halbwelle ein</th><th>Halbwelle aus</th><th>Aufteilung</th><th></th></tr>";
		for (const preset of rows) {
			const record = catalogue.find((entry) => entry.id === preset.id).value;
			const tr = document.createElement("tr");
			for (const text of [preset.id, preset.label, record.halfWave1, record.halfWave2, record.normLengthPartition.join(" · ")]) {
				const td = document.createElement("td"); td.textContent = text; tr.append(td);
			}
			const td = document.createElement("td");
			const load = document.createElement("button"); load.className = "ghost"; load.textContent = "Laden"; load.dataset.load = preset.id;
			const remove = document.createElement("button"); remove.className = "ghost"; remove.textContent = "Entfernen"; remove.dataset.remove = preset.id; remove.style.marginLeft = "6px";
			td.append(load, remove); tr.append(td); table.append(tr);
		}
	}
	const others = ["simpleFcn", "protoFcn", "halfWave"].map((level) => `${user[level].length} ${level}`).join(", ");
	el("storageNote").textContent = `Außerdem in der eigenen Bibliothek: ${others}. ${storeLibrary() ? "Der Browser merkt sich die Bibliothek auf diesem Gerät." : "Dieser Browser merkt sich nichts; bitte als Datei sichern."}`;
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
	const { load, remove } = event.target.dataset ?? {};
	if (load) { el("template").value = load; applyTemplate(load); }
	if (remove) {
		const result = service.removeUserRecord({ level: "transition", id: remove });
		say(el("libraryMessage"), result.ok ? `„${remove}“ entfernt.` : `Nicht entfernt: ${refusal(result)}`, result.ok ? "ok" : "error");
		fillSelects(); renderLibrary();
	}
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
	fillSelects(); renderLibrary(); render();
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
render();
window.__transed = { service, state };
