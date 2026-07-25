export const SUBJECT_KINDS = Object.freeze({
	SPOT_OBJECT: "spot-object",
	ALIGNMENT: "alignment",
	ALIGNMENT_ELEMENT: "alignment-element",
	ALIGNMENT_POSITION: "alignment-position",
	IMPORTED_SOURCE_ITEM: "imported-source-item",
	IMPORT_EVIDENCE_RECORD: "import-evidence-record",
	TRANSITION_DB_RECORD: "transitiondb-record",
	TRANSITION_FUNCTION_COMPONENT: "transition-function-component",
	AXTRAN_CANDIDATE: "axtran-candidate",
	DERIVED_ENGINEERING_OBJECT: "derived-engineering-object",
});

const GLOBAL_KINDS = new Set([
	SUBJECT_KINDS.SPOT_OBJECT,
	SUBJECT_KINDS.ALIGNMENT,
	SUBJECT_KINDS.ALIGNMENT_ELEMENT,
	SUBJECT_KINDS.ALIGNMENT_POSITION,
	SUBJECT_KINDS.DERIVED_ENGINEERING_OBJECT,
]);

const TOOL_LOCAL_KINDS = new Set([
	SUBJECT_KINDS.IMPORTED_SOURCE_ITEM,
	SUBJECT_KINDS.IMPORT_EVIDENCE_RECORD,
	SUBJECT_KINDS.TRANSITION_DB_RECORD,
	SUBJECT_KINDS.TRANSITION_FUNCTION_COMPONENT,
	SUBJECT_KINDS.AXTRAN_CANDIDATE,
]);

export function createSubjectReference(input = {}) {
	const kind = String(input.kind ?? "").trim();
	const id = normalizeId(input.id);
	if (!Object.values(SUBJECT_KINDS).includes(kind)) {
		throw new TypeError(`Unsupported application subject kind: ${kind || "(missing)"}`);
	}
	if (!id) throw new TypeError(`Subject ${kind} requires a stable id`);

	const parent = input.parent == null ? null : createParentReference(input.parent);
	if (
		(kind === SUBJECT_KINDS.ALIGNMENT_ELEMENT || kind === SUBJECT_KINDS.ALIGNMENT_POSITION) &&
		parent?.kind !== SUBJECT_KINDS.ALIGNMENT &&
		parent?.kind !== SUBJECT_KINDS.SPOT_OBJECT
	) {
		throw new TypeError(`${kind} requires its parent Alignment identity`);
	}

	const station = input.station == null ? null : Number(input.station);
	if (kind === SUBJECT_KINDS.ALIGNMENT_POSITION && !Number.isFinite(station)) {
		throw new TypeError("alignment-position requires a finite intrinsic station");
	}

	return Object.freeze({
		kind,
		id,
		...(parent ? { parent } : {}),
		...(station != null ? { station } : {}),
		...(input.component != null ? { component: String(input.component) } : {}),
		...(input.sourceRecord != null ? { sourceRecord: clonePlain(input.sourceRecord) } : {}),
	});
}

export function subjectKey(reference) {
	const ref = createSubjectReference(reference);
	const parentKey = ref.parent ? `${ref.parent.kind}:${ref.parent.id}/` : "";
	return `${parentKey}${ref.kind}:${ref.id}${ref.station == null ? "" : `@${ref.station}`}`;
}

export function isGlobalEngineeringSubject(reference) {
	return Boolean(reference && GLOBAL_KINDS.has(reference.kind));
}

export function isToolLocalSubject(reference) {
	return Boolean(reference && TOOL_LOCAL_KINDS.has(reference.kind));
}

function createParentReference(parent) {
	const kind = String(parent?.kind ?? "").trim();
	const id = normalizeId(parent?.id);
	if (!id || ![SUBJECT_KINDS.ALIGNMENT, SUBJECT_KINDS.SPOT_OBJECT].includes(kind)) {
		throw new TypeError("Subject parent must identify an Alignment or SPOT object");
	}
	return Object.freeze({ kind, id });
}

function normalizeId(value) {
	const id = String(value ?? "").trim();
	return id || null;
}

function clonePlain(value) {
	if (value == null || typeof value !== "object") return value;
	return JSON.parse(JSON.stringify(value));
}
