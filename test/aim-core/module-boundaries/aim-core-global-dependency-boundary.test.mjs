import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const CORE = new URL("../../../src/aim-core/", import.meta.url);
const ROOT = fileURLToPath(CORE);

async function collectJavaScript(directory) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
		if (entry.isDirectory()) {
			files.push(...await collectJavaScript(url));
		} else if (entry.name.endsWith(".js")) {
			files.push(url);
		}
	}
	return files.sort((left, right) => left.href.localeCompare(right.href));
}

function staticSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("every AIM Core static dependency is relative resolved and inside Core", async () => {
	const files = await collectJavaScript(CORE);
	assert.equal(files.length >= 58, true);
	for (const file of files) {
		const source = await readFile(file, "utf8");
		assert.doesNotMatch(source, /\bimport\s*\(/, `${file}: dynamic import`);
		for (const specifier of staticSpecifiers(source)) {
			assert.match(specifier, /^\.\.?\//, `${file}: ${specifier}`);
			assert.doesNotMatch(specifier, /\.json(?:$|[?#])/, `${file}: JSON`);
			assert.doesNotMatch(specifier, /^(?:node:|https?:|file:)/, `${file}: URL`);
			const resolved = new URL(specifier, file);
			assert.equal(
				fileURLToPath(resolved).startsWith(ROOT),
				true,
				`${file} escapes Core: ${specifier}`
			);
			await access(resolved);
		}
	}
});

test("all AIM Core modules import in Node without browser globals", async () => {
	const files = await collectJavaScript(CORE);
	for (const file of files) {
		await import(`${file.href}?global-boundary=${Date.now()}`);
	}
});

test("all area barrels and Root import without collisions or browser setup", async () => {
	for (const path of [
		"alignment/profile/index.js",
		"alignment/topology/index.js",
		"alignment/authoring/index.js",
		"alignment/aggregate/index.js",
		"transition/index.js",
		"geometry/index.js",
		"index.js",
	]) {
		const module = await import(new URL(path, CORE));
		assert.equal(Object.keys(module).length > 0, true, path);
	}
});
