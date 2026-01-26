// app/io/modelAdapter.js
// Bridge between ProjectModel (persistent) and store (live UI state)

export function applyModelToStore(model, store) {
	const p = model.get();

	const embed = p.alignment?.embed ?? {};
	const tr = p.alignment?.transition ?? {};
	const ui = p.ui ?? {};

	store.setState({
		// viewer/editor positions
		s_abs: ui.s_abs ?? null,
		u: ui.u ?? 0.25,

		// embed demo
		lead: embed.lead ?? 60,
		arcLen: embed.arcLen ?? 220,
		L: embed.L ?? 120,
		R: embed.R ?? 800,

		// transition editor
		te_preset: tr.preset ?? "clothoid",
		te_w1: tr.w1 ?? 0.0,
		te_w2: tr.w2 ?? 1.0,
		te_plot: tr.plot ?? "k",
		te_family: tr.family ?? "linear-clothoid",
		te_m: tr.m ?? 1.0,
		te_plot: tr.plot ?? "k"
	});
}

export function readStoreToModel(store, model) {
	const st = store.getState();
	const p = model.get();

	const next = structuredClone(p);

	next.alignment.embed = {
		lead: st.lead,
		arcLen: st.arcLen,
		L: st.L,
		R: st.R
	};

	next.alignment.transition = {
		family: st.te_family,
		preset: st.te_preset,
		w1: st.te_w1,
		w2: st.te_w2,
		m: st.te_m ?? 1.0,
		plot: st.te_plot ?? "k"
	};

	next.ui = {
		s_abs: st.s_abs ?? null,
		u: st.u ?? 0.25
	};

	model.set(next);
}
