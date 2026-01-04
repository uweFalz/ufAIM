// app/io/importApply.js
export function applyImportToProject({ project, store, imp, ui }) {
	// Keep an import log in the project
	project.imports = project.imports ?? [];
	project.imports.push({
		ts: new Date().toISOString(),
		kind: imp.kind,
		name: imp.name,
		meta: imp.meta ?? {}
	});

	// For now: if TRA delivered a polyline, we use it as a "demo alignment source"
	// by writing it to store so appCore can display it (optional).
	if (imp.kind === "TRA" && imp.geometry?.type === "polyline") {
		store.setState({
			import_last: { kind: "TRA", name: imp.name, points: imp.geometry.pts.length },
			import_polyline: imp.geometry.pts
		});
		ui?.log?.(`import: TRA polyline (${imp.geometry.pts.length} pts) ✅`);
		return;
	}

	store.setState({
		import_last: { kind: imp.kind, name: imp.name }
	});

	ui?.log?.(`import: ${imp.kind} (${imp.name}) ✅`);
}
