export class AppCore {
	constructor({ statusEl, stageEl }) {
		this.statusEl = statusEl;
		this.stageEl = stageEl;
	}

	start() {
		this.setStatus("ready");
		// später: libLoader → mapLibre/three → Workspace/Views → DropZone
	}

	setStatus(msg) {
		if (this.statusEl) this.statusEl.textContent = msg;
	}
}
