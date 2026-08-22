export function supportsDirectoryPicker(windowRef = globalThis.window) {
	return typeof windowRef?.showDirectoryPicker === "function";
}

export async function pickDirectoryFiles({ windowRef = globalThis.window } = {}) {
	if (!supportsDirectoryPicker(windowRef)) return Object.freeze([]);
	const root = await windowRef.showDirectoryPicker({ mode: "read" });
	const files = [];
	await collectDirectory(root, "", files, windowRef?.File ?? globalThis.File);
	return Object.freeze(files);
}

async function collectDirectory(directory, prefix, files, FileCtor) {
	const handles = [];
	for await (const handle of directory.values()) handles.push(handle);
	handles.sort((a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));
	for (const handle of handles) {
		const name = String(handle?.name ?? "").trim();
		if (!name) continue;
		const relativePath = prefix ? `${prefix}/${name}` : name;
		if (handle.kind === "directory") {
			await collectDirectory(handle, relativePath, files, FileCtor);
			continue;
		}
		if (handle.kind !== "file" || typeof handle.getFile !== "function") continue;
		const source = await handle.getFile();
		files.push(withRelativePath(source, relativePath, FileCtor));
	}
}

function withRelativePath(source, relativePath, FileCtor) {
	if (!source || source.name === relativePath || typeof FileCtor !== "function") return source;
	return new FileCtor([source], relativePath, {
		type: source.type,
		lastModified: source.lastModified,
	});
}
