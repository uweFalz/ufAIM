// app/io/fileDrop.js

import { importProject } from "./projectIO.js";

export function attachFileDrop(targetEl, onProject, onLog) {
	const log = (s) => onLog && onLog(s);

	targetEl.addEventListener("dragover", (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	});

	targetEl.addEventListener("drop", async (e) => {
		e.preventDefault();
		const file = e.dataTransfer.files?.[0];
		if (!file) return;

		log(`drop: ${file.name} (${Math.round(file.size/1024)} KB)`);

		if (!file.name.endsWith(".json") && !file.name.endsWith(".ufaim.json")) {
			log("drop: ignored (not a .json/.ufaim.json)");
			return;
		}

		const text = await file.text();
		try {
			const project = importProject(text);
			onProject(project);
			log("import: ok ✅");
		} catch (err) {
			log("import: failed ❌ " + String(err));
		}
	});
}
