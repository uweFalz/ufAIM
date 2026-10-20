import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";
import { createRequire } from "node:module";

// alignmentOS as a package: src/ is self-contained (no alias, no import
// from app/, test/ or tools/), the manifest's exports resolve to files that
// load, and the package can be addressed by its own name from inside.

const ROOT = new URL("../../", import.meta.url).pathname;

async function walk(dir, out = []) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) { if (entry.name !== "node_modules" && entry.name !== "vendor") await walk(path, out); }
		else if (/\.js$/.test(entry.name)) out.push(path);
	}
	return out;
}

function specifiersOf(text) {
	const out = [];
	for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g)) out.push(m[1]);
	for (const m of text.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
	return out;
}

test("src/ imports only itself, relatively: no alias, nothing from app/, test/ or tools/", async () => {
	const files = await walk(join(ROOT, "src"));
	assert.ok(files.length > 200, `${files.length} files under src`);
	// a bare specifier is allowed only when it is a declared third-party
	// package: the browser's external import map, or the manifest's
	// dependencies (the GND import's mdb-reader, xlsx and its build shims)
	const external = JSON.parse(await readFile(join(ROOT, "config/importmap.external.json"), "utf8")).imports;
	const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
	const declared = new Set([...Object.keys(external), ...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.optionalDependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]);
	const isDeclared = (spec) => [...declared].some((name) => spec === name || spec.startsWith(name + "/"));
	const offences = [];
	for (const file of files) {
		const text = await readFile(file, "utf8");
		for (const spec of specifiersOf(text)) {
			if (spec.startsWith("node:")) continue;
			if (spec.startsWith("@")) { offences.push(`${relative(ROOT, file)}: alias ${spec}`); continue; }
			if (!spec.startsWith(".")) { if (!isDeclared(spec)) offences.push(`${relative(ROOT, file)}: bare ${spec}`); continue; }
			const target = resolve(dirname(file), spec);
			if (!target.startsWith(join(ROOT, "src"))) offences.push(`${relative(ROOT, file)}: leaves src: ${spec}`);
		}
	}
	assert.deepEqual(offences, []);
});

test("every export of the manifest resolves to a file that loads", async () => {
	const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
	assert.equal(pkg.name, "alignment-os");
	assert.equal(pkg.type, "module");
	for (const [subpath, target] of Object.entries(pkg.exports)) {
		if (subpath.includes("*")) {
			const dir = join(ROOT, target.replace(/\*$/, ""));
			assert.ok((await stat(dir)).isDirectory(), `${subpath} -> ${target} is a folder`);
			continue;
		}
		const file = join(ROOT, target);
		assert.ok((await stat(file)).isFile(), `${subpath} -> ${target} exists`);
		const module = await import(file);
		assert.ok(Object.keys(module).length > 0, `${subpath} exports something`);
	}
});

test("the package addresses itself by name: alignment-os/axtran2 and alignment-os/aim-core", async () => {
	const require = createRequire(join(ROOT, "package.json"));
	const axtran2 = await import(require.resolve("alignment-os/axtran2"));
	assert.equal(typeof axtran2.solveAlignmentProblem, "function");
	assert.equal(typeof axtran2.turnout, "function");
	const core = await import(require.resolve("alignment-os/aim-core"));
	assert.ok(Object.keys(core).length > 100, "the kernel barrel");
	const reader = await import(require.resolve("alignment-os/vermEsn/traAlignment"));
	assert.equal(typeof reader.traAlignmentFromBytes, "function");
});

test("the app still reaches src through its import map, and the map covers every alias the app uses", async () => {
	const map = JSON.parse(await readFile(join(ROOT, "config/importmap.internal.json"), "utf8")).imports;
	const files = await walk(join(ROOT, "app"));
	const used = new Set();
	for (const file of files) for (const spec of specifiersOf(await readFile(file, "utf8"))) {
		const m = spec.match(/^(@[a-z]+\/)/); if (m) used.add(m[1]);
	}
	for (const alias of used) assert.ok(map[alias], `import map resolves ${alias}`);
});
