// app/io/input/fileDrop.js

//
// ...
//
export const FILE_DROP_LIFECYCLE_EVENT = "ufaim:file-drop-lifecycle";

function readEntryFile(entry) {
	return new Promise((resolve, reject) => entry.file((file) => {
		const path = String(entry.fullPath ?? file?.name ?? "").replace(/^\/+/, "");
		if (!path || path === file?.name || typeof File !== "function") {
			resolve(file);
			return;
		}
		resolve(new File([file], path, {
			type: file.type,
			lastModified: file.lastModified,
		}));
	}, reject));
}

function readDirectoryBatch(reader) {
	return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function collectDroppedEntry(entry, files) {
	if (entry?.isFile) {
		files.push(await readEntryFile(entry));
		return;
	}
	if (!entry?.isDirectory || typeof entry.createReader !== "function") return;
	const reader = entry.createReader();
	while (true) {
		const entries = await readDirectoryBatch(reader);
		if (!entries.length) break;
		for (const child of entries) await collectDroppedEntry(child, files);
	}
}

export async function collectDroppedFiles(dataTransfer) {
	const items = Array.from(dataTransfer?.items ?? []);
	const entries = items
		.map((item) => item?.webkitGetAsEntry?.())
		.filter(Boolean);
	if (!entries.length) return Array.from(dataTransfer?.files ?? []);
	const files = [];
	for (const entry of entries) await collectDroppedEntry(entry, files);
	return files;
}

export function installFileDrop({
	element = document.documentElement,
	onFiles,
	onLifecycle,
} = {}) {
	if (!element) throw new Error("installFileDrop: missing element");
	if (typeof onFiles !== "function") throw new Error("installFileDrop: onFiles must be a function");

	let disposed = false;
	let dragDepth = 0;

	function stop(event) {
		event.preventDefault();
		event.stopPropagation();
	}

	function publish(state, {
		code = null,
		fileCount = 0,
		fileNames = [],
		message = null,
		outcome = null,
	} = {}) {
		if (disposed) return;
		const detail = Object.freeze({
			state,
			code,
			fileCount,
			fileNames: Object.freeze([...fileNames]),
			message,
			outcome,
		});
		onLifecycle?.(detail);
		if (
			typeof element.dispatchEvent === "function" &&
			typeof CustomEvent === "function"
		) {
			element.dispatchEvent(new CustomEvent(FILE_DROP_LIFECYCLE_EVENT, {
				detail,
			}));
		}
	}

	function onDragEnter(event) {
		stop(event);
		dragDepth += 1;
		publish("drag-active");
	}

	function onDragOver(event) {
		stop(event);
		if (dragDepth === 0) dragDepth = 1;
		publish("drag-active");
	}

	function onDragLeave(event) {
		stop(event);
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) publish("idle");
	}

	async function onDrop(event) {
		stop(event);
		dragDepth = 0;
		const immediateFiles = Array.from(event.dataTransfer?.files ?? []);
		publish("accepted", {
			fileCount: immediateFiles.length,
			fileNames: immediateFiles.map((file) => String(file?.name ?? "")).filter(Boolean),
			message: "Drop angenommen; Dateien werden gesammelt.",
		});
		let files;
		try {
			files = await collectDroppedFiles(event.dataTransfer);
		} catch (error) {
			publish("failed", {
				code: "FILE_DROP_COLLECTION_FAILED",
				message: String(error?.message ?? error),
			});
			return;
		}
		if (files.length === 0) {
			publish("rejected", {
				code: "FILE_DROP_NO_FILES",
				message: "No files were supplied by the drop operation.",
			});
			return;
		}

		publish("processing", {
			fileCount: files.length,
			fileNames: files.map((file) => String(file?.name ?? "")).filter(Boolean),
		});
		try {
			const outcome = await onFiles(files);
			publish("completed", {
				fileCount: files.length,
				fileNames: files.map((file) => String(file?.name ?? "")).filter(Boolean),
				outcome,
			});
		} catch (error) {
			publish("failed", {
				code: "FILE_DROP_IMPORT_FAILED",
				fileCount: files.length,
				fileNames: files.map((file) => String(file?.name ?? "")).filter(Boolean),
				message: String(error?.message ?? error),
			});
		}
	}

	const listenerOptions = { capture: true };
	element.addEventListener("dragenter", onDragEnter, listenerOptions);
	element.addEventListener("dragover", onDragOver, listenerOptions);
	element.addEventListener("dragleave", onDragLeave, listenerOptions);
	element.addEventListener("drop", onDrop, listenerOptions);
	publish("idle");

	return function disposeFileDrop() {
		if (disposed) return;
		element.removeEventListener("dragenter", onDragEnter, listenerOptions);
		element.removeEventListener("dragover", onDragOver, listenerOptions);
		element.removeEventListener("dragleave", onDragLeave, listenerOptions);
		element.removeEventListener("drop", onDrop, listenerOptions);
		dragDepth = 0;
		disposed = true;
	};
}
