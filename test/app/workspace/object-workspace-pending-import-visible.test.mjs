import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) { for (const [prefix, target] of Object.entries({ "@app/": "app/", "@src/": "src/", "@utils/": "src/lib/utils/" })) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });

globalThis.document = { getElementById: () => null, createElement: () => ({}), head: { append() {} } };
const { renderSpotHtml } = await import("../../../app/view/overlays/spotView.js");
const { createObjectWorkspaceHydrator } = await import("../../../app/ui/uiWiring.js");

test("empty object workspace points to completed import candidates instead of claiming they vanished", () => {
	const html = renderSpotHtml({
		spotState: { rows: [], importActivity: { state: "completed", fileCount: 81, objectCount: 163 } },
		storeState: {},
		capabilities: { create: true, import: true, reviewImport: true },
	});
	assert.match(html, /data-spot-pending-import="163"/);
	assert.match(html, /163 Importkandidaten warten auf Prüfung/);
	assert.match(html, /Die Daten sind nicht weg/);
	assert.match(html, /data-spot-review-import/);
	assert.match(html, /Import-Status öffnen/);
});

test("one pending import candidate is labelled in the singular", () => {
	const html = renderSpotHtml({
		spotState: { rows: [], importActivity: { state: "completed", fileCount: 1, objectCount: 1 } },
		storeState: {},
		capabilities: { reviewImport: true },
	});
	assert.match(html, /1 Importkandidat wartet auf Prüfung/);
});

test("object hydration preserves the latest import activity beside canonical Spot state", async () => {
	let rendered = null;
	const ui = {
		elements: { overlaySpot: { classList: { contains: () => false } } },
		showSpotLoading() {},
		setSpotState(value) { rendered = value; },
		getSpotState() { return rendered; },
		refreshSpot() {},
	};
	const hydrator = createObjectWorkspaceHydrator({
		ui,
		messaging: { sendCmdAwait: async () => ({ rows: [] }) },
		store: { getState: () => ({}) },
	});
	hydrator.setImportActivity({ state: "completed", fileCount: 81, objectCount: 163 });
	await hydrator.refreshCanonicalUiState({ requireVisible: false });
	assert.deepEqual(rendered, { rows: [], importActivity: { state: "completed", fileCount: 81, objectCount: 163 } });
});

test("object hydration derives pending candidates from the durable Import master after lifecycle reset", async () => {
	let rendered = null;
	const ui = {
		elements: { overlaySpot: { classList: { contains: () => false } } },
		showSpotLoading() {},
		setSpotState(value) { rendered = value; },
		refreshSpot() {},
	};
	const items = Array.from({ length: 163 }, (_, index) => ({
		id: `I${index}`,
		source: { fileName: `source-${index % 81}.tra` },
		status: { accepted: index === 0 },
	}));
	const hydrator = createObjectWorkspaceHydrator({
		ui,
		messaging: { sendCmdAwait: async () => ({ rows: [] }) },
		readImportState: async () => ({ items }),
		store: { getState: () => ({}) },
	});
	hydrator.setImportActivity(null);
	await hydrator.refreshCanonicalUiState({ requireVisible: false });
	assert.equal(rendered.importActivity.state, "completed");
	assert.equal(rendered.importActivity.objectCount, 162);
	assert.equal(rendered.importActivity.fileCount, 81);
});
