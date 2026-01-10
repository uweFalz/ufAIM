// app/io/importEffects.js

export function runImportEffects({ effects, store, ui, three }) {
	if (!Array.isArray(effects)) return;

	for (const fx of effects) {
		if (!fx || typeof fx !== "object") continue;

		switch (fx.type) {
			case "log": {
				ui?.log?.(String(fx.line ?? ""));
				break;
			}

			case "props": {
				ui?.showProps?.(fx.data ?? null);
				break;
			}

			case "state": {
				const patch = fx.patch ?? null;
				if (patch && typeof patch === "object") store?.setState?.(patch);
				break;
			}

			case "zoom": {
				const bbox = fx.bbox ?? null;
				if (bbox) {
					const padding = Number.isFinite(fx.padding) ? fx.padding : 1.35;
					three?.zoomToFitBox?.(bbox, { padding });
				}
				break;
			}
			
			case "warn": {
				// Fallback: prefix in log; later you can style differently
				const msg = String(fx.line ?? fx.message ?? "");
				ui?.log?.(`⚠️ ${msg}`);
				break;
			}

			case "toast": {
				const text = String(fx.text ?? fx.message ?? "");
				const level = String(fx.level ?? "info"); // "info" | "warn" | "error" | ...
				const ms = Number.isFinite(fx.ms) ? fx.ms : 2500;

				// If UI has a toast hook, use it; otherwise fallback to log
				if (ui?.toast) ui.toast({ text, level, ms });
				else ui?.log?.(`🔔 ${level}: ${text}`);
				break;
			}

			default:
			// ignore unknown effects (forward compatible)
			break;
		}
	}
}
