// app/view/shell/buildWindowShell.js
//
// geo-first window shell
// - primary geo stage (#view3d)
// - compact toolbar
// - floating panels for SPOT / Transition / Bands / Section
// - debug panes for status / log / props
//
// DOM only. No wiring here.

export function buildWindowShell() {
	const appRoot = document.getElementById("app-root");
	const overlayRoot = document.getElementById("overlay-root");
	const debugRoot = document.getElementById("debug-root");

	if (!appRoot) throw new Error("buildWindowShell: missing #app-root");

	appRoot.innerHTML = `
		<div class="uf-shell">
			<div class="uf-toolbar">
				<input id="fileImport" type="file" multiple style="display:none" />

				<button id="btnImport" class="btn">Import</button>
				<button id="btnSpot" class="btn">SPOT</button>
				<button id="btnTrans" class="btn">Transition</button>
				<button id="btnToggleBands" class="btn">Bands</button>
				<button id="btnToggleSection" class="btn">Section</button>

				<div class="uf-toolbar__spacer"></div>

				<div class="cursor">
					<button id="btnCursorMinus" class="btn btn--ghost" title="s minus">−</button>
					<input id="inputCursorS" type="number" step="1" value="0" />
					<button id="btnCursorPlus" class="btn btn--ghost" title="s plus">+</button>
				</div>

				<select id="slotSelect" class="select" title="active slot">
					<option value="right">right</option>
					<option value="km">km</option>
					<option value="left">left</option>
				</select>

				<label class="hint" style="display:inline-flex; align-items:center; gap:6px;">
					<input id="chkAutoFit" type="checkbox" />
					<span>AutoFit</span>
				</label>

				<button id="btnFit" class="btn" title="fit active">Fit</button>
				<button id="btnPinToggle" class="btn" title="pin/unpin active">Pin</button>
				<button id="btnPinsClear" class="btn" title="clear all pins">Clear</button>
				<span id="pinsInfo" class="hint">Pins: 0</span>
			</div>

			<div class="uf-stage">
				<canvas id="view3d"></canvas>
			</div>
		</div>
	`;

	if (overlayRoot) {
		overlayRoot.innerHTML = `
			<section id="spotOverlay" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span>SPOT</span>
					<button id="btnSpotClose" class="btn btn--ghost" title="close">×</button>
				</header>
				<div class="uf-panel__body spotHost">
					<div id="spotOverlayBody"></div>
				</div>
			</section>

			<section id="transOverlay" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span>Transition Editor</span>
					<button id="btnTransClose" class="btn btn--ghost" title="close">×</button>
				</header>
				<div class="uf-panel__body">
					<div class="uf-trans-controls">
						<div>
							<label class="hint" for="tePresetSelMain">Preset</label>
							<select id="tePresetSelMain" class="select"></select>
						</div>

						<div style="display:flex; flex-direction:column; gap:6px;">
							<label><input type="radio" name="tePlot" id="tePlotK" value="k" /> κ</label>
							<label><input type="radio" name="tePlot" id="tePlotK1" value="k1" /> κ′</label>
							<label><input type="radio" name="tePlot" id="tePlotK2" value="k2" /> κ″</label>
						</div>

						<div style="display:flex; flex-direction:column; gap:6px;">
							<label class="hint" for="teW1">w1</label>
							<input type="range" id="teW1" min="0" max="1000" />
							<span id="teW1Val" class="hint">—</span>
						</div>

						<div style="display:flex; flex-direction:column; gap:6px;">
							<label class="hint" for="teW2">w2</label>
							<input type="range" id="teW2" min="0" max="1000" />
							<span id="teW2Val" class="hint">—</span>
						</div>

						<select id="tePresetSelAlt" class="select hidden"></select>
					</div>

					<div>
						<div id="transBoard" class="jxgbox"></div>
					</div>
				</div>
			</section>

			<section id="overlayBands" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span>Bands</span>
					<button id="btnCloseBands" class="btn btn--ghost" title="close">×</button>
				</header>
				<div id="board2d" class="uf-panel__body"></div>
			</section>

			<section id="overlaySection" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span>Section</span>
					<button id="btnCloseSection" class="btn btn--ghost" title="close">×</button>
				</header>
				<div id="boardSection" class="uf-panel__body"></div>
			</section>

			<div id="importSession" class="hidden"></div>
		`;
	}

	if (debugRoot) {
		debugRoot.innerHTML = `
			<div class="uf-debug">
				<section class="uf-debug__pane">
					<div class="hint">Status: <span id="status">…</span></div>
					<pre id="log"></pre>
				</section>

				<section class="uf-debug__pane">
					<pre id="props"></pre>
				</section>
			</div>
		`;
	}
}
