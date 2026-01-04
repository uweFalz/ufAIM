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

// app/io/fileDrop.js
export function installFileDrop({ onFiles, element = document.documentElement }) {
	function prevent(e) {
		e.preventDefault();
		e.stopPropagation();
	}

	element.addEventListener("dragenter", prevent);
	element.addEventListener("dragover", (e) => {
		prevent(e);
		// optional UX: show overlay
		element.classList.add("dragover");
	});

	element.addEventListener("dragleave", (e) => {
		prevent(e);
		element.classList.remove("dragover");
	});

	element.addEventListener("drop", async (e) => {
		prevent(e);
		element.classList.remove("dragover");

		const files = Array.from(e.dataTransfer?.files ?? []);
		if (!files.length) return;

		await onFiles(files);
	});

	return () => {
		// (optional) uninstall – not needed now
	};
}
