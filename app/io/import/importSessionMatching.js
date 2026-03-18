// app/io/import/importSessionMatching.js
//
// Matching / grouping helpers for ImportSession
//
// This file owns:
// - group key picking
// - existing-vs-new decision
// - matching score
// - import summary extraction
// - group summary update
//
// Geometry/stat helpers are injected from importSession.js for now,
// so this split stays small and low-risk.

import { clamp01 } from "@src/utils/helpers.js";

//
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
	const A = Number(a), B = Number(b);
	if (!Number.isFinite(A) || !Number.isFinite(B) || A <= 0 || B <= 0) return 0;
	const r = Math.abs(A - B) / Math.max(A, B);
	return clamp01(1 - (r / tol));
}

function centerSimilarity(centerA, centerB, d0 = 50, d1 = 800) {
	const d = dist2(centerA, centerB);
	if (!Number.isFinite(d)) return 0;
	if (d <= d0) return 1;
	if (d >= d1) return 0;
	return 1 - ((d - d0) / (d1 - d0));
}

function rangeSimilarity(rangeA, rangeB) {
	const a0 = Number(rangeA?.sMin), a1 = Number(rangeA?.sMax);
	const b0 = Number(rangeB?.sMin), b1 = Number(rangeB?.sMax);
	if (![a0, a1, b0, b1].every(Number.isFinite)) return 0;

	const ov = overlap1d(a0, a1, b0, b1);
	const spanA = Math.max(1e-9, Math.abs(a1 - a0));
	const spanB = Math.max(1e-9, Math.abs(b1 - b0));
	const union = spanA + spanB - ov;

	return clamp01(ov / Math.max(1e-9, union));
}

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
	return v.toFixed(digits);
}

export function extractSemanticId(importObject) {
	const m = importObject?.meta;
	if (!m || typeof m !== "object") return null;

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
	const name = s.split("/").pop();
	return name.replace(/\.[a-z0-9]+$/i, "");
}

//
// ...
//
export function summarizeImport(importObject, helpers = {}) {
	const {
		polyStats2d,
		profileStats1d,
	} = helpers;

	const kind = String(importObject?.kind ?? "unknown").toUpperCase();
	const semanticId = extractSemanticId(importObject);

	const pts =
	importObject?.geometry?.pts ??
	importObject?.geometry ??
	importObject?.pts ??
	null;

	const poly = typeof polyStats2d === "function" ? polyStats2d(pts) : null;
	const prof = typeof profileStats1d === "function"
	? profileStats1d(importObject?.profile1d ?? importObject?.profile ?? null)
	: null;

	return {
		kind,
		semanticId,
		poly,
		prof,
	};
}

//
// ...
//
export function pickGroupKey(importObject, opts = {}, helpers = {}) {
	const {
		polyStats2d,
		profileStats1d,
	} = helpers;

	const kind = String(importObject?.kind ?? "unknown").toUpperCase();

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

	const pts =
	importObject?.geometry?.pts ??
	importObject?.geometry ??
	importObject?.pts ??
	null;

	const poly = typeof polyStats2d === "function" ? polyStats2d(pts) : null;
	const prof = typeof profileStats1d === "function"
	? profileStats1d(importObject?.profile1d ?? importObject?.profile ?? null)
	: null;

	const candidates = [];

	if (poly) {
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

	const stem = normalizeFileStem(opts.originFile ?? opts.sourceRef?.name);
	if (stem) {
		const key = `grp:file:${fnv1a32(stem.toLowerCase())}`;
		candidates.push({
			key,
			confidence: 0.35,
			why: [`origin file stem: ${stem}`],
		});
	}

	if (!candidates.length) {
		const key = `grp:unknown:${fnv1a32(`${Date.now()}|${Math.random()}`)}`;
		return {
			key,
			confidence: 0.10,
			candidates: [{ key, confidence: 0.10, why: ["no usable signals"] }],
		};
	}

	candidates.sort((a, b) => (b.confidence - a.confidence));
	return {
		key: candidates[0].key,
		confidence: candidates[0].confidence,
		candidates,
	};
}

//
// ...
//
export function scoreMatch(importObject, group, opts = {}, helpers = {}) {
	const imp = summarizeImport(importObject, helpers);
	const g = group?.summary ?? {};
	const reasons = [];
	let score = 0;

	if (imp.semanticId && g.semanticId) {
		const same = imp.semanticId.toLowerCase() === String(g.semanticId).toLowerCase();
		if (same) {
			score += 0.70;
			reasons.push(`semantic match: ${imp.semanticId}`);
		} else {
			score -= 0.20;
			reasons.push(`semantic mismatch (${imp.semanticId} vs ${g.semanticId})`);
		}
	}

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

	if (imp.prof && g.sRange) {
		const sR = rangeSimilarity(imp.prof, g.sRange);
		if (sR > 0) reasons.push(`sRange overlap=${sR.toFixed(2)}`);
		score += 0.20 * sR;
	}

	const slotHint = String(opts.slotHint ?? "").toLowerCase();
	const groupSlotHint = String(group?.slot_attachHint ?? group?.slotHint ?? "").toLowerCase();
	if (slotHint && groupSlotHint) {
		if (slotHint === groupSlotHint) {
			score += 0.03;
			reasons.push(`slotHint matches (${slotHint})`);
		} else {
			score -= 0.01;
			reasons.push(`slotHint differs (${slotHint} vs ${groupSlotHint})`);
		}
	}

	if (Number.isFinite(group?.tsLast)) {
		const ageMs = Date.now() - group.tsLast;
		const rec = clamp01(1 - (ageMs / (opts.recencyHalfLifeMs ?? 10 * 60 * 1000)));
		score += 0.02 * rec;
	}

	return { score, reasons };
}

//
// ...
//
export function pickExistingOrNewGroup({ importObject, candidates, groups, opts = {}, helpers = {} } = {}) {
	const list = Array.isArray(groups) ? groups : [];
	const cands = Array.isArray(candidates) ? candidates : [];

	const bestCand = cands.slice().sort((a, b) => (b.confidence - a.confidence))[0] ?? null;

	let best = null;

	for (const g of list) {
		const r = scoreMatch(importObject, g, { ...opts, slotHint: opts.slotHint }, helpers);
		const keyHit = cands.some((c) => c?.key && c.key === g.groupKey) ? 0.06 : 0;
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

	const newKey = bestCand?.key ?? `grp:new:${Date.now()}`;
	return {
		mode: "new",
		groupKey: newKey,
		score: best?.score ?? 0,
		reasons: best?.reasons ?? ["no strong match"],
		chosenCandidate: bestCand,
	};
}

//
// ...
//
export function updateGroupSummaryFromItem(group, importObject, helpers = {}) {
	const imp = summarizeImport(importObject, helpers);

	if (!group?.summary) group.summary = { semanticId: null, center: null, length: null, sRange: null };

	if (!group.summary.semanticId && imp.semanticId) {
		group.summary.semanticId = imp.semanticId;
	}

	if (imp.poly?.center) group.summary.center = imp.poly.center;
	if (Number.isFinite(imp.poly?.length)) group.summary.length = imp.poly.length;

	if (imp.prof?.sMin != null && imp.prof?.sMax != null) {
		group.summary.sRange = { sMin: imp.prof.sMin, sMax: imp.prof.sMax };
	}
}
