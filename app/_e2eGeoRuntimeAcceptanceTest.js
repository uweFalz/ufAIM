import { resolveGndCrsIdentifier, resolveGndCrsIdentifiers } from "@src/domain/crs/GndCrsResolver.js";
import { makeDbRefToEtrs89Transform, projectGeographicGeometry } from "@projection/GeographicProjection.js";
import { buildSparseFromEditModel } from "@src/domain/alignment/editor/buildSparseAlignment.js";
import { createAlignmentSpotObject } from "@src/model/spot/model/createAlignmentSpotObject.js";

class ObservableMap {
	constructor(options) {
		this.options = options;
		this.sources = new Map();
		this.layers = [];
		this.removed = false;
	}
	loaded() { return true; }
	once(event, callback) { if (event === "load") queueMicrotask(callback); }
	getSource(id) { return this.sources.get(id) ?? null; }
	addSource(id, source) {
		const observable = { ...source, setData(data) { this.data = data; } };
		this.sources.set(id, observable);
	}
	addLayer(layer) { this.layers.push(layer); }
	fitBounds(bounds, options) { this.lastFitBounds = { bounds, options }; }
	resize() {}
	remove() { this.removed = true; }
}

// Stub only the external map/WebGL surface. CRS and operating-mode logic remain real.
globalThis.__ufAIM_geoE2EMapLibre = { Map: ObservableMap };

const result = {
	passed: false,
	scenarios: [],
	failures: [],
	geographicCases: [],
	fallbackCases: [],
	interactionContinuity: {},
	geoPassed: false,
	fallbackPassed: false,
	transformationPassed: false,
	interactionPassed: false,
	completedAt: null,
};
globalThis.__geoRuntimeAcceptanceE2E = result;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeoutMs = 15000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await Promise.resolve(predicate())) return;
		await sleep(40);
	}
	throw new Error(`timeout waiting for ${label}`);
}
function check(condition, scenario, assertion) {
	if (condition) return;
	throw new Error(`${scenario}: ${assertion}`);
}
function scenario(name, component, fn) {
	return Promise.resolve().then(fn).then(
		(value) => { result.scenarios.push({ name, component, passed: true }); return value; },
		(error) => { const message = String(error?.message ?? error); result.scenarios.push({ name, component, passed: false, error: message }); result.failures.push({ scenario: name, component, assertion: message }); return null; },
	);
}
function fixture(lsys, index = 0) {
	const strip = { C: 2, D: 3, E: 4, F: 5 }[String(lsys ?? "D")[0]] ?? 3;
	const id = `geo_e2e_${String(lsys ?? "missing").replace(/[^a-z0-9]/gi, "_")}_${index}`;
	const editModel = {
		startPose: { p: { x: strip * 1_000_000 + 532112.488, y: 5940746.141 }, t: { x: 1, y: 0 } },
		elements: [
			{ id: `${id}_S`, type: "straight", parameters: { length: 120 }, length: 120 },
			{ id: `${id}_T`, type: "transition", parameters: { length: 40, transitionType: "clothoid" }, length: 40, transitionType: "clothoid" },
			{ id: `${id}_A`, type: "arc", parameters: { length: 80, curvature: 1 / 500 }, length: 80, curvature: 1 / 500 },
		],
	};
	const alignmentData = { type: "AlignmentData", id, name: `Geo E2E ${lsys ?? "missing"}`, source: { kind: "synthetic-e2e" }, editModel };
	const kernel = buildSparseFromEditModel(alignmentData);
	const resolution = resolveGndCrsIdentifier(lsys);
	const georeference = { status: resolution.status, resolution, horizontalCoordinateSystemName: lsys ?? null, coordinateProvenance: "synthetic GND Y,X", coordinatesAreAbsolute: true };
	return { id, lsys, editModel, kernel, resolution, first: { ...editModel.startPose.p }, object: createAlignmentSpotObject({ id, name: alignmentData.name, kernel, sparseAlignment: kernel, alignmentData, georeference, crsId: resolution.resolvedEpsg ?? lsys ?? null, crsStatus: resolution.status }) };
}
async function activate(fx) {
	await window.messaging.sendCmdAwait("Spot.AddObjects", { objects: [fx.object] });
	window.__ufAIM_store.actions?.setWorkspacePrimary?.({ objectId: fx.id, source: "geo-runtime-acceptance-e2e" });
	await waitFor(() => {
		const state = window.__ufAIM_viewController?.getDebugState?.();
		return state?.objectId === fx.id && state?.georeference;
	}, `${fx.id} completed view-mode resolution`);
	return window.__ufAIM_viewController.getDebugState();
}
function readProj4() {
	return globalThis.proj4;
}

(async function runGeoRuntimeAcceptanceE2E() {
	try {
		await waitFor(() => window.__ufAIM_store && window.messaging && window.__ufAIM_viewController, "runtime globals");
		const originalById = new Map();

		for (const [index, lsys] of ["CR0", "DR0", "ER0", "FR0"].entries()) {
			await scenario(lsys, "geo", async () => {
				const fx = fixture(lsys, index); originalById.set(fx.id, fx.first);
				const view = await activate(fx);
				await waitFor(() => document.getElementById("geoModeBadge")?.textContent === "GEO", `${lsys} GEO badge`);
				const map = window.__ufAIM_geoMapAdapter ?? null;
				const mapDebug = map?.getDebugState?.() ?? null;
				check(fx.resolution.supportState === "geographic-supported", lsys, "resolution state");
				check(fx.resolution.meridianStrip === index + 2, lsys, "meridian strip");
				check(view?.placement === "geographic", lsys, "view placement");
				check(view?.georeference?.verticalReferenceStatus === "unresolved-separate-source-height", lsys, "visible unresolved vertical status");
				check(mapDebug?.active && mapDebug?.geojson?.geometry?.type === "LineString", lsys, "MapLibre GeoJSON handover");
				check(mapDebug.geojson.geometry.coordinates.length >= 2 && mapDebug.geojson.geometry.coordinates.flat().every(Number.isFinite), lsys, "finite geographic coordinates");
				check(Array.isArray(mapDebug.fitBounds), lsys, "geometry framing request");
				check(document.getElementById("geoStage")?.classList.contains("is-geographic"), lsys, "geographic stage active");
				check(fx.editModel.startPose.p.x === fx.first.x && fx.editModel.startPose.p.y === fx.first.y, lsys, "original engineering coordinates preserved");
				result.geographicCases.push({ lsys, epsg: fx.resolution.resolvedEpsg, strip: fx.resolution.meridianStrip, geojson: mapDebug.geojson, fitBounds: mapDebug.fitBounds });
			});
		}

		const fallbackInputs = [
			["DA9", "local-explicit"], [null, "local-missing-crs"], ["BAD", "local-malformed-crs"],
			["DA0", "local-graphical-only"], ["DB0", "local-graphical-only"], ["DC0", "local-graphical-only"], ["DS0", "local-graphical-only"],
		];
		for (const [index, [lsys, expected]] of fallbackInputs.entries()) {
			await scenario(lsys ?? "missing-LSYS", "fallback", async () => {
				const fx = fixture(lsys, 20 + index); const view = await activate(fx);
				await waitFor(() => document.getElementById("geoModeBadge")?.textContent === "LOCAL", `${lsys ?? "missing"} LOCAL badge`);
				check(fx.resolution.supportState === expected, lsys ?? "missing", `fallback state ${expected}`);
				check(view?.placement !== "geographic", lsys ?? "missing", "no geographic placement");
				check(!document.getElementById("geoStage")?.classList.contains("is-geographic"), lsys ?? "missing", "MapLibre inactive");
				check(window.__ufAIM_geoView?.getDebugState?.() != null, lsys ?? "missing", "engineering Viewer active");
				check(fx.kernel != null && fx.editModel.startPose.p.x === fx.first.x, lsys ?? "missing", "engineering geometry preserved");
				result.fallbackCases.push({ lsys, state: expected, fallbackReason: fx.resolution.fallbackReason });
			});
		}

		await scenario("conflicting-CRS", "fallback", async () => {
			const resolution = resolveGndCrsIdentifiers(["DR0", "ER0"]);
			const fx = fixture("DR0", 35);
			fx.resolution = resolution;
			fx.object.crsId = null;
			fx.object.crsStatus = resolution.status;
			fx.object.data.georeference = { ...fx.object.data.georeference, status: resolution.status, resolution };
			const view = await activate(fx);
			await waitFor(() => document.getElementById("geoModeBadge")?.textContent === "LOCAL", "conflicting LOCAL badge");
			check(resolution.supportState === "local-conflicting-crs", "conflicting-CRS", "structured conflicting fallback");
			check(resolution.operatingMode === "local-cartesian" && resolution.resolvedEpsg == null, "conflicting-CRS", "no geographic placement");
			check(view?.placement !== "geographic" && !document.getElementById("geoStage")?.classList.contains("is-geographic"), "conflicting-CRS", "engineering Viewer remains active");
			result.fallbackCases.push({ lsys: ["DR0", "ER0"], state: resolution.supportState, fallbackReason: resolution.fallbackReason });
		});

		await scenario("runtime-outside-validity", "fallback", async () => {
			const fx = fixture("DR0", 36);
			fx.editModel.startPose.p.y = 7_000_000;
			fx.first = { ...fx.editModel.startPose.p };
			fx.kernel = buildSparseFromEditModel({ type: "AlignmentData", id: fx.id, name: fx.id, editModel: fx.editModel });
			fx.object.data.kernel = fx.kernel;
			fx.object.data.sparseAlignment = fx.kernel;
			const view = await activate(fx);
			await waitFor(() => document.getElementById("geoModeBadge")?.textContent === "LOCAL", "outside-validity LOCAL badge");
			check(view?.georeference?.resolutionState === "local-outside-validity", "runtime-outside-validity", "structured outside-validity state");
			check(view?.placement !== "geographic" && !document.getElementById("geoStage")?.classList.contains("is-geographic"), "runtime-outside-validity", "MapLibre inactive");
			check(fx.editModel.startPose.p.y === 7_000_000, "runtime-outside-validity", "engineering geometry preserved");
			result.fallbackCases.push({ lsys: "DR0", state: "local-outside-validity", fallbackReason: view?.georeference?.fallbackReason });
		});

		for (const [name, transform, expected] of [
			["invalid-non-finite", () => [NaN, 53], "local-transformation-failed"],
			["invalid-wrong-strip", () => [15, 53], "local-outside-validity"],
			["invalid-outside-region", () => [9, 60], "local-outside-validity"],
		]) {
			await scenario(name, "transformation", async () => {
				const fx = fixture("DR0", 40); const projected = { polyline2d: [fx.first, { x: fx.first.x + 100, y: fx.first.y + 100 }], segments: [], georeference: fx.object.data.georeference };
				const rejection = projectGeographicGeometry({ projection: projected, resolution: fx.resolution, transform });
				check(!rejection.ok && rejection.georeference.resolutionState === expected, name, `expected ${expected}`);
				check(rejection.geometry == null && projected.polyline2d[0].x === fx.first.x, name, "no invented placement and geometry preserved");
				result.fallbackCases.push({ lsys: "DR0", state: expected, fallbackReason: rejection.georeference.fallbackReason });
			});
		}

		await scenario("real-proj4-transform", "transformation", () => {
			const fx = fixture("DR0", 50); const transform = makeDbRefToEtrs89Transform(readProj4(), fx.resolution);
			check(typeof transform === "function", "real-proj4-transform", "Proj4js transform available");
			const coordinate = transform([fx.first.x, fx.first.y]);
			check(coordinate.every(Number.isFinite) && coordinate[0] >= 7.5 && coordinate[0] <= 10.5 && coordinate[1] >= 47.27 && coordinate[1] <= 55.09, "real-proj4-transform", "finite plausible output");
		});

		await scenario("interaction-continuity", "interaction", async () => {
			const geo = fixture("DR0", 60); await activate(geo);
			window.__ufAIM_viewController.debugSelectAlignmentElement(`${geo.id}_A`);
			await waitFor(() => window.__ufAIM_viewController.getDebugState()?.selectedElementId === `${geo.id}_A`, "geographic element selection");
			const geoSignature = window.__ufAIM_viewController.getDebugState()?.projectionSignature;
			const local = fixture("DA9", 61); await activate(local);
			window.__ufAIM_viewController.debugSelectAlignmentElement(`${local.id}_T`);
			await waitFor(() => window.__ufAIM_viewController.getDebugState()?.selectedElementId === `${local.id}_T`, "local element selection");
			const localSignature = window.__ufAIM_viewController.getDebugState()?.projectionSignature;
			check(Boolean(geoSignature && localSignature), "interaction-continuity", "Viewer geometry refreshed in both modes");
			try {
				await waitFor(() => window.__alignmentNativeEditorUiE2E != null, "Native Editor UI result", 12000);
			} catch { /* An unavailable dependency is recorded below without affecting prior Geo cases. */ }
			const editorResult = window.__alignmentNativeEditorUiE2E ?? null;
			const axtranResult = window.__axtranAlignmentE2E ?? null;
			result.interactionContinuity = {
				alignmentSelection: true,
				elementSelection: true,
				stableElementIds: true,
				viewerRefresh: true,
				cockpitFocus: editorResult?.passed === true,
				straightEditing: editorResult?.passed === true,
				arcEditing: editorResult?.passed === true,
				transitionEditing: editorResult?.passed === true,
				axtranRecalculation: axtranResult?.passed === true,
				dependencies: {
					nativeEditor: editorResult ?? { passed: false, error: "Native Editor UI regression result unavailable" },
					axtran: axtranResult ?? { passed: false, error: "AXTRAN regression result unavailable" },
				},
			};
			const dependencyFailures = [];
			if (editorResult?.passed !== true) dependencyFailures.push(`Native Editor UI: ${editorResult?.error ?? "result unavailable"}`);
			if (axtranResult?.passed !== true) dependencyFailures.push(`AXTRAN: ${axtranResult?.error ?? "result unavailable"}`);
			check(dependencyFailures.length === 0, "interaction-continuity", dependencyFailures.join("; "));
		});
	} catch (error) {
		result.failures.push({ scenario: "harness", assertion: String(error?.message ?? error) });
	} finally {
		const componentPassed = (component) => {
			const cases = result.scenarios.filter((entry) => entry.component === component);
			return cases.length > 0 && cases.every((entry) => entry.passed === true);
		};
		result.geoPassed = componentPassed("geo");
		result.fallbackPassed = componentPassed("fallback");
		result.transformationPassed = componentPassed("transformation");
		result.interactionPassed = componentPassed("interaction");
		result.passed = result.geoPassed && result.fallbackPassed && result.transformationPassed && result.interactionPassed && result.failures.length === 0;
		result.completedAt = new Date().toISOString();
		window.__ufAIM_geoMapAdapter?.destroy?.();
		document.getElementById("geoStage")?.classList.remove("is-geographic");
		const badge = document.getElementById("geoModeBadge");
		if (badge) badge.textContent = "LOCAL";
		delete globalThis.__ufAIM_geoE2EMapLibre;
		console.log(`GeoRuntimeAcceptance E2E RESULT ${JSON.stringify(result)}`);
		console[result.passed ? "log" : "error"](`GeoRuntimeAcceptance E2E ${result.passed ? "PASSED" : "FAILED"}`);
	}
})();
