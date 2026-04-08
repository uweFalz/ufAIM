// src/import/contracts/importSessionItem.contract.js

export const IMPORT_SESSION_ITEM_KINDS = Object.freeze([
	"alignment",
	"profile",
	"cant",
	"staEq",
	"relation",
]);

export const IMPORT_SESSION_ITEM_STAGES = Object.freeze([
	"parsed",
	"normalized",
	"validated",
	"derived",
	"rejected",
]);

export function isImportSessionItemKind(value) {
	return IMPORT_SESSION_ITEM_KINDS.includes(value);
}

export function isImportSessionItemStage(value) {
	return IMPORT_SESSION_ITEM_STAGES.includes(value);
}
