// app/model/alignment/elements.js

export function makeLine({ length }) {
	return { type: "line", length };
}

export function makeArc({ length, curvature }) {
	// curvature k = 1/R (sign allowed)
	return { type: "arc", length, curvature };
}

export function makeTransition({ length, kA, kE, familyId, params }) {
	return {
		type: "transition",
		length,
		kA,
		kE,
		familyId,      // e.g. "linear-clothoid"
		params: { ...params } // {w1,w2,m,...}
	};
}
