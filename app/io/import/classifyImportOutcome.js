// app/io/import/classifyImportOutcome.js

import { clamp01 } from "@utils/helpers.js";

//
// ...
//
export function classifyImportOutcome(input = {}) {
	const hasAlignment = Boolean(input?.hasAlignment);
	const hasProfile = Boolean(input?.hasProfile);
	const hasCant = Boolean(input?.hasCant);
	const hasUnknown = Boolean(input?.hasUnknown);
	const sourceKind = String(input?.sourceKind ?? "").toUpperCase();

	const reasons = [];

	if (hasAlignment) reasons.push("has alignment");
	if (hasProfile) reasons.push("has profile");
	if (hasCant) reasons.push("has cant");

	let outcome = "candidate";
	let confidence = 0.25;

	if (hasAlignment && hasProfile && hasCant) {
		if (sourceKind === "TRA" || sourceKind === "GRA") {
			outcome = "assemblable";
			confidence = 0.70;
			reasons.push("TRA/GRA requires manual confirmation");
		} else {
			outcome = "buildable";
			confidence = 0.92;
			reasons.push("complete minimal route package");
		}
	}
	else if (hasAlignment && hasProfile) {
		outcome = "assemblable";
		confidence = 0.72;
		reasons.push("alignment + profile present");
	}
	else if (hasAlignment || hasProfile || hasCant) {
		outcome = "candidate";
		confidence = 0.45;
		reasons.push("partial import only");
	}
	else {
		outcome = "candidate";
		confidence = 0.10;
		reasons.push("no build-relevant signals");
	}

	if (hasUnknown) confidence -= 0.10;

	return {
		outcome,
		confidence: clamp01(confidence),
		reasons,
	};
}
