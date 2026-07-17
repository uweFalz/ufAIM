// app/view/shell/buildWindowShell.js
//
// DOM shell only
//
// @baustelle [I18N_STRICT]
// No user-visible text literals should be introduced here.
// Use data-i18n attributes and let uiWiring/applyI18n fill texts.
//
// geo-first window shell
// - primary geo stage (#view3d)
// - compact toolbar
// - right-side cockpit sofa (dockable / collapsible)
// - floating panels for SPOT / Transition / Bands / Section / Status-Debug
//
// DOM only. No wiring here.

export function buildWindowShell() {
	const appRoot = document.getElementById("app-root");
	const overlayRoot = document.getElementById("overlay-root");
	const debugRoot = document.getElementById("debug-root");

	if (!appRoot) throw new Error("buildWindowShell: missing #app-root");

	appRoot.innerHTML = `
		<div class="uf-shell" id="ufShell">
			<div class="uf-toolbar">
				<input id="fileImport" type="file" multiple style="display:none" />

				<button id="btnImport" class="btn" data-i18n="btn_import"></button>

				<div class="uf-lang">
					<button
						id="btnLang"
						class="btn"
						data-i18n-title="lang_button"
						data-i18n-aria-label="lang_button"
						aria-haspopup="true"
						aria-expanded="false"
					>🌐</button>
					<div id="langMenu" class="uf-langMenu hidden"></div>
				</div>

				<button id="btnSpot" class="btn" data-i18n="btn_spot"></button>
				<button id="btnTrans" class="btn" data-i18n="btn_transition"></button>
				<button id="btnToggleBands" class="btn" data-i18n="btn_bands"></button>
				<button id="btnToggleSection" class="btn" data-i18n="btn_section"></button>
				<button id="btnToggleDebug" class="btn" data-i18n="btn_status_debug"></button>

				<button
					id="btnCockpit"
					class="btn btn--primary"
					data-i18n="panel_cockpit"
					data-i18n-title="panel_cockpit"
					data-i18n-aria-label="panel_cockpit"
				></button>

				<div class="uf-toolbar__spacer"></div>

				<div class="cursor">
					<button
						id="btnCursorMinus"
						class="btn btn--ghost"
						data-i18n-title="btn_cursor_minus_title"
						data-i18n-aria-label="btn_cursor_minus_title"
					>−</button>

					<input
						id="inputCursorS"
						type="number"
						step="1"
						value="0"
						data-i18n-placeholder="cursor_placeholder"
					/>

					<button
						id="btnCursorPlus"
						class="btn btn--ghost"
						data-i18n-title="btn_cursor_plus_title"
						data-i18n-aria-label="btn_cursor_plus_title"
					>+</button>
				</div>

				<!--select id="slotSelect" class="select" data-i18n-title="slot_select_title">
					<option value="right" data-i18n="slot_right"></option>
					<option value="km" data-i18n="slot_km"></option>
					<option value="left" data-i18n="slot_left"></option>
				</select-->

				<label class="hint" style="display:inline-flex; align-items:center; gap:6px;">
					<input id="chkAutoFit" type="checkbox" />
					<span data-i18n="label_autofit"></span>
				</label>

				<button id="btnFit" class="btn" data-i18n="btn_fit" data-i18n-title="btn_fit_title"></button>
				<!--button id="btnPinToggle" class="btn" data-i18n="btn_pin_toggle" data-i18n-title="btn_pin_toggle_title"></button-->
				<!--button id="btnPinsClear" class="btn" data-i18n="btn_pins_clear" data-i18n-title="btn_pins_clear_title"></button-->
				<!--span id="pinsInfo" class="hint" data-i18n="pins_info_empty"></span-->
			</div>

			<div class="uf-workspace">
				<div class="uf-stageWrap">
					<div class="uf-stage">
						<canvas id="view3d"></canvas>
					</div>
				</div>

				<aside id="cockpitPanel" class="uf-cockpitPanel">
					<header class="uf-cockpitPanel__header">
						<span data-i18n="panel_cockpit"></span>
						<button
							id="btnCockpitClose"
							class="btn btn--ghost"
							data-i18n-title="btn_close_title"
							data-i18n-aria-label="btn_close_title"
						>×</button>
					</header>
					<div id="cockpitPanelBody" class="uf-cockpitPanel__body"></div>
				</aside>
			</div>
		</div>
	`;

	if (overlayRoot) {
		overlayRoot.innerHTML = `
			<section id="spotOverlay" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span data-i18n="panel_spot"></span>
					<button
						id="btnSpotClose"
						class="btn btn--ghost"
						data-i18n-title="btn_close_title"
						data-i18n-aria-label="btn_close_title"
					>×</button>
				</header>
				<div class="uf-panel__body spotHost">
					<div id="spotOverlayBody"></div>
				</div>
			</section>

			<section id="transOverlay" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span data-i18n="panel_transition"></span>
					<button
						id="btnTransClose"
						class="btn btn--ghost"
						data-i18n-title="btn_close_title"
						data-i18n-aria-label="btn_close_title"
					>×</button>
				</header>
				<div class="uf-panel__body">
					<div class="uf-trans-controls">
						<div>
							<label class="hint" for="tePresetSelMain" data-i18n="label_preset"></label>
							<select id="tePresetSelMain" class="select"></select>
						</div>

						<div style="display:flex; flex-direction:column; gap:6px;">
							<label><input type="radio" name="tePlot" id="tePlotK" value="k" /> κ</label>
							<label><input type="radio" name="tePlot" id="tePlotK1" value="k1" /> κ′</label>
							<label><input type="radio" name="tePlot" id="tePlotK2" value="k2" /> κ″</label>
						</div>

						<div style="display:flex; flex-direction:column; gap:6px;">
							<label class="hint" for="teW1" data-i18n="label_te_w1"></label>
							<input type="range" id="teW1" min="0" max="1000" />
							<span id="teW1Val" class="hint">—</span>
						</div>

						<div style="display:flex; flex-direction:column; gap:6px;">
							<label class="hint" for="teW2" data-i18n="label_te_w2"></label>
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
					<span data-i18n="panel_bands"></span>
					<button
						id="btnCloseBands"
						class="btn btn--ghost"
						data-i18n-title="btn_close_title"
						data-i18n-aria-label="btn_close_title"
					>×</button>
				</header>
				<div id="board2d" class="uf-panel__body"></div>
			</section>

			<section id="overlaySection" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span data-i18n="panel_section"></span>
					<button
						id="btnCloseSection"
						class="btn btn--ghost"
						data-i18n-title="btn_close_title"
						data-i18n-aria-label="btn_close_title"
					>×</button>
				</header>
				<div id="boardSection" class="uf-panel__body"></div>
			</section>

			<section id="debugOverlay" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span data-i18n="panel_status_debug"></span>
					<button
						id="btnCloseDebug"
						class="btn btn--ghost"
						data-i18n-title="btn_close_title"
						data-i18n-aria-label="btn_close_title"
					>×</button>
				</header>
				<div class="uf-panel__body" style="display:flex; flex-direction:column; gap:10px;">
					<div class="hint">
						<span data-i18n="label_status"></span>
						<span id="status">…</span>
					</div>
					<pre id="log"></pre>
					<pre id="props"></pre>
				</div>
			</section>
		`;
	}

	if (debugRoot) {
		debugRoot.innerHTML = "";
	}
}
