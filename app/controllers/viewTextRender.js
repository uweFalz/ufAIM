// app/controllers/viewTextRender.js
//
// Pure text render helpers for ViewController/UI boards.
// No store, no DOM, no three adapter.

import { t } from "@app/i18n/strings.js";
import { formatNum } from "@utils/helpers.js";

export function renderBandsText(state) {
	const profile = state.import_profile1d;
	const cant = state.import_cant1d;

	const lines = [];
	lines.push(`${t("bands_header_cursor_s")}=${formatNum(state.cursor?.s ?? 0, 1)} m`);

	if (Array.isArray(profile) && profile.length >= 2) {
		lines.push("");
		lines.push(`${t("bands_profile_title")} pts=${profile.length}`);
		for (const p of profile.slice(0, 10)) {
			lines.push(
				`  s=${formatNum(p.s, 1)}  z=${formatNum(p.z, 3)}  R=${p.R ?? "—"}  T=${p.T ?? "—"}`
			);
		}
	} else {
		lines.push("");
		lines.push(t("bands_profile_empty"));
	}

	if (Array.isArray(cant) && cant.length >= 2) {
		lines.push("");
		lines.push(`${t("bands_cant_title")} pts=${cant.length}`);
		for (const p of cant.slice(0, 10)) {
			lines.push(`  s=${formatNum(p.s, 1)}  u=${formatNum(p.u, 4)} m`);
		}
	} else {
		lines.push("");
		lines.push(t("bands_cant_empty"));
	}

	return lines.join("\n");
}

export function renderSectionText(state, sectionInfo) {
	const s = state.cursor?.s ?? 0;

	const lines = [];
	lines.push(`${t("section_header_cursor_s")}=${formatNum(s, 1)} m`);
	lines.push("");

	if (!sectionInfo) {
		lines.push(t("section_no_sampling"));
		return lines.join("\n");
	}

	lines.push(
		`${t("section_sample")}: x=${formatNum(sectionInfo.x, 3)} y=${formatNum(sectionInfo.y, 3)}`
	);
	lines.push(
		`${t("section_tangent")}: tx=${formatNum(sectionInfo.tx, 4)} ty=${formatNum(sectionInfo.ty, 4)}`
	);
	lines.push(
		`${t("section_chainage")}: s=${formatNum(sectionInfo.s, 2)} / ${t("section_total")}=${formatNum(sectionInfo.total, 2)}`
	);
	lines.push("");
	lines.push(t("section_placeholder"));

	return lines.join("\n");
}
