import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	wireAlignmentProfileSynchronizedView,
} from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

const ROOT = new URL("../../../", import.meta.url);
const WIRING_URL = new URL(
	"app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js",
	ROOT
);
const INIT_URL = new URL("app/runtime/init/initFeatures.js", ROOT);

class FakeElement {
	constructor(ownerDocument, tagName) {
		this.ownerDocument = ownerDocument;
		this.tagName = tagName.toUpperCase();
		this.children = [];
		this.dataset = {};
		this.attributes = new Map();
		this.textContent = "";
	}

	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}

	append(...children) {
		this.children.push(...children);
	}

	replaceChildren(...children) {
		this.children = [...children];
	}

	querySelector(selector) {
		const dataName = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1];
		if (!dataName) return null;
		const datasetName = dataName.replace(
			/-([a-z])/g,
			(_, letter) => letter.toUpperCase()
		);
		return this.find((node) =>
			Object.prototype.hasOwnProperty.call(
				node.dataset,
				datasetName
			)
		);
	}

	find(predicate) {
		for (const child of this.children) {
			if (predicate(child)) return child;
			const nested = child.find?.(predicate);
			if (nested) return nested;
		}
		return null;
	}
}

class FakeDocument {
	constructor() {
		this.panel = new FakeElement(this, "aside");
		this.panel.id = "cockpitPanel";
	}

	getElementById(id) {
		return id === "cockpitPanel" ? this.panel : null;
	}

	createElement(tagName) {
		return new FakeElement(this, tagName);
	}
}

function makeStore() {
	let state = {
		workspace_selection: {
			primaryId: "alignment-1",
			elementId: "arc-1",
		},
		cursor: { s: 12 },
	};
	const subscribers = new Set();
	return {
		getState() {
			return state;
		},
		subscribe(callback) {
			subscribers.add(callback);
			return () => subscribers.delete(callback);
		},
		set(next) {
			state = next;
			for (const callback of subscribers) callback();
		},
	};
}

function projection({ s, revision = 7 } = {}) {
	return {
		status: "projected",
		alignmentId: "alignment-1",
		revision,
		cursor: {
			parameterKind: "intrinsic-s",
			s,
		},
		profileStatePresence: "present",
		vertical: {
			status: "absent",
			value: null,
		},
		chainage: {
			status: "ambiguous",
			candidates: [
				{ address: "12+000", status: "unknown" },
			],
		},
		cant: {
			status: "not-performed",
			value: null,
			reference: {
				workingReference: "midpoint-reference-trajectory",
				sourceReference: "unknown",
				transformation: "not-performed",
				pairedRails: "partial",
			},
		},
	};
}

class RecordingView {
	static instances = [];

	constructor({ host }) {
		this.host = host;
		this.renders = [];
		RecordingView.instances.push(this);
	}

	render(viewModel) {
		this.renders.push(viewModel);
		const pre = this.host.ownerDocument.createElement("pre");
		pre.textContent = JSON.stringify(viewModel);
		this.host.replaceChildren(pre);
		return pre;
	}
}

function canonicalSpotState() {
	return {
		objects: [
			{
				id: "alignment-1",
				type: "alignment",
				data: {
					alignmentData: {
						id: "alignment-1",
						revision: 7,
					},
				},
			},
		],
	};
}

test("visible region follows the shared active Alignment revision and cursor", async () => {
	RecordingView.instances.length = 0;
	const documentRef = new FakeDocument();
	const store = makeStore();
	const requests = [];
	const projectionController = {
		async projectAt(context) {
			requests.push(structuredClone(context));
			return projection({ s: context.s });
		},
	};
	const wiring = wireAlignmentProfileSynchronizedView({
		store,
		messaging: {
			async sendCmdAwait(command) {
				assert.equal(command, "Spot.GetState");
				return canonicalSpotState();
			},
		},
		projectionController,
		View: RecordingView,
		documentRef,
	});

	const first = await wiring.refresh();
	assert.deepEqual(requests.at(-1), {
		alignmentId: "alignment-1",
		revision: 7,
		s: 12,
	});
	assert.equal(first.cursor.s, 12);
	assert.equal(
		wiring.getRegion().attributes.get("aria-label"),
		"Profile Chainage Cant synchronized view"
	);
	assert.equal(
		wiring.getRegion().querySelector("[data-profile-sync-status]")
			.textContent,
		"present"
	);

	store.set({
		...store.getState(),
		cursor: { s: 22 },
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.deepEqual(requests.at(-1), {
		alignmentId: "alignment-1",
		revision: 7,
		s: 22,
	});
	assert.equal(
		RecordingView.instances[0].renders.at(-1).cursor.s,
		22
	);
	const context = JSON.parse(
		wiring.getRegion().querySelector("[data-profile-context]")
			.textContent
	);
	assert.deepEqual(context, {
		alignmentId: "alignment-1",
		revision: 7,
		s: 22,
	});
	wiring.stop();
});

test("projection statuses and cant reference evidence remain verbatim", async () => {
	RecordingView.instances.length = 0;
	const wiring = wireAlignmentProfileSynchronizedView({
		store: makeStore(),
		messaging: {
			async sendCmdAwait() {
				return canonicalSpotState();
			},
		},
		projectionController: {
			async projectAt({ s }) {
				return projection({ s });
			},
		},
		View: RecordingView,
		documentRef: new FakeDocument(),
	});

	const result = await wiring.refresh();
	assert.deepEqual(result.vertical, {
		status: "absent",
		value: null,
	});
	assert.deepEqual(result.chainage, {
		status: "ambiguous",
		candidates: [
			{ address: "12+000", status: "unknown" },
		],
	});
	assert.deepEqual(result.cant, {
		status: "not-performed",
		value: null,
		reference: {
			workingReference: "midpoint-reference-trajectory",
			sourceReference: "unknown",
			transformation: "not-performed",
			pairedRails: "partial",
		},
	});
	wiring.stop();
});

test("missing Alignment and projection mismatch remain visibly absent or error", async () => {
	const store = makeStore();
	const documentRef = new FakeDocument();
	const wiring = wireAlignmentProfileSynchronizedView({
		store,
		messaging: {
			async sendCmdAwait() {
				return { objects: [] };
			},
		},
		projectionController: {
			async projectAt() {
				throw new Error("must not reach projection");
			},
		},
		View: RecordingView,
		documentRef,
	});

	await wiring.refresh();
	const region = wiring.getRegion();
	assert.equal(
		region.querySelector("[data-profile-sync-status]").textContent,
		"error"
	);
	assert.match(
		region.querySelector("[data-profile-error]").textContent,
		/ACTIVE_ALIGNMENT_UNAVAILABLE/
	);

	store.set({
		workspace_selection: {
			primaryId: null,
			elementId: null,
		},
		cursor: { s: 0 },
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(
		region.querySelector("[data-profile-sync-status]").textContent,
		"absent"
	);
	assert.equal(
		region.querySelector("[data-profile-content]").children.length,
		0
	);
	wiring.stop();
});

test("wiring is read-only and runtime uses the productive repository composition", async () => {
	const [wiringSource, initSource] = await Promise.all([
		readFile(WIRING_URL, "utf8"),
		readFile(INIT_URL, "utf8"),
	]);

	assert.match(wiringSource, /Spot\.GetState/);
	assert.match(wiringSource, /state\?\.cursor\?\.s/);
	assert.match(wiringSource, /workspace_selection\?\.primaryId/);
	assert.doesNotMatch(
		wiringSource,
		/saveProfileState|saveById|Spot\.AddObjects|Spot\.RemoveObject|updateArc|applyWorkingCopy|geometry/,
	);

	assert.match(initSource, /new AlignmentApplicationService\(/);
	assert.match(initSource, /alignmentApplicationService\.alignmentRepository/);
	assert.match(initSource, /new AlignmentProfileApplicationService\(/);
	assert.match(initSource, /createAlignmentProfileProjectionController\(/);
	assert.match(initSource, /View: AlignmentProfileSynchronizedView/);
});
