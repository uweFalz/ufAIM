// Preserve a dataset-relative name without constructing a synthetic Blob.
// Safari may turn `new File([sourceFile], relativePath)` into a blob: URL whose
// security grant no longer survives until a later serial import reads it.
export function withRelativePathFile(source, relativePath) {
	if (!source) return source;
	const name = String(relativePath ?? source.name ?? "").replace(/^\/+/, "");
	if (!name || name === source.name) return source;
	const call = (method, ...args) => {
		if (typeof source?.[method] !== "function") {
			throw new TypeError(`Source file does not support ${method}()`);
		}
		return source[method](...args);
	};
	return Object.freeze({
		name,
		size: Number(source.size ?? 0),
		type: String(source.type ?? ""),
		lastModified: Number(source.lastModified ?? 0),
		webkitRelativePath: name,
		arrayBuffer: () => call("arrayBuffer"),
		text: () => call("text"),
		stream: () => call("stream"),
		slice: (...args) => call("slice", ...args),
		[Symbol.toStringTag]: "File",
	});
}

export default withRelativePathFile;
