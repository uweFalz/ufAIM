// src/import/build/inferImportRelations.js
//
// inferImportRelations
//
// Purpose:
// - derive relation candidates between imported items
// - stay deterministic and transparent
// - produce machine-readable candidate links for later UI / user decision
//
// NOT:
// - no mutation
// - no SPOT write
// - no auto-merge
// - no hidden heuristics
//
// Rule:
// imported items -> relation candidates
//
// Current scope:
// - profile -> alignment
// - cant -> alignment
// - staEq -> alignment
//
// Later:
// - alignment <-> alignment
// - relation candidates from geometric similarity
// - AI-assisted ranking

export function inferImportRelations({ items = [] } = {}) {
	const allItems = Array.isArray(items) ? items.filter(isObject) : [];

	const alignments = allItems.filter((item) => item.kind === "alignment");
	const profiles = allItems.filter((item) => item.kind === "profile");
	const cants = allItems.filter((item) => item.kind === "cant");
	const staEqs = allItems.filter((item) => item.kind === "staEq");

	const out = [];

	for (const profile of profiles) {
		for (const alignment of alignments) {
			const candidate = buildProfileToAlignmentCandidate(profile, alignment);
			if (candidate) out.push(candidate);
		}
	}

	for (const cant of cants) {
		for (const alignment of alignments) {
			const candidate = buildCantToAlignmentCandidate(cant, alignment);
			if (candidate) out.push(candidate);
		}
	}

	for (const staEq of staEqs) {
		for (const alignment of alignments) {
			const candidate = buildStaEqToAlignmentCandidate(staEq, alignment);
			if (candidate) out.push(candidate);
		}
	}

	return sortCandidates(dedupeCandidates(out));
}

// -----------------------------------------------------------------------------
// builders
// -----------------------------------------------------------------------------

function buildProfileToAlignmentCandidate(profile, alignment) {
	const score = scoreAttachmentCandidate({
		child: profile,
		parent: alignment,
		expectedParentRoleHints: [
			"referenceLineCandidate",
			"trackAxisCandidate",
			"genericAlignmentCandidate",
		],
	});

	if (score.confidence <= 0) return null;

	return {
		type: "profile->alignment",
		from: profile.id,
		to: alignment.id,
		confidence: score.confidence,
		reasons: score.reasons,
	};
}

function buildCantToAlignmentCandidate(cant, alignment) {
	const score = scoreAttachmentCandidate({
		child: cant,
		parent: alignment,
		expectedParentRoleHints: [
			"trackAxisCandidate",
			"referenceLineCandidate",
			"genericAlignmentCandidate",
		],
	});

	if (score.confidence <= 0) return null;

	return {
		type: "cant->alignment",
		from: cant.id,
		to: alignment.id,
		confidence: score.confidence,
		reasons: score.reasons,
	};
}

function buildStaEqToAlignmentCandidate(staEq, alignment) {
	const score = scoreAttachmentCandidate({
		child: staEq,
		parent: alignment,
		expectedParentRoleHints: [
			"referenceLineCandidate",
			"genericAlignmentCandidate",
			"trackAxisCandidate",
		],
		staEqBias: true,
	});

	if (score.confidence <= 0) return null;

	return {
		type: "staEq->alignment",
		from: staEq.id,
		to: alignment.id,
		confidence: score.confidence,
		reasons: score.reasons,
	};
}

// -----------------------------------------------------------------------------
// scoring
// -----------------------------------------------------------------------------

function scoreAttachmentCandidate({
	child,
	parent,
	expectedParentRoleHints = [],
	staEqBias = false,
} = {}) {
	let score = 0;
	const reasons = [];

	const childMeta = child?.meta ?? {};
	const parentMeta = parent?.meta ?? {};

	if (
		isNonEmptyString(childMeta.sourceGroup) &&
		isNonEmptyString(parentMeta.sourceGroup) &&
		childMeta.sourceGroup === parentMeta.sourceGroup
	) {
		score += 0.45;
		reasons.push("same sourceGroup");
	}

	if (
		isNonEmptyString(childMeta.label) &&
		isNonEmptyString(parentMeta.label) &&
		childMeta.label === parentMeta.label
	) {
		score += 0.30;
		reasons.push("same label");
	} else {
		const labelSimilarity = scoreLabelSimilarity(childMeta.label, parentMeta.label);
		if (labelSimilarity > 0) {
			score += labelSimilarity * 0.20;
			reasons.push(`similar label (${formatScore(labelSimilarity)})`);
		}
	}

	const overlap = computeStationRangeOverlap(
		childMeta.stationRange,
		parentMeta.stationRange
	);

	if (overlap > 0) {
		score += overlap * 0.30;
		reasons.push(`station overlap (${formatScore(overlap)})`);
	}

	if (
		isNonEmptyString(parentMeta.roleHint) &&
		expectedParentRoleHints.includes(parentMeta.roleHint)
	) {
		score += 0.10;
		reasons.push(`roleHint=${parentMeta.roleHint}`);
	}

	if (
		staEqBias &&
		parentMeta.roleHint === "referenceLineCandidate"
	) {
		score += 0.10;
		reasons.push("staEq prefers referenceLine");
	}

	if (
		isNonEmptyString(child?.source?.fileName) &&
		isNonEmptyString(parent?.source?.fileName) &&
		child.source.fileName === parent.source.fileName
	) {
		score += 0.05;
		reasons.push("same source file");
	}

	score = clamp01(score);

	const hasStrongAnchor =
		reasons.includes("same sourceGroup") ||
		reasons.includes("same label") ||
		overlap >= 0.5;

	if (!hasStrongAnchor && score < 0.50) {
		return { confidence: 0, reasons: [] };
	}

	return {
		confidence: roundScore(score),
		reasons,
	};
}

function scoreLabelSimilarity(a, b) {
	const aa = normalizeTextToken(a);
	const bb = normalizeTextToken(b);

	if (!aa || !bb) return 0;
	if (aa === bb) return 1;
	if (aa.includes(bb) || bb.includes(aa)) return 0.75;

	const prefixA = aa.split(/[_\-\s]+/)[0] || "";
	const prefixB = bb.split(/[_\-\s]+/)[0] || "";
	if (prefixA && prefixA === prefixB) return 0.55;

	return 0;
}

function computeStationRangeOverlap(a, b) {
	if (!isStationRange(a) || !isStationRange(b)) return 0;

	const a0 = finiteOrNull(a.sMin);
	const a1 = finiteOrNull(a.sMax);
	const b0 = finiteOrNull(b.sMin);
	const b1 = finiteOrNull(b.sMax);

	if (a0 == null || a1 == null || b0 == null || b1 == null) return 0;
	if (a1 < a0 || b1 < b0) return 0;

	const overlapMin = Math.max(a0, b0);
	const overlapMax = Math.min(a1, b1);
	const overlap = overlapMax - overlapMin;

	if (overlap <= 0) return 0;

	const spanA = a1 - a0;
	const spanB = b1 - b0;
	const refSpan = Math.max(spanA, spanB, 1e-9);

	return clamp01(overlap / refSpan);
}

// -----------------------------------------------------------------------------
// post-processing
// -----------------------------------------------------------------------------

function dedupeCandidates(candidates) {
	const best = new Map();

	for (const c of candidates) {
		if (!isRelationCandidate(c)) continue;

		const key = `${c.type}|${c.from}|${c.to}`;
		const prev = best.get(key);

		if (!prev || c.confidence > prev.confidence) {
			best.set(key, c);
		}
	}

	return [...best.values()];
}

function sortCandidates(candidates) {
	return [...candidates].sort((a, b) => {
		if (b.confidence !== a.confidence) return b.confidence - a.confidence;
		if (a.type !== b.type) return a.type.localeCompare(b.type);
		if (a.from !== b.from) return a.from.localeCompare(b.from);
		return a.to.localeCompare(b.to);
	});
}

// -----------------------------------------------------------------------------
// guards / helpers
// -----------------------------------------------------------------------------

function isRelationCandidate(x) {
	return !!x &&
		typeof x === "object" &&
		typeof x.type === "string" &&
		typeof x.from === "string" &&
		typeof x.to === "string" &&
		Number.isFinite(x.confidence);
}

function isStationRange(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function finiteOrNull(x) {
	return Number.isFinite(x) ? Number(x) : null;
}

function normalizeTextToken(value) {
	if (!isNonEmptyString(value)) return null;

	return String(value)
		.trim()
		.toLowerCase()
		.replace(/\.[^.]+$/, "")
		.replace(/[^a-z0-9_\-]+/g, "_")
		.replace(/^_+|_+$/g, "") || null;
}

function formatScore(value) {
	return String(roundScore(value));
}

function roundScore(value) {
	return Math.round(Number(value) * 1000) / 1000;
}

function clamp01(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function isNonEmptyString(x) {
	return typeof x === "string" && x.trim().length > 0;
}
