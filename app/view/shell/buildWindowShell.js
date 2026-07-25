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
				<button id="btnGndImportWorkbench" class="btn" data-i18n="gnd_workbench.entry"></button>

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
				<button id="btnAlignmentEditor" class="btn" data-i18n="btn_alignment_editor"></button>
				<button id="btnToggleBands" class="btn hidden" data-i18n="btn_bands"></button>
				<button id="btnToggleSection" class="btn hidden" data-i18n="btn_section"></button>
				<button id="btnToggleDebug" class="btn hidden" data-i18n="btn_status_debug"></button>

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

				<div id="geoModeBadge" class="uf-geoModeBadge" aria-live="polite">LOCAL</div>
				<!--button id="btnPinToggle" class="btn" data-i18n="btn_pin_toggle" data-i18n-title="btn_pin_toggle_title"></button-->
				<!--button id="btnPinsClear" class="btn" data-i18n="btn_pins_clear" data-i18n-title="btn_pins_clear_title"></button-->
				<!--span id="pinsInfo" class="hint" data-i18n="pins_info_empty"></span-->
			</div>

			<div class="uf-workspace">
				<div class="uf-stageWrap" id="geoStage">
					<div id="viewMap" class="uf-geoMap"></div>
					<div class="uf-stage">
						<canvas id="view3d"></canvas>
					</div>
					<section id="curvatureBand" class="uf-curvatureBand" aria-label="Curvature band">
						<header class="uf-curvatureBand__header">
							<div class="uf-curvatureBand__identity"><span>κ(s)</span><span id="curvatureBandContext" class="hint"></span></div>
							<output id="curvatureBandValue"></output>
							<div class="uf-curvatureBand__tools">
								<button id="btnCurvatureBandDock" type="button" class="btn btn--ghost" data-i18n-title="curvature_band.dock" data-i18n-aria-label="curvature_band.dock">↕</button>
								<button id="btnCurvatureBandCompact" type="button" class="btn btn--ghost" data-i18n-title="curvature_band.compact" data-i18n-aria-label="curvature_band.compact">−</button>
								<button id="btnCurvatureBandCollapse" type="button" class="btn btn--ghost" data-i18n-title="curvature_band.collapse" data-i18n-aria-label="curvature_band.collapse">⌄</button>
							</div>
						</header>
						<svg id="curvatureBandSvg" role="application" aria-label="Editable signed curvature by station"></svg>
						<div id="curvatureBandResize" class="uf-curvatureBand__resize" role="separator" aria-orientation="horizontal" tabindex="0" data-i18n-aria-label="curvature_band.resize"></div>
					</section>
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
			<section id="gndImportWorkbenchOverlay" class="uf-panel uf-gnd-workbench hidden" aria-labelledby="gndWorkbenchTitle">
				<header class="uf-panel__header">
					<span id="gndWorkbenchTitle" data-i18n="gnd_workbench.title"></span>
					<button id="btnGndImportWorkbenchClose" class="btn btn--ghost" data-i18n-title="btn_close_title" data-i18n-aria-label="btn_close_title">×</button>
				</header>
				<div id="gndImportWorkbenchBody" class="uf-panel__body"></div>
			</section>

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
				<div class="uf-panel__body te-workspace" data-te-workspace>
					<main class="te-main">
						<header class="te-summary"><div><p id="teRecordKind" class="hint"></p><h2 id="teRecordTitle"></h2><p id="teRecordStatus" class="hint"></p></div><div class="te-primary-controls"><select id="tePresetSelMain" class="select" aria-label="Preset"></select><div class="te-plot-modes"><label><input type="radio" name="tePlot" id="tePlotK" value="k" /> κ</label><label><input type="radio" name="tePlot" id="tePlotK1" value="k1" /> κ′</label><label><input type="radio" name="tePlot" id="tePlotK2" value="k2" /> κ″</label></div></div></header>
						<section class="te-preview"><div id="transBoard" class="jxgbox"></div><section class="te-splits" aria-label="Transition boundaries"><label for="teW1"><span data-i18n="label_te_w1"></span><output id="teW1Val">—</output></label><input type="range" id="teW1" min="0" max="1000" /><label for="teW2"><span data-i18n="label_te_w2"></span><output id="teW2Val">—</output></label><input type="range" id="teW2" min="0" max="1000" /></section><div id="teLegend" class="hint"></div></section>
						<details class="te-depth"><summary data-i18n="transed.depth.catalogue"></summary><nav class="te-catalogue" aria-label="transitionDB"><div id="teBreadcrumb" class="te-breadcrumb"></div><div id="teLevels" class="te-levels"></div><div id="teRecordList" class="te-record-list"></div></nav></details>
						<details class="te-depth"><summary data-i18n="transed.depth.details"></summary><section id="teDetails" class="te-details"></section></details>
						<details class="te-depth"><summary data-i18n="transed.depth.edit"></summary><section id="teTransitionControls" class="uf-trans-controls">
							<div class="te-partition"><label for="tePart1" data-i18n="transed.partition.in"></label><input id="tePart1" class="input" type="number" min="0" max="1" step="0.001" /><label for="tePartCore" data-i18n="transed.partition.core"></label><input id="tePartCore" class="input" type="number" min="0" max="1" step="0.001" /><label for="tePart2" data-i18n="transed.partition.out"></label><input id="tePart2" class="input" type="number" min="0" max="1" step="0.001" /></div>
							<select id="tePresetSelAlt" class="select hidden"></select>
							<div class="te-actions"><button id="teApply" class="btn" data-i18n="transed.apply"></button><button id="teReset" class="btn btn--ghost" data-i18n="transed.reset"></button><output id="teEditStatus" class="hint"></output></div>
						</section></details>
						<details class="te-depth"><summary data-i18n="transed.compare"></summary><section class="te-compare"><header><select id="teComparePreset" class="select"></select></header><div id="teCompareSummary"></div><svg id="teCompareGraph" viewBox="0 0 600 180" role="img"></svg></section></details>
					</main>
				</div>
			</section>

			<section id="alignmentEditorOverlay" class="uf-panel hidden">
				<header class="uf-panel__header">
					<span data-i18n="alignment_editor.title"></span>
					<button id="btnAlignmentEditorClose" class="btn btn--ghost" data-i18n-title="btn_close_title" data-i18n-aria-label="btn_close_title">×</button>
				</header>
				<div class="uf-panel__body">
					<section class="uf-align-edit">
						<div id="aeTitle" class="uf-align-edit__head" data-i18n="alignment_editor.title"></div>
						<div class="uf-align-edit__grid">
							<label id="aeElementSelLabel" for="aeElementSel" data-i18n="alignment_editor.label.element"></label><select id="aeElementSel" class="select"></select>
							<label id="aeElementTypeLabel" for="aeElementType" data-i18n="alignment_editor.label.type"></label><input id="aeElementType" class="input" type="text" readonly />
							<label id="aeLengthLabel" for="aeLength" data-i18n="alignment_editor.label.length_m"></label><input id="aeLength" class="input" type="number" step="0.001" />
							<label id="aeCurvatureLabel" for="aeCurvature" data-i18n="alignment_editor.label.curvature_inv_m"></label><input id="aeCurvature" class="input" type="number" step="0.000001" />
							<label id="aeRadiusLabel" for="aeRadius" data-i18n="alignment_editor.label.radius_m"></label><input id="aeRadius" class="input" type="number" step="0.001" />
							<label id="aeTransitionTypeLabel" for="aeTransitionType" data-i18n="alignment_editor.label.transition_family"></label><select id="aeTransitionType" class="select"></select>
							<label id="aeW1Label" for="aeW1" data-i18n="alignment_editor.label.w1"></label><input id="aeW1" class="input" type="number" min="0" max="1" step="0.001" />
							<label id="aeW2Label" for="aeW2" data-i18n="alignment_editor.label.w2"></label><input id="aeW2" class="input" type="number" min="0" max="1" step="0.001" />
						</div>
						<div id="aeSignedContext" class="uf-align-edit__hint"></div>
						<div id="aeConsequence" class="uf-align-edit__consequence" aria-live="polite"></div>
						<div class="uf-align-edit__actions"><button id="aeApply" type="button" class="btn btn--primary" data-i18n="alignment_editor.action.apply"></button><button id="aeUndo" type="button" class="btn btn--ghost" data-i18n="alignment_editor.action.undo"></button><button id="aeReset" type="button" class="btn btn--ghost" data-i18n="alignment_editor.action.reset"></button></div>
						<div id="aeStatus" class="uf-align-edit__status" data-kind="info"></div>
						<details class="uf-align-edit__technical">
							<summary data-i18n="alignment_editor.technical"></summary>
							<dl id="aeTechnicalDetails"></dl>
						</details>
					</section>
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
