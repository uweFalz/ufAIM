// app/io/import/importSession.js
//
// ImportSession v2
// - Matching/Grouping only (does NOT write store)
// - Multi-drop tolerant: files can arrive in any order
// - Never auto-delete groups (soft aging only for UI via getState())
// - Container-ready: ingest() returns { ingests: [...], primary }
//
// Notes
// - groupKey = technical grouping/matching id
// - spotId   = stable UI/session id for user work on the Grabbeltisch

import { buildArtifactsFromGroup } from "./buildImportArtifacts.js";
import { classifyImportOutcome } from "./classifyImportOutcome.js";
import {
	pickGroupKey,
	pickExistingOrNewGroup,
	updateGroupSummaryFromItem,
} from "./importSessionMatching.js";

//
// ...
//
export function makeImportSession(opts = {}) {
	const cfg = {
		softStaleAfterMs: Number.isFinite(opts.softStaleAfterMs) ? opts.softStaleAfterMs : 1000 * 60 * 20, // 20 min
		softColdAfterMs: Number.isFinite(opts.softColdAfterMs) ? opts.softColdAfterMs : 1000 * 60 * 60 * 6, // 6 h
	};

	// groupKey -> group
	// group shape:
	// {
	//   groupKey, spotId, tsFirst, tsLast, count,
	//   items: [{ kind, importObject, originFileName, ts }],
	//   tra: item|null, gra: item|null,
	//   slot_attachHint, slot_user,
	//   baseId_user,
	//   summary, lastDecision
	// }
	const groups = new Map();

	let nextSpotSeq = 1;
	function makeSpotId() {
		const id = `spot_${String(nextSpotSeq).padStart(5, "0")}`;
		nextSpotSeq += 1;
		return id;
	}

	const matchingHelpers = {
		polyStats2d,
		profileStats1d,
	};

	function setGroupSlot(groupKey, slot) {
		if (slot !== "left" && slot !== "right" && slot !== "km") return false;

		const g = groups.get(groupKey);
		if (!g) return false;

		g.slot_user = slot;
		g.updatedAt = Date.now();
		return true;
	}

	function setGroupBaseId(groupKey, baseId) {
		const g = groups.get(groupKey);
		if (!g) return false;

		const id = String(baseId ?? "").trim();
		if (!id) return false;

		g.baseId_user = id;
		g.updatedAt = Date.now();
		return true;
	}

	function ingest(importObject, ingestOpts = {}) {
		const originFile = ingestOpts.originFile ?? null;
		const slotHint = ingestOpts.slotHint;
		const safeSlotHint = (slotHint === "left" || slotHint === "km" || slotHint === "right") ? slotHint : "right";

		// 0) Container passthrough
		if (Array.isArray(importObject?.ingests) && importObject.ingests.length) {
			const ingests = importObject.ingests.map((raw) =>
			normalizeRawIngest(raw, { slotHint: safeSlotHint, originFile, importObject, matchingHelpers })
			);
			const primary = pickPrimaryIngest(ingests);
			return { ingests, primary };
		}

		// 1) candidates
		const keyRes = pickGroupKey(
		importObject,
		{
			originFile: originFile?.name ?? originFile,
			sourceRef: ingestOpts.sourceRef ?? null,
		},
		matchingHelpers
		);

		const candidates = Array.isArray(keyRes?.candidates) ? keyRes.candidates : [];
		const groupsList = Array.from(groups.values());

		// 2) existing vs new
		const decision = pickExistingOrNewGroup({
			importObject,
			candidates,
			groups: groupsList,
			opts: {
				slotHint: safeSlotHint,
				threshold: 0.45,
				recencyHalfLifeMs: 10 * 60 * 1000,
				lengthTol: 0.35,
				centerD0: 50,
				centerD1: 800,
			},
			helpers: matchingHelpers,
		});

		decision.candidates = candidates;
		if (!decision.chosenCandidate && candidates.length) {
			decision.chosenCandidate = candidates.slice().sort((a, b) => b.confidence - a.confidence)[0];
		}

		const groupKey = decision.groupKey;
		const now = Date.now();

		// 3) fetch/create group
		const g = groups.get(groupKey) ?? {
			groupKey,
			spotId: makeSpotId(),

			tsFirst: now,
			tsLast: now,
			updatedAt: now,
			count: 0,
			items: [],

			tra: null,
			gra: null,

			slot_attachHint: safeSlotHint,
			slot_user: null,

			baseId_user: null,

			summary: { semanticId: null, center: null, length: null, sRange: null },
			lastDecision: null,
		};

		// 4) append item
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

		// 5) summary
		updateGroupSummaryFromItem(g, importObject, matchingHelpers);

		groups.set(groupKey, g);

		// 6) artifacts
		const artifacts = buildArtifactsFromGroup(g, { slotHint: safeSlotHint });

		const classification = classifyImportOutcome({
			hasAlignment: artifacts.some(a => a?.domain === "alignment2d"),
			hasProfile: artifacts.some(a => a?.domain === "profile1d"),
			hasCant: artifacts.some(a => a?.domain === "cant1d"),
			hasUnknown: artifacts.some(a => a?.domain === "unknown"),
			sourceKind: importObject?.kind ?? null,
		});

		const ingestResult = {
			baseId: groupKey,
			slot: safeSlotHint,
			source: {
				groupKey,
				spotId: g.spotId ?? null,
				files: uniqueStrings(g.items.map(it => it.originFileName).filter(Boolean)),
				lastFile: item.originFileName ?? null,
				tra: g.tra?.originFileName ?? null,
				gra: g.gra?.originFileName ?? null,
				sourceRef: ingestOpts.sourceRef ?? null,
			},
			artifacts,
			meta: {
				groupKey,
				spotId: g.spotId ?? null,
				tsLast: g.tsLast,
				count: g.count,
				decision,
				outcome: classification.outcome,
				confidence: classification.confidence,
				reasons: classification.reasons,
			},
		};

		return { ingests: [ingestResult], primary: ingestResult };
	}

	function getState() {
		const now = Date.now();
		const arr = Array.from(groups.values())
		.map((g) => {
			const ageMs = Math.max(0, now - (g.tsLast ?? now));
			return {
				groupKey: g.groupKey,
				spotId: g.spotId ?? g.groupKey,
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

			// preview flags (no artifact build here)
			const polyline2d = pickPolyline2dFromTRA(traObj);
			const profile1d = pickProfile1dFromGRA(graObj);
			const cant1d = pickCant1dFromTRA(traObj);

			const preview = {
				hasAlignment2d: Array.isArray(polyline2d) && polyline2d.length >= 2,
				hasProfile1d: Array.isArray(profile1d) && profile1d.length >= 2,
				hasCant1d: Array.isArray(cant1d) && cant1d.length >= 2,
			};

			const classification = classifyImportOutcome({
				hasAlignment: preview.hasAlignment2d,
				hasProfile: preview.hasProfile1d,
				hasCant: preview.hasCant1d,
				sourceKind: traObj?.kind ?? graObj?.kind ?? null,
			});

			const missing = [];
			if (!preview.hasAlignment2d) missing.push("TRA(alignment)");
			if (!preview.hasProfile1d) missing.push("GRA(profile)");
			// cant intentionally optional for now

			const matchLabel =
			confidence >= 0.75 ? "good" :
			confidence >= 0.55 ? "ok" :
			confidence >= 0.35 ? "weak" : "unknown";

			const row = {
				groupKey: g.groupKey,
				spotId: g.spotId ?? g.groupKey,

				ageMs,
				ageLabel: formatAge(ageMs),
				isStale,
				isCold,

				hasTRA: Boolean(traObj),
				hasGRA: Boolean(graObj),
				kindsPresent: uniqueStrings(items.map(it => it?.kind).filter(Boolean)),
				files: uniqueStrings(items.map(it => it?.originFileName).filter(Boolean)),
				
				sourceLabel: buildSourceLabel(g),
				sourceDetails: buildSourceDetails(g),

				confidence,
				matchLabel,
				notes,

				slotHint: uiOpts.slotHint ?? "right",

				slotUser: g.slot_user ?? null,
				slotEffective: g.slot_user ?? g.slot_attachHint ?? "right",
				suggestedSlot: g.slot_attachHint ?? "right",

				baseIdUser: g.baseId_user ?? null,
				suggestedBaseId: g.groupKey,
				baseIdEffective: g.baseId_user ?? g.groupKey,

				preview,
				missing,

				tsFirst: g.tsFirst ?? null,
				tsLast: g.tsLast ?? null,
				count: g.count ?? items.length,
				lastFile: items.length ? (items[items.length - 1]?.originFileName ?? null) : null,
				lastKinds: uniqueStrings(items.slice(-6).map(it => it?.kind).filter(Boolean)),

				outcome: classification.outcome,
				outcomeConfidence: classification.confidence,
				outcomeReasons: classification.reasons,
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
		
		// detect baseId conflicts
		const baseMap = new Map();

		for (const r of rows) {
			const baseId = r.baseIdEffective ?? r.suggestedBaseId ?? r.groupKey;
			if (!baseMap.has(baseId)) baseMap.set(baseId, []);
			baseMap.get(baseId).push(r);
		}

		for (const list of baseMap.values()) {
			if (list.length > 1) {
				for (const r of list) r.baseConflict = true;
			}
		}

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

	function getSpotState(opts) {
		return getUIState(opts);
	}

	return {
		ingest,
		getState,
		getUIState,
		getSpotState,
		setGroupSlot,
		setGroupBaseId,
	};
}

// ---------------------------------------------------------------------------
// Small deterministic signature helper (currently unused externally)
// ---------------------------------------------------------------------------

function shortSignature(importObject, originFile) {
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
	return (h >>> 0).toString(16);
}

// ---------------------------------------------------------------------------
// Container-ready passthrough normalization
// ---------------------------------------------------------------------------

function normalizeRawIngest(raw, { slotHint, originFile, importObject, matchingHelpers } = {}) {
	const keyRes = pickGroupKey(importObject, { originFile }, matchingHelpers);
	const fallbackBaseId = String(keyRes?.key ?? `grp:raw:${Date.now()}`);

	const baseId = String(raw?.baseId ?? raw?.groupKey ?? raw?.id ?? fallbackBaseId);
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

	let best = arr[0];
	let bestScore = scoreIngest(best);

	for (const x of arr) {
		const sc = scoreIngest(x);
		if (sc > bestScore) {
			best = x;
			bestScore = sc;
		}
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
// helpers
// ---------------------------------------------------------------------------

function buildSourceDetails(group) {
	const items = Array.isArray(group?.items) ? group.items : [];
	const out = [];

	for (const it of items) {
		const obj = unwrapImportObject(it);

		const fileName =
		String(it?.originFileName ?? obj?.name ?? "").trim() || null;

		const internalName =
		String(
		obj?.meta?.axisName ??
		obj?.meta?.alignmentName ??
		obj?.meta?.routeName ??
		obj?.meta?.name ??
		""
		).trim() || null;

		const kind = String(it?.kind ?? obj?.kind ?? "").toUpperCase() || "UNKNOWN";

		let label = fileName;

		if (internalName && internalName !== fileName) {
			label = fileName
			? `${fileName} → ${internalName}`
			: internalName;
		}

		if (!label) continue;

		out.push({
			kind,
			label,
			fileName,
			internalName,
		});
	}

	// dedupe by label
	const seen = new Set();
	return out.filter((x) => {
		const key = `${x.kind}|${x.label}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function buildSourceLabel(group) {
	const details = buildSourceDetails(group);
	if (!details.length) return "—";

	if (details.length === 1) {
		return details[0].label;
	}

	return details.map(d => d.label).join(" · ");
}

// ---------------------------------------------------------------------------
// Generic helpers
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
		if (!best || ts >= bestTs) {
			best = it;
			bestTs = ts;
		}
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

// ---------------------------------------------------------------------------
// Geometry/stat helpers (still local for now)
// ---------------------------------------------------------------------------

function polyStats2d(pts) {
	if (!Array.isArray(pts) || pts.length < 2) return null;

	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	let len = 0;

	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		const x = Number(p?.x);
		const y = Number(p?.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);

		if (i > 0) {
			const p0 = pts[i - 1];
			const x0 = Number(p0?.x);
			const y0 = Number(p0?.y);
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

	let sMin = Infinity;
	let sMax = -Infinity;

	for (const p of profile1d) {
		const s = Number(p?.s);
		if (!Number.isFinite(s)) continue;
		sMin = Math.min(sMin, s);
		sMax = Math.max(sMax, s);
	}
	if (!Number.isFinite(sMin)) return null;

	return { count: profile1d.length, sMin, sMax };
}

// ---------------------------------------------------------------------------
// Minimal match heuristic (cheap + useful)
// ---------------------------------------------------------------------------

function assessMatchTRA_GRA(traObj, graObj) {
	const notes = [];
	let confidence = 0.25;

	if (traObj) {
		confidence += 0.15;
		notes.push("has TRA");
	}
	if (graObj) {
		confidence += 0.15;
		notes.push("has GRA");
	}

	const poly = pickPolyline2dFromTRA(traObj);
	const prof = pickProfile1dFromGRA(graObj);

	const traLen = estimatePolylineLength(poly);
	const graEnd = estimateProfileEndS(prof);

	if (Number.isFinite(traLen) && Number.isFinite(graEnd)) {
		const rel = Math.abs(traLen - graEnd) / Math.max(1, Math.max(traLen, graEnd));
		if (rel < 0.10) {
			confidence += 0.35;
			notes.push("TRA length ~ GRA s-end (good)");
		} else if (rel < 0.25) {
			confidence += 0.20;
			notes.push("TRA length ~ GRA s-end (ok)");
		} else {
			notes.push("TRA length != GRA s-end (weak match)");
		}
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
		const a = poly[i - 1];
		const b = poly[i];
		const ax = Number(a?.x ?? a?.[0]);
		const ay = Number(a?.y ?? a?.[1]);
		const bx = Number(b?.x ?? b?.[0]);
		const by = Number(b?.y ?? b?.[1]);
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
