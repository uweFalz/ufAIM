// src/import/parsers/technet/gndEdit/gnd/buildGndSequences.js

export function buildGndSequences({
	edgesByFamily = {},
	padIndex = {},
	edgeFamilies = [],
	helpers = {},
} = {}) {
	const {
		buildSequenceSeed,
		isValidSeedForFamily,
		finalizeMergedSequence,
	} = helpers;

	const sequenceSeedsByFamily = Object.fromEntries(
		edgeFamilies.map((family) => [
			family,
			arr(edgesByFamily?.[family]).map((edge) =>
				buildSequenceSeed(edge, padIndex)
			),
		])
	);

	const validSequenceSeedsByFamily = Object.fromEntries(
		edgeFamilies.map((family) => [
			family,
			arr(sequenceSeedsByFamily?.[family]).filter(isValidSeedForFamily),
		])
	);

	const rejectedSequenceSeedsByFamily = Object.fromEntries(
		edgeFamilies.map((family) => [
			family,
			arr(sequenceSeedsByFamily?.[family]).filter(
				(seed) => !isValidSeedForFamily(seed)
			),
		])
	);

	const sequencesByFamily = {};

	for (const family of edgeFamilies) {
		sequencesByFamily[family] = mergeSeedsWithinFamily({
			seeds: validSequenceSeedsByFamily?.[family],
			family,
			padIndex,
			finalizeMergedSequence,
		});
	}

	return {
		sequenceSeedsByFamily,
		validSequenceSeedsByFamily,
		rejectedSequenceSeedsByFamily,
		sequencesByFamily,
	};
}

function mergeSeedsWithinFamily({
	seeds = [],
	family,
	padIndex,
	finalizeMergedSequence,
} = {}) {
	const remaining = arr(seeds).slice();
	const merged = [];

	while (remaining.length) {
		const start = remaining.shift();
		const seq = makeGrowingSequence(start, family);

		let changed = true;

		while (changed) {
			changed = false;

			for (let i = 0; i < remaining.length; i++) {
				const cand = remaining[i];

				const appendProbe = canAppendSeedToSequence(seq, cand);
				if (appendProbe.ok) {
					applyAppendSeedToSequence(seq, cand, appendProbe);
					remaining.splice(i, 1);
					changed = true;
					break;
				}

				const prependProbe = canPrependSeedToSequence(seq, cand);
				if (prependProbe.ok) {
					applyPrependSeedToSequence(seq, cand, prependProbe);
					remaining.splice(i, 1);
					changed = true;
					break;
				}
			}
		}

		merged.push(withSourceOrderWitness(finalizeMergedSequence(seq, padIndex), seq.edgeChain));
	}

	return merged.sort(compareMergedSequences);
}

function withSourceOrderWitness(sequence, edgeChain) {
	const assembledRows = arr(edgeChain).map(sourceRow);
	const sourceRows = [...assembledRows].sort(compareSourceRows);
	return {
		...sequence,
		sourceOrderWitness: deepFreeze({
			sourceRows,
			assembledRows,
			classification: classifySourceOrder(assembledRows),
			blockAuthority: "not-available-in-table-export",
		}),
	};
}

function sourceRow(edge) {
	const ordinal = finiteOrNull(edge?.sourceOrdinal ?? edge?.extras?.sourceOrdinal);
	return { rowRef: asTrimmedString(edge?.extras?.rowRef), sourceOrdinal: ordinal };
}

function compareSourceRows(a, b) {
	if (a.sourceOrdinal == null && b.sourceOrdinal == null) return String(a.rowRef ?? "").localeCompare(String(b.rowRef ?? ""));
	if (a.sourceOrdinal == null) return 1;
	if (b.sourceOrdinal == null) return -1;
	return a.sourceOrdinal - b.sourceOrdinal || String(a.rowRef ?? "").localeCompare(String(b.rowRef ?? ""));
}

function classifySourceOrder(rows) {
	const ordinals = rows.map((row) => row.sourceOrdinal);
	if (ordinals.some((value) => value == null) || new Set(ordinals).size !== ordinals.length) return "non-monotone";
	if (ordinals.every((value, index) => index === 0 || value > ordinals[index - 1])) return "preserved";
	if (ordinals.every((value, index) => index === 0 || value < ordinals[index - 1])) return "reordered";
	return "non-monotone";
}

function finiteOrNull(value) {
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function deepFreeze(value) {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
	for (const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
}

function makeGrowingSequence(seed, family) {
	return {
		family,
		seedIds: [seed?.id ?? null],
		startPad: seed?.startPad ?? null,
		endPad: seed?.endPad ?? null,
		required: cloneRequiredMap(seed?.required),
		candidates: cloneCandidateMap(seed?.candidates, family),
		edgeChain: arr(seed?.edgeChain),
	};
}

function cloneRequiredMap(required) {
	return {
		requiredLsys: asTrimmedString(required?.requiredLsys),
		requiredHsys: asTrimmedString(required?.requiredHsys),
	};
}

function cloneCandidateMap(candidates, family) {
	const out = {};
	const cfg = getFamilyConfig(family);

	for (const key of cfg.candidateKeys) {
		out[key] = normalizeSet(candidates?.[key]);
	}

	return out;
}

function mergeSequenceCandidates(seqCandidates, seedCandidates, family) {
	const out = {};
	const cfg = getFamilyConfig(family);

	for (const key of cfg.candidateKeys) {
		out[key] = intersectSets(seqCandidates?.[key], seedCandidates?.[key]);
	}

	return out;
}

function mergeRequired(seqRequired, seedRequired, family) {
	const cfg = getFamilyConfig(family);
	const out = cloneRequiredMap(seqRequired);

	for (const key of cfg.requiredKeys) {
		const a = asTrimmedString(seqRequired?.[key]);
		const b = asTrimmedString(seedRequired?.[key]);

		if (a !== b) return null;

		out[key] = a;
	}

	return out;
}

function canAppendSeedToSequence(seq, seed) {
	if (!seq || !seed) return { ok: false };
	if (seq.family !== seed.family) return { ok: false };
	if (seq.endPad !== seed.startPad) return { ok: false };

	const mergedRequired = mergeRequired(seq.required, seed.required, seq.family);
	if (!mergedRequired) return { ok: false };

	const mergedCandidates = mergeSequenceCandidates(
		seq.candidates,
		seed.candidates,
		seq.family
	);

	if (!hasAllFamilyCandidateKeys(mergedCandidates, seq.family)) {
		return { ok: false };
	}

	return {
		ok: true,
		required: mergedRequired,
		candidates: mergedCandidates,
	};
}

function canPrependSeedToSequence(seq, seed) {
	if (!seq || !seed) return { ok: false };
	if (seq.family !== seed.family) return { ok: false };
	if (seed.endPad !== seq.startPad) return { ok: false };

	const mergedRequired = mergeRequired(seq.required, seed.required, seq.family);
	if (!mergedRequired) return { ok: false };

	const mergedCandidates = mergeSequenceCandidates(
		seq.candidates,
		seed.candidates,
		seq.family
	);

	if (!hasAllFamilyCandidateKeys(mergedCandidates, seq.family)) {
		return { ok: false };
	}

	return {
		ok: true,
		required: mergedRequired,
		candidates: mergedCandidates,
	};
}

function applyAppendSeedToSequence(seq, seed, probe) {
	seq.seedIds.push(seed?.id ?? null);
	seq.endPad = seed?.endPad ?? seq.endPad;
	seq.required = probe.required;
	seq.candidates = probe.candidates;
	seq.edgeChain.push(...arr(seed?.edgeChain));
}

function applyPrependSeedToSequence(seq, seed, probe) {
	seq.seedIds.unshift(seed?.id ?? null);
	seq.startPad = seed?.startPad ?? seq.startPad;
	seq.required = probe.required;
	seq.candidates = probe.candidates;
	seq.edgeChain.unshift(...arr(seed?.edgeChain));
}

function compareMergedSequences(a, b) {
	return [
		String(a?.family ?? ""),
		String(a?.lsys ?? ""),
		String(a?.hsys ?? ""),
		String(a?.strecke ?? ""),
		String(a?.strRikz ?? ""),
		String(a?.stationStart ?? ""),
	].join("|").localeCompare([
		String(b?.family ?? ""),
		String(b?.lsys ?? ""),
		String(b?.hsys ?? ""),
		String(b?.strecke ?? ""),
		String(b?.strRikz ?? ""),
		String(b?.stationStart ?? ""),
	].join("|"));
}

const FAMILY_CONFIG = {
	EL: {
		requiredKeys: ["requiredLsys"],
		candidateKeys: ["ppKeys", "plKeys"],
	},
	EK: {
		requiredKeys: ["requiredLsys"],
		candidateKeys: ["ppKeys", "plKeys"],
	},
	EU: {
		requiredKeys: [],
		candidateKeys: ["ppKeys", "plKeys"],
	},
	EH: {
		requiredKeys: ["requiredHsys"],
		candidateKeys: ["ppKeys", "plKeys", "phKeys"],
	},
};

function getFamilyConfig(family) {
	return FAMILY_CONFIG[family] ?? { requiredKeys: [], candidateKeys: [] };
}

function hasAllFamilyCandidateKeys(candidates, family) {
	const cfg = getFamilyConfig(family);

	for (const key of cfg.candidateKeys) {
		if (normalizeSet(candidates?.[key]).size === 0) return false;
	}

	return true;
}

function arr(x) {
	return Array.isArray(x) ? x : [];
}

function asTrimmedString(v) {
	if (v == null) return null;
	const s = String(v).trim();
	return s || null;
}

function normalizeSet(x) {
	if (x instanceof Set) {
		return new Set(Array.from(x).map(normalizeToken).filter(Boolean));
	}

	if (Array.isArray(x)) {
		return new Set(x.map(normalizeToken).filter(Boolean));
	}

	return new Set();
}

function normalizeToken(v) {
	return asTrimmedString(v);
}

function intersectSets(a, b) {
	const aa = normalizeSet(a);
	const bb = normalizeSet(b);

	if (!aa.size || !bb.size) return new Set();

	const out = new Set();

	for (const x of aa) {
		if (bb.has(x)) out.add(x);
	}

	return out;
}
