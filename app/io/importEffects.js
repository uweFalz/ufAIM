export function runImportEffects({ effects, store, ui, three }) {
	for (const e of effects ?? []) {
		if (e.type === "log") ui.log?.(e.message);
		if (e.type === "props") ui.showProps?.(e.object);
	}
}
