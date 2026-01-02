// app/io/projectIO.js
// Import/Export for ufAIM.project.v0 (JSON)

export const PROJECT_FORMAT = "ufAIM.project.v0";

export function defaultProject() {
	return {
		format: PROJECT_FORMAT,
		meta: {
			name: "demo",
			crs: "LOCAL",
			units: "m"
		},
		alignment: {
			embed: { lead: 60, L: 120, R: 800, arcLen: 220 },
			transition: { 
				preset: "clothoid", w1: 0.0, w2: 1.0, plot: "k", 
				"family": "linear-clothoid", "m": 1.0
			}
		},
		ui: {
			// viewer language: station in meters; null means "use u"
			s_abs: null,
			// editor language:
			u: 0.25
		}
	};
}

function clamp01(x) {
	return Math.max(0, Math.min(1, x));
}

function num(x, fallback) {
	const v = Number(x);
	return Number.isFinite(v) ? v : fallback;
}

function str(x, fallback) {
	return typeof x === "string" ? x : fallback;
}

// Minimal, forgiving validator + normalizer (v0)
export function normalizeProject(raw) {
	const base = defaultProject();

	if (!raw || typeof raw !== "object") return base;

	// format gate: allow missing during early trials, but normalize to our format
	const fmt = str(raw.format, PROJECT_FORMAT);
	const out = { ...base, format: PROJECT_FORMAT };

	// meta
	out.meta = {
		...base.meta,
		...(raw.meta && typeof raw.meta === "object" ? raw.meta : {})
	};
	out.meta.name = str(out.meta.name, base.meta.name);
	out.meta.crs = str(out.meta.crs, base.meta.crs);
	out.meta.units = str(out.meta.units, base.meta.units);

	// alignment.embed
	const embed = raw.alignment?.embed ?? {};
	out.alignment = structuredClone(base.alignment);
	out.alignment.embed = {
		lead: num(embed.lead, base.alignment.embed.lead),
		L: num(embed.L, base.alignment.embed.L),
		R: num(embed.R, base.alignment.embed.R),
		arcLen: num(embed.arcLen, base.alignment.embed.arcLen)
	};

	// alignment.transition
	const tr = raw.alignment?.transition ?? {};
	out.alignment.transition = {
		preset: str(tr.preset, base.alignment.transition.preset),
		w1: clamp01(num(tr.w1, base.alignment.transition.w1)),
		w2: clamp01(num(tr.w2, base.alignment.transition.w2)),
		plot: str(tr.plot, base.alignment.transition.plot)
	};
	out.alignment.transition.family = str(tr.family, "linear-clothoid");
	out.alignment.transition.m = num(tr.m, 1.0);
	out.alignment.transition.plot = str(tr.plot, base.alignment.transition.plot);

	// ui
	const ui = raw.ui ?? {};
	out.ui = {
		s_abs: (ui.s_abs == null ? null : num(ui.s_abs, null)),
		u: clamp01(num(ui.u, base.ui.u))
	};

	// If someone provided te_* legacy keys, accept them (optional)
	if (raw.te_w1 != null || raw.te_w2 != null || raw.te_plot != null || raw.te_preset != null) {
		out.alignment.transition.w1 = clamp01(num(raw.te_w1, out.alignment.transition.w1));
		out.alignment.transition.w2 = clamp01(num(raw.te_w2, out.alignment.transition.w2));
		out.alignment.transition.plot = str(raw.te_plot, out.alignment.transition.plot);
		out.alignment.transition.preset = str(raw.te_preset, out.alignment.transition.preset);
	}

	// ensure w1<=w2 (for sanity)
	if (out.alignment.transition.w2 < out.alignment.transition.w1) {
		const tmp = out.alignment.transition.w1;
		out.alignment.transition.w1 = out.alignment.transition.w2;
		out.alignment.transition.w2 = tmp;
	}

	// allow unknown fmt for now, but keep our normalized format
	void fmt;
	return out;
}

export async function loadProjectFromFile(file) {
	const text = await file.text();
	let raw;
	try {
		raw = JSON.parse(text);
	} catch (e) {
		throw new Error("Invalid JSON");
	}
	return normalizeProject(raw);
}

export function downloadProject(projectData, filenameBase = "ufAIM") {
	const name = (projectData?.meta?.name || "project").replace(/[^\w\-]+/g, "_");
	const filename = `${filenameBase}_${name}.project.json`;
	const json = JSON.stringify(projectData, null, 2);

	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();

	URL.revokeObjectURL(url);
}
