// app/io/importSession.js
//
// ImportSession v2
// - Matching/Grouping only (does NOT write store)
// - Multi-drop tolerant: files can arrive in any order
// - Never auto-delete groups (soft aging only for UI via getState())
// - Container-ready: ingest() returns { ingests: [...], primary }
//
// Current matching supports VermEsn-like single-topic files (TRA/GRA).
// Later: container formats (LandXML/IFC/ZIP) can emit multiple "raw ingests".

export function makeImportSession(opts = {}) {
	const cfg = {
		softStaleAfterMs: Number.isFinite(opts.softStaleAfterMs) ? opts.softStaleAfterMs : 1000 * 60 * 20, // 20 min
		softColdAfterMs: Number.isFinite(opts.softColdAfterMs) ? opts.softColdAfterMs : 1000 * 60 * 60 * 6,   // 6 h
	};

	// groupKey -> group
	// group shape:
	// {
	//   groupKey, tsFirst, tsLast, count,
	//   items: [{ kind, importObject, originFileName, ts }],
	//   tra: item|null, gra: item|null,
	// }
	const groups = new Map();

	// inside makeImportSession()

	function ingest(importObject, ingestOpts = {}) {
		const originFile = ingestOpts.originFile ?? null;
		const slotHint = ingestOpts.slotHint;
		const safeSlotHint = (slotHint === "left" || slotHint === "km" || slotHint === "right") ? slotHint : "right";

		// 0) Container passthrough bleibt unverändert
		if (Array.isArray(importObject?.ingests) && importObject.ingests.length) {
			const ingests = importObject.ingests.map((raw) =>
			normalizeRawIngest(raw, { slotHint: safeSlotHint, originFile, importObject })
			);
			const primary = pickPrimaryIngest(ingests);
			return { ingests, primary };
		}

		// 1) Kandidaten bestimmen (MS14.3.1)
		const keyRes = pickGroupKey(importObject, {
			originFile: originFile?.name ?? originFile,
			sourceRef: ingestOpts.sourceRef ?? null,
		});

		const candidates = Array.isArray(keyRes?.candidates) ? keyRes.candidates : [];
		const groupsList = Array.from(groups.values());

		// 2) Decision: existing vs new (MS14.3.2)
		const decision = pickExistingOrNewGroup({
			importObject,
			candidates,
			groups: groupsList,
			opts: {
				slotHint: safeSlotHint,
				threshold: 0.45,            // tune later (0.40..0.55)
				recencyHalfLifeMs: 10*60*1000,
				lengthTol: 0.35,
				centerD0: 50,
				centerD1: 800,
			},
		});

		// optional: keep candidates for UI
		decision.candidates = candidates;
		if (!decision.chosenCandidate && candidates.length) {
			decision.chosenCandidate = candidates.slice().sort((a,b)=>b.confidence-a.confidence)[0];
		}

		const groupKey = decision.groupKey;
		const now = Date.now();

		// 3) Gruppe holen/erzeugen
		const g = groups.get(groupKey) ?? {
			groupKey,
			tsFirst: now,
			tsLast: now,
			updatedAt: now,
			count: 0,
			items: [],
			tra: null,
			gra: null,
			slot_attachHint: safeSlotHint,
			summary: { semanticId: null, center: null, length: null, sRange: null },
			lastDecision: null,
		};

		// 4) Item hinzufügen
		const kind = String(importObject?.kind ?? "").toUpperCase() || "UNKNOWN";
		const item = {
			kind,
			importObject,
			originFileName: String(originFile?.name ?? originFile ?? importObject?.name ?? "") || null,
			ts: now,
		};

		g.items.push(item);
		g.count += 1;
		g.tsLast = now;
		g.updatedAt = now;
		g.slot_attachHint = safeSlotHint;
		g.lastDecision = decision;

		if (kind === "TRA") g.tra = item;
		if (kind === "GRA") g.gra = item;

		// 5) Summary updaten (für bessere Folgeentscheidungen)
		updateGroupSummaryFromItem(g, importObject);

		groups.set(groupKey, g);

		// 6) Artifacts bauen
		const artifacts = buildArtifactsForGroup(g, { slotHint: safeSlotHint });

		const ingestResult = {
			baseId: groupKey,
			slot: safeSlotHint,
			source: {
				groupKey,
				files: uniqueStrings(g.items.map(it => it.originFileName).filter(Boolean)),
				lastFile: item.originFileName ?? null,
				tra: g.tra?.originFileName ?? null,
				gra: g.gra?.originFileName ?? null,
				sourceRef: ingestOpts.sourceRef ?? null,
			},
			artifacts,
			meta: {
				groupKey,
				tsLast: g.tsLast,
				count: g.count,
				decision,                 // ✅ MS14.3.2
			},
		};

		return { ingests: [ingestResult], primary: ingestResult };
	}

	function getState() {
		// UI-friendly listing (soft aging only)
		const now = Date.now();
		const arr = Array.from(groups.values())
		.map((g) => {
			const ageMs = Math.max(0, now - (g.tsLast ?? now));
			return {
				groupKey: g.groupKey,
				tsFirst: g.tsFirst,
				tsLast: g.tsLast,
				ageMs,
				ageSec: Math.round(ageMs / 1000),
				isStale: ageMs > cfg.softStaleAfterMs,
				isCold: ageMs > cfg.softColdAfterMs,
				count: g.count ?? (g.items?.length ?? 0),
				hasTRA: Boolean(g.tra),
				hasGRA: Boolean(g.gra),
				lastFile: g.items?.length ? (g.items[g.items.length - 1]?.originFileName ?? null) : null,
				files: uniqueStrings((g.items ?? []).map(it => it.originFileName).filter(Boolean)),
				lastKinds: uniqueStrings((g.items ?? []).slice(-6).map(it => it.kind).filter(Boolean)),
			};
		})
		.sort((a, b) => (b.tsLast ?? 0) - (a.tsLast ?? 0));

		return arr;
	}
	
	function getUIState(uiOpts = {}) {
		const now = Date.now();
		const rows = [];

		let filesSeen = 0;
		let lastIngestAt = 0;

		for (const g of groups.values()) {
			const ageMs = Math.max(0, now - (g.tsLast ?? now));
			const isStale = ageMs > cfg.softStaleAfterMs;
			const isCold = ageMs > cfg.softColdAfterMs;

			const items = Array.isArray(g.items) ? g.items : [];
			filesSeen += items.length;
			if ((g.tsLast ?? 0) > lastIngestAt) lastIngestAt = (g.tsLast ?? 0);

			const traObj = unwrapImportObject(g.tra ?? pickLatestByKind(items, "TRA"));
			const graObj = unwrapImportObject(g.gra ?? pickLatestByKind(items, "GRA"));

			const match = assessMatchTRA_GRA(traObj, graObj);
			const confidence = match.confidence ?? 0;
			const notes = Array.isArray(match.notes) ? match.notes : [];

			// Build artifacts once (for preview + missing)
			const artifacts = buildArtifactsForGroup(g, { slotHint: uiOpts.slotHint ?? "right" });

			const preview = {
				hasAlignment2d: artifacts.some(a => a?.domain === "alignment2d"),
				hasProfile1d: artifacts.some(a => a?.domain === "profile1d"),
				hasCant1d: artifacts.some(a => a?.domain === "cant1d"),
			};

			const missing = [];
			if (!preview.hasAlignment2d) missing.push("TRA(alignment)");
			if (!preview.hasProfile1d) missing.push("GRA(profile)");
			// cant is optional in some cases, so you may not mark it as missing by default
			// if (!preview.hasCant1d) missing.push("TRA(cant)");

			const matchLabel =
			confidence >= 0.75 ? "good" :
			confidence >= 0.55 ? "ok" :
			confidence >= 0.35 ? "weak" : "unknown";

			const row = {
				groupKey: g.groupKey,
				ageMs,
				ageLabel: formatAge(ageMs),
				isStale,
				isCold,

				hasTRA: Boolean(traObj),
				hasGRA: Boolean(graObj),
				kindsPresent: uniqueStrings(items.map(it => it?.kind).filter(Boolean)),
				files: uniqueStrings(items.map(it => it?.originFileName).filter(Boolean)),

				confidence,
				matchLabel,
				notes,

				slotHint: uiOpts.slotHint ?? "right",
				suggestedSlot: uiOpts.slotHint ?? "right",
				suggestedBaseId: g.groupKey,

				preview,
				missing,

				tsFirst: g.tsFirst ?? null,
				tsLast: g.tsLast ?? null,
				count: g.count ?? items.length,
				lastFile: items.length ? (items[items.length - 1]?.originFileName ?? null) : null,
				lastKinds: uniqueStrings(items.slice(-6).map(it => it?.kind).filter(Boolean)),
			};
			
			const d = g.lastDecision ?? null;

			row.decision = d ? {
				mode: d.mode,
				groupKey: d.groupKey,
				score: d.score,
				reasons: d.reasons,
				keyHit: d.keyHit,
				chosenCandidate: d.chosenCandidate,
				topCandidates: (d.candidates ?? []).slice(0, 3),
			} : null;

			rows.push(row);
		}

		rows.sort((a, b) => (b.tsLast ?? 0) - (a.tsLast ?? 0));

		const stats = {
			groupsTotal: rows.length,
			groupsStale: rows.filter(r => r.isStale).length,
			groupsCold: rows.filter(r => r.isCold).length,
			filesSeen,
			lastIngestAt: lastIngestAt || null,
		};

		return {
			now,
			softStaleAfterMs: cfg.softStaleAfterMs,
			softColdAfterMs: cfg.softColdAfterMs,
			stats,
			rows,
		};
	}

	function getSpotState(opts) { return getUIState(opts); }
return { ingest, getState, getUIState, getSpotState };
}

// ---------------------------------------------------------------------------
// Matching / Group key
// ---------------------------------------------------------------------------

function shortSignature(importObject, originFile) {
	// keep cheap + deterministic enough
	const kind = String(importObject?.kind ?? "");
	const n = originFile?.name ?? "";
	const size = Number(originFile?.size ?? 0);
	const t = Number(importObject?.ts ?? 0);
	const s = `${kind}|${n}|${size}|${t}|${Object.keys(ensureObject(importObject?.meta)).join(",")}`;
	return djb2Hex(s).slice(0, 8);
}

function djb2Hex(str) {
	let h = 5381;
	for (let i = 0; i < String(str).length; i++) {
		h = ((h << 5) + h) + String(str).charCodeAt(i);
		h |= 0;
	}
	// unsigned
	return (h >>> 0).toString(16);
}

// ---------------------------------------------------------------------------
// Container-ready passthrough normalization
// ---------------------------------------------------------------------------

function normalizeRawIngest(raw, { slotHint, originFile, importObject } = {}) {
	const baseId = String(raw?.baseId ?? raw?.groupKey ?? raw?.id ?? pickGroupKey(importObject, { originFile }));
	const slot = (raw?.slot === "left" || raw?.slot === "km" || raw?.slot === "right")
	? raw.slot
	: ((slotHint === "left" || slotHint === "km" || slotHint === "right") ? slotHint : "right");

	return {
		baseId,
		slot,
		source: raw?.source ?? {
			groupKey: baseId,
			files: originFile?.name ? [originFile.name] : [],
		},
		artifacts: Array.isArray(raw?.artifacts) ? raw.artifacts : [],
		meta: raw?.meta ?? null,
	};
}

function pickPrimaryIngest(ingests) {
	const arr = Array.isArray(ingests) ? ingests : [];
	if (!arr.length) return null;

	// Prefer ingest with any renderable artifacts; else first
	let best = arr[0];
	let bestScore = scoreIngest(best);

	for (const x of arr) {
		const sc = scoreIngest(x);
		if (sc > bestScore) { best = x; bestScore = sc; }
	}
	return best;
}

function scoreIngest(ingest) {
	const arts = Array.isArray(ingest?.artifacts) ? ingest.artifacts : [];
	let score = 0;
	for (const a of arts) {
		if (!a) continue;
		if (a.domain === "alignment2d") score += 10;
		else if (a.domain === "profile1d") score += 6;
		else if (a.domain === "cant1d") score += 4;
		else score += 1;
	}
	return score;
}

// ---------------------------------------------------------------------------
// Artifact building (TRA/GRA grouping) – uses your v2 idea
// ---------------------------------------------------------------------------

function buildArtifactsForGroup(group, opts = {}) {
	const slot = (opts.slotHint === "left" || opts.slotHint === "km" || opts.slotHint === "right")
	? opts.slotHint
	: "right";

	// group.tra/gra are items (wrappers) holding importObject
	const traItem = group?.tra ?? pickLatestByKind(group?.items, "TRA");
	const graItem = group?.gra ?? pickLatestByKind(group?.items, "GRA");

	const traObj = unwrapImportObject(traItem);
	const graObj = unwrapImportObject(graItem);

	const sources = {
		groupKey: group?.groupKey ?? null,
		files: uniqueStrings((group?.items ?? []).map(it => it?.originFileName).filter(Boolean)),
		tra: traItem?.originFileName ?? traObj?.name ?? null,
		gra: graItem?.originFileName ?? graObj?.name ?? null,
	};

	const match = assessMatchTRA_GRA(traObj, graObj);
	const confidence = match.confidence;
	const notes = match.notes;

	const artifacts = [];

	// alignment2d from TRA
	const polyline2d = pickPolyline2dFromTRA(traObj);
	if (Array.isArray(polyline2d) && polyline2d.length >= 2) {
		const { bbox, bboxCenter } = computeBbox2d(polyline2d);
		artifacts.push({
			domain: "alignment2d",
			kind: "TRA",
			source: sources,
			meta: { groupKey: group?.groupKey ?? null, confidence, notes, slotHint: slot, hasTRA: Boolean(traObj), hasGRA: Boolean(graObj) },
			payload: { polyline2d, bbox, bboxCenter },
		});
	}

	// profile1d from GRA
	const profile1d = pickProfile1dFromGRA(graObj);
	if (Array.isArray(profile1d) && profile1d.length >= 2) {
		artifacts.push({
			domain: "profile1d",
			kind: "GRA",
			source: sources,
			meta: { groupKey: group?.groupKey ?? null, confidence, notes, slotHint: slot, hasTRA: Boolean(traObj), hasGRA: Boolean(graObj) },
			payload: { profile1d },
		});
	}

	// cant1d from TRA
	const cant1d = pickCant1dFromTRA(traObj);
	if (Array.isArray(cant1d) && cant1d.length >= 2) {
		artifacts.push({
			domain: "cant1d",
			kind: "TRA",
			source: sources,
			meta: { groupKey: group?.groupKey ?? null, confidence, notes, slotHint: slot, hasTRA: Boolean(traObj), hasGRA: Boolean(graObj) },
			payload: { cant1d },
		});
	}

	// sessionMeta always (helps UI/Debug/Grabbeltisch)
	artifacts.push({
		domain: "sessionMeta",
		kind: "ImportSession",
		source: sources,
		meta: {
			groupKey: group?.groupKey ?? null,
			confidence,
			notes,
			slotHint: slot,
			hasTRA: Boolean(traObj),
			hasGRA: Boolean(graObj),
			ts: group?.tsLast ?? Date.now(),
			count: group?.count ?? (group?.items?.length ?? 0),
		},
		payload: {
			kindsPresent: uniqueStrings((group?.items ?? []).map(it => it?.kind).filter(Boolean)),
		},
	});

	const hasRenderable = artifacts.some(a => a.domain === "alignment2d" || a.domain === "profile1d" || a.domain === "cant1d");
	if (!hasRenderable) {
		return [{
			domain: "unknown",
			kind: (traObj ? "TRA" : (graObj ? "GRA" : "unknown")),
			source: sources,
			meta: { note: "meta only (no renderable payload yet)", confidence, notes, groupKey: group?.groupKey ?? null },
			payload: null,
		}];
	}

	return artifacts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureObject(x) {
	return (x && typeof x === "object") ? x : {};
}

function unwrapImportObject(x) {
	return x?.importObject ?? x?.data ?? x ?? null;
}

function pickLatestByKind(items, kind) {
	const k = String(kind || "").toUpperCase();
	const arr = Array.isArray(items) ? items : [];
	let best = null;
	let bestTs = -Infinity;

	for (const it of arr) {
		if (!it) continue;
		const obj = unwrapImportObject(it);
		const kk = String(obj?.kind ?? it?.kind ?? "").toUpperCase();
		if (kk !== k) continue;
		const ts = Number(it?.ts ?? obj?.ts ?? 0);
		if (!best || ts >= bestTs) { best = it; bestTs = ts; }
	}
	return best;
}

function pickPolyline2dFromTRA(traObj) {
	return (
	traObj?.geometry?.pts ??
	traObj?.geometry ??
	traObj?.pts ??
	null
	);
}

function pickProfile1dFromGRA(graObj) {
	return (
	graObj?.profile1d ??
	graObj?.profile ??
	null
	);
}

function pickCant1dFromTRA(traObj) {
	return (
	traObj?.cant ??
	traObj?.cant1d ??
	null
	);
}

function computeBbox2d(polyline2d) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

	for (const p of (polyline2d ?? [])) {
		const x = Number(p?.x ?? p?.[0]);
		const y = Number(p?.y ?? p?.[1]);
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}

	if (!Number.isFinite(minX)) return { bbox: null, bboxCenter: null };

	const bbox = { minX, minY, maxX, maxY };
	const bboxCenter = { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };
	return { bbox, bboxCenter };
}

function uniqueStrings(arr) {
	return Array.from(new Set((arr ?? []).filter(Boolean).map(String)));
}

function formatAge(ms) {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.round(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.round(m / 60);
	if (h < 48) return `${h}h`;
	const d = Math.round(h / 24);
	return `${d}d`;
}

// app/io/importSession.v2.js (oder wo du's hinpackst)

function fnv1a32(str) {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = (h * 0x01000193) >>> 0;
	}
	return h.toString(16).padStart(8, "0");
}

function safeNum(n, digits = 3) {
	const v = Number(n);
	if (!Number.isFinite(v)) return "NaN";
	// rounding stabilisiert gegen kleine Parser-/Floating-Diffs
	return v.toFixed(digits);
}

function polyStats2d(pts) {
	if (!Array.isArray(pts) || pts.length < 2) return null;

	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	let len = 0;

	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		const x = Number(p?.x), y = Number(p?.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

		minX = Math.min(minX, x); minY = Math.min(minY, y);
		maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);

		if (i > 0) {
			const p0 = pts[i - 1];
			const x0 = Number(p0?.x), y0 = Number(p0?.y);
			if (Number.isFinite(x0) && Number.isFinite(y0)) {
				len += Math.hypot(x - x0, y - y0);
			}
		}
	}

	if (!Number.isFinite(minX)) return null;

	const start = pts[0];
	const end = pts[pts.length - 1];
	return {
		count: pts.length,
		length: len,
		bbox: { minX, minY, maxX, maxY },
		start: { x: Number(start?.x), y: Number(start?.y) },
		end: { x: Number(end?.x), y: Number(end?.y) },
		center: { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 },
	};
}

function profileStats1d(profile1d) {
	if (!Array.isArray(profile1d) || profile1d.length < 2) return null;

	let sMin = Infinity, sMax = -Infinity;
	for (const p of profile1d) {
		const s = Number(p?.s);
		if (!Number.isFinite(s)) continue;
		sMin = Math.min(sMin, s);
		sMax = Math.max(sMax, s);
	}
	if (!Number.isFinite(sMin)) return null;

	return { count: profile1d.length, sMin, sMax };
}

// Try to extract "semantic id" from meta if present.
// Keep it conservative: if empty -> null.
function extractSemanticId(importObject) {
	const m = importObject?.meta;
	if (!m || typeof m !== "object") return null;

	// Examples (adapt to your parser output as it evolves):
	const candidates = [
	m.axisId, m.axisName, m.alignmentId, m.alignmentName,
	m.routeId, m.routeName, m.projectId, m.projectName,
	];

	for (const c of candidates) {
		const s = String(c ?? "").trim();
		if (s.length >= 2) return s;
	}
	return null;
}

function normalizeFileStem(originFile) {
	const s = String(originFile ?? "").trim();
	if (!s) return null;
	// strip path and extension
	const name = s.split("/").pop();
	return name.replace(/\.[a-z0-9]+$/i, "");
}

/**
* pickGroupKey(importObject, opts)
* - emits best group key + candidates
* - does NOT mutate session state
*/
export function pickGroupKey(importObject, opts = {}) {
	const kind = String(importObject?.kind ?? "unknown").toUpperCase();
	const why = [];

	// 0) semantic (strong)
	const semantic = extractSemanticId(importObject);
	if (semantic) {
		const key = `grp:sem:${fnv1a32(`${kind}|${semantic.toLowerCase()}`)}`;
		return {
			key,
			confidence: 0.92,
			candidates: [
			{ key, confidence: 0.92, why: [`semantic id: ${semantic}`] },
			],
		};
	}

	// 1) geometry signature (medium)
	const pts =
	importObject?.geometry?.pts ??
	importObject?.geometry ??
	importObject?.pts ??
	null;

	const poly = polyStats2d(pts);
	const prof = profileStats1d(importObject?.profile1d ?? importObject?.profile ?? null);

	const candidates = [];

	if (poly) {
		// Signature: bbox center (rounded) + length (rounded) + count bucket
		const sig = [
		"poly",
		safeNum(poly.center.x, 1), safeNum(poly.center.y, 1),
		safeNum(poly.length, 0),
		`n${Math.round(poly.count / 10) * 10}`,
		].join("|");

		const key = `grp:geo:${fnv1a32(sig)}`;
		candidates.push({
			key,
			confidence: 0.78,
			why: [
			"polyline2d signature",
			`center≈(${safeNum(poly.center.x, 1)},${safeNum(poly.center.y, 1)})`,
			`len≈${safeNum(poly.length, 0)}m`,
			`pts=${poly.count}`,
			],
		});
	}

	if (prof) {
		// Profile signature: station range + count bucket
		const sig = [
		"prof",
		safeNum(prof.sMin, 0), safeNum(prof.sMax, 0),
		`n${Math.round(prof.count / 10) * 10}`,
		].join("|");

		const key = `grp:prof:${fnv1a32(sig)}`;
		candidates.push({
			key,
			confidence: 0.62,
			why: [
			"profile1d signature",
			`s≈${safeNum(prof.sMin, 0)}..${safeNum(prof.sMax, 0)}`,
			`pts=${prof.count}`,
			],
		});
	}

	// 2) filename stem (weak fallback)
	const stem = normalizeFileStem(opts.originFile ?? opts.sourceRef?.name);
	if (stem) {
		const key = `grp:file:${fnv1a32(stem.toLowerCase())}`;
		candidates.push({
			key,
			confidence: 0.35,
			why: [`origin file stem: ${stem}`],
		});
	}

	// 3) final fallback
	if (!candidates.length) {
		const key = `grp:unknown:${fnv1a32(`${Date.now()}|${Math.random()}`)}`;
		return {
			key,
			confidence: 0.10,
			candidates: [{ key, confidence: 0.10, why: ["no usable signals"] }],
		};
	}

	// pick best
	candidates.sort((a, b) => (b.confidence - a.confidence));
	return {
		key: candidates[0].key,
		confidence: candidates[0].confidence,
		candidates,
	};
}

// ---------------------------------------------------------------------------
// Minimal match heuristic (cheap + useful)
// ---------------------------------------------------------------------------

function assessMatchTRA_GRA(traObj, graObj) {
	const notes = [];
	let confidence = 0.25;

	if (traObj) { confidence += 0.15; notes.push("has TRA"); }
	if (graObj) { confidence += 0.15; notes.push("has GRA"); }

	const poly = pickPolyline2dFromTRA(traObj);
	const prof = pickProfile1dFromGRA(graObj);

	const traLen = estimatePolylineLength(poly);
	const graEnd = estimateProfileEndS(prof);

	if (Number.isFinite(traLen) && Number.isFinite(graEnd)) {
		const rel = Math.abs(traLen - graEnd) / Math.max(1, Math.max(traLen, graEnd));
		if (rel < 0.10) { confidence += 0.35; notes.push("TRA length ~ GRA s-end (good)"); }
		else if (rel < 0.25) { confidence += 0.20; notes.push("TRA length ~ GRA s-end (ok)"); }
		else notes.push("TRA length != GRA s-end (weak match)");
	} else {
		notes.push("no TRA/GRA length comparison");
	}

	confidence = Math.max(0, Math.min(1, confidence));
	return { confidence, notes };
}

function estimatePolylineLength(poly) {
	if (!Array.isArray(poly) || poly.length < 2) return NaN;
	let sum = 0;
	for (let i = 1; i < poly.length; i++) {
		const a = poly[i - 1], b = poly[i];
		const ax = Number(a?.x ?? a?.[0]); const ay = Number(a?.y ?? a?.[1]);
		const bx = Number(b?.x ?? b?.[0]); const by = Number(b?.y ?? b?.[1]);
		if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) continue;
		sum += Math.hypot(bx - ax, by - ay);
	}
	return sum;
}

function estimateProfileEndS(prof) {
	if (!Array.isArray(prof) || prof.length < 2) return NaN;
	const s0 = Number(prof[0]?.s);
	const s1 = Number(prof[prof.length - 1]?.s);
	if (!Number.isFinite(s0) || !Number.isFinite(s1)) return NaN;
	return Math.max(s0, s1);
}

// ---------------------------------------------------------------------------
// 
// ---------------------------------------------------------------------------

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function dist2(a, b) {
	const dx = Number(a?.x) - Number(b?.x);
	const dy = Number(a?.y) - Number(b?.y);
	if (!Number.isFinite(dx) || !Number.isFinite(dy)) return Infinity;
	return Math.hypot(dx, dy);
}

function overlap1d(a0, a1, b0, b1) {
	const A0 = Math.min(a0, a1), A1 = Math.max(a0, a1);
	const B0 = Math.min(b0, b1), B1 = Math.max(b0, b1);
	const lo = Math.max(A0, B0);
	const hi = Math.min(A1, B1);
	return Math.max(0, hi - lo);
}

function ratioSimilarity(a, b, tol = 0.35) {
	// 1.0 when equal; goes to 0 beyond tolerance
	const A = Number(a), B = Number(b);
	if (!Number.isFinite(A) || !Number.isFinite(B) || A <= 0 || B <= 0) return 0;
	const r = Math.abs(A - B) / Math.max(A, B);
	return clamp01(1 - (r / tol));
}

function centerSimilarity(centerA, centerB, d0 = 50, d1 = 800) {
	// 1 at <= d0 meters, 0 at >= d1 meters
	const d = dist2(centerA, centerB);
	if (!Number.isFinite(d)) return 0;
	if (d <= d0) return 1;
	if (d >= d1) return 0;
	return 1 - ((d - d0) / (d1 - d0));
}

function rangeSimilarity(rangeA, rangeB) {
	const a0 = Number(rangeA?.sMin), a1 = Number(rangeA?.sMax);
	const b0 = Number(rangeB?.sMin), b1 = Number(rangeB?.sMax);
	if (![a0,a1,b0,b1].every(Number.isFinite)) return 0;

	const ov = overlap1d(a0, a1, b0, b1);
	const spanA = Math.max(1e-9, Math.abs(a1 - a0));
	const spanB = Math.max(1e-9, Math.abs(b1 - b0));
	// Jaccard-ish overlap
	const union = spanA + spanB - ov;
	return clamp01(ov / Math.max(1e-9, union));
}

function getSemanticIdFromImport(importObject) {
	// use your extractSemanticId() from MS14.3.1
	// here minimal:
	const m = importObject?.meta;
	const candidates = [
	m?.axisId, m?.axisName, m?.alignmentId, m?.alignmentName,
	m?.routeId, m?.routeName, m?.projectId, m?.projectName,
	];
	for (const c of candidates) {
		const s = String(c ?? "").trim();
		if (s.length >= 2) return s;
	}
	return null;
}

function summarizeImport(importObject) {
	const kind = String(importObject?.kind ?? "unknown").toUpperCase();
	const semanticId = getSemanticIdFromImport(importObject);

	const pts =
	importObject?.geometry?.pts ??
	importObject?.geometry ??
	importObject?.pts ??
	null;

	// reuse polyStats2d/profileStats1d from MS14.3.1
	const poly = polyStats2d(pts);
	const prof = profileStats1d(importObject?.profile1d ?? importObject?.profile ?? null);

	return {
		kind,
		semanticId,
		poly,   // {center,length,bbox,count,...} or null
		prof,   // {sMin,sMax,count} or null
	};
}

/**
* scoreMatch(importObject, group)
* returns: {score, reasons[]}
*/
export function scoreMatch(importObject, group, opts = {}) {
	const imp = summarizeImport(importObject);
	const g = group?.summary ?? {};
	const reasons = [];
	let score = 0;

	// ---- Strong: semantic id ----
	if (imp.semanticId && g.semanticId) {
		const same = imp.semanticId.toLowerCase() === String(g.semanticId).toLowerCase();
		if (same) {
			score += 0.70;
			reasons.push(`semantic match: ${imp.semanticId}`);
		} else {
			// semantic mismatch is a strong negative only if both exist
			score -= 0.20;
			reasons.push(`semantic mismatch (${imp.semanticId} vs ${g.semanticId})`);
		}
	}

	// ---- Medium: geometry ----
	if (imp.poly?.center && g.center) {
		const sC = centerSimilarity(imp.poly.center, g.center, opts.centerD0 ?? 50, opts.centerD1 ?? 800);
		if (sC > 0) reasons.push(`center similarity=${sC.toFixed(2)}`);
		score += 0.20 * sC;
	}

	if (imp.poly?.length && g.length) {
		const sL = ratioSimilarity(imp.poly.length, g.length, opts.lengthTol ?? 0.35);
		if (sL > 0) reasons.push(`length similarity=${sL.toFixed(2)}`);
		score += 0.15 * sL;
	}

	// ---- Medium: station range ----
	if (imp.prof && g.sRange) {
		const sR = rangeSimilarity(imp.prof, g.sRange);
		if (sR > 0) reasons.push(`sRange overlap=${sR.toFixed(2)}`);
		score += 0.20 * sR;
	}

	// ---- Slot hint (very soft) ----
	const slotHint = String(opts.slotHint ?? "").toLowerCase();
	if (slotHint && group?.slotHint) {
		if (slotHint === group.slotHint) {
			score += 0.03;
			reasons.push(`slotHint matches (${slotHint})`);
		} else {
			score -= 0.01;
			reasons.push(`slotHint differs (${slotHint} vs ${group.slotHint})`);
		}
	}

	// ---- Recency bias (tie-breaker) ----
	if (Number.isFinite(group?.tsLast)) {
		const ageMs = Date.now() - group.tsLast;
		const rec = clamp01(1 - (ageMs / (opts.recencyHalfLifeMs ?? 10 * 60 * 1000))); // 10 min default
		score += 0.02 * rec;
	}

	return { score, reasons };
}

/**
* pickExistingOrNewGroup()
* - evaluates candidates from pickGroupKey() (MS14.3.1)
* - compares to existing groups and decides:
*   - attach to best group if score>=threshold
*   - else create new group with chosen candidate key
*/
export function pickExistingOrNewGroup({ importObject, candidates, groups, opts = {} } = {}) {
	const list = Array.isArray(groups) ? groups : [];
	const cands = Array.isArray(candidates) ? candidates : [];

	// baseline: best candidate key (from MS14.3.1)
	const bestCand = cands.slice().sort((a,b)=> (b.confidence - a.confidence))[0] ?? null;

	let best = null;

	for (const g of list) {
		const r = scoreMatch(importObject, g, { ...opts, slotHint: opts.slotHint });
		// small bonus if groupKey equals any candidate key (structural hint)
		const keyHit = cands.some(c => c?.key && c.key === g.groupKey) ? 0.06 : 0;
		const s = r.score + keyHit;

		if (!best || s > best.score) {
			best = { group: g, score: s, reasons: r.reasons, keyHit: keyHit > 0 };
		}
	}

	const threshold = Number.isFinite(opts.threshold) ? opts.threshold : 0.45;

	if (best && best.score >= threshold) {
		return {
			mode: "existing",
			groupKey: best.group.groupKey,
			score: best.score,
			reasons: best.reasons,
			keyHit: best.keyHit,
			chosenCandidate: bestCand,
		};
	}

	// create new: choose best candidate key, fallback if missing
	const newKey = bestCand?.key ?? `grp:new:${Date.now()}`;
	return {
		mode: "new",
		groupKey: newKey,
		score: best?.score ?? 0,
		reasons: best?.reasons ?? ["no strong match"],
		chosenCandidate: bestCand,
	};
}

function updateGroupSummaryFromItems(g) {
	const items = Array.isArray(g?.items) ? g.items : [];
	const traObj = unwrapImportObject(g.tra ?? pickLatestByKind(items, "TRA"));
	const graObj = unwrapImportObject(g.gra ?? pickLatestByKind(items, "GRA"));

	const semantic =
	extractSemanticId(traObj) ??
	extractSemanticId(graObj) ??
	null;

	const poly = polyStats2d(pickPolyline2dFromTRA(traObj));
	const prof = profileStats1d(pickProfile1dFromGRA(graObj));

	const s = g.summary ?? (g.summary = {});
	s.semanticId = semantic ?? s.semanticId ?? null;

	if (poly?.center) s.center = poly.center;
	if (Number.isFinite(poly?.length)) s.length = poly.length;

	if (prof?.sMin != null && prof?.sMax != null) {
		s.sRange = { sMin: prof.sMin, sMax: prof.sMax };
	}
}

function updateGroupSummaryFromItem(group, importObject) {
	const imp = summarizeImport(importObject); // nutzt polyStats2d/profileStats1d/extractSemanticId

	// semantic: wenn noch leer, setzen
	if (!group.summary.semanticId && imp.semanticId) {
		group.summary.semanticId = imp.semanticId;
	}

	// geometry: wenn TRA-Punkte vorhanden, center/length setzen (oder aktualisieren)
	if (imp.poly?.center) group.summary.center = imp.poly.center;
	if (Number.isFinite(imp.poly?.length)) group.summary.length = imp.poly.length;

	// profile: wenn GRA vorhanden, sRange setzen (oder aktualisieren)
	if (imp.prof?.sMin != null && imp.prof?.sMax != null) {
		group.summary.sRange = { sMin: imp.prof.sMin, sMax: imp.prof.sMax };
	}
}
