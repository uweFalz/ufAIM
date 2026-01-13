const LOCAL_KEY = "ufAIM.project";

export function loadProjectLocal() {
	try {
		const raw = localStorage.getItem(LOCAL_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function saveProjectLocal(projectObject) {
	try {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(projectObject));
	} catch {
		// ignore
	}
}

export function exportProjectFile(projectObject, filename = "project.json") {
	const blob = new Blob([JSON.stringify(projectObject, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();

	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importProject(text) {
	return JSON.parse(text);
}
