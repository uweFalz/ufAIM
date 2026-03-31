// app/core/controllers/CockpitController.js
//
// CockpitController
//
// Zentrale Interaktionsinstanz im Window-Kontext.
//
// -----------------------------------------------------------------------------
// ROLLE
// -----------------------------------------------------------------------------
//
// Der CockpitController ist der operative Layer zwischen:
//
// - SPOT (System of Persistent Truth, ggf. extern / Worker-seitig)
// - Window-Store (lokaler Zustand / View-State)
// - User-Aktionen (UI / Input)
//
// Er orchestriert:
// - Import → SPOT-Material
// - Auswahl / Fokus
// - Rollen-Zuweisung (km / right / left / …)
// - Preview-Erzeugung für Views
//
// -----------------------------------------------------------------------------
// ABGRENZUNG
// -----------------------------------------------------------------------------
//
// Der CockpitController ist:
//
// ✔ KEIN Parser
// ✔ KEIN Importer
// ✔ KEIN View
// ✔ KEIN Datenmodell (nicht SPOT)
//
// Der CockpitController:
//
// ✔ interpretiert User-Aktionen
// ✔ steuert Datenfluss zwischen Store/SPOT/Views
//
// -----------------------------------------------------------------------------
// DATENVERANTWORTUNG
// -----------------------------------------------------------------------------
//
// SPOT:
//   - hält die Wahrheit (Alignments, Profile, Cant, …)
//
// WindowStore:
//   - hält View-State (Auswahl, Fokus, Pins, …)
//
// CockpitController:
//   - verändert SPOT (indirekt oder lokal gespiegelt)
//   - verändert Store (Selection, Interaction)
//
// -----------------------------------------------------------------------------
// V0 SCOPE (MINIMAL)
// -----------------------------------------------------------------------------
//
// ingestImport(importResult)
//   → Importmaterial aufnehmen (spotCandidates / workingItems)
//
// select({ ids, mode })
//   → Auswahl setzen (replace / add / remove)
//
// assignRole({ id, role })
//   → Rolle zuweisen (km / right / left / profile / cant)
//
// remove({ id })
//   → Item entfernen
//
// buildPreview({ ids? })
//   → View-Daten erzeugen (alignment/profile/cant)
//
// -----------------------------------------------------------------------------
// ERWARTETE INPUTS
// -----------------------------------------------------------------------------
//
// importResult:
// {
//   spotCandidates: [],
//   workingItems: []
// }
//
// SPOT-Item (minimal):
// {
//   id,
//   kind,
//   payload,
//   meta: {
//     role: null | "km" | "right" | ...
//   }
// }
//
// -----------------------------------------------------------------------------
// ARCH-KONTEXT
// -----------------------------------------------------------------------------
//
// WindowRuntime
//   → bootWindowApp()
//       → createRuntimeContext()
//       → CockpitController (HIER)
//
// Cockpit ist window-lokal (v0).
// Später:
//   → Messaging / Worker / Shared SPOT Integration möglich.
//
// -----------------------------------------------------------------------------
// DESIGN-PRINZIPIEN
// -----------------------------------------------------------------------------
//
// 1. Minimal vor korrekt
// 2. Keine implizite Logik
// 3. Keine Geometrie hier
// 4. Keine Format-Spezifika
//
// -----------------------------------------------------------------------------
// DEBUG
// -----------------------------------------------------------------------------
//
// In DEV kann Cockpit global exponiert werden:
//
//   window.__ufAIM_cockpit = ctx.cockpit
//
// -----------------------------------------------------------------------------
// NEXT
// -----------------------------------------------------------------------------
//
// - Messaging-Integration (SPOT remote)
// - Undo/Redo
// - MultiWindow Sync
// - Action Logging
// -----------------------------------------------------------------------------

export class CockpitController {
	constructor({ store, messaging, logLine } = {}) {
		this.store = store ?? null;
		this.messaging = messaging ?? null;
		this.logLine = typeof logLine === "function" ? logLine : () => {};

		this.state = {
			selection: [],
			mode: "idle",
		};

		// lokaler SPOT-Spiegel (v0!)
		this.spot = {
			items: {},
		};
	}

	// -------------------------------------------------------------------------
	// ingestImport
	// -------------------------------------------------------------------------

	ingestImport(importResult) {
		if (!importResult) return;

		const {
			spotCandidates = [],
			workingItems = [],
		} = importResult;

		const all = [...spotCandidates, ...workingItems];

		for (const item of all) {
			const id = item?.id ?? this._makeId("spot");

			this.spot.items[id] = {
				kind: item?.kind ?? "unknown",
				payload: item?.payload ?? item,
				meta: {
					role: null,
					source: item?.source ?? null,
				},
			};
		}

		this.logLine?.(
			`[Cockpit] ingestImport: +${all.length} items (total=${Object.keys(this.spot.items).length})`
		);
	}

	// -------------------------------------------------------------------------
	// buildPreview
	// -------------------------------------------------------------------------

	buildPreview({ ids } = {}) {
		const targetIds =
			Array.isArray(ids) && ids.length
				? ids
				: Object.keys(this.spot.items);

		const result = [];

		for (const id of targetIds) {
			const item = this.spot.items[id];
			if (!item) continue;

			const sparse =
				item?.payload?.sparseAlignment ??
				item?.payload?.payload?.sparseAlignment ??
				null;

			if (!sparse) continue;

			result.push({
				id,
				type: "alignmentPreview",
				sparseAlignment: sparse,
			});
		}

		this.logLine?.(
			`[Cockpit] buildPreview: ${result.length} alignment(s)`
		);

		return result;
	}

	// -------------------------------------------------------------------------
	// @baustelle select
	// -------------------------------------------------------------------------
	// select({ ids, mode }) {
	//   // replace / add / remove
	// }

	// -------------------------------------------------------------------------
	// @baustelle assignRole
	// -------------------------------------------------------------------------
	// assignRole({ id, role }) {
	//   // km / right / left / profile / cant
	// }

	// -------------------------------------------------------------------------
	// @baustelle remove
	// -------------------------------------------------------------------------
	// remove({ id }) {
	//   // delete from SPOT
	// }

	// -------------------------------------------------------------------------
	// helpers
	// -------------------------------------------------------------------------

	_makeId(prefix) {
		return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
	}
}
