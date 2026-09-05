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
		<div class="uf-shell is-intelligence-collapsed is-cockpit-collapsed" id="ufShell">
			<div class="uf-toolbar">
				<div class="uf-workspaceModes" role="group" aria-label="alignmentOS workspace views">
					<strong class="uf-workspaceModes__brand">alignmentOS</strong>
					<button type="button" class="btn btn--ghost" data-workspace-view-mode="main" aria-pressed="true">Main</button>
					<button type="button" class="btn btn--ghost" data-workspace-view-mode="q" aria-pressed="false">q · Lok</button>
					<button type="button" class="btn btn--ghost" data-workspace-view-mode="l" aria-pressed="false">L · Bänder</button>
					<output class="uf-workspaceModes__status" data-workspace-view-status="ready" aria-live="polite">World / Map</output>
				</div>
				<input id="fileImport" type="file" multiple style="display:none" />

				<div class="uf-toolbarGroup uf-toolbarGroup--global">
					<button id="btnImport" class="btn" data-i18n="btn_import"></button>
					<button id="btnGndImportWorkbench" class="btn" data-i18n="gnd_workbench.entry"></button>
					<button id="btnSpot" class="btn" data-i18n="btn_spot"></button>
					<button id="btnTrans" class="btn" data-i18n="btn_transition"></button>
					<button id="btnCommandPalette" class="btn btn--ghost" type="button" aria-haspopup="dialog" aria-expanded="false">Befehle</button>
				</div>

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

				<div class="uf-toolbarGroup uf-toolbarGroup--context">
					<button id="btnAlignmentEditor" class="btn" data-i18n="btn_alignment_editor"></button>
					<button
						id="btnCockpit"
						class="btn btn--primary"
						data-i18n="panel_cockpit"
						data-i18n-title="panel_cockpit"
						data-i18n-aria-label="panel_cockpit"
					></button>
				</div>
				<button id="btnToggleBands" class="btn hidden" data-i18n="btn_bands"></button>
				<button id="btnToggleSection" class="btn hidden" data-i18n="btn_section"></button>
				<button id="btnToggleDebug" class="btn hidden" data-i18n="btn_status_debug"></button>

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

				<label class="hint uf-autoFitControl" style="display:inline-flex; align-items:center; gap:6px;">
					<input id="chkAutoFit" type="checkbox" />
					<span data-i18n="label_autofit"></span>
				</label>

				<button id="btnFit" class="btn" data-i18n="btn_fit" data-i18n-title="btn_fit_title"></button>

				<div id="geoModeBadge" class="uf-geoModeBadge" aria-live="polite">LOCAL</div>
				<!--button id="btnPinToggle" class="btn" data-i18n="btn_pin_toggle" data-i18n-title="btn_pin_toggle_title"></button-->
				<!--button id="btnPinsClear" class="btn" data-i18n="btn_pins_clear" data-i18n-title="btn_pins_clear_title"></button-->
				<!--span id="pinsInfo" class="hint" data-i18n="pins_info_empty"></span-->
			</div>
			<section id="workspaceContextBar" class="uf-workspaceContextBar" data-context-bar-status="absent" data-context-bar-mode="main" aria-label="Workspace context" aria-live="polite"></section>
			<section id="importActivityRail" class="uf-importActivityRail hidden" aria-live="assertive" aria-atomic="true">
				<div class="uf-importActivityRail__pulse" aria-hidden="true"></div>
				<div class="uf-importActivityRail__copy">
					<strong data-import-activity-title>Import</strong>
					<span data-import-activity-detail></span>
					<div data-import-activity-files></div>
				</div>
				<div class="uf-importActivityRail__actions">
					<button type="button" class="btn" data-import-activity-open>Import ansehen</button>
					<button type="button" class="btn btn--ghost" data-import-activity-dismiss aria-label="Importstatus schließen" title="Importstatus schließen">×</button>
				</div>
			</section>
			<section id="alignmentIntelligence" class="uf-alignmentIntelligence" data-alignment-intelligence-status="finding" data-alignment-intelligence-mode="main" aria-label="Alignment Intelligence">
				<header><strong>Alignment Intelligence</strong><output data-alignment-intelligence-identity>Import finding · no evidence</output><button id="btnAlignmentIntelligence" class="btn btn--ghost" type="button" aria-controls="alignmentIntelligence" aria-expanded="false"><span data-i18n="workspace_details"></span><span aria-hidden="true">⌄</span></button></header>
				<ul data-alignment-intelligence-capabilities></ul>
			</section>

			<div class="uf-workspace">
				<div class="uf-stageWrap" id="geoStage" tabindex="-1">
					<section class="uf-startSurface" data-workspace-start-surface aria-labelledby="workspaceStartTitle">
						<div class="uf-startSurface__copy">
							<p class="uf-startSurface__eyebrow">alignmentOS · Engineering Workspace</p>
							<h1 id="workspaceStartTitle">Wo soll deine Trassierung entstehen?</h1>
							<p>Importiere Bestandsdaten oder beginne eine neue Trassierung. Geometrie, Höhen, Überhöhung und Kilometrierung bleiben in einem gemeinsamen Arbeitszustand.</p>
						</div>
						<div class="uf-startSurface__actions">
							<button type="button" class="uf-startAction uf-startAction--primary" data-workspace-import>
								<strong>Daten hineinziehen</strong><span>Mehrere Dateien oder einen Projektordner</span>
							</button>
							<button type="button" class="uf-startAction" data-workspace-create>
								<strong>Neues Alignment</strong><span>Mit einer leeren Trassierung beginnen</span>
							</button>
							<button type="button" class="uf-startAction" data-workspace-open>
								<strong>Vorhandene Objekte</strong><span>Persistierten Arbeitsstand öffnen</span>
							</button>
						</div>
						<footer><span>1 · Daten verstehen</span><span>2 · Alignment bearbeiten</span><span>3 · Folgen prüfen</span></footer>
					</section>
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
					<section id="initialCrossSection" class="uf-initialSection" aria-label="Initial alignment cross-section">
						<header><strong>Cross-section at shared s</strong><output data-initial-section-station>—</output></header>
						<svg viewBox="0 0 360 150" role="img" aria-label="Local alignment reference frame">
							<line class="uf-initialSection__ground" x1="28" y1="105" x2="332" y2="105" />
							<line class="uf-initialSection__axis" x1="180" y1="128" x2="180" y2="35" />
							<circle class="uf-initialSection__origin" cx="180" cy="105" r="5" />
							<text x="188" y="43">up</text><text x="290" y="98">lateral</text>
						</svg>
						<dl><dt>World</dt><dd data-initial-section-world>—</dd><dt>Tangent</dt><dd data-initial-section-tangent>—</dd></dl>
						<p data-initial-section-evidence>No qualified cross-section evidence</p>
					</section>
				</aside>
			</div>
		</div>
	`;

	if (overlayRoot) {
		overlayRoot.innerHTML = `
			<section id="canonicalObjectQuickSwitcherOverlay" class="uf-panel hidden" data-tool-surface data-tool-kind="quick-switcher" role="complementary" aria-modal="false" aria-hidden="true" aria-labelledby="canonicalObjectQuickSwitcherTitle"><header class="uf-panel__header"><span id="canonicalObjectQuickSwitcherTitle">Objekt wechseln</span><button id="btnCanonicalObjectQuickSwitcherClose" class="btn btn--ghost" type="button" aria-label="Schließen">×</button></header><div id="canonicalObjectQuickSwitcherBody" class="uf-panel__body"></div></section>
			<section id="engineeringCommandPaletteOverlay" class="uf-panel hidden" data-tool-surface data-tool-kind="command-palette" role="complementary" aria-modal="false" aria-hidden="true" aria-labelledby="engineeringCommandPaletteTitle"><header class="uf-panel__header"><span id="engineeringCommandPaletteTitle">Befehle</span><button id="btnCommandPaletteClose" class="btn btn--ghost" type="button" aria-label="Schließen">×</button></header><div id="engineeringCommandPaletteBody" class="uf-panel__body"></div></section>
			<section id="gndImportWorkbenchOverlay" class="uf-panel uf-gnd-workbench hidden" data-tool-surface data-tool-kind="workbench" role="complementary" aria-modal="false" aria-hidden="true" aria-labelledby="gndWorkbenchTitle">
				<header class="uf-panel__header">
					<span id="gndWorkbenchTitle" data-i18n="gnd_workbench.title"></span>
					<button id="btnGndImportWorkbenchClose" class="btn btn--ghost" data-i18n-title="btn_close_title" data-i18n-aria-label="btn_close_title">×</button>
				</header>
				<div id="gndImportWorkbenchBody" class="uf-panel__body"></div>
			</section>

			<section id="spotOverlay" class="uf-panel hidden" data-tool-surface data-tool-kind="objects" role="complementary" aria-modal="false" aria-hidden="true" aria-labelledby="spotOverlayTitle">
				<header class="uf-panel__header">
					<span id="spotOverlayTitle" data-i18n="panel_spot"></span>
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
						<section class="te-preview"><div id="transBoard" class="jxgbox" data-transed-plot-role="primary-function-host"></div><section class="te-splits" aria-label="Transition boundaries"><label for="teW1"><span data-i18n="label_te_w1"></span><input type="number" id="teW1" min="0" max="1" step="0.001" inputmode="decimal" /><output id="teW1Val">—</output></label><label for="teW2"><span data-i18n="label_te_w2"></span><input type="number" id="teW2" min="0" max="1" step="0.001" inputmode="decimal" /><output id="teW2Val">—</output></label></section><div id="teLegend" class="hint"></div></section>
						<details class="te-depth"><summary data-i18n="transed.depth.catalogue"></summary><nav class="te-catalogue" aria-label="transitionDB"><div id="teBreadcrumb" class="te-breadcrumb"></div><div id="teLevels" class="te-levels"></div><div id="teRecordList" class="te-record-list"></div></nav></details>
						<details class="te-depth"><summary data-i18n="transed.depth.details"></summary><section id="teDetails" class="te-details"></section></details>
						<details class="te-depth"><summary data-i18n="transed.depth.edit"></summary><section id="teTransitionControls" class="uf-trans-controls">
							<div class="te-partition"><label for="tePart1" data-i18n="transed.partition.in"></label><input id="tePart1" class="input" type="number" min="0" max="1" step="0.001" /><label for="tePartCore" data-i18n="transed.partition.core"></label><input id="tePartCore" class="input" type="number" min="0" max="1" step="0.001" /><label for="tePart2" data-i18n="transed.partition.out"></label><input id="tePart2" class="input" type="number" min="0" max="1" step="0.001" /></div>
							<select id="tePresetSelAlt" class="select hidden"></select>
							<div class="te-actions"><button id="teApply" class="btn" data-i18n="transed.apply"></button><button id="teReset" class="btn btn--ghost" data-i18n="transed.reset"></button><output id="teEditStatus" class="hint"></output></div>
						</section></details>
						<details class="te-depth"><summary data-i18n="transed.compare"></summary><section class="te-compare"><header><select id="teComparePreset" class="select"></select></header><div id="teCompareSummary"></div><svg id="teCompareGraph" viewBox="0 0 600 180" role="img" data-transed-plot-role="transition-comparison"></svg></section></details>
					</main>
				</div>
			</section>

			<section id="alignmentEditorOverlay" class="uf-panel hidden" data-tool-surface data-tool-kind="authoring" role="complementary" aria-modal="false" aria-hidden="true" aria-labelledby="aeTitle">
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
						<section id="aeRealizationReceipt" class="uf-align-edit__sequence" aria-live="polite" aria-label="Verifizierter horizontaler Konsequenzbeleg"></section>
						<section id="aeSequenceReview" class="uf-align-edit__sequence" aria-label="Horizontale Sequenz und Konsequenzen"></section>
						<details class="uf-align-edit__technical">
							<summary data-i18n="alignment_editor.technical"></summary>
							<dl id="aeTechnicalDetails"></dl>
						</details>
					</section>
				</div>
			</section>

			<section id="verticalProfileAuthoringOverlay" class="uf-panel hidden" data-tool-surface data-tool-kind="vertical-authoring" role="complementary" aria-modal="false" aria-hidden="true" aria-labelledby="verticalProfileAuthoringTitle">
				<header class="uf-panel__header"><span id="verticalProfileAuthoringTitle">Vertical / Gradiente</span><button id="btnVerticalProfileAuthoringClose" class="btn btn--ghost" aria-label="Schließen">×</button></header>
				<div id="verticalProfileAuthoringBody" class="uf-panel__body"></div>
			</section>
			<section id="cantAuthoringOverlay" class="uf-panel hidden" data-tool-surface data-tool-kind="cant-authoring" role="complementary" aria-modal="false" aria-hidden="true" aria-labelledby="cantAuthoringTitle"><header class="uf-panel__header"><span id="cantAuthoringTitle">Überhöhung / Cant</span><button id="btnCantAuthoringClose" class="btn btn--ghost" aria-label="Schließen">×</button></header><div id="cantAuthoringBody" class="uf-panel__body"></div></section>
			<section id="chainageAuthoringOverlay" class="uf-panel hidden" data-tool-surface data-tool-kind="chainage-authoring" role="complementary" aria-modal="false" aria-hidden="true" aria-labelledby="chainageAuthoringTitle"><header class="uf-panel__header"><span id="chainageAuthoringTitle">Stationierung / Chainage</span><button id="btnChainageAuthoringClose" class="btn btn--ghost" aria-label="Schließen">×</button></header><div id="chainageAuthoringBody" class="uf-panel__body"></div></section>

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
