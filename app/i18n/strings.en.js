// app/i18n/strings.en.js

export const en = {
	booting: "Starting …",
	boot_start: "bootApp(): start",
	boot_ready: "App ready.",
	boot_ok: "OK",
	boot_failed: "Boot failed",
	boot_ui: "UI wiring …",
	boot_ui_ok: "UI OK",

	status_ready: "Ready",
	status_busy: "Importing …",
	status_error: "Error",

	import_detected_vermesn: "VermEsn detected",
	import_detected_landxml: "LandXML detected",
	import_detected_gnd: "GND Edit detected",
	import_detected_unknown: "Format not recognized",

	import_result_alignment_ready: "{fileName}: 1 alignment ready",
	import_result_alignments_ready: "{fileName}: {count} alignments ready",
	import_result_no_usable_alignment: "{fileName}: no usable plan geometry",
	import_result_only_aux_data: "{fileName}: auxiliary data only",
	import_result_partially_supported: "{fileName}: source recognized, content only partially supported",
	import_result_failed: "{fileName}: import failed",

	import_note_aux_data_present: "Auxiliary data present",
	import_note_crs_missing: "CRS missing",
	import_note_review_needed: "Review needed",

	lang_button: "Language",
	lang_menu_label: "Language",

	// ------------------------------------------------------------
	// SHELL / TOOLBAR
	// ------------------------------------------------------------

	btn_import: "Import",
	btn_spot: "SPOT",
	btn_transition: "Transition",
	btn_bands: "Bands",
	btn_section: "Section",
	btn_status_debug: "Status / Debug",

	btn_cursor_minus_title: "decrease s",
	btn_cursor_plus_title: "increase s",
	cursor_placeholder: "Station",

	slot_select_title: "Active slot",
	slot_right: "right",
	slot_km: "km",
	slot_left: "left",

	label_autofit: "AutoFit",

	btn_fit: "Fit",
	btn_fit_title: "Fit active object",

	btn_pin_toggle: "Pin",
	btn_pin_toggle_title: "Pin / unpin active object",

	btn_pins_clear: "Clear",
	btn_pins_clear_title: "Clear all pins",

	pins_info_empty: "Pins: 0",

	// ------------------------------------------------------------
	// PANELS
	// ------------------------------------------------------------

	panel_spot: "SPOT",
	panel_cockpit: "Cockpit",
	panel_transition: "Transition Editor",
	panel_bands: "Bands",
	panel_section: "Section",
	panel_status_debug: "Status / Debug",

	btn_close_title: "Close",

	label_preset: "Preset",
	label_te_w1: "w1",
	label_te_w2: "w2",
	label_status: "Status:",
	
	spot_activate: "Activate",
	spot_pin: "Pin",
	spot_unpin: "Unpin",
	spot_decision_accept: "Accept",
	spot_decision_defer: "Defer",
	spot_decision_ignore: "Ignore",
	spot_decision_clear_title: "Clear decision",
	spot_alignment_fallback: "Alignment",
	spot_meta_type: "type",
	spot_meta_outcome: "outcome",
	spot_meta_conf: "conf",
	spot_meta_source: "source",
	spot_meta_files: "files",
	spot_meta_missing: "missing",
	spot_header_alignments: "alignments",
	spot_header_files: "files",
	spot_empty: "(drop files to create spots)",

	bands_header_cursor_s: "(Bands) cursor.s",
	bands_profile_title: "z(s) (Profile)",
	bands_profile_empty: "z(s): (no profile / GRA yet)",
	bands_cant_title: "u(s) (Cant/Superelevation)",
	bands_cant_empty: "u(s): (no cant yet)",

	section_header_cursor_s: "(Section) at cursor.s",
	section_no_sampling: "No alignment sampling yet.",
	section_sample: "sample",
	section_tangent: "tangent",
	section_chainage: "chainage",
	section_total: "total",
	section_placeholder: "Cross-section: later (terrain/objects/clearance etc.).",

	chunk_no_active_polyline: "Chunk: no active polyline.",
	chunk_start_set: "Chunk start set at s={s} (Shift+click end)",
	chunk_invalid_range: "Chunk: invalid range.",
	chunk_created: "Chunk created: s={s0}..{s1}",
	chunk_copied_json: "Chunk copied (JSON).",
	chunk_copy_failed: "Copy failed (clipboard blocked).",
	clipboard_api_unavailable: "Clipboard API not available.",
	pin_unpin_missing_action: "Unpin: missing store.actions.unpinRouteProject.",
	viewcontroller_crashed: "❌ ViewController crashed (isolated): {message}",

	pins_info: "Pins: {count}",
	
	props_active: "active",
	props_jump: "Jump",
	props_pin_jump_title: "Jump to this pinned alignment",
	props_unpin_title: "Unpin",
	props_no_pins: "(no pins yet)",

	props_chunk_pending: "Shift-chunk start: s={s} (click end)",
	props_chunk_frozen: "frozen",
	props_chunk_hidden: "hidden",

	props_chunk_freeze_title: "Freeze (protect from auto-drop)",
	props_chunk_hide_title: "Hide/Show",
	props_chunk_remove_title: "Remove",
	props_chunk_copy_metrics_title: "Copy metrics JSON",
	props_chunk_copy_json_title: "Copy chunk JSON",

	props_no_chunks: "(no chunks yet) — Shift+click start/end",
	props_pinned: "Pinned",
	props_chunks: "Chunks",
	props_clear: "Clear",
	
	props_pins_title: "Pins",
props_chunks_title: "Chunks",
};
