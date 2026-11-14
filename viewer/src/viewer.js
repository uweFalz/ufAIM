
/*! Bundled license information:

xlsx/xlsx.mjs:
  (*! xlsx.js (C) 2013-present SheetJS -- http://sheetjs.com *)

xlsx/xlsx.mjs:
  (*! sheetjs (C) 2013-present SheetJS -- http://sheetjs.com *)
*/



			const fileInput = document.querySelector("#files");
			const folderFileInput = document.querySelector("#folderFiles");
			const dropzone = document.querySelector("#dropzone");
			const status = document.querySelector("#status");
			const output = document.querySelector("#output");
			const viewer = document.querySelector("#viewer");
			const slideScrim = document.querySelector("#slideScrim");
			const tablesNav = document.querySelector("#tables");
			const tableTitle = document.querySelector("#tableTitle");
			const tableMeta = document.querySelector("#tableMeta");
			const listing = document.querySelector("#listing");
			const gridWrap = document.querySelector("#gridWrap");
			const listingZoomLabel = document.querySelector("#listingZoomLabel");
			const listingZoomOut = document.querySelector("#listingZoomOut");
			const listingZoomIn = document.querySelector("#listingZoomIn");
			const workspace = document.querySelector("#workspace");
			const dataPanel = document.querySelector("#dataPanel");
			const outboxContent = document.querySelector("#outboxContent");
			const toggleInbox = document.querySelector("#toggleInbox");
			const toggleOutbox = document.querySelector("#toggleOutbox");
			const toggleDiagram = document.querySelector("#toggleDiagram");
			const toggleText = document.querySelector("#toggleText");
			const reopenText = document.querySelector("#reopenText");
			const toggleTextOpacity = document.querySelector("#toggleTextOpacity");
			const toggleFullscreen = document.querySelector("#toggleFullscreen");
			const mapPanel = document.querySelector("#mapPanel");
			const multi2d = document.querySelector("#multi2d");
			const mapFit = document.querySelector("#mapFit");
			const mapNorth = document.querySelector("#mapNorth");
			const mapNorthArrow = document.querySelector("#mapNorthArrow");
			const mapZoomOut = document.querySelector("#mapZoomOut");
			const mapZoomIn = document.querySelector("#mapZoomIn");
			const mapTitle = document.querySelector("#mapTitle");
			const crsNote = document.querySelector("#crsNote");
			const gisAssign = document.querySelector("#gisAssign");
			const mapEmpty = document.querySelector("#mapEmpty");
			const tileConsentCard = document.querySelector("#tileConsent");
			const tileConsentForget = document.querySelector("#tileConsentForget");
			const tileConsentText = document.querySelector("#tileConsentText");
			const tileConsentClose = document.querySelector("#tileConsentClose");
			const tileSourceEditor = document.querySelector("#tileSourceEditor");
			const tileBaseInput = document.querySelector("#tileBaseInput");
			const tileRailwayInput = document.querySelector("#tileRailwayInput");
			const tileAttributionInput = document.querySelector("#tileAttributionInput");
			const baseMapLoad = document.querySelector("#baseMapLoad");
			const railwayOpacityControl = document.querySelector("#railwayOpacityControl");
			const mapLegend = document.querySelector("#mapLegend");
			const precisionToggle = document.querySelector("#precisionToggle");
			const kmLineToggle = document.querySelector("#kmLineToggle");
			// Kilometerlinien carry no train and no rail; on a two-track Strecke
			// they run between the Gleise and hide them. One switch for the map
			// (both confidence layers, the precision layers, the SVG fallback) and
			// the IVMG's Kilometerlinie row; the Gleise and the km reference of the
			// 7L are untouched.
			let kilometerLinesVisible = true;
			const precisionLegend = document.querySelector("#precisionLegend");
			const rejectListToggle = document.querySelector("#rejectListToggle");
			const rejectListCount = document.querySelector("#rejectListCount");
			const rejectListPanel = document.querySelector("#rejectListPanel");
			const railwayOpacity = document.querySelector("#railwayOpacity");
			const railwayOpacityValue = document.querySelector("#railwayOpacityValue");
			const maplibreMapElement = document.querySelector("#maplibreMap");
			const mapFilterToggle = document.querySelector("#mapFilterToggle");
			const mapFilterPanel = document.querySelector("#mapFilterPanel");
			const diagramPanel = document.querySelector("#diagramPanel");
			const linksPanel = document.querySelector("#linksPanel");
			const linksContent = document.querySelector("#linksContent");
			const linksNote = document.querySelector("#linksNote");
			const linksLegend = document.querySelector("#linksLegend");
			const linksScroll = document.querySelector("#linksScroll");
			const spurplanPanel = document.querySelector("#spurplanPanel");
			const spurplanContent = document.querySelector("#spurplanContent");
			const spurplanNote = document.querySelector("#spurplanNote");
			const spurplanLegend = document.querySelector("#spurplanLegend");
			const spurplanScroll = document.querySelector("#spurplanScroll");
			const spurplanColoring = document.querySelector("#spurplanColoring");
			const deliveryPanel = document.querySelector("#deliveryPanel");
			const deliveryContent = document.querySelector("#deliveryContent");
			const deliveryNote = document.querySelector("#deliveryNote");
			const deliveryScroll = document.querySelector("#deliveryScroll");
			const diagramResizeHandle = document.querySelector("#diagramResizeHandle");
			const assumptionsMenu = document.querySelector("#assumptionsMenu");
			const diagram = document.querySelector("#diagram");
			const diagramScroll = document.querySelector("#diagramScroll");
			const diagramTable = document.querySelector("#diagramTable");
			const diagramCursor = document.querySelector("#diagramCursor");
			const diagramTitle = document.querySelector("#diagramTitle");
			const diagramCode = document.querySelector("#diagramCode");
			const diagramNote = document.querySelector("#diagramNote");
			const viewModeButtons = Array.from(document.querySelectorAll("#viewModes button"));
			const validate7lButton = document.querySelector("#validate7l");
			const exportLandxmlButton = document.querySelector("#exportLandxml");
			let loadedFiles = [];
			let planningFiles = [];
			let selectedEntry = null;
			const bulkSelectedEntries = new Set();
			// The Weiche the IVHW draws. Set by the Outbox's "Weichen (aus Geometrie
			// erkannt)" rows, dropped as soon as something outside it is selected.
			let activeJunction = null;
			let selectedPlanningFile = null;
			let planningPreviewUrl = null;
			let fullMapViewBox = null;
			let currentMapViewBox = null;
			// The own map turned by the user: degrees clockwise on the screen,
			// about the middle of everything drawn. Everything of the map lives in
			// one group (mapWorld) that carries the rotation; zoom and pan stay a
			// matter of the viewBox. 0 leaves every number as it was.
			let mapRotation = 0;
			let mapWorld = null;
			let activeMapMode = "map";
			let maplibreMap = null;
			let railwayMapActive = false;
			let railwayMapPreference = "auto";
			let railwayLayerOpacity = 0.15;
			let precisionModeActive = false;
			// ---- ABLEITUNG · Annahmen ------------------------------------------
			// Every number here is an assumption feeding a derivation, not a
			// measurement and not part of Main (see interpretedGeometry()). Each
			// one is shown in the UI where it applies (band label, footnote,
			// button) instead of being silently baked in. Change them here only.
			// Sources: Ril 800.0110 "Linienführung" V3.0 (gültig ab 01.02.2021)
			// and Ril 457.0201 "Gestaltungsregeln für das VzG" (13.12.2009).
			// Where the Ril grades a value Regelwert / Ermessensgrenze /
			// Zustimmungswert, the Ermessensgrenze is used: 800.0110 4 (3) says a
			// Geschwindigkeitsanhebung is first to be checked by exhausting the
			// parameters up to the Ermessensgrenze, without construction -- which
			// is exactly the GWB question. Regelwert would be the target for a
			// Neubau; the Zustimmungswert needs the Zentrale and is offered for one
			// value only, the Überhöhung up to the EBO-Grenze (switch "Grenze").
			//
			// Precision scale, calibrated on the Ril: 883.3100 (1) asks of the
			// Aufnahme von Gleisen und Weichen a relative accuracy sigma_r = 5 mm
			// in Lage and in Höhe (to the surrounding DB_REF-Festpunktfeld) and
			// an absolute sigma_a,3D = 20 mm for the ETRF89 coordinate of the
			// single point; 883.3000 (5) allows a GVP 10 mm in Lage (5 mm in
			// Höhe). The GND's meanPointError / meanHeightError is the reported
			// sigma of the measured point, so it is read against these: within
			// sigma_r, within the GVP Lage, within sigma_a, beyond. The 3 mm
			// cut before was a guess from the first data set.
			const PRECISION_CLASSES = [
				{ max: 0.005, color: "#00c853", label: "≤ 5 mm", note: "σ_r Lage/Höhe, Ril 883.3100" },
				{ max: 0.01, color: "#8bc34a", label: "≤ 10 mm", note: "σ_r,2D der GVP-Lage, Ril 883.3000" },
				{ max: 0.02, color: "#ffeb3b", label: "≤ 20 mm", note: "σ_a,3D absolut, Ril 883.3100" },
				{ max: Infinity, color: "#d32f2f", label: "> 20 mm", note: "außerhalb Ril 883.3100" },
			];
			const PRECISION_UNKNOWN_COLOR = "#8e8e93";
			// Reject list: everything the GND reports as measured worse than
			// sigma_r goes on the Ausschussliste, not just colored differently.
			const PRECISION_REJECT_THRESHOLD = PRECISION_CLASSES[0].max;
			const PRECISION_SOURCE = "Ril 883.3100 (1), 883.3000 (5)";
			// Equilibrium cant u0 = s v² / (g r): with the dynamic gauge s = 1,5 m and
			// g = 9,80665 m/s² (AIM's STANDARD_DYNAMIC_GAUGE) that is 11,80 v²/r in
			// mm, km/h and m -- the 11,8 the Ril quotes, computed rather than copied.
			const EQUILIBRIUM_CANT_FACTOR = 1.5 * 1000 / (3.6 * 3.6 * 9.80665);
			// Überhöhungsfehlbetrag in the speed formula v = sqrt(r (u + uf) / 11.8):
			// 800.0110 Tab. 5, zul uf = 130 mm is the Ermessensgrenze for Gleis;
			// 150 mm only for vehicles with the corresponding Zulassung (Fn. 18)
			// and r >= 650 m -- below 650 m the 150 is a Zustimmungswert and not
			// offered. The vehicle class is in no geometry file, so the toolbar
			// select sets it; "Regel" is the default.
			const CANT_DEFICIENCY_MM = 130;
			const CANT_DEFICIENCY_ZULASSUNG_MM = 150;
			const CANT_DEFICIENCY_ZULASSUNG_MIN_RADIUS_M = 650;
			// Bogenschneller Betrieb (Neigetechnik), 800.0110 11 and Tab. 13: such
			// vehicles are konventionell allowed uf = 150 mm (11 (1)); in überhöhten
			// Gleisbogen (u >= 30 mm, the Ermessensgrenze; Regelwert 40) and between
			// 70 and 160 km/h they may run with ufN = 300 / 245 / 207 mm by
			// Radsatzlast <= 16,8 / 17,5 / 18,5 t (11 (2)). In Bögen with
			// Zwangspunkten (Brücken ohne Schotterbett, Hilfsbrücken, BÜ with
			// starren Belägen, Tab. 6) only 150 mm -- Zwangspunkte are in no
			// geometry file, so every Bogen counts as free and the footnote says
			// so. Übergangsbogen and Rampe are designed for the conventional speed
			// (11 (4)); for NeiTech the ramp minima are Zustimmungswerte settled
			// case by case (Tab. 13 Fn. 45 -> Tab. 8 Fn. 25), so the ramp is not
			// judged in NeiTech mode. The Übergangsbogen is judged at vN for the
			// NeiTech Fehlbetrag (Tab. 9 as the Ermessensgrenze of Tab. 13; the
			// Regelwert 0,55 vN is not enforced), Krümmungswechsel at vN (11 (3)).
			const NEITECH_UF_BY_RSL_MM = { NeiTech168: 300, NeiTech175: 245, NeiTech185: 207 };
			const NEITECH_RSL_LABEL = { NeiTech168: "≤ 16,8 t", NeiTech175: "≤ 17,5 t", NeiTech185: "≤ 18,5 t" };
			const NEITECH_CONVENTIONAL_UF_MM = 150;
			const NEITECH_MIN_CANT_MM = 30;
			const NEITECH_V_MIN_KMH = 70;
			const NEITECH_V_MAX_KMH = 160;
			// Cant a Bogen may be given, 800.0110 7 (1) and Tab. 4: not below 20 mm,
			// multiples of 5, Ermessensgrenze 160 mm on Schotteroberbau, 170 mm on
			// Fester Fahrbahn. Above that lies the Genehmigungsbereich up to the
			// EBO-Grenze u = 180 mm (Tab. 4, § 6 (3) EBO): a Zustimmungswert, so it
			// is a switch of its own and not the default. The Oberbau is in no
			// geometry file, so the toolbar select sets it; Schotter is the
			// default because it is the lower value.
			const CANT_MIN_MM = 20;
			const CANT_STEP_MM = 5;
			const CANT_MAX_BY_OBERBAU_MM = { Schotter: 160, FesteFahrbahn: 170 };
			const CANT_MAX_EBO_MM = 180;
			const OBERBAU_LABEL = { Schotter: "Schotteroberbau", FesteFahrbahn: "Feste Fahrbahn" };
			// Überhöhungsrampe, 800.0110 Tab. 8 (Ermessensgrenze; Regelwert would
			// be 10 / 7.5): length l_R >= k * v * du / 1000 [m, km/h, mm]. Tab. 7:
			// gradient not steeper than 1:400 (Ermessensgrenze = EBO); for Bloss
			// the steepest point is the middle, m_MB = 2/3 * l_RB / du * 1000
			// (Bild 2).
			const RAMP_LENGTH_FACTOR = { Klothoide: 8, Bloss: 6 };
			const RAMP_GRADIENT_MIN_M = 400;
			const BLOSS_GRADIENT_SHARE = 2 / 3;
			// Übergangsbogen, 800.0110 Tab. 9: min l_U >= k * v * duf / 1000.
			const TRANSITION_LENGTH_FACTOR = { Klothoide: 4, Bloss: 4.5 };
			// Reshaping a Klothoide into a Bloss with the same f-Maß, 800.0110
			// 8 (2): the Bogen stays put, the Übergangsbogen grows by sqrt(5/3).
			// Bloss ramps want du >= 40 mm (Fn. 23).
			const BLOSS_LENGTH_FROM_KLOTHOIDE = Math.sqrt(5 / 3);
			const BLOSS_MIN_DELTA_U_MM = 40;
			// 800.0110 Tab. 3: Mindestlänge of a Gleisbogen or Gerade by speed.
			function minElementLengthM(v) { return (v <= 70 ? 0.10 : v <= 100 ? 0.15 : 0.20) * v; }
			// Korbbogen keep one cant while the Fehlbetrag difference between the
			// radii stays within 40 mm (800.0110 7 (4), v <= 200 km/h); beyond it
			// each radius wants its own cant, i.e. a ramp between the Bögen. That
			// is a design consequence, not a speed limit, so it is reported on the
			// proposal line and not enforced.
			const KORBBOGEN_MAX_DELTA_UF_MM = 40;
			// Krümmungswechsel ohne Übergangsbogen, 800.0110 9 (3) and Tab. 10: the
			// Vergleichsradius rW (Gerade/Kreisbogen: r; Korbbogen: r1 r2 / (r1 - r2);
			// Gegenbogen: r1 r2 / (r1 + r2)) may go down to the Ermessensgrenze of
			// Tab. 10 column 3 (Gleise und Weichen), linear between the rows. Below
			// 40 km/h the table carries footnoted special values (150 m, Gegenbogen
			// 75/100 m), 150 is used; above 200 km/h the Zentrale decides -- the
			// 200 km/h value is used and the footnote says so.
			const VERGLEICHSRADIUS_ERMESSEN_M = { 25: 150, 30: 150, 40: 178, 50: 278, 60: 400, 70: 545, 80: 710, 90: 900, 100: 1110, 110: 1410, 120: 1745, 130: 2130, 140: 2575, 150: 3085, 160: 3675, 170: 4350, 180: 5125, 190: 6000, 200: 7000 };
			function vergleichsradiusMinM(speedKmh) {
				const speeds = Object.keys(VERGLEICHSRADIUS_ERMESSEN_M).map(Number).sort((a, b) => a - b);
				const v = Math.min(Math.max(speedKmh, speeds[0]), speeds[speeds.length - 1]);
				const upper = speeds.find((candidate) => candidate >= v);
				const lower = [...speeds].reverse().find((candidate) => candidate <= v);
				if (upper === lower) return VERGLEICHSRADIUS_ERMESSEN_M[upper];
				const t = (v - lower) / (upper - lower);
				return VERGLEICHSRADIUS_ERMESSEN_M[lower] + t * (VERGLEICHSRADIUS_ERMESSEN_M[upper] - VERGLEICHSRADIUS_ERMESSEN_M[lower]);
			}
			// Cap for both speed bands: 800.0110's tables end at 300 km/h and no
			// German line runs or plans beyond it (Nuernberg-Ingolstadt-Muenchen);
			// China's ~400 is irrelevant to a DB tool.
			const V_MAX_DE_KMH = 300;
			// Signalled speeds are steps: 457.0201 5 (11) rounds Spalte 2 DOWN to a
			// multiple of 10; 5 is allowed only where no Lf / Zs 3 signalling is
			// needed (ETCS later -- a parameter, not wired in). Always round DOWN:
			// a curve that allows 179.5 must show 170, never 180.
			const SPEED_STEP_KMH = 10;
			function roundDownToSpeedStep(speedKmh, stepKmh = SPEED_STEP_KMH) {
				return Math.floor(speedKmh / stepKmh) * stepKmh;
			}
			// From Bogen values to VzG-like Abschnitte, 457.0201 5 (10): an upper
			// step (faster than both neighbours) must be "ausfahrbar", i.e. at
			// least Beschleunigungsweg + Beharrungsstrecke (incl. 210 m Standard-
			// zuglänge) + Bremsweg from Anhang 2, and never shorter than the
			// Regelbremsweg; a step in a falling Treppe may follow at Bremsweg
			// distance, a shorter one is merged into the lower step (Bild 14; the
			// Ril also allows extending it backwards, Bild 13 -- not modelled).
			// Not applied above 160 km/h (5 (10) b 3, and the tables end there).
			// The line's Regelbremsweg is in no geometry file, so the toolbar
			// input sets it; 1000 m is the default because 457.0201's own example
			// uses it (700 m would be a Nebenbahn).
			const REGELBREMSWEG_DEFAULT_M = 1000;
			const FAHRDYNAMIK_MAX_KMH = 160;
			// Streckengeschwindigkeit on Geraden and wide Bögen: no geometry file
			// carries the VzG value, so the toolbar input sets it; the default is
			// the 160 km/h the Fahrdynamik tables end at.
			const LINE_SPEED_DEFAULT_KMH = 160;
			// 457.0201 Anhang 2 A): Beschleunigungs- bzw. Bremsweg [m] from the
			// row speed to the column speed (columns 160, 150, ... 10 km/h, 0 on
			// the diagonal); B): Beharrungsstrecke s_ges [m] incl. 210 m Zuglänge
			// for 10 ... 160 km/h. Checked against the Ril's worked example
			// (90 -> 140: 1218 m, s_ges(140) 1377 m, 140 -> 110: 439 m = 3034 m).
			const FAHRDYNAMIK_COLUMNS_KMH = [160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
			const FAHRDYNAMIK_WEG_M = {
				10: [2545, 2171, 1832, 1526, 1250, 1011, 797, 614, 458, 329, 225, 143, 83, 39, 13, 0],
				20: [2532, 2158, 1819, 1513, 1237, 998, 784, 601, 445, 316, 212, 130, 69, 26, 0, 17],
				30: [2506, 2132, 1793, 1487, 1211, 971, 758, 575, 418, 290, 185, 104, 43, 0, 30, 47],
				40: [2463, 2089, 1750, 1444, 1168, 928, 715, 532, 376, 247, 143, 61, 0, 41, 71, 88],
				50: [2402, 2028, 1689, 1383, 1107, 867, 654, 471, 315, 186, 82, 0, 52, 93, 123, 140],
				60: [2320, 1947, 1607, 1301, 1026, 786, 573, 389, 233, 104, 0, 64, 116, 157, 187, 204],
				70: [2216, 1842, 1503, 1197, 921, 681, 468, 285, 129, 0, 76, 140, 192, 233, 263, 280],
				80: [2087, 1713, 1374, 1068, 792, 553, 339, 156, 0, 88, 164, 228, 280, 321, 351, 368],
				90: [1931, 1557, 1218, 912, 636, 396, 183, 0, 99, 187, 263, 327, 379, 420, 450, 467],
				100: [1748, 1374, 1035, 729, 453, 213, 0, 112, 211, 299, 375, 439, 491, 532, 562, 579],
				110: [1535, 1161, 822, 515, 240, 0, 122, 234, 333, 421, 497, 561, 613, 654, 684, 701],
				120: [1295, 921, 582, 276, 0, 135, 257, 369, 468, 556, 632, 696, 748, 789, 819, 836],
				130: [1019, 645, 306, 0, 146, 281, 403, 515, 614, 702, 778, 842, 894, 935, 965, 982],
				140: [713, 339, 0, 158, 304, 439, 561, 673, 772, 860, 936, 1000, 1052, 1093, 1123, 1140],
				150: [374, 0, 169, 327, 473, 608, 730, 842, 941, 1029, 1105, 1169, 1221, 1262, 1292, 1309],
				160: [0, 181, 350, 508, 654, 789, 911, 1023, 1122, 1210, 1286, 1350, 1402, 1443, 1473, 1490],
			};
			const BEHARRUNG_M = { 10: 293, 20: 377, 30: 460, 40: 544, 50: 627, 60: 710, 70: 793, 80: 877, 90: 960, 100: 1043, 110: 1127, 120: 1210, 130: 1293, 140: 1377, 150: 1460, 160: 1544 };
			function fahrdynamikWeg(fromKmh, toKmh) {
				if (fromKmh === toKmh) return 0;
				const row = FAHRDYNAMIK_WEG_M[fromKmh];
				const column = FAHRDYNAMIK_COLUMNS_KMH.indexOf(toKmh);
				return row && column >= 0 ? row[column] : NaN;
			}
			// ---- Fahrzeit · Fahrschaulinie über dem GWB -----------------------------
			// What the GWB step profile is worth in minutes. Deliberately simple and
			// said so in the figure: constant Anfahrbeschleunigung a and Brems-
			// verzögerung b per Zugart, no Zugkraft- or Widerstandskennlinie, no
			// Neigung, run in Stationierungsrichtung over the selected range, Halt at
			// both ends or Durchfahrt at the limit. Forward pass (accelerating),
			// backward pass (braking), the lower of both is the Fahrschaulinie; the
			// time integrates over it. Where the Gleis has a gap the run restarts and
			// the clock keeps counting.
			const FZK_ZUGARTEN = {
				Nah: { label: "Nahverkehr · Triebzug", a: 1.0, b: 0.8, vMax: 160 },
				Regio: { label: "Regionalzug · lokbespannt", a: 0.4, b: 0.6, vMax: 160 },
				Fern: { label: "Fernverkehr", a: 0.5, b: 0.6, vMax: 300 },
				Gueter: { label: "Güterzug", a: 0.15, b: 0.3, vMax: 100 },
			};
			const FZK_STEP_M = 10;
			const fzkZugartSelect = document.getElementById("fzkZugart");
			const fzkHaltSelect = document.getElementById("fzkHalt");
			function zugart() {
				const key = fzkZugartSelect?.value;
				return FZK_ZUGARTEN[key in FZK_ZUGARTEN ? key : "Nah"];
			}
			function fzkHaltsAtEnds() { return fzkHaltSelect?.value !== "Durchfahrt"; }
			// Continuous runs of a section result: consecutive sections that touch.
			function sectionRuns(result) {
				const sections = [...(result?.sections ?? [])].filter((section) => section.to > section.from).sort((p, q) => p.from - q.from);
				const runs = [];
				for (const section of sections) {
					const run = runs[runs.length - 1];
					if (run && !section.gap && Math.abs(section.from - run[run.length - 1].to) < 0.5) run.push(section);
					else runs.push([section]);
				}
				return runs;
			}
			function simulateRun(run, train, halt) {
				const from = run[0].from;
				const to = run[run.length - 1].to;
				const n = Math.max(1, Math.ceil((to - from) / FZK_STEP_M));
				const ds = (to - from) / n;
				// The limit at a node is the lower of every section that touches it: at
				// a drop the train has to be slow by the time the slower section starts.
				const limit = new Float64Array(n + 1).fill(train.vMax / 3.6);
				for (const section of run) {
					const first = Math.max(0, Math.ceil((section.from - from) / ds - 1e-6));
					const last = Math.min(n, Math.floor((section.to - from) / ds + 1e-6));
					for (let index = first; index <= last; index += 1) limit[index] = Math.min(limit[index], section.v / 3.6);
				}
				const forward = new Float64Array(n + 1);
				const backward = new Float64Array(n + 1);
				forward[0] = halt ? 0 : limit[0];
				for (let index = 1; index <= n; index += 1) forward[index] = Math.min(limit[index], Math.sqrt(forward[index - 1] ** 2 + 2 * train.a * ds));
				backward[n] = halt ? 0 : limit[n];
				for (let index = n - 1; index >= 0; index -= 1) backward[index] = Math.min(limit[index], Math.sqrt(backward[index + 1] ** 2 + 2 * train.b * ds));
				const v = new Float64Array(n + 1);
				const t = new Float64Array(n + 1);
				for (let index = 0; index <= n; index += 1) {
					v[index] = Math.min(forward[index], backward[index]);
					if (index) t[index] = t[index - 1] + ds / Math.max((v[index - 1] + v[index]) / 2, 0.25);
				}
				return { from, to, ds, v, t };
			}
			function fahrzeitCase(result, train, halt) {
				const vPoints = [];
				const tPoints = [];
				let seconds = 0;
				let length = 0;
				for (const run of result ? sectionRuns(result) : []) {
					const sim = simulateRun(run, train, halt);
					for (let index = 0; index < sim.v.length; index += 1) {
						const x = sim.from + index * sim.ds;
						vPoints.push({ x, y: sim.v[index] * 3.6, gap: index === 0 });
						tPoints.push({ x, y: (seconds + sim.t[index]) / 60, gap: index === 0 });
					}
					seconds += sim.t[sim.t.length - 1];
					length += sim.to - sim.from;
				}
				return { vPoints, tPoints, seconds, length };
			}
			function minSec(seconds) {
				const whole = Math.round(seconds);
				return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")} min`;
			}
			function fahrzeitLines(prefix, today, proposal, train, halt) {
				if (!today.length) return [];
				const km = (today.length / 1000).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
				const mean = (seconds) => seconds > 0 ? `${Math.round(today.length / seconds * 3.6)} km/h` : "–";
				const gain = Math.round(today.seconds - proposal.seconds);
				return [
					`${prefix} · Fahrzeit über ${km} km: heute ${minSec(today.seconds)} (im Mittel ${mean(today.seconds)}), Vorschlag ${minSec(proposal.seconds)} (${mean(proposal.seconds)}) · ${gain > 0 ? `Gewinn ${gain} s` : gain < 0 ? `Verlust ${-gain} s` : "kein Unterschied"}`,
					`  Annahmen: ${train.label}, a ${train.a.toLocaleString("de-DE")} m/s², b ${train.b.toLocaleString("de-DE")} m/s², höchstens ${train.vMax} km/h · ${halt ? "Halt an beiden Enden" : "Durchfahrt mit zulässiger Geschwindigkeit"} · Fahrt in Stationierungsrichtung`,
					"  Vereinfachte Fahrdynamik: konstante Beschleunigung und Verzögerung, keine Zugkraft- oder Widerstandskennlinie, keine Neigung, keine Fahrzeitzuschläge — eine Größenordnung, keine Fahrplanrechnung",
				];
			}
			// Two bands per Gleis over the GWB bands: the Fahrschaulinie v(s) and the
			// clock t(s), heute solid and Vorschlag dashed, like the GWB itself.
			function deriveFahrzeitBands(gwbTracks) {
				const train = zugart();
				const halt = fzkHaltsAtEnds();
				const bands = [];
				for (const track of gwbTracks) {
					const prefix = String(track.label ?? "").split(" · ")[0];
					const today = fahrzeitCase(track.sections?.today, train, halt);
					const proposal = fahrzeitCase(track.sections?.proposal, train, halt);
					const emptyNote = "kein Geschwindigkeitsband · keine Fahrzeit ableitbar";
					bands.push(makeBand(`${prefix} · Fahrschaulinie v(s) heute — / Vorschlag ┄ [km/h]`, "diagram-fzk-speed", today.vPoints, {
						emptyNote,
						overlay: { label: "Vorschlag", className: "diagram-fzk-speed-potential", points: proposal.vPoints },
						unit: "km/h",
						valueLabel: "v (km/h)",
						axisFormat: (v) => `${Math.round(v)} km/h`,
						footnote: fahrzeitLines(prefix, today, proposal, train, halt),
						fahrzeit: { today, proposal },
					}));
					bands.push(makeBand(`${prefix} · Fahrzeit t(s) heute — / Vorschlag ┄ [min:s]`, "diagram-fzk-time", today.tPoints, {
						emptyNote,
						overlay: { label: "Vorschlag", className: "diagram-fzk-time-potential", points: proposal.tPoints },
						axisFormat: (minutes) => minSec(minutes * 60),
						valueLabel: "Fahrzeit (min:s)",
					}));
				}
				return bands;
			}
			// --------------------------------------------------------------------
			// Each entry describes one filter dimension end-to-end: its checkbox options
			// (static, or `dynamic` to derive them from loaded data via valueForEntry),
			// values that always pass regardless of selection (alwaysInclude), and
			// values that instead gate MapLibre layer visibility (layerVisibility) rather
			// than the shared geometry filter expression. Adding a new criterion later is
			// one array entry (+ a matching property in geographicFeatureCollection()).
			function routeForEntry(entry) {
				return String(geoFrameInfo(entry)?.track ?? gndSequenceForEntry(entry)?.strecke ?? "");
			}
			const MAP_FILTER_DIMENSIONS = [
				{
					key: "side",
					label: "Seite",
					property: "side",
					alwaysInclude: ["kilometer", "unknown"],
					options: [
						{ value: "right", label: "Rechts" },
						{ value: "left", label: "Links" },
					],
				},
				{
					key: "confidence",
					label: "Herkunft",
					property: "confidence",
					layerVisibility: {
						confirmed: ["technet-lines", "technet-kilometer-lines"],
						inferred: ["technet-lines-inferred", "technet-kilometer-lines-inferred"],
					},
					options: [
						{ value: "confirmed", label: "DB_REF (bestätigt)" },
						{ value: "inferred", label: "Vermutet" },
					],
				},
				{
					key: "route",
					label: "Strecke",
					property: "route",
					dynamic: true,
					// An entry with no resolvable route/Strecke gets route: "" and never appears
					// as a checkbox (knownValuesForDimension skips falsy values) -- alwaysInclude
					// keeps it visible on the map regardless, instead of silently unfilterable.
					alwaysInclude: [""],
					valueForEntry: routeForEntry,
					formatLabel: (value) => (isValidRouteNumber(value) ? `Strecke ${value}` : value),
				},
			];
			const mapFilterState = new Map(MAP_FILTER_DIMENSIONS.map((dimension) => [
				dimension.key,
				new Set(dimension.dynamic ? [] : dimension.options.map((option) => option.value)),
			]));
			const mapFilterSeenValues = new Map(MAP_FILTER_DIMENSIONS.map((dimension) => [dimension.key, new Set()]));
			let geoEntryById = new Map();
			let precisionEntryById = new Map();
			let precisionPopup = null;
			let mapDrag = null;
			let draggedOrganizationEntry = null;
			let dragHintDismissed = false;
			let dragHintUsed = false;
			let inboxCrsOpen = null;
			let draftSevenLineFrames = [];
			let listingZoom = 1;
			let diagramHeightManual = false;
			let diagramResize = null;
			let diagramPresentation = "chart";
			const diagramPresentationButtons = Array.from(document.querySelectorAll("#diagramPresentation button"));
			const gwbLineSpeedInput = document.getElementById("gwbLineSpeed");
			const gwbBrakeDistanceInput = document.getElementById("gwbBrakeDistance");
			const gwbOberbauSelect = document.getElementById("gwbOberbau");
			const gwbFahrzeugSelect = document.getElementById("gwbFahrzeug");
			const gwbCantLimitSelect = document.getElementById("gwbCantLimit");
			function regelbremswegM() {
				const value = Number(gwbBrakeDistanceInput?.value);
				return Number.isFinite(value) && value > 0 ? value : REGELBREMSWEG_DEFAULT_M;
			}
			function oberbauKey() {
				return gwbOberbauSelect && gwbOberbauSelect.value in CANT_MAX_BY_OBERBAU_MM ? gwbOberbauSelect.value : "Schotter";
			}
			function fahrzeugKey() {
				const value = gwbFahrzeugSelect?.value;
				return value in NEITECH_UF_BY_RSL_MM || value === "Zulassung" ? value : "Regel";
			}
			function isNeiTech() { return fahrzeugKey() in NEITECH_UF_BY_RSL_MM; }
			// The conventional Fehlbetrag of the chosen vehicle at this radius.
			function cantDeficiencyMm(radiusM) {
				if (isNeiTech()) return NEITECH_CONVENTIONAL_UF_MM;
				return fahrzeugKey() === "Zulassung" && radiusM >= CANT_DEFICIENCY_ZULASSUNG_MIN_RADIUS_M ? CANT_DEFICIENCY_ZULASSUNG_MM : CANT_DEFICIENCY_MM;
			}
			// The Fehlbetrag the vehicle may use at (u, v): the NeiTech window or
			// the conventional value.
			function cantDeficiencyAt(radiusM, u, v) {
				if (isNeiTech() && u >= NEITECH_MIN_CANT_MM && v >= NEITECH_V_MIN_KMH && v <= NEITECH_V_MAX_KMH) return NEITECH_UF_BY_RSL_MM[fahrzeugKey()];
				return cantDeficiencyMm(radiusM);
			}
			// Highest speed step a Bogen allows by its Fehlbetrag alone at cant u,
			// the better of the conventional regime and the NeiTech window.
			function allowedSpeedKmh(radiusM, u) {
				let best = Math.min(Math.sqrt(radiusM * (u + cantDeficiencyMm(radiusM)) / EQUILIBRIUM_CANT_FACTOR), V_MAX_DE_KMH);
				if (isNeiTech() && u >= NEITECH_MIN_CANT_MM) {
					const vN = Math.min(Math.sqrt(radiusM * (u + NEITECH_UF_BY_RSL_MM[fahrzeugKey()]) / EQUILIBRIUM_CANT_FACTOR), NEITECH_V_MAX_KMH);
					if (vN >= NEITECH_V_MIN_KMH) best = Math.max(best, vN);
				}
				return roundDownToSpeedStep(best);
			}
			function fahrzeugText(ascii = false) {
				const key = fahrzeugKey();
				const text = key === "Zulassung"
					? `${CANT_DEFICIENCY_ZULASSUNG_MM} mm ab r ${CANT_DEFICIENCY_ZULASSUNG_MIN_RADIUS_M} m (Fahrzeug mit Zulassung, Fn. 18), sonst ${CANT_DEFICIENCY_MM}`
					: isNeiTech()
						? `${NEITECH_UF_BY_RSL_MM[key]} mm Neigetechnik (11 (2), Tab. 13, Radsatzlast ${NEITECH_RSL_LABEL[key]}) in überhöhten Bögen u ≥ ${NEITECH_MIN_CANT_MM} mm zwischen ${NEITECH_V_MIN_KMH} und ${NEITECH_V_MAX_KMH} km/h, sonst ${NEITECH_CONVENTIONAL_UF_MM} (11 (1)); Zwangspunkte stehen in keiner Datei, jeder Bogen gilt als frei; Rampen sind Sache der konventionellen Auslegung (11 (4)) und für NeiTech Zustimmungswerte im Einzelfall (Tab. 13 Fn. 45), hier nicht geprüft; Übergangsbogen nach Tab. 9 und Krümmungswechsel nach Tab. 10 bei vN`
						: `${CANT_DEFICIENCY_MM} mm (Ermessensgrenze Gleis, Regelfahrzeug)`;
				return ascii ? text.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/ü/g, "ue").replace(/ö/g, "oe").replace(/ä/g, "ae").replace(/ß/g, "ss") : text;
			}
			function cantLimitKey() {
				return gwbCantLimitSelect?.value === "EBO" ? "EBO" : "Ermessen";
			}
			function cantMaxMm() {
				return cantLimitKey() === "EBO" ? CANT_MAX_EBO_MM : CANT_MAX_BY_OBERBAU_MM[oberbauKey()];
			}
			function cantLimitLabel() {
				return cantLimitKey() === "EBO" ? "Zustimmungswert bis EBO-Grenze § 6 (3), über der Ermessensgrenze der Tab. 4" : `Tab. 4, ${OBERBAU_LABEL[oberbauKey()]}`;
			}
			const gwbBogenCsvButton = document.getElementById("gwbBogenCsv");
			const gwbAbschnittCsvButton = document.getElementById("gwbAbschnittCsv");
			function lineSpeedKmh() {
				const value = Number(gwbLineSpeedInput?.value);
				return Number.isFinite(value) && value > 0 ? value : LINE_SPEED_DEFAULT_KMH;
			}
			const listingCache = new WeakMap();
			const mapGeometryCache = new WeakMap();
			// Interpreted geometry per entry (see interpretedGeometry()); reset on
			// every file change because a later file can lend an earlier entry its
			// meridian strip, which changes where that entry projects to.
			let geometryModelCache = new WeakMap();
			const performanceSamples = [];

			function cacheFor(cache, entry) {
				let value = cache.get(entry);
				if (!value) {
					value = new Map();
					cache.set(entry, value);
				}
				return value;
			}

			function recordPerformance(name, started, details = {}) {
				const sample = Object.freeze({ name, milliseconds: Math.round((performance.now() - started) * 10) / 10, ...details });
				performanceSamples.push(sample);
				if (performanceSamples.length > 100) performanceSamples.shift();
				status.dataset.performance = JSON.stringify(performanceSamples);
				return sample;
			}

			const LSYS_FAMILIES = {
				A: "RD/83",
				B: "PD/83",
				C: "42/83",
				R: "DB_REF",
				S: "Soldner Netz 88",
			};
			const DBREF_STRIPS = { CR0: 2, DR0: 3, ER0: 4, FR0: 5 };
			const MERIDIAN_STRIPS = { C: 2, D: 3, E: 4, F: 5 };
			const CRS_OPTIONS = [
				["AUTO", "Automatisch erkennen"],
				["DBREF", "DBRef"],
				["OLD_GK", "Altdaten / anderes GK-System"],
				["LOCAL", "Lokal oder unbekannt"],
			];
			const HSYS_OPTIONS = [
				["AUTO", "Aus Datei übernehmen / unbekannt"],
				["NHN", "Höhen über NHN"],
				["NN_ALT", "Ältere Höhen / NN"],
				["LOCAL_HEIGHT", "Lokales Höhensystem"],
			];
			const EPSG_TO_LSYS = {
				"EPSG:5682": "CR0",
				"EPSG:5683": "DR0",
				"EPSG:5684": "ER0",
				"EPSG:5685": "FR0",
			};

			function normalizeLsys(value) {
				const code = String(value ?? "").trim().toUpperCase();
				if (EPSG_TO_LSYS[code]) return EPSG_TO_LSYS[code];
				const embeddedDbCode = code.match(/(?:^|[^A-Z0-9])([CDEF][ABCRS][A-Z0-9])(?:$|[^A-Z0-9])/);
				return embeddedDbCode?.[1] ?? code;
			}

			function classifyLsys(value) {
				const code = normalizeLsys(value);
				if (!code) return { code, kind: "missing", label: "nicht zugeordnet", geographic: false };
				if (code === "LOCAL") return { code, kind: "local", label: "lokales System", geographic: false };
				const oldGk = code.match(/^GK_ALT_([2-5])$/);
				if (oldGk) return { code, kind: "other-gk", label: `Altdaten · GK-Streifen ${oldGk[1]} · Lage angenähert`, geographic: false, strip: Number(oldGk[1]) };
				const match = code.match(/^([CDEF])([ABCRS])([A-Z0-9])$/);
				if (!match) return { code, kind: "unknown", label: "unbekanntes DB-LSYS", geographic: false };
				const [, meridian, family, variant] = match;
				const strip = MERIDIAN_STRIPS[meridian];
				if (family === "R" && variant === "0") {
					return { code, kind: "dbref", label: `DB_REF · Streifen ${strip}`, geographic: true, strip };
				}
				if (variant !== "0") {
					return { code, kind: "local-variant", label: `${LSYS_FAMILIES[family]} · Variante ${variant} · lokal`, geographic: false, strip };
				}
				return { code, kind: family === "S" ? "soldner" : "other-gk", label: `${LSYS_FAMILIES[family]} · Streifen ${strip} · GIS-Lage geschätzt`, geographic: false, strip };
			}

			function ownCoordinateStrip(entry) {
				const element = entry?.item?.payload?.coordGeom?.elements?.[0];
				const easting = element?.start?.easting ?? element?.end?.easting;
				return inferredGkStrip(easting) ?? classifyLsys(systemsForEntry(entry).lsys).strip ?? null;
			}

			// A cant (EU) object from a combined VermEsn TRA file has no coordinate
			// geometry of its own -- only station/value pairs -- but it shares exact
			// point identity (PAD, matching GND-Edit's PL concept) with the alignment
			// (EL) parsed from the same TRA. Borrowing that sibling's strip is not a
			// guess: it is the same physical reference, just not carried on this object.
			function siblingAlignmentStrip(entry) {
				if (entry?.item?.kind === "alignment") return null;
				// The anchor is the alignment this object references directly; the
				// closure's first alignment may be the km line since the root change.
				const anchor = relatedDiagramEntries(entry).anchor;
				const alignment = anchor?.item?.kind === "alignment" ? anchor : null;
				return alignment ? ownCoordinateStrip(alignment) : null;
			}

			function coordinateStripForEntry(entry) {
				return ownCoordinateStrip(entry) ?? siblingAlignmentStrip(entry) ?? null;
			}

			function userLsysForEntry(entry, choice) {
				if (choice === "AUTO") return undefined;
				if (choice === "LOCAL") return "LOCAL";
				const strip = coordinateStripForEntry(entry);
				if (!strip) return null;
				if (choice === "OLD_GK") return `GK_ALT_${strip}`;
				const meridian = Object.entries(MERIDIAN_STRIPS).find(([, value]) => value === strip)?.[0];
				return meridian ? `${meridian}R0` : null;
			}

			function hsysUserLabel(value) {
				if (value === "NHN") return "Höhen über NHN";
				if (value === "NN_ALT") return "ältere Höhen / NN";
				if (value === "LOCAL_HEIGHT") return "lokales Höhensystem";
				return value || "nicht bekannt";
			}

			function count(value) {
				return Array.isArray(value) ? value.length : 0;
			}

			function zoomListing(step) {
				listingZoom = Math.min(2, Math.max(0.65, listingZoom + step));
				listing.style.fontSize = `${listingZoom * 0.8}rem`;
				listingZoomLabel.textContent = `${Math.round(listingZoom * 100)} %`;
			}

			function summarize(file, result, logLines) {
				const envelope = result?.sourceEnvelope;
				const sourceLayer = result?.normalizedSourceLayer;
				const summary = {
					file: file.name,
					size: file.size,
					ok: result?.ok === true,
					status: result?.status ?? "unknown",
					reason: result?.reason ?? null,
					parser: result?.meta?.sourceFormat ?? result?.meta?.parserId ?? null,
					items: count(result?.items),
					rejected: count(result?.rejected),
					relationCandidates: count(result?.relationCandidates),
					diagnostics: count(result?.meta?.diagnostics),
					gndTables: count(envelope?.tables),
					gndFormat: envelope?.source?.format ?? null,
					gndSourceRecords: count(sourceLayer?.records),
					gndObservationGroups: count(sourceLayer?.observationGroups),
					gndSourceConflicts: sourceLayer?.observationGroups?.filter?.((group) => group.classification === "conflict").length ?? 0,
					gndSourceDuplicates: sourceLayer?.observationGroups?.filter?.((group) => group.classification === "duplicate-equal").length ?? 0,
					gndUnsupportedTables: count(sourceLayer?.unsupported)
				};

				return [
					"Zusammenfassung",
					JSON.stringify(summary, null, 2),
					"",
					"Pipeline-Protokoll",
					logLines.length ? logLines.slice(-50).join("\n") : "(keine Meldungen)"
				].join("\n");
			}

			function numberValue(value) {
				if (value && typeof value === "object" && "value" in value) return Number(value.value);
				return Number(value);
			}

			function fixed(value, digits, width) {
				const number = numberValue(value);
				const text = Number.isFinite(number) ? number.toFixed(digits) : "";
				return text.padStart(width);
			}

			// BEGIN GND STATION (test/technet-viewer-station.test.mjs runs this block)
			// "km 0,4 + 60,91": a station in metres (or GND's encoded km, see
			// stationScalar) as Kilometer, Hektometer and Meter. Before the zero
			// point both parts count backwards: -471,96 m is "-0,4 - 71,96".
			function station(value) {
				const number = stationScalar(value);
				if (!Number.isFinite(number)) return "".padStart(14);
				// Rounded to the centimetre first, then split: 67499,999 m is
				// "67,5 + 00,00", not "67,4 + 100,00" (the Meter part rounded up
				// to a full Hektometer after the Hektometer was already cut off).
				const centimetres = Math.round(Math.abs(number) * 100);
				const hundreds = Math.floor(centimetres / 10000);
				const kmText = (hundreds / 10).toFixed(1).replace(".", ",");
				const meterText = ((centimetres - hundreds * 10000) / 100).toFixed(2).replace(".", ",").padStart(5, "0");
				return `${number < 0 ? "-" : ""}${kmText} ${number < 0 ? "-" : "+"} ${meterText}`.padStart(14);
			}
			// END GND STATION

			function isKilometrierung(value) {
				const number = numberValue(value);
				return Number.isFinite(number) && number >= 99_000_000;
			}

			function firstText(...values) {
				for (const value of values.flat()) {
					const text = String(value ?? "").trim();
					if (text) return text;
				}
				return "";
			}

			function systemsForEntry(entry) {
				const spatialRef = entry.item?.payload?.spatialRef ?? {};
				const viewer7L = entry.item?.payload?.extended?.viewer7L ?? {};
				const evidence = entry.item?.meta?.sourceSpatialRef ?? {};
				const references = entry.references ?? {};
				const horizontalCandidates = (references.candidateHorizontalReferenceSystems ?? []).join(" / ");
				const verticalCandidates = (references.candidateVerticalReferenceSystems ?? []).join(" / ");
				return {
					lsys: firstText(
						entry.displayLsys,
						viewer7L.LSYS,
						spatialRef.horizontalCoordinateSystemName,
						spatialRef.horizontalCrsId,
						spatialRef.horizontal,
						entry.item?.meta?.spatialRefHint,
						evidence.horizontalCoordinateSystemName,
						horizontalCandidates
					),
					hsys: firstText(
						entry.displayHsys,
						viewer7L.HSYS,
						spatialRef.verticalCoordinateSystemName,
						spatialRef.verticalCrsId,
						spatialRef.vertical,
						evidence.verticalCoordinateSystemName,
						verticalCandidates
					),
				};
			}

			function objectDisplayName(entry) {
				const sourceName = entry.item?.payload?.name ?? entry.item?.id ?? "(ohne Namen)";
				if (entry.parser !== "gndEdit") return sourceName;
				const sequence = gndSequenceForEntry(entry);
				if (sequence) {
					const directionNames = { 0: "Kilometerlinie", 1: "rechts", 2: "links", 3: "Kilometerlinie", 4: "Nebengleis", 5: "Bahnhofs-/sonstiges Gleis" };
					const track = sequence.strecke && sequence.strecke !== "unknown" ? sequence.strecke : "unbekannt";
					const objectType = isValidRouteNumber(track) && !["4", "5"].includes(String(sequence.strRikz ?? "")) ? `Strecke ${track}` : `Gleis ${track}`;
					const direction = directionNames[sequence.strRikz] ?? sequence.strRikz ?? "unbekannt";
					return `${objectType} · ${direction}`;
				}
				const parts = String(sourceName).split("_");
				const directionNames = {
					0: "Kilometerlinie",
					1: "rechts",
					2: "links",
					3: "Kilometrierung",
					4: "Stationierung",
					5: "sonstige",
				};
				if (parts.length < 3) return sourceName;
				const strecke = parts[0] === "unknown" ? "unbekannt" : parts[0];
				const direction = directionNames[parts[1]] ?? parts[1];
				const objectType = isValidRouteNumber(strecke) ? `Strecke ${strecke}` : `Gleis ${strecke}`;
				return `${objectType} · ${direction} · ${parts[2]}`;
			}

			function objectListName(entry) {
				return objectDisplayName(entry).replace(/\s+·\s+(?:EL|EH)$/u, "");
			}

			const SEVEN_LINE_GROUPS = [
				{ family: "UNASSIGNED", title: "— · Nicht zugeordnet" },
				{ role: "gradientRight", family: "EH", kind: "profile", direction: "rechts", title: "GRA re · Gradiente" },
				{ role: "gradientLeft", family: "EH", kind: "profile", direction: "links", title: "GRA li · Gradiente" },
				{ role: "cantLeft", family: "EU", kind: "cant", direction: "links", title: "EU li · Überhöhung" },
				{ role: "curvatureLeft", family: "EL", kind: "alignment", direction: "links", title: "TRA li · Krümmung" },
				{ role: "curvatureKilometer", family: "EL", kind: "alignment", direction: "Kilometerlinie", title: "TRA km · Kilometerlinie" },
				{ role: "curvatureRight", family: "EL", kind: "alignment", direction: "rechts", title: "TRA re · Krümmung" },
				{ role: "cantRight", family: "EU", kind: "cant", direction: "rechts", title: "EU re · Überhöhung" },
			];

			function gndSequenceForEntry(entry) {
				return entry?.item?.payload?.extended?.gndSequence ?? entry?.item?.derived?.gndSequence ?? null;
			}

			function sevenLineRole(entry) {
				if (entry.userLineRole) return entry.userLineRole;
				const side = sevenLineSide(entry);
				if (entry.item.kind === "staEq") return "curvatureKilometer";
				if (entry.item.kind === "profile") return side === "right" ? "gradientRight" : side === "left" ? "gradientLeft" : "UNASSIGNED";
				if (entry.item.kind === "cant") return side === "right" ? "cantRight" : side === "left" ? "cantLeft" : "UNASSIGNED";
				if (entry.item.kind === "alignment") return side === "right" ? "curvatureRight" : side === "left" ? "curvatureLeft" : side === "kilometer" ? "curvatureKilometer" : "UNASSIGNED";
				return "UNASSIGNED";
			}

			function suggestRoleForEntry(entry) {
				if (isOutboxOrganized(entry)) return null;
				const kind = entry.item.kind;
				const roleBySide = kind === "profile" ? { right: "gradientRight", left: "gradientLeft" }
					: kind === "cant" ? { right: "cantRight", left: "cantLeft" }
					: kind === "alignment" ? { right: "curvatureRight", left: "curvatureLeft" }
					: null;
				if (!roleBySide) return null;
				const frame = geoFrameInfo(entry);
				if (!frame) return null;
				const range = stationRangeForEntry(entry);
				const lsys = effectiveLsys(entry) || frame.lsys;
				const takenSides = new Set();
				for (const candidate of allViewerEntries()) {
					if (candidate === entry || candidate.item.kind !== kind) continue;
					const candidateFrame = geoFrameInfo(candidate);
					if (!candidateFrame || candidateFrame.track !== frame.track) continue;
					if ((effectiveLsys(candidate) || candidateFrame.lsys) !== lsys) continue;
					if (range) {
						const candidateRange = stationRangeForEntry(candidate);
						if (candidateRange && !(candidateRange.from <= range.to + 5 && candidateRange.to >= range.from - 5)) continue;
					}
					const candidateRole = sevenLineRole(candidate);
					if (candidateRole === roleBySide.right) takenSides.add("right");
					else if (candidateRole === roleBySide.left) takenSides.add("left");
				}
				const missing = takenSides.has("right") && !takenSides.has("left") ? "left"
					: takenSides.has("left") && !takenSides.has("right") ? "right"
					: null;
				if (!missing) return null;
				// The free side is a guess by elimination; the Lage can veto it
				// (the Gleis lies on the other side) or back it.
				const lage = sideEvidence(entry)?.lage;
				const lageSide = lage?.verdict === "left" || lage?.verdict === "right" ? lage.verdict : null;
				if (lageSide && lageSide !== missing) return null;
				const groupDef = SEVEN_LINE_GROUPS.find((group) => group.role === roleBySide[missing]);
				return groupDef ? { role: roleBySide[missing], groupDef, reason: lageSide ? lagePositionText(lage) : null } : null;
			}

			function isOutboxOrganized(entry) {
				return Boolean(geoFrameInfo(entry)) && sevenLineRole(entry) !== "UNASSIGNED";
			}

			function sourceFamilyForEntry(entry) {
				const gndFamily = gndSequenceForEntry(entry)?.family;
				if (entry.parser === "gndEdit" && entry.item.kind === "profile") return "EH";
				if (entry.parser === "gndEdit" && entry.item.kind === "cant") return "EU";
				if (entry.parser === "gndEdit" && entry.item.kind === "staEq") return "EK";
				if (entry.parser === "gndEdit" && gndFamily) return gndFamily;
				if (entry.item.kind === "alignment") return entry.parser === "vermEsn" ? "TRA" : "EL";
				if (entry.item.kind === "profile") return entry.parser === "vermEsn" ? "GRA" : "EH";
				if (entry.item.kind === "cant") return "EU";
				if (entry.item.kind === "staEq") return "EK";
				return entry.item.kind.toUpperCase();
			}

			function organizationFamily(entry) {
				if (entry.userFamily) return entry.userFamily;
				if (entry.parser === "gndEdit") {
					if (entry.item.kind === "alignment") return gndSequenceForEntry(entry)?.family ?? "EL";
					if (entry.item.kind === "profile") return "EH";
					if (entry.item.kind === "cant") return "EU";
					if (entry.item.kind === "staEq") return "EK";
				}
				return "UNASSIGNED";
			}

			function familyForEntry(entry) {
				const sourceFamily = sourceFamilyForEntry(entry);
				return entry.userFamily && entry.userFamily !== sourceFamily
					? `${sourceFamily}→${entry.userFamily}`
					: sourceFamily;
			}

			function loadedHasFamily(loaded, family) {
				const names = [
					...(loaded?.sourceEnvelope?.inventory ?? []).map((table) => table?.name),
					...(loaded?.sourceEnvelope?.tables ?? []).map((table) => table?.name),
				].filter(Boolean);
				return names.some((name) => String(name).toUpperCase() === family || String(name).toUpperCase().endsWith(`_${family}`));
			}

			function refreshOrganizationGroups(fileGroup) {
				for (const familyGroup of fileGroup.querySelectorAll(".object-family-group")) {
					const title = familyGroup.querySelector(".object-group-title");
					const rowCount = familyGroup.querySelectorAll(":scope > .object-row").length;
					title.classList.toggle("empty", rowCount === 0);
					const count = title.querySelector(".family-count");
					if (count) count.textContent = rowCount ? String(rowCount) : "+";
				}
			}

			function assignOrganization(entry, targetGroup, row, targetScope, targetFrame = null) {
				einordnungGeaendert();
				const group = typeof targetGroup === "string"
					? { family: targetGroup, role: targetGroup }
					: targetGroup;
				const targetFamily = group.family;
				const targetRole = group.role ?? targetFamily;
				const compatible = targetFamily === "UNASSIGNED"
					|| entry.item.kind === group.kind
					|| (targetRole === "curvatureKilometer" && entry.item.kind === "staEq");
				if (!compatible) {
					status.classList.add("error");
					status.textContent = `${sourceFamilyForEntry(entry)} passt nicht in „${group.title}“.`;
					return false;
				}
				const sourceScope = row.closest(".organization-scope");
				entry.userFamily = targetFamily === "UNASSIGNED" ? null : targetFamily;
				entry.userLineRole = targetFamily === "UNASSIGNED" ? null : targetRole;
				if (targetFamily === "UNASSIGNED") entry.frameEdit = null;
				else if (targetFrame) entry.frameEdit = { ...targetFrame, direction: group.direction ?? targetFrame.direction, source: "user" };
				entry.organizationEdit = entry.userFamily ? {
					family: entry.userFamily,
					lineRole: entry.userLineRole,
					source: "user",
					originalFamily: sourceFamilyForEntry(entry),
				} : null;
				// A GND Nebengleis put into a Strecke, or taken out of it again.
				if (gndEigenstationiert(entry)) reconcileVermEsnStationing();
				const target = targetScope.querySelector(`.object-family-group[data-role="${sevenLineRole(entry)}"]`);
				target?.append(row);
				if (sourceScope) refreshOrganizationGroups(sourceScope);
				if (targetScope !== sourceScope) refreshOrganizationGroups(targetScope);
				refreshFileCrs(entry.loaded);
				status.classList.remove("error");
				return true;
			}

			function systemHeader(entry) {
				const { lsys, hsys } = systemsForEntry(entry);
				const displayLsys = effectiveLsys(entry);
				const classification = classifyLsys(displayLsys);
				const source = entry.loaded?.displayLsysSource === "manual" ? " (Anzeigezuordnung)" : "";
				return `Lage: ${classification.label}${displayLsys ? ` [${displayLsys}]` : ""}${source}    Höhe: ${hsysUserLabel(hsys)}${hsys ? ` [${hsys}]` : ""}`;
			}

			function sourceLsysValues(objects) {
				return [...new Set(objects
					.map((entry) => systemsForEntry(entry).lsys)
					.filter(Boolean)
					.map(normalizeLsys))];
			}

			function effectiveLsys(entry) {
				if (entry.displayLsys !== undefined) return normalizeLsys(entry.displayLsys);
				const sourceLsys = normalizeLsys(systemsForEntry(entry).lsys);
				if (sourceLsys && (entry.parser === "gndEdit" || entry.loaded?.sourceLsysMixed)) return sourceLsys;
				// A Gradiente/Überhöhung has no Lage of its own: it is the Trasse's.
				if (entry.item?.kind !== "alignment") {
					const anchor = relatedDiagramEntries(entry).anchor;
					if (anchor && anchor !== entry && anchor.item?.kind === "alignment") return effectiveLsys(anchor);
				}
				return normalizeLsys(entry.loaded?.displayLsys || sourceLsys);
			}

			function refreshFileCrs(loaded) {
				einordnungGeaendert();
				loaded.crsState.textContent = loaded.sourceLsysMixed
					? "objektweise erhalten"
					: classifyLsys(loaded.displayLsys).label;
				for (const entry of loaded.objects) {
					listingCache.delete(entry);
					mapGeometryCache.delete(entry);
					geometryModelCache.delete(entry);
					const kind = entry.button?.querySelector("[data-kind]");
					if (!kind) continue;
					const systems = systemsForEntry(entry);
					kind.textContent = entry.item.kind === "profile" || entry.item.kind === "cant"
						? `${familyForEntry(entry)}${systems.hsys ? ` · ${systems.hsys}` : ""}`
						: `${familyForEntry(entry)}${effectiveLsys(entry) ? ` · ${effectiveLsys(entry)}` : " · LSYS?"}`;
				}
				if (selectedEntry?.loaded === loaded) selectObject(selectedEntry, selectedEntry.button);
				if (activeMapMode === "crs") renderMap("crs");
			}

			function addFileCrsControl(group, loaded) {
				if (loaded.sourceLsysMixed) {
					const row = document.createElement("div");
					row.className = "file-crs";
					const label = document.createElement("span");
					label.textContent = `${loaded.sourceLsysList.length} LSYS aus GND`;
					const state = document.createElement("span");
					state.className = "crs-state";
					state.textContent = "objektweise erhalten";
					loaded.crsState = state;
					row.append(label, state);
					group.append(row);
					return;
				}
				const row = document.createElement("label");
				row.className = "file-crs";
				const select = document.createElement("select");
				select.setAttribute("aria-label", `LSYS für ${loaded.fileName}`);
				for (const [value, label] of CRS_OPTIONS) {
					const option = document.createElement("option");
					option.value = value;
					option.textContent = value === "" && loaded.sourceLsysMixed
						? "LSYS aus GND-Datei (gemischt)"
						: label;
					select.append(option);
				}
				if (loaded.sourceLsys && !CRS_OPTIONS.some(([value]) => value === loaded.sourceLsys)) {
					const option = document.createElement("option");
					option.value = loaded.sourceLsys;
					option.textContent = `${loaded.sourceLsys} · aus Datei`;
					select.append(option);
				}
				select.value = loaded.displayLsys;
				const state = document.createElement("span");
				state.className = "crs-state";
				loaded.crsState = state;
				select.addEventListener("change", () => {
					loaded.displayLsys = select.value;
					loaded.displayLsysSource = select.value === loaded.sourceLsys && loaded.sourceLsys ? "source" : "manual";
					refreshFileCrs(loaded);
				});
				row.append(select, state);
				group.append(row);
				refreshFileCrs(loaded);
			}

			function angleGon(value) {
				const number = numberValue(value);
				if (!Number.isFinite(number)) return NaN;
				const unit = value?.unit;
				if (unit === "radian") return number * 200 / Math.PI;
				if (unit === "degree") return number * 10 / 9;
				return number;
			}

			function elementDisplayType(element) {
				const explicit = element?.extras?.sourceSemantics?.typeLabel;
				if (explicit) return explicit;
				if (element?.type === "Line") return "Gerade";
				if (element?.type === "Curve") return "Kreis";
				if (element?.type === "Spiral") return element.spiType || "Klothoide";
				return element?.spiType ?? element?.type ?? "";
			}

			function alignmentListing(entry) {
				const cached = cacheFor(listingCache, entry).get("alignment");
				if (cached) return cached;
				const item = entry.item;
				const elements = item?.payload?.coordGeom?.elements ?? [];
				const gndSequence = gndSequenceForEntry(entry);
				// Two station columns when the file's own stations are not the km:
				// GND (äußere Referenz) and a Trasse projected onto a Kilometerlinie.
				const projected = Boolean(entry.externalStationReference) && elements.some((element) => elementKmStart(entry, element) != null);
				const twoColumns = Boolean(gndSequence) || projected;
				const stationLabel = gndSequence
					? "äußere Referenz"
					: projected ? "Kilometerlinie" : elements.some((element) => isKilometrierung(element.staStart)) ? "Kilometrierung" : "Stationierung";
				const lines = [
					`Trasse ${objectDisplayName(entry)}`,
					systemHeader(entry),
					"",
					twoColumns ? `${stationLabel.padStart(16)}    intern (Länge)              Y             X    Richtung       R1          R2       Länge  Element` : `${stationLabel.padStart(16)}              Y             X    Richtung       R1          R2       Länge  Element`,
					twoColumns ? "---------------------------------------------------------------------------------------------------------------------" : "--------------------------------------------------------------------------------------------------",
				];
				elements.forEach((element, index) => {
					const radius1 = element.radius ?? element.radiusStart;
					const radius2 = element.radius ?? element.radiusEnd;
					const direction = element.direction ?? element.dirStart;
					const type = elementDisplayType(element);
					lines.push(
						`${station(twoColumns ? elementKmStart(entry, element) ?? element.staStart : element.staStart)} ` +
						(twoColumns ? `${station(element.staStart)} ` : "") +
						`${fixed(element.start?.easting, 4, 13)} ` +
						`${fixed(element.start?.northing, 4, 13)} ` +
						`${fixed(angleGon(direction), 6, 11)} ` +
						`${fixed(radius1, 3, 11)} ` +
						`${fixed(radius2, 3, 11)} ` +
						`${fixed(element.length, 3, 10)}  ` +
						`${String(index + 1).padStart(4)} ${type}`
					);
				});
				if (!elements.length) lines.push("(keine horizontalen Elemente)");
				const result = lines.join("\n");
				cacheFor(listingCache, entry).set("alignment", result);
				return result;
			}

			function profileListing(entry) {
				const cached = cacheFor(listingCache, entry).get("profile");
				if (cached) return cached;
				const item = entry.item;
				const points = item?.payload?.points ?? [];
				const isGndProfile = entry.parser === "gndEdit";
				const projected = points.some((point) => pointKm(entry, point) != null);
				const twoColumns = isGndProfile || projected;
				const stationLabel = isGndProfile ? "äußere Referenz" : projected ? "Kilometerlinie" : points.some((point) => isKilometrierung(point.station))
					? "Kilometrierung"
					: "Stationierung";
				const lines = [
					`Gradiente ${objectDisplayName(entry)}`,
					systemHeader(entry),
					"",
					twoColumns ? ` Lfd.Nr.  ${stationLabel.padStart(16)}    intern (Länge)          Höhe        Radius         Tangente   Punkt` : ` Lfd.Nr.  ${stationLabel.padStart(16)}          Höhe        Radius         Tangente   Punkt`,
					twoColumns ? "---------------------------------------------------------------------------------------------------" : "----------------------------------------------------------------------------------",
				];
				points.forEach((point, index) => {
					const semantics = point?.extras?.sourceSemantics ?? {};
					const pointNumber = [semantics.pointKey, semantics.pointNumber]
						.filter((value) => value != null)
						.join(".");
					lines.push(
						`${String(index + 1).padStart(7)} ` +
						`${station(twoColumns ? pointKm(entry, point) ?? point.station : point.station)} ` +
						(twoColumns ? `${station(point.station)} ` : "") +
						`${fixed(point.elevation, 4, 13)} ` +
						`${fixed(semantics.radius ?? point.radius, 3, 13)} ` +
						`${fixed(semantics.tangentLength ?? point.tangentLength, 3, 16)}   ` +
						pointNumber
					);
				});
				if (!points.length) lines.push("(keine vertikalen Punkte)");
				// A GRA carries its Überhöhungsrampen behind the grade breaks; the
				// header counts both. They are no part of the Gradiente.
				const ramps = item?.payload?.extended?.cantRamps ?? [];
				const diagnostics = item?.payload?.extended?.graRecordDiagnostics ?? [];
				if (ramps.length) {
					lines.push("", ` Überhöhungsrampen (${ramps.length}, hinter den ${points.length} Gradientenpunkten laut Kopfsatz; keine Gradientenpunkte)`, `${"Rampenanfang".padStart(14)}  ${"Schnittpunkt".padStart(14)}  ${"Rampenende".padStart(14)}   Form   u1 [mm]   u2 [mm]`);
					ramps.forEach((ramp) => lines.push(`${station(ramp.rampEnd1Station)}  ${station(ramp.rampIntersectionStation)}  ${station(ramp.rampEnd2Station)}   ${String(ramp.rampCode ?? "").padStart(4)}   ${fixed(ramp.cant1Millimetres, 0, 7)}   ${fixed(ramp.cant2Millimetres, 0, 7)}`));
				}
				if (diagnostics.length) lines.push("", ` Kopfsatz und Satzzahl passen nicht zusammen (${diagnostics.map((diagnostic) => diagnostic.reason ?? diagnostic.code).join("; ")}); alle Sätze als Gradientenpunkte gelesen`);
				const result = lines.join("\n");
				cacheFor(listingCache, entry).set("profile", result);
				return result;
			}

			// BEGIN GND STATION SCALAR (test/technet-viewer-station.test.mjs runs this block)
			// GND writes a km as 1e8 + Hektometer·1e4 + Meter (100040060.908 =
			// km 0,4 + 60,908). Before the Strecke's zero point the number falls
			// below 1e8 and both parts turn negative: 99959928.04 is -4 hm and
			// -71.96 m, km -0,4 - 71,96 = -471,96 m. Reading that remainder as
			// plain metres (-40071.96) put WueTreu 5201 at km -60 with a 9,9 km
			// jump at every Hektometer; the Hektometer decode holds for both signs.
			function stationScalar(value) {
				const number = numberValue(value);
				if (!Number.isFinite(number)) return NaN;
				if (number < 99_000_000) return number;
				const rest = number - 100_000_000;
				const hectometres = Math.trunc(rest / 10_000);
				return hectometres * 100 + (rest - hectometres * 10_000);
			}
			// END GND STATION SCALAR

			// ---- The km of a station -------------------------------------------------
			// Three sources, in this order: what the delivery itself says (GND
			// carries an äußere Referenz on every element and point), the entry's
			// Abbildung onto its Kilometerlinie (entry.kmAbbildung: pairs of own
			// station and km, measured by the Stations-Abgleich for VermEsn and
			// landXML), and failing both the file's own station. The Abbildung
			// lives on the entry, not in the delivered points: the payload stays
			// what the file said, and taking a Gleis off a line is dropping the
			// Abbildung. Each returns undefined where neither source nor Abbildung
			// gives a km, so `?? own station` reads as it always did.
			function kmAbbildungPairs(entry) {
				return entry?.kmAbbildung?.pairs ?? null;
			}
			// The Abbildung onto a Kilometerlinie comes before a station the file
			// gives: only a Gleis whose own stations are not the Strecke's km is
			// ever put onto a line (a GND Nebengleis counted from its own start).
			function elementKmStart(entry, element) {
				const pairs = kmAbbildungPairs(entry);
				const source = element?.extras?.externalStation;
				if (source != null && !pairs) return source;
				return pairs ? mapLandXmlStation(pairs, numberValue(element?.staStart)) ?? undefined : undefined;
			}
			function elementKmEnd(entry, element) {
				const pairs = kmAbbildungPairs(entry);
				const source = element?.extras?.externalStationEnd;
				if (source != null && !pairs) return source;
				if (!pairs) return undefined;
				const localStart = numberValue(element?.staStart);
				const length = Math.abs(numberValue(element?.length));
				if (mapLandXmlStation(pairs, localStart) == null || !Number.isFinite(length)) return undefined;
				return mapLandXmlStation(pairs, localStart + length) ?? undefined;
			}
			function pointKm(entry, point) {
				const pairs = kmAbbildungPairs(entry);
				const source = point?.extras?.externalStation;
				if (source != null && !pairs) return source;
				return pairs ? mapLandXmlStation(pairs, numberValue(point?.station)) ?? undefined : undefined;
			}
			// An entry whose stations are shown in km that are not its own.
			function hasKmOfItsOwnOrMapped(entry) {
				if (kmAbbildungPairs(entry)) return true;
				return (entry?.item?.payload?.coordGeom?.elements ?? []).some((element) => element?.extras?.externalStation != null)
					|| (entry?.item?.payload?.points ?? []).some((point) => point?.extras?.externalStation != null);
			}

			function curvatureSeries(entry) {
				const points = [];
				for (const element of entry?.item?.payload?.coordGeom?.elements ?? []) {
					const externalStart = elementKmStart(entry, element);
					const externalEnd = elementKmEnd(entry, element);
					const s0 = stationScalar(externalStart ?? element.staStart);
					const length = Math.abs(numberValue(element.length));
					if (!Number.isFinite(s0) || !Number.isFinite(length)) continue;
					const s1 = Number.isFinite(stationScalar(externalEnd)) ? stationScalar(externalEnd) : s0 + length;
					const radiusStart = numberValue(element.radius ?? element.radiusStart);
					const radiusEnd = numberValue(element.radius ?? element.radiusEnd);
					const rotationSign = curveRotationSign(element);
					const k0 = element.type === "Line" || !Number.isFinite(radiusStart) || radiusStart === 0 ? 0 : rotationSign / radiusStart;
					const k1 = element.type === "Line" || !Number.isFinite(radiusEnd) || radiusEnd === 0 ? 0 : rotationSign / radiusEnd;
					// A Bloss or Helmert spiral bends its curvature; eight steps draw it.
					const shape = element.type === "Spiral" ? transitionShapeOf(element) : TRANSITION_SHAPES.clothoid;
					if (shape !== TRANSITION_SHAPES.clothoid) {
						for (let step = 0; step <= 8; step += 1) {
							const u = step / 8;
							points.push({ x: s0 + (s1 - s0) * u, y: k0 + (k1 - k0) * shape.k(u) });
						}
						continue;
					}
					points.push({ x: s0, y: k0 }, { x: s1, y: k1 });
				}
				return points;
			}

			// GND/TRA name their cant field "cant"/"value"/"superelevation"/"u";
			// landXML's <CantStation> instead uses "appliedCant" -- without it here,
			// every landXML-sourced cant point silently reads as zero points, even
			// when the source data has real values (confirmed against SCx_1720.xml).
			const CANT_VALUE_KEYS = ["cant", "value", "superelevation", "u", "appliedCant"];

			// Gradiente with its Ausrundungen: the GRA/GND points are the tangent
			// intersections (PVI) with a vertical radius or a tangent length;
			// between them the gradient is constant, around a PVI a parabola of
			// radius R over ±T, T = R |g2 − g1| / 2 (or T as delivered and R from
			// it), the small-angle arc AIM's vertical contract admits. Clamped to
			// half the distance to the neighbours; without R and T the PVI stays
			// the kink it was drawn as before.
			function profileSeries(entry, stationOf = (point) => stationScalar(pointKm(entry, point) ?? point.station ?? point.sta ?? point.s ?? point.chainage)) {
				const raw = (entry?.item?.payload?.points ?? []).map((point) => {
					const semantics = point?.extras?.sourceSemantics ?? {};
					const z = ["elevation", "height", "z"].map((key) => point?.[key]).find((value) => Number.isFinite(numberValue(value)));
					return { x: stationOf(point), z: numberValue(z), radius: Math.abs(numberValue(semantics.radius ?? point.radius)) || 0, tangent: Math.abs(numberValue(semantics.tangentLength ?? point.tangentLength)) || 0 };
				}).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z)).sort((a, b) => a.x - b.x);
				const points = [];
				for (let index = 0; index < raw.length; index += 1) {
					const pvi = raw[index];
					const prev = raw[index - 1];
					const next = raw[index + 1];
					if (!prev || !next || pvi.x <= prev.x || next.x <= pvi.x) { points.push({ x: pvi.x, y: pvi.z }); continue; }
					const g1 = (pvi.z - prev.z) / (pvi.x - prev.x);
					const g2 = (next.z - pvi.z) / (next.x - pvi.x);
					const dg = g2 - g1;
					let tangent = pvi.tangent > 0 ? pvi.tangent : pvi.radius > 0 ? pvi.radius * Math.abs(dg) / 2 : 0;
					tangent = Math.min(tangent, (pvi.x - prev.x) / 2, (next.x - pvi.x) / 2);
					if (!(tangent > 0.05) || Math.abs(dg) < 1e-9) { points.push({ x: pvi.x, y: pvi.z }); continue; }
					const sA = pvi.x - tangent;
					const zA = pvi.z - g1 * tangent;
					const steps = Math.max(4, Math.min(24, Math.ceil(2 * tangent / 5)));
					for (let step = 0; step <= steps; step += 1) {
						const d = 2 * tangent * step / steps;
						points.push({ x: sA + d, y: zA + g1 * d + dg * d * d / (4 * tangent) });
					}
				}
				return points;
			}
			function pointSeries(entry, valueKeys) {
				const points = entry?.item?.payload?.points ?? [];
				return points.map((point) => {
					const x = stationScalar(pointKm(entry, point) ?? point.station ?? point.sta ?? point.s ?? point.chainage);
					const raw = valueKeys.map((key) => point?.[key]).find((value) => Number.isFinite(numberValue(value)));
					return { x, y: numberValue(raw) };
				}).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
			}
			// Cant in millimetres, whatever the source stored. GND (X_ASC23_EU)
			// delivers appliedCant as {value: 0.055, unit: "meter"}; TRA/GRA-derived
			// cant and hand-typed 7L groups may carry plain numbers in mm. Until
			// this existed, the cant band was labelled [mm] but plotted 0.055, the
			// speed formula added 130 mm to 0.055 (so "zul. v" was computed as if
			// u = 0: r 2404 m, u 55 mm showed 160 instead of 190 km/h) and the IVHW
			// Schiene B sat 0.055 mm above Schiene A. This is Main (interpretation
			// of a unit the source declares), the unit-less fallback is the one
			// heuristic: no real cant is below 1 mm, every metre-valued one is.
			function cantMillimetres(raw) {
				const value = numberValue(raw);
				if (!Number.isFinite(value)) return NaN;
				const unit = raw && typeof raw === "object" ? String(raw.unit ?? "").toLowerCase() : "";
				if (unit === "meter" || unit === "metre" || unit === "m") return value * 1000;
				if (unit === "millimeter" || unit === "millimetre" || unit === "mm") return value;
				return Math.abs(value) < 1 ? value * 1000 : value;
			}
			function cantSeriesMm(entry) {
				const points = entry?.item?.payload?.points ?? [];
				return points.map((point) => {
					const x = stationScalar(pointKm(entry, point) ?? point.station ?? point.sta ?? point.s ?? point.chainage);
					const raw = CANT_VALUE_KEYS.map((key) => point?.[key]).find((value) => Number.isFinite(numberValue(value)));
					return { x, y: cantMillimetres(raw) };
				}).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
			}
			// The Überhöhungsrampen a GRA carries behind its Gradientenpunkte ride
			// on the profile item (payload.extended.cantRamps). Their stations are
			// the GRA's own; when the profile's points were projected onto a
			// Kilometerlinie (the profile's kmAbbildung), the Rampen follow the same
			// mapping, interpolated over the points.
			function graCantRamps(profileEntry) {
				const ramps = profileEntry?.item?.payload?.extended?.cantRamps;
				return Array.isArray(ramps) ? ramps : [];
			}
			function profileStationMapper(profileEntry) {
				const pairs = (profileEntry?.item?.payload?.points ?? [])
					.map((point) => ({ local: stationScalar(point.station ?? point.sta ?? point.s ?? point.chainage), external: stationScalar(pointKm(profileEntry, point)) }))
					.filter((pair) => Number.isFinite(pair.local) && Number.isFinite(pair.external))
					.sort((a, b) => a.local - b.local);
				if (pairs.length < 2) return (value) => value;
				return (value) => mapLandXmlStation(pairs, value) ?? value;
			}

			// The Eifel delivery marks one file of a pair with a trailing "_A"
			// (2631R139_Philippsheimer..._DBREF03.TRA with ..._DBREF03_A.GRA,
			// Gleis2_Bf_Auw_..._DBREF03.GRA with ..._DBREF03_A.TRA): the suffix
			// does not take part in the pairing. Assumed from the delivery, not
			// a VermEsn rule; no sample has X and X_A as two different objects.
			function vermEsnFileStem(fileName) {
				return String(fileName ?? "").replace(/(?:_a)?\.(tra|gra)$/i, "").toLowerCase();
			}

			// BEGIN VERMESN NAME CONVENTIONS (test/technet-viewer-names.test.mjs runs this block)
			// VermEsn-Bündelung nach 7L: a TRA/GRA file carries no Strecke and no
			// side of its own, but the delivery names it. Each delivery has its
			// own convention, and this table is the one place that knows them;
			// a new delivery is a new entry, and the test names every file of the
			// known deliveries with the frame it must yield. The frame is labelled
			// source "vermesn-name"; a user assignment (frameEdit) wins over it.
			//
			// Landshut: "5500S074-082" -- Strecke 5500, S = Streckenkilometrierung
			// (Kilometerlinie), R = Richtungsgleis (rechts), L = Gegenrichtungsgleis
			// (links), 074-082 the km-Abschnitt; "_Gls403" a Bahnhofsgleis stationed
			// on that Strecke (side unknown, stays in the Inbox for the user).
			// "Gls401", "W403-404", "Abzw-li_DKW503" name no Strecke: singletons.
			// Eifel: "2631K139_Bestand_VR_DBREF03" -- K = Kilometerlinie (the one
			// file with the Stationsgleichungen), R/L as above, 139 the km where
			// the Abschnitt begins, the rest a description (Bestand, a Neuplanung
			// variant, a trailing "_A"); several variants of one side share a 7L
			// lane. "Gleis2_Bf_Auw_Bestand_VR_DBREF03" is a Bahnhofsgleis of a named
			// Bahnhof with no Strecke in the name: framed by the Bahnhof.
			// Tolerated spellings, not observed: an optional "Str"/"Strecke" before
			// the number and "-", "_" or a space between number, letter and km.
			// A suffix is a Bahnhofsgleis only when it starts with "Gls"; any other
			// suffix is the variant and leaves the side as the letter says.
			const VERMESN_NAME_CONVENTIONS = [
				{
					id: "strecke",
					label: "Strecke-Seite-km (Landshut 5500S074-082, Eifel 2631K139_…)",
					pattern: /^(?:str(?:ecke)?[-_ ]?)?(\d{4})[-_ ]?([KLRS])[-_ ]?(\d{3})?(?:-(\d{3}))?(?:_(.+))?$/i,
					frame: (match) => {
						const [, track, letter, from, to, suffix] = match;
						const gleis = suffix && /^gls/i.test(suffix) ? suffix : null;
						const side = gleis ? "unknown" : { s: "kilometer", k: "kilometer", r: "right", l: "left" }[letter.toLowerCase()];
						return { track, side, segment: from ? `${from}${to ? `-${to}` : ""}` : null, gleis, variant: gleis ? null : suffix ?? null };
					},
				},
				{
					// metroB: "5904067R" -- Strecke 5904, the km where the Abschnitt
					// begins (067), then the letter; a suffix names the Lagesystem or
					// a variant ("5904072S_ER0", "5904080R_O00_lokal"). Read from the
					// delivery: 5904067S.TRA runs km 67,4-72,2, 5904072S_ER0.TRA km
					// 72,0-90,3. The same parts as the first convention, km and letter
					// the other way round.
					id: "strecke-km-seite",
					label: "Strecke-km-Seite (metroB 5904067R, 5904072S_ER0)",
					pattern: /^(\d{4})(\d{3})([KLRS])(?:[-_ ](.+))?$/i,
					frame: (match) => {
						const [, track, from, letter, suffix] = match;
						return { track, side: { s: "kilometer", k: "kilometer", r: "right", l: "left" }[letter.toLowerCase()], segment: from, gleis: null, variant: suffix ?? null };
					},
				},
				{
					id: "bahnhofsgleis",
					label: "Bahnhofsgleis (Eifel Gleis2_Bf_Auw_…)",
					pattern: /^Gleis[-_ ]?(\d+)[-_ ]?Bf[-_ ]?([^_]+)(?:_(.+))?$/i,
					frame: (match) => {
						const [, gleis, name, variant] = match;
						return { track: `Bf ${name}`, side: "unknown", segment: null, gleis, variant: variant ?? null };
					},
				},
			];
			function vermEsnNameFrameOf(fileName) {
				const stem = String(fileName ?? "").replace(/\.(tra|gra)$/i, "");
				for (const convention of VERMESN_NAME_CONVENTIONS) {
					const match = convention.pattern.exec(stem);
					if (match) return { ...convention.frame(match), convention: convention.id };
				}
				return null;
			}
			// END VERMESN NAME CONVENTIONS
			function vermEsnNameFrame(entry) {
				if (entry?.parser !== "vermEsn") return null;
				return vermEsnNameFrameOf(entry.loaded?.fileName);
			}
			
			// VermEsn TRA/GRA pairs are delivered as separate files (unlike GND-Edit,
			// where PAD identity joins alignment/profile/cant within one MDB) and each
			// upload is parsed and related in isolation -- so a TRA's own stationReference
			// relations never mention its GRA counterpart. Bridge that gap purely by
			// filename stem (Gls401.TRA <-> Gls401.GRA): this is a physical-file fact,
			// independent of whatever 7L role the user later assigns either side.
			function stemPairedRelations() {
				const byStem = new Map();
				for (const loaded of loadedFiles) {
					if (loaded.objects[0]?.parser !== "vermEsn") continue;
					const stem = vermEsnFileStem(loaded.fileName);
					if (!byStem.has(stem)) byStem.set(stem, []);
					byStem.get(stem).push(loaded);
				}
				const relations = [];
				for (const files of byStem.values()) {
					if (files.length < 2) continue;
					const objects = files.flatMap((loaded) => loaded.objects);
					const alignments = objects.filter((entry) => entry.item.kind === "alignment");
					const profiles = objects.filter((entry) => entry.item.kind === "profile");
					for (const alignment of alignments) {
						for (const profile of profiles) {
							relations.push({ type: "stationReference", fromId: profile.item.id, toId: alignment.item.id, reason: "vermesn_filename_stem_pairing" });
						}
					}
				}
				return relations;
			}

			// What hangs together with an entry by references: its Trasse as the
			// anchor and the whole Verbund (einordnungVerbund), read from the
			// Bezüge. A landXML Gleis references its Kilometerlinie and the other
			// Gleis references the same line, so one Gleis shows the whole 7L;
			// GND and VermEsn references are one hop. Resolved per file, never by
			// an id across files.
			function relatedDiagramEntries(entry) {
				if (!entry?.loaded) return { anchor: entry, entries: [entry] };
				const bezuege = einordnungBezuegeStand();
				const key = einordnungKey(entry);
				if (!bezuege.model.objects.has(key)) return { anchor: entry, entries: [entry] };
				const verbund = einordnungVerbund(bezuege.model, key);
				return {
					anchor: bezuege.entries.get(verbund.anchor.key) ?? entry,
					entries: verbund.keys.map((candidateKey) => bezuege.entries.get(candidateKey)).filter(Boolean),
				};
			}

			// Objects that reference `alignment` directly (its own profile, cant,
			// staEq) -- not the transitive 7L closure, which since the km-line root
			// also holds the other Gleis's objects.
			function referencingEntries(alignment) {
				const bezuege = einordnungBezuegeStand();
				return (bezuege.model.referrers.get(einordnungKey(alignment)) ?? []).map((key) => bezuege.entries.get(key)).filter(Boolean);
			}
			// BEGIN LAGE WITNESS (test/technet-viewer-lage.test.mjs runs this block)
			// The Lage as a witness of its own. A name or an attribute says which
			// side a Gleis is on; the coordinates say where it lies -- which side
			// of a Kilometerlinie, how far off, beside which km. The two are
			// independent, so where both speak they confirm or contradict each
			// other, and where the name is silent the Lage still answers. It
			// answers a position, not a role: 8 m to the right of the
			// Kilometerlinie is a fact, "rechtes Streckengleis" is not (measured
			// over nine deliveries: declared Streckengleise lie 2 m off, but also
			// 5, 10 and 20 m; undeclared Gleise 2 m off are Weichenstraßen as often
			// as Streckengleise).
			// Reach: a Bahnhof's width, the same as the topology's km.
			const LAGE_REACH_M = 60;
			// Closer than this a sample sits on the line itself (single track:
			// the Kilometerlinie is the Gleis).
			const LAGE_ON_AXIS_M = 0.5;
			// A Gleis lies "beside" a Kilometerlinie when this share of its
			// samples finds the line within reach, away from the line's ends.
			const LAGE_MIN_COVERAGE = 0.6;
			// It lies on one side when this share of its samples off the axis
			// agrees. Not all: a TRA that restarts its stations folds the line
			// back for one sample (Billwerder 6100 LI, 1 of 9).
			const LAGE_MAJORITY = 0.85;
			// Segments are looked up through a grid of cells at least as wide as
			// the reach, so a sample only meets the segments around it (310
			// Gleise against 55 Kilometerlinien took 3,4 s without it).
			const LAGE_CELL_M = 64;
			function lageGrid(polyline) {
				const cells = new Map();
				for (let index = 0; index + 1 < polyline.length; index += 1) {
					const a = polyline[index];
					const b = polyline[index + 1];
					const x0 = Math.floor(Math.min(a.easting, b.easting) / LAGE_CELL_M);
					const x1 = Math.floor(Math.max(a.easting, b.easting) / LAGE_CELL_M);
					const y0 = Math.floor(Math.min(a.northing, b.northing) / LAGE_CELL_M);
					const y1 = Math.floor(Math.max(a.northing, b.northing) / LAGE_CELL_M);
					for (let x = x0; x <= x1; x += 1) {
						for (let y = y0; y <= y1; y += 1) {
							const key = `${x},${y}`;
							const cell = cells.get(key);
							if (cell) cell.push(index);
							else cells.set(key, [index]);
						}
					}
				}
				return cells;
			}
			function lageBounds(polyline) {
				const bounds = { minE: Infinity, maxE: -Infinity, minN: Infinity, maxN: -Infinity };
				for (const point of polyline) {
					if (point.easting < bounds.minE) bounds.minE = point.easting;
					if (point.easting > bounds.maxE) bounds.maxE = point.easting;
					if (point.northing < bounds.minN) bounds.minN = point.northing;
					if (point.northing > bounds.maxN) bounds.maxN = point.northing;
				}
				return bounds;
			}
			// Nearest point of the line: distance, station there, and the side in
			// the direction of rising station (+1 left, -1 right). atEnd: the
			// point lies past an end of the line (square to the end itself it is
			// still beside it -- two pieces of one Kilometerlinie meet there).
			// With a grid only the segments within reach are looked at; a point
			// farther away than the reach then finds nothing.
			// reach: how far a segment may lie to be looked at through the grid --
			// the ring of cells follows it. One ring (the standard) reaches 64 m
			// for certain; a wider reach looked at through one ring found nothing
			// beyond it (150 m and 250 m gave the same as 100 m).
			function lageOffset(polyline, point, grid = null, reach = LAGE_REACH_M) {
				let indices = null;
				if (grid) {
					indices = [];
					const cx = Math.floor(point.easting / LAGE_CELL_M);
					const cy = Math.floor(point.northing / LAGE_CELL_M);
					const ring = Math.max(1, Math.ceil(reach / LAGE_CELL_M));
					for (let x = cx - ring; x <= cx + ring; x += 1) {
						for (let y = cy - ring; y <= cy + ring; y += 1) {
							const cell = grid.get(`${x},${y}`);
							if (cell) for (const index of cell) indices.push(index);
						}
					}
				}
				let best = null;
				const count = indices ? indices.length : polyline.length - 1;
				for (let step = 0; step < count; step += 1) {
					const index = indices ? indices[step] : step;
					const a = polyline[index];
					const b = polyline[index + 1];
					const dx = b.easting - a.easting;
					const dy = b.northing - a.northing;
					const lengthSq = dx * dx + dy * dy;
					if (lengthSq <= 1e-9) continue;
					const along = ((point.easting - a.easting) * dx + (point.northing - a.northing) * dy) / lengthSq;
					const t = Math.max(0, Math.min(1, along));
					const distance = Math.hypot(point.easting - (a.easting + t * dx), point.northing - (a.northing + t * dy));
					if (best && distance >= best.distance) continue;
					const cross = dx * (point.northing - a.northing) - dy * (point.easting - a.easting);
					best = {
						distance,
						station: a.station + t * (b.station - a.station),
						side: (cross >= 0 ? 1 : -1) * (b.station >= a.station ? 1 : -1),
						atEnd: (index === 0 && along < 0) || (index === polyline.length - 2 && along > 1),
					};
				}
				return best;
			}
			// axes: [{ route, polyline, bounds }] (a grid is added on first use), several pieces of one
			// Kilometerlinie share a route. The Gleis's own route wins as the
			// reference, otherwise the nearest line that covers it. preferredRoute:
			// that route, or a test for it (route) => boolean where several lines
			// are the Gleis's own (the lines of its Strecke); the nearest of them
			// wins.
			function lageWitnessOf(gleisPolyline, axes, preferredRoute = "", reach = LAGE_REACH_M) {
				if (!gleisPolyline || gleisPolyline.length < 2) return null;
				const isPreferred = typeof preferredRoute === "function" ? (route) => Boolean(preferredRoute(route)) : (route) => Boolean(preferredRoute) && route === preferredRoute;
				const samples = Math.max(9, Math.min(25, Math.round(gleisPolyline.length / 4)));
				const byRoute = new Map();
				for (let index = 0; index < samples; index += 1) {
					const point = gleisPolyline[Math.round((index + 0.5) / samples * (gleisPolyline.length - 1))];
					const nearest = new Map();
					for (const axis of axes) {
						const bounds = axis.bounds;
						if (point.easting < bounds.minE - reach || point.easting > bounds.maxE + reach || point.northing < bounds.minN - reach || point.northing > bounds.maxN + reach) continue;
						axis.grid ??= lageGrid(axis.polyline);
						const hit = lageOffset(axis.polyline, point, axis.grid, reach);
						if (!hit || hit.atEnd || hit.distance > reach) continue;
						const known = nearest.get(axis.route);
						if (!known || hit.distance < known.distance) nearest.set(axis.route, hit);
					}
					for (const [route, hit] of nearest) {
						if (!byRoute.has(route)) byRoute.set(route, []);
						byRoute.get(route).push(hit);
					}
				}
				const needed = Math.ceil(samples * LAGE_MIN_COVERAGE);
				let chosen = null;
				const candidates = [];
				for (const [route, hits] of byRoute) {
					if (hits.length < needed) continue;
					const distances = hits.map((hit) => hit.distance).sort((a, b) => a - b);
					const candidate = { route, hits, median: distances[Math.floor(distances.length / 2)], min: distances[0], max: distances[distances.length - 1] };
					candidates.push(candidate);
					const preferred = isPreferred(route);
					const chosenPreferred = Boolean(chosen) && isPreferred(chosen.route);
					if (!chosen || (preferred && !chosenPreferred) || (preferred === chosenPreferred && candidate.median < chosen.median)) chosen = candidate;
				}
				if (!chosen) return { verdict: "none", samples };
				const offAxis = chosen.hits.filter((hit) => hit.distance >= LAGE_ON_AXIS_M);
				const left = offAxis.filter((hit) => hit.side > 0).length;
				const right = offAxis.length - left;
				// On the line as long as most samples are: a Neuplanung that leaves
				// its Kilometerlinie by 1,5 m for a stretch is still the Gleis the
				// line runs on (Eifel 2631 R, declared rechts), not one beside it.
				const verdict = chosen.median < LAGE_ON_AXIS_M ? "axis"
					: left >= offAxis.length * LAGE_MAJORITY ? "left"
					: right >= offAxis.length * LAGE_MAJORITY ? "right"
					: "crossing";
				const stations = chosen.hits.map((hit) => hit.station);
				return {
					verdict,
					route: chosen.route,
					samples,
					hits: chosen.hits.length,
					median: chosen.median,
					min: chosen.min,
					max: chosen.max,
					stationFrom: Math.min(...stations),
					stationTo: Math.max(...stations),
					// eigen: the line is the Gleis's own route, not the nearest by
					// measure. weitere: the other Kilometerlinien it lies beside, the
					// fullest first, then the nearest.
					eigen: isPreferred(chosen.route),
					weitere: candidates.filter((candidate) => candidate !== chosen)
						.sort((a, b) => b.hits.length - a.hits.length || a.median - b.median)
						.map((candidate) => ({ route: candidate.route, hits: candidate.hits.length, median: candidate.median })),
				};
			}
			// The nearest Kilometerlinie is the proposal; it is in doubt where the
			// Gleis lies beside it only in part and beside another from end to
			// end (Landshut Gls401v: 12 of 19 samples at 9 m beside 5634, all 19
			// at 27 m beside 5500). That other line, the nearest of them; null
			// where the line is the Gleis's own or covers it entirely. Measured
			// over nine deliveries a rule "entire beats part" would move ten
			// Gleise, among them one that lies 96 % at 11 m beside its line: so
			// this names the other line and leaves the choice to the user.
			// One sample missing is the grain of the measure (9 to 25 samples:
			// the Gleis passes the line's end by less than a sample's spacing,
			// that Gls410 with 24 of 25), not a doubt; two are.
			const LAGE_ZWEIFEL_MIN_FEHLEND = 2;
			function lageGanzDaneben(lage, minFehlend = LAGE_ZWEIFEL_MIN_FEHLEND) {
				if (!lage || !lage.route || lage.eigen || !(lage.samples - lage.hits >= minFehlend)) return null;
				return (lage.weitere ?? []).filter((candidate) => candidate.hits === lage.samples).sort((a, b) => a.median - b.median)[0] ?? null;
			}
			// The choice a proposal has: the Kilometerlinien the Gleis lies
			// beside, the nearest first, one per Strecke (streckeVon: two lines
			// of one Strecke are no choice of Strecke; metroB 5810 S and R). ganz:
			// the line of another Strecke it lies beside from end to end where it
			// lies beside the nearest only in part (zweifel) -- unless another
			// piece of the nearest's own Strecke covers it entirely. null where
			// one Strecke is in reach, or the line is the Gleis's own.
			function lageLinienwahl(lage, streckeVon = (route) => route, minFehlend = LAGE_ZWEIFEL_MIN_FEHLEND) {
				if (!lage?.route || lage.eigen || !lage.weitere?.length) return null;
				const seen = new Set();
				const linien = [{ route: lage.route, hits: lage.hits, median: lage.median }, ...lage.weitere].filter((linie) => {
					const strecke = streckeVon(linie.route);
					if (seen.has(strecke)) return false;
					seen.add(strecke);
					return true;
				});
				if (linien.length < 2) return null;
				const eigene = streckeVon(lage.route);
				const offen = Boolean(lageGanzDaneben(lage, minFehlend)) && !lage.weitere.some((linie) => linie.hits === lage.samples && streckeVon(linie.route) === eigene);
				const ganz = offen ? linien.slice(1).filter((linie) => linie.hits === lage.samples).sort((a, b) => a.median - b.median)[0] ?? null : null;
				return { linien, samples: lage.samples, naechste: lage.route, ganz: ganz?.route ?? null, zweifel: Boolean(ganz) };
			}
			// How far one line runs from another: the distances of its samples
			// that find the other within reach, away from the other's ends.
			// hits 0: nothing of it lies beside the other. other: { polyline }
			// (a grid is added on first use).
			function lageAbstandOf(polyline, other, reach = LAGE_REACH_M) {
				if (!polyline || polyline.length < 2 || !other?.polyline || other.polyline.length < 2) return null;
				other.grid ??= lageGrid(other.polyline);
				const samples = Math.max(9, Math.min(25, Math.round(polyline.length / 4)));
				const distances = [];
				for (let index = 0; index < samples; index += 1) {
					const hit = lageOffset(other.polyline, polyline[Math.round((index + 0.5) / samples * (polyline.length - 1))], other.grid, reach);
					if (hit && !hit.atEnd && hit.distance <= reach) distances.push(hit.distance);
				}
				if (!distances.length) return { samples, hits: 0 };
				distances.sort((a, b) => a - b);
				return { samples, hits: distances.length, median: distances[Math.floor(distances.length / 2)], min: distances[0], max: distances[distances.length - 1] };
			}
			// Where one line runs beside another, along the other's stations:
			// one point per point of the line that finds the other within reach
			// and away from its ends -- x the station there, y the distance,
			// left of the rising stations +. Where the line finds nothing the
			// series breaks (gap), so a Gleis that leaves and comes back is two
			// pieces, not a line through the air.
			function lageAbstandReihe(polyline, other) {
				if (!polyline || polyline.length < 2 || !other?.polyline || other.polyline.length < 2) return [];
				other.grid ??= lageGrid(other.polyline);
				const points = [];
				let open = false;
				for (const point of polyline) {
					const hit = lageOffset(other.polyline, point, other.grid);
					if (!hit || hit.atEnd || hit.distance > LAGE_REACH_M) { open = false; continue; }
					points.push({ x: hit.station, y: Math.round(hit.side * hit.distance * 1000) / 1000, ...(open ? {} : { gap: true }) });
					open = true;
				}
				return points;
			}
			// What two witnesses make of a Gleisseite. belegt: declared and Lage
			// agree. widerspruch: they name opposite sides. erklaert: only the
			// declaration speaks (no Kilometerlinie in reach, or the Gleis lies on
			// it or crosses it). lage: only the Lage speaks. offen: neither.
			function sideGradeOf(declaredSideValue, lage) {
				const verdict = lage?.verdict ?? "none";
				if (declaredSideValue === "left" || declaredSideValue === "right") {
					if (verdict === declaredSideValue) return "belegt";
					if (verdict === "left" || verdict === "right") return "widerspruch";
					return "erklaert";
				}
				return verdict === "none" ? "offen" : "lage";
			}
			// END LAGE WITNESS

			// The Kilometerlinien as reference axes, and each Gleis's witness, kept
			// while the loaded objects, their Lagesystem and the set of
			// Kilometerlinien stay the same. The key is taken once per run of
			// rendering (a microtask), not per Gleis.
			// A Trasse no attribute declares, whose file name says Kilometerlinie
			// ("Ka_5810S_km-0.2_2.5"): what the Sortiervorschlag offers as "die
			// Kilometerlinie laut Name". It is measured against like a declared
			// one, so the proposals for the Gleise beside it do not depend on the
			// order in which the user takes them over (metroB: the Gleise of 5810
			// went to 5800 when its line was sorted in first).
			function nameSagtKilometerlinie(entry) {
				return entry?.item?.kind === "alignment" && entry.parser === "vermEsn" && declaredSide(entry).side === "unknown" && einordnungNamensteile(entry.loaded?.fileName ?? "").side === "s";
			}
			let lageCache = { key: null, axes: [], byEntry: new Map() };
			let lageKeyMemo = null;
			function lageState() {
				if (lageKeyMemo == null) {
					lageKeyMemo = allViewerEntries()
						.filter((entry) => entry.item.kind === "alignment")
						.map((entry) => `${entry.item.id}:${effectiveLsys(entry) || ""}:${sevenLineSide(entry) === "kilometer" ? "km" : nameSagtKilometerlinie(entry) ? "name" : ""}:${routeForEntry(entry)}`)
						.join("|");
					queueMicrotask(() => { lageKeyMemo = null; });
				}
				if (lageCache.key !== lageKeyMemo) {
					const axes = allViewerEntries()
						.filter((entry) => entry.item.kind === "alignment" && alignmentEndpoints(entry) && (sevenLineSide(entry) === "kilometer" || nameSagtKilometerlinie(entry)))
						.map((entry) => {
							const polyline = referenceStationPolyline(entry, 10);
							return { entry, lsys: effectiveLsys(entry) || "", route: routeForEntry(entry) || objectDisplayName(entry), polyline, bounds: lageBounds(polyline) };
						})
						.filter((axis) => axis.polyline.length > 1);
					lageCache = { key: lageKeyMemo, axes, byEntry: new Map() };
				}
				return lageCache;
			}
			// The Strecke of a Kilometerlinie's route: the number itself, or the
			// one its name states ("1150_160-161_DBREF2016_KM" -> 1150).
			function kilometerlinieStrecke(route) {
				const name = String(route ?? "");
				return einordnungStreckennummer(name) ? name : einordnungStreckeAusName(name) || name;
			}
			// Coordinates of two Lagesysteme are not comparable, so a Gleis is
			// only measured against Kilometerlinien of its own system. Its own
			// are the lines of its Strecke, whether they carry the number or a
			// name that states it: sorted into 1150 by hand, a Gleis is measured
			// beside "1150_160-161_DBREF2016_KM", not beside a nearer line of
			// another Strecke.
			function lageWitness(entry) {
				if (entry?.item?.kind !== "alignment" || !alignmentEndpoints(entry) || sevenLineSide(entry) === "kilometer") return null;
				const state = lageState();
				if (!state.byEntry.has(entry)) {
					const lsys = effectiveLsys(entry) || "";
					const axes = state.axes.filter((axis) => axis.entry !== entry && axis.lsys === lsys);
					const own = routeForEntry(entry);
					state.byEntry.set(entry, axes.length ? lageWitnessOf(referenceStationPolyline(entry, 10), axes, own ? (route) => route === own || kilometerlinieStrecke(route) === own : "", ordnungAnnahmen.reichweite) : { verdict: "none", samples: 0 });
				}
				return state.byEntry.get(entry);
			}
			// The Kilometerlinie the user picked for a Gleis's Sortiervorschlag
			// instead of the nearest one (entry -> route). A choice inside the
			// proposal: nothing is assigned until the user takes it over.
			const vorschlagLinie = new Map();
			// The choice a Gleis's proposal has (lageLinienwahl) and the line that
			// stands: the one the user picked, otherwise the nearest.
			function vorschlagLinienwahl(entry) {
				const wahl = lageLinienwahl(lageWitness(entry), kilometerlinieStrecke, ordnungAnnahmen.zweifel);
				if (!wahl) return null;
				const picked = vorschlagLinie.get(entry);
				return { ...wahl, gewaehlt: wahl.linien.some((linie) => linie.route === picked) ? picked : wahl.naechste };
			}
			// The witness the proposal goes by: beside the line the user picked,
			// otherwise the nearest.
			function lageWitnessVorschlag(entry) {
				const lage = lageWitness(entry);
				const wahl = vorschlagLinienwahl(entry);
				if (!wahl || wahl.gewaehlt === wahl.naechste) return lage;
				const lsys = effectiveLsys(entry) || "";
				const axes = lageState().axes.filter((axis) => axis.entry !== entry && axis.lsys === lsys);
				return lageWitnessOf(referenceStationPolyline(entry, 10), axes, wahl.gewaehlt, ordnungAnnahmen.reichweite) ?? lage;
			}
			// The Gleisseite of an object with its witnesses; a Gradiente or
			// Überhöhung speaks through its Gleis. null for a Kilometerlinie.
			function sideEvidence(entry) {
				const alignment = entry?.item?.kind === "alignment" ? entry : entry?.loaded ? relatedDiagramEntries(entry).anchor : null;
				if (alignment?.item?.kind !== "alignment") return null;
				const declared = declaredSide(alignment);
				if (declared.side === "kilometer") return null;
				const lage = lageWitness(alignment);
				return { alignment, declared, lage, grade: sideGradeOf(declared.side, lage) };
			}
			const SIDE_WORDS = { left: "links", right: "rechts" };
			function lageMeters(value) {
				return value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
			}
			// "8,3 m rechts der Kilometerlinie 5500", "auf der Kilometerlinie 5500",
			// "kreuzt die Kilometerlinie 5500"; without the line ("8,3 m rechts")
			// where a band label has no room and the note beside it names it.
			function lagePositionText(lage, { line = true } = {}) {
				if (!lage || lage.verdict === "none") return "";
				const name = line ? ` ${lage.route}` : "";
				if (lage.verdict === "axis") return `auf der Kilometerlinie${name}`;
				if (lage.verdict === "crossing") return `kreuzt die Kilometerlinie${name}`;
				return `${lageMeters(lage.median)} m ${SIDE_WORDS[lage.verdict]}${line ? ` der Kilometerlinie${name}` : ""}`;
			}
			// The same for a narrow column: "8,3 m rechts von 5500".
			function lageCompactText(lage) {
				if (!lage || lage.verdict === "none") return "";
				if (lage.verdict === "axis") return `auf ${lage.route}`;
				if (lage.verdict === "crossing") return `kreuzt ${lage.route}`;
				return `${lageMeters(lage.median)} m ${SIDE_WORDS[lage.verdict]} von ${lage.route}`;
			}
			// What a 7L says about its Gleisseiten: a contradiction first, then
			// the Gleise without a declared side (placed by the Lage, or open),
			// then how far the declared sides are confirmed.
			function sevenLineSideNote(assignment) {
				const gleise = (side) => assignment.bySide[side].filter((candidate) => candidate.item.kind === "alignment");
				const declared = [...gleise("right"), ...gleise("left")].map(sideEvidence).filter(Boolean);
				const conflict = declared.find((evidence) => evidence.grade === "widerspruch");
				const undeclared = gleise("unknown").map(sideEvidence).filter(Boolean);
				const placed = undeclared.filter((evidence) => evidence.grade === "lage");
				const confirmedCount = declared.filter((evidence) => evidence.grade === "belegt").length;
				return {
					// No Streckengleis and no Kilometerlinie among them: a Gleis of
					// its own, not an incomplete 7L.
					standalone: !declared.length && !gleise("kilometer").length,
					conflict: conflict ? `Gleisseite widersprüchlich: ${objectListName(conflict.alignment)} ist ${SIDE_WORDS[conflict.declared.side]} erklärt (${conflict.declared.source}), liegt aber ${lagePositionText(conflict.lage)}` : null,
					open: undeclared.length - placed.length,
					placed: placed.length === 1 ? `${objectListName(placed[0].alignment)} ohne Streckenrolle, ${lagePositionText(placed[0].lage)}`
						: placed.length ? `${placed.length} Gleise ohne Streckenrolle, nach Lage eingeordnet`
						: null,
					confirmed: !declared.length ? null
						: confirmedCount === declared.length ? `Gleisseite${declared.length > 1 ? "n" : ""} durch die Lage belegt`
						: confirmedCount ? `Gleisseite bei ${confirmedCount} von ${declared.length} Gleisen durch die Lage belegt`
						: declared.every((evidence) => evidence.lage?.verdict === "axis") ? "Gleis liegt auf der Kilometerlinie"
						: "Gleisseite nur erklärt, von der Lage nicht belegt",
				};
			}
			function lageDetailText(lage) {
				if (!lage || lage.verdict === "none") return `keine Kilometerlinie desselben Lagesystems in ${ordnungAnnahmen.reichweite} m`;
				const km = (station) => (station / 1000).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
				return [
					lagePositionText(lage),
					lage.max - lage.min > 0.5 ? `Abstand ${lageMeters(lage.min)}–${lageMeters(lage.max)} m` : null,
					`km ${km(lage.stationFrom)}–${km(lage.stationTo)}`,
					`${lage.hits} von ${lage.samples} Stichproben`,
				].filter(Boolean).join(" · ");
			}
			// One sentence: what is said about the side, and by whom.
			function sideEvidenceText(evidence) {
				if (!evidence) return "";
				const { declared, lage, grade } = evidence;
				const word = SIDE_WORDS[declared.side];
				if (grade === "belegt") return `Gleisseite ${word} belegt: ${declared.source} und Lage (${lageDetailText(lage)})`;
				if (grade === "widerspruch") return `Gleisseite widersprüchlich: ${declared.source} sagt ${word}, die Lage ${lageDetailText(lage)}`;
				if (grade === "erklaert") return `Gleisseite ${word} nur erklärt (${declared.source}); Lage: ${lageDetailText(lage)}`;
				if (grade === "lage") return `Gleisseite nicht erklärt; Lage: ${lageDetailText(lage)}`;
				return `Gleisseite offen: nicht erklärt, ${lageDetailText(lage)}`;
			}

			function declaredSide(entry) {
				const gndSequence = gndSequenceForEntry(entry);
				const strRikz = String(gndSequence?.strRikz ?? "").trim();
				if (gndSequence?.family === "EK" && ["0", "3"].includes(strRikz)) return { side: "kilometer", source: "GND STRRIKZ" };
				if (strRikz === "1") return { side: "right", source: "GND STRRIKZ" };
				if (strRikz === "2") return { side: "left", source: "GND STRRIKZ" };
				// STRRIKZ 4/5 = Bahnhofsgleis (Gleisnummer in PSTRECKE, siehe
				// VERM.ESN-Handbuch Satzart 11): kein Richtungsgleis, hat also
				// keine feste links/rechts-Zuordnung. Faellt bewusst durch auf
				// die Heuristik unten statt hier als "right" behauptet zu werden.
				const preservedRole = entry.item?.payload?.extended?.viewer7L?.lineRole;
				if (String(preservedRole).includes("Right")) return { side: "right", source: "gespeicherte Zuordnung" };
				if (String(preservedRole).includes("Left")) return { side: "left", source: "gespeicherte Zuordnung" };
				if (preservedRole === "curvatureKilometer") return { side: "kilometer", source: "gespeicherte Zuordnung" };
				const nameFrame = vermEsnNameFrame(entry);
				if (nameFrame && nameFrame.side !== "unknown") return { side: nameFrame.side, source: "Dateiname" };
				// landXML carries the role in the Alignment desc ("Kilometrierungslinie
				// 1720", "Richtungsgleis 1720 (DR0)", "Gegenrichtungsgleis 1720 (DR0)").
				// Same convention as GND STRRIKZ: Richtungsgleis = 1 = rechts,
				// Gegenrichtungsgleis = 2 = links. "gegen" must be tested first.
				const desc = landXmlAlignmentDesc(entry).toLocaleLowerCase("de-DE");
				if (desc.includes("kilometrierungslinie")) return { side: "kilometer", source: "landXML-Beschreibung" };
				if (desc.includes("gegenrichtungsgleis")) return { side: "left", source: "landXML-Beschreibung" };
				if (desc.includes("richtungsgleis")) return { side: "right", source: "landXML-Beschreibung" };
				const direction = String(geoFrameInfo(entry)?.direction ?? "").toLocaleLowerCase("de-DE");
				const name = objectDisplayName(entry).toLocaleLowerCase("de-DE");
				if (direction.includes("kilometer") || einordnungNameKilometerlinie(name)) return { side: "kilometer", source: direction.includes("kilometer") ? "Zuordnung" : "Objektname" };
				if (direction.includes("rechts") || /(?:^|[\s_.-])(rechts|right|rg)(?:$|[\s_.-])/.test(name)) return { side: "right", source: direction.includes("rechts") ? "Zuordnung" : "Objektname" };
				if (direction.includes("links") || /(?:^|[\s_.-])(links|left|lg)(?:$|[\s_.-])/.test(name)) return { side: "left", source: direction.includes("links") ? "Zuordnung" : "Objektname" };
				// A profile/cant/staEq object has no direction signal of its own -- it
				// was never dragged into a 7L lane, its owning alignment was. Inherit
				// that alignment's side instead of defaulting to "unknown" (confirmed
				// against SCx_1720.xml: A101720R::cant only resolved to "right" once
				// this ran, matching A101720R itself, which the user actually assigned).
				if (entry.item?.kind !== "alignment") {
					const owningAlignment = relatedDiagramEntries(entry).anchor;
					if (owningAlignment && owningAlignment !== entry) return { side: sevenLineSide(owningAlignment), source: "vom Gleis geerbt" };
				}
				return { side: "unknown", source: null };
			}
			// The side as the 7L uses it: what the data declares -- an attribute, a
			// name, an assignment. declaredSide() also says which of them spoke.
			function sevenLineSide(entry) {
				return declaredSide(entry).side;
			}

			function stationEquationPositions(entry) {
				return (entry?.item?.payload?.equations ?? entry?.item?.payload?.staEquations ?? [])
					.map((equation) => stationScalar(
						equation.stationBack ?? equation.staBack ?? equation.station ?? equation.staAhead
					))
					.filter(Number.isFinite);
			}

			// Several segments of one side become one series with a gap (new
			// sub-path) at every segment start -- the single-track stretch between
			// two left-track segments must stay empty, not be bridged by a line.
			function concatSeries(seriesList) {
				return seriesList.flatMap((series) => series.map((point, index) => index === 0 ? { ...point, gap: true } : point));
			}
			function intersectRange(a, b) {
				if (!a) return b;
				if (!b) return a;
				const range = { from: Math.max(a.from, b.from), to: Math.min(a.to, b.to) };
				return range.to > range.from ? range : null;
			}
			function clipPointsToRange(points, range) {
				if (!range) return points;
				const from = range.from - 5;
				const to = range.to + 5;
				const kept = [];
				let dropped = false;
				for (const point of points) {
					if (!(Number.isFinite(point.x) && point.x >= from && point.x <= to)) { dropped = true; continue; }
					kept.push(dropped && !point.gap ? { ...point, gap: true } : point);
					dropped = false;
				}
				return kept;
			}


			// ---- ABLEITUNG · GWB-Vorschlag (Ril 800.0110 V3.0) --------------------
			// Second half of the GWB. Not "what would 160 mm give" (the first
			// version, which skipped the ramp) but "what is reachable per Bogen
			// without moving the track" -- the check 800.0110 4 (3) prescribes for
			// a Geschwindigkeitsanhebung: exhaust the parameters up to the
			// Ermessensgrenze, no construction. Per Bogen (consecutive Kreisbögen
			// of one sense = one Korbbogen unit sharing one cant, 7 (4)) the cant u
			// is varied over 0 and CANT_MIN..CANT_MAX in CANT_STEP and the highest
			// SPEED_STEP that passes every check is kept:
			//   Bogen        uf = 11.8 v^2 / r_min - u <= CANT_DEFICIENCY_MM     (Tab. 5)
			//   Rampe        l_R >= k_R v du / 1000, k_R Klothoide 8 / Bloss 6    (Tab. 8)
			//   Neigung      l_R / du (Bloss: 2/3 of it) not steeper than 1:400  (Tab. 7)
			//   Übergang     l_U >= k_U v duf / 1000, k_U Klothoide 4 / Bloss 4.5 (Tab. 9)
			// with l_R = l_U (8 (1): UA = RA, UE = RE), du against the neighbour's
			// cant and duf against the neighbour's Fehlbetrag at the same v; a
			// Gegenbogen neighbour adds instead of subtracts. Two variants: keep the
			// existing Übergangsbogen, or reshape a Klothoide into a Bloss with the
			// same f-Maß (8 (2), l_UB = sqrt(5/3) l_U) so the Bogen stays where it
			// is. The extra Bloss length (half into the Bogen, half into the
			// neighbour) must leave Bogen and Gerade their Mindestlänge after
			// Tab. 3 (0,10/0,15/0,20 v for v <= 70 / <= 100 / > 100 km/h); a
			// Bloss that does not fit is dropped and said so (blossRoomCheck).
			// The Fahrdynamik of the resulting steps is 457.0201 5 (10), below.
			// A Bogen side without Übergangsbogen keeps its cant (8 (1) wants ramps
			// on the Übergangsbogen) and its Krümmungswechsel is not judged (that
			// is 800.0110 9 / Tab. 10 Vergleichsradius, not modelled). Reads only
			// the interpreted elements and the mm cant series; writes nothing back.
			const GWB_VARIANTS = ["Klothoide", "Bloss"];
			const speedDiagnosticFootnote = () => `zul. v —: Ril 800.0110 Tab. 5 mit uf ≤ ${fahrzeugText()} · GWB-Vorschlag ┄: je Bogen u bis ${cantMaxMm()} mm (${cantLimitLabel()}) gegen Rampenlänge/-neigung (Tab. 7/8) und Übergangsbogenlänge (Tab. 9), Klothoide bleibt oder → Bloss mit gleichem f-Maß (8 (2)); Ermessensgrenze nach 4 (3), ohne bauliche Maßnahme · beide in ${SPEED_STEP_KMH}er-Stufen abgerundet (457.0201), Deckel ${V_MAX_DE_KMH} km/h · ohne Übergangsbogen gegen den Vergleichsradius (9 (3), Tab. 10 Ermessensgrenze; über 200 km/h der Wert für 200) · Platz für die Bloss-Verlängerung nicht geprüft · Diagnose, kein Entwurf`;
			function gwbElements(entry) {
				const list = [];
				const signOf = (radius, element) => radius < 0 ? -1 : radius > 0 ? curveRotationSign(element) : 0;
				for (const element of entry?.item?.payload?.coordGeom?.elements ?? []) {
					if (element.type !== "Line" && element.type !== "Curve" && element.type !== "Spiral") continue;
					const s0 = stationScalar(elementKmStart(entry, element) ?? element.staStart);
					const length = Math.abs(numberValue(element.length));
					if (!Number.isFinite(s0) || !(length > 0)) continue;
					const externalEnd = stationScalar(elementKmEnd(entry, element));
					const s1 = Number.isFinite(externalEnd) ? externalEnd : s0 + length;
					const rawStart = element.type === "Line" ? 0 : numberValue(element.radius ?? element.radiusStart);
					const rawEnd = element.type === "Line" ? 0 : numberValue(element.radius ?? element.radiusEnd);
					list.push({
						type: element.type,
						// landXML spells it "clothoid"; the Ril tables and the PI say Klothoide.
						spiType: element.type === "Spiral" ? /bloss/i.test(String(element.spiType ?? "")) ? "Bloss" : /^\s*$|cloth|kloth/i.test(String(element.spiType ?? "")) ? "Klothoide" : String(element.spiType) : "",
						s0, s1, length,
						radiusStart: Number.isFinite(rawStart) ? Math.abs(rawStart) : 0,
						radiusEnd: Number.isFinite(rawEnd) ? Math.abs(rawEnd) : 0,
						signStart: Number.isFinite(rawStart) ? signOf(rawStart, element) : 0,
						signEnd: Number.isFinite(rawEnd) ? signOf(rawEnd, element) : 0,
					});
				}
				return list;
			}
			// One side of a Bogen unit: what the ramp on that side has to work
			// with. vMax is what the neighbour itself allows today -- a transition
			// between two Bögen is run at the lower of the two speeds, so its ramp
			// and length are judged at min(v, vMax), not at the unit's v.
			function gwbSide(list, index, step, cantMm, label) {
				const member = list[index];
				const neighbour = list[index + step];
				const cantAt = (x) => Math.abs(interpolateSeriesAt(cantMm, x));
				const finish = (side) => ({ ...side, vMax: side.radius > 0 ? allowedSpeedKmh(side.radius, side.cantMm) : Infinity });
				if (!neighbour) return finish({ label, kind: "Ende", existing: "", lU: 0, cantMm: cantAt(step < 0 ? member.s0 : member.s1), radius: 0, opposite: false });
				if (neighbour.type === "Spiral") {
					const farRadius = step < 0 ? neighbour.radiusStart : neighbour.radiusEnd;
					const farSign = step < 0 ? neighbour.signStart : neighbour.signEnd;
					return finish({ label, kind: "Übergangsbogen", existing: neighbour.spiType, lU: neighbour.length, cantMm: cantAt(step < 0 ? neighbour.s0 : neighbour.s1), radius: farRadius, opposite: farRadius > 0 && farSign !== member.signStart });
				}
				const probe = step < 0 ? neighbour.s1 - Math.min(1, neighbour.length / 2) : neighbour.s0 + Math.min(1, neighbour.length / 2);
				return finish({ label, kind: neighbour.type === "Curve" ? "Gegenbogen" : "Gerade", existing: "", lU: 0, cantMm: cantAt(probe), radius: neighbour.radiusStart, opposite: neighbour.type === "Curve" && neighbour.signStart !== member.signStart });
			}
			// null when (v, u) passes every check for one member Bogen of the unit,
			// else the first binding limit as text -- the same text is shown as
			// "danach bindend" for the proposal. A Korbbogen shares u but each
			// radius has its own v; only the outer members see a side ramp.
			function gwbFailure(v, u, unit, variant, memberIndex) {
				if (v > V_MAX_DE_KMH) return `Deckel ${V_MAX_DE_KMH} km/h`;
				const member = unit.members[memberIndex];
				const uf = EQUILIBRIUM_CANT_FACTOR * v * v / member.radius - u;
				const ufLimit = cantDeficiencyAt(member.radius, u, v);
				if (uf > ufLimit + 1e-9) return `Bogen r ${Math.round(member.radius)} m (uf > ${ufLimit} mm${isNeiTech() && ufLimit === NEITECH_CONVENTIONAL_UF_MM ? ", außerhalb des NeiTech-Fensters" : ""})`;
				// Inside a Korbbogen the radii meet without Übergangsbogen (9 (3)).
				for (const other of [unit.members[memberIndex - 1], unit.members[memberIndex + 1]]) {
					if (!other || Math.abs(other.radius - member.radius) < 1e-9) continue;
					const rW = member.radius * other.radius / Math.abs(member.radius - other.radius);
					const rWMin = vergleichsradiusMinM(v);
					if (rW < rWMin) return `Korbbogen r ${Math.round(member.radius)}/${Math.round(other.radius)} m: rW ${Math.round(rW)} m < ${Math.round(rWMin)} m (Tab. 10)`;
				}
				const sides = unit.sides.filter((side, sideIndex) => sideIndex === 0 ? memberIndex === 0 : memberIndex === unit.members.length - 1);
				for (const side of sides) {
					const vSide = Math.min(v, side.vMax);
					// 11 (4): Übergangsbogen and Überhöhung are designed for the
					// conventional speed; for the NeiTech v Tab. 13 refers the ramp
					// minima to Zustimmungswerte settled case by case (Fn. 45, Tab. 8
					// Fn. 25), which no formula covers -- so the ramp length and
					// gradient are not judged in NeiTech mode, and the footnote says so.
					const judgeRamp = !isNeiTech();
					const deltaU = side.opposite ? u + side.cantMm : Math.abs(u - side.cantMm);
					const type = side.existing === "Bloss" || variant === "Bloss" ? "Bloss" : "Klothoide";
					const lR = side.existing === "Bloss" || variant === "Klothoide" ? side.lU : side.lU * BLOSS_LENGTH_FROM_KLOTHOIDE;
					if (deltaU > 0.5) {
						if (!(lR > 0)) return `${side.label}: kein Übergangsbogen für Δu ${Math.round(deltaU)} mm`;
						if (type === "Bloss" && deltaU < BLOSS_MIN_DELTA_U_MM) return `${side.label}: Bloss braucht Δu ≥ ${BLOSS_MIN_DELTA_U_MM} mm`;
						if (judgeRamp && lR < RAMP_LENGTH_FACTOR[type] * vSide * deltaU / 1000) return `${side.label}: Rampe ${Math.round(lR)} m < ${RAMP_LENGTH_FACTOR[type]}·v·Δu/1000`;
						const gradient = (type === "Bloss" ? BLOSS_GRADIENT_SHARE : 1) * lR * 1000 / deltaU;
						if (judgeRamp && gradient < RAMP_GRADIENT_MIN_M) return `${side.label}: Rampenneigung 1:${Math.round(gradient)} steiler als 1:${RAMP_GRADIENT_MIN_M}`;
					}
					if (!(lR > 0)) {
						// No Übergangsbogen on this side: the Krümmungswechsel is judged by
						// its Vergleichsradius (9 (3), Tab. 10) at the speed it is run at.
						if (side.kind === "Ende") continue;
						const rW = side.radius > 0
							? member.radius * side.radius / (side.opposite ? member.radius + side.radius : Math.max(Math.abs(member.radius - side.radius), 1e-9))
							: member.radius;
						const rWMin = vergleichsradiusMinM(vSide);
						if (rW < rWMin) return `${side.label}: ohne Übergangsbogen, rW ${Math.round(rW)} m < ${Math.round(rWMin)} m (Tab. 10)`;
						continue;
					}
					// Both Fehlbeträge at the speed the transition is actually run at.
					const ufHere = EQUILIBRIUM_CANT_FACTOR * vSide * vSide / member.radius - u;
					const ufSide = side.radius > 0 ? EQUILIBRIUM_CANT_FACTOR * vSide * vSide / side.radius - side.cantMm : 0;
					const deltaUf = side.opposite ? Math.abs(ufHere) + Math.abs(ufSide) : Math.abs(ufHere - ufSide);
					if (deltaUf > 0.5 && lR < TRANSITION_LENGTH_FACTOR[type] * vSide * deltaUf / 1000) return `${side.label}: Übergangsbogen ${Math.round(lR)} m < ${TRANSITION_LENGTH_FACTOR[type]}·v·Δuf/1000`;
				}
				return null;
			}
			// Highest speed step each member reaches under (u, variant); the unit's
			// v is the bottleneck member. The best cant maximises that bottleneck;
			// ties go to the cant closest to today's (least change for the same v).
			function gwbMemberSpeed(unit, variant, u, memberIndex) {
				for (let v = V_MAX_DE_KMH; v >= SPEED_STEP_KMH; v -= SPEED_STEP_KMH) {
					if (!gwbFailure(v, u, unit, variant, memberIndex)) return v;
				}
				return 0;
			}
			function gwbBest(unit, variant, candidates) {
				let best = null;
				for (const u of candidates) {
					const memberSpeeds = unit.members.map((member, memberIndex) => gwbMemberSpeed(unit, variant, u, memberIndex));
					const v = Math.min(...memberSpeeds);
					if (!(v > 0)) continue;
					const closer = best && v === best.v && Math.abs(u - unit.uToday) < Math.abs(best.u - unit.uToday);
					if (!best || v > best.v || closer) {
						const bottleneck = memberSpeeds.indexOf(v);
						best = { v, u, variant, memberSpeeds, binding: gwbFailure(v + SPEED_STEP_KMH, u, unit, variant, bottleneck) };
					}
				}
				return best;
			}
			// Platzprüfung for the Bloss variant: each Klothoide that becomes a
			// Bloss grows by (sqrt(5/3) - 1) l_U, half into the Kreisbogen, half
			// into whatever lies beyond -- a Gerade (which may also give the same
			// to a Klothoide at its other end, taken as the worst case), the
			// Gegenbogen behind a Wendebogen, or nothing (end of data). Bogen and
			// Gerade must keep the Mindestlänge of Tab. 3 at the proposed v; two
			// Übergangsbögen back to back leave no room at all.
			function blossRoomCheck(list, first, last, unit, v) {
				const m = (x) => `${Math.round(x)} m`;
				const minLength = minElementLengthM(v);
				const growthOf = (spiral) => spiral && spiral.type === "Spiral" && spiral.spiType !== "Bloss" && spiral.length > 0 ? spiral.length * (BLOSS_LENGTH_FROM_KLOTHOIDE - 1) : 0;
				const arcLength = unit.members.reduce((sum, member) => sum + (member.s1 - member.s0), 0);
				let arcLoss = 0;
				const notes = [];
				for (const [spiralIndex, beyondIndex, label] of [[first - 1, first - 2, "Anfang"], [last + 1, last + 2, "Ende"]]) {
					const spiral = list[spiralIndex];
					const half = growthOf(spiral) / 2;
					if (!(half > 0)) continue;
					arcLoss += half;
					const beyond = list[beyondIndex];
					if (!beyond) { notes.push(`${label}: Ende der Daten`); continue; }
					if (beyond.type === "Spiral") return { ok: false, text: `${label}: zwei Übergangsbögen ohne Zwischengerade, kein Platz für ${m(half)}` };
					if (beyond.type === "Line") {
						const farSpiral = list[beyondIndex + (beyondIndex < spiralIndex ? -1 : 1)];
						const farHalf = growthOf(farSpiral) / 2;
						const remaining = beyond.length - half - farHalf;
						if (remaining < minLength) return { ok: false, text: `${label}: Gerade ${m(beyond.length)} → ${m(remaining)} < min ${m(minLength)} (Tab. 3)` };
						notes.push(`${label}: Gerade ${m(beyond.length)} → ${m(remaining)}`);
						continue;
					}
					const remaining = beyond.length - half;
					if (remaining < minLength) return { ok: false, text: `${label}: Gegenbogen ${m(beyond.length)} → ${m(remaining)} < min ${m(minLength)} (Tab. 3)` };
					notes.push(`${label}: Nachbarbogen ${m(beyond.length)} → ${m(remaining)}`);
				}
				if (!(arcLoss > 0)) return { ok: true, text: "" };
				const arcRemaining = arcLength - arcLoss;
				if (arcRemaining < minLength) return { ok: false, text: `Bogen ${m(arcLength)} → ${m(arcRemaining)} < min ${m(minLength)} (Tab. 3)` };
				return { ok: true, text: `Platz: Bogen ${m(arcLength)} → ${m(arcRemaining)}${notes.length ? `, ${notes.join(", ")}` : ""}` };
			}
			function deriveGwbProposal(alignmentEntry, cantEntry, selectedRange) {
				const list = gwbElements(alignmentEntry);
				const cantMm = cantEntry ? cantSeriesMm(cantEntry) : [];
				const candidates = [0];
				for (let u = CANT_MIN_MM; u <= cantMaxMm(); u += CANT_STEP_MM) candidates.push(u);
				const units = [];
				for (let index = 0; index < list.length; index += 1) {
					const head = list[index];
					if (head.type !== "Curve" || !(head.radiusStart > 0)) continue;
					let last = index;
					while (list[last + 1]?.type === "Curve" && list[last + 1].radiusStart > 0 && list[last + 1].signStart === head.signStart) last += 1;
					const members = list.slice(index, last + 1);
					const first = index;
					index = last;
					const from = members[0].s0;
					const to = members[members.length - 1].s1;
					if (selectedRange && (to < selectedRange.from - 5 || from > selectedRange.to + 5)) continue;
					const radii = members.map((member) => member.radiusStart);
					const uToday = Math.max(...members.map((member) => Math.abs(interpolateSeriesAt(cantMm, (member.s0 + member.s1) / 2))));
					const sides = [gwbSide(list, first, -1, cantMm, "Anfang"), gwbSide(list, last, 1, cantMm, "Ende")];
					const unit = { from, to, radii, radiusMin: Math.min(...radii), radiusMax: Math.max(...radii), uToday, sides };
					unit.members = members.map((member) => ({ s0: member.s0, s1: member.s1, radius: member.radiusStart }));
					unit.memberSpeedsToday = unit.members.map((member) => allowedSpeedKmh(member.radius, uToday));
					unit.vToday = Math.min(...unit.memberSpeedsToday);
					unit.todayCheck = gwbBest(unit, "Klothoide", [uToday]);
					unit.proposal = null;
					unit.blossRejected = null;
					for (const variant of GWB_VARIANTS) {
						const best = gwbBest(unit, variant, candidates.includes(uToday) ? candidates : [...candidates, uToday]);
						if (!best) continue;
						if (variant === "Bloss") {
							const room = blossRoomCheck(list, first, last, unit, best.v);
							if (!room.ok) {
								if (best.v > (unit.proposal?.v ?? 0)) unit.blossRejected = { v: best.v, text: room.text };
								continue;
							}
							best.room = room.text;
						}
						if (!unit.proposal || best.v > unit.proposal.v) unit.proposal = best;
					}
					// The proposed step spans the Bogen plus its Übergangsbögen -- that is
					// the section a VzG entry would cover.
					unit.span = {
						from: list[first - 1]?.type === "Spiral" ? list[first - 1].s0 : from,
						to: list[last + 1]?.type === "Spiral" ? list[last + 1].s1 : to,
					};
					units.push(unit);
				}
				return units;
			}
			// 800.0110 7 (4): a Korbbogen keeps one cant only while the Fehlbetrag
			// spread between its radii stays within 40 mm -- reported, not enforced.
			function korbbogenNote(unit, v, u) {
				if (!(unit.radiusMax > unit.radiusMin)) return "";
				const spread = Math.abs(EQUILIBRIUM_CANT_FACTOR * v * v / unit.radiusMin - EQUILIBRIUM_CANT_FACTOR * v * v / unit.radiusMax);
				return spread > KORBBOGEN_MAX_DELTA_UF_MM ? ` · Korbbogen: Δuf ${Math.round(spread)} mm > ${KORBBOGEN_MAX_DELTA_UF_MM}, nach 7 (4) je Radius eigene Überhöhung (Rampe zwischen den Bögen)` : "";
			}
			// The PI's lines under the GWB figure: one per Bogen with potential, one
			// per Bogen whose today's cant the ramp does not carry at today's v, and
			// one summary. Bögen already at the cap or without headroom are counted,
			// not listed.
			function gwbProposalLines(prefix, units) {
				const km = (x) => (x / 1000).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
				const gains = units.filter((unit) => unit.proposal && unit.proposal.v > unit.vToday);
				const short = units.filter((unit) => unit.todayCheck && unit.todayCheck.v < unit.vToday);
				if (!units.length) return [];
				const lines = [`${prefix} · GWB-Vorschlag: ${units.length} ${units.length === 1 ? "Bogen" : "Bögen"} im Abschnitt · ${gains.length} mit Potenzial · ${units.length - gains.length} ohne (Deckel, Bogen oder Rampe bindend)${short.length ? ` · ${short.length} mit Bestand unter den Werten der 800.0110 (2021)` : ""}`];
				for (const unit of gains) {
					const proposal = unit.proposal;
					const transitions = unit.sides.filter((side) => side.lU > 0).map((side) => proposal.variant === "Bloss" && side.existing !== "Bloss"
						? `${side.label} ${side.existing} ${Math.round(side.lU)} m → Bloss ${Math.round(side.lU * BLOSS_LENGTH_FROM_KLOTHOIDE)} m`
						: `${side.label} ${side.existing} ${Math.round(side.lU)} m bleibt`).join(", ");
					lines.push(`▸ km ${km(unit.from)}–${km(unit.to)} · r ${unit.radii.map((radius) => Math.round(radius)).join("/")} m · u ${Math.round(unit.uToday)} → ${proposal.u} mm · v ${unit.memberSpeedsToday.join("/")} → ${proposal.memberSpeeds.join("/")} km/h · ${transitions || "ohne Übergangsbogen"} · danach bindend: ${proposal.binding}${korbbogenNote(unit, proposal.v, proposal.u)}${proposal.room ? ` · ${proposal.room}` : ""}${unit.blossRejected ? ` · Bloss hätte ${unit.blossRejected.v} km/h gebracht, aber kein Platz: ${unit.blossRejected.text}` : ""}`);
				}
				for (const unit of units.filter((unit) => unit.blossRejected && !gains.includes(unit))) {
					lines.push(`▫ km ${km(unit.from)}–${km(unit.to)} · r ${unit.radii.map((radius) => Math.round(radius)).join("/")} m · Bloss hätte ${unit.blossRejected.v} km/h gebracht, aber kein Platz: ${unit.blossRejected.text}`);
				}
				for (const unit of short) {
					lines.push(`▹ km ${km(unit.from)}–${km(unit.to)} · r ${unit.radii.map((radius) => Math.round(radius)).join("/")} m · Bestand u ${Math.round(unit.uToday)} mm trägt nach 800.0110 (2021) nur ${unit.todayCheck.memberSpeeds.join("/")} km/h (${unit.todayCheck.binding}); die Bogenformel allein gäbe ${unit.memberSpeedsToday.join("/")}${korbbogenNote(unit, unit.todayCheck.v, unit.uToday)}`);
				}
				return lines;
			}
			// ---- ABLEITUNG · Abschnitte (Ril 457.0201) ---------------------------
			// Bogen values become a VzG-like step profile over the whole selected
			// range: Geraden and Bögen above the line speed run at the line speed,
			// each Bogen (plus its Übergangsbögen) at its own value -- today's or
			// the proposal's -- and then 457.0201 5 (10) trims steps that a train
			// cannot actually drive (see the assumptions block). Returns the
			// sections and every trim it made, so the footnote can say why a step
			// is lower than its Bogen would allow.
			function mergeEqualSections(sections) {
				const merged = [];
				for (const section of sections) {
					const last = merged[merged.length - 1];
					if (last && last.v === section.v) last.to = section.to;
					else merged.push({ ...section });
				}
				return merged;
			}
			function deriveSpeedSections(units, selectedRange, lineSpeedKmh, useProposal) {
				if (!selectedRange || !(selectedRange.to > selectedRange.from)) return null;
				const vLine = Math.max(SPEED_STEP_KMH, roundDownToSpeedStep(Math.min(lineSpeedKmh, V_MAX_DE_KMH)));
				const limits = [];
				for (const unit of units) {
					const speeds = useProposal && unit.proposal ? unit.proposal.memberSpeeds : unit.memberSpeedsToday;
					unit.members.forEach((member, index) => {
						const from = index === 0 ? unit.span.from : member.s0;
						const to = index === unit.members.length - 1 ? unit.span.to : member.s1;
						limits.push({ from, to, v: Math.min(vLine, speeds[index]) });
					});
				}
				const edges = [...new Set([selectedRange.from, selectedRange.to, ...limits.flatMap((limit) => [limit.from, limit.to])])]
					.filter((x) => x >= selectedRange.from && x <= selectedRange.to)
					.sort((a, b) => a - b);
				let sections = [];
				for (let index = 0; index + 1 < edges.length; index += 1) {
					const from = edges[index];
					const to = edges[index + 1];
					if (!(to - from > 0.01)) continue;
					const mid = (from + to) / 2;
					let v = vLine;
					for (const limit of limits) if (mid > limit.from && mid < limit.to) v = Math.min(v, limit.v);
					sections.push({ from, to, v });
				}
				sections = mergeEqualSections(sections);
				const trims = [];
				for (let pass = 0; pass < 50; pass += 1) {
					let changed = false;
					for (let index = 1; index + 1 < sections.length; index += 1) {
						const section = sections[index];
						const prev = sections[index - 1];
						const next = sections[index + 1];
						const length = section.to - section.from;
						if (section.v > prev.v && section.v > next.v && section.v <= FAHRDYNAMIK_MAX_KMH) {
							// 5 (10) b): obere Stufe -- lower it until it is ausfahrbar.
							const before = section.v;
							let needed = NaN;
							while (section.v > Math.max(prev.v, next.v)) {
								needed = Math.max(regelbremswegM(), fahrdynamikWeg(prev.v, section.v) + BEHARRUNG_M[section.v] + fahrdynamikWeg(section.v, next.v));
								if (!(length < needed)) break;
								section.v -= SPEED_STEP_KMH;
							}
							if (section.v !== before) {
								trims.push({ from: section.from, to: section.to, before, after: section.v, length, needed, rule: "Fahrdynamik-Regel 457.0201 5 (10) b" });
								changed = true;
							}
						} else if (prev.v > section.v && section.v > next.v && length < regelbremswegM()) {
							// 5 (10) a): fallende Treppe -- a step shorter than the Bremsweg
							// is merged into the lower one (Bild 14).
							trims.push({ from: section.from, to: section.to, before: section.v, after: next.v, length, needed: regelbremswegM(), rule: "Bremsweg 457.0201 5 (10) a" });
							section.v = next.v;
							changed = true;
						}
					}
					if (!changed) break;
					sections = mergeEqualSections(sections);
				}
				return { sections, trims, vLine };
			}
			function sectionSeries(result) {
				return (result?.sections ?? []).flatMap((section) => [section.gap ? { x: section.from, y: section.v, gap: true } : { x: section.from, y: section.v }, { x: section.to, y: section.v }]);
			}
			function sectionLines(prefix, today, proposal) {
				if (!proposal) return [];
				const km = (x) => (x / 1000).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
				const lines = [`${prefix} · Abschnitte nach 457.0201 (Strecke ${proposal.vLine} km/h angenommen, Regelbremsweg ${regelbremswegM()} m): heute ${today.sections.length}, Vorschlag ${proposal.sections.length} Stufen · Vorschlag: ${proposal.sections.map((section) => `km ${km(section.from)}–${km(section.to)} ${section.v}`).join(" · ")}`];
				for (const [label, result] of [["heute", today], ["Vorschlag", proposal]]) {
					for (const trim of result.trims) {
						lines.push(`  ${label}: km ${km(trim.from)}–${km(trim.to)} ${trim.before} → ${trim.after} km/h · ${trim.rule}: ${Math.round(trim.length)} m vorhanden, ${Math.round(trim.needed)} m nötig`);
					}
				}
				return lines;
			}
			// Two bands per Gleis on a shared scale. First: the solid line is what
			// the surveyed cant allows today (Bogenformel), the dashed overlay the
			// GWB-Vorschlag per Bogen -- the vertical gap between them IS the GWB
			// diagnostic. Second: the same two cases as VzG-like Abschnitte over
			// the whole range. The assumptions and the per-Bogen lines go into the
			// footnotes under the figure, not into the label.
			// Sections of several segments of one side, concatenated; the first
			// section of every segment opens a new sub-path so the stretch where
			// the Gleis does not exist stays empty.
			function mergeSectionResults(results) {
				const present = results.filter(Boolean);
				if (!present.length) return null;
				return {
					vLine: present[0].vLine,
					sections: present.flatMap((result) => result.sections.map((section, index) => index === 0 ? { ...section, gap: true } : section)),
					trims: present.flatMap((result) => result.trims),
				};
			}
			function speedDiagnosticBand(prefix, segments, selectedRange, band) {
				const live = segments
					.map((segment) => ({ ...segment, range: intersectRange(segment.range, selectedRange) }))
					.filter((segment) => segment.alignment && (segment.range || !selectedRange));
				const perSegment = live.map((segment) => {
					const units = deriveGwbProposal(segment.alignment, segment.cant, segment.range);
					return { units, today: deriveSpeedSections(units, segment.range, lineSpeedKmh(), false), proposal: deriveSpeedSections(units, segment.range, lineSpeedKmh(), true) };
				});
				const units = perSegment.flatMap((part) => part.units);
				const today = mergeSectionResults(perSegment.map((part) => part.today));
				const proposal = mergeSectionResults(perSegment.map((part) => part.proposal));
				// One band per Gleis, and it is continuous -- a Geschwindigkeits-
				// Wege-Band is a step profile over the whole way: Streckengeschwindig-
				// keit on Geraden, the Bogen limit in Bögen, then the 457.0201 trims.
				// The per-Bogen limits that feed it are not drawn as pieces any more
				// (Uwe: "Stückchen, keine durchgehenden Linien"); they live in the lines
				// under the figure and in the Bögen-CSV. The only gaps left are where
				// the Gleis itself does not exist.
				return [
					band(`${prefix} · GWB heute — / Vorschlag ┄ [km/h]`, "diagram-speed diagram-speed-sections", sectionSeries(today), {
						emptyNote: "kein Stationsbereich · kein Geschwindigkeitsband ableitbar",
						overlay: { label: "Vorschlag", className: "diagram-speed-potential", points: sectionSeries(proposal) },
						footnote: { gleis: prefix, assumptions: speedDiagnosticFootnote(), lines: [...gwbProposalLines(prefix, units), ...sectionLines(prefix, today, proposal)] },
						unit: "km/h",
						proposal: units,
						sections: { today, proposal },
					}),
				];
			}

			// ---- Main · Zuordnung ------------------------------------------------
			// Which objects belong to the selected one, which side each plays in
			// the 7L structure, and which station range the diagram covers. No
			// series, no formulas: this is the "linking" part of Main, and every
			// band derivation below reads only from what it returns.
			// BEGIN EINORDNUNG (test/technet-viewer-einordnung.test.mjs runs this block)
			// Die Einordnung: einmal pro Änderung, aus Fakten je Objekt (Rohdaten
			// plus Nutzerentscheidungen, vom Adapter darunter gesammelt), das
			// Modell der Bahn statt der Dateien. Drei Fragen, einmal beantwortet:
			// wem gehört es (Gradiente, Überhöhung, Stationsgleichung zu ihrer
			// Trasse), wo liegt es (Strecke, Seite, Abschnitt, Lage, Höhe, km-
			// Bereich), und was teilt das Bild mit ihm (das Umfeld eines Gleises:
			// die 7L-Verwandten plus die Gleise derselben Strecke, für GND nur bei
			// gleicher Lage und überlappendem km, für VermEsn-Namen bei
			// verträglichem Abschnitt). Pure: Fakten rein, Modell raus. Die
			// Ansichten lesen; keine schreibt in Daten.
			//
			// A fact: { key, kind, name, file, family, label, route, gnd, gndSequence,
			//   gndFamily, gndRoute, organized, hidden, lsys, hsys,
			//   frame: { track, direction, segment, source, lsys } | null,
			//   side: "kilometer" | "right" | "left" | "unknown", range: { from, to } | null,
			//   refKeys: [key] (the objects it references -- its Trasse, a Gleis its
			//   Kilometerlinie -- resolved by the adapter inside its own file first:
			//   object ids are positions in a file, and two deliveries reuse them
			//   for different objects),
			//   homeKey (the first Trasse of its file, the anchor of last resort),
			//   role (the 7L Spur: gradientRight … cantRight, or "UNASSIGNED"),
			//   section (an explicit Abschnitt id, or ""),
			//   kmFrame (its range is in the Strecke's km: GND, a Kilometerlinie, a
			//   Gleis stationed on one; false for file-local stations, and for a
			//   GND Nebengleis sorted into a Strecke that fits none of its lines) }
			const EINORDNUNG_VERSION = "einordnung/0.1";
			// Wer ist es, on the level of files: a file is known by its name, and
			// a second file of the same name (two deliveries, two folders) by its
			// name and its turn -- "X.MDB", "X.MDB (2)". The first keeps the bare
			// name, so what was saved before stays valid. The key names the file
			// in the saved state, in the browser's store and on the screen; the
			// file name itself stays what the delivery called it.
			function einordnungDateischluessel(fileName, namesBefore) {
				const earlier = namesBefore.filter((name) => name === fileName).length;
				return earlier ? `${fileName} (${earlier + 1})` : fileName;
			}
			// Wo liegt es: the Kilometerlinie a Gleis is stationed on. The adapter
			// measures each candidate line -- { key, distanceStart, distanceEnd }
			// in metres from the Gleis's two ends to the line, holdsProfile where
			// the Gleis's Gradiente is delivered inside the line's km range -- and
			// this decides: only a line both ends lie on (within maxDistance);
			// among those the one that holds the Gradiente, then the nearest, then
			// the first offered. A Gleis no line fits gets none: a Strecke's name
			// in the file name is no proof that the Gleis lies along a given line
			// of that Strecke (metroB 5904_R_R00: 10 km long, 3 and 13 km off the
			// first Kilometerlinie that happened to be loaded).
			function einordnungBezugslinie(candidates, maxDistance) {
				let best = null;
				for (const candidate of candidates) {
					if (!(candidate.distanceStart <= maxDistance) || !(candidate.distanceEnd <= maxDistance)) continue;
					const distance = Math.max(candidate.distanceStart, candidate.distanceEnd);
					const miss = candidate.holdsProfile ? 0 : 1;
					if (!best || miss < best.miss || (miss === best.miss && distance < best.distance)) best = { key: candidate.key, distance, miss };
				}
				return best ? best.key : null;
			}
			// What the user sorted into a Strecke by hand reaches farther than what
			// the viewer places by itself: the user has said which Strecke, the
			// Lage only has to say where along it. A line fits such a Gleis when
			// the foot of both its ends lies on the line (onLine: not beyond the
			// line's ends), neither end is farther than farDistance -- a Gleisgruppe
			// beside the Strecke, not the next Strecke over, as the Spurplan has it
			// -- and at least minShare of the Gleis runs within the Lage's reach of
			// the line (share). Measured: Bahnhofsgleise with one end 62-134 m off
			// run 69-94 % beside their line (Billwerder, WueTreu). Among those the
			// line that holds the Gradiente, then the larger share, then the nearer.
			const BEZUGSLINIE_VON_HAND_MIN_ANTEIL = 0.5;
			function einordnungBezugslinieVonHand(candidates, farDistance, minShare = BEZUGSLINIE_VON_HAND_MIN_ANTEIL) {
				let best = null;
				for (const candidate of candidates) {
					if (!candidate.onLine || !(candidate.share >= minShare)) continue;
					const distance = Math.max(candidate.distanceStart, candidate.distanceEnd);
					if (!(distance <= farDistance)) continue;
					const miss = candidate.holdsProfile ? 0 : 1;
					if (!best || miss < best.miss || (miss === best.miss && (candidate.share > best.share || (candidate.share === best.share && distance < best.distance)))) best = { key: candidate.key, distance, share: candidate.share, miss };
				}
				return best ? best.key : null;
			}
			// Why no line of the Strecke fits a Gleis sorted in by hand, for the
			// one that came closest: { grund: "keine" } (no line offered),
			// "fern" (no part of it beside any line), "ende" (it runs out beyond
			// the line's end), "abstand" (an end farther than farDistance) or
			// "anteil" (too little of it beside the line), with key and share.
			function einordnungOhneBezugslinie(candidates, farDistance, minShare = BEZUGSLINIE_VON_HAND_MIN_ANTEIL) {
				if (!candidates.length) return { grund: "keine" };
				const closest = candidates.filter((candidate) => candidate.share > 0).sort((a, b) => b.share - a.share)[0];
				if (!closest) return { grund: "fern" };
				const distance = Math.max(closest.distanceStart, closest.distanceEnd);
				const grund = !closest.onLine ? "ende" : !(distance <= farDistance) ? "abstand" : closest.share < minShare ? "anteil" : "sonst";
				return { grund, key: closest.key, share: closest.share, distance };
			}
			// Stücke einer Kilometerlinie: a Strecke's line is delivered in pieces.
			// Two pieces that meet end to start, in Lage and in km, are one line to
			// a Gleis lying across the joint (WueTreu Gleis 31, 204 m: from km
			// 40,421 on one piece of 5330 to km 40,624 on the next; they meet
			// without a gap at km 40,551/40,550). Measured over nine deliveries it
			// is that one Gleis; the limits are the slack of a joint, not tuned.
			// stuecke: [{ key, first: { x, y, station }, last: { x, y, station } }]
			// in the direction they are drawn; returns [{ a, b, fuge, sprung }].
			const STUECK_FUGE_M = 5;
			const STUECK_KM_SPRUNG_M = 5;
			function einordnungStueckfolgen(stuecke, fuge = STUECK_FUGE_M, sprung = STUECK_KM_SPRUNG_M) {
				const folgen = [];
				for (const a of stuecke) {
					for (const b of stuecke) {
						if (a === b || !a?.last || !b?.first) continue;
						const gap = Math.hypot(a.last.x - b.first.x, a.last.y - b.first.y);
						const jump = Math.abs(a.last.station - b.first.station);
						if (gap <= fuge && jump <= sprung) folgen.push({ a: a.key, b: b.key, fuge: gap, sprung: jump });
					}
				}
				return folgen;
			}
			// A projection that does not keep the Gleis's length is none: stations
			// clamped at a line's end collapse onto one km.
			const BEZUGSLINIE_MIN_LAENGENTREUE = 0.5;
			function einordnungLaengentreu(localSpan, externalSpan) {
				return !(localSpan > 0) || Math.abs(externalSpan) >= BEZUGSLINIE_MIN_LAENGENTREUE * localSpan;
			}
			// Stations as delivered are the Strecke's km only where the Lage
			// agrees: both ends of the Gleis, put onto the Kilometerlinie, lie at
			// the km the file gives them. A Weichenverbindung stationed from 0 on
			// a Strecke that begins near km 0 lies "within the line's km" by its
			// numbers alone (Landshut W403-404: 0-88 m, on 5632 at km 0,993-1,081).
			// Measured: real km agree to the metre, file-local stations miss by
			// 80 m and more; the tolerance is the slack a Gleis may reach beyond
			// its line. That slack is for one end: where both ends miss, the
			// Gleis counts for itself, however little it misses by (metroB
			// Ka_NCH_Gl11 counts from 0 and lies at km 0,034 to 0,504 of 5810:
			// 34 and 35 m off, inside the tolerance, and its stations stood as
			// km). So one end at least has to agree to the metre. Measured over
			// seven deliveries: the five Gleise with real km agree within 1 m at
			// both ends, the sixth is that one.
			const BEZUGSLINIE_STATION_TOLERANZ_M = 50;
			const BEZUGSLINIE_STATION_GENAU_M = 2;
			function einordnungStationenGelten(delivered, projected, tolerance = BEZUGSLINIE_STATION_TOLERANZ_M, genau = BEZUGSLINIE_STATION_GENAU_M) {
				if (!delivered || !projected) return true;
				const from = Math.abs(delivered.from - projected.from);
				const to = Math.abs(delivered.to - projected.to);
				return from <= tolerance && to <= tolerance && Math.min(from, to) <= genau;
			}
			// How the station runs along one element of a Trasse: up by its
			// length, or down to its km end where the Gleis is laid against the
			// km (a Bahnhofsgleis put onto its Kilometerlinie from the far end).
			// Counting up from the element's start there made a sawtooth: every
			// element began at its km and ran the wrong way (Billwerder
			// AHBI_Gl_021_034, km 47,6 down to 46,0: stations up to 48,1).
			function einordnungStationsgang(start, end, length) {
				return Number.isFinite(start) && Number.isFinite(end) && end < start ? end - start : length;
			}
			// Who references whom, turned round: the referrers of each object.
			function einordnungReferrers(objects) {
				const referrers = new Map();
				for (const placed of objects.values()) {
					for (const target of placed.refKeys ?? []) {
						if (!objects.has(target)) continue;
						if (!referrers.has(target)) referrers.set(target, []);
						referrers.get(target).push(placed.key);
					}
				}
				return referrers;
			}
			// Die Bezüge allein: nodes { key, kind, refKeys, homeKey } and their
			// referrers. Enough for einordnungVerbund and einordnungEigene, and it
			// needs no Lage, side or Strecke -- so the resolvers that produce
			// those can ask it while the full model is still being built.
			function einordnungBezuege(nodes) {
				const objects = new Map(nodes.map((node) => [node.key, node]));
				return { objects, referrers: einordnungReferrers(objects) };
			}
			function einordnen(facts) {
				const objects = new Map();
				for (const fact of facts) objects.set(fact.key, { ...fact, trasse: fact.kind === "alignment" ? fact.key : null, dependents: [], orphan: false });
				const referrers = einordnungReferrers(objects);
				// Zugehörigkeit: every Trasse the object references lists it; the
				// first one stands for it.
				for (const placed of objects.values()) {
					if (placed.kind === "alignment") continue;
					const owners = (placed.refKeys ?? []).map((key) => objects.get(key)).filter((candidate) => candidate?.kind === "alignment");
					if (owners.length) {
						placed.trasse = owners[0].key;
						for (const owner of owners) owner.dependents.push(placed.key);
					} else {
						placed.orphan = true;
					}
				}
				// Der Haufen: what is not right yet -- Trassen and orphans; a dependent goes with its Trasse.
				const pile = [...objects.values()].filter((placed) => !placed.organized && (placed.kind === "alignment" || placed.orphan)).map((placed) => placed.key);
				// Die Ordnung: organized objects by Strecke. Under one Strecke the
				// objects of one Lage form a Rahmen, and each Rahmen falls into
				// Abschnitte (einordnungAbschnitte); a Strecke lists the Abschnitte
				// of all its Rahmen in order, each with its Spuren (role -> keys).
				const strecken = new Map();
				const rahmen = new Map();
				for (const placed of objects.values()) {
					if (!placed.organized || !placed.frame) continue;
					const track = String(placed.frame.track);
					const lsys = placed.lsys || placed.frame.lsys || "LSYS?";
					if (!strecken.has(track)) strecken.set(track, { track, keys: [], sides: { kilometer: [], right: [], left: [], unknown: [] }, abschnitte: [] });
					const strecke = strecken.get(track);
					strecke.keys.push(placed.key);
					strecke.sides[placed.side in strecke.sides ? placed.side : "unknown"].push(placed.key);
					const rahmenKey = `${track} ${lsys}`;
					if (!rahmen.has(rahmenKey)) rahmen.set(rahmenKey, { track, lsys, members: [] });
					rahmen.get(rahmenKey).members.push(placed);
				}
				for (const { track, lsys, members } of rahmen.values()) {
					for (const abschnitt of einordnungAbschnitte(members)) {
						const spuren = {};
						for (const key of abschnitt.keys) {
							const role = objects.get(key).role ?? "UNASSIGNED";
							(spuren[role] ??= []).push(key);
						}
						strecken.get(track).abschnitte.push({ ...abschnitt, lsys, spuren });
					}
				}
				return { version: EINORDNUNG_VERSION, objects, referrers, strecken, pile };
			}
			// Abschnitte of one Rahmen: an explicit Abschnitt id bundles its objects
			// (range = their hull); the rest is chained in km order, a new Abschnitt
			// where a range begins more than 5 m behind the running end; objects
			// without a range form one last Abschnitt with an open range.
			function einordnungAbschnitte(members) {
				const abschnitte = [];
				const explicit = new Map();
				for (const placed of members) {
					if (!placed.section) continue;
					if (!explicit.has(placed.section)) explicit.set(placed.section, []);
					explicit.get(placed.section).push(placed);
				}
				for (const [sectionId, sectionMembers] of explicit) {
					let from = Infinity;
					let to = -Infinity;
					for (const placed of sectionMembers) {
						if (!placed.range) continue;
						from = Math.min(from, placed.range.from);
						to = Math.max(to, placed.range.to);
					}
					abschnitte.push({ sectionId, keys: sectionMembers.map((placed) => placed.key), range: Number.isFinite(from) ? { from, to } : null });
				}
				const inferred = members.filter((placed) => !placed.section);
				const ranged = inferred.filter((placed) => placed.range).sort((a, b) => a.range.from - b.range.from);
				let current = null;
				for (const placed of ranged) {
					if (current && placed.range.from <= current.range.to + 5) {
						current.keys.push(placed.key);
						current.range.to = Math.max(current.range.to, placed.range.to);
					} else {
						current = { sectionId: "", keys: [placed.key], range: { ...placed.range } };
						abschnitte.push(current);
					}
				}
				const unranged = inferred.filter((placed) => !placed.range).map((placed) => placed.key);
				if (unranged.length) abschnitte.push({ sectionId: "", keys: unranged, range: null });
				return abschnitte;
			}
			// Varianten: two Trassen of one side that occupy the same stretch of
			// km are alternatives, not consecutive pieces -- a Bestand and its
			// Neuplanung (Eifel 2631R139 …), an older and a newer delivery of one
			// Gleis, the same file loaded from two folders (Billwerder). Pieces
			// that only meet or lap at a seam are not. The measure is an
			// assumption, set here: an overlap of at least VARIANTE_MIN_OVERLAP_M
			// and of at least VARIANTE_MIN_SHARE of the shorter one.
			const VARIANTE_MIN_OVERLAP_M = 20;
			const VARIANTE_MIN_SHARE = 0.2;
			function einordnungUeberdeckt(a, b) {
				if (!a || !b) return false;
				const overlap = Math.min(a.to, b.to) - Math.max(a.from, b.from);
				const shorter = Math.min(a.to - a.from, b.to - b.from);
				return overlap >= VARIANTE_MIN_OVERLAP_M && overlap >= VARIANTE_MIN_SHARE * shorter;
			}
			// One side's Trassen: which stand in the picture, which stand back.
			// The preferred one (the selection's own Trasse) first, then the
			// longest, then the order of delivery; each takes its place unless a
			// Trasse already shown covers it.
			function einordnungVarianten(alignments, preferredKey) {
				const order = alignments
					.map((placed, index) => ({ placed, index, length: placed.range ? placed.range.to - placed.range.from : -1 }))
					.sort((a, b) => Number(b.placed.key === preferredKey) - Number(a.placed.key === preferredKey) || b.length - a.length || a.index - b.index);
				const shown = [];
				const hidden = [];
				const track = (placed) => placed.frame?.track ?? null;
				for (const { placed } of order) {
					// Only Trassen of one Strecke are alternatives of each other, and
					// only where their stations mean the same: a Gleis in the Strecke's
					// km and one still counted from its own start cover no common km,
					// whatever the numbers say (WueTreu 5321 begins at km 0).
					const rival = shown.find((kept) => track(kept) === track(placed) && Boolean(kept.kmFrame) === Boolean(placed.kmFrame) && einordnungUeberdeckt(kept.range, placed.range));
					if (rival) hidden.push({ key: placed.key, wegen: rival.key });
					else shown.push(placed);
				}
				return { shown: alignments.filter((placed) => shown.includes(placed)).map((placed) => placed.key), hidden };
			}
			// The same km are not the same Gleis. Of two Trassen of one side that
			// cover the same km, one is a Variante of the other only when it lies
			// on it: a Bestand and its Neuplanung, a second delivery (measured
			// 0,00-0,02 m). A Bahnhofsgleis or a Weichenverbindung beside the
			// Streckengleis covers the same km too, but lies beside it (measured
			// 0,3-13 m over Billwerder, Landshut, metroB, Eifel). The Lage decides,
			// with the measure of the Lage witness, set here as an assumption: on
			// the line means a median distance below NEBEN_AUF_M over at least
			// NEBEN_MIN_ANTEIL of the samples -- or, for a piece that runs with
			// the other only part of its way (metroB 5904080R, 7 of 25 samples,
			// all at 0,00 m), no sample in reach farther off than NEBEN_AUF_M. A
			// Weichenverbindung that touches a Gleis (Billwerder: 3 of 22 samples,
			// 0-2,9 m) is neither.
			const NEBEN_AUF_M = 0.5;
			const NEBEN_MIN_ANTEIL = 0.6;
			const NEBEN_MIN_TREFFER = 3;
			// messungen: [{ key, samples, hits, median, min, max }], the Trasse
			// against the others of its Spur that cover its km; none when the
			// Lage cannot be compared (no coordinates, another Lagesystem).
			// variante: lies on `zu`. gleis: another Gleis, `abstand` to the one
			// in the picture (wegenKey) where that is in reach, else to the
			// nearest; null when none is in reach. offen: the Lage is silent.
			// anteil: the share of the Trasse that runs beside `zu`.
			function einordnungNebenArt(messungen, wegenKey) {
				const list = (messungen ?? []).filter(Boolean);
				if (!list.length) return { art: "offen", zu: wegenKey ?? null, abstand: null, anteil: null };
				const reach = list.filter((m) => m.hits > 0);
				const auf = reach
					.filter((m) => m.median < NEBEN_AUF_M && (m.hits >= NEBEN_MIN_ANTEIL * m.samples || (m.hits >= NEBEN_MIN_TREFFER && m.max < NEBEN_AUF_M)))
					.sort((a, b) => a.median - b.median || b.hits / b.samples - a.hits / a.samples || Number(b.key === wegenKey) - Number(a.key === wegenKey))[0];
				const result = (art, m) => ({ art, zu: m.key, abstand: { median: m.median, min: m.min, max: m.max }, anteil: m.hits / m.samples });
				if (auf) return result("variante", auf);
				const neben = reach.find((m) => m.key === wegenKey) ?? reach.sort((a, b) => a.median - b.median)[0];
				return neben ? result("gleis", neben) : { art: "gleis", zu: wegenKey ?? null, abstand: null, anteil: null };
			}
			// Objects that reference `key` directly (its own profile, cant, staEq).
			function einordnungEigene(model, key) {
				return model.referrers.get(key) ?? [];
			}
			// What hangs together by references: the anchor (the object's Trasse),
			// the root (the Kilometerlinie a landXML Gleis references, so that one
			// Gleis shows the whole 7L), and everything that references them,
			// transitively.
			function einordnungVerbund(model, key) {
				const get = (candidateKey) => model.objects.get(candidateKey) ?? null;
				const self = get(key);
				let anchor = self.kind === "alignment" ? self : get((self.refKeys ?? [])[0]);
				anchor ??= get(self.homeKey) ?? self;
				const referenced = get((anchor.refKeys ?? [])[0]);
				const root = referenced?.kind === "alignment" ? referenced : anchor;
				const linked = new Set([anchor.key, root.key]);
				const frontier = [...linked];
				while (frontier.length) {
					for (const from of model.referrers.get(frontier.pop()) ?? []) {
						if (linked.has(from)) continue;
						linked.add(from);
						frontier.push(from);
					}
				}
				return { anchor, keys: [...model.objects.keys()].filter((candidateKey) => linked.has(candidateKey)) };
			}
			function einordnungStreckennummer(value) {
				return /^\d{4}$/.test(String(value ?? "").trim());
			}
			// Two stretches share a picture when they share more than a seam.
			const UMFELD_MIN_GEMEINSAM_M = 5;
			// Das Umfeld eines Objekts: what the 7L picture shows with it.
			function einordnungUmfeld(model, key) {
				const self = model.objects.get(key);
				if (!self) return null;
				const get = (candidateKey) => model.objects.get(candidateKey) ?? null;
				const selectedFrame = self.frame;
				const selectedRange = self.range;
				const overlaps = (candidate) => !selectedRange || !candidate.range || (candidate.range.from <= selectedRange.to + 5 && candidate.range.to >= selectedRange.from - 5);
				const sameLsys = (candidate) => (candidate.lsys || candidate.frame?.lsys) === (self.lsys || selectedFrame?.lsys);
				const verbund = einordnungVerbund(model, key);
				const anchor = verbund.anchor;
				// Where an object stands in the Strecke's km: its own range when it
				// is stationed there (kmFrame), else its Trasse's; null when neither
				// is -- a file-local station says nothing about km.
				const kmOf = (placed) => {
					if (placed.kmFrame) return placed.range;
					const trasse = placed.kind === "alignment" ? null : get(placed.trasse);
					return trasse?.kmFrame ? trasse.range : null;
				};
				const selfKm = kmOf(anchor.kmFrame ? anchor : self);
				const sameTrack = [...model.objects.values()].filter((candidate) => {
					if (!selectedFrame || !candidate.frame) return false;
					// A Nebengleis the user sorted into this Strecke that fits none of
					// its Kilometerlinien is still in its own stations (kmFrame false):
					// counted from 0, they would meet a Strecke that begins at km 0 by
					// their numbers alone (WueTreu 5321: seven of them).
					if (selectedFrame.source === "gnd") return candidate.frame.track === selectedFrame.track && sameLsys(candidate) && overlaps(candidate) && !(candidate.frame.source === "user" && candidate.kmFrame === false);
					// A Strecke named by a file or by the user's hand. What the user
					// sorted in shares a picture only through the km: it carries no
					// Abschnitt in a name, and a Gleis still in its file-local
					// stations would stretch the picture from 0 to the Strecke's km.
					const named = (frame) => frame.source === "vermesn-name" || frame.source === "user";
					if (named(selectedFrame)) {
						if (!named(candidate.frame) || String(candidate.frame.track) !== String(selectedFrame.track) || !sameLsys(candidate)) return false;
						// The Abschnitt in a file name stands in for the km. Where both
						// are stationed in the Strecke's km, the km decide: Eifel
						// 2631R142 (km 141,9-145,2) belongs with the Kilometerlinie
						// 2631K139 (km 139,2-150,5) though the names say 142 and 139,
						// and metroB 5904L (km 65,5-67,4) does not belong with 5904067R
						// (km 67,4-72,2) though its name names no Abschnitt at all.
						const candidateKm = kmOf(candidate);
						if (selfKm && candidateKm) return Math.min(selfKm.to, candidateKm.to) - Math.max(selfKm.from, candidateKm.from) > UMFELD_MIN_GEMEINSAM_M;
						if (selectedFrame.source === "user" || candidate.frame.source === "user") return false;
						return !candidate.frame.segment || !selectedFrame.segment || candidate.frame.segment === selectedFrame.segment;
					}
					return false;
				}).map((candidate) => candidate.key);
				const keys = [...new Set([...verbund.keys, ...sameTrack])];
				const bySide = { kilometer: [], right: [], left: [], unknown: [] };
				for (const candidateKey of keys) {
					const placed = get(candidateKey);
					if (placed) bySide[placed.side in bySide ? placed.side : "unknown"].push(candidateKey);
				}
				const anchorSide = anchor.side in bySide ? anchor.side : "unknown";
				if (!bySide[anchorSide].includes(anchor.key)) bySide[anchorSide].unshift(anchor.key);
				const all = [...new Set([anchor.key, ...keys])];
				// Varianten leave the picture, with what belongs to them alone. Not
				// on "unknown": Gleise without a side are different Gleise, not
				// alternatives of one.
				const varianten = [];
				for (const side of ["kilometer", "right", "left"]) {
					const alignments = bySide[side].map(get).filter((placed) => placed?.kind === "alignment");
					if (alignments.length < 2) continue;
					const { hidden } = einordnungVarianten(alignments, anchor.key);
					if (!hidden.length) continue;
					const gone = new Set(hidden.map((item) => item.key));
					const shownKeys = new Set(alignments.filter((placed) => !gone.has(placed.key)).map((placed) => placed.key));
					bySide[side] = bySide[side].filter((candidateKey) => {
						if (gone.has(candidateKey)) return false;
						const placed = get(candidateKey);
						if (!placed || placed.kind === "alignment") return true;
						const refKeys = placed.refKeys ?? [];
						return !refKeys.some((refKey) => gone.has(refKey)) || refKeys.some((refKey) => shownKeys.has(refKey));
					});
					for (const item of hidden) varianten.push({ ...item, side });
				}
				const first = (side, kind) => bySide[side].map(get).find((placed) => placed?.kind === kind)?.key ?? null;
				const kmAlignment = first("kilometer", "alignment");
				const rightAlignment = first("right", "alignment");
				const leftAlignment = first("left", "alignment");
				const twoTrack = Boolean(rightAlignment && leftAlignment);
				const gndRouteTrackNeedsReference = all.some((candidateKey) => {
					const placed = get(candidateKey);
					return placed?.kind === "alignment" && placed.gndFamily === "EL" && ["1", "2"].includes(String(placed.gndRoute ?? ""));
				});
				const anyGnd = all.some((candidateKey) => get(candidateKey)?.gndSequence);
				const referenceRequired = gndRouteTrackNeedsReference || (!anyGnd && twoTrack && einordnungStreckennummer(selectedFrame?.track));
				const equations = bySide.kilometer.map(get).find((placed) => placed?.kind === "staEq")?.key
					?? all.map(get).find((placed) => placed?.kind === "staEq")?.key ?? null;
				// A side is not one alignment (SCx: two Gegenrichtungsgleise over
				// different km): segments in km order, each paired with the
				// profile/cant that references it; a lone alignment keeps the
				// first-of-kind fallback so groups without relations still resolve.
				const segments = (side) => {
					const alignments = bySide[side].map(get)
						.filter((placed) => placed?.kind === "alignment")
						.map((placed) => ({ key: placed.key, range: placed.range }))
						.sort((a, b) => (a.range?.from ?? 0) - (b.range?.from ?? 0));
					return alignments.map((segment) => {
						const own = einordnungEigene(model, segment.key);
						const pick = (kind) => bySide[side].map(get).find((placed) => placed?.kind === kind && own.includes(placed.key))?.key
							?? (alignments.length === 1 ? first(side, kind) : null);
						return { ...segment, profile: pick("profile"), cant: pick("cant") };
					});
				};
				return {
					anchor: anchor.key, keys: all, bySide, first, segments, selectedRange, kmAlignment,
					rightPresent: bySide.right.length > 0, leftPresent: bySide.left.length > 0,
					referenceRequired, equations, varianten,
					hasUnknown: bySide.unknown.length > 0,
					missingKilometerLine: referenceRequired && !kmAlignment,
				};
			}
			// Suchtext of a placed object for the Grabbeltisch filter: name, file,
			// family, Lage, Höhe, Strecke, side, route and the states as words.
			function einordnungSuchtext(placed) {
				const states = [
					placed.kind === "alignment" && !placed.lsys ? "ohne lage" : "",
					placed.kind === "profile" && !placed.hsys ? "ohne höhe" : "",
					placed.hidden ? "ausgeblendet" : "sichtbar",
				];
				return [placed.name, placed.file, placed.family, placed.label, placed.lsys ?? "", placed.hsys ?? "", placed.frame?.track ? `Strecke ${placed.frame.track}` : "", placed.frame?.direction ?? "", placed.route ?? "", ...states].join(" ").toLowerCase();
			}
			// ---- Vorschläge, nie Zuordnungen -----------------------------------------
			// The Viewer shows and proposes; what is more than the files say comes
			// from the user. Nothing below assigns anything: a proposal carries its
			// reason, and it becomes a fact only when the user takes it over.
			//
			// Namensteile: a file name cut at _ - . blank and brackets. Parts that
			// name a Lage- or Höhensystem (cr0, dr0, o00, r16, dbref2016, dhhn92),
			// a way of stationing (glstat, kml, lokal), a date or a revision are
			// not part of what the Gleis is called; suppliers put them in, and a
			// GRA in another Höhensystem then misses its TRA by the plain stem
			// (metroB 5904080R_O00.GRA and 5904080R_ER0.TRA). The list is read
			// from four deliveries; it only ever feeds a proposal.
			const NAMENSTEIL_NEBENSACHE = /^(?:[a-z]r\d|[a-z]\d{2}|dbref\w*|dhhn\w*|nhn|lokal|glstat|kml|\d{6}|febr\d+|[a-c]|mitw\d+|kurz|neu|alt)$/;
			function einordnungNamensteile(fileName) {
				const stem = String(fileName ?? "").replace(/^.*\//, "").replace(/\.(tra|gra)$/i, "").toLowerCase();
				const parts = stem.split(/[_\-. ()]+/).filter(Boolean);
				// The letter stands alone, after the Strecke (5904r), after Strecke
				// and km (5904080r), or between them (2631k139, 5500s074-082).
				const match = /(?:^|[_\-])(?:\d{4})?(?:\d{3})?([lrsk])(?:[_\-]|$)/.exec(stem) ?? /\d{4}(?:\d{3})?([lrsk])(?:[_\-]|$)/.exec(stem) ?? /(?:^|[_\-])\d{4}([lrsk])\d{3}(?:[_\-]|$)/.exec(stem);
				const word = match ? null : parts.find((part) => part === "re" || part === "li" || part === "km");
				const side = match ? (match[1] === "k" ? "s" : match[1]) : word ? { re: "r", li: "l", km: "s" }[word] : null;
				return { stem, kern: parts.filter((part) => !NAMENSTEIL_NEBENSACHE.test(part)), side };
			}
			function einordnungZeichenabstand(a, b) {
				let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
				for (let i = 1; i <= a.length; i += 1) {
					const current = [i];
					for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
					previous = current;
				}
				return previous[b.length];
			}
			// Which Trasse a Gradiente without one may belong to, by the names:
			// the same Kern ("system"), the same but for one character ("zeichen",
			// a typo: dbref206 for dbref2016), most parts shared ("teile"), or only
			// a weak likeness ("schwach"). A Trasse named for the other side is
			// out: the Gradiente of 5904L never goes to 5904S, however alike the
			// rest (a plain similarity put four of them onto the Kilometerlinie).
			// eindeutig only when one name leads and the reason is not weak; with
			// several equal leaders (three deliveries of one Gleis) it is a choice.
			function einordnungGradientenVorschlag(name, kandidaten) {
				const own = einordnungNamensteile(name);
				const ownKern = own.kern.join("_");
				const ranked = [];
				for (const kandidat of kandidaten) {
					const teile = einordnungNamensteile(kandidat.name);
					if (own.side && teile.side && own.side !== teile.side) continue;
					const kern = teile.kern.join("_");
					const gleich = kern.length > 0 && kern === ownKern;
					const einZeichen = !gleich && kern.length > 3 && einordnungZeichenabstand(kern, ownKern) <= 1;
					const all = new Set([...own.kern, ...teile.kern]);
					const shared = own.kern.filter((part) => teile.kern.includes(part)).length;
					const anteil = shared / Math.max(1, all.size);
					ranked.push({ key: kandidat.key, stem: teile.stem, rang: gleich ? 3 : einZeichen ? 2 : anteil >= 0.6 ? 1 : 0, anteil });
				}
				ranked.sort((a, b) => b.rang - a.rang || b.anteil - a.anteil);
				const best = ranked[0];
				if (!best || (best.rang === 0 && best.anteil < 0.34)) return null;
				const peers = ranked.filter((item) => item.rang === best.rang && Math.abs(item.anteil - best.anteil) < 1e-9);
				const stems = [...new Set(peers.map((item) => item.stem))];
				const keysOf = (stem) => peers.filter((item) => item.stem === stem).map((item) => item.key);
				return {
					keys: keysOf(stems[0]), stem: stems[0], grund: ["schwach", "teile", "zeichen", "system"][best.rang], anteil: best.anteil,
					eindeutig: stems.length === 1 && best.rang > 0,
					auswahl: stems.length > 1 ? stems.map((stem) => ({ stem, keys: keysOf(stem) })) : [],
				};
			}
			// Bündel: what the eye does on the map. The longest line leads; a line
			// that runs along a leader for at least BUENDEL_ANTEIL of its points,
			// within BUENDEL_REICHWEITE_M, belongs to that leader's Bündel, else it
			// leads one of its own. Lines in metres: { key, length, points, line }
			// (points: the line thinned, to be tested; line: the leader's shape).
			// A way of laying the pile out, nothing more: it says which Gleise lie
			// together, not what they are.
			const BUENDEL_REICHWEITE_M = 60;
			const BUENDEL_ANTEIL = 0.5;
			function einordnungPunktAbstand(point, line) {
				let best = Infinity;
				for (let index = 0; index + 1 < line.length; index += 1) {
					const a = line[index];
					const b = line[index + 1];
					const dx = b[0] - a[0];
					const dy = b[1] - a[1];
					const lengthSq = dx * dx + dy * dy;
					const t = lengthSq > 1e-9 ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq)) : 0;
					const distance = Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
					if (distance < best) best = distance;
				}
				return best;
			}
			function einordnungBuendel(linien) {
				const boxed = linien.map((linie, index) => {
					const xs = linie.line.map((point) => point[0]);
					const ys = linie.line.map((point) => point[1]);
					return { ...linie, index, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
				}).sort((a, b) => b.length - a.length || a.index - b.index);
				const leaders = [];
				for (const linie of boxed) {
					let best = null;
					for (const leader of leaders) {
						if (linie.box[0] > leader.box[2] + BUENDEL_REICHWEITE_M || linie.box[2] < leader.box[0] - BUENDEL_REICHWEITE_M || linie.box[1] > leader.box[3] + BUENDEL_REICHWEITE_M || linie.box[3] < leader.box[1] - BUENDEL_REICHWEITE_M) continue;
						let inside = 0;
						let sum = 0;
						for (const point of linie.points) {
							const distance = einordnungPunktAbstand(point, leader.line);
							if (distance <= BUENDEL_REICHWEITE_M) { inside += 1; sum += distance; }
						}
						const share = linie.points.length ? inside / linie.points.length : 0;
						const mean = inside ? sum / inside : Infinity;
						if (share >= BUENDEL_ANTEIL && (!best || share > best.share || (share === best.share && mean < best.mean))) best = { leader, share, mean };
					}
					if (best) best.leader.members.push(linie);
					else leaders.push({ ...linie, members: [] });
				}
				return leaders.map((leader) => ({ leader: leader.key, length: leader.length, members: leader.members.sort((a, b) => a.index - b.index).map((member) => member.key) }));
			}
			// The Strecke a line's name states: the first group of exactly four
			// digits standing on its own ("6100_247-289_DBREF2016_KM" -> 6100,
			// "Ka_5810S_km-" -> 5810; not the 2016 in DBREF2016, not 705904).
			function einordnungStreckeAusName(name) {
				const match = /(?:^|[^0-9A-Za-z])(\d{4})(?![0-9])/.exec(String(name ?? ""));
				return match ? match[1] : "";
			}
			// "KM" standing on its own in a name says Kilometerlinie
			// ("6100_247-289_DBREF2016_KM"). Before a number it is the unit of a
			// km range and says nothing about the role: "Ka_5810R_km-0.2_2.5" is
			// the right Gleis from km -0,2 to 2,5. Read as a Kilometerlinie it
			// gave metroB 5810 two of them, on the same axis and 237 m apart in
			// their count.
			function einordnungNameKilometerlinie(name) {
				return /(?:^|[\s_.-])km(?:$|[\s_.-](?!\d))/.test(String(name ?? "").toLocaleLowerCase("de-DE"));
			}
			// Sortiervorschlag für ein Bündel: where its Gleise would go if the
			// user sorts the Bündel in as a whole. gleise: [{ key, declared,
			// nameSide, verdict, route }] -- declared and nameSide are what an
			// attribute and the file name say ("kilometer", "right", "left",
			// else unknown/null); verdict is the Lage beside a Kilometerlinie
			// ("left", "right", "axis", "crossing", "none") and route that line,
			// or "self" with the Gleis's own route when it is a Kilometerlinie.
			// A side comes from the Lage beside a Kilometerlinie only: measured
			// over six deliveries, left or right of any other Leitlinie is not
			// the side of the Strecke (Billwerder 1280: 21 right of the
			// Kilometerlinie, 21 left of the right-hand Streckengleis). Name and
			// Lage naming opposite sides stay, as does what crosses the line,
			// lies on it or finds none. The Strecke is the line's own, or read
			// from its name (trackAusName: a proposal the user can change).
			// Nothing here assigns: { ziele: [{ id, track, trackAusName, bezug,
			// items: [{ key, side, grund, route }], counts }], bleiben }.
			function einordnungBuendelVorschlag(gleise) {
				const ziele = new Map();
				const bleiben = { kreuzt: [], achse: [], ohne: [], widerspruch: [] };
				for (const gleis of gleise) {
					const stated = gleis.declared === "left" || gleis.declared === "right" ? gleis.declared
						: gleis.nameSide === "left" || gleis.nameSide === "right" ? gleis.nameSide : null;
					let side = null;
					let grund = "";
					if (gleis.verdict === "self") { side = "kilometer"; grund = "name"; }
					else if (!gleis.route || !gleis.verdict || gleis.verdict === "none") { bleiben.ohne.push(gleis.key); continue; }
					else if (gleis.verdict === "left" || gleis.verdict === "right") {
						if (stated && stated !== gleis.verdict) { bleiben.widerspruch.push(gleis.key); continue; }
						side = gleis.verdict;
						grund = stated ? "name+lage" : "lage";
					} else if (stated) { side = stated; grund = "name"; }
					else { bleiben[gleis.verdict === "axis" ? "achse" : "kreuzt"].push(gleis.key); continue; }
					const route = String(gleis.route ?? "");
					const known = einordnungStreckennummer(route);
					const track = known ? route : einordnungStreckeAusName(route);
					const id = track || route;
					if (!ziele.has(id)) ziele.set(id, { id, track, trackAusName: !known && Boolean(track), bezug: [], items: [], counts: { kilometer: 0, left: 0, right: 0 } });
					const ziel = ziele.get(id);
					if (side !== "kilometer" && !ziel.bezug.includes(route)) ziel.bezug.push(route);
					ziel.items.push({ key: gleis.key, side, grund, route });
					ziel.counts[side] += 1;
				}
				return { ziele: [...ziele.values()], bleiben };
			}
			// END EINORDNUNG

			// The adapter: facts from the entries and the decisions on them, the
			// model cached until something changes (einordnungGeaendert()).
			// The adapter, in two stages. Stage one, the Bezüge: who references
			// whom, from the files alone; it changes only when files come or go.
			// Stage two, the full model: facts from the resolvers and the
			// decisions on the objects, cached until einordnungGeaendert(). The
			// resolvers ask stage one (relatedDiagramEntries, referencingEntries),
			// never stage two, so building the model cannot call itself.
			let einordnungCache = null;
			let einordnungStamp = 0;
			function einordnungGeaendert() {
				einordnungStamp += 1;
			}
			// One key per object for the model's lifetime. The saved-state key
			// (file|id) is not unique: Billwerder delivers the same files in two
			// folders, and two copies of one object must stay two objects here.
			const einordnungKeys = new WeakMap();
			let einordnungKeySequence = 0;
			function einordnungKey(entry) {
				let key = einordnungKeys.get(entry);
				if (!key) {
					einordnungKeySequence += 1;
					key = `${stateKey(entry)}#${einordnungKeySequence}`;
					einordnungKeys.set(entry, key);
				}
				return key;
			}
			let bezuegeCache = null;
			let bezuegeStamp = 0;
			function einordnungBezuegeStand() {
				const cached = bezuegeCache;
				if (cached && cached.stamp === bezuegeStamp && cached.files.length === loadedFiles.length && loadedFiles.every((loaded, index) => loaded === cached.files[index] && loaded.objects.length === cached.counts[index][0] && (loaded.relations?.length ?? 0) === cached.counts[index][1])) return cached;
				const entries = allViewerEntries();
				const keyOf = einordnungKey;
				// References are resolved inside the file that states them: ids are
				// positions in a file (alignment_gnd_coordgeom_146), and two
				// deliveries use one id for different Gleise (Billwerder
				// 6100_246-289: km 247-282 in one, km 284-289 in the other). Only a
				// reference that finds nothing in its own file looks further; the
				// VermEsn pairing by file stem is across files by design.
				const refKeys = new Map(entries.map((entry) => [entry, []]));
				const origin = new Map();
				const everywhere = new Map();
				for (const entry of entries) {
					if (!everywhere.has(entry.item.id)) everywhere.set(entry.item.id, []);
					everywhere.get(entry.item.id).push(entry);
				}
				const link = (from, to, stem, detail, user = false) => {
					const list = refKeys.get(from);
					const key = keyOf(to);
					if (list.includes(key)) {
						// One pair, one reference; a stem pairing on top is remembered.
						if (stem) origin.get(`${keyOf(from)}>${key}`).stem = true;
						return;
					}
					list.push(key);
					origin.set(`${keyOf(from)}>${key}`, { stem, detail, user });
				};
				for (const loaded of loadedFiles) {
					const here = new Map();
					for (const entry of loaded.objects) {
						if (!here.has(entry.item.id)) here.set(entry.item.id, []);
						here.get(entry.item.id).push(entry);
					}
					for (const relation of loaded.relations ?? []) {
						if (relation.type !== "stationReference") continue;
						const sources = here.get(relation.fromId) ?? everywhere.get(relation.fromId) ?? [];
						const targets = here.get(relation.toId) ?? everywhere.get(relation.toId) ?? [];
						for (const from of sources) for (const to of targets) if (from !== to) link(from, to, false, relation.method ?? relation.reason ?? "");
					}
				}
				for (const relation of stemPairedRelations()) {
					for (const from of everywhere.get(relation.fromId) ?? []) for (const to of everywhere.get(relation.toId) ?? []) if (from !== to) link(from, to, true, "");
				}
				// What the user said: a Gradiente given to a Trasse by hand
				// (entry.userTrasse, the Trasse's saved key). The only reference the
				// files do not state themselves.
				const bySavedKey = new Map();
				for (const entry of entries) if (!bySavedKey.has(stateKey(entry))) bySavedKey.set(stateKey(entry), entry);
				for (const entry of entries) {
					const trasse = entry.userTrasse ? bySavedKey.get(entry.userTrasse) : null;
					if (trasse && trasse !== entry) link(entry, trasse, false, "per Hand", true);
				}
				const homeOf = new Map(loadedFiles.map((loaded) => [loaded, loaded.objects.find((candidate) => candidate.item.kind === "alignment") ?? null]));
				const nodes = entries.map((entry) => {
					const home = homeOf.get(entry.loaded);
					return { key: keyOf(entry), kind: entry.item.kind, refKeys: refKeys.get(entry), homeKey: home ? keyOf(home) : null };
				});
				bezuegeCache = {
					stamp: bezuegeStamp,
					files: [...loadedFiles],
					counts: loadedFiles.map((loaded) => [loaded.objects.length, loaded.relations?.length ?? 0]),
					model: einordnungBezuege(nodes),
					entries: new Map(entries.map((entry) => [keyOf(entry), entry])),
					nodes: new Map(entries.map((entry, index) => [entry, nodes[index]])),
					origin,
				};
				return bezuegeCache;
			}
			function einordnung() {
				const bezuege = einordnungBezuegeStand();
				if (einordnungCache && einordnungCache.stamp === einordnungStamp && einordnungCache.bezuege === bezuege) return einordnungCache.model;
				const facts = allViewerEntries().map((entry) => {
					const node = bezuege.nodes.get(entry);
					const sequence = gndSequenceForEntry(entry);
					const frame = geoFrameInfo(entry);
					return {
						key: node.key, kind: node.kind, name: objectListName(entry), file: entry.loaded?.fileName ?? "",
						family: sourceFamilyForEntry(entry), label: familyForEntry(entry), route: routeForEntry(entry) ?? "",
						gnd: isGndEntry(entry), gndSequence: Boolean(sequence), gndFamily: sequence?.family ?? null, gndRoute: sequence?.strRikz ?? null,
						organized: isOutboxOrganized(entry), hidden: isEntryHidden(entry),
						lsys: effectiveLsys(entry) || null, hsys: systemsForEntry(entry).hsys || null,
						frame: frame ? { track: frame.track, direction: frame.direction, segment: frame.segment ?? null, source: frame.source, lsys: frame.lsys ?? null } : null,
						side: sevenLineSide(entry), range: stationRangeForEntry(entry),
						refKeys: node.refKeys, homeKey: node.homeKey,
						role: sevenLineRole(entry), section: explicitSectionForEntry(entry) || "",
						kmFrame: (isGndEntry(entry) && !(gndEigenstationiert(entry) && frame?.source === "user" && !kmAbbildungPairs(entry))) || Boolean(entry.externalStationReference) || ((frame?.source === "vermesn-name" || frame?.source === "user") && entry.item.kind === "alignment" && sevenLineSide(entry) === "kilometer"),
					};
				});
				einordnungCache = { model: einordnen(facts), bezuege, stamp: einordnungStamp };
				return einordnungCache.model;
			}
			function einordnungEintrag(key) {
				return key == null ? null : einordnungBezuegeStand().entries.get(key) ?? null;
			}
			// Proposals for Gradienten without a Trasse (VermEsn, on the pile), by
			// the names: entry -> { trassen, grund, eindeutig, auswahl }. Proposals
			// only; gradienteZuordnen() is the user taking one over.
			let vorschlagCache = null;
			function gradientenVorschlaege() {
				const model = einordnung();
				if (vorschlagCache?.model === model) return vorschlagCache.map;
				const kandidaten = allViewerEntries().filter((entry) => entry.parser === "vermEsn" && entry.item.kind === "alignment").map((entry) => ({ key: einordnungKey(entry), name: entry.loaded?.fileName ?? "" }));
				const map = new Map();
				for (const key of model.pile) {
					const placed = model.objects.get(key);
					const entry = einordnungEintrag(key);
					if (!entry || !placed?.orphan || entry.parser !== "vermEsn" || entry.item.kind !== "profile") continue;
					const vorschlag = einordnungGradientenVorschlag(entry.loaded?.fileName ?? "", kandidaten);
					if (!vorschlag) continue;
					map.set(entry, {
						...vorschlag,
						trassen: vorschlag.keys.map(einordnungEintrag).filter(Boolean),
						auswahl: vorschlag.auswahl.map((item) => ({ stem: item.stem, trassen: item.keys.map(einordnungEintrag).filter(Boolean) })),
					});
				}
				vorschlagCache = { model, map };
				return map;
			}
			function gradientenVorschlagText(vorschlag) {
				return { system: "Name gleich bis auf System/Variante", zeichen: "Name bis auf ein Zeichen gleich", teile: `Namensteile zu ${Math.round(vorschlag.anteil * 100)} % gleich`, schwach: "nur schwache Namensähnlichkeit" }[vorschlag.grund];
			}
			// The Abbildung of a Gleis onto its Kilometerlinie, dropped: the Gleis
			// and what was stationed with it read their own stations again.
			function kmAbbildungLoesen(target) {
				for (const sibling of referencingEntries(target)) {
					if (sibling.kmAbbildung?.owner !== target) continue;
					delete sibling.kmAbbildung;
					listingCache.delete(sibling);
				}
				delete target.kmAbbildung;
				target.externalStationReference = undefined;
				listingCache.delete(target);
			}
			// The user gives Gradienten to Trassen (pairs of { profile, trasse }),
			// or takes one back. The Trasse's Abbildung is renewed so that the
			// Gradiente is stationed with its Trasse.
			function trassenAbbildungErneuern(trassen) {
				const vermEsn = trassen.filter((trasse) => trasse?.parser === "vermEsn");
				for (const trasse of vermEsn) if (trasse.externalStationReference) kmAbbildungLoesen(trasse);
				if (vermEsn.length) reconcileVermEsnStationing();
			}
			function gradienteZuordnen(pairs) {
				const taken = pairs.filter((pair) => pair?.profile && pair?.trasse);
				if (!taken.length) return;
				for (const { profile, trasse } of taken) {
					profile.userTrasse = stateKey(trasse);
					listingCache.delete(profile);
				}
				bezuegeStamp += 1;
				einordnungGeaendert();
				trassenAbbildungErneuern(taken.map((pair) => pair.trasse));
				status.classList.remove("error");
				status.textContent = taken.length === 1
					? `${objectListName(taken[0].profile)} gehört jetzt zu ${objectListName(taken[0].trasse)} · von Hand zugeordnet`
					: `${taken.length} Gradienten ihren Trassen zugeordnet · von Hand übernommen`;
				renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
				if (selectedEntry?.button) selectObject(selectedEntry, selectedEntry.button);
			}
			function gradienteLoesen(profile) {
				const trasse = allViewerEntries().find((candidate) => stateKey(candidate) === profile.userTrasse) ?? null;
				delete profile.userTrasse;
				if (profile.kmAbbildung) delete profile.kmAbbildung;
				listingCache.delete(profile);
				bezuegeStamp += 1;
				einordnungGeaendert();
				if (trasse) trassenAbbildungErneuern([trasse]);
				status.classList.remove("error");
				status.textContent = `${objectListName(profile)} wieder ohne Trasse`;
				renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
				if (selectedEntry?.button) selectObject(selectedEntry, selectedEntry.button);
			}
			// Bündel of all Trassen with a Lage on the map (einordnungBuendel), in
			// metres around the delivery's middle. Recomputed when files or Lage
			// decisions change, not on every render.
			let buendelCache = null;
			function buendelStand() {
				const bezuege = einordnungBezuegeStand();
				const trassen = allViewerEntries().filter((entry) => entry.item.kind === "alignment");
				const signature = trassen.map((entry) => effectiveLsys(entry) || "-").join("|");
				if (buendelCache && buendelCache.bezuege === bezuege && buendelCache.signature === signature) return buendelCache;
				const located = trassen.map((entry) => ({ entry, coordinates: interpretedGeometry(entry).coordinates ?? [] })).filter((item) => item.coordinates.length >= 2);
				const of = new Map();
				let buendel = [];
				if (located.length) {
					const lat0 = located.reduce((sum, item) => sum + item.coordinates[0][1], 0) / located.length;
					const lon0 = located.reduce((sum, item) => sum + item.coordinates[0][0], 0) / located.length;
					const kx = 111320 * Math.cos(lat0 * Math.PI / 180);
					const ky = 110540;
					const thin = (points, most) => { const step = Math.max(1, Math.ceil(points.length / most)); return points.filter((_, index) => index % step === 0 || index === points.length - 1); };
					const linien = located.map(({ entry, coordinates }) => {
						const xy = coordinates.map(([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky]);
						// The length the file itself states (its elements), not the one
						// measured on the map: a guessed Lagesystem can stretch the latter.
						const length = (entry.item.payload.coordGeom?.elements ?? []).reduce((sum, element) => sum + (Math.abs(numberValue(element.length)) || 0), 0);
						return { key: einordnungKey(entry), length, points: thin(xy, 100), line: thin(xy, 400) };
					});
					buendel = einordnungBuendel(linien).map((item, index) => {
						const leader = einordnungEintrag(item.leader);
						const members = [leader, ...item.members.map(einordnungEintrag)].filter(Boolean);
						const group = { id: `b:${stateKey(leader)}`, index, leader, length: item.length, members };
						for (const member of members) of.set(member, group);
						return group;
					});
				}
				buendelCache = { bezuege, signature, buendel, of };
				return buendelCache;
			}
			// Sortiervorschlag (einordnungBuendelVorschlag) for Trassen of the
			// pile: each with what its name says and where it lies beside a
			// Kilometerlinie. A proposal only; buendelEinsortieren() is the user
			// taking it over.
			function buendelVorschlag(entries) {
				const seite = { r: "right", l: "left", s: "kilometer" };
				const gleise = entries.filter((entry) => entry.item.kind === "alignment" && !isOutboxOrganized(entry)).map((entry) => {
					const declared = declaredSide(entry).side;
					const nameSide = entry.parser === "vermEsn" ? seite[einordnungNamensteile(entry.loaded?.fileName ?? "").side] ?? null : null;
					const isKilometer = declared === "kilometer" || (declared === "unknown" && nameSide === "kilometer");
					const lage = isKilometer ? null : lageWitnessVorschlag(entry);
					return {
						key: einordnungKey(entry), declared, nameSide,
						verdict: isKilometer ? "self" : lage?.verdict ?? "none",
						route: String(isKilometer ? routeForEntry(entry) || objectDisplayName(entry) : lage?.route ?? ""),
					};
				});
				return einordnungBuendelVorschlag(gleise);
			}
			const BUENDEL_SPUR = { kilometer: "curvatureKilometer", right: "curvatureRight", left: "curvatureLeft" };
			function buendelVorschlagGrund(entry, item) {
				if (item.side === "kilometer") return `laut ${declaredSide(entry).source ?? "Dateiname"}`;
				const lage = lagePositionText(lageWitnessVorschlag(entry));
				return item.grund === "name" ? `Seite aus dem Namen${lage ? ` · ${lage}` : ""}`
					: item.grund === "name+lage" ? `${lage} · der Name sagt dasselbe`
					: lage;
			}
			// The user sorts Trassen into a Strecke, each onto the side given
			// (items: [{ entry, side }]) -- the same as dragging each onto its
			// Spur. What stood before is kept so that the last take-over can be
			// taken back as a whole.
			let buendelRuecknahmen = [];
			function buendelEinsortieren(items, track) {
				const strecke = String(track ?? "").trim();
				const before = [];
				if (!strecke) return;
				for (const { entry, side } of items) {
					const groupDef = SEVEN_LINE_GROUPS.find((group) => group.role === BUENDEL_SPUR[side]);
					if (!entry || !groupDef || entry.item.kind !== "alignment") continue;
					const frameEdit = { track: strecke, direction: groupDef.direction, lsys: effectiveLsys(entry) || "LSYS?", hsys: systemsForEntry(entry).hsys || "HSYS?", source: "user" };
					before.push({ entry, frameEdit, userFamily: entry.userFamily, userLineRole: entry.userLineRole, previousFrame: entry.frameEdit, organizationEdit: entry.organizationEdit, stationReference: entry.externalStationReference });
					entry.userFamily = groupDef.family;
					entry.userLineRole = groupDef.role;
					entry.frameEdit = frameEdit;
					entry.organizationEdit = { family: groupDef.family, lineRole: groupDef.role, source: "user", originalFamily: sourceFamilyForEntry(entry) };
				}
				if (!before.length) return;
				const name = isValidRouteNumber(strecke) ? `Strecke ${strecke}` : strecke;
				const taken = { before, text: before.length === 1 ? `${objectListName(before[0].entry)} nach ${name}` : `${before.length} Gleise nach ${name}` };
				buendelRuecknahmen.push(taken);
				einordnungGeaendert();
				// Sorted in, a Gleis is stationed on its Strecke's Kilometerlinie.
				reconcileVermEsnStationing();
				dragHintUsed = true;
				status.classList.remove("error");
				const ohneLinie = before.filter((item) => item.entry.kmHinweis && item.entry.kmHinweis.art !== "fern" && item.entry.kmHinweis.art !== "stuecke").length;
				status.textContent = `${taken.text} einsortiert · von Hand übernommen${ohneLinie ? ` · ${ohneLinie} an keiner Kilometerlinie der Strecke (in der Outbox markiert, Grund im Tooltip und über dem Bild)` : ""}`;
				renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
				if (selectedEntry?.button) selectObject(selectedEntry, selectedEntry.button);
			}
			// Takes the last take-over back, then the one before it; a Gleis the
			// user has moved on by hand since keeps what it has now.
			function buendelZuruecknehmen() {
				const taken = buendelRuecknahmen.pop();
				if (!taken) return;
				let count = 0;
				for (const item of taken.before) {
					if (item.entry.frameEdit !== item.frameEdit) continue;
					for (const [field, value] of [["userFamily", item.userFamily], ["userLineRole", item.userLineRole], ["frameEdit", item.previousFrame], ["organizationEdit", item.organizationEdit]]) {
						if (value === undefined) delete item.entry[field];
						else item.entry[field] = value;
					}
					// Its stationing on the Strecke goes with it.
					if (item.entry.externalStationReference !== item.stationReference && item.entry.externalStationReference) kmAbbildungLoesen(item.entry);
					count += 1;
				}
				einordnungGeaendert();
				reconcileVermEsnStationing();
				status.classList.remove("error");
				status.textContent = `${count} ${count === 1 ? "Gleis liegt" : "Gleise liegen"} wieder im Haufen`;
				renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
				if (selectedEntry?.button) selectObject(selectedEntry, selectedEntry.button);
			}
			// The 7L Spur of an entry as the model has it.
			function einordnungRolle(entry) {
				return einordnung().objects.get(einordnungKey(entry))?.role ?? "UNASSIGNED";
			}

			// What a Trasse that stands back is to the others of its Spur: a
			// Variante (it lies on one of them) or another Gleis beside them.
			// Measured against the Trassen of the same Strecke and Spur that cover
			// its km and rank before it (longer, or earlier in the delivery), so
			// of two deliveries of one Bahnhofsgleis the first is the Gleis and
			// the second its Variante; and always against the one in the picture.
			function nebenArt(entry, wegen) {
				const model = einordnung();
				const self = model.objects.get(einordnungKey(entry));
				const wegenKey = wegen ? einordnungKey(wegen) : null;
				if (!self) return { art: "offen", zu: wegen ?? null, abstand: null, anteil: null };
				const state = lageState();
				state.linien ??= new Map();
				state.neben ??= new Map();
				const linie = (candidate) => {
					if (!state.linien.has(candidate)) {
						const polyline = alignmentEndpoints(candidate) ? referenceStationPolyline(candidate, 10) : null;
						state.linien.set(candidate, polyline && polyline.length > 1 ? { polyline } : null);
					}
					return state.linien.get(candidate);
				};
				const order = [...model.objects.keys()];
				const length = (placed) => placed.range ? placed.range.to - placed.range.from : -1;
				const before = (placed) => length(placed) > length(self) || (length(placed) === length(self) && order.indexOf(placed.key) < order.indexOf(self.key));
				const own = linie(entry);
				const messungen = [];
				for (const placed of model.objects.values()) {
					if (placed.key === self.key || placed.kind !== "alignment" || placed.role !== self.role) continue;
					if (String(placed.frame?.track ?? "") !== String(self.frame?.track ?? "") || Boolean(placed.kmFrame) !== Boolean(self.kmFrame) || !einordnungUeberdeckt(placed.range, self.range)) continue;
					if (placed.key !== wegenKey && !before(placed)) continue;
					const other = einordnungEintrag(placed.key);
					if (!other || !own || !linie(other) || (effectiveLsys(other) || "") !== (effectiveLsys(entry) || "")) continue;
					const id = `${entry.item.id}|${other.item.id}`;
					if (!state.neben.has(id)) state.neben.set(id, lageAbstandOf(own.polyline, linie(other)));
					const messung = state.neben.get(id);
					if (messung) messungen.push({ key: placed.key, ...messung });
				}
				const result = einordnungNebenArt(messungen, wegenKey);
				return { ...result, zu: (result.zu ? einordnungEintrag(result.zu) : null) ?? wegen ?? null };
			}
			const NEBEN_MARKE = { variante: "Variante", gleis: "weiteres Gleis", offen: "gleiche km" };
			function nebenText(entry, neben) {
				const zu = neben.zu ? objectListName(neben.zu) : "einer anderen Trasse";
				if (neben.art === "variante") {
					if (neben.zu && objectListName(entry) === zu) return `zweite Lieferung desselben Objekts (${entry.loaded?.fileKey ?? entry.loaded?.fileName ?? "?"})`;
					const teil = neben.anteil < NEBEN_MIN_ANTEIL ? ` auf ${Math.round(neben.anteil * 100)} % ihrer Länge` : "";
					return `Variante: liegt${teil} auf ${zu}${neben.abstand.max >= 0.05 ? `, Abstand bis ${lageMeters(neben.abstand.max)} m` : ""}`;
				}
				if (neben.art === "gleis") {
					if (!neben.abstand) return `anderes Gleis dieser Seite, nicht in ${LAGE_REACH_M} m neben ${zu}`;
					const spanne = neben.abstand.max - neben.abstand.min > 0.5 ? ` (${lageMeters(neben.abstand.min)}–${lageMeters(neben.abstand.max)} m)` : "";
					return `anderes Gleis dieser Seite, ${lageMeters(neben.abstand.median)} m neben ${zu}${spanne}`;
				}
				return `belegt dieselben km wie ${zu}; die Lage sagt nichts dazu (keine Koordinaten oder ein anderes Lagesystem)`;
			}
			// "2 Varianten, 5 weitere Gleise" for what stands back in a picture.
			function nebenZaehlung(items) {
				const count = { variante: 0, gleis: 0, offen: 0 };
				for (const item of items) count[nebenArt(item.entry, item.wegen).art] += 1;
				return [
					count.variante ? `${count.variante} ${count.variante === 1 ? "Variante" : "Varianten"}` : null,
					count.gleis ? `${count.gleis} ${count.gleis === 1 ? "weiteres Gleis" : "weitere Gleise"}` : null,
					count.offen ? `${count.offen} mit gleichen km` : null,
				].filter(Boolean).join(", ");
			}
			// The Trassen that stand back on one side, as lines beside the Trasse
			// in the picture: each one's distance from it over its km. Measured
			// against the Trasse it stands back for, in that Trasse's stations
			// as they are now (the km of a Gleis sorted in by hand can change).
			// A band only where another Gleis lies beside it; a Variante alone
			// lies on the line and would be a band at 0.
			const nebenSeite = (value) => `${lageMeters(Math.abs(value))} m${Math.abs(value) < 0.05 ? "" : value > 0 ? " links" : " rechts"}`;
			function nebenBand(gleis, items, selectedRange) {
				const others = new Map();
				const other = (entry) => {
					if (!others.has(entry)) {
						const polyline = alignmentEndpoints(entry) ? referenceStationPolyline(entry, 10) : [];
						others.set(entry, polyline.length > 1 ? { polyline } : null);
					}
					return others.get(entry);
				};
				const lines = [];
				for (const item of items) {
					const neben = nebenArt(item.entry, item.wegen);
					if (neben.art === "offen" || (effectiveLsys(item.entry) || "") !== (effectiveLsys(item.wegen) || "")) continue;
					const own = lageState().linien?.get(item.entry)?.polyline ?? (alignmentEndpoints(item.entry) ? referenceStationPolyline(item.entry, 10) : null);
					const points = clipPointsToRange(lageAbstandReihe(own, other(item.wegen)), selectedRange);
					if (!points.length) continue;
					const name = objectListName(item.entry);
					lines.push({
						entry: item.entry, art: neben.art, name, points,
						title: `${name} · ${nebenText(item.entry, neben)}\nAnklicken: dann steht dieses Gleis im Bild`,
						pick: () => { if (item.entry.button) selectObject(item.entry, item.entry.button); },
					});
				}
				if (!lines.some((line) => line.art === "gleis")) return null;
				return makeBand(`${gleis} · daneben · Abstand a [m] zur Trasse im Bild, links +`, "diagram-neben", lines.flatMap((line) => line.points), {
					lines, zeroLine: true, derived: true,
					axisFormat: nebenSeite,
					valueLabel: "a (m), links +",
					valueFormat: (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2).replace(".", ",")}`,
				});
			}

			// The 7L picture of an entry, read from the Einordnung: the same shape
			// the Ableitungen below have always consumed, keys mapped back to entries.
			function sevenLineAssignment(entry) {
				const model = einordnung();
				const umfeld = einordnungUmfeld(model, einordnungKey(entry));
				if (!umfeld) {
					return { anchor: entry, entries: [entry], bySide: { kilometer: [], right: [], left: [], unknown: [entry] }, first: () => null, segments: () => [], selectedRange: stationRangeForEntry(entry), kmAlignment: null, rightPresent: false, leftPresent: false, referenceRequired: false, equations: null, varianten: [], hasUnknown: true, missingKilometerLine: false };
				}
				const get = (key) => einordnungEintrag(key);
				const entries = umfeld.keys.map(get).filter(Boolean);
				const bySide = Object.fromEntries(Object.entries(umfeld.bySide).map(([side, keys]) => [side, keys.map(get).filter(Boolean)]));
				const first = (side, kind) => get(umfeld.first(side, kind));
				const segments = (side) => umfeld.segments(side).map((segment) => ({ alignment: get(segment.key), range: segment.range, profile: get(segment.profile), cant: get(segment.cant) })).filter((segment) => segment.alignment);
				return {
					anchor: get(umfeld.anchor) ?? entry, entries, bySide, first, segments, selectedRange: umfeld.selectedRange,
					kmAlignment: get(umfeld.kmAlignment), rightPresent: umfeld.rightPresent, leftPresent: umfeld.leftPresent,
					referenceRequired: umfeld.referenceRequired, equations: get(umfeld.equations),
					varianten: umfeld.varianten.map((item) => ({ side: item.side, entry: get(item.key), wegen: get(item.wegen) })).filter((item) => item.entry && item.wegen),
					hasUnknown: umfeld.hasUnknown, missingKilometerLine: umfeld.missingKilometerLine,
				};
			}

			// ---- Ableitungen über der Zuordnung -----------------------------------
			// Each takes the assignment and returns bands; none of them looks at
			// loadedFiles, frames, or relations itself. sevenLineTracks() below
			// concatenates them in the order the diagram has always shown.
			const makeBand = (label, className, points, extra = {}) => ({ label, className, points, ...extra });

			// BEGIN GRA CANT RAMPS (test/technet-viewer-gra.test.mjs runs this block)
			// Überhöhungsrampen aus der GRA im Überhöhungsband. A GRA ramp record
			// names Rampenanfang, Wendepunkt (Schnittpunkt) and Rampenende with
			// u1 and u2 as magnitudes: the Rampe runs from u1 on the one Bogen
			// through 0 at the Wendepunkt to u2 on the Gegenbogen. The sign comes
			// from the Krümmung of the Trasse (positive = Rechtsbogen, as the
			// Krümmungsband draws it), and the Überhöhung band is signed the same
			// way, so a Rampe through the Wendepunkt is one straight line, not a V.
			// Without a Trasse the Rampe starts positive by convention and the
			// footnote says so. Pure: series in, series out.
			const CANT_RAMP_SLOPE_TOLERANCE = 0.02; // the two legs of one Rampe, relative
			const CANT_RAMP_CANT_TOLERANCE_MM = 5; // Trasse's Überhöhung against the Rampe
			// Value of a band at x: linear between neighbours, or the left
			// neighbour for step bands (speed); null across a gap or outside.
			function bandValueAt(points, x, step) {
				for (let index = 0; index + 1 < points.length; index += 1) {
					const a = points[index];
					const b = points[index + 1];
					if (x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x) || b.gap) continue;
					if (step || a.x === b.x) return a.y;
					return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
				}
				return null;
			}
			function curvatureSignAt(curvature, x) {
				const kappa = bandValueAt(curvature ?? [], x, false);
				return kappa == null || Math.abs(kappa) < 1e-9 ? 0 : Math.sign(kappa);
			}
			// A cant point at station x belongs to the element that starts there,
			// so its sign is read just inside that element; on a Gerade (κ = 0)
			// the sign of the element before it, else the previous point's.
			function signedCantSeries(points, curvature) {
				let carried = 1;
				return points.map((point) => {
					if (!point.y) return point;
					const sign = curvatureSignAt(curvature, point.x + 0.01) || curvatureSignAt(curvature, point.x - 0.01) || carried;
					carried = sign;
					return { ...point, y: sign * point.y };
				});
			}
			// One object per Rampe: the three points and what the footnote says.
			function cantRampSeries(ramps, curvature, mapStation = (value) => value) {
				const out = [];
				const numeric = (value) => value == null || value === "" ? NaN : Number(value); // Number(null) is 0, a km 0 that is not there
				for (const ramp of ramps ?? []) {
					const x1 = mapStation(numeric(ramp?.rampEnd1Station));
					const xa = mapStation(numeric(ramp?.rampIntersectionStation));
					const x2 = mapStation(numeric(ramp?.rampEnd2Station));
					const u1 = Math.abs(numeric(ramp?.cant1Millimetres));
					const u2 = Math.abs(numeric(ramp?.cant2Millimetres));
					if (![x1, xa, x2, u1, u2].every(Number.isFinite)) continue;
					let s1 = curvatureSignAt(curvature, (x1 + xa) / 2);
					let s2 = curvatureSignAt(curvature, (xa + x2) / 2);
					const sideKnown = Boolean(s1 || s2);
					if (!s1 && !s2) { s1 = 1; s2 = -1; }
					else if (!s1) s1 = -s2;
					else if (!s2) s2 = -s1;
					out.push({
						x1, xa, x2, u1: s1 * u1, u2: s2 * u2, form: ramp?.rampCode ?? null, sideKnown,
						slope1: u1 ? (xa - x1) / (u1 / 1000) : null,
						slope2: u2 ? (x2 - xa) / (u2 / 1000) : null,
						points: [{ x: x1, y: s1 * u1, gap: true }, { x: xa, y: 0 }, { x: x2, y: s2 * u2 }],
					});
				}
				return out.sort((a, b) => a.x1 - b.x1);
			}
			function rampPoints(ramps) {
				return ramps.flatMap((ramp) => ramp.points);
			}
			// The Trasse's own Überhöhung (TRA/GND/landXML series) read at the three
			// points of each Rampe; a Rampe whose cant series is silent there is
			// reported as such, not as a deviation.
			function cantRampFootnote(head, ramps, cantSeries, formatStation) {
				const mm = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.round(Math.abs(value))}`;
				const slope = (value) => value == null ? "–" : `1:${Math.round(value)}`;
				const lines = ramps.map((ramp) => {
					const legs = ramp.slope1 != null && ramp.slope2 != null && Math.abs(ramp.slope1 - ramp.slope2) > CANT_RAMP_SLOPE_TOLERANCE * Math.max(ramp.slope1, ramp.slope2) ? ` (ungleich)` : "";
					const checks = [[ramp.x1, ramp.u1, "am Rampenanfang"], [ramp.xa, 0, "am Wendepunkt"], [ramp.x2, ramp.u2, "am Rampenende"]]
						.map(([x, u, where]) => { const value = bandValueAt(cantSeries ?? [], x, false); return value == null ? null : { delta: value - u, where }; });
					const silent = checks.every((check) => check == null);
					const worst = checks.filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
					const verdict = silent ? "ohne Überhöhungsreihe der Trasse"
						: Math.abs(worst.delta) > CANT_RAMP_CANT_TOLERANCE_MM ? `Trasse weicht ab: Δu ${mm(worst.delta)} mm ${worst.where}`
						: "Trasse deckt sich";
					return `${formatStation(ramp.x1)} → ${formatStation(ramp.x2)} · u ${mm(ramp.u1)} → ${mm(ramp.u2)} mm · Wendepunkt ${formatStation(ramp.xa)} · Neigung ${slope(ramp.slope1)} | ${slope(ramp.slope2)}${legs} · ${verdict}`;
				});
				const forms = [...new Set(ramps.map((ramp) => ramp.form).filter((form) => form != null))];
				const sides = ramps.every((ramp) => ramp.sideKnown) ? "Vorzeichen aus der Krümmung der Trasse, Rechtsbogen +" : "ohne Trasse: Seite der Rampe unbestimmt, Anfang als Rechtsbogen gezeichnet";
				lines.push(`Form ${forms.length ? forms.join(", ") : "–"}: Kennzahl der GRA; in jeder bekannten Lieferung eine gerade Rampe mit einer Neigung durch den Wendepunkt des Gegenbogens · ${sides}`);
				return { head: `${head} · Überhöhungsrampen aus der GRA (${ramps.length}${forms.length ? ` · Form ${forms.join(", ")}` : ""})`, lines };
			}
			// END GRA CANT RAMPS

			// BEGIN DIAGRAM WINDOW (test/technet-viewer-gra.test.mjs runs this block with the one above)
			// Ausschnitt: a station window narrower than the picture's full extent,
			// as the Spurplan has it. Pure: the extent and what the reader chose in,
			// the window to draw out. A stored window that does not touch the extent
			// (another Abschnitt of the Strecke) is no Ausschnitt of this picture.
			const DIAGRAM_MIN_WINDOW_M = 50;
			function windowWithin(full, zoom, minSpan = DIAGRAM_MIN_WINDOW_M) {
				const fullSpan = full.xMax - full.xMin;
				const whole = { xMin: full.xMin, xMax: full.xMax, zoomed: false };
				if (!zoom || !(fullSpan > 0) || zoom.xMax <= full.xMin || zoom.xMin >= full.xMax) return whole;
				const span = Math.min(fullSpan, Math.max(minSpan, zoom.xMax - zoom.xMin));
				if (span >= fullSpan - 1e-6) return whole;
				const xMin = Math.max(full.xMin, Math.min(zoom.xMin, full.xMax - span));
				return { xMin, xMax: xMin + span, zoomed: true };
			}
			// One wheel step around the station under the mouse, which keeps its
			// place; null when the step shows everything again.
			function windowZoomed(shown, full, at, factor, minSpan = DIAGRAM_MIN_WINDOW_M) {
				const span = shown.xMax - shown.xMin;
				const fullSpan = full.xMax - full.xMin;
				const next = Math.max(Math.min(minSpan, fullSpan), Math.min(fullSpan, span * factor));
				if (!(span > 0) || next >= fullSpan - 1e-6) return null;
				const xMin = Math.max(full.xMin, Math.min(full.xMax - next, at - (at - shown.xMin) * next / span));
				return { xMin, xMax: xMin + next };
			}
			function windowShifted(shown, full, shift) {
				const span = shown.xMax - shown.xMin;
				const xMin = Math.max(full.xMin, Math.min(full.xMax - span, shown.xMin + shift));
				return { xMin, xMax: xMin + span };
			}
			// What a series takes inside a window: its points there and its values
			// at the two edges, so a line that only crosses the window still sets
			// the scale. null where the series is silent.
			function seriesRangeIn(points, xMin, xMax) {
				let min = Infinity;
				let max = -Infinity;
				const take = (y) => { if (y != null && Number.isFinite(y)) { min = Math.min(min, y); max = Math.max(max, y); } };
				for (const point of points) if (point.x >= xMin && point.x <= xMax) take(point.y);
				take(bandValueAt(points, xMin, false));
				take(bandValueAt(points, xMax, false));
				return Number.isFinite(min) ? { min, max } : null;
			}
			// END DIAGRAM WINDOW

			// IVMG · Trassenplan rows for the assigned sides. Order (Uwe, 09.11.):
			// the Kilometerlinie leads when there is one, then each Gleis as a
			// block -- its Trasse (Krümmung) with the Überhöhung and the Gradiente
			// directly under it -- Richtungsgleis (rechts) before Gegenrichtungsgleis.
			function deriveTrassenplanBands(assignment) {
				const { first, segments, selectedRange, kmAlignment, rightPresent, leftPresent, referenceRequired, equations, varianten = [] } = assignment;
				const definitions = [
					["kilometer", "alignment", "Kilometerlinie · Krümmung κ [1/m], rechts +", "diagram-curvature", null],
					["right", "alignment", "Rechtes Gleis · Krümmung κ [1/m], rechts +", "diagram-curvature", null],
					["right", "cant", "Rechtes Gleis · Überhöhung u [mm], Rechtsbogen +", "diagram-cant", CANT_VALUE_KEYS],
					["right", "profile", "Rechtes Gleis · Gradiente z [m]", "diagram-height", ["elevation", "height", "z"]],
					["left", "alignment", "Linkes Gleis · Krümmung κ [1/m], rechts +", "diagram-curvature", null],
					["left", "cant", "Linkes Gleis · Überhöhung u [mm], Rechtsbogen +", "diagram-cant", CANT_VALUE_KEYS],
					["left", "profile", "Linkes Gleis · Gradiente z [m]", "diagram-height", ["elevation", "height", "z"]],
				];
				const bands = [];
				const nebenBySide = {};
				for (const [side, kind, label, className, valueKeys] of definitions) {
					const sideSegments = segments(side);
					const loose = sideSegments.length ? null : first(side, kind);
					const requiredMissing = side === "kilometer" && referenceRequired && !kmAlignment;
					const sideVisible = side === "right" ? rightPresent : side === "left" ? leftPresent : Boolean(kmAlignment || referenceRequired) && kilometerLinesVisible;
					if (!sideVisible) continue;
					const seriesOf = (alignment, profile, cant) => kind === "alignment" ? curvatureSeries(alignment) : kind === "cant" ? (cant ? signedCantSeries(cantSeriesMm(cant), curvatureSeries(alignment)) : []) : (profile ? profileSeries(profile) : []);
					let points = clipPointsToRange(loose
						? seriesOf(loose, loose, loose)
						: concatSeries(sideSegments.map((segment) => seriesOf(segment.alignment, segment.profile, segment.cant))), selectedRange);
					// The GRA's Überhöhungsrampen of the same Gleis lie under the cant
					// series as a halo; a Gleis with Rampen but no cant series shows
					// the Rampen alone. The footnote measures them against the series.
					const rampSources = kind !== "cant" ? [] : sideSegments.length
						? sideSegments.map((segment) => ({ alignment: segment.alignment, profile: segment.profile }))
						: [{ alignment: null, profile: first(side, "profile") }];
					const ramps = rampSources.flatMap(({ alignment, profile }) => cantRampSeries(graCantRamps(profile), curvatureSeries(alignment), profileStationMapper(profile)))
						.filter((ramp) => !selectedRange || (ramp.x1 <= selectedRange.to + 5 && ramp.x2 >= selectedRange.from - 5));
					let overlay;
					let footnote;
					// Trassen of this side that stand back: named under the figure,
					// with what they are to the one shown and how to see them.
					// A Gradiente or Überhöhung paired with a Gleis whose stations it
					// never meets (metroB 5904R: TRA km 65,5-67,5, GRA km 87,0-90,3,
					// paired by the file stem) is named instead of an anonymous gap.
					let emptyNote;
					if (!points.length && (kind === "profile" || kind === "cant")) {
						const apart = sideSegments.map((segment) => ({ own: kind === "profile" ? segment.profile : segment.cant, alignment: segment.alignment }))
							.find(({ own, alignment }) => { const a = own ? stationRangeForEntry(own) : null; const b = stationRangeForEntry(alignment); return a && b && (a.to < b.from - 5 || a.from > b.to + 5); });
						if (apart) {
							const a = stationRangeForEntry(apart.own);
							const b = stationRangeForEntry(apart.alignment);
							emptyNote = `${objectListName(apart.own)} liegt bei ${station(a.from).trim()} – ${station(a.to).trim()}, das Gleis bei ${station(b.from).trim()} – ${station(b.to).trim()}: gepaart, aber die Stationen treffen sich nicht`;
						}
					}
					const hiddenHere = kind !== "alignment" ? [] : varianten.filter((item) => item.side === side);
					if (hiddenHere.length) {
						const rangeText = (entry) => { const range = stationRangeForEntry(entry); return range ? ` (${station(range.from).trim()} – ${station(range.to).trim()})` : ""; };
						nebenBySide[side] = nebenBand(label.split(" · ")[0], hiddenHere, selectedRange);
						footnote = {
							head: `${label.split(" · ")[0]} · neben der Trasse im Bild: ${nebenZaehlung(hiddenHere)}`,
							lines: [
								...hiddenHere.map((item) => `${objectListName(item.entry)}${rangeText(item.entry)} · ${nebenText(item.entry, nebenArt(item.entry, item.wegen))}`),
								`Mit Krümmung, Überhöhung und Gradiente steht je Seite und Abschnitt eine Trasse im Bild: die gewählte, sonst die längste. ${nebenBySide[side] ? "Die anderen zeigt das Band „daneben“ mit ihrem Abstand zu ihr, Varianten gestrichelt; eine Linie dort anklicken oder das Gleis anwählen, dann steht es im Bild; liegen viele beieinander, trennt sie ein Ausschnitt (⌘/Strg + Mausrad)" : "Eine andere anwählen, dann steht sie im Bild"} · Maß: gleiche km ab ${VARIANTE_MIN_OVERLAP_M} m Überdeckung und ${Math.round(VARIANTE_MIN_SHARE * 100)} % der kürzeren; Variante, wenn sie auf der anderen liegt (unter ${lageMeters(NEBEN_AUF_M)} m bei ${Math.round(NEBEN_MIN_ANTEIL * 100)} % der Stichproben), sonst ein anderes Gleis`,
							],
						};
					}
					if (ramps.length) {
						const gleis = label.split(" · ")[0];
						footnote = cantRampFootnote(gleis, ramps, points, (value) => station(value).trim());
						if (points.length) overlay = { label: "Überhöhungsrampen aus der GRA", className: "diagram-cant-ramp", points: clipPointsToRange(rampPoints(ramps), selectedRange) };
						else points = clipPointsToRange(rampPoints(ramps), selectedRange);
					}
					bands.push(makeBand(label, className, points, {
						requiredMissing,
						jumps: side === "kilometer" ? stationEquationPositions(equations) : [],
						valueLabel: kind === "alignment" ? "κ (1/m) · r" : undefined,
						valueFormat: kind === "alignment" ? curvatureReadout : undefined,
						...(overlay ? { overlay } : {}),
						...(footnote ? { footnote } : {}),
						...(emptyNote ? { emptyNote } : {}),
					}));
					// The other Gleise of this side close its block, under the Gradiente.
					if (nebenBySide[side] && (side === "kilometer" || kind === "profile")) bands.push(nebenBySide[side]);
				}
				// Gleisabstand: where both Streckengleise are assigned, the distance
				// from the rechtes Gleis to the linkes, measured in the plane every
				// 20 m, as a band of its own under the Kilometerlinie (without one,
				// after both Gleise). The IVMG (Ril 883.5220) carries it where two
				// Gleise run side by side; the band ends where the nearest point of
				// the other Gleis sits on one of its ends or farther than
				// TRACK_SPACING_MAX_M away.
				if (rightPresent && leftPresent) {
					const rightSegments = segments("right");
					const leftSegments = segments("left");
					if (rightSegments.length && leftSegments.length) {
						const series = clipPointsToRange(trackSpacingSeries(rightSegments.map((segment) => segment.alignment), leftSegments.map((segment) => segment.alignment)), selectedRange);
						const band = makeBand("Gleisabstand · rechtes zu linkem Gleis e [m]", "diagram-spacing", series, { emptyNote: `kein linkes Gleis innerhalb ${TRACK_SPACING_MAX_M} m neben dem rechten` });
						const kmIndex = bands.findIndex((candidate) => candidate.label.startsWith("Kilometerlinie"));
						bands.splice(kmIndex >= 0 ? kmIndex + 1 : bands.length, 0, band);
					}
				}
				return bands;
			}
			
			// The plane distance from each sample of the rechtes Gleis to the
			// nearest point of the linkes Gleis. A plain distance, not the Ril's
			// Gleisabstand on a common normal -- on Streckengleise the two differ
			// by less than a centimetre. Each linkes Gleis is searched on its own
			// polyline so no phantom segment joins two Abschnitte. A sample whose
			// nearest point is an end of the other Gleis (the Gleis runs out) or
			// farther than TRACK_SPACING_MAX_M (a Weiche, a Bahnhof, single track)
			// leaves a gap in the series instead of a value.
			const TRACK_SPACING_STEP_M = 20;
			const TRACK_SPACING_MAX_M = 25;
			function nearestPointOnPolyline(polyline, easting, northing) {
				let best = null;
				for (let i = 0; i < polyline.length - 1; i += 1) {
					const a = polyline[i];
					const b = polyline[i + 1];
					const dx = b.easting - a.easting;
					const dy = b.northing - a.northing;
					const lengthSq = dx * dx + dy * dy;
					const t = lengthSq > 1e-9 ? Math.max(0, Math.min(1, ((easting - a.easting) * dx + (northing - a.northing) * dy) / lengthSq)) : 0;
					const distance = Math.hypot(easting - (a.easting + t * dx), northing - (a.northing + t * dy));
					if (!best || distance < best.distance) best = { distance, atEnd: (i === 0 && t === 0) || (i === polyline.length - 2 && t === 1) };
				}
				return best;
			}
			function trackSpacingSeries(rightAlignments, leftAlignments) {
				const leftPolylines = leftAlignments.map((alignment) => referenceStationPolyline(alignment, 10)).filter((polyline) => polyline.length >= 2);
				if (!leftPolylines.length) return [];
				const points = [];
				let open = false;
				for (const alignment of rightAlignments) {
					for (const sample of referenceStationPolyline(alignment, TRACK_SPACING_STEP_M)) {
						let nearest = null;
						for (const polyline of leftPolylines) {
							const candidate = nearestPointOnPolyline(polyline, sample.easting, sample.northing);
							if (candidate && (!nearest || candidate.distance < nearest.distance)) nearest = candidate;
						}
						if (!nearest || nearest.atEnd || nearest.distance > TRACK_SPACING_MAX_M) { open = false; continue; }
						points.push({ x: sample.station, y: Math.round(nearest.distance * 1000) / 1000, gap: !open });
						open = true;
					}
				}
				return points;
			}

			// GWB · zul. v / Potenzial for the assigned sides.
			// GWB only for Gleise: the Kilometerlinie carries no train, so it gets
			// no speed band, and each side's segments are one band with gaps.
			function deriveSpeedBands(assignment) {
				const { segments, selectedRange, rightPresent, leftPresent } = assignment;
				const bands = [];
				for (const side of ["left", "right"]) {
					if (side === "left" && !leftPresent) continue;
					if (side === "right" && !rightPresent) continue;
					const sideSegments = segments(side);
					if (!sideSegments.length) continue;
					bands.push(...speedDiagnosticBand(`${side === "left" ? "Linkes" : "Rechtes"} Gleis`, sideSegments, selectedRange, makeBand));
				}
				return bands;
			}

			// Trassenplan rows for objects without a resolved side ("Zuordnung offen").
			// A Bahnhofsgleis bundled by file name has no side but a name.
			function unknownSideLabel(entry) {
				const frame = geoFrameInfo(entry);
				const position = lagePositionText(sideEvidence(entry)?.lage, { line: false });
				if (frame?.source === "vermesn-name") return position ? `${frame.direction} · ${position}` : frame.direction;
				return position ? `Gleis · ${position}` : "Gleis · Zuordnung offen";
			}
			function deriveUnknownTrassenplanBands(assignment) {
				const { first, selectedRange } = assignment;
				const bands = [];
				for (const kind of ["alignment", "cant", "profile"]) {
					const candidate = first("unknown", kind);
					if (!candidate) continue;
					const valueKeys = kind === "profile" ? ["elevation", "height", "z"] : CANT_VALUE_KEYS;
					bands.push(makeBand(`${unknownSideLabel(candidate)} · ${kind === "profile" ? "Gradiente" : kind === "cant" ? "Überhöhung, Rechtsbogen +" : "Krümmung"}`, kind === "profile" ? "diagram-height" : kind === "cant" ? "diagram-cant" : "diagram-curvature", clipPointsToRange(kind === "alignment" ? curvatureSeries(candidate) : kind === "cant" ? signedCantSeries(cantSeriesMm(candidate), curvatureSeries(first("unknown", "alignment"))) : (kind === "profile" ? profileSeries(candidate) : pointSeries(candidate, valueKeys)), selectedRange), { undeclared: true }));
				}
				return bands;
			}

			// Speed/GWB needs curvature + cant, not a resolved li/re role -- before
			// a 7L-Struktur is assigned, every freshly-imported alignment sits in
			// "unknown" and deriveSpeedBands() yields nothing, so without this the
			// speed bands (and GWB with them) were unreachable from a plain click
			// on a just-imported object (confirmed: STR_1720_KM_211-273_GND.MDB's
			// "Gleis 0" showed only Kruemmung/Ueberhoehung, no zul.v/GWB at all).
			function deriveUnknownSpeedBands(assignment) {
				const { first, selectedRange } = assignment;
				const curvatureCandidate = first("unknown", "alignment");
				if (!curvatureCandidate) return [];
				return speedDiagnosticBand(unknownSideLabel(curvatureCandidate), [{ alignment: curvatureCandidate, cant: first("unknown", "cant"), range: stationRangeForEntry(curvatureCandidate) }], selectedRange, makeBand);
			}

			function sevenLineTracks(entry) {
				const assignment = sevenLineAssignment(entry);
				const bands = [
					...deriveTrassenplanBands(assignment),
					...deriveSpeedBands(assignment),
					...deriveUnknownTrassenplanBands(assignment),
					...deriveUnknownSpeedBands(assignment),
				];
				const { anchor, entries, hasUnknown, missingKilometerLine } = assignment;
				return { anchor, entries, bands, hasUnknown, missingKilometerLine, sideNote: sevenLineSideNote(assignment), varianten: assignment.varianten ?? [] };
			}

			// SVG <text> never wraps. Band labels live in a 238-unit gutter and the
			// footnote in a 1000-unit row, so anything longer than ~30 / ~170
			// characters used to run straight across the plot. Greedy word wrap
			// into <tspan> lines; the caller decides the character budget from the
			// available width and font size.
			function wrapText(text, maxChars) {
				const lines = [];
				let line = "";
				for (const word of String(text ?? "").split(/\s+/).filter(Boolean)) {
					const candidate = line ? `${line} ${word}` : word;
					if (candidate.length <= maxChars || !line) line = candidate;
					else { lines.push(line); line = word; }
				}
				if (line) lines.push(line);
				return lines;
			}

			function wrappedText(attributes, lines, lineHeight) {
				const text = svgElement("text", attributes);
				lines.forEach((line, index) => {
					const tspan = svgElement("tspan", { x: attributes.x, dy: index ? lineHeight : 0 });
					tspan.textContent = line;
					text.append(tspan);
				});
				return text;
			}

			// Compact axis readout: km/h and mm are whole numbers, curvature in 1/m
			// lives around 1e-3 and needs significant digits, heights need cm.
			function axisValue(value) {
				if (!Number.isFinite(value)) return "";
				const magnitude = Math.abs(value);
				if (magnitude === 0) return "0";
				if (magnitude >= 100) return String(Math.round(value));
				if (magnitude >= 1) return value.toFixed(1).replace(/\.0$/, "");
				return Number(value.toPrecision(3)).toString();
			}

			function svgElement(name, attributes = {}) {
				const element = document.createElementNS("http://www.w3.org/2000/svg", name);
				for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
				return element;
			}

			function renderDiagramTable(seriesList, emptyNote) {
				diagramTable.replaceChildren();
				if (!seriesList.length) {
					const empty = document.createElement("span");
					empty.className = "diagram-table-empty";
					empty.textContent = emptyNote ?? "keine Werte";
					diagramTable.append(empty);
					return;
				}
				for (const series of seriesList) {
					const section = document.createElement("div");
					section.className = "diagram-table-section";
					const heading = document.createElement("strong");
					heading.textContent = series.label;
					heading.title = series.label;
					section.append(heading);
					if (!series.points.length) {
						const empty = document.createElement("span");
						empty.className = "diagram-table-empty";
						empty.textContent = series.emptyNote ?? "keine Werte";
						section.append(empty);
						diagramTable.append(section);
						continue;
					}
					const table = document.createElement("table");
					table.className = "diagram-table";
					const head = document.createElement("tr");
					head.innerHTML = `<th>Station</th><th>${series.valueLabel ?? "Wert"}</th>`;
					table.append(head);
					for (const point of series.points) {
						const row = document.createElement("tr");
						const stationCell = document.createElement("td");
						stationCell.textContent = station(point.x).trim();
						const valueCell = document.createElement("td");
						valueCell.textContent = series.valueFormat ? series.valueFormat(point.y) : point.y.toFixed(3).replace(".", ",");
						row.append(stationCell, valueCell);
						table.append(row);
					}
					section.append(table);
					diagramTable.append(section);
				}
			}

			function activateDiagramPresentation(presentation) {
				diagramPresentation = presentation;
				for (const candidate of diagramPresentationButtons) candidate.setAttribute("aria-pressed", String(candidate.dataset.diagramPresentation === presentation));
				diagramScroll.classList.toggle("hidden", presentation === "table");
				diagramTable.classList.toggle("hidden", presentation !== "table");
				renderDiagram();
			}

			// Drei feste Abbildungen untereinander -- IVMG, IVHW, GWB -- statt eines
			// Modus-Umschalters mit variablem Bänderstapel ("unten nur noch drei
			// Abbildungen sehen"). Jede Abbildung ist ein verschachteltes <svg> mit
			// eigener viewBox: Bänderstapel (IVMG, GWB) und Weichenhöhenplan (IVHW)
			// behalten so ihre eigene Koordinatenmathematik, nur die Höhen werden
			// addiert. IVMG und GWB teilen sich die Kilometrierungsachse; IVHW hat
			// bewusst seine eigene (intrinsische bzw. externe Station, siehe dort).
			const FIGURE_WIDTH = 1000;
			const FIGURE_TITLE_HEIGHT = 30;

			function drawFigureTitle(target, y, title, subtitle, width = FIGURE_WIDTH) {
				target.append(svgElement("rect", { x: 0, y, width, height: FIGURE_TITLE_HEIGHT, class: "diagram-figure-strip" }));
				const text = svgElement("text", { x: 12, y: y + 20, class: "diagram-label diagram-figure-title" });
				text.textContent = title;
				target.append(text);
				if (subtitle) {
					const sub = svgElement("text", { x: width - 30, y: y + 20, "text-anchor": "end", class: "diagram-label diagram-muted diagram-figure-sub" });
					sub.textContent = subtitle;
					target.append(sub);
				}
				return FIGURE_TITLE_HEIGHT;
			}

			function nestedFigure(target, y, height, width = FIGURE_WIDTH) {
				const figure = svgElement("svg", { x: 0, y, width, height, viewBox: `0 0 ${width} ${height}` });
				target.append(figure);
				return figure;
			}

			// Spurplan: the schematic of the computed Gleis graph. x is the km on
			// the axis, y the row; an edge is a straight line between its two
			// nodes, so parallel Gleise come out horizontal and a Weiche as the
			// diagonal into the next row -- the classic Spurplan without inventing
			// a layout. Each Gleis is named once, at its longest edge; the
			// selected one is highlighted; a click on an edge selects its Gleis.
			// options (the main Spurplan view uses them, the diagram's fourth
			// figure keeps the defaults): axis -- draw only nodes on that axis and
			// stubs where a Gleis leaves for another Strecke; width -- the panel's
			// pixels instead of FIGURE_WIDTH; ticks; speeds -- Map edge → clipped
			// GWB sections, drawn as coloured segments; cursorFrame; junctionLabels.
			// Round km marks for a station axis, as the Lieferung draws them: a
			// 1-2-5 step for the window's width, labelled "140,0" from 100 m up
			// and as km + m below that (a Spurplan zoomed to its 100 m window).
			// Before, the Spurplan, the 7L band and the IVHW cut the window into
			// fifths and labelled "73,6 + 90,29".
			function roundTicks(xMin, xMax, plotWidth) {
				const span = Math.max(xMax - xMin, 1);
				const step = niceStep(span, Math.max(3, Math.floor(plotWidth / 60)));
				const marks = [];
				for (let value = Math.ceil(xMin / step) * step; value <= xMax + 1e-6; value += step) {
					marks.push({ value, label: step >= 100 ? kmLabel(value) : station(value).trim() });
				}
				return marks;
			}
			function drawSpurplan(target, y, topology, xMin, xMax, selected, options = {}) {
				const onAxis = (node) => !options.axes || options.axes.has(node.axis);
				const drawable = topology.edges.filter((edge) => edge.from.km != null && edge.to.km != null && onAxis(edge.from) && onAxis(edge.to));
				const stubs = !options.axes ? [] : topology.edges.filter((edge) => edge.from.km != null && edge.to.km != null && onAxis(edge.from) !== onAxis(edge.to));
				// Rows: the band's own (the main view passes the rows its nodes use,
				// so a two-row Strecke is not as tall as the ten-row yard next to
				// it), else the topology's global range.
				const rows = options.rows ?? topology.rows ?? [0, 0];
				const rowCount = rows[1] - rows[0] + 1;
				// Bahnhofsmodus: zoomed in, the rows spread out with the zoom (square
				// root, capped), so a yard's ten rows and their names get room.
				const rowPitch = options.rowPitch ?? 22;
				const top = 26;
				const left = 60;
				const right = 30;
				const height = top + rowCount * rowPitch + 44;
				const width = options.width ?? FIGURE_WIDTH;
				const figure = nestedFigure(target, y, height, width);
				const cursorFigure = { y, height, left, right, xMin, xMax, width, target, key: options.figureKey ?? null, frame: options.cursorFrame === undefined ? "axis" : options.cursorFrame };
				registerCursorFigure(cursorFigure);
				figure.append(svgElement("rect", { x: 0, y: 0, width, height, class: "diagram-band" }));
				// A zoomed window cuts edges at the plot's edge instead of letting
				// them run under the labels.
				const clipId = `spurplan-clip-${Math.random().toString(36).slice(2, 9)}`;
				const clip = svgElement("clipPath", { id: clipId });
				clip.append(svgElement("rect", { x: left, y: 0, width: width - left - right, height }));
				figure.append(clip);
				const content = svgElement("g", { "clip-path": `url(#${clipId})` });
				// x is km, but not to scale throughout: a stretch longer than
				// SPURPLAN_GAP_M between two consecutive nodes is folded to a fixed
				// width and marked on the axis, so a Bahnhof of 1 km keeps its room
				// beside 8 km of plain Strecke (a Spurplan is a schema, not a map).
				const plotWidth = width - left - right;
				const kms = [...new Set(topology.nodes.filter((node) => node.km != null && onAxis(node) && node.km >= xMin && node.km <= xMax).map((node) => node.km))].sort((a, b) => a - b);
				const stops = [xMin, ...kms.filter((km) => km > xMin && km < xMax), xMax];
				const folds = [];
				let realSpan = 0;
				// A zoomed window is the reader's own scale: nothing is folded there
				// (Billwerder Achse 1150: one Weiche in 800 m stood on two folds, the
				// rest of the band blank).
				for (let index = 0; index + 1 < stops.length; index += 1) {
					const span = stops[index + 1] - stops[index];
					if (span > SPURPLAN_GAP_M && options.fold !== false) folds.push({ from: stops[index], to: stops[index + 1] });
					else realSpan += span;
				}
				const foldWidth = Math.min(SPURPLAN_FOLD_PX, plotWidth / Math.max(stops.length - 1, 1));
				const scale = realSpan > 0 ? (plotWidth - folds.length * foldWidth) / realSpan : 0;
				const xAt = (km) => {
					let x = left;
					let at = xMin;
					for (const fold of folds) {
						if (km <= fold.from) break;
						x += (fold.from - at) * scale;
						if (km < fold.to) return x + (km - fold.from) / (fold.to - fold.from) * foldWidth;
						x += foldWidth;
						at = fold.to;
					}
					return x + (km - at) * scale;
				};
				const kmAt = (x) => {
					let cursorX = left;
					let at = xMin;
					for (const fold of folds) {
						const before = cursorX + (fold.from - at) * scale;
						if (x <= before) return scale > 0 ? at + (x - cursorX) / scale : at;
						if (x <= before + foldWidth) return fold.from + (x - before) / foldWidth * (fold.to - fold.from);
						cursorX = before + foldWidth;
						at = fold.to;
					}
					return scale > 0 ? at + (x - cursorX) / scale : at;
				};
				const inFold = (km) => folds.some((fold) => km > fold.from && km < fold.to);
				const yAt = (row) => top + (rows[1] - row) * rowPitch + rowPitch / 2;
				const axisY = height - 24;
				// The cursor and the zoom read x through the same folds.
				cursorFigure.toX = xAt;
				cursorFigure.toKm = kmAt;
				// Ticks every round km on the stretches drawn to scale, as many as
				// those stretches' share of the width holds.
				const realWidth = Math.max(plotWidth - folds.length * foldWidth, 60);
				// Station labels ("73,7 + 50,00") are wider than km labels.
				const tickStep = niceStep(Math.max(realSpan, 1), Math.max(3, Math.floor(realWidth / (realSpan < 2000 ? 95 : 60))));
				const foldCentres = folds.map((fold) => xAt((fold.from + fold.to) / 2));
				for (let value = Math.ceil(xMin / tickStep) * tickStep; value <= xMax + 1e-6; value += tickStep) {
					if (inFold(value)) continue;
					const x = xAt(value);
					if (foldCentres.some((centre) => Math.abs(centre - x) < 30)) continue;
					figure.append(svgElement("line", { x1: x, x2: x, y1: top - 8, y2: axisY - 6, class: "diagram-grid" }));
					const label = svgElement("text", { x, y: height - 8, "text-anchor": "middle", class: "diagram-label diagram-muted" });
					label.textContent = tickStep >= 100 ? kmLabel(value) : station(value).trim();
					figure.append(label);
				}
				for (const fold of folds) {
					const x = xAt((fold.from + fold.to) / 2);
					const mark = svgElement("path", { d: `M ${x - 5} ${axisY + 5} l 4 -10 M ${x + 1} ${axisY + 5} l 4 -10`, class: "spurplan-fold" });
					const title = svgElement("title");
					title.textContent = `${kmLabel(fold.to - fold.from)} km ohne Knoten, gestaucht · km ${kmLabel(fold.from)} – ${kmLabel(fold.to)}`;
					mark.append(title);
					figure.append(mark);
					const label = svgElement("text", { x, y: height - 8, "text-anchor": "middle", class: "diagram-label diagram-muted spurplan-fold-label" });
					label.textContent = `${kmLabel(fold.to - fold.from)} km`;
					figure.append(label);
				}
				figure.append(svgElement("line", { x1: left, x2: width - right, y1: axisY, y2: axisY, class: "diagram-axis" }));
				const inRange = (edge) => Math.max(edge.from.km, edge.to.km) >= xMin && Math.min(edge.from.km, edge.to.km) <= xMax;
				const visible = drawable.filter(inRange);
				for (const edge of stubs) {
					const here = onAxis(edge.from) ? edge.from : edge.to;
					const there = here === edge.from ? edge.to : edge.from;
					if (here.km < xMin || here.km > xMax) continue;
					const x = xAt(here.km);
					const direction = there.km >= here.km ? 1 : -1;
					const stub = svgElement("line", { x1: x, x2: x + direction * 22, y1: yAt(here.row), y2: yAt(here.row), class: "spurplan-stub" });
					const title = svgElement("title");
					title.textContent = `${objectDisplayName(edge.entry)} → ${topology.axes?.[there.axis]?.label ?? "andere Achse"}`;
					stub.append(title);
					content.append(stub);
				}
				const longestEdge = new Map();
				for (const edge of visible) {
					const length = Math.abs(edge.to.km - edge.from.km);
					// One label per name: a Gleisstrang's own (the data's "Gleis 31"),
					// else the Gleis's.
					if (gndUnnumbered(edge.name ?? objectDisplayName(edge.entry))) continue;
					const key = edge.name ?? edge.entry;
					if (!longestEdge.has(key) || length > longestEdge.get(key).length) longestEdge.set(key, { edge, length });
				}
				// The shape of an edge: from its node it leaves on a short diagonal
				// to its own row, runs there, and comes back to the other node on a
				// diagonal -- the Weiche's slant in a Spurplan. An edge too short for
				// two slants (a Weichenverbindung between two parallel Gleise) is one
				// straight slant from node to node.
				const trackShapes = new Map();
				const shapeOf = (edge) => {
					if (trackShapes.has(edge)) return trackShapes.get(edge);
					const forward = edge.from.km <= edge.to.km;
					const [a, b] = forward ? [edge.from, edge.to] : [edge.to, edge.from];
					const xa = xAt(a.km);
					const xb = xAt(b.km);
					const ya = yAt(a.row);
					const yb = yAt(b.row);
					const points = [[xa, ya]];
					const rowY = edge.row == null ? null : yAt(edge.row);
					if (rowY != null && xb - xa > 2 * SPURPLAN_SLANT_PX + 6) {
						const slant = (fromY) => Math.min(SPURPLAN_SLANT_PX * Math.max(1, Math.abs(fromY - rowY) / rowPitch), (xb - xa) / 2.5);
						if (Math.abs(ya - rowY) > 0.5) points.push([xa + slant(ya), rowY]);
						else points[0] = [xa, rowY];
						if (Math.abs(yb - rowY) > 0.5) points.push([xb - slant(yb), rowY], [xb, yb]);
						else points.push([xb, rowY]);
					} else {
						points.push([xb, yb]);
					}
					// y along the shape at any x; x grows along the shape.
					const yAtX = (x) => {
						for (let index = 0; index + 1 < points.length; index += 1) {
							const [px, py] = points[index];
							const [qx, qy] = points[index + 1];
							if (x <= qx || index === points.length - 2) return qx === px ? qy : py + (Math.max(px, Math.min(qx, x)) - px) / (qx - px) * (qy - py);
						}
						return points[0][1];
					};
					const shape = { points, forward, xa, xb, yAtX, path: points.map(([x, yy], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${yy.toFixed(1)}`).join(" ") };
					trackShapes.set(edge, shape);
					return shape;
				};
				// The piece of the shape between two x: its corners included.
				const pathBetween = (shape, xFrom, xTo) => {
					const [lo, hi] = xFrom <= xTo ? [xFrom, xTo] : [xTo, xFrom];
					const corners = shape.points.map(([x]) => x).filter((x) => x > lo && x < hi);
					return [lo, ...corners, hi].map((x, index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${shape.yAtX(x).toFixed(1)}`).join(" ");
				};
				for (const edge of visible) {
					const shape = shapeOf(edge);
					const isSelected = edge.entry === selected;
					const name = `${edgeLabelOf(edge)}${edge.part ? ` (${edge.part})` : ""} · ${edge.from.label ?? edge.from.kind} → ${edge.to.label ?? edge.to.kind}`;
					const segments = options.speeds?.get(edge);
					if (segments?.length) {
						// Station in the Gleis's own frame → km on the edge → x on the shape.
						const span = edge.stationTo - edge.stationFrom || 1;
						const xOf = (stationValue) => { const t = Math.max(0, Math.min(1, (stationValue - edge.stationFrom) / span)); return xAt(edge.from.km + t * (edge.to.km - edge.from.km)); };
						if (isSelected) content.append(svgElement("path", { d: shape.path, class: "spurplan-halo" }));
						for (const segment of segments) {
							const line = svgElement("path", { d: pathBetween(shape, xOf(segment.from), xOf(segment.to)), class: "diagram-series spurplan-edge spurplan-speed", style: `stroke:${spurplanSpeedColor(segment.v)}` });
							line.addEventListener("click", () => selectObject(edge.entry, edge.entry.button));
							const title = svgElement("title");
							title.textContent = `${name}\nv ${segment.v} km/h · ${station(segment.from).trim()} – ${station(segment.to).trim()}`;
							line.append(title);
							content.append(line);
						}
						continue;
					}
					const line = svgElement("path", { d: shape.path, class: `diagram-series spurplan-edge${isSelected ? " spurplan-selected" : ""}` });
					line.addEventListener("click", () => selectObject(edge.entry, edge.entry.button));
					const title = svgElement("title");
					title.textContent = name;
					line.append(title);
					content.append(line);
				}
				for (const node of topology.nodes) {
					if (node.km == null || node.km < xMin || node.km > xMax || !onAxis(node)) continue;
					if (node.kind === "Weiche" || node.kind === "Kreuzung" || node.kind === "Knoten") {
						const active = activeJunction?.node === node;
						const dot = svgElement("circle", { cx: xAt(node.km), cy: yAt(node.row), r: active ? 6 : node.kind === "Weiche" ? 3 : 4, class: `spurplan-node spurplan-${node.kind.toLowerCase()}${active ? " spurplan-active" : ""}` });
						dot.addEventListener("click", () => activateJunctionCluster(junctionFromNode(node)));
						const title = svgElement("title");
						const roles = node.roles?.spitze ? node.roles : null;
						const legName = (leg) => legLabelOf(leg);
						title.textContent = `${node.label ? `${node.label}${node.bauart ? ` · ${node.bauart}` : ""} · ` : ""}${node.kind} · km ${station(node.km).trim()} · ${node.names.join(" / ")}${node.source === "daten" ? "\naus den Daten (GND Satzart 31)" : "\ngerechnet aus der Lage"}${roles ? `\n${roles.side ? `${roles.side === "links" ? "Linksweiche" : "Rechtsweiche"} · ` : ""}Spitze ${legName(roles.spitze)}${node.spitzeCheck === "belegt" ? " ✓" : node.spitzeCheck === "daten" ? " (aus den Daten)" : ""}${roles.stamm ? ` · Stamm ${legName(roles.stamm)}` : ""}${roles.zweig ? ` · Zweig ${legName(roles.zweig)}` : ""}${roles.radius ? ` · r ${Math.round(roles.radius)} m${node.radiusCheck === "belegt" ? " ✓" : ""}` : ""}` : ""}`;
						dot.append(title);
						content.append(dot);
					} else if (node.kind === "Ende") {
						content.append(svgElement("line", { x1: xAt(node.km), x2: xAt(node.km), y1: yAt(node.row) - 5, y2: yAt(node.row) + 5, class: "spurplan-end" }));
					}
				}
				// Labels: longest Gleis first, each takes the first free spot -- above
				// the middle of its edge, below it, then slid along the edge in half
				// label widths -- and a Gleis that finds none stays unlabelled (its
				// name is in the edge's tooltip). Four short sidings at one km no
				// longer print on top of each other.
				const placedBoxes = [];
				const overlaps = (box) => placedBoxes.some((other) => box.x1 < other.x2 + 3 && box.x2 > other.x1 - 3 && box.y1 < other.y2 + 1 && box.y2 > other.y1 - 1);
				const candidates = [...longestEdge.entries()].map(([key, { edge, length }]) => ({ key, edge, length })).sort((a, b) => b.length - a.length);
				for (const { key, edge } of candidates) {
					const text = typeof key === "string" ? key : objectDisplayName(key).replace(" · Nebengleis", "");
					const labelWidth = text.length * 6.2 + 4;
					const labelHeight = 12;
					const ax = xAt(edge.from.km);
					const bx = xAt(edge.to.km);
					const centerX = (ax + bx) / 2;
					const centerY = shapeOf(edge).yAtX(centerX);
					const spots = [];
					for (const dy of [-5, 14]) {
						spots.push([centerX, centerY + dy]);
						for (let step = 1; step <= 4; step += 1) for (const sign of [-1, 1]) {
							const x = centerX + sign * step * labelWidth / 2;
							const withinEdge = x >= Math.min(ax, bx) - labelWidth / 2 && x <= Math.max(ax, bx) + labelWidth / 2;
							if (withinEdge && x - labelWidth / 2 >= left && x + labelWidth / 2 <= width - right) spots.push([x, centerY + dy]);
						}
					}
					for (const [x, baseline] of spots) {
						const box = { x1: x - labelWidth / 2, x2: x + labelWidth / 2, y1: baseline - labelHeight + 2, y2: baseline + 2 };
						if (overlaps(box)) continue;
						placedBoxes.push(box);
						const label = svgElement("text", { x, y: baseline, "text-anchor": "middle", class: "diagram-label diagram-muted spurplan-label" });
						label.textContent = text;
						content.append(label);
						break;
					}
				}
				// Weichen named where the data names them (VermEsn: W403-404, DKW503,
				// EKW410 as the TRA's name), else by km; same first-free-spot rule.
				if (options.junctionLabels) {
					const junctionName = (node) => junctionLabelOf(node) ?? `km ${station(node.km).trim()}`;
					for (const node of topology.nodes) {
						if (node.km == null || node.km < xMin || node.km > xMax || !onAxis(node) || (node.kind !== "Weiche" && node.kind !== "Kreuzung")) continue;
						const text = junctionName(node);
						const labelWidth = text.length * 5.4 + 4;
						const x = xAt(node.km);
						for (const baseline of [yAt(node.row) + 15, yAt(node.row) - 7]) {
							const box = { x1: x - labelWidth / 2, x2: x + labelWidth / 2, y1: baseline - 9, y2: baseline + 2 };
							if (overlaps(box) || box.x1 < left || box.x2 > width - right) continue;
							placedBoxes.push(box);
							const label = svgElement("text", { x, y: baseline, "text-anchor": "middle", class: "diagram-label spurplan-junction-label" });
							label.textContent = text;
							content.append(label);
							break;
						}
					}
				}
				figure.append(content);
				return height;
			}

			function drawEmptyFigure(target, y, note) {
				const height = 56;
				const figure = nestedFigure(target, y, height);
				figure.append(svgElement("rect", { x: 0, y: 0, width: FIGURE_WIDTH, height, class: "diagram-band" }));
				const text = svgElement("text", { x: 250, y: 33, class: "diagram-label diagram-muted" });
				text.textContent = note;
				figure.append(text);
				return height;
			}

			function bandEmptyNote(track) {
				return track.emptyNote ?? (track.requiredMissing
					? "Pflichtbezug fehlt: zwei Streckengleise benötigen eine Kilometerlinie"
					: "keine sicher verknüpfte, numerische Reihe");
			}

			// Bänderstapel über einer gemeinsamen Kilometrierungsachse; liefert die
			// verbrauchte Höhe zurück. Labels umbrechen in <tspan>-Zeilen, Min/Max
			// stehen rechtsbündig in der Beschriftungsspalte, Fußnoten einmal unten.
			// Footnotes are plain lines (strings, wrapped) or blocks { head, lines }:
			// the heading flush left, each line indented with a hanging indent for
			// its wrapped remainder, sub-lines (leading blanks) one step further.
			function layoutFootnotes(footnotes) {
				const items = [];
				let y = 0;
				const push = (text, x, className) => { items.push({ text, x, y, className }); y += 15; };
				for (const note of footnotes) {
					if (typeof note === "string") { for (const piece of wrapText(note, 165)) push(piece, 12, ""); continue; }
					if (items.length) y += 5;
					push(note.head, 12, "diagram-footnote-head");
					for (const line of note.lines ?? []) {
						const trimmed = String(line).replace(/^\s+/, "");
						const sub = trimmed.length !== String(line).length;
						const indent = sub ? 40 : 24;
						wrapText(trimmed, sub ? 148 : 152).forEach((piece, index) => push(piece, indent + (index ? 14 : 0), ""));
					}
				}
				return { items, height: y ? y + 8 : 0 };
			}
			function drawBandStack(target, y, tracks, xMin, xMax, footnotes = [], ausschnitt = null) {
				const zoomed = Boolean(ausschnitt?.zoomed);
				const xSpan = Math.max(xMax - xMin, 1);
				const width = FIGURE_WIDTH;
				const trackHeight = 112;
				const gap = 8;
				const footnoteLayout = layoutFootnotes(footnotes);
				const footnoteHeight = footnoteLayout.height;
				const height = 42 + tracks.length * (trackHeight + gap) + footnoteHeight;
				const left = 238;
				const right = 30;
				const top = 25;
				const axisY = height - footnoteHeight - 12;
				const figure = nestedFigure(target, y, height);
				registerCursorFigure({ y, height, left, right, xMin, xMax, frame: "diagram", key: ausschnitt?.key ?? null });
				for (const mark of roundTicks(xMin, xMax, width - left - right)) {
					const x = left + (width - left - right) * (mark.value - xMin) / xSpan;
					figure.append(svgElement("line", { x1: x, x2: x, y1: top, y2: axisY - 23, class: "diagram-grid" }));
					const label = svgElement("text", { x, y: axisY, "text-anchor": "middle", class: "diagram-label diagram-muted" });
					label.textContent = mark.label;
					figure.append(label);
				}
				for (const item of footnoteLayout.items) {
					const note = svgElement("text", { x: item.x, y: height - footnoteHeight + item.y + 12, class: `diagram-label diagram-footnote ${item.className || "diagram-muted"}` });
					note.textContent = item.text;
					figure.append(note);
				}
				tracks.forEach((track, index) => {
					const yTop = top + index * (trackHeight + gap);
					const yBottom = yTop + trackHeight;
					figure.append(svgElement("rect", { x: 0, y: yTop, width, height: trackHeight, class: "diagram-band" }));
					figure.append(svgElement("line", { x1: left, x2: width - right, y1: yBottom, y2: yBottom, class: "diagram-axis" }));
					// ~160 units of the 238-unit gutter for the label, the rest for the
					// right-aligned min/max readouts; at 13px that is ~24 chars/line,
					// three lines fit above the min readout in a 112-unit band.
					figure.append(wrappedText({ x: 12, y: yTop + 18, class: "diagram-label" }, wrapText(track.label, 24).slice(0, 3), 16));
					if (!track.points.length) {
						const empty = svgElement("text", { x: left + 12, y: yTop + trackHeight / 2, class: "diagram-label diagram-muted" });
						empty.textContent = bandEmptyNote(track);
						figure.append(empty);
						return;
					}
					let yMin = Infinity;
					let yMax = -Infinity;
					if (zoomed) {
						// An Ausschnitt scales each band to what it shows there.
						for (const series of [...(track.lines ? track.lines.map((line) => line.points) : [track.points]), ...(track.overlay?.points?.length ? [track.overlay.points] : [])]) {
							const range = seriesRangeIn(series, xMin, xMax);
							if (range) { yMin = Math.min(yMin, range.min); yMax = Math.max(yMax, range.max); }
						}
						if (!Number.isFinite(yMin)) {
							const silent = svgElement("text", { x: left + 12, y: yTop + trackHeight / 2, class: "diagram-label diagram-muted" });
							silent.textContent = "im Ausschnitt keine Werte";
							figure.append(silent);
							return;
						}
					} else for (const point of [...track.points, ...(track.overlay?.points ?? [])]) {
						yMin = Math.min(yMin, point.y);
						yMax = Math.max(yMax, point.y);
					}
					// A band of distances keeps its reference in view: the line at 0.
					if (track.zeroLine) { yMin = Math.min(yMin, 0); yMax = Math.max(yMax, 0); }
					const ySpan = Math.max(yMax - yMin, Math.abs(yMax) * 0.1, 1e-9);
					// A point flagged `gap` starts a new sub-path: the speed series only
					// exist where there is curvature, and joining two Bögen across a
					// Gerade with a slanted line would draw a limit that is not there.
					const pathFor = (points) => points.map((point, pointIndex) => {
						const x = left + (point.x - xMin) / xSpan * (width - left - right);
						const py = yBottom - 15 - (point.y - yMin) / ySpan * (trackHeight - 30);
						return `${pointIndex && !point.gap ? "L" : "M"} ${x} ${py}`;
					}).join(" ");
					// An Ausschnitt cuts the series at the plot's edge; the whole picture
					// is drawn as it always was.
					let plot = figure;
					if (zoomed) {
						const clipId = `band-clip-${Math.random().toString(36).slice(2, 9)}`;
						const clip = svgElement("clipPath", { id: clipId });
						clip.append(svgElement("rect", { x: left, y: yTop, width: width - left - right, height: trackHeight }));
						plot = svgElement("g", { "clip-path": `url(#${clipId})` });
						figure.append(clip, plot);
					}
					if (track.overlay?.points?.length) {
						plot.append(svgElement("path", { d: pathFor(track.overlay.points), class: `diagram-series ${track.overlay.className}` }));
					}
					if (track.zeroLine) {
						const zeroY = yBottom - 15 - (0 - yMin) / ySpan * (trackHeight - 30);
						figure.append(svgElement("line", { x1: left, x2: width - right, y1: zeroY, y2: zeroY, class: "diagram-zero" }));
					}
					// Several lines in one band (the Gleise beside a Trasse): each its
					// own path with a name on hover and a wider, invisible one to hit.
					if (track.lines) {
						for (const line of track.lines) {
							const group = svgElement("g", { class: `diagram-line${line.art ? ` ${line.art}` : ""}` });
							const title = svgElement("title", {});
							title.textContent = line.title ?? line.name ?? "";
							const d = pathFor(line.points);
							group.append(title, svgElement("path", { d, class: `diagram-series ${track.className}` }), svgElement("path", { d, class: "diagram-line-hit" }));
							if (line.pick) group.addEventListener("click", line.pick);
							plot.append(group);
						}
					} else plot.append(svgElement("path", { d: pathFor(track.points), class: `diagram-series ${track.className}` }));
					// Min/max readouts in the label gutter -- a band without numbers
					// is a shape, not a measurement; the PI needs to read "70" and
					// "140" off it, not guess from the line height.
					const unit = track.unit ? ` ${track.unit}` : "";
					const readout = (value) => track.axisFormat ? track.axisFormat(value) : `${axisValue(value)}${unit}`;
					const maxLabel = svgElement("text", { x: left - 8, y: yTop + 19, "text-anchor": "end", class: "diagram-label diagram-muted diagram-axis-value" });
					maxLabel.textContent = readout(yMax);
					const minLabel = svgElement("text", { x: left - 8, y: yBottom - 11, "text-anchor": "end", class: "diagram-label diagram-muted diagram-axis-value" });
					minLabel.textContent = readout(yMin);
					figure.append(maxLabel, minLabel);
					for (const jump of track.jumps ?? []) {
						if (jump < xMin || jump > xMax) continue;
						const x = left + (jump - xMin) / xSpan * (width - left - right);
						figure.append(svgElement("line", { x1: x, x2: x, y1: yTop + 7, y2: yBottom - 7, class: "diagram-jump" }));
					}
				});
				return height;
			}

			// ---- Cursor · eine Station, alle Bilder --------------------------------
			// One station, set by the mouse in any picture (IVMG, IVHW, GWB,
			// Spurplan, GIS, Lieferung) and shown in all of them: a line in every
			// figure that shares the frame, a marker on the map at that station of
			// the selected Trasse, a line in the Lieferung row of its Strecke, and
			// the values there in the diagram toolbar. Figures register their
			// x-scale while drawing; nothing here derives a value, it reads the
			// bands already drawn. Frames: "diagram" is the selected Trasse's own
			// station, "axis" the km on the Spurplan's axis -- the same only when
			// the Trasse lives in the Kilometerlinie's frame.
			let cursorStation = null;
			let cursorFigures = [];
			let cursorContext = null;
			let deliveryCursorGroups = [];
			let deliverySvg = null;
			function registerCursorFigure(figure) { cursorFigures.push({ target: diagram, width: FIGURE_WIDTH, ...figure }); }
			function cursorFromFigureEvent(svg, event) {
				const point = svgPointFromEvent(svg, event);
				if (!point) return;
				const figure = cursorFigures.find((candidate) => candidate.target === svg && cursorFrameFits(candidate.frame) && point.y >= candidate.y && point.y <= candidate.y + candidate.height);
				if (!figure) return;
				const ratio = (point.x - figure.left) / (figure.width - figure.left - figure.right);
				if (ratio < 0 || ratio > 1) return;
				setCursor(figure.toKm ? figure.toKm(point.x) : figure.xMin + ratio * (figure.xMax - figure.xMin));
			}
			function cursorFrameFits(frame) { return frame === "diagram" || (frame === "axis" && Boolean(cursorContext?.inKm)); }
			function svgPointFromEvent(svg, event) {
				const ctm = svg.getScreenCTM();
				if (!ctm) return null;
				const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
				return { x: point.x, y: point.y };
			}
			function cursorPolyline() {
				if (!cursorContext?.anchor) return [];
				cursorContext.polyline ??= referenceStationPolyline(cursorContext.anchor, 5);
				return cursorContext.polyline;
			}
			function cursorMappedPolyline(mode) {
				cursorContext.mapped ??= {};
				cursorContext.mapped[mode] ??= cursorPolyline()
					.map((point) => ({ station: point.station, mapped: mapPoint(point, cursorContext.anchor, mode) }))
					.filter((item) => item.mapped);
				return cursorContext.mapped[mode];
			}
			function cursorPointAt(station) {
				const polyline = cursorPolyline();
				for (let index = 0; index + 1 < polyline.length; index += 1) {
					const a = polyline[index];
					const b = polyline[index + 1];
					if (a.station === b.station || (station - a.station) * (station - b.station) > 0) continue;
					const t = (station - a.station) / (b.station - a.station);
					return { easting: a.easting + t * (b.easting - a.easting), northing: a.northing + t * (b.northing - a.northing) };
				}
				return null;
			}
			function setCursor(station) {
				cursorStation = Number.isFinite(station) ? station : null;
				drawDiagramCursor();
				drawMapCursor();
				drawDeliveryCursor();
				updateCursorReadout();
			}
			function cursorFromMap(x, y, tolerance, mode) {
				if (!cursorContext?.anchor) return;
				let best = null;
				for (const item of cursorMappedPolyline(mode)) {
					const distance = Math.hypot(item.mapped.x - x, item.mapped.y - y);
					if (!best || distance < best.distance) best = { distance, station: item.station };
				}
				if (best && best.distance <= tolerance) setCursor(best.station);
			}
			function drawDiagramCursor() {
				const targets = new Set([diagram, ...cursorFigures.map((figure) => figure.target)]);
				for (const target of targets) {
					if (!target.isConnected) continue;
					let layer = target.querySelector(":scope > .cursor-layer");
					if (!layer) {
						layer = svgElement("g", { class: "cursor-layer" });
						target.append(layer);
					}
					layer.replaceChildren();
					if (cursorStation == null) continue;
					let labelled = false;
					for (const figure of cursorFigures) {
						if (figure.target !== target || !cursorFrameFits(figure.frame) || cursorStation < figure.xMin || cursorStation > figure.xMax) continue;
						const x = figure.toX ? figure.toX(cursorStation) : figure.left + (cursorStation - figure.xMin) / Math.max(figure.xMax - figure.xMin, 1e-9) * (figure.width - figure.left - figure.right);
						layer.append(svgElement("line", { x1: x, x2: x, y1: figure.y, y2: figure.y + figure.height, class: "diagram-cursor" }));
						if (!labelled) {
							const label = svgElement("text", { x: x + 4, y: figure.y + 12, class: "diagram-label diagram-cursor-label" });
							label.textContent = `${cursorContext?.inKm ? "km" : "Station"} ${station(cursorStation).trim()}`;
							layer.append(label);
							labelled = true;
						}
					}
				}
			}
			function drawMapCursor() {
				const anchor = cursorContext?.anchor;
				const point = cursorStation == null || !anchor ? null : cursorPointAt(cursorStation);
				if (maplibreMap?.getSource?.("cursor")) {
					const geographic = point ? geographicPoint(point, anchor) : null;
					maplibreMap.getSource("cursor").setData({
						type: "FeatureCollection",
						features: geographic ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [geographic.longitude, geographic.latitude] } }] : [],
					});
				}
				multi2d.querySelector(".map-cursor")?.remove();
				if (!point || !currentMapViewBox) return;
				const mapped = mapPoint(point, anchor, activeMapMode);
				if (!mapped) return;
				const scale = currentMapViewBox.width / Math.max(multi2d.getBoundingClientRect().width, 1);
				const marker = svgElement("g", { class: "map-cursor", transform: `translate(${mapped.x} ${mapped.y}) scale(${scale})` });
				marker.append(svgElement("circle", { r: 6 }));
				(mapWorld ?? multi2d).append(marker);
			}
			function drawDeliveryCursor() {
				if (!deliverySvg) return;
				let layer = deliverySvg.querySelector("#deliveryCursorLayer");
				if (!layer) {
					layer = svgElement("g", { id: "deliveryCursorLayer" });
					deliverySvg.append(layer);
				}
				layer.replaceChildren();
				if (cursorStation == null || !cursorContext?.inKm || !cursorContext.track) return;
				for (const group of deliveryCursorGroups) {
					if (group.track !== cursorContext.track || cursorStation < group.from || cursorStation > group.to) continue;
					const x = group.labelW + (cursorStation - group.from) / Math.max(group.to - group.from, 1) * group.plotW;
					layer.append(svgElement("line", { x1: x, x2: x, y1: group.top - 4, y2: group.bottom, class: "delivery-cursor" }));
				}
			}
			// Table/cursor readout for a curvature value: three decimals hide every
			// real-world κ (1e-3 .. 1e-5), so six decimals plus the radius and the
			// side in the Vermessungskonvention (positive = Rechtsbogen).
			function curvatureReadout(kappa) {
				if (!Number.isFinite(kappa)) return "";
				if (Math.abs(kappa) < 1e-6) return "0 · Gerade";
				const sign = kappa > 0 ? "+" : "−";
				return `${sign}${Math.abs(kappa).toFixed(6).replace(".", ",")} · r ${Math.round(1 / Math.abs(kappa))} m ${kappa > 0 ? "rechts" : "links"}`;
			}

			function cursorBandText(band, x) {
				const cls = band.className ?? "";
				if (cls.includes("fzk-speed")) {
					const v = bandValueAt(band.points, x, false);
					const proposal = band.overlay ? bandValueAt(band.overlay.points, x, false) : null;
					return v == null ? null : `v(s) ${Math.round(v)}${proposal != null && Math.round(proposal) !== Math.round(v) ? ` ┄ ${Math.round(proposal)}` : ""} km/h`;
				}
				if (cls.includes("fzk-time")) {
					const t = bandValueAt(band.points, x, false);
					const proposal = band.overlay ? bandValueAt(band.overlay.points, x, false) : null;
					return t == null ? null : `t ${minSec(t * 60)}${proposal != null && Math.round(proposal * 60) !== Math.round(t * 60) ? ` ┄ ${minSec(proposal * 60)}` : ""}`;
				}
				if (cls.includes("curvature")) {
					const kappa = bandValueAt(band.points, x, false);
					if (kappa == null) return null;
					return Math.abs(kappa) < 1e-6 ? "Gerade" : `r ${Math.round(1 / Math.abs(kappa))} m ${kappa > 0 ? "rechts" : "links"}`;
				}
				if (cls.includes("height")) {
					const z = bandValueAt(band.points, x, false);
					return z == null ? null : `z ${z.toFixed(2)} m`;
				}
				if (cls.includes("cant")) {
					const u = bandValueAt(band.points, x, false);
					if (u == null) return null;
					const ramp = band.overlay ? bandValueAt(band.overlay.points, x, false) : null;
					const side = Math.round(u) ? (u > 0 ? " · Rechtsbogen" : " · Linksbogen") : "";
					return `u ${Math.abs(Math.round(u))} mm${side}${ramp != null && Math.round(ramp) !== Math.round(u) ? ` · GRA-Rampe ${Math.abs(Math.round(ramp))}` : ""}`;
				}
				if (band.lines) {
					const at = band.lines.map((line) => ({ line, a: bandValueAt(line.points, x, false) })).filter((item) => item.a != null);
					if (!at.length) return null;
					return `daneben ${at.slice(0, 3).map((item) => `${item.line.name} ${nebenSeite(item.a)}`).join(", ")}${at.length > 3 ? ` und ${at.length - 3} weitere` : ""}`;
				}
				if (cls.includes("spacing")) {
					const e = bandValueAt(band.points, x, false);
					return e == null ? null : `e ${e.toFixed(2)} m`;
				}
				if (cls.includes("speed")) {
					const today = bandValueAt(band.points, x, true);
					const proposal = band.overlay ? bandValueAt(band.overlay.points, x, true) : null;
					return today == null ? null : `v ${Math.round(today)}${proposal != null && Math.round(proposal) !== Math.round(today) ? ` ┄ ${Math.round(proposal)}` : ""} km/h`;
				}
				return null;
			}
			function updateCursorReadout() {
				if (cursorStation == null || !cursorContext?.bands) {
					diagramCursor.textContent = "";
					return;
				}
				const parts = [`${cursorContext.inKm ? "km" : "Station"} ${station(cursorStation).trim()}`];
				const bySide = new Map();
				for (const band of cursorContext.bands) {
					const text = cursorBandText(band, cursorStation);
					if (text == null) continue;
					const side = String(band.label ?? "").split(" · ")[0];
					if (!bySide.has(side)) bySide.set(side, []);
					bySide.get(side).push(text);
				}
				for (const [side, values] of bySide) parts.push(`${side}: ${values.join(", ")}`);
				diagramCursor.textContent = parts.join(" · ");
			}
			let cursorFrameRequest = 0;
			function scheduleCursor(update) {
				if (cursorFrameRequest) return;
				cursorFrameRequest = requestAnimationFrame(() => {
					cursorFrameRequest = 0;
					update();
				});
			}

			// Ausschnitt im Bild (IVMG, GWB, FZK): one window per Strecke in km, or
			// per Trasse where the stations are its own; kept while the reader
			// moves between the Gleise of a Strecke, reset by a double click.
			// ⌘/Strg + wheel zooms around the station under the mouse, a drag
			// shifts. A gesture redraws what was derived for the last picture;
			// every other caller derives anew.
			const diagramZoom = new Map();
			let diagramExtent = null;
			let diagramDerived = null;
			function diagramWindowKey(anchor) {
				const track = inKilometerFrame(anchor) ? deliveryTrackOf(anchor) : null;
				return track ? `km|${track}` : `own|${einordnungKey(anchor)}`;
			}
			function diagramFigureAt(event) {
				const point = svgPointFromEvent(diagram, event);
				if (!point || !diagramExtent) return null;
				const figure = cursorFigures.find((candidate) => candidate.target === diagram && candidate.key === diagramExtent.key && point.y >= candidate.y && point.y <= candidate.y + candidate.height);
				if (!figure) return null;
				const plotWidth = figure.width - figure.left - figure.right;
				const ratio = Math.max(0, Math.min(1, (point.x - figure.left) / plotWidth));
				return { figure, point, plotWidth, at: figure.xMin + ratio * (figure.xMax - figure.xMin) };
			}
			function wireDiagramZoom() {
				const redraw = () => scheduleCursor(() => renderDiagram(selectedEntry, true));
				diagram.addEventListener("wheel", (event) => {
					if (!event.ctrlKey && !event.metaKey) return;
					const hit = diagramFigureAt(event);
					if (!hit) return;
					event.preventDefault();
					const factor = Math.exp(Math.max(-1, Math.min(1, event.deltaY / 100)) * 0.35);
					const next = windowZoomed(hit.figure, diagramExtent, hit.at, factor);
					if (next) diagramZoom.set(diagramExtent.key, next);
					else diagramZoom.delete(diagramExtent.key);
					redraw();
				}, { passive: false });
				let drag = null;
				diagram.addEventListener("pointerdown", (event) => {
					if (event.button !== 0) return;
					const hit = diagramFigureAt(event);
					if (!hit || !diagramZoom.has(diagramExtent.key)) return;
					drag = { key: diagramExtent.key, startX: hit.point.x, shown: { xMin: hit.figure.xMin, xMax: hit.figure.xMax }, plotWidth: hit.plotWidth, moved: false };
				});
				diagram.addEventListener("pointermove", (event) => {
					if (!drag || drag.key !== diagramExtent?.key) return;
					const point = svgPointFromEvent(diagram, event);
					if (!point || (!drag.moved && Math.abs(point.x - drag.startX) < 3)) return;
					drag.moved = true;
					diagramZoom.set(drag.key, windowShifted(drag.shown, diagramExtent, (drag.startX - point.x) / drag.plotWidth * (drag.shown.xMax - drag.shown.xMin)));
					redraw();
				});
				const endDrag = () => { drag = null; };
				diagram.addEventListener("pointerup", endDrag);
				diagram.addEventListener("pointercancel", endDrag);
				diagram.addEventListener("pointerleave", endDrag);
				diagram.addEventListener("dblclick", (event) => {
					if (!diagramFigureAt(event) || !diagramZoom.has(diagramExtent.key)) return;
					diagramZoom.delete(diagramExtent.key);
					renderDiagram(selectedEntry, true);
				});
			}

			function renderDiagram(entry = selectedEntry, redraw = false) {
				diagram.replaceChildren();
				diagramTable.replaceChildren();
				cursorFigures = cursorFigures.filter((figure) => figure.target !== diagram);
				if (!entry) {
					gwbBogenCsvButton.disabled = true;
					gwbAbschnittCsvButton.disabled = true;
					diagramExtent = null;
					diagramDerived = null;
					return;
				}
				const reuse = redraw && diagramDerived?.entry === entry && diagramDerived.kind === diagramKind ? diagramDerived : null;
				const seven = reuse?.seven ?? sevenLineTracks(entry);
				const { anchor, entries, bands, hasUnknown, missingKilometerLine, sideNote, varianten } = seven;
				const ivmgTracks = bands.filter((track) => !track.className.startsWith("diagram-speed"));
				const gwbTracks = bands.filter((track) => track.className.startsWith("diagram-speed"));
				const fzkTracks = reuse?.fzkTracks ?? (diagramKind === "fzk" ? deriveFahrzeitBands(gwbTracks) : []);
				gwbBogenCsvButton.disabled = !gwbTracks.some((track) => track.proposal?.length);
				gwbAbschnittCsvButton.disabled = !gwbTracks.some((track) => track.sections?.proposal);
				const ivhw = reuse?.ivhw ?? buildIvhwData(entry);
				diagramDerived = { entry, kind: diagramKind, seven, fzkTracks, ivhw };
				let xMin = Infinity;
				let xMax = -Infinity;
				for (const track of bands) {
					for (const point of [...track.points, ...(track.overlay?.points ?? [])]) {
						xMin = Math.min(xMin, point.x);
						xMax = Math.max(xMax, point.x);
					}
					for (const jump of track.jumps ?? []) {
						xMin = Math.min(xMin, jump);
						xMax = Math.max(xMax, jump);
					}
				}
				if (!Number.isFinite(xMin)) xMin = 0;
				if (!Number.isFinite(xMax)) xMax = 1;
				// The Ausschnitt of the band figures; the IVHW keeps its own extent
				// and the table lists everything.
				const windowKey = diagramWindowKey(anchor);
				const banded = diagramPresentation !== "table" && diagramKind !== "ivhw";
				diagramExtent = banded ? { key: windowKey, xMin, xMax } : null;
				const shown = banded ? windowWithin({ xMin, xMax }, diagramZoom.get(windowKey)) : { xMin, xMax, zoomed: false };
				const ausschnitt = { key: windowKey, zoomed: shown.zoomed };
				const inKm = inKilometerFrame(anchor);
				// Whole metres below 2 km, else the km to one decimal as the axis has them.
				const edge = (value) => shown.xMax - shown.xMin >= 2000 ? kmLabel(value) : station(Math.round(value)).trim().replace(/,00$/, "");
				const ausschnittNote = shown.zoomed ? `Ausschnitt ${inKm ? "km" : "Station"} ${edge(shown.xMin)} – ${edge(shown.xMax)} von ${kmLabel(xMin)} – ${kmLabel(xMax)} · Ziehen verschiebt · Doppelklick zeigt alles` : null;
				diagram.classList.toggle("ausschnitt", shown.zoomed);
				// One block per Gleis under the figure -- its name as heading, the
				// Bogen lines as a list with hanging indent, the Abschnitte line on
				// its own -- and the assumptions once, as the last block.
				const notes = gwbTracks.flatMap((track) => [].concat(track.footnote ?? [])).filter(Boolean);
				const seenBlocks = new Set();
				const footnotes = [];
				for (const note of notes) {
					if (typeof note === "string") { if (!seenBlocks.has(note)) { seenBlocks.add(note); footnotes.push(note); } continue; }
					if (!note.lines?.length) continue;
					const key = `${note.gleis}\n${note.lines.join("\n")}`;
					if (seenBlocks.has(key)) continue;
					seenBlocks.add(key);
					footnotes.push({ head: note.gleis, lines: note.lines.map((line) => line.startsWith(`${note.gleis} · `) ? line.slice(note.gleis.length + 3) : line) });
				}
				for (const text of new Set(notes.map((note) => typeof note === "string" ? null : note.assumptions).filter(Boolean))) footnotes.push({ head: "Annahmen", lines: [text] });
				// One Plan per slide: the table and the chart show diagramKind only.
				if (diagramPresentation === "table") {
					renderDiagramTable([
						...(diagramKind !== "ivmg" ? [] : ivmgTracks).flatMap((track) => {
							if (track.lines) return track.lines.map((line) => ({ label: `IVMG · ${track.label} · ${line.name}${line.art === "variante" ? " (Variante)" : ""}`, points: line.points, valueLabel: track.valueLabel, valueFormat: track.valueFormat }));
							const row = { label: `IVMG · ${track.label}`, points: track.points, emptyNote: bandEmptyNote(track), valueLabel: track.valueLabel, valueFormat: track.valueFormat };
							return track.overlay
								? [row, { label: `IVMG · ${track.label} · ${track.overlay.label}`, points: track.overlay.points, valueLabel: track.valueLabel, valueFormat: track.valueFormat }]
								: [row];
						}),
						...(diagramKind !== "ivhw" ? [] : ivhw.trackData ?? []).flatMap((data) => [
							{ label: `IVHW · ${objectDisplayName(data.track)} · Schiene ${ivhw.rails?.sideA ?? "A"}`, points: data.railA, valueLabel: "Höhe (m)" },
							{ label: `IVHW · ${objectDisplayName(data.track)} · Schiene ${ivhw.rails?.sideB ?? "B"}`, points: data.railB, valueLabel: "Höhe (m)" },
						]),
						...(diagramKind !== "gwb" ? [] : gwbTracks).flatMap((track) => {
							const row = { label: `GWB · ${track.label}`, points: track.points, emptyNote: bandEmptyNote(track) };
							return track.overlay
								? [row, { label: `GWB · ${track.label} · ${track.overlay.label}`, points: track.overlay.points, emptyNote: track.emptyNote }]
								: [row];
						}),
						...fzkTracks.flatMap((track) => [
							{ label: `FZK · ${track.label}`, points: track.points, emptyNote: bandEmptyNote(track), valueLabel: track.valueLabel, valueFormat: track.axisFormat },
							{ label: `FZK · ${track.label} · ${track.overlay.label}`, points: track.overlay.points, emptyNote: track.emptyNote, valueLabel: track.valueLabel, valueFormat: track.axisFormat },
						]),
					], diagramKind === "ivhw" ? ivhw.note
						: diagramKind === "ivmg" ? "keine Lage-, Höhen- oder Überhöhungsreihe sicher verknüpft"
						: "keine Krümmungsreihe · kein Geschwindigkeitsband ableitbar");
				} else {
					let y = 0;
					if (diagramKind === "ivmg") {
						y += drawFigureTitle(diagram, y, "IVMG · Trassenplan", ausschnittNote ?? "Krümmung · Gradiente · Überhöhung über der Kilometrierung · Ril 883.5220 · ⌘/Strg + Rad zoomt");
						y += ivmgTracks.length
							? drawBandStack(diagram, y, ivmgTracks, shown.xMin, shown.xMax, ivmgTracks.flatMap((track) => [].concat(track.footnote ?? [])).filter((note) => note?.lines?.length), ausschnitt)
							: drawEmptyFigure(diagram, y, "keine Lage-, Höhen- oder Überhöhungsreihe sicher verknüpft");
					}
					if (diagramKind === "ivhw") {
						y += drawFigureTitle(diagram, y, "IVHW · Weichenhöhenplan", ivhw.subtitle);
						y += ivhw.trackData
							? drawIvhwPlot(diagram, y, ivhw)
							: drawEmptyFigure(diagram, y, ivhw.note);
					}
					if (diagramKind === "gwb") {
						y += drawFigureTitle(diagram, y, "GWB · Geschwindigkeitswegeband", ausschnittNote ?? "je Gleis durchgehend · heute — / Vorschlag ┄ · Geraden mit Streckengeschwindigkeit · Ril 800.0110 (2021) / 457.0201 · Diagnose");
						y += gwbTracks.length
							? drawBandStack(diagram, y, gwbTracks, shown.xMin, shown.xMax, footnotes, ausschnitt)
							: drawEmptyFigure(diagram, y, "keine Krümmungsreihe · kein Geschwindigkeitsband ableitbar");
					}
					if (diagramKind === "fzk") {
						const fzkFootnotes = [...new Set(fzkTracks.flatMap((track) => [].concat(track.footnote ?? [])).filter(Boolean))].flatMap((footnote) => wrapText(footnote, 165));
						y += drawFigureTitle(diagram, y, "FZK · Fahrzeitkurve", ausschnittNote ?? "je Gleis über dem GWB · Fahrschaulinie v(s) und Fahrzeit t(s) · heute — / Vorschlag ┄ · vereinfachte Fahrdynamik je Zugart");
						y += fzkTracks.length
							? drawBandStack(diagram, y, fzkTracks, shown.xMin, shown.xMax, fzkFootnotes, ausschnitt)
							: drawEmptyFigure(diagram, y, "keine Krümmungsreihe · kein Geschwindigkeitsband · keine Fahrzeit ableitbar");
					}
					diagram.setAttribute("viewBox", `0 0 ${FIGURE_WIDTH} ${y}`);
					if (cursorContext?.anchor !== anchor) cursorContext = { anchor };
					Object.assign(cursorContext, { bands: [...bands, ...fzkTracks], inKm, track: deliveryTrackOf(anchor) });
					drawDiagramCursor();
					updateCursorReadout();
					scheduleStateSave();
				}
				const tracks = bands;
				const profile = entries.find((candidate) => candidate.item.kind === "profile");
				const cant = entries.find((candidate) => candidate.item.kind === "cant");
				const unresolved = anchor?.item?.payload?.extras?.unresolvedAttachments ?? {};
				// loadedHasFamily() only sees whether the file has an EH/EU table at
				// all -- not whether any row of it actually covers this Kilometerlinie
				// segment's own station range. familyExistsForSameRoute() checks the
				// stronger, segment-relevant claim: is there an EH/EU object for the
				// SAME Strecke anywhere in the file? If so and it still wasn't picked
				// up, the segment genuinely has no coverage (a data gap, not an
				// unresolved link) and gets its own, less misleading message.
				const familyExistsForSameRoute = (kind) => {
					const route = gndSequenceForEntry(anchor)?.strecke;
					if (!route) return false;
					return (anchor.loaded?.objects ?? []).some((candidate) =>
						candidate.item.kind === kind && gndSequenceForEntry(candidate)?.strecke === route
					);
				};
				const outOfRangeNames = [
					!profile && familyExistsForSameRoute("profile") && "EH",
					!cant && familyExistsForSameRoute("cant") && "EU",
				].filter(Boolean);
				const unresolvedNames = [
					!profile && !outOfRangeNames.includes("EH") && (unresolved.profile || loadedHasFamily(anchor.loaded, "EH")) && "EH",
					!cant && !outOfRangeNames.includes("EU") && (unresolved.cant || loadedHasFamily(anchor.loaded, "EU")) && "EU",
				].filter(Boolean);
				diagramTitle.textContent = objectDisplayName(anchor);
				diagramCode.textContent = DIAGRAM_KINDS[diagramKind];
				diagramCode.title = { ivmg: "Trassenplan (Ril 883.5220)", ivhw: "Weichenhöhenplan (Ril 883.5240)", gwb: "Geschwindigkeitswegeband (Ril 800.0110 / 457.0201, Diagnose)", fzk: "Fahrzeitkurve über dem GWB (vereinfachte Fahrdynamik)" }[diagramKind]
					+ (diagramKind === "ivhw" ? "" : " · Ausschnitt: ⌘/Strg + Mausrad oder Pinch zoomt um die Mausposition, Ziehen verschiebt, Doppelklick zeigt alles");
				// Annahmen and the CSVs belong to the GWB; the picture export to all.
				assumptionsMenu.classList.toggle("hidden", diagramKind !== "gwb" && diagramKind !== "fzk");
				for (const control of assumptionsMenu.querySelectorAll(".fzk-only")) control.classList.toggle("hidden", diagramKind !== "fzk");
				gwbBogenCsvButton.classList.toggle("hidden", diagramKind !== "gwb");
				gwbAbschnittCsvButton.classList.toggle("hidden", diagramKind !== "gwb");
				// A Gleis without a declared side is only "noch zuzuordnen" while the
				// Lage is silent too; placed by the Lage it is named with its position.
				const sideOpen = hasUnknown && (sideNote.open > 0 || !sideNote.placed);
				const mainNote = sideNote.conflict
					? sideNote.conflict
					: missingKilometerLine
					? "Kilometerlinie fehlt · zweigleisige Streckenzuordnung unvollständig"
					: outOfRangeNames.length
					? `${outOfRangeNames.join(" / ")} für diesen Streckenabschnitt nicht vorhanden · Datei deckt nur andere Abschnitte ab`
					: unresolvedNames.length
					? `${unresolvedNames.join(" / ")} vorhanden, aber noch nicht sicher dekodiert`
					: sideOpen
						? `${entries.length} verknüpfte Objekte · Gleisseite noch zuzuordnen`
						: (() => {
							// The bands of a Gleis without a declared side are no rows of
							// the 7L; they count only where there is no 7L at all.
							const sevenLineBandCount = tracks.filter((track) => !track.className.startsWith("diagram-speed") && !track.className.includes("spacing") && !track.derived && (sideNote.standalone || !track.undeclared)).length;
							const speedBandCount = tracks.filter((track) => track.className.startsWith("diagram-speed") || track.className.includes("spacing") || track.derived).length;
							return [
								`${sideNote.standalone ? `${sevenLineBandCount} ${sevenLineBandCount === 1 ? "Band" : "Bänder"}` : `${sevenLineBandCount} von 7 Bändern`}${speedBandCount ? ` + ${speedBandCount} abgeleitet` : ""}`,
								`${entries.length} sicher verknüpfte${entries.length === 1 ? "s Objekt" : " Objekte"}`,
								sideNote.placed,
								sideNote.confirmed,
								varianten.length ? `${nebenZaehlung(varianten)} neben der Trasse im Bild` : null,
							].filter(Boolean).join(" · ");
						})();
				// The km hint leads: the header is one line and cuts what is long.
				diagramNote.textContent = [kmHinweisText(entry), mainNote, coverageNote(anchor)].filter(Boolean).join(" · ");
				diagramNote.title = diagramNote.textContent;
			}

			// What the stationing of a Gleis sorted in by hand rests on, where it
			// is not the plain case (both ends beside the line): stationed from
			// farther away, with the km of another Strecke's line, or without km,
			// and why. The reason and
			// the measure stand in the picture's header; the user changes it by
			// sorting the Gleis elsewhere or taking it out again.
			function kmHinweisText(entry) {
				const hinweis = entry?.kmHinweis;
				if (!hinweis) return "";
				const linie = hinweis.linie ? objectListName(hinweis.linie) : "";
				const anteil = hinweis.anteil != null ? `${Math.round(hinweis.anteil * 100)} %` : "";
				const strecke = entry.frameEdit?.track ? `Strecke ${entry.frameEdit.track}` : "der Strecke";
				if (hinweis.art === "stuecke") return `km über zwei Stücke der Kilometerlinie von ${strecke}, die bei km ${(hinweis.stoss / 1000).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} aneinanderstoßen`;
				if (hinweis.art === "fern") return `km über den Lotfußpunkt auf ${linie}: ${anteil} des Gleises in ${ordnungAnnahmen.reichweite} m daneben, ein Ende ${Math.round(hinweis.abstand)} m`;
				const grund = {
					keine: `keine Kilometerlinie der ${strecke} in seinem Lagesystem geladen`,
					fern: `liegt an keiner Kilometerlinie der ${strecke}`,
					ende: `reicht über das Ende von ${linie} hinaus (${anteil} daneben)`,
					abstand: `ein Ende ${Math.round(hinweis.abstand ?? 0)} m von ${linie}, weiter als ${ordnungAnnahmen.kmFern} m`,
					anteil: `nur ${anteil} des Gleises in ${ordnungAnnahmen.reichweite} m neben ${linie}`,
					laenge: `die Abbildung auf ${linie} hält seine Länge nicht`,
				}[hinweis.grund] ?? `passt an keine Kilometerlinie der ${strecke}`;
				if (hinweis.art === "fremd") return `km von ${hinweis.von ? objectListName(hinweis.von) : "einer anderen Kilometerlinie"}, nicht von ${strecke}: ${grund}`;
				const passt = hinweis.passt ? ` · von Ende zu Ende liegt es an ${objectListName(hinweis.passt)}${isValidRouteNumber(geoFrameInfo(hinweis.passt)?.track) ? ` (Strecke ${geoFrameInfo(hinweis.passt).track})` : ""}` : "";
				return `ohne km der ${strecke}, eigene Stationen: ${grund}${passt}`;
			}
			// The same in two words for the Outbox row; null where the km are
			// the Strecke's own.
			function kmHinweisMarke(entry) {
				const art = entry?.kmHinweis?.art;
				return art === "ohne" ? "ohne km" : art === "fremd" ? "km fremd" : art === "fern" ? "km fern" : null;
			}

			// A Gleis's own Gradiente/Überhöhung should cover its Krümmung; the
			// delivery cuts them separately (Landshut W403-404: TRA km 74,970-75,058,
			// GRA 75,008-75,099). Where a band starts later or ends earlier than the
			// Krümmung by more than 5 m, the header says so instead of the diagram
			// silently showing a shorter band. Overhang beyond the Krümmung is not
			// reported -- it clips harmlessly.
			function coverageNote(anchor) {
				if (anchor?.item?.kind !== "alignment") return "";
				const range = stationRangeForEntry(anchor);
				if (!range) return "";
				const own = referencingEntries(anchor);
				const parts = [];
				for (const [kind, label] of [["profile", "Gradiente"], ["cant", "Überhöhung"]]) {
					const ownRange = stationRangeForEntry(own.find((candidate) => candidate.item.kind === kind));
					if (!ownRange) continue;
					const disjoint = ownRange.to < range.from || ownRange.from > range.to;
					if (disjoint || ownRange.from > range.from + 5 || ownRange.to < range.to - 5) {
						parts.push(`${label} ${station(ownRange.from).trim()} – ${station(ownRange.to).trim()} deckt Krümmung ${station(range.from).trim()} – ${station(range.to).trim()} ${disjoint ? "nicht" : "nur teilweise"}`);
					}
				}
				return parts.join(" · ");
			}

			function interpolateSeriesAt(series, x) {
				if (!series.length) return 0;
				if (x <= series[0].x) return series[0].y;
				if (x >= series[series.length - 1].x) return series[series.length - 1].y;
				for (let index = 1; index < series.length; index += 1) {
					if (x <= series[index].x) {
						const a = series[index - 1];
						const b = series[index];
						const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
						return a.y + (b.y - a.y) * t;
					}
				}
				return series[series.length - 1].y;
			}

			// Weichenhöhenplan (IVHW). Basisfall (nur die Referenz ausgewählt, keine
			// weiteren Gleise): Höhenverlauf beider Schienen EINES Gleises über seine
			// eigene intrinsische Station (element.staStart/point.station, nie
			// externalStation) -- kein Streckenbezug, kein Weichen-Clustering.
			// Sobald über bulkSelectedEntries weitere Gleise dazugewählt werden, ist die
			// intrinsische Station jedes Gleises für sich bedeutungslos (Station 0 liegt
			// nicht am selben Ort) -- dann wird auf die gemeinsame externe GND-
			// Kilometrierung umgeschaltet, die reale Übereinstimmung voraussetzt statt sie
			// zu behaupten: Gleise ohne diese Übereinstimmung landen einfach nicht
			// überlappend im Plot, es wird nichts erzwungen oder projiziert.
			// relatedDiagramEntries() statt sevenLineTracks() je Gleis, weil das nur die an
			// GENAU DIESES Gleis gebundene Gradiente/Überhöhung liefert, nicht gleichnamige
			// Objekte aus anderen Dateien (siehe Krümmungsband-Fix).
			const IVHW_RAIL_PALETTE = [
				["#2866c7", "#b5601a"],
				["#7a2ea6", "#c74f8f"],
				["#2e8b57", "#9b8b1f"],
				["#c0392b", "#1f8ba7"],
			];

			// Datenteil des Weichenhöhenplans ohne DOM-Nebenwirkungen: liefert entweder
			// { note } (leer, mit Grund) oder { trackData, subtitle, multiTrack }.
			// Which rail is the higher one at a Weiche. Uwe: bei ABW in der Regel
			// die äußere, bei IBW bestimmt durch das durchgehende Gleis -- both are
			// one rule: the raised rail is the outer rail of the through track's
			// curve at the Weiche, and the branch inherits it. The through track is
			// the Gleis that continues past the junction point; the branch ends
			// there (landXML), or -- GND chunks every alignment at the Weiche -- the
			// pair of chunks that continue each other tangentially. Curvature sign
			// follows curvatureSeries in km direction (Vermessungskonvention:
			// positive = Rechtsbogen), so a Rechtsbogen raises the left rail. Form:
			// branch curving the same way = IBW, the opposite way = ABW, through
			// track straight = EW.
			function junctionRailSides(junction, tracks) {
				if (!junction?.point) return null;
				const near = (end) => Math.hypot(end.easting - junction.point.easting, end.northing - junction.point.northing) < 1;
				// How each Gleis meets the point: which of its ends (if any), the unit
				// vector pointing AWAY from the point along the Gleis, and the
				// curvature at that end (sign in the Gleis's own stationing direction).
				// The km line is no Gleis: it never carries a rail or a Weiche.
				const arms = tracks.filter((track) => sevenLineSide(track) !== "kilometer").map((track) => {
					const ends = alignmentEndpoints(track);
					const atStart = Boolean(ends) && near(ends.start);
					const atEnd = Boolean(ends) && !atStart && near(ends.end);
					if (!atStart && !atEnd) return { track, continuing: true };
					const polyline = referenceStationPolyline(track, 2);
					if (polyline.length < 2) return { track, continuing: true };
					const [p, q] = atStart ? [polyline[0], polyline[1]] : [polyline[polyline.length - 1], polyline[polyline.length - 2]];
					const length = Math.hypot(q.easting - p.easting, q.northing - p.northing) || 1;
					const series = curvatureSeries(track);
					const kappa = series.length ? (atStart ? series[0].y : series[series.length - 1].y) : 0;
					return { track, atStart, atEnd, away: { x: (q.easting - p.easting) / length, y: (q.northing - p.northing) / length }, kappa };
				});
				let through = null;
				let kappa = 0;
				let travel = null;
				let throughName = "";
				const continuing = arms.find((arm) => arm.continuing);
				if (continuing) {
					// The Gleis that runs past the point is the through track. Its
					// curvature is read at the point's station on ITS OWN polyline --
					// the same stationing curvatureSeries() uses -- so this needs no
					// shared km frame and works for VermEsn as well.
					const polyline = referenceStationPolyline(continuing.track, 2);
					const hit = distanceAndStationOnPolyline(polyline, junction.point);
					if (!hit) return { through: null, higher: null, form: null };
					const ownStation = hit.station;
					through = [continuing.track];
					kappa = interpolateSeriesAt(curvatureSeries(continuing.track), ownStation);
					const index = polyline.findIndex((point) => point.station >= ownStation);
					const p = polyline[Math.max(0, index - 1)];
					const q = polyline[Math.min(polyline.length - 1, Math.max(1, index))];
					const length = Math.hypot(q.easting - p.easting, q.northing - p.northing) || 1;
					travel = { x: (q.easting - p.easting) / length, y: (q.northing - p.northing) / length };
					throughName = objectDisplayName(continuing.track);
				} else {
					// GND: every chunk ends at the point. The through track is the pair
					// whose away-vectors are opposite (tangent continuity, within 2 gon);
					// the outgoing chunk (junction at its start) carries the travel
					// direction and curvature in km direction.
					// Where the data names Spitze and Stamm, they are the through pair;
					// otherwise the pair that continues each other within 2 gon.
					let best = null;
					const roleArm = (leg) => leg ? arms.find((arm) => arm.track === leg.entry) : null;
					const spitzeArm = roleArm(junction.roles?.spitze);
					const stammArm = roleArm(junction.roles?.stamm);
					if (spitzeArm && stammArm && spitzeArm !== stammArm) best = { dot: -1, pair: [spitzeArm, stammArm] };
					for (let i = 0; !best && i < arms.length; i += 1) for (let j = i + 1; j < arms.length; j += 1) {
						const dot = arms[i].away.x * arms[j].away.x + arms[i].away.y * arms[j].away.y;
						if (dot < -Math.cos(2 * Math.PI / 200) && (!best || dot < best.dot)) best = { dot, pair: [arms[i], arms[j]] };
					}
					if (!best) return { through: null, higher: null, form: null };
					const outgoing = best.pair.find((arm) => arm.atStart) ?? best.pair[0];
					const incoming = best.pair.find((arm) => arm !== outgoing);
					through = best.pair.map((arm) => arm.track);
					kappa = outgoing.atStart ? outgoing.kappa : -outgoing.kappa;
					travel = outgoing.atStart ? outgoing.away : { x: -incoming.away.x, y: -incoming.away.y };
					throughName = through.map((track) => objectDisplayName(track)).join(" / ");
				}
				// The branch's curvature, read in the through track's travel direction.
				const branch = arms.find((arm) => !arm.continuing && !through.includes(arm.track));
				let kappaBranch = 0;
				if (branch && travel) {
					const along = branch.away.x * travel.x + branch.away.y * travel.y;
					const stationingAlongTravel = branch.atStart ? along > 0 : along < 0;
					kappaBranch = stationingAlongTravel ? branch.kappa : -branch.kappa;
				}
				const straight = Math.abs(kappa) < 1e-6;
				return {
					through,
					throughName,
					higher: straight ? null : kappa > 0 ? "links" : "rechts",
					bogen: straight ? "Gerade" : kappa > 0 ? "Rechtsbogen" : "Linksbogen",
					form: straight ? "EW" : Math.abs(kappaBranch) < 1e-6 ? null : Math.sign(kappaBranch) === Math.sign(kappa) ? "IBW" : "ABW",
				};
			}
			// The IVHW is a Weichenhöhenplan (Ril 883.5240): rails of the Gleise
			// meeting at one Weiche over a shared station. It belongs to the Weiche,
			// not to the selected Streckengleis -- those live in IVMG and GWB -- so
			// it only draws for a junction picked in the Outbox.
			function buildIvhwData(entry) {
				if (!entry || entry.item?.kind !== "alignment") {
					return { note: "kein Gleis ausgewählt", subtitle: "" };
				}
				if (!activeJunction) {
					return { note: "gehört zur Weiche · im Spurplan einen Weichenpunkt anklicken oder in der Outbox unter „Weichen · Topologie“", subtitle: "Streckengleise: IVMG und GWB" };
				}
				const tracks = activeJunction.entries.filter((candidate) => candidate.item?.kind === "alignment" && sevenLineSide(candidate) !== "kilometer");
				const multiTrack = tracks.length > 1;

				function stationOf(point, pointEntry) {
					return multiTrack
						? stationScalar(pointKm(pointEntry, point) ?? point.station ?? point.sta ?? point.s ?? point.chainage)
						: stationScalar(point.station ?? point.sta ?? point.s ?? point.chainage);
				}
				function seriesFor(pointEntry, valueKeys) {
					const points = pointEntry?.item?.payload?.points ?? [];
					return points.map((point) => {
						const raw = valueKeys.map((key) => point?.[key]).find((value) => Number.isFinite(numberValue(value)));
						return { x: stationOf(point, pointEntry), y: numberValue(raw), raw };
					}).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).sort((a, b) => a.x - b.x);
				}

				// Zwei Schienenhöhen aus Gradiente (z, m) + Überhöhung (u, mm) je Station der
				// Gradiente. Welche Schiene (li/re) tatsächlich die höhere ist, hängt von der
				// Bogenrichtung ab und wird hier bewusst NICHT behauptet -- ungeprüft gegen
				// Ril 885.1103 (Musterplan liegt nicht vor). Bis geklärt: neutral als
				// Schiene A/B beschriftet, A = Gradiente, B = Gradiente + Überhöhung.
				const trackData = tracks.map((track) => {
					const own = referencingEntries(track);
					const profile = own.find((candidate) => candidate.item.kind === "profile");
					const cant = own.find((candidate) => candidate.item.kind === "cant");
					const zSeries = profile ? profileSeries(profile, stationOf) : [];
					const uSeries = cant ? seriesFor(cant, CANT_VALUE_KEYS).map((point) => ({ x: point.x, y: cantMillimetres(point.raw) })) : [];
					// A landXML junction sits on Gleise tens of km long with profile
					// points hundreds of metres apart: the Weichenhöhenplan shows the
					// window around the Weiche, the Gradiente sampled every 5 m.
					let railA = zSeries;
					if (activeJunction.window && Number.isFinite(activeJunction.stationRaw) && zSeries.length) {
						const from = Math.max(zSeries[0].x, activeJunction.stationRaw - activeJunction.window);
						const to = Math.min(zSeries[zSeries.length - 1].x, activeJunction.stationRaw + activeJunction.window);
						railA = [];
						for (let x = from; x <= to + 1e-6; x += 5) railA.push({ x, y: interpolateSeriesAt(zSeries, x) });
						if (railA.length && railA[railA.length - 1].x < to) railA.push({ x: to, y: interpolateSeriesAt(zSeries, to) });
					}
					const railB = railA.map((point) => ({ x: point.x, y: point.y + interpolateSeriesAt(uSeries, point.x) / 1000 }));
					return { track, railA, railB, hasCant: uSeries.length > 0 };
				}).filter((data) => data.railA.length);

				if (!trackData.length) {
					return {
						note: multiTrack ? "keine Gradiente (Höhe) für die ausgewählten Gleise verknüpft" : "keine Gradiente (Höhe) für dieses Gleis verknüpft",
						subtitle: multiTrack ? `${tracks.length} Gleise ausgewählt` : "",
					};
				}
				const rails = junctionRailSides(activeJunction, tracks);
				const railNote = rails?.higher
					? ` · ${rails.form ? `${rails.form}, ` : ""}${rails.bogen} von ${rails.throughName}: höhere Schiene ${rails.higher} (Bogenaußenseite), Zweiggleis erbt`
					: rails?.through ? ` · ${rails.throughName} an der Weiche gerade: keine Seite bestimmbar, Schiene A/B` : " · durchgehendes Gleis nicht bestimmbar (keine tangentiale Fortsetzung), Schiene A/B";
				const subtitle = (activeJunction.window
					? `${trackData.length} Gleise · ±${activeJunction.window} m um km ${station(activeJunction.stationRaw).trim()} · Gradiente alle 5 m interpoliert`
					: multiTrack
					? `${trackData.length} Gleise · ${trackData.some((data) => data.track.parser === "vermEsn" && !data.track.externalStationReference) ? "Station je Gleis, ohne gemeinsame Kilometrierung nicht übereinandergelegt" : "gemeinsame externe Kilometrierung"}`
					: trackData[0].hasCant
						? "intrinsische Station · Schiene A = Gradiente, Schiene B = Gradiente + Überhöhung"
						: "intrinsische Station · keine Überhöhung verknüpft, beide Schienen auf Gradientenhöhe") + railNote;
				const sideA = rails?.higher ? (rails.higher === "rechts" ? "links" : "rechts") : "A";
				const sideB = rails?.higher ?? "B";
				return { trackData, subtitle, multiTrack, rails: { sideA, sideB } };
			}

			// Zeichenteil des Weichenhöhenplans in eine verschachtelte Abbildung;
			// liefert die verbrauchte Höhe zurück. Der amtliche Maßstab bleibt exakt.
			function drawIvhwPlot(target, y, ivhw) {
				const { trackData } = ivhw;
				let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
				for (const data of trackData) {
					for (const point of [...data.railA, ...data.railB]) {
						xMin = Math.min(xMin, point.x);
						xMax = Math.max(xMax, point.x);
						yMin = Math.min(yMin, point.y);
						yMax = Math.max(yMax, point.y);
					}
				}
				const xSpan = Math.max(xMax - xMin, 1);
				const ySpan = Math.max(yMax - yMin, 0.05);

				// Amtlicher Planmaßstab (Ril 885.1103): Länge 1:500, Höhe 1:5 -- die Höhe ist
				// exakt 100x überhöht gegenüber der Länge. Die absolute Pixelgröße passt sich
				// dem Panel an, das 100:1-Verhältnis bleibt exakt.
				const width = 1000;
				const left = 90;
				const right = 30;
				const legendRows = trackData.length;
				const top = 18 + legendRows * 14;
				const bottom = 40;
				const plotWidth = width - left - right;
				const pxPerMeterX = plotWidth / xSpan;
				// 100x exaggeration is the official ratio (L 1:500 / H 1:5). As one of
				// three stacked figures it can no longer claim the whole panel, so a
				// steep or long profile gets its exaggeration reduced until it fits
				// 420 units -- and the scale label says so, instead of the nested svg
				// silently clipping the top of the curve.
				const officialExaggeration = 100;
				const maxPlotHeight = 420;
				const exaggeration = Math.min(officialExaggeration, (maxPlotHeight - 40) / Math.max(ySpan * pxPerMeterX, 1e-9));
				const pxPerMeterY = pxPerMeterX * exaggeration;
				const plotHeight = Math.max(60, ySpan * pxPerMeterY + 40);
				const height = top + plotHeight + bottom;
				const figure = nestedFigure(target, y, height);
				registerCursorFigure({ y, height, left, right, xMin, xMax, frame: activeJunction?.window ? "diagram" : null });

				const yBase = top + plotHeight - 20;
				const xAt = (x) => left + (x - xMin) * pxPerMeterX;
				const yAt = (value) => yBase - (value - yMin) * pxPerMeterY;

				for (const mark of roundTicks(xMin, xMax, plotWidth)) {
					const x = left + plotWidth * (mark.value - xMin) / xSpan;
					figure.append(svgElement("line", { x1: x, x2: x, y1: top, y2: yBase, class: "diagram-grid" }));
					const label = svgElement("text", { x, y: height - 12, "text-anchor": "middle", class: "diagram-label diagram-muted" });
					label.textContent = mark.label;
					figure.append(label);
				}
				figure.append(svgElement("line", { x1: left, x2: width - right, y1: yBase, y2: yBase, class: "diagram-axis" }));

				const scaleLabel = svgElement("text", { x: width - right, y: 14, "text-anchor": "end", class: "diagram-label diagram-muted" });
				scaleLabel.textContent = exaggeration >= officialExaggeration - 1e-9
					? "L 1:500 · H 1:5"
					: `L 1:500 · H 1:${Math.round(500 / exaggeration)} · gestaucht statt amtlich 1:5, sonst passt es nicht`;
				figure.append(scaleLabel);

				const pathFor = (series) => series.map((point, index) => `${index ? "L" : "M"} ${xAt(point.x)} ${yAt(point.y)}`).join(" ");
				trackData.forEach((data, index) => {
					const [colorA, colorB] = IVHW_RAIL_PALETTE[index % IVHW_RAIL_PALETTE.length];
					figure.append(svgElement("path", { d: pathFor(data.railA), class: "diagram-series", style: `stroke:${colorA}` }));
					figure.append(svgElement("path", { d: pathFor(data.railB), class: "diagram-series", style: `stroke:${colorB}` }));
					const legendY = 14 + index * 14;
					const legend = svgElement("text", { x: 12, y: legendY, class: "diagram-label" });
					const dashA = svgElement("tspan", { style: `fill:${colorA}` });
					dashA.textContent = `— ${ivhw.rails?.sideA ?? "A"} `;
					const dashB = svgElement("tspan", { style: `fill:${colorB}` });
					dashB.textContent = `— ${ivhw.rails?.sideB ?? "B"} `;
					const name = svgElement("tspan", {});
					name.textContent = objectDisplayName(data.track);
					legend.append(dashA, dashB, name);
					figure.append(legend);
				});
				return height;
			}

			function inverseTransverseMercator(easting, northing, strip) {
				const a = 6377397.155;
				const inverseFlattening = 299.15281;
				const flattening = 1 / inverseFlattening;
				const eccentricitySquared = flattening * (2 - flattening);
				const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
				const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) / (1 + Math.sqrt(1 - eccentricitySquared));
				const meridionalArc = northing;
				const mu = meridionalArc / (a * (
					1 - eccentricitySquared / 4
					- 3 * eccentricitySquared ** 2 / 64
					- 5 * eccentricitySquared ** 3 / 256
				));
				const footpoint = mu
					+ (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
					+ (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
					+ 151 * e1 ** 3 / 96 * Math.sin(6 * mu)
					+ 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
				const sin = Math.sin(footpoint);
				const cos = Math.cos(footpoint);
				const tan = Math.tan(footpoint);
				const n1 = a / Math.sqrt(1 - eccentricitySquared * sin ** 2);
				const r1 = a * (1 - eccentricitySquared) / (1 - eccentricitySquared * sin ** 2) ** 1.5;
				const t1 = tan ** 2;
				const c1 = secondEccentricitySquared * cos ** 2;
				const d = (easting - (strip * 1_000_000 + 500_000)) / n1;
				const latitude = footpoint - (n1 * tan / r1) * (
					d ** 2 / 2
					- (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * secondEccentricitySquared) * d ** 4 / 24
					+ (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * secondEccentricitySquared - 3 * c1 ** 2) * d ** 6 / 720
				);
				const longitude = (strip * 3) * Math.PI / 180 + (
					d - (1 + 2 * t1 + c1) * d ** 3 / 6
					+ (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * secondEccentricitySquared + 24 * t1 ** 2) * d ** 5 / 120
				) / cos;
				return { longitude, latitude, a, eccentricitySquared };
			}

			function geodeticToEcef({ longitude, latitude, a, eccentricitySquared }) {
				const n = a / Math.sqrt(1 - eccentricitySquared * Math.sin(latitude) ** 2);
				return {
					x: n * Math.cos(latitude) * Math.cos(longitude),
					y: n * Math.cos(latitude) * Math.sin(longitude),
					z: n * (1 - eccentricitySquared) * Math.sin(latitude),
				};
			}

			function helmertToEtrs89(point) {
				const scale = 1 + 7.992235e-6;
				const arcSecond = Math.PI / (180 * 3600);
				const rx = 1.1155214628 * arcSecond;
				const ry = 0.282433989 * arcSecond;
				const rz = -3.1384490633 * arcSecond;
				return {
					x: 584.9636 + scale * point.x - rz * point.y + ry * point.z,
					y: 107.7175 + rz * point.x + scale * point.y - rx * point.z,
					z: 413.8067 - ry * point.x + rx * point.y + scale * point.z,
				};
			}

			function ecefToWgs84(point) {
				const a = 6378137;
				const f = 1 / 298.257223563;
				const e2 = f * (2 - f);
				const longitude = Math.atan2(point.y, point.x);
				const p = Math.hypot(point.x, point.y);
				let latitude = Math.atan2(point.z, p * (1 - e2));
				for (let index = 0; index < 8; index += 1) {
					const n = a / Math.sqrt(1 - e2 * Math.sin(latitude) ** 2);
					latitude = Math.atan2(point.z + e2 * n * Math.sin(latitude), p);
				}
				return { longitude, latitude };
			}

			function dbRefToWebMercator(easting, northing, lsys) {
				const geographic = dbRefToLonLat(easting, northing, lsys);
				if (!geographic) return null;
				const radius = 6378137;
				return {
					x: radius * geographic.longitude * Math.PI / 180,
					y: -radius * Math.log(Math.tan(Math.PI / 4 + geographic.latitude * Math.PI / 360)),
				};
			}

			function dbRefToLonLat(easting, northing, lsys) {
				const strip = DBREF_STRIPS[lsys];
				if (!strip) return null;
				const bessel = inverseTransverseMercator(easting, northing, strip);
				const etrs89 = ecefToWgs84(helmertToEtrs89(geodeticToEcef(bessel)));
				return {
					longitude: etrs89.longitude * 180 / Math.PI,
					latitude: etrs89.latitude * 180 / Math.PI,
				};
			}

			function inferredGkStrip(easting) {
				const value = Math.abs(Number(easting));
				if (!Number.isFinite(value)) return null;
				const strip = Math.floor(value / 1_000_000);
				const localEasting = value - strip * 1_000_000;
				return strip >= 2 && strip <= 5 && localEasting >= 100_000 && localEasting <= 900_000 ? strip : null;
			}

			function isPlausibleGkCoordinate(easting, northing) {
				const y = Number(northing);
				return Boolean(inferredGkStrip(easting)) && Number.isFinite(y) && y >= 4_500_000 && y <= 6_500_000;
			}

			function inferredGkToLonLat(easting, northing) {
				const strip = inferredGkStrip(easting);
				if (!strip || !isPlausibleGkCoordinate(easting, northing)) return null;
				const bessel = inverseTransverseMercator(Number(easting), Number(northing), strip);
				const approximate = ecefToWgs84(helmertToEtrs89(geodeticToEcef(bessel)));
				return {
					longitude: approximate.longitude * 180 / Math.PI,
					latitude: approximate.latitude * 180 / Math.PI,
					strip,
				};
			}

			function geographicPoint(point, entry) {
				const easting = Number(point?.easting);
				const northing = Number(point?.northing);
				if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
				const confirmed = dbRefToLonLat(easting, northing, effectiveLsys(entry));
				if (confirmed) return { ...confirmed, confidence: "confirmed" };
				const inferred = inferredGkToLonLat(easting, northing);
				return inferred ? { ...inferred, confidence: "inferred" } : null;
			}

			function geographicPointToWebMercator(point, entry) {
				const geographic = geographicPoint(point, entry);
				if (!geographic) return null;
				const radius = 6378137;
				return {
					x: radius * geographic.longitude * Math.PI / 180,
					y: -radius * Math.log(Math.tan(Math.PI / 4 + geographic.latitude * Math.PI / 360)),
					confidence: geographic.confidence,
				};
			}

			function mapPoint(point, entry, mode) {
				const x = Number(point?.easting);
				const y = Number(point?.northing);
				if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
				if (mode === "crs") return geographicPointToWebMercator(point, entry);
				return { x, y: -y };
			}

			// A spiral's (Klothoide/clothoid) curvature changes linearly with arc
			// length, so its heading has a closed form (theta(s) = theta0 + k0*s +
			// rate*s^2/2) but its position does not -- unlike a circular arc, x(s)/
			// y(s) have no elementary antiderivative. Integrate sin/cos(heading)
			// numerically instead: this is exact for a straight line or circular arc
			// (rate = 0 reduces theta(s) to the same linear form the closed-form
			// circular branch below uses) and, for a true clothoid, accurate to well
			// under a centimeter at real rail transition lengths -- ten fine substeps
			// per requested output point keeps trapezoidal error negligible without
			// pulling in a Fresnel-integral implementation.
			// Signed turn direction for the Krümmung diagram: landXML's radius is
			// an unsigned magnitude with direction carried separately in rot, so
			// without this every curve/spiral shows identical positive curvature
			// regardless of which way it actually turns. VermEsn/GND never set
			// rot (their radius is pre-signed instead), so this is a no-op there.
			// Sign convention at the UI boundary (decided 2026-11-03): the diagram
			// and every readout use the Vermessungskonvention, positive = Rechtsbogen
			// (cw), which is how VermEsn/GND already pre-sign R (R > 0 = rechts).
			// Internally the landXML bridge (resolveCurvature) stays mathematically
			// signed (cw = -1/r); nothing there is touched.
			function curveRotationSign(element) {
				const rot = element?.type === "Spiral" ? element?.extras?.rot : element?.rot;
				return rot === "cw" ? 1 : rot === "ccw" ? -1 : 1;
			}

			// landXML's dirStart/dirEnd on a Curve turn out not to be a reliable
			// tangent bearing for this sampler's purposes (confirmed against
			// SCx_1720.xml: reconstructing a Curve's own declared <End> from
			// <Start> + dirStart + radius, in either rotational sign, leaves
			// 200-1000m of residual error -- the visible "spike" this was
			// reported against). A Curve's <Center> has no such ambiguity -- it
			// is a literal coordinate -- so this sweeps around it directly
			// instead (verified to sub-millimetre accuracy on both a rot="cw"
			// and a rot="ccw" curve from that file). VermEsn/GND curves carry no
			// <Center> (and store radius pre-signed with direction baked in), so
			// they fall through to the original heading-based formula unchanged.
			// Returns null when center/radius/rot aren't all available.
			function curveCenterSweep(element, length, segments) {
				const center = {
					easting: Number(element?.center?.easting),
					northing: Number(element?.center?.northing),
				};
				const start = {
					easting: Number(element?.start?.easting),
					northing: Number(element?.start?.northing),
				};
				const radius = numberValue(element?.radius ?? element?.radiusStart);
				const rot = element?.rot;
				if (!Number.isFinite(center.easting) || !Number.isFinite(center.northing)) return null;
				if (!Number.isFinite(radius) || radius === 0) return null;
				if (rot !== "cw" && rot !== "ccw") return null;
				const sign = rot === "cw" ? -1 : 1;
				const angle0 = Math.atan2(start.northing - center.northing, start.easting - center.easting);
				const points = [];
				for (let index = 0; index <= segments; index += 1) {
					const distance = length * (index / segments);
					const angle = angle0 + sign * distance / radius;
					points.push({
						easting: center.easting + radius * Math.cos(angle),
						northing: center.northing + radius * Math.sin(angle),
					});
				}
				return points;
			}

			// landXML's PI is the literal coordinate where the spiral's entry and
			// exit tangent lines intersect, so Start-to-PI is the true initial
			// tangent bearing in plain (easting, northing) math terms -- no
			// dirStart-convention guessing needed (verified to sub-millimetre
			// accuracy against SCx_1720.xml's rot="cw" INF-to-922m spiral at
			// staStart 269585.199751, using cos->easting/sin->northing with that
			// native angle, matching the same convention curveCenterSweep uses).
			// VermEsn/GND spirals carry no <PI>, so they keep the original
			// dirStart-based formula below untouched.
			function nativeHeadingFromPi(element, start) {
				const pi = { easting: Number(element?.pi?.easting), northing: Number(element?.pi?.northing) };
				if (!Number.isFinite(pi.easting) || !Number.isFinite(pi.northing)) return null;
				if (pi.easting === start.easting && pi.northing === start.northing) return null;
				return Math.atan2(pi.northing - start.northing, pi.easting - start.easting);
			}

			// Übergangsbogen families as AIM's registry has them: the normalised
			// curvature shape k(u) and its integral K(u) over u = s/L, so that
			// κ(s) = κ0 + Δκ k(u) and the heading is θ0 + κ0 s + Δκ L K(u). The viewer
			// meets four names in VermEsn and GND: Klothoide (k = u), Bloss
			// (3u² − 2u³, both half-waves), "Bloss (1f geschw.)" -- the einfach
			// geschwungene Bloss, which is ONE half-wave of it (Uwe, 20.10.): alone
			// the first, (3u² − u³)/2 with the flat end at its start, the registry's
			// HW_BLOSS = BLOSS cropped to [0, 0.5]; following another 1f-Bloss the
			// second, mirrored, flat at its end, so two of them compose the full
			// S -- and "ÜB S-Form" = Helmert (2u² up to the middle, 1 − 2(1−u)²
			// beyond). Anything else is read as a Klothoide, as it was before.
			const TRANSITION_SHAPES = {
				clothoid: { k: (u) => u, K: (u) => u * u / 2 },
				bloss: { k: (u) => 3 * u * u - 2 * u * u * u, K: (u) => u * u * u - u * u * u * u / 2 },
				blossHalf1: { k: (u) => (3 * u * u - u * u * u) / 2, K: (u) => u * u * u / 2 - u * u * u * u / 8 },
				blossHalf2: { k: (u) => 1 - (3 * (1 - u) ** 2 - (1 - u) ** 3) / 2, K: (u) => u - 3 / 8 + ((1 - u) ** 3 / 2 - (1 - u) ** 4 / 8) },
				helmert: { k: (u) => u <= 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u), K: (u) => u <= 0.5 ? 2 * u * u * u / 3 : (u - 0.5) + 2 * (1 - u) ** 3 / 3 },
			};
			function isHalfBloss(element) {
				return element?.type === "Spiral" && /bloss/i.test(String(element.spiType ?? "")) && /1f|einfach/i.test(String(element.spiType ?? ""));
			}
			// Which half-wave a 1f-Bloss is follows from its neighbour: the first
			// unless the element before it is a 1f-Bloss too. Marked once per object
			// after import so every sampler reads the same answer.
			function markBlossHalfWaves(elements) {
				let previous = null;
				for (const element of elements) {
					if (isHalfBloss(element)) {
						element.extras = element.extras ?? {};
						element.extras.blossHalfWave = isHalfBloss(previous) && previous.extras?.blossHalfWave === 1 ? 2 : 1;
					}
					previous = element;
				}
			}
			function transitionShapeOf(element) {
				const name = String(element?.spiType ?? "").toLowerCase();
				if (isHalfBloss(element)) return element.extras?.blossHalfWave === 2 ? TRANSITION_SHAPES.blossHalf2 : TRANSITION_SHAPES.blossHalf1;
				if (/bloss/.test(name)) return TRANSITION_SHAPES.bloss;
				if (/helmert|s-form/.test(name)) return TRANSITION_SHAPES.helmert;
				return TRANSITION_SHAPES.clothoid;
			}
			function sampleSpiralElement(element, start, end, length, maximumStep) {
				const shape = transitionShapeOf(element);
				const rot = element?.extras?.rot;
				const nativeHeading0 = (rot === "cw" || rot === "ccw") ? nativeHeadingFromPi(element, start) : null;
				const radiusStart = numberValue(element?.radiusStart);
				const radiusEnd = numberValue(element?.radiusEnd);
				const magnitudeStart = Number.isFinite(radiusStart) && radiusStart !== 0 ? 1 / radiusStart : 0;
				const magnitudeEnd = Number.isFinite(radiusEnd) && radiusEnd !== 0 ? 1 / radiusEnd : 0;
				const outputSegments = Math.max(1, Math.min(500, Math.ceil(length / maximumStep)));
				const fineStepsPerOutput = 10;
				const fineSteps = outputSegments * fineStepsPerOutput;
				const ds = length / fineSteps;
				const points = [start];
				let easting = start.easting;
				let northing = start.northing;
				if (nativeHeading0 != null) {
					const sign = rot === "cw" ? -1 : 1;
					const curvatureStart = sign * magnitudeStart;
					const deltaKappa = sign * (magnitudeEnd - magnitudeStart);
					const headingAt = (s) => nativeHeading0 + curvatureStart * s + deltaKappa * length * shape.K(s / length);
					let previousHeading = headingAt(0);
					for (let index = 1; index <= fineSteps; index += 1) {
						const heading = headingAt(index * ds);
						easting += ds * (Math.cos(previousHeading) + Math.cos(heading)) / 2;
						northing += ds * (Math.sin(previousHeading) + Math.sin(heading)) / 2;
						previousHeading = heading;
						if (index % fineStepsPerOutput === 0) points.push(index === fineSteps ? end : { easting, northing });
					}
					return points;
				}
				const bearingGon = angleGon(element?.direction ?? element?.dirStart);
				if (!Number.isFinite(bearingGon) || !(length > 0)) return [start, end];
				const deltaKappa = magnitudeEnd - magnitudeStart;
				const heading0 = bearingGon * Math.PI / 200;
				const headingAt = (s) => heading0 + magnitudeStart * s + deltaKappa * length * shape.K(s / length);
				let previousHeading = headingAt(0);
				for (let index = 1; index <= fineSteps; index += 1) {
					const heading = headingAt(index * ds);
					easting += ds * (Math.sin(previousHeading) + Math.sin(heading)) / 2;
					northing += ds * (Math.cos(previousHeading) + Math.cos(heading)) / 2;
					previousHeading = heading;
					if (index % fineStepsPerOutput === 0) points.push(index === fineSteps ? end : { easting, northing });
				}
				return points;
			}

			function sampleElementSource(element, maximumStep = 5) {
				const start = {
					easting: Number(element?.start?.easting),
					northing: Number(element?.start?.northing),
				};
				const end = {
					easting: Number(element?.end?.easting),
					northing: Number(element?.end?.northing),
				};
				if (![start.easting, start.northing, end.easting, end.northing].every(Number.isFinite)) return [];
				const declaredLength = Math.abs(numberValue(element?.length));
				const chordLength = Math.hypot(end.easting - start.easting, end.northing - start.northing);
				const length = Number.isFinite(declaredLength) && declaredLength > 0 ? declaredLength : chordLength;
				if (element?.type === "Spiral") return sampleSpiralElement(element, start, end, length, maximumStep);
				const segments = Math.max(1, Math.min(500, Math.ceil(length / maximumStep)));
				if (element?.type === "Curve") {
					const centerSweep = curveCenterSweep(element, length, segments);
					if (centerSweep) {
						centerSweep[centerSweep.length - 1] = end;
						return centerSweep;
					}
				}
				const radius = numberValue(element?.radius ?? element?.radiusStart);
				const bearingGon = angleGon(element?.direction ?? element?.dirStart);
				const isCircular = element?.type === "Curve" && Number.isFinite(radius) && radius !== 0 && Number.isFinite(bearingGon);
				const points = [];
				for (let index = 0; index <= segments; index += 1) {
					if (index === segments) {
						points.push(end);
						continue;
					}
					const ratio = index / segments;
					if (isCircular) {
						const distance = length * ratio;
						const heading0 = bearingGon * Math.PI / 200;
						const heading = heading0 + distance / radius;
						points.push({
							easting: start.easting + radius * (Math.cos(heading0) - Math.cos(heading)),
							northing: start.northing + radius * (Math.sin(heading) - Math.sin(heading0)),
						});
					} else {
						points.push({
							easting: start.easting + (end.easting - start.easting) * ratio,
							northing: start.northing + (end.northing - start.northing) * ratio,
						});
					}
				}
				return points;
			}

			function mapPathForEntry(entry, mode) {
				const cacheKey = `${mode}:${effectiveLsys(entry) || "-"}`;
				const cached = cacheFor(mapGeometryCache, entry).get(cacheKey);
				if (cached) return cached;
				const elements = entry.item?.payload?.coordGeom?.elements ?? [];
				let path = "";
				let previousEnd = null;
				const points = [];
				for (const element of elements) {
					const sampled = sampleElementSource(element).map((point) => mapPoint(point, entry, mode)).filter(Boolean);
					if (sampled.length < 2) continue;
					for (const point of sampled) points.push(point);
					const start = sampled[0];
					if (!previousEnd || Math.hypot(start.x - previousEnd.x, start.y - previousEnd.y) > 0.001) path += `M ${start.x} ${start.y} `;
					for (const point of sampled.slice(1)) path += `L ${point.x} ${point.y} `;
					previousEnd = sampled.at(-1);
				}
				const result = { path, points, inferred: points.some((point) => point.confidence === "inferred") };
				cacheFor(mapGeometryCache, entry).set(cacheKey, result);
				return result;
			}

			function mapPivot() {
				return fullMapViewBox ? { x: fullMapViewBox.x + fullMapViewBox.width / 2, y: fullMapViewBox.y + fullMapViewBox.height / 2 } : { x: 0, y: 0 };
			}
			// Map coordinates to the SVG's own (what the viewBox speaks) and back.
			function mapWorldToView(point, angle = mapRotation) {
				if (!angle) return point;
				const pivot = mapPivot();
				const radians = angle * Math.PI / 180;
				const dx = point.x - pivot.x;
				const dy = point.y - pivot.y;
				return { x: pivot.x + dx * Math.cos(radians) - dy * Math.sin(radians), y: pivot.y + dx * Math.sin(radians) + dy * Math.cos(radians) };
			}
			function mapViewToWorld(point) {
				return mapWorldToView(point, -mapRotation);
			}
			// The box around points as the turned map shows them.
			function mapViewBounds(points) {
				const shown = mapRotation ? points.map((point) => mapWorldToView(point)) : points;
				const xs = shown.map((point) => point.x);
				const ys = shown.map((point) => point.y);
				return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
			}
			function mapNorthAngle() {
				return maplibreMap && !maplibreMapElement.classList.contains("hidden") ? -(maplibreMap.getBearing?.() ?? 0) : mapRotation;
			}
			function applyMapRotation() {
				if (mapWorld) {
					const pivot = mapPivot();
					if (mapRotation) mapWorld.setAttribute("transform", `rotate(${mapRotation} ${pivot.x} ${pivot.y})`);
					else mapWorld.removeAttribute("transform");
				}
				const angle = mapNorthAngle();
				const rounded = Math.round(angle);
				mapNorthArrow.style.transform = angle ? `rotate(${angle}deg)` : "";
				mapNorth.classList.toggle("gedreht", rounded !== 0);
				mapNorth.title = `${rounded ? `Ansicht um ${Math.abs(rounded)}° ${rounded > 0 ? "im" : "gegen den"} Uhrzeigersinn gedreht. Klick: Norden nach oben.` : "Nordpfeil: Norden ist oben."} Drehen: Alt + Ziehen oder rechte Maustaste ziehen.`;
			}
			// Turns the own map to an angle; what stands in the middle of the view
			// stays there.
			function setMapRotation(angle) {
				const next = ((angle % 360) + 540) % 360 - 180;
				if (!currentMapViewBox) { mapRotation = next; applyMapRotation(); return; }
				const center = { x: currentMapViewBox.x + currentMapViewBox.width / 2, y: currentMapViewBox.y + currentMapViewBox.height / 2 };
				const world = mapViewToWorld(center);
				mapRotation = next;
				const moved = mapWorldToView(world);
				currentMapViewBox = { ...currentMapViewBox, x: currentMapViewBox.x + moved.x - center.x, y: currentMapViewBox.y + moved.y - center.y };
				applyMapRotation();
				applyMapViewBox();
			}
			function applyMapViewBox() {
				if (!currentMapViewBox) return;
				const { x, y, width, height } = currentMapViewBox;
				multi2d.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
				// Stones keep their pixel size: rescale their groups with the view.
				const scale = width / Math.max(multi2d.getBoundingClientRect().width, 1);
				for (const group of multi2d.querySelectorAll(".km-stone-major")) {
					group.setAttribute("transform", `translate(${group.dataset.x} ${group.dataset.y}) scale(${scale})${mapRotation ? ` rotate(${-mapRotation})` : ""}`);
				}
				drawMapCursor();
			}

			function fitMap() {
				if (maplibreMap && !maplibreMapElement.classList.contains("hidden")) {
					fitBasemap();
					return;
				}
				if (!fullMapViewBox) return;
				if (mapRotation) {
					const { x, y, width, height } = fullMapViewBox;
					const box = mapViewBounds([{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }]);
					currentMapViewBox = { x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY };
				} else currentMapViewBox = { ...fullMapViewBox };
				applyMapViewBox();
			}

			function zoomMap(factor, clientPoint = null) {
				if (maplibreMap && !maplibreMapElement.classList.contains("hidden")) {
					maplibreMap.zoomTo(maplibreMap.getZoom() + (factor < 1 ? 1 : -1));
					return;
				}
				if (!currentMapViewBox) return;
				// The point under the pointer stays where it is. It is read through
				// the SVG's own matrix: the picture is fitted into the panel whole
				// (meet), so a share of the panel's width is not a share of the
				// viewBox when their shapes differ, and the point drifted (9 px a
				// step in Landshut).
				const centerX = currentMapViewBox.x + currentMapViewBox.width / 2;
				const centerY = currentMapViewBox.y + currentMapViewBox.height / 2;
				const anchor = (clientPoint ? svgPointFromEvent(multi2d, { clientX: clientPoint.x, clientY: clientPoint.y }) : null) ?? { x: centerX, y: centerY };
				const width = currentMapViewBox.width * factor;
				const height = currentMapViewBox.height * factor;
				currentMapViewBox = {
					x: anchor.x - factor * (anchor.x - centerX) - width / 2,
					y: anchor.y - factor * (anchor.y - centerY) - height / 2,
					width,
					height,
				};
				applyMapViewBox();
			}

			function startMapPan(event) {
				// Alt + Ziehen, Strg + Ziehen or the right button turn the view about
				// its middle (the grips MapLibre has with the Kartenunterlage on).
				const rotate = event.button === 2 || (event.button === 0 && (event.altKey || event.ctrlKey));
				if (!currentMapViewBox || (event.button !== 0 && !rotate)) return;
				const box = multi2d.getBoundingClientRect();
				mapDrag = {
					rotate,
					angle: Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)),
					rotation: mapRotation,
					pointerId: event.pointerId,
					x: event.clientX,
					y: event.clientY,
					origin: { ...currentMapViewBox },
					moved: false,
				};
				try { multi2d.setPointerCapture(event.pointerId); } catch { /* no such pointer */ }
				multi2d.classList.add(rotate ? "rotating" : "panning");
			}

			function moveMapPan(event) {
				if (!mapDrag || event.pointerId !== mapDrag.pointerId) return;
				const rect = multi2d.getBoundingClientRect();
				if (!rect.width || !rect.height) return;
				const deltaX = event.clientX - mapDrag.x;
				const deltaY = event.clientY - mapDrag.y;
				mapDrag.moved ||= Math.hypot(deltaX, deltaY) > 3;
				if (mapDrag.rotate) {
					const now = Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
					setMapRotation(mapDrag.rotation + (now - mapDrag.angle) * 180 / Math.PI);
					return;
				}
				// One scale for both directions, the one the picture is drawn with
				// (meet): with a scale per axis the map followed the pointer by 58 %
				// where the viewBox is narrower than the panel.
				const unit = Math.max(mapDrag.origin.width / rect.width, mapDrag.origin.height / rect.height);
				currentMapViewBox = {
					x: mapDrag.origin.x - deltaX * unit,
					y: mapDrag.origin.y - deltaY * unit,
					width: mapDrag.origin.width,
					height: mapDrag.origin.height,
				};
				applyMapViewBox();
			}

			function endMapPan(event) {
				if (!mapDrag || event.pointerId !== mapDrag.pointerId) return;
				try { multi2d.releasePointerCapture?.(event.pointerId); } catch { /* no such pointer */ }
				multi2d.classList.remove("panning", "rotating");
				const moved = mapDrag.moved;
				mapDrag = null;
				if (moved) multi2d.dataset.suppressClick = "true";
			}

			// Main vs. Ableitung. "Main" is reading the data, linking it (which cant
			// belongs to which track, which side, which station axis) and
			// interpreting it in 2D. Everything below that -- curvature, speed,
			// precision colours, the reject list, IVHW rails, junctions -- is a
			// derivation: a formula or a threshold over Main, carrying assumptions
			// that must stay visible and must never write back into Main.
			//
			// interpretedGeometry() is the 2D piece of Main for one alignment: each
			// element sampled (Center/PI-based) and projected once, per entry and
			// frame. The map lines, the precision heatmap and the reject list all
			// read from it -- previously each of them resampled and reprojected
			// the whole file on its own (the reject list on every map pan).
			function interpretedGeometry(entry) {
				const cacheKey = effectiveLsys(entry) || "-";
				const cached = cacheFor(geometryModelCache, entry).get(cacheKey);
				if (cached) return cached;
				const elements = [];
				const coordinates = [];
				let confidence = "confirmed";
				for (const element of entry.item?.payload?.coordGeom?.elements ?? []) {
					const own = [];
					for (const point of sampleElementSource(element)) {
						const coordinate = geographicPoint(point, entry);
						if (!coordinate) continue;
						if (coordinate.confidence === "inferred") confidence = "inferred";
						const pair = [coordinate.longitude, coordinate.latitude];
						if (!own.length || pair[0] !== own.at(-1)[0] || pair[1] !== own.at(-1)[1]) own.push(pair);
						if (!coordinates.length || pair[0] !== coordinates.at(-1)[0] || pair[1] !== coordinates.at(-1)[1]) coordinates.push(pair);
					}
					const sourcePoint = element?.start;
					elements.push({
						element,
						coordinates: own,
						precisionValue: precisionForElement(element),
						station: stationScalar(elementKmStart(entry, element) ?? element?.staStart),
						easting: numberValue(sourcePoint?.easting),
						northing: numberValue(sourcePoint?.northing),
					});
				}
				const model = { confidence, coordinates, elements };
				cacheFor(geometryModelCache, entry).set(cacheKey, model);
				return model;
			}

			function geographicFeatureCollection() {
				const features = [];
				geoEntryById = new Map();
				let featureIndex = 0;
				for (const loaded of loadedFiles) {
					for (const entry of loaded.objects) {
						if (entry.item.kind !== "alignment" || isEntryHidden(entry)) continue;
						const { confidence, coordinates } = interpretedGeometry(entry);
						if (coordinates.length < 2) continue;
						const id = String(featureIndex++);
						geoEntryById.set(id, entry);
						const side = sevenLineSide(entry);
						features.push({
							type: "Feature",
							properties: {
								id,
								active: entry === selectedEntry ? 1 : 0,
								confidence,
								pointQuality: pointQualityForEntry(entry),
								kilometerLine: side === "kilometer" ? 1 : 0,
								side,
								route: routeForEntry(entry),
							},
							geometry: { type: "LineString", coordinates },
						});
					}
				}
				return { type: "FeatureCollection", features };
			}

			// Derivation: GND carries a real per-point survey precision
			// (meanPointError, decoded from MP/MPEXP in metres) that otherwise only
			// collapses into a coarse alignment-wide "Qualität offen / limited"
			// label (pointQualityForEntry below). Averaged per element here, so the
			// map can colour a continuous gradient along the track.
			function precisionForElement(element) {
				const candidates = [element?.extras?.meanPointError, element?.extras?.meanPointErrorEnd]
					.filter((item) => item && Number.isFinite(item.value));
				if (!candidates.length) return null;
				return candidates.reduce((sum, item) => sum + item.value, 0) / candidates.length;
			}

			// Höhenpräzision: the GND reports it per Gradientenpunkt (MH/MHEXP on
			// the PH record), not per Trassenelement. On the map it is laid onto
			// the Trasse through its own Gradiente: an element takes the height
			// error of the nearest Gradientenpunkt in station, within
			// HEIGHT_PRECISION_REACH_M; farther away it stays "keine Angabe".
			// Assumption, stated: the height error of a point stands for the
			// stretch around it, not just for the point.
			const HEIGHT_PRECISION_REACH_M = 250;
			const precisionKindSelect = document.querySelector("#precisionKind");
			function precisionKind() { return precisionKindSelect.value === "height" ? "height" : "point"; }
			function precisionKindLabel(kind = precisionKind()) { return kind === "height" ? "Höhengenauigkeit (GND meanHeightError)" : "Punktgenauigkeit (GND meanPointError)"; }
			const heightPrecisionCache = new WeakMap();
			function heightPrecisionPoints(alignment) {
				if (heightPrecisionCache.has(alignment)) return heightPrecisionCache.get(alignment);
				const points = [];
				for (const profile of referencingEntries(alignment).filter((candidate) => candidate.item.kind === "profile")) {
					for (const point of profile.item?.payload?.points ?? []) {
						const error = point?.extras?.meanHeightError;
						const station = stationScalar(pointKm(profile, point) ?? point.station ?? point.sta);
						if (!error || !Number.isFinite(error.value) || !Number.isFinite(station)) continue;
						points.push({ station, value: error.value });
					}
				}
				points.sort((a, b) => a.station - b.station);
				heightPrecisionCache.set(alignment, points);
				return points;
			}
			function heightPrecisionForElement(alignment, station) {
				if (!Number.isFinite(station)) return null;
				const points = heightPrecisionPoints(alignment);
				let best = null;
				for (const point of points) {
					const distance = Math.abs(point.station - station);
					if (distance > HEIGHT_PRECISION_REACH_M) continue;
					if (!best || distance < best.distance) best = { distance, value: point.value };
				}
				return best ? best.value : null;
			}

			function precisionFeatureCollection() {
				const features = [];
				precisionEntryById = new Map();
				const kind = precisionKind();
				let featureIndex = 0;
				for (const loaded of loadedFiles) {
					for (const entry of loaded.objects) {
						if (entry.item.kind !== "alignment" || isEntryHidden(entry)) continue;
						for (const item of interpretedGeometry(entry).elements) {
							if (item.coordinates.length < 2) continue;
							const id = String(featureIndex++);
							precisionEntryById.set(id, entry);
							features.push({
								type: "Feature",
								properties: {
									id,
									active: entry === selectedEntry ? 1 : 0,
									precisionValue: kind === "height" ? heightPrecisionForElement(entry, item.station) : item.precisionValue,
									kilometerLine: sevenLineSide(entry) === "kilometer" ? 1 : 0,
									precisionStation: item.station,
									precisionEasting: item.easting,
									precisionNorthing: item.northing,
									fileName: loaded.fileName ?? "",
									objectName: objectDisplayName(entry),
								},
								geometry: { type: "LineString", coordinates: item.coordinates },
							});
						}
					}
				}
				return { type: "FeatureCollection", features };
			}

			// < 1cm in mm, < 1m in cm, otherwise m -- matches the legend buckets
			// and keeps the number the size a surveyor actually thinks in.
			function formatPrecisionValue(value) {
				if (!Number.isFinite(value)) return "keine Angabe";
				if (value < 0.0005) return "< 1 mm";
				if (value < 0.01) return `${Math.round(value * 1000)} mm`;
				if (value < 1) return `${(value * 100).toFixed(1)} cm`;
				return `${value.toFixed(2)} m`;
			}

			function focusPrecisionFeature(properties, lngLat) {
				precisionPopup?.remove();
				const stationLabel = Number.isFinite(properties.precisionStation) ? `bei km ${station(properties.precisionStation).trim()}` : null;
				precisionPopup = new globalThis.maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "220px" })
					.setLngLat(lngLat)
					.setHTML(
						`<strong>${precisionKind() === "height" ? "Höhengenauigkeit" : "Punktgenauigkeit"}: ${xml(formatPrecisionValue(properties.precisionValue))}</strong>` +
						(stationLabel ? `<br>${xml(stationLabel)}` : "") +
						`<br><span style="opacity:.7">(${precisionKind() === "height" ? "GND meanHeightError am nächsten Gradientenpunkt" : "GND meanPointError"}, Skala nach Ril 883.3100)</span>`,
					)
					.addTo(maplibreMap);
				const entry = precisionEntryById.get(String(properties.id));
				if (entry) selectObject(entry, entry.button);
			}

			// Uwe's ask: don't just color the map, enumerate every segment worse
			// than the threshold so the ProjektIng can work through them one by
			// one -- the PM only needs the count on the button, the PI opens the
			// panel and gets the full list.
			function collectRejectList() {
				return precisionFeatureCollection().features
					.filter((feature) => Number.isFinite(feature.properties.precisionValue) && feature.properties.precisionValue > PRECISION_REJECT_THRESHOLD)
					.sort((a, b) => b.properties.precisionValue - a.properties.precisionValue);
			}

			function precisionStepExpression() {
				const expression = ["step", ["get", "precisionValue"], PRECISION_CLASSES[0].color];
				for (let index = 1; index < PRECISION_CLASSES.length; index += 1) expression.push(PRECISION_CLASSES[index - 1].max, PRECISION_CLASSES[index].color);
				return expression;
			}
			function precisionSwatchColor(value) {
				return (PRECISION_CLASSES.find((cls) => value <= cls.max) ?? PRECISION_CLASSES.at(-1)).color;
			}
			// The legend is the table, so both say the same thing.
			function renderPrecisionLegend() {
				const items = PRECISION_CLASSES.map((cls) => {
					const item = document.createElement("span");
					item.className = "legend-item";
					item.style.setProperty("--swatch", cls.color);
					item.textContent = cls.label;
					item.title = cls.note;
					return item;
				});
				const unknown = document.createElement("span");
				unknown.className = "legend-item";
				unknown.style.setProperty("--swatch", PRECISION_UNKNOWN_COLOR);
				unknown.textContent = "keine Angabe";
				const source = document.createElement("span");
				source.className = "legend-source";
				source.textContent = `σ nach ${PRECISION_SOURCE}`;
				precisionLegend.replaceChildren(...items, unknown, source);
			}
			renderPrecisionLegend();

			// Apple Maps-style scoping: a pin list narrows to what's actually on
			// screen as you pan/zoom, instead of making the reader match rows
			// against a viewport full of other lines. "Visible" means any point
			// of the segment falls inside the current bounds -- partially
			// on-screen still counts, only fully-scrolled-off segments drop out.
			function isFeatureVisibleInViewport(feature) {
				if (!maplibreMap) return true;
				const bounds = maplibreMap.getBounds();
				return feature.geometry.coordinates.some((coordinate) => bounds.contains(coordinate));
			}

			function csvField(value) {
				const text = String(value ?? "");
				return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
			}

			function csvNumber(value, decimals) {
				return Number.isFinite(value) ? value.toFixed(decimals).replace(".", ",") : "";
			}

			// The PI's actual next action (Nachvermessung beauftragen, gegen den
			// Lageplan abgleichen) needs a document, not an open browser tab --
			// German-locale CSV (semicolon-separated, comma decimals, UTF-8 BOM)
			// so it opens straight into Excel with no import wizard. Always the
			// full list, never just what's currently scrolled into view: a
			// handoff document that silently drops rows because someone was
			// zoomed in when they exported it would be worse than none.
			function buildRejectListCsv() {
				const items = collectRejectList();
				const lines = [
					`Ausschussliste - ${precisionKindLabel()} > σ_r ${formatPrecisionValue(PRECISION_REJECT_THRESHOLD)} (Ril 883.3100)`,
					`Exportiert: ${new Date().toLocaleString("de-DE")}`,
					"",
					["Datei", "Objekt", "Station", precisionKind() === "height" ? "Hoehengenauigkeit_m" : "Punktgenauigkeit_m", "Easting", "Northing"].join(";"),
				];
				for (const feature of items) {
					const p = feature.properties;
					lines.push([
						csvField(p.fileName),
						csvField(p.objectName),
						csvField(Number.isFinite(p.precisionStation) ? station(p.precisionStation).trim() : ""),
						csvNumber(p.precisionValue, 4),
						csvNumber(p.precisionEasting, 3),
						csvNumber(p.precisionNorthing, 3),
					].join(";"));
				}
				return lines.join("\r\n");
			}

			// The GWB handoff for the PI, same format as the Ausschussliste: one
			// row per Bogen in the selected range (all of them, not only those
			// with headroom -- "kein Potenzial" with its binding limit is a finding
			// too), and separately one row per Abschnitt, today and proposal.
			function gwbSpeedTracks(entry) {
				return entry ? sevenLineTracks(entry).bands.filter((track) => track.className.startsWith("diagram-speed")) : [];
			}
			function gwbGleisLabel(track) {
				return track.label.split(" · ")[0];
			}
			function buildGwbBogenCsv(entry) {
				const lines = [
					`GWB-Vorschlag je Bogen (Diagnose, kein Entwurf) - ${objectDisplayName(entry)}`,
					`Exportiert: ${new Date().toLocaleString("de-DE")}`,
					`Annahmen: Ril 800.0110 V3.0 (2021) Ermessensgrenze - uf <= ${fahrzeugText(true)} (Tab. 5, Fahrzeug ${fahrzeugKey()}), u ${CANT_MIN_MM}..${cantMaxMm()} mm (${cantLimitLabel()}), Rampe l_R >= ${RAMP_LENGTH_FACTOR.Klothoide}/${RAMP_LENGTH_FACTOR.Bloss} v du/1000 (Tab. 8), Neigung <= 1:${RAMP_GRADIENT_MIN_M} (Tab. 7), Uebergangsbogen l_U >= ${TRANSITION_LENGTH_FACTOR.Klothoide}/${TRANSITION_LENGTH_FACTOR.Bloss} v duf/1000 (Tab. 9), Bloss = Klothoide x sqrt(5/3) bei gleichem f-Mass (8 (2)); ${SPEED_STEP_KMH}er-Stufen abgerundet (457.0201), Deckel ${V_MAX_DE_KMH} km/h; ohne Uebergangsbogen Vergleichsradius >= Tab. 10 Ermessensgrenze (ueber 200 km/h der Wert fuer 200); Platz fuer die Bloss-Verlaengerung nach Tab. 3 geprueft (Spalte Bloss_Platz)`,
					"",
					["Gleis", "km_von", "km_bis", "Radius_m", "u_heute_mm", "v_heute_kmh", "Bestand_haltbar_kmh", "Bestand_Grenze", "u_Vorschlag_mm", "v_Vorschlag_kmh", "Variante", "Anfang_Uebergangsbogen", "Anfang_Laenge_heute_m", "Anfang_Laenge_Vorschlag_m", "Ende_Uebergangsbogen", "Ende_Laenge_heute_m", "Ende_Laenge_Vorschlag_m", "Grenze_danach", "Korbbogen_Hinweis", "Bloss_Platz", "Potenzial"].join(";"),
				];
				for (const track of gwbSpeedTracks(entry)) {
					for (const unit of track.proposal ?? []) {
						const proposal = unit.proposal;
						const sideCells = (side) => {
							const bloss = proposal && proposal.variant === "Bloss" && side.existing !== "Bloss";
							return [
								csvField(side.lU > 0 ? side.existing : side.kind === "Ende" ? "Ende" : `ohne (${side.kind})`),
								side.lU > 0 ? csvNumber(side.lU, 1) : "",
								side.lU > 0 ? csvNumber(bloss ? side.lU * BLOSS_LENGTH_FROM_KLOTHOIDE : side.lU, 1) : "",
							];
						};
						lines.push([
							csvField(gwbGleisLabel(track)),
							csvNumber(unit.from / 1000, 3),
							csvNumber(unit.to / 1000, 3),
							csvField(unit.radii.map((radius) => Math.round(radius)).join("/")),
							csvNumber(unit.uToday, 0),
							csvField(unit.memberSpeedsToday.join("/")),
							csvField(unit.todayCheck ? unit.todayCheck.memberSpeeds.join("/") : ""),
							csvField(unit.todayCheck && unit.todayCheck.v < unit.vToday ? unit.todayCheck.binding : ""),
							proposal ? csvNumber(proposal.u, 0) : "",
							csvField(proposal ? proposal.memberSpeeds.join("/") : ""),
							csvField(proposal ? proposal.variant : ""),
							...sideCells(unit.sides[0]),
							...sideCells(unit.sides[1]),
							csvField(proposal ? proposal.binding : ""),
							csvField(proposal ? korbbogenNote(unit, proposal.v, proposal.u).replace(/^ · /, "") : ""),
							csvField(proposal?.room ? proposal.room : unit.blossRejected ? `verworfen (${unit.blossRejected.v} km/h): ${unit.blossRejected.text}` : ""),
							proposal && proposal.v > unit.vToday ? "ja" : "nein",
						].join(";"));
					}
				}
				return lines.join("\r\n");
			}
			function buildGwbAbschnittCsv(entry) {
				const lines = [
					`Geschwindigkeitsabschnitte nach Ril 457.0201 (Diagnose, kein VzG) - ${objectDisplayName(entry)}`,
					`Exportiert: ${new Date().toLocaleString("de-DE")}`,
					`Annahmen: Streckengeschwindigkeit ${lineSpeedKmh()} km/h auf Geraden, Regelbremsweg ${regelbremswegM()} m, Fahrdynamik-Regel 5 (10) b mit Anhang 2 bis ${FAHRDYNAMIK_MAX_KMH} km/h, fallende Stufen kuerzer als der Bremsweg in die untere Stufe gefasst (5 (10) a, Bild 14); Bogenwerte aus dem GWB-Vorschlag (Ril 800.0110)`,
					"",
					["Gleis", "Fall", "km_von", "km_bis", "Laenge_m", "v_kmh", "Hinweis"].join(";"),
				];
				const km = (x) => (x / 1000).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
				for (const track of gwbSpeedTracks(entry)) {
					if (!track.sections) continue;
					for (const [label, result] of [["heute", track.sections.today], ["Vorschlag", track.sections.proposal]]) {
						if (!result) continue;
						for (const section of result.sections) {
							const trims = result.trims.filter((trim) => trim.from < section.to && trim.to > section.from);
							lines.push([
								csvField(gwbGleisLabel(track)),
								label,
								csvNumber(section.from / 1000, 3),
								csvNumber(section.to / 1000, 3),
								csvNumber(section.to - section.from, 0),
								csvNumber(section.v, 0),
								csvField(trims.map((trim) => `${trim.rule}: km ${km(trim.from)}-${km(trim.to)} ${trim.before} -> ${trim.after} km/h (${Math.round(trim.length)} m vorhanden, ${Math.round(trim.needed)} m noetig)`).join(" | ")),
							].join(";"));
						}
					}
				}
				return lines.join("\r\n");
			}
			function downloadCsv(fileName, csv) {
				const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = fileName;
				link.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			}
			function downloadRejectListCsv() {
				const csv = buildRejectListCsv();
				const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = `ausschussliste-${new Date().toISOString().slice(0, 10)}.csv`;
				link.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			}

			function renderRejectList() {
				const all = collectRejectList();
				const items = all.filter(isFeatureVisibleInViewport);
				rejectListCount.textContent = String(items.length);
				rejectListCount.dataset.empty = String(items.length === 0);
				rejectListPanel.replaceChildren();
				if (all.length) {
					const head = document.createElement("div");
					head.className = "reject-head";
					const label = document.createElement("span");
					label.textContent = `${all.length} gesamt`;
					const exportButton = document.createElement("button");
					exportButton.type = "button";
					exportButton.className = "reject-export";
					exportButton.textContent = "CSV exportieren";
					exportButton.title = "Vollständige Liste (alle Dateien, unabhängig vom Kartenausschnitt) als CSV für Excel";
					exportButton.addEventListener("click", downloadRejectListCsv);
					head.append(label, exportButton);
					rejectListPanel.append(head);
				}
				if (all.length && items.length !== all.length) {
					const scopeNote = document.createElement("div");
					scopeNote.className = "reject-scope-note";
					scopeNote.textContent = `${items.length} von ${all.length} im aktuellen Kartenausschnitt`;
					rejectListPanel.append(scopeNote);
				}
				if (!items.length) {
					const empty = document.createElement("div");
					empty.className = "reject-empty";
					empty.textContent = all.length
						? "Keine dieser Stellen liegt im aktuellen Kartenausschnitt — herauszoomen oder verschieben."
						: `Keine Segmente über ${formatPrecisionValue(PRECISION_REJECT_THRESHOLD)} gemeldet.`;
					rejectListPanel.append(empty);
					return;
				}
				for (const feature of items) {
					const props = feature.properties;
					const row = document.createElement("button");
					row.type = "button";
					row.className = "reject-row";
					const swatch = document.createElement("span");
					swatch.className = "reject-row-swatch";
					swatch.style.background = precisionSwatchColor(props.precisionValue);
					const stationEl = document.createElement("span");
					stationEl.className = "reject-row-station";
					stationEl.textContent = Number.isFinite(props.precisionStation) ? `km ${station(props.precisionStation).trim()}` : "Station unbekannt";
					const valueEl = document.createElement("span");
					valueEl.className = "reject-row-value";
					valueEl.textContent = formatPrecisionValue(props.precisionValue);
					row.append(swatch, stationEl, valueEl);
					row.addEventListener("click", () => {
						if (!maplibreMap) return;
						if (!precisionModeActive) togglePrecisionMode();
						const coordinate = feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)];
						maplibreMap.flyTo({ center: coordinate, zoom: 17 });
						focusPrecisionFeature(props, coordinate);
					});
					rejectListPanel.append(row);
				}
			}

			function pointQualityForEntry(entry) {
				const evidence = [];
				for (const element of entry?.item?.payload?.coordGeom?.elements ?? []) {
					if (element?.extras?.meanPointError) evidence.push(element.extras.meanPointError);
					if (element?.extras?.meanPointErrorEnd) evidence.push(element.extras.meanPointErrorEnd);
				}
				if (evidence.some((item) => item?.status === "limited" || Number(item?.value) > 1)) return "limited";
				if (evidence.some((item) => item?.status === "unknown")) return "unknown";
				return evidence.some((item) => item?.status === "reported") ? "reported" : "unreported";
			}

			function fitBasemap() {
				if (!maplibreMap || !globalThis.maplibregl) return;
				const collection = geographicFeatureCollection();
				const bounds = new globalThis.maplibregl.LngLatBounds();
				for (const feature of collection.features) {
					for (const coordinate of feature.geometry.coordinates) bounds.extend(coordinate);
				}
				if (!bounds.isEmpty()) maplibreMap.fitBounds(bounds, { padding: 48, maxZoom: 17, duration: 0 });
			}

			// ---- Kilometersteine ---------------------------------------------------
			// Along every Kilometerlinie a tick every 100 m and a stone with its
			// number every kilometre, on both maps. Read from the line's stationed
			// polyline; nothing beyond the interpolation between its samples.
			const kmStoneCache = new WeakMap();
			function kilometerStones(entry) {
				if (kmStoneCache.has(entry)) return kmStoneCache.get(entry);
				const polyline = referenceStationPolyline(entry, 5);
				const stones = [];
				if (polyline.length > 1) {
					const first = Math.ceil(polyline[0].station / 100) * 100;
					const last = polyline[polyline.length - 1].station;
					let index = 0;
					for (let station = first; station <= last + 1e-6; station += 100) {
						while (index + 2 < polyline.length && polyline[index + 1].station < station) index += 1;
						const a = polyline[index];
						const b = polyline[index + 1];
						if (!b || a.station === b.station) continue;
						const t = (station - a.station) / (b.station - a.station);
						if (t < -0.01 || t > 1.01) continue;
						stones.push({ station, major: Math.round(station) % 1000 === 0, label: String(Math.round(station / 1000)), easting: a.easting + t * (b.easting - a.easting), northing: a.northing + t * (b.northing - a.northing) });
					}
				}
				kmStoneCache.set(entry, stones);
				return stones;
			}
			function kilometerLineEntries() {
				return allViewerEntries().filter((entry) => entry.item.kind === "alignment" && sevenLineSide(entry) === "kilometer");
			}
			function kilometerStoneCollection() {
				const features = [];
				for (const entry of kilometerLineEntries()) {
					for (const stone of kilometerStones(entry)) {
						const geographic = geographicPoint(stone, entry);
						if (!geographic) continue;
						features.push({ type: "Feature", properties: { major: stone.major ? 1 : 0, label: stone.label, station: stone.station }, geometry: { type: "Point", coordinates: [geographic.longitude, geographic.latitude] } });
					}
				}
				return { type: "FeatureCollection", features };
			}
			// The raster style has no glyphs, so the numbers are DOM markers, shown
			// from zoom 12 on; the ticks and stones themselves are circle layers.
			let kmStoneMarkers = [];
			function renderKilometerStoneMarkers() {
				for (const marker of kmStoneMarkers) marker.remove();
				kmStoneMarkers = [];
				if (!maplibreMap || !globalThis.maplibregl) return;
				for (const feature of kilometerStoneCollection().features) {
					if (!feature.properties.major) continue;
					const element = document.createElement("div");
					element.className = "km-stone-label";
					element.textContent = feature.properties.label;
					kmStoneMarkers.push(new globalThis.maplibregl.Marker({ element, anchor: "top", offset: [0, 6] }).setLngLat(feature.geometry.coordinates).addTo(maplibreMap));
				}
				syncKilometerStoneVisibility();
			}
			function syncKilometerStoneVisibility() {
				if (!maplibreMap) return;
				maplibreMapElement.classList.toggle("km-labels-hidden", maplibreMap.getZoom() < 12 || !kilometerLinesVisible);
				for (const id of ["km-stones-minor", "km-stones-major"]) {
					if (maplibreMap.getLayer(id)) maplibreMap.setLayoutProperty(id, "visibility", kilometerLinesVisible ? "visible" : "none");
				}
			}

			function renderBasemap() {
				const source = maplibreMap?.getSource("technet");
				if (source) source.setData(geographicFeatureCollection());
				const stoneSource = maplibreMap?.getSource("km-stones");
				if (stoneSource) {
					stoneSource.setData(kilometerStoneCollection());
					renderKilometerStoneMarkers();
				}
				const precisionSource = maplibreMap?.getSource("technet-precision");
				if (precisionSource) precisionSource.setData(precisionFeatureCollection());
				renderRejectList();
			}

			function toggleKilometerLines() {
				kilometerLinesVisible = !kilometerLinesVisible;
				kmLineToggle.setAttribute("aria-pressed", String(kilometerLinesVisible));
				kmLineToggle.textContent = kilometerLinesVisible ? "km-Linien aus" : "km-Linien ein";
				viewer.classList.toggle("km-lines-hidden", !kilometerLinesVisible);
				applyMapFilters();
				syncKilometerStoneVisibility();
				renderDiagram();
			}
			function togglePrecisionMode() {
				if (!maplibreMap) return;
				precisionModeActive = !precisionModeActive;
				const confidenceLayers = ["technet-quality-halo", "technet-lines-halo", "technet-lines", "technet-kilometer-lines", "technet-lines-inferred", "technet-kilometer-lines-inferred"];
				const precisionLayers = ["technet-precision-lines", "technet-precision-unknown"];
				// Toggled while the style still loads (a slow tile host, a hidden tab),
				// setLayoutProperty throws "Style is not done loading"; the layers then
				// follow the state as soon as the style is there.
				const applyVisibility = () => {
					for (const id of confidenceLayers) if (maplibreMap.getLayer(id)) maplibreMap.setLayoutProperty(id, "visibility", precisionModeActive ? "none" : "visible");
					for (const id of precisionLayers) if (maplibreMap.getLayer(id)) maplibreMap.setLayoutProperty(id, "visibility", precisionModeActive ? "visible" : "none");
				};
				if (maplibreMap.isStyleLoaded()) applyVisibility();
				else maplibreMap.once("styledata", applyVisibility);
				precisionToggle.setAttribute("aria-pressed", String(precisionModeActive));
				precisionToggle.textContent = precisionModeActive ? "Präzision aus" : "Präzision ein";
				precisionKindSelect.classList.toggle("hidden", !precisionModeActive);
				mapLegend.classList.toggle("hidden", precisionModeActive);
				precisionLegend.classList.toggle("hidden", !precisionModeActive);
				if (!precisionModeActive) { precisionPopup?.remove(); precisionPopup = null; }
			}

			function knownValuesForDimension(dimension) {
				const values = new Set();
				for (const entry of allViewerEntries()) {
					if (entry.item.kind !== "alignment") continue;
					const value = dimension.valueForEntry(entry);
					if (value) values.add(value);
				}
				return [...values].sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
			}

			function dimensionLabelFor(dimension, value) {
				return dimension.dynamic ? dimension.formatLabel(value) : dimension.options.find((option) => option.value === value)?.label ?? value;
			}

			// Newly-appearing values in a dynamic dimension default to shown (added to both
			// sets together); a value the user has explicitly unchecked stays unchecked across
			// a reload/re-sync as long as it remains known. If a value drops out of the data
			// entirely it's also forgotten from mapFilterSeenValues, so it defaults to shown
			// again if it later reappears -- there's no way to distinguish "user unchecked it"
			// from "it transiently vanished" once it's gone, and defaulting to visible avoids
			// silently hiding data the user never chose to hide.
			// Returns the known-values list per dynamic dimension so callers (renderMapFilterPanel)
			// don't have to recompute it.
			function syncMapFilterState() {
				const knownByDimension = new Map();
				for (const dimension of MAP_FILTER_DIMENSIONS) {
					if (!dimension.dynamic) continue;
					const known = knownValuesForDimension(dimension);
					knownByDimension.set(dimension.key, known);
					const knownSet = new Set(known);
					const selected = mapFilterState.get(dimension.key);
					const seen = mapFilterSeenValues.get(dimension.key);
					for (const value of [...selected]) if (!knownSet.has(value)) selected.delete(value);
					for (const value of [...seen]) if (!knownSet.has(value)) seen.delete(value);
					for (const value of known) {
						if (seen.has(value)) continue;
						seen.add(value);
						selected.add(value);
					}
				}
				return knownByDimension;
			}

			function renderMapFilterPanel() {
				const knownByDimension = syncMapFilterState();
				mapFilterPanel.replaceChildren();
				for (const dimension of MAP_FILTER_DIMENSIONS) {
					const values = dimension.dynamic ? knownByDimension.get(dimension.key) : dimension.options.map((option) => option.value);
					const selected = mapFilterState.get(dimension.key);
					const fieldset = document.createElement("fieldset");
					const legend = document.createElement("legend");
					const legendLabel = document.createElement("span");
					legendLabel.textContent = dimension.label;
					const allButton = document.createElement("button");
					allButton.type = "button";
					allButton.textContent = "Alle";
					allButton.addEventListener("click", () => {
						for (const value of values) selected.add(value);
						renderMapFilterPanel();
						applyMapFilters();
					});
					const noneButton = document.createElement("button");
					noneButton.type = "button";
					noneButton.textContent = "Keine";
					noneButton.addEventListener("click", () => {
						selected.clear();
						renderMapFilterPanel();
						applyMapFilters();
					});
					legend.append(legendLabel, allButton, noneButton);
					fieldset.append(legend);
					const optionsContainer = document.createElement("div");
					optionsContainer.className = "map-filter-options";
					for (const value of values) {
						const label = document.createElement("label");
						const checkbox = document.createElement("input");
						checkbox.type = "checkbox";
						checkbox.checked = selected.has(value);
						checkbox.addEventListener("change", () => {
							if (checkbox.checked) selected.add(value);
							else selected.delete(value);
							applyMapFilters();
						});
						const span = document.createElement("span");
						span.textContent = dimensionLabelFor(dimension, value);
						label.append(checkbox, span);
						optionsContainer.append(label);
					}
					fieldset.append(optionsContainer);
					mapFilterPanel.append(fieldset);
				}
			}

			function dimensionCondition(dimension) {
				const selected = [...(mapFilterState.get(dimension.key) ?? new Set())];
				const always = dimension.alwaysInclude ?? [];
				return ["in", ["get", dimension.property], ["literal", [...new Set([...selected, ...always])]]];
			}

			function applyMapFilters() {
				if (!maplibreMap || !maplibreMap.getLayer("technet-lines")) return;
				const geometryDimensions = MAP_FILTER_DIMENSIONS.filter((dimension) => !dimension.layerVisibility);
				const commonCond = ["all", ...geometryDimensions.map(dimensionCondition)];
				maplibreMap.setFilter("technet-lines", ["all", ["==", ["get", "confidence"], "confirmed"], ["==", ["get", "kilometerLine"], 0], commonCond]);
				maplibreMap.setFilter("technet-lines-inferred", ["all", ["==", ["get", "confidence"], "inferred"], ["==", ["get", "kilometerLine"], 0], commonCond]);
				// kilometerLine is 0/1; comparing against 2 matches nothing, so the km
				// layers go dark and the precision layers drop their km features.
				const kmWanted = kilometerLinesVisible ? 1 : 2;
				maplibreMap.setFilter("technet-kilometer-lines", ["all", ["==", ["get", "confidence"], "confirmed"], ["==", ["get", "kilometerLine"], kmWanted], commonCond]);
				maplibreMap.setFilter("technet-kilometer-lines-inferred", ["all", ["==", ["get", "confidence"], "inferred"], ["==", ["get", "kilometerLine"], kmWanted], commonCond]);
				const kmAllowed = ["!=", ["get", "kilometerLine"], kilometerLinesVisible ? 2 : 1];
				if (maplibreMap.getLayer("technet-precision-lines")) maplibreMap.setFilter("technet-precision-lines", ["all", ["!=", ["get", "precisionValue"], null], kmAllowed]);
				if (maplibreMap.getLayer("technet-precision-unknown")) maplibreMap.setFilter("technet-precision-unknown", ["all", ["==", ["get", "precisionValue"], null], kmAllowed]);
				for (const dimension of MAP_FILTER_DIMENSIONS) {
					if (!dimension.layerVisibility) continue;
					const selected = mapFilterState.get(dimension.key) ?? new Set();
					for (const [value, layerIds] of Object.entries(dimension.layerVisibility)) {
						const visible = selected.has(value);
						for (const layerId of layerIds) maplibreMap.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
					}
				}
				const layerVisibilityDimensions = MAP_FILTER_DIMENSIONS.filter((dimension) => dimension.layerVisibility);
				const visibilityCond = ["all", ...layerVisibilityDimensions.map(dimensionCondition)];
				maplibreMap.setFilter("technet-lines-halo", ["all", visibilityCond, commonCond]);
				maplibreMap.setFilter("technet-quality-halo", ["all", ["in", ["get", "pointQuality"], ["literal", ["limited", "unknown"]]], visibilityCond, commonCond]);
			}

			function deactivateRailwayMap() {
				railwayMapActive = false;
				maplibreMapElement.classList.add("hidden"); applyMapRotation();
				multi2d.classList.remove("hidden");
				railwayOpacityControl.classList.add("hidden");
				mapLegend.classList.add("hidden");
				precisionToggle.classList.add("hidden");
				precisionLegend.classList.add("hidden");
				rejectListToggle.classList.add("hidden");
				rejectListPanel.classList.add("hidden");
				rejectListToggle.setAttribute("aria-pressed", "false");
				if (precisionModeActive) togglePrecisionMode();
				baseMapLoad.setAttribute("aria-pressed", "false");
				baseMapLoad.textContent = `${railwayMapName()} ein`;
				renderMap(activeMapMode);
			}

			function hasKnownCrsAlignment() {
				return allViewerEntries().some((entry) => {
					if (entry.item.kind !== "alignment") return false;
					const classification = classifyLsys(effectiveLsys(entry));
					return !["missing", "unknown", "local"].includes(classification.kind);
				});
			}

			// ---- Kachelquellen: hier trägt die Firma ihren Kachelserver ein --------
			// One place, meant to be edited before the file is handed around: URL
			// templates with {z}/{x}/{y}. "railway" empty runs without the
			// OpenRailwayMap overlay (an internal tile server usually has none);
			// the attribution is shown on the map and belongs to whoever made
			// the tiles (ODbL asks for it on anything derived from OpenStreetMap).
			// A per-browser override, set from the consent card or "Kachelquelle"
			// in the Ebenen menu, lives in localStorage and wins over this block.
			const TILE_SOURCES_DEFAULT = {
				// tile.openstreetmap.org answers a page opened from disk (file://,
				// no Referer) with the same 6,7-kB "access denied" tile for every
				// request (measured 2026-11-08: identical bytes for neighbouring
				// tiles, real tiles only from http://localhost). A handed-out copy is
				// opened from disk, so the base map comes from the FOSSGIS mirror,
				// same OpenStreetMap data, which serves file:// pages.
				base: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
				railway: "https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
				attribution: "© OpenStreetMap-Mitwirkende · © OpenRailwayMap",
			};
			const TILE_SOURCES_KEY = "technetViewer.tileSources";
			let tileSourcesOverride = (() => { try { const raw = localStorage.getItem(TILE_SOURCES_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } })();
			function tileSources() { return tileSourcesOverride ? { ...TILE_SOURCES_DEFAULT, ...tileSourcesOverride } : TILE_SOURCES_DEFAULT; }
			function tileHostOf(template) { try { return new URL(template).host; } catch { return template; } }
			function railwayMapName() { return tileSourcesOverride ? "Kartenebene" : "OpenRailwayMap"; }
			function buildTileStyle() {
				const sources = tileSources();
				const style = {
					version: 8,
					sources: { osm: { type: "raster", tiles: [sources.base], tileSize: 256, attribution: sources.attribution ?? "" } },
					layers: [{ id: "osm", type: "raster", source: "osm" }],
				};
				if (sources.railway) {
					style.sources.railway = { type: "raster", tiles: [sources.railway], tileSize: 256 };
					style.layers.push({ id: "openrailwaymap", type: "raster", source: "railway", paint: { "raster-opacity": 1 } });
				}
				return style;
			}
			function renderTileConsentText() {
				const sources = tileSources();
				const hosts = [tileHostOf(sources.base), sources.railway ? tileHostOf(sources.railway) : null].filter(Boolean);
				const codes = hosts.map((host) => { const code = document.createElement("code"); code.textContent = host; return code; });
				tileConsentText.replaceChildren("Die Kartenebene holt Kacheln von ", codes[0], ...(codes[1] ? [" und ", codes[1]] : []), `. Die Kachelkoordinaten nennen ${codes[1] ? "diesen Servern" : "diesem Server"} den Ausschnitt, also die Lage des Projekts. Alles andere bleibt im Browser.`);
				tileBaseInput.value = sources.base;
				tileRailwayInput.value = sources.railway ?? "";
				tileAttributionInput.value = sources.attribution ?? "";
				baseMapLoad.textContent = `${railwayMapName()} ${railwayMapActive ? "aus" : "ein"}`;
			}
			// The map is built on its sources, so a change rebuilds it on the one
			// init path (toggleRailwayMap) instead of patching sources in place.
			async function applyTileSources(override) {
				tileSourcesOverride = override;
				try {
					if (override) localStorage.setItem(TILE_SOURCES_KEY, JSON.stringify(override));
					else localStorage.removeItem(TILE_SOURCES_KEY);
				} catch { /* no storage: this session only */ }
				renderTileConsentText();
				if (!maplibreMap) return;
				const wasActive = railwayMapActive;
				if (wasActive) deactivateRailwayMap();
				maplibreMap.remove();
				maplibreMap = null;
				if (wasActive) await toggleRailwayMap({ automatic: true });
			}
			function readTileSourceEditor() {
				const base = tileBaseInput.value.trim();
				if (!/\{z\}/.test(base) || !/\{x\}/.test(base) || !/\{y\}/.test(base)) {
					status.classList.add("error");
					status.textContent = "Die Kachel-URL braucht {z}, {x} und {y}.";
					return null;
				}
				status.classList.remove("error");
				const override = { base, railway: tileRailwayInput.value.trim(), attribution: tileAttributionInput.value.trim() };
				const isDefault = override.base === TILE_SOURCES_DEFAULT.base && override.railway === TILE_SOURCES_DEFAULT.railway && override.attribution === TILE_SOURCES_DEFAULT.attribution;
				return isDefault ? null : override;
			}
			// ---- Kartenkacheln: nur mit Einwilligung ------------------------------
			// The one thing that leaves the browser: tile requests to OpenStreetMap
			// and OpenRailwayMap carry z/x/y, i.e. the viewport, i.e. where the
			// project lies. So no tile loads without a yes -- once for this
			// session, or remembered in this browser (localStorage). "Ohne Karte
			// weiter" keeps the SVG Lageansicht, which asks nothing of anyone. The
			// automatic switch-on after an import asks the same question; the card
			// waits in the map pane until it is answered.
			const TILE_CONSENT_KEY = "technetViewer.tiles";
			let tileConsent = (() => { try { return localStorage.getItem(TILE_CONSENT_KEY) === "allowed" ? "allowed" : null; } catch { return null; } })();
			let tileConsentPending = null;
			let tileConsentResolve = null;
			function askTileConsent() {
				if (tileConsent === "allowed") return Promise.resolve(true);
				if (tileConsentPending) return tileConsentPending;
				tileConsentCard.classList.remove("hidden");
				tileConsentPending = new Promise((resolve) => { tileConsentResolve = resolve; });
				return tileConsentPending;
			}
			function answerTileConsent(answer) {
				tileConsentCard.classList.add("hidden");
				if (answer === "always") {
					tileConsent = "allowed";
					try { localStorage.setItem(TILE_CONSENT_KEY, "allowed"); } catch { /* no storage */ }
					tileConsentForget.classList.remove("hidden");
				} else if (answer === "once") {
					tileConsent = "allowed";
				} else {
					railwayMapPreference = "off";
				}
				const resolve = tileConsentResolve;
				tileConsentPending = null;
				tileConsentResolve = null;
				resolve?.(answer !== "no");
			}
			function forgetTileConsent() {
				tileConsent = null;
				try { localStorage.removeItem(TILE_CONSENT_KEY); } catch { /* no storage */ }
				tileConsentForget.classList.add("hidden");
				status.textContent = "Kachel-Erlaubnis vergessen; die Karte fragt beim nächsten Mal wieder.";
			}
			if (tileConsent === "allowed") tileConsentForget.classList.remove("hidden");
			async function toggleRailwayMap({ automatic = false } = {}) {
				if (railwayMapActive) {
					if (!automatic) railwayMapPreference = "off";
					deactivateRailwayMap();
					return;
				}
				if (!(await askTileConsent())) return;
				if (railwayMapActive) return;
				if (!automatic) railwayMapPreference = "on";
				baseMapLoad.disabled = true;
				baseMapLoad.textContent = `${railwayMapName()} wird geladen …`;
				try {
					if (!maplibreMap) {
						maplibreMap = new globalThis.maplibregl.Map({
							container: maplibreMapElement,
							style: buildTileStyle(),
							center: [10.5, 51],
							zoom: 5,
						});
						maplibreMap.addControl(new globalThis.maplibregl.NavigationControl(), "top-right");
						maplibreMap.on("rotate", applyMapRotation);
						await new Promise((resolve) => maplibreMap.once("load", resolve));
						maplibreMap.addSource("underlay-dimmer", {
							type: "geojson",
							data: {
								type: "Feature",
								properties: {},
								geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] },
							},
						});
						maplibreMap.addLayer({
							id: "underlay-dimmer",
							type: "fill",
							source: "underlay-dimmer",
							paint: {
								"fill-color": "#f7f8fa",
								"fill-opacity": (1 - railwayLayerOpacity) * 0.82,
							},
						});
						maplibreMap.addSource("technet", { type: "geojson", data: geographicFeatureCollection() });
						maplibreMap.addLayer({
							id: "technet-quality-halo",
							type: "line",
							source: "technet",
							filter: ["in", ["get", "pointQuality"], ["literal", ["limited", "unknown"]]],
							paint: {
								"line-color": ["case", ["==", ["get", "pointQuality"], "limited"], "#ff453a", "#8e8e93"],
								"line-width": ["case", ["==", ["get", "active"], 1], 5, 3],
								"line-opacity": 0.55,
								"line-blur": 0.6,
							},
						});
						maplibreMap.addLayer({
							id: "technet-lines-halo",
							type: "line",
							source: "technet",
							paint: {
								"line-color": "rgba(12,18,24,0.82)",
								"line-width": ["case", ["==", ["get", "active"], 1], 6, 4],
								"line-opacity": ["case", ["==", ["get", "confidence"], "inferred"], 0.48, 0.82],
							},
						});
						maplibreMap.addLayer({
							id: "technet-lines",
							type: "line",
							source: "technet",
							filter: ["all", ["==", ["get", "confidence"], "confirmed"], ["==", ["get", "kilometerLine"], 0]],
							paint: {
								"line-color": ["case", ["==", ["get", "active"], 1], "#ff2d55", "#00a651"],
								"line-width": ["case", ["==", ["get", "active"], 1], 4.5, 2.4],
								"line-opacity": 0.95,
							},
						});
						maplibreMap.addLayer({
							id: "technet-kilometer-lines",
							type: "line",
							source: "technet",
							filter: ["all", ["==", ["get", "confidence"], "confirmed"], ["==", ["get", "kilometerLine"], 1]],
							paint: {
								"line-color": ["case", ["==", ["get", "active"], 1], "#ff2d55", "#00a651"],
								"line-width": ["case", ["==", ["get", "active"], 1], 4.5, 2.4],
								"line-opacity": 0.95,
								"line-dasharray": [4, 2.5],
							},
						});
						maplibreMap.addLayer({
							id: "technet-lines-inferred",
							type: "line",
							source: "technet",
							filter: ["all", ["==", ["get", "confidence"], "inferred"], ["==", ["get", "kilometerLine"], 0]],
							paint: {
								"line-color": ["case", ["==", ["get", "active"], 1], "#ff2d55", "#e6007e"],
								"line-width": ["case", ["==", ["get", "active"], 1], 4.2, 2.2],
								"line-opacity": ["case", ["==", ["get", "active"], 1], 0.9, 0.72],
								"line-dasharray": [2, 3],
							},
						});
						maplibreMap.addLayer({
							id: "technet-kilometer-lines-inferred",
							type: "line",
							source: "technet",
							filter: ["all", ["==", ["get", "confidence"], "inferred"], ["==", ["get", "kilometerLine"], 1]],
							paint: {
								"line-color": ["case", ["==", ["get", "active"], 1], "#ff2d55", "#e6007e"],
								"line-width": ["case", ["==", ["get", "active"], 1], 4.2, 2.2],
								"line-opacity": ["case", ["==", ["get", "active"], 1], 0.9, 0.72],
								"line-dasharray": [5, 2.5],
							},
						});
						maplibreMap.addSource("technet-precision", { type: "geojson", data: precisionFeatureCollection() });
						maplibreMap.addLayer({
							id: "technet-precision-lines",
							type: "line",
							source: "technet-precision",
							layout: { visibility: "none" },
							filter: ["!=", ["get", "precisionValue"], null],
							paint: {
								// The same classes as the SVG and the legend: a step per Ril
								// class, no blend between them.
								"line-color": precisionStepExpression(),
								"line-width": ["case", ["==", ["get", "active"], 1], 5, 3],
								"line-opacity": 0.95,
							},
						});
						maplibreMap.addLayer({
							id: "technet-precision-unknown",
							type: "line",
							source: "technet-precision",
							layout: { visibility: "none" },
							filter: ["==", ["get", "precisionValue"], null],
							paint: {
								"line-color": PRECISION_UNKNOWN_COLOR,
								"line-width": ["case", ["==", ["get", "active"], 1], 5, 3],
								"line-opacity": 0.7,
								"line-dasharray": [2, 2],
							},
						});
						maplibreMap.addSource("km-stones", { type: "geojson", data: kilometerStoneCollection() });
						maplibreMap.addLayer({ id: "km-stones-minor", type: "circle", source: "km-stones", minzoom: 13, filter: ["==", ["get", "major"], 0], paint: { "circle-radius": 2, "circle-color": "#1d5c8a", "circle-opacity": 0.75 } });
						maplibreMap.addLayer({ id: "km-stones-major", type: "circle", source: "km-stones", minzoom: 10, filter: ["==", ["get", "major"], 1], paint: { "circle-radius": 4, "circle-color": "#ffffff", "circle-stroke-color": "#1d5c8a", "circle-stroke-width": 2 } });
						maplibreMap.on("zoomend", syncKilometerStoneVisibility);
						renderKilometerStoneMarkers();
						maplibreMap.addSource("cursor", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
						maplibreMap.addLayer({
							id: "cursor-point",
							type: "circle",
							source: "cursor",
							paint: { "circle-radius": 6, "circle-color": "#d0433f", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 },
						});
						maplibreMap.on("mousemove", (event) => scheduleCursor(() => {
							const radius = 6378137;
							const x = radius * event.lngLat.lng * Math.PI / 180;
							const y = -radius * Math.log(Math.tan(Math.PI / 4 + event.lngLat.lat * Math.PI / 360));
							const unitsPerPixel = 40075016.686 / (256 * 2 ** maplibreMap.getZoom());
							cursorFromMap(x, y, 25 * unitsPerPixel, "crs");
						}));
						const selectMapFeature = (event) => {
							const entry = geoEntryById.get(String(event.features?.[0]?.properties?.id));
							if (entry) selectObject(entry, entry.button);
						};
						maplibreMap.on("click", "technet-lines", selectMapFeature);
						maplibreMap.on("click", "technet-kilometer-lines", selectMapFeature);
						maplibreMap.on("click", "technet-lines-inferred", selectMapFeature);
						maplibreMap.on("click", "technet-kilometer-lines-inferred", selectMapFeature);
						const showPrecisionPopup = (event) => {
							const feature = event.features?.[0];
							if (!feature) return;
							focusPrecisionFeature(feature.properties, event.lngLat);
						};
						const precisionHoverLayers = ["technet-precision-lines", "technet-precision-unknown"];
						for (const layerId of precisionHoverLayers) {
							maplibreMap.on("click", layerId, showPrecisionPopup);
							maplibreMap.on("mouseenter", layerId, () => { maplibreMap.getCanvas().style.cursor = "pointer"; });
							maplibreMap.on("mouseleave", layerId, () => { maplibreMap.getCanvas().style.cursor = ""; });
						}
						maplibreMap.on("moveend", () => renderRejectList());
					}
					railwayMapActive = true;
					multi2d.classList.add("hidden");
					maplibreMapElement.classList.remove("hidden"); applyMapRotation();
					railwayOpacityControl.classList.remove("hidden");
					mapLegend.classList.remove("hidden");
					precisionToggle.classList.remove("hidden");
					rejectListToggle.classList.remove("hidden");
					mapEmpty.classList.add("hidden");
					maplibreMap.resize();
					renderBasemap();
					applyMapFilters();
					fitBasemap();
					baseMapLoad.disabled = false;
					baseMapLoad.setAttribute("aria-pressed", "true");
					baseMapLoad.textContent = `${railwayMapName()} aus`;
				} catch (error) {
					baseMapLoad.disabled = false;
					baseMapLoad.setAttribute("aria-pressed", "false");
					baseMapLoad.textContent = `${railwayMapName()} ein`;
					railwayOpacityControl.classList.add("hidden");
					mapLegend.classList.add("hidden");
					precisionToggle.classList.add("hidden");
					rejectListToggle.classList.add("hidden");
					crsNote.textContent = error.message;
				}
			}

			async function applyDefaultRailwayMap() {
				if (railwayMapActive || railwayMapPreference === "off" || !hasKnownCrsAlignment()) return;
				await toggleRailwayMap({ automatic: true });
			}

			function geographicGrid(viewBox) {
				const radius = 6378137;
				const west = viewBox.x / radius * 180 / Math.PI;
				const east = (viewBox.x + viewBox.width) / radius * 180 / Math.PI;
				const north = (2 * Math.atan(Math.exp(-viewBox.y / radius)) - Math.PI / 2) * 180 / Math.PI;
				const south = (2 * Math.atan(Math.exp(-(viewBox.y + viewBox.height) / radius)) - Math.PI / 2) * 180 / Math.PI;
				const span = Math.max(east - west, north - south);
				const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
				const step = steps.find((candidate) => candidate >= span / 8) ?? 10;
				const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
				group.setAttribute("class", "geo-grid");
				for (let longitude = Math.ceil(west / step) * step; longitude <= east; longitude += step) {
					const x = radius * longitude * Math.PI / 180;
					const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
					line.setAttribute("x1", x);
					line.setAttribute("x2", x);
					line.setAttribute("y1", viewBox.y);
					line.setAttribute("y2", viewBox.y + viewBox.height);
					group.append(line);
				}
				for (let latitude = Math.ceil(south / step) * step; latitude <= north; latitude += step) {
					const radians = latitude * Math.PI / 180;
					const y = -radius * Math.log(Math.tan(Math.PI / 4 + radians / 2));
					const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
					line.setAttribute("x1", viewBox.x);
					line.setAttribute("x2", viewBox.x + viewBox.width);
					line.setAttribute("y1", y);
					line.setAttribute("y2", y);
					group.append(line);
				}
				return group;
			}

			function renderMap(mode = "map") {
				const started = performance.now();
				activeMapMode = mode;
				mapTitle.textContent = mode === "crs"
					? "GIS · DB_REF in ETRS89"
					: "Multi‑2D · alle geladenen Trassen";
				const alignmentEntries = loadedFiles.flatMap((loaded) =>
					loaded.objects.filter((entry) => entry.item.kind === "alignment")
				);
				const classifications = alignmentEntries.map((entry) => classifyLsys(effectiveLsys(entry)));
				const compatibleObjects = classifications.filter((item) => item.geographic).length;
				const inferredObjects = alignmentEntries.filter((entry) => {
					if (classifyLsys(effectiveLsys(entry)).geographic) return false;
					const first = entry.item?.payload?.coordGeom?.elements?.[0]?.start;
					return isPlausibleGkCoordinate(first?.easting, first?.northing);
				}).length;
				const otherGkObjects = classifications.filter((item) => item.kind === "other-gk").length;
				const soldnerObjects = classifications.filter((item) => item.kind === "soldner").length;
				const localObjects = alignmentEntries.length - compatibleObjects - otherGkObjects - soldnerObjects;
				const limitedQualityObjects = alignmentEntries.filter((entry) => pointQualityForEntry(entry) === "limited").length;
				const unknownQualityObjects = alignmentEntries.filter((entry) => ["unknown", "unreported"].includes(pointQualityForEntry(entry))).length;
				crsNote.textContent = mode === "crs"
					? `${compatibleObjects}/${alignmentEntries.length} DB_REF · ${inferredObjects} GK vermutet · ${limitedQualityObjects} nur GIS · ${unknownQualityObjects} Qualität offen`
					: "";
				crsNote.title = crsNote.textContent;
				gisAssign.classList.toggle("hidden", mode !== "crs" || compatibleObjects === alignmentEntries.length);
				mapEmpty.classList.add("hidden");
				multi2d.replaceChildren();
				mapWorld = document.createElementNS("http://www.w3.org/2000/svg", "g");
				mapWorld.setAttribute("class", "map-world");
				multi2d.append(mapWorld);
				const allPoints = [];
				loadedFiles.forEach((loaded, fileIndex) => {
					loaded.objects.forEach((entry) => {
						if (entry.item.kind !== "alignment" || isEntryHidden(entry)) return;
						const geometry = mapPathForEntry(entry, mode);
						if (!geometry.path) return;
						for (const point of geometry.points) allPoints.push(point);
						const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
						path.setAttribute("d", geometry.path);
						const pointQuality = pointQualityForEntry(entry);
						path.setAttribute("class", `map-object file-${fileIndex % 6}${sevenLineSide(entry) === "kilometer" ? " kilometer-line" : ""}${geometry.inferred ? " inferred-crs" : ""}${pointQuality === "limited" ? " quality-limited" : pointQuality === "unknown" ? " quality-unknown" : ""}${entry === selectedEntry ? " active" : ""}`);
						path.setAttribute("aria-label", `${objectDisplayName(entry)}${geometry.inferred ? " · GK-Lage vermutet" : ""}${pointQuality === "limited" ? " · mittlerer Punktfehler über 1 Meter, nur GIS" : ["unknown", "unreported"].includes(pointQuality) ? " · Punktqualität offen" : ""}`);
						path.addEventListener("click", () => selectObject(entry, entry.button));
						mapWorld.append(path);
						entry.mapPath = path;
					});
				});
				const stoneLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
				stoneLayer.setAttribute("class", "km-stones");
				for (const entry of kilometerLineEntries()) {
					for (const stone of kilometerStones(entry)) {
						const mapped = mapPoint(stone, entry, mode);
						if (!mapped) continue;
						if (!stone.major) {
							const tick = document.createElementNS("http://www.w3.org/2000/svg", "circle");
							tick.setAttribute("cx", mapped.x);
							tick.setAttribute("cy", mapped.y);
							tick.setAttribute("r", 1.5);
							tick.setAttribute("class", "km-stone-minor");
							stoneLayer.append(tick);
							continue;
						}
						const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
						group.setAttribute("class", "km-stone-major");
						group.dataset.x = mapped.x;
						group.dataset.y = mapped.y;
						const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
						dot.setAttribute("r", 4);
						const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
						label.setAttribute("y", 15);
						label.setAttribute("text-anchor", "middle");
						label.textContent = stone.label;
						group.append(dot, label);
						stoneLayer.append(group);
					}
				}
				mapWorld.append(stoneLayer);
				if (!allPoints.length) {
					fullMapViewBox = null;
					currentMapViewBox = null;
					if (mode === "crs") {
						const systems = [...new Map(loadedFiles.flatMap((loaded) =>
							loaded.objects.map((entry) => {
								const classification = classifyLsys(effectiveLsys(entry));
								return [classification.code || "ohne LSYS", `${classification.code || "ohne LSYS"}: ${classification.label}`];
							})
						)).values()];
						mapEmpty.textContent = `Keine geografisch transformierbare DB_REF-Trasse. ${systems.join(" · ")}.`;
						mapEmpty.classList.remove("hidden");
					}
					return;
				}
				const minX = allPoints.reduce((m, point) => Math.min(m, point.x), Infinity);
				const maxX = allPoints.reduce((m, point) => Math.max(m, point.x), -Infinity);
				const minY = allPoints.reduce((m, point) => Math.min(m, point.y), Infinity);
				const maxY = allPoints.reduce((m, point) => Math.max(m, point.y), -Infinity);
				const spanX = Math.max(maxX - minX, 1);
				const spanY = Math.max(maxY - minY, 1);
				const padding = Math.max(spanX, spanY) * 0.05;
				fullMapViewBox = {
					x: minX - padding,
					y: minY - padding,
					width: spanX + padding * 2,
					height: spanY + padding * 2,
				};
				// The grid reaches beyond the box of the data, so that a turned view
				// does not show its corners.
				if (mode === "crs") mapWorld.prepend(geographicGrid(mapRotation ? { x: fullMapViewBox.x - fullMapViewBox.width / 2, y: fullMapViewBox.y - fullMapViewBox.height / 2, width: fullMapViewBox.width * 2, height: fullMapViewBox.height * 2 } : fullMapViewBox));
				applyMapRotation();
				fitMap();
				recordPerformance("render-map", started, { mode, objects: alignmentEntries.length, points: allPoints.length });
			}

			// The first load opens the Lieferung: the whole delivery as one picture
			// before any single object. Later loads keep whatever view is open.
			let firstLoadShown = false;
			function startViewMode() {
				// The map is the stage: after the first load the data lie on it; the
				// other pictures are slides over it.
				if (!firstLoadShown) {
					firstLoadShown = true;
					return "crs";
				}
				return viewModeButtons.find((button) => button.getAttribute("aria-pressed") === "true")?.dataset.mode ?? "listing";
			}

			// The three Pläne are slides of their own; the diagram slide shows one.
			const DIAGRAM_KINDS = { ivmg: "IVMG · Trassenplan", ivhw: "IVHW · Weichenhöhenplan", gwb: "GWB · Geschwindigkeitswegeband", fzk: "FZK · Fahrzeitkurve" };
			let diagramKind = "ivmg";
			function setViewMode(mode) {
				const hasObjects = loadedFiles.length > 0;
				if (mode in DIAGRAM_KINDS) diagramKind = mode;
				const slide = mode in DIAGRAM_KINDS ? "diagram" : mode;
				workspace.className = `mode-${mode}`;
				viewer.classList.remove("hidden");
				mapPanel.classList.remove("hidden");
				dataPanel.classList.toggle("hidden", slide !== "listing");
				reopenText.classList.toggle("hidden", slide === "listing" || !hasObjects);
				linksPanel.classList.toggle("hidden", slide !== "links");
				if (slide === "links" && hasObjects) renderLinks();
				deliveryPanel.classList.toggle("hidden", slide !== "delivery");
				if (slide === "delivery" && hasObjects) renderDelivery();
				spurplanPanel.classList.toggle("hidden", slide !== "spurplan");
				if (slide === "spurplan" && hasObjects) renderSpurplanView();
				diagramPanel.classList.toggle("hidden", slide !== "diagram" || !hasObjects);
				slideScrim.classList.toggle("hidden", mode === "crs" || (slide === "diagram" && !hasObjects));
				toggleText.setAttribute("aria-pressed", String(slide === "listing"));
				for (const button of viewModeButtons) {
					button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
				}
				if (mode === "crs") {
					if (hasObjects) renderMap("crs");
					if (maplibreMap && railwayMapActive) {
						multi2d.classList.add("hidden");
						maplibreMapElement.classList.remove("hidden"); applyMapRotation();
						maplibreMap.resize();
						renderBasemap();
					} else if (hasObjects) {
						maplibreMapElement.classList.add("hidden"); applyMapRotation();
						multi2d.classList.remove("hidden");
					}
					if (pendingMapFocus && hasObjects) {
						const focus = pendingMapFocus;
						pendingMapFocus = null;
						requestAnimationFrame(() => centerMapOnEntry(focus));
					}
				}
				renderDiagram();
			}

			function updateOutbox(entry = selectedEntry) {
				return renderSevenLineOutbox(entry);
				outboxContent.replaceChildren();
				if (!entry) {
					const empty = document.createElement("span");
					empty.textContent = "Noch nichts ausgewählt.";
					outboxContent.append(empty);
					return;
				}
				const name = document.createElement("strong");
				name.textContent = objectListName(entry);
				const kind = document.createElement("span");
				kind.textContent = `${familyForEntry(entry)} · ${effectiveLsys(entry) || "LSYS fehlt"}`;
				const source = document.createElement("span");
				source.textContent = `Quelle: ${entry.loaded.fileName}`;
				outboxContent.append(name, kind, source);
				const related = relatedPlanningFiles(entry);
				if (related.length) {
					const foundations = document.createElement("div");
					foundations.className = "related-foundations";
					const heading = document.createElement("strong");
					heading.textContent = `${related.length} ${related.length === 1 ? "Grundlage passt" : "Grundlagen passen"}`;
					foundations.append(heading);
					for (const record of related.slice().sort((a, b) => (a.kmFrom ?? Infinity) - (b.kmFrom ?? Infinity))) {
						const open = document.createElement("button");
						open.type = "button";
						open.textContent = `${record.name}${record.kmFrom == null ? "" : ` · km ${record.kmFrom.toLocaleString("de-DE")}`}`;
						open.addEventListener("click", () => selectPlanningFile(record, record.button));
						foundations.append(open);
					}
					outboxContent.append(foundations);
				}
			}

			// The delivered payload as it is. Where the entry is shown in km that
			// are not in its points (an Abbildung onto a Kilometerlinie), a first
			// line says so and names the range; the points below are the file's.
			function payloadListing(entry) {
				const json = JSON.stringify(entry.item.payload, null, 2);
				if (!kmAbbildungPairs(entry)) return json;
				const range = stationRangeForEntry(entry);
				const owner = entry.kmAbbildung.owner;
				return `// km ${range ? `${station(range.from).trim()} – ${station(range.to).trim()}` : "offen"}: Abbildung auf die Kilometerlinie${owner && owner !== entry ? ` über ${objectDisplayName(owner)}` : ""}, nicht Teil der gelieferten Punkte\n${json}`;
			}

			function selectObject(entry, button) {
				const started = performance.now();
				clearPlanningPreview();
				selectedPlanningFile = null;
				selectedEntry = entry;
				if (activeJunction && !activeJunction.entries.includes(entry)) activeJunction = null;
				for (let parent = button?.closest("details"); parent; parent = parent.parentElement?.closest("details")) parent.open = true;
				for (const candidate of tablesNav.querySelectorAll("button")) {
					candidate.classList.toggle("selected", candidate === button);
				}
				for (const loaded of loadedFiles) {
					for (const candidate of loaded.objects) {
						candidate.mapPath?.classList.toggle("active", candidate === entry);
					}
				}
				renderBasemap();
				updatePlanningRelevance(entry);
				updateOutbox(entry);
				const isProfile = entry.item.kind === "profile";
				const isAlignment = entry.item.kind === "alignment";
				const amount = isAlignment
					? count(entry.item.payload?.coordGeom?.elements)
					: isProfile || entry.item.kind === "cant"
						? count(entry.item.payload?.points)
						: count(entry.item.payload?.equations);
				tableTitle.textContent = `${familyForEntry(entry)} · ${objectDisplayName(entry)}`;
				tableMeta.textContent = `${amount.toLocaleString("de-DE")} ${isAlignment ? "Elemente" : "Einträge"}`;
				listing.textContent = isAlignment
					? alignmentListing(entry)
					: isProfile
						? profileListing(entry)
						: payloadListing(entry);
					renderDiagram(entry);
					queueMicrotask(() => {
						button?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
						outboxContent.querySelector(".outbox-object.selected")?.scrollIntoView?.({ block: "center", inline: "nearest" });
					});
					if (workspace.classList.contains("mode-links")) renderLinks();
					if (workspace.classList.contains("mode-delivery")) renderDelivery();
					if (workspace.classList.contains("mode-spurplan")) renderSpurplanView();
					followSelection(entry);
					recordPerformance("select-to-view", started, { kind: entry.item.kind });
			}

			function geoFrameInfo(entry) {
				if (entry.frameEdit) return entry.frameEdit;
				const viewer7L = entry.item?.payload?.extended?.viewer7L;
				if (viewer7L?.track) return {
					track: viewer7L.track,
					direction: viewer7L.direction || "unbekannt",
					lsys: viewer7L.LSYS || effectiveLsys(entry) || "LSYS?",
					hsys: viewer7L.HSYS || systemsForEntry(entry).hsys || "HSYS?",
					source: "landXML-7L",
				};
				// A Gradiente goes where its Trasse goes: a Trasse the user has sorted
				// by hand takes its Gradiente along, whatever the Gradiente's own
				// file name says (Eifel Gleis2_Bf_Auw.GRA stayed under "Bf Auw"
				// while its TRA went to Strecke 2631).
				if (entry.item?.kind !== "alignment") {
					const inherited = inheritedFrame(entry);
					if (inherited?.source === "user") return inherited;
				}
				const nameFrame = vermEsnNameFrame(entry);
				if (nameFrame) {
					const directionNames = { kilometer: "Kilometerlinie", right: "rechts", left: "links" };
					return {
						track: nameFrame.track,
						direction: directionNames[nameFrame.side] ?? (nameFrame.gleis ? `Bahnhofsgleis ${nameFrame.gleis}` : "unbekannt"),
						lsys: effectiveLsys(entry) || "LSYS?",
						hsys: systemsForEntry(entry).hsys || "HSYS?",
						segment: nameFrame.segment,
						source: "vermesn-name",
					};
				}
				if (entry.parser !== "gndEdit") return inheritedFrame(entry);
				const gndSequence = gndSequenceForEntry(entry);
				if (gndSequence) {
					const directionNames = { 0: "Kilometerlinie", 1: "rechts", 2: "links", 3: "Kilometerlinie (alt)", 4: "Nebengleis", 5: "Bahnhofs-/sonstiges Gleis" };
					return {
						track: gndSequence.strecke || "unbekannt",
						direction: directionNames[gndSequence.strRikz] ?? gndSequence.strRikz ?? "unbekannt",
						lsys: gndSequence.lsys || effectiveLsys(entry) || "LSYS?",
						hsys: gndSequence.hsys || systemsForEntry(entry).hsys || "HSYS?",
						externalStationing: true,
						selfReferencing: ["4", "5"].includes(String(gndSequence.strRikz ?? "")),
						source: "gnd",
					};
				}
				const sourceName = String(entry.item?.payload?.name ?? entry.item?.id ?? "");
				const parts = sourceName.split("_");
				const directionNames = { 0: "Kilometerlinie", 1: "rechts", 2: "links", 3: "Kilometrierung", 4: "Stationierung", 5: "sonstige" };
				return {
					track: parts[0] && parts[0] !== "unknown" ? parts[0] : "unbekannt",
					direction: directionNames[parts[1]] ?? parts[1] ?? "unbekannt",
					lsys: effectiveLsys(entry) || "LSYS?",
					hsys: systemsForEntry(entry).hsys || "HSYS?",
					source: "gnd",
				};
			}

			// Where a Strecke assignment comes from when it is not the file's own
			// data: the VermEsn file name, landXML's 7L feature, or the user's
			// hand. Returns a muted span for a title, or null for GND.
			function frameSourceHint(entries) {
				const labels = { "vermesn-name": "aus Dateiname", user: "per Hand", "landXML-7L": "aus landXML-7L" };
				const sources = [...new Set(entries.map((entry) => labels[geoFrameInfo(entry)?.source]).filter(Boolean))];
				if (!sources.length) return null;
				const hint = document.createElement("span");
				hint.className = "geo-frame-source";
				hint.textContent = sources.join(", ");
				if (sources.includes("aus Dateiname")) hint.title = `Strecke, Seite und km-Abschnitt aus der Dateinamen-Konvention der Lieferung: ${VERMESN_NAME_CONVENTIONS.map((convention) => convention.label).join("; ")}. Keine VermEsn-Angabe, eine Zuordnung per Hand gewinnt.`;
				return hint;
			}

			// A Gradiente, Überhöhung or Stationsgleichung is never assigned on its
			// own: it references a Trasse and goes where the Trasse goes. So its
			// frame is the Trasse's, including one the user set by hand.
			function inheritedFrame(entry) {
				if (entry.item?.kind === "alignment") return null;
				const anchor = relatedDiagramEntries(entry).anchor;
				if (!anchor || anchor === entry || anchor.item?.kind !== "alignment") return null;
				const frame = geoFrameInfo(anchor);
				return frame ? { ...frame, inherited: true } : null;
			}

			function geoFrameKey(frame) {
				return String(frame.track);
			}

			function isValidRouteNumber(value) {
				return /^\d{4}$/.test(String(value ?? "").trim());
			}

			function workspaceSection(title, count) {
				const section = document.createElement("details");
				section.className = "file-group workspace-section";
				section.open = false;
				const heading = document.createElement("summary");
				heading.className = "workspace-section-title";
				const label = document.createElement("span");
				label.textContent = title;
				const amount = document.createElement("span");
				amount.className = "workspace-section-count";
				amount.textContent = String(count);
				heading.append(label, amount);
				section.append(heading);
				return section;
			}

			function groupBy(items, keyFor) {
				const groups = new Map();
				for (const item of items) {
					const key = keyFor(item);
					if (!groups.has(key)) groups.set(key, []);
					groups.get(key).push(item);
				}
				return groups;
			}

			function sourceContentsLabel(loaded) {
				const families = [...new Set(loaded.objects.map(sourceFamilyForEntry))];
				return families.length ? families.join(" + ") : "keine verwertbaren Objekte";
			}

			const PLANNING_TEXT_EXTENSIONS = new Set(["txt", "csv", "tsv", "json", "md", "log", "ini", "yaml", "yml"]);
			const PLANNING_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);

			function planningFileMetadata(file) {
				const path = String(file.name ?? "Unbenannte Datei").replaceAll("\\", "/");
				const name = path.split("/").at(-1) || path;
				const extension = fileExtension(name);
				const routeMatch = path.match(/(?:strecke|str)[\s._-]*(\d{4})/i) ?? path.match(/(?:^|[\s_\/-])(\d{4})(?=[\s_.\/-]|$)/);
				const route = routeMatch?.[1] ?? "";
				const explicitKm = path.match(/(?:^|[\s_./-])km[\s._-]*(\d{1,3}(?:[.,]\d{1,3})?)(?:\s*(?:-|bis|–)\s*(\d{1,3}(?:[.,]\d{1,3})?))?/i);
				const routeTail = route ? path.slice((routeMatch?.index ?? 0) + routeMatch[0].length) : path;
				const implicitKm = routeTail.match(/(?:^|[_\/-])(\d{1,3}[.,]\d{1,3})(?=[_\/-]|$)/);
				const kmFromText = explicitKm?.[1] ?? implicitKm?.[1] ?? "";
				const kmToText = explicitKm?.[2] ?? "";
				const kmFrom = kmFromText ? Number(String(kmFromText).replace(",", ".")) : NaN;
				const kmTo = kmToText ? Number(String(kmToText).replace(",", ".")) : NaN;
				const section = path.match(/(?:abschnitt|absch|abs)[\s._-]*(\d{1,3})/i)?.[1] ?? "";
				let kind = "Datei";
				if (extension === "pdf") kind = "PDF";
				else if (PLANNING_IMAGE_EXTENSIONS.has(extension)) kind = "Bild";
				else if (["doc", "docx", "odt", "rtf"].includes(extension)) kind = "Dokument";
				else if (["xls", "xlsx", "xlsm", "csv", "tsv"].includes(extension)) kind = "Tabelle";
				else if (["dwg", "dxf", "dgn"].includes(extension)) kind = "CAD";
				else if (["zip", "7z", "rar"].includes(extension)) kind = "Archiv";
				return {
					id: `${path}\u0000${file.size}\u0000${file.lastModified}`,
					file, path, name, extension, route, section, kind,
					kmFrom: Number.isFinite(kmFrom) ? kmFrom : null,
					kmTo: Number.isFinite(kmTo) ? kmTo : null,
				};
			}

			function planningLocationLabel(record) {
				const parts = [];
				if (record.route) parts.push(`Strecke ${record.route}`);
				if (record.kmFrom != null) parts.push(record.kmTo != null
					? `km ${record.kmFrom.toLocaleString("de-DE")}–${record.kmTo.toLocaleString("de-DE")}`
					: `km ${record.kmFrom.toLocaleString("de-DE")}`);
				if (record.section) parts.push(`Abschnitt ${record.section}`);
				return parts.join(" · ") || "Ortsbezug nicht erkannt";
			}

			function addPlanningFiles(files, { importFailure = "" } = {}) {
				const known = new Set(planningFiles.map((record) => record.id));
				let added = 0;
				for (const file of files) {
					const record = planningFileMetadata(file);
					record.importFailure = importFailure;
					if (known.has(record.id)) continue;
					known.add(record.id);
					planningFiles.push(record);
					added += 1;
				}
				return added;
			}

			function clearPlanningPreview() {
				gridWrap.querySelector(".planning-preview")?.remove();
				listing.classList.remove("hidden");
				if (planningPreviewUrl) URL.revokeObjectURL(planningPreviewUrl);
				planningPreviewUrl = null;
			}

			async function selectPlanningFile(record, button) {
				selectedPlanningFile = record;
				for (let parent = button?.closest("details"); parent; parent = parent.parentElement?.closest("details")) parent.open = true;
				for (const candidate of tablesNav.querySelectorAll("button")) candidate.classList.toggle("selected", candidate === button);
				clearPlanningPreview();
				tableTitle.textContent = record.name;
				tableMeta.textContent = `${record.kind} · ${(record.file.size / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} KB`;
				outboxContent.replaceChildren();
				const name = document.createElement("strong");
				name.textContent = record.name;
				const location = document.createElement("span");
				location.textContent = planningLocationLabel(record);
				const source = document.createElement("span");
				source.textContent = `Quelle: ${record.path}`;
				outboxContent.append(name, location, source);
				if (record.importFailure) {
					const failure = document.createElement("span");
					failure.textContent = `Import: ${record.importFailure}`;
					outboxContent.append(failure);
				}
				const metadata = [`Datei: ${record.path}`, `Typ: ${record.kind}`, `Größe: ${record.file.size.toLocaleString("de-DE")} Byte`, `Geändert: ${new Date(record.file.lastModified).toLocaleString("de-DE")}`, `Zuordnung: ${planningLocationLabel(record)}`, ...(record.importFailure ? [`Import: ${record.importFailure}`] : [])];
				if ((PLANNING_TEXT_EXTENSIONS.has(record.extension) || record.file.type.startsWith("text/")) && record.file.size <= 5 * 1024 * 1024) {
					listing.textContent = await record.file.text();
				} else if (PLANNING_IMAGE_EXTENSIONS.has(record.extension) || record.file.type.startsWith("image/")) {
					planningPreviewUrl = URL.createObjectURL(record.file);
					const image = document.createElement("img");
					image.className = "planning-preview";
					image.alt = record.name;
					image.src = planningPreviewUrl;
					listing.classList.add("hidden");
					gridWrap.append(image);
				} else if (record.extension === "pdf" || record.file.type === "application/pdf") {
					planningPreviewUrl = URL.createObjectURL(record.file);
					const frame = document.createElement("iframe");
					frame.className = "planning-preview";
					frame.title = record.name;
					frame.src = planningPreviewUrl;
					listing.classList.add("hidden");
					gridWrap.append(frame);
				} else {
					listing.textContent = `${metadata.join("\n")}\n\nFür dieses Format ist keine direkte Vorschau verfügbar.`;
				}
				const mapIsOpen = selectedEntry && workspace.classList.contains("mode-crs");
				if (mapIsOpen) {
					dataPanel.classList.remove("hidden");
					reopenText.classList.add("hidden");
					toggleText.setAttribute("aria-pressed", "true");
				} else {
					setViewMode("listing");
				}
			}

			function routeForAlignment(entry) {
				const framedRoute = geoFrameInfo(entry)?.track;
				if (isValidRouteNumber(framedRoute)) return String(framedRoute);
				return String(entry?.loaded?.fileName ?? "").match(/(?:^|[^0-9])(\d{4})(?=[^0-9]|$)/)?.[1] ?? "";
			}

			function relatedPlanningFiles(entry) {
				const route = routeForAlignment(entry);
				return route ? planningFiles.filter((record) => record.route === route) : [];
			}

			function updatePlanningRelevance(entry) {
				const route = routeForAlignment(entry);
				for (const group of tablesNav.querySelectorAll(".planning-group-related")) group.classList.remove("planning-group-related");
				for (const record of planningFiles) {
					const related = Boolean(route && record.route === route);
					const row = record.button?.closest(".planning-file-row");
					row?.classList.toggle("related", related);
					row?.classList.toggle("unrelated", Boolean(route && !related));
					const group = row?.closest("details");
					if (related && group) {
						group.open = true;
						group.classList.add("planning-group-related");
						group.parentElement?.prepend(group);
					}
				}
			}

			function appendPlanningTree() {
				if (!planningFiles.length) return;
				const section = workspaceSection("Planungsgrundlagen", planningFiles.length);
				const groups = groupBy(planningFiles, (record) => record.route ? `Strecke ${record.route}` : "Ohne erkannten Ortsbezug");
				for (const [titleText, records] of groups) {
					const group = document.createElement("details");
					group.className = "organization-scope";
					group.open = false;
					const title = document.createElement("summary");
					title.className = "geo-frame-title";
					title.textContent = `${titleText} · ${records.length}`;
					group.append(title);
					for (const record of records.sort((a, b) => (a.kmFrom ?? Infinity) - (b.kmFrom ?? Infinity) || a.name.localeCompare(b.name, "de"))) {
						const row = document.createElement("div");
						row.className = "object-row planning-file-row";
						const button = document.createElement("button");
						const name = document.createElement("span");
						name.textContent = record.name;
						const kind = document.createElement("span");
						kind.dataset.kind = "true";
						kind.textContent = record.importFailure
							? "Import nicht möglich · als Grundlage erhalten"
							: `${record.kind} · ${record.kmFrom == null ? "ohne km" : `km ${record.kmFrom.toLocaleString("de-DE")}`}`;
						button.append(name, kind);
						record.button = button;
						button.addEventListener("click", () => selectPlanningFile(record, button));
						row.append(button);
						group.append(row);
					}
					section.append(group);
				}
				tablesNav.append(section);
			}

			function renderGrabbeltischBar(allEntries, rows) {
				for (const entry of [...bulkSelectedEntries]) {
					if (!allEntries.includes(entry)) bulkSelectedEntries.delete(entry);
				}
				const hits = rows.map((row) => row.entry);
				grabbelHitSet = new Set(hits);
				// Lage, Höhe, Aus-/Einblenden work on the hits; ticked hits narrow it.
				const targetsNow = () => {
					const checked = [...bulkSelectedEntries].filter((entry) => grabbelHitSet.has(entry));
					return checked.length ? checked : hits;
				};
				const rerender = () => renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
				const reselect = () => { if (selectedEntry?.button) selectObject(selectedEntry, selectedEntry.button); };
				const editor = document.createElement("div");
				editor.className = "bulk-crs grabbel";

				const gnd = allEntries.filter(isGndEntry).length;
				const rest = allEntries.length - gnd;
				const title = document.createElement("div");
				title.className = "grabbel-title";
				const titleText = document.createElement("span");
				titleText.textContent = "Inbox · Grabbeltisch";
				const titleSub = document.createElement("span");
				titleSub.className = "grabbel-sub";
				const bundleCount = new Set(rows.map((row) => row.entry.item.kind === "alignment" ? buendelStand().of.get(row.entry)?.id : null).filter(Boolean)).size;
				titleSub.textContent = `${rows.length ? `${rows.length} hier${bundleCount > 1 ? ` in ${bundleCount} Bündeln` : ""}` : "leer"} · Rest ${rest} · GND ${gnd} fertig rechts`;
				titleSub.title = "GND kommt mit Strecke, Seite und Lage und sortiert sich selbst nach rechts; der Rest (VermEsn, landXML) kommt ohne alles und liegt hier, bis er Lage und Höhe hat und nach rechts gezogen ist";
				title.append(titleText, titleSub);

				const query = document.createElement("input");
				query.type = "search";
				query.className = "grabbel-query";
				query.placeholder = "Filter: Name, Datei, Strecke · „ohne Lage“ · „ausgeblendet“";
				query.title = "Mehrere Wörter: alle müssen passen. Sucht Name, Datei, Art, Lage, Höhe, Strecke und die Zustände „ohne Lage“, „ohne Höhe“, „ausgeblendet“, „sichtbar“.";
				query.setAttribute("aria-label", "Grabbeltisch durchsuchen");
				query.value = inboxQuery;
				let queryTimer = 0;
				query.addEventListener("input", () => {
					inboxQuery = query.value;
					clearTimeout(queryTimer);
					queryTimer = setTimeout(() => {
						rerender();
						const again = tablesNav.querySelector(".grabbel-query");
						if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
					}, 220);
				});

				const head = document.createElement("div");
				head.className = "bulk-crs-head";
				const count = document.createElement("strong");
				count.dataset.hits = String(hits.length);
				const unhook = document.createElement("button");
				unhook.type = "button";
				unhook.className = "grabbel-unhook hidden";
				unhook.textContent = "Haken weg";
				unhook.title = "Haken entfernen: die Aktionen wirken wieder auf alle Treffer";
				const hide = document.createElement("button");
				hide.type = "button";
				hide.textContent = "◌ aus";
				hide.title = "Die Treffer von der Karte nehmen (GIS und Übersicht); Spurplan und Pläne bleiben";
				const show = document.createElement("button");
				show.type = "button";
				show.textContent = "◉ ein";
				show.title = "Die Treffer wieder auf die Karte";
				const eyes = document.createElement("span");
				eyes.className = "bulk-crs-pair";
				eyes.append(hide, show);
				head.append(count, unhook, eyes);

				const fields = document.createElement("div");
				fields.className = "bulk-crs-fields grabbel-fields";
				const lsys = document.createElement("select");
				lsys.className = "grabbel-lsys";
				lsys.setAttribute("aria-label", "Lagebezug für die Treffer");
				for (const [value, label] of CRS_OPTIONS) {
					const option = document.createElement("option");
					option.value = value;
					option.textContent = label;
					lsys.append(option);
				}
				const hsys = document.createElement("select");
				hsys.setAttribute("aria-label", "Höhenbezug für die Treffer");
				for (const [value, label] of HSYS_OPTIONS) {
					const option = document.createElement("option");
					option.value = value;
					option.textContent = label;
					hsys.append(option);
				}
				const withoutLsys = hits.filter((entry) => entry.item.kind === "alignment" && !effectiveLsys(entry)).length;
				const withoutHsys = hits.flatMap((entry) => entry.item.kind === "profile" ? [entry] : entry.item.kind === "alignment" ? inboxDependents(entry).filter((dependent) => dependent.item.kind === "profile") : []).filter((entry) => !systemsForEntry(entry).hsys).length;
				const labelFor = (text, missing) => {
					const label = document.createElement("span");
					label.className = "bulk-crs-label";
					label.textContent = text;
					if (missing) {
						const chip = document.createElement("span");
						chip.className = "inbox-chip inbox-chip-missing";
						chip.textContent = String(missing);
						chip.title = `${missing} der Treffer ohne ${text}`;
						label.append(" ", chip);
					}
					return label;
				};
				const applyLsys = document.createElement("button");
				applyLsys.type = "button";
				applyLsys.textContent = "→ Treffer";
				applyLsys.title = "Diese Lage den Trassen unter den Treffern geben; Gradiente und Überhöhung folgen ihrer Trasse";
				const applyHsys = document.createElement("button");
				applyHsys.type = "button";
				applyHsys.textContent = "→ Treffer";
				applyHsys.title = "Diese Höhe den Gradienten unter den Treffern geben, auch denen der getroffenen Trassen";
				fields.append(labelFor("Lage", withoutLsys), lsys, applyLsys, labelFor("Höhe", withoutHsys), hsys, applyHsys);
				editor.append(title, query, head, fields);

				unhook.addEventListener("click", () => {
					bulkSelectedEntries.clear();
					rerender();
				});
				// Lage: only a Trasse has one; its Gradiente/Überhöhung read it from
				// the Trasse (effectiveLsys). Höhe: only a Gradiente has one; a
				// targeted Trasse passes it to its own Gradiente(n).
				applyLsys.addEventListener("click", () => {
					const targets = targetsNow();
					if (!targets.length) { status.textContent = "Kein Treffer, nichts zu setzen."; return; }
					let unresolved = 0;
					let applied = 0;
					for (const entry of targets) {
						if (entry.item.kind !== "alignment") continue;
						applied += 1;
						const value = userLsysForEntry(entry, lsys.value);
						if (value === null) {
							unresolved += 1;
							continue;
						}
						if (value === undefined) delete entry.displayLsys;
						else entry.displayLsys = value;
						listingCache.delete(entry);
						mapGeometryCache.delete(entry);
						geometryModelCache.delete(entry);
					}
					einordnungGeaendert();
					status.classList.toggle("error", unresolved > 0);
					status.textContent = !applied
						? "Lage gilt für Trassen; unter den Treffern ist keine."
						: unresolved
						? `${unresolved} Trassen ohne erkennbaren Meridianstreifen; Lagezuordnung dort unverändert.`
						: `${lsys.options[lsys.selectedIndex].textContent} für ${applied} Trassen gesetzt (Gradiente und Überhöhung folgen); Meridianstreifen automatisch erkannt.`;
					if (activeMapMode === "crs") renderMap("crs");
					renderBasemap();
					rerender();
					reselect();
				});
				applyHsys.addEventListener("click", () => {
					const targets = targetsNow();
					if (!targets.length) { status.textContent = "Kein Treffer, nichts zu setzen."; return; }
					const value = hsys.value;
					const profiles = new Set();
					for (const entry of targets) {
						if (entry.item.kind === "profile") profiles.add(entry);
						if (entry.item.kind === "alignment") for (const dependent of inboxDependents(entry)) if (dependent.item.kind === "profile") profiles.add(dependent);
					}
					for (const entry of profiles) {
						if (value === "AUTO") delete entry.displayHsys;
						else entry.displayHsys = value;
						listingCache.delete(entry);
					}
					einordnungGeaendert();
					status.classList.remove("error");
					status.textContent = profiles.size
						? `${hsys.options[hsys.selectedIndex].textContent} für ${profiles.size} Gradienten gesetzt.`
						: "Höhe gilt für Gradienten; unter den Treffern ist keine.";
					rerender();
					reselect();
				});
				const setHidden = (hidden) => {
					const targets = targetsNow().filter((entry) => entry.item.kind === "alignment" || !referencingEntries(entry).length);
					if (!targets.length) { status.textContent = "Kein Treffer, nichts zu ändern."; return; }
					setEntriesHidden(targets, hidden);
					status.classList.remove("error");
					status.textContent = `${targets.length} Objekte auf der Karte ${hidden ? "ausgeblendet" : "eingeblendet"} · ${hiddenEntryKeys.size} insgesamt ausgeblendet.`;
				};
				hide.addEventListener("click", () => setHidden(true));
				show.addEventListener("click", () => setHidden(false));
				return editor;
			}

			function assignEntryToSevenLine(entry, groupDef, frame) {
				einordnungGeaendert();
				const compatible = entry.item.kind === groupDef.kind
					|| (groupDef.role === "curvatureKilometer" && entry.item.kind === "staEq");
				if (!compatible) {
					status.classList.add("error");
					status.textContent = `${sourceFamilyForEntry(entry)} passt nicht in „${groupDef.title}“.`;
					return;
				}
				entry.userFamily = groupDef.family;
				entry.userLineRole = groupDef.role;
				entry.frameEdit = { ...frame, direction: groupDef.direction ?? frame.direction, source: "user" };
				entry.organizationEdit = {
					family: groupDef.family,
					lineRole: groupDef.role,
					source: "user",
					originalFamily: sourceFamilyForEntry(entry),
				};
				if (entry.parser === "vermEsn" || gndEigenstationiert(entry)) reconcileVermEsnStationing();
				status.classList.remove("error");
				status.textContent = `${objectListName(entry)} → ${groupDef.title}`;
				dragHintUsed = true;
				renderObjectTree(entry.loaded?.fileName ?? null);
			}

			function explicitSectionForEntry(entry) {
				const viewer7L = entry?.item?.payload?.extended?.viewer7L ?? {};
				return firstText(entry?.frameEdit?.sectionId, viewer7L.sectionId, viewer7L.section, viewer7L.segmentId, entry?.item?.payload?.sectionId);
			}

			function stationRangeForEntry(entry) {
				let from = Infinity;
				let to = -Infinity;
				const add = (value) => {
					// A missing value is no station: a VermEsn Kilometersprung has its
					// station and a delta but no staAhead, and that null once read as
					// km 0 and pulled the Eifel Abschnitt down to "0,0 + 00,00".
					if (value == null) return;
					const scalar = stationScalar(value);
					if (!Number.isFinite(scalar)) return;
					from = Math.min(from, scalar);
					to = Math.max(to, scalar);
				};
				// An object with external km on any element or point is measured in
				// that frame only: an element or point the projection (or the GND
				// reference) did not reach keeps its file-local station, and mixing
				// that into the range put an Eifel Abschnitt at "0,0 + 00,00 – ...".
				// The Überhöhung of a projected Trasse carries mapped points but no
				// externalStationReference of its own, so the points decide.
				const elements = entry?.item?.payload?.coordGeom?.elements ?? [];
				const points = entry?.item?.payload?.points ?? [];
				const projected = hasKmOfItsOwnOrMapped(entry);
				for (const element of elements) {
					const externalStart = elementKmStart(entry, element);
					const externalEnd = elementKmEnd(entry, element);
					if (projected && externalStart == null) continue;
					const start = stationScalar(externalStart ?? element.staStart);
					const length = Math.abs(numberValue(element.length));
					if (Number.isFinite(start)) {
						add(start);
						if (externalEnd != null) add(externalEnd);
						else if (Number.isFinite(length)) add(start + length);
					}
				}
				for (const point of points) {
					const km = pointKm(entry, point);
					if (projected && km == null) continue;
					add(km ?? point.station ?? point.sta ?? point.s ?? point.chainage);
				}
				for (const equation of entry?.item?.payload?.equations ?? entry?.item?.payload?.staEquations ?? []) {
					add(equation.stationBack ?? equation.staBack ?? equation.station);
					add(equation.stationAhead ?? equation.staAhead);
				}
				return Number.isFinite(from) ? { from, to } : null;
			}

			function sectionLabel(sectionPackage) {
				if (sectionPackage.sectionId) return `Abschnitt ${sectionPackage.sectionId}`;
				if (!sectionPackage.range) return "Abschnitt · Bereich offen";
				return `Abschnitt ${station(sectionPackage.range.from).trim()} – ${station(sectionPackage.range.to).trim()}`;
			}

			const LANE_SHORT = { gradientRight: "GRA re", gradientLeft: "GRA li", cantLeft: "EU li", curvatureLeft: "TRA li", curvatureKilometer: "km", curvatureRight: "TRA re", cantRight: "EU re" };
			function buildLaneStrip(entries, current) {
				const strip = document.createElement("span");
				strip.className = "lane-strip";
				let filled = 0;
				for (const groupDef of SEVEN_LINE_GROUPS.filter((group) => group.family !== "UNASSIGNED")) {
					const laneEntries = entries.filter((entry) => einordnungRolle(entry) === groupDef.role);
					if (laneEntries.length) filled += 1;
					const cell = document.createElement("span");
					cell.className = `lane-cell${laneEntries.length ? " filled" : ""}${laneEntries.includes(current) ? " current" : ""}`;
					cell.textContent = LANE_SHORT[groupDef.role] ?? groupDef.title;
					if (laneEntries.length > 1) cell.dataset.count = String(laneEntries.length);
					cell.title = `${groupDef.title}: ${laneEntries.length ? laneEntries.map(objectListName).join(", ") : "leer"}`;
					strip.append(cell);
				}
				strip.title = `${filled} von 7 Zeilen belegt`;
				return strip;
			}
			function buildSevenLineLanes(frame, entries, current) {
				const fragment = document.createDocumentFragment();
				for (const groupDef of SEVEN_LINE_GROUPS.filter((group) => group.family !== "UNASSIGNED")) {
					const lane = document.createElement("div");
					const laneEntries = entries.filter((entry) => einordnungRolle(entry) === groupDef.role);
					// Trassen of one Spur that cover the same km stand back in a
					// picture until they are selected; the mark says what they are to
					// the one shown: a Variante of it, or another Gleis beside it.
					const standBack = new Map();
					if (groupDef.kind === "alignment" && laneEntries.length > 1) {
						const model = einordnung();
						// Only Trassen: the Kilometersprünge of a Kilometerlinie sit in
						// its Spur and cover its km, but are no Trasse beside it.
						// Nor a Gleis sorted in by hand that has no km there: it shares a
						// picture with nobody, so it stands back for nobody.
						const placed = laneEntries.filter((entry) => entry.item.kind === "alignment").map((entry) => model.objects.get(einordnungKey(entry)))
							.filter((item) => item && !(item.frame?.source === "user" && item.kmFrame === false));
						for (const item of einordnungVarianten(placed, null).hidden) standBack.set(item.key, item.wegen);
					}
					lane.className = `outbox-lane${laneEntries.includes(current) ? " contains-selection" : ""}`;
					const title = document.createElement("div");
					title.className = "outbox-lane-title";
					title.innerHTML = `<span>${groupDef.title}</span><span>${laneEntries.length || "–"}</span>`;
					lane.append(title);
					for (const entry of laneEntries) {
						const objectRow = document.createElement("div");
						objectRow.className = "outbox-object-row";
						const checkbox = document.createElement("input");
						checkbox.type = "checkbox";
						checkbox.className = "object-select";
						checkbox.checked = bulkSelectedEntries.has(entry);
						checkbox.setAttribute("aria-label", `${objectListName(entry)} zur Mehrfachauswahl hinzufügen`);
						checkbox.addEventListener("change", () => {
							if (checkbox.checked) bulkSelectedEntries.add(entry);
							else bulkSelectedEntries.delete(entry);
							updateGrabbelCount();
							renderDiagram();
						});
						const button = document.createElement("button");
						button.type = "button";
						button.draggable = true;
						button.title = "Zum Umsortieren in eine andere Zeile ziehen";
						button.className = `outbox-object${entry === current ? " selected" : ""}`;
						button.textContent = objectListName(entry);
						// A Gleis sorted to a side shows whether the Lage agrees.
						const evidence = entry.item.kind === "alignment" ? sideEvidence(entry) : null;
						if (evidence) {
							button.title = `${sideEvidenceText(evidence)}\n${button.title}`;
							if (evidence.grade === "belegt" || evidence.grade === "widerspruch") {
								const mark = document.createElement("span");
								mark.className = `side-witness ${evidence.grade}`;
								mark.textContent = evidence.grade === "belegt" ? "Lage ✓" : "Lage widerspricht";
								button.append(mark);
							}
						}
						// A Gleis sorted in by hand whose km are not plainly the Strecke's:
						// without km, with another Strecke's, or stationed from farther away.
						const kmMarke = entry.item.kind === "alignment" ? kmHinweisMarke(entry) : null;
						if (kmMarke) {
							const mark = document.createElement("span");
							mark.className = `side-witness km-hinweis ${entry.kmHinweis.art}`;
							mark.textContent = kmMarke;
							button.append(mark);
							const text = kmHinweisText(entry);
							button.title = `${text.charAt(0).toUpperCase()}${text.slice(1)}.\n${button.title}`;
						}
						const coveredBy = standBack.get(einordnungKey(entry));
						if (coveredBy) {
							const shown = einordnungEintrag(coveredBy);
							const neben = nebenArt(entry, shown);
							const mark = document.createElement("span");
							mark.className = `side-witness neben ${neben.art}`;
							mark.textContent = NEBEN_MARKE[neben.art];
							button.append(mark);
							const text = nebenText(entry, neben);
							button.title = `${text.charAt(0).toUpperCase()}${text.slice(1)}. Im Bild steht je Seite die längste Trasse dieser km (${objectListName(shown)}), bis diese hier gewählt wird.\n${button.title}`;
						}
						entry.button = button;
						button.addEventListener("click", () => selectObject(entry, button));
						button.addEventListener("dragstart", (event) => {
							draggedOrganizationEntry = { entry, row: objectRow };
							objectRow.classList.add("dragging");
							event.dataTransfer.effectAllowed = "copy";
							event.dataTransfer.setData("text/plain", String(entry.item.id ?? objectDisplayName(entry)));
						});
						button.addEventListener("dragend", () => {
							objectRow.classList.remove("dragging");
							draggedOrganizationEntry = null;
						});
						// The eye sits on the Trasse; a Gradiente, Überhöhung or
						// Stationsgleichung has no line of its own on the map and dims
						// with its Trasse.
						const trasse = entry.item.kind === "alignment" ? entry : einordnungEintrag(einordnung().objects.get(einordnungKey(entry))?.trasse);
						objectRow.append(checkbox, button);
						if (entry.item.kind === "alignment") objectRow.append(eyeButton(entry));
						else objectRow.append(document.createElement("span"));
						if (trasse?.item?.kind === "alignment" && isEntryHidden(trasse)) objectRow.classList.add("hidden-object");
						lane.append(objectRow);
					}
					if (!laneEntries.length) {
						const placeholder = document.createElement("div");
						placeholder.className = "outbox-lane-placeholder";
						placeholder.textContent = "Objekt aus der Inbox hierher ziehen";
						lane.append(placeholder);
					}
					lane.addEventListener("dragover", (event) => {
						if (!draggedOrganizationEntry) return;
						event.preventDefault();
						lane.classList.add("drag-target");
					});
					lane.addEventListener("dragleave", () => lane.classList.remove("drag-target"));
					lane.addEventListener("drop", (event) => {
						event.preventDefault();
						lane.classList.remove("drag-target");
						if (draggedOrganizationEntry) assignEntryToSevenLine(draggedOrganizationEntry.entry, groupDef, frame);
					});
					fragment.append(lane);
				}
				return fragment;
			}

			function buildNewGroupControl(current) {
				const control = document.createElement("div");
				control.className = "outbox-new-group";
				const toggle = document.createElement("button");
				toggle.type = "button";
				toggle.className = "outbox-new-group-toggle";
				toggle.textContent = "+ Neue Gruppe";
				const form = document.createElement("div");
				form.className = "outbox-new-group-form hidden";
				const trackInput = document.createElement("input");
				trackInput.type = "text";
				trackInput.placeholder = "Gleis-/Streckenbezeichnung";
				const lsysInput = document.createElement("input");
				lsysInput.type = "text";
				lsysInput.placeholder = "LSYS (optional)";
				const create = document.createElement("button");
				create.type = "button";
				create.textContent = "Anlegen";
				create.addEventListener("click", () => {
					const track = trackInput.value.trim();
					if (!track) { trackInput.focus(); return; }
					draftSevenLineFrames.push({ track, lsys: lsysInput.value.trim() || null });
					renderSevenLineOutbox(current);
				});
				toggle.addEventListener("click", () => form.classList.toggle("hidden"));
				form.append(trackInput, lsysInput, create);
				control.append(toggle, form);
				return control;
			}

			// A Weiche/Abzweig has no dedicated table in GND -- it shows up implicitly
			// as two or more alignment objects whose geometry touches at exactly ONE
			// shared endpoint (they meet there, then diverge). Two records for the SAME
			// physical track (e.g. an EK and an EL family row for one Gleis) instead
			// share BOTH endpoints -- that pair is folded into one track before
			// clustering so it can never masquerade as a junction. No switch numbering
			// is invented: only the coordinates GND already carries are used.
			function alignmentEndpoints(entry) {
				const elements = entry?.item?.payload?.coordGeom?.elements;
				const start = elements?.[0]?.start;
				const end = elements?.[elements.length - 1]?.end;
				if (!start || !end) return null;
				return { start, end };
			}


			// A Weiche picked for the IVHW shows ±JUNCTION_WINDOW_M around its
			// point, the Gradiente interpolated every 5 m (profile points lie
			// hundreds of metres apart on a Strecke).
			const JUNCTION_WINDOW_M = 250;
			function distanceAndStationOnPolyline(polyline, point) {
				let best = null;
				for (let index = 0; index + 1 < polyline.length; index += 1) {
					const a = polyline[index];
					const b = polyline[index + 1];
					const dx = b.easting - a.easting;
					const dy = b.northing - a.northing;
					const lengthSq = dx * dx + dy * dy;
					const t = lengthSq > 1e-9 ? Math.max(0, Math.min(1, ((point.easting - a.easting) * dx + (point.northing - a.northing) * dy) / lengthSq)) : 0;
					const distance = Math.hypot(point.easting - (a.easting + t * dx), point.northing - (a.northing + t * dy));
					if (!best || distance < best.distance) {
						// side: +1 left of the polyline's direction, -1 right (cross product).
						// run: the Lauflänge there (referenceStationPolyline); atEnd: the
						// point lies beyond either end, the foot is the end itself.
						const cross = dx * (point.northing - a.northing) - dy * (point.easting - a.easting);
						best = { distance, station: a.station + t * (b.station - a.station), run: (a.run ?? 0) + t * ((b.run ?? 0) - (a.run ?? 0)), side: cross >= 0 ? 1 : -1, atEnd: (index === 0 && t === 0) || (index === polyline.length - 2 && t === 1) };
					}
				}
				return best;
			}

			// ---- ABLEITUNG · Topologie (gerechnet) --------------------------------
			// GND names its Weichen through Streckennummern, landXML through the
			// desc, TRA/GRA name nothing -- so the Spurplan's graph is computed
			// from geometry alone, the same way for every format and independent
			// of the CRS as long as one batch lives in one system. A node is where
			// an alignment's end meets another end, or lies on another alignment
			// away from its ends (that alignment is split there); an edge is an
			// alignment between two nodes. The node's kind follows its degree and
			// its tangents: Ende (1), Fortsetzung (2, tangential -- GND chunks a
			// Gleis at every Weiche, so these are seams, not Weichen), Knick (2,
			// not tangential), Weiche (3), Kreuzung (4 with two through pairs),
			// Knoten otherwise. Kilometerlinien are not Gleise and take no part;
			// where they exist a node gets its km from the nearest one.
			const TOPOLOGY_TOLERANCE_M = 0.3;
			const TOPOLOGY_TANGENT_COS = -Math.cos(2 * Math.PI / 200);
			// A node takes its km from a Kilometerlinie only when it lies within a
			// Bahnhof's width of it; a projection from farther away is not its km.
			const TOPOLOGY_KM_MAX_DISTANCE_M = 60;
			// A Knoten farther than that still gets a km (over the foot of the
			// perpendicular, marked as far) up to this distance -- a Gleisgruppe
			// beside the Strecke, not the next Strecke over.
			const TOPOLOGY_KM_FAR_M = 250;
			// Die Annahmen der Ordnung: thresholds no file states. Each has its
			// reason from the measurements and a field in "Annahmen" above the
			// Outbox -- a plausible value, shown with why, and changeable where it
			// is used. Changed, every Gleis is stationed anew and the proposals are
			// measured again; what differs from the standard is saved with the
			// state. (The Spurplan keeps TOPOLOGY_KM_FAR_M for its Knoten.)
			const ORDNUNG_ANNAHMEN = [
				{ key: "reichweite", label: "Kilometerlinie in Reichweite bis", unit: "m", standard: LAGE_REACH_M, min: 10, max: 500, step: 10,
					grund: "So weit darf eine Kilometerlinie neben einem Gleis liegen, damit seine Lage an ihr gemessen wird: die Seite, der Sortiervorschlag und der Anteil neben der Linie. Gemessen in neun Lieferungen: mit 60 m bleiben in WueTreu 95 und in Billwerder 19 Gleise ohne Vorschlag; bei 62 und bei allen 19 davon läuft die Kilometerlinie weiter daneben (WueTreu 47 in 60 bis 100 m, 15 bis 150 m; Billwerder 11, 4 und 4 bis 250 m). Ein größerer Wert lässt in Bahnhöfen mehr Kilometerlinien zur Wahl." },
				{ key: "kmFern", label: "km von Hand bis", unit: "m", standard: TOPOLOGY_KM_FAR_M, min: 60, max: 2000, step: 10,
					grund: "Ein von Hand einsortiertes Gleis bekommt die km seiner Strecke über den Lotfußpunkt auch dann, wenn ein Ende weiter als 60 m neben der Kilometerlinie liegt — bis zu diesem Abstand. Gemessen an Bahnhofsgleisen in breiten Gleisfeldern (Billwerder, WueTreu)." },
				{ key: "anteil", label: "dabei neben der Linie ab", unit: "%", standard: BEZUGSLINIE_VON_HAND_MIN_ANTEIL * 100, min: 0, max: 100, step: 5,
					grund: "Anteil des Gleises, der dafür in Reichweite neben der Kilometerlinie liegen muss. Darunter bleibt das Gleis ohne km und trägt die Marke „ohne km“." },
				{ key: "genau", label: "Stationen sind km: ein Ende auf", unit: "m", standard: BEZUGSLINIE_STATION_GENAU_M, min: 0, max: 50, step: 1,
					grund: "Gelieferte Stationen gelten als km der Strecke, wenn ein Ende des Gleises, auf die Kilometerlinie gelotet, auf diesen Betrag bei seinem km liegt. Gemessen in sieben Lieferungen: echte km stimmen auf 1 m, eigene Zählungen liegen 34 m und mehr daneben." },
				{ key: "ueberstand", label: "das andere Ende bis", unit: "m", standard: BEZUGSLINIE_STATION_TOLERANZ_M, min: 0, max: 500, step: 10,
					grund: "Spielraum für das andere Ende: ein Gleis darf über das Ende seiner Kilometerlinie hinausreichen, dort endet der Lotfußpunkt am Linienende." },
				{ key: "zweifel", label: "Zweifel an der Strecke ab", unit: "Stichproben", standard: LAGE_ZWEIFEL_MIN_FEHLEND, min: 1, max: 25, step: 1,
					grund: "Ein Sortiervorschlag wird hervorgehoben, wenn das Gleis an der nächsten Kilometerlinie mit so vielen seiner 9 bis 25 Stichproben fehlt und an der Linie einer anderen Strecke ganz liegt. Eine einzelne fehlende Stichprobe ist die Körnung der Messung." },
			];
			const ordnungAnnahmen = Object.fromEntries(ORDNUNG_ANNAHMEN.map((annahme) => [annahme.key, annahme.standard]));
			function ordnungAnnahmenGeaendert() {
				return ORDNUNG_ANNAHMEN.filter((annahme) => ordnungAnnahmen[annahme.key] !== annahme.standard);
			}
			// Takes a value if it is a number within the field's range; says
			// whether anything changed.
			function ordnungAnnahmeSetzen(key, value) {
				const annahme = ORDNUNG_ANNAHMEN.find((item) => item.key === key);
				const number = Number(value);
				if (!annahme || value === "" || value == null || !Number.isFinite(number)) return false;
				const clamped = Math.max(annahme.min, Math.min(annahme.max, number));
				if (ordnungAnnahmen[key] === clamped) return false;
				ordnungAnnahmen[key] = clamped;
				return true;
			}
			// Every Gleis is measured against the values that stand now: what is
			// stationed on a Kilometerlinie is taken off it first, then decided
			// anew as when the files were loaded and sorted.
			function ordnungNeuStationieren() {
				// The Lage of every Gleis is measured anew: the reach may have changed.
				lageCache = { key: null, axes: [], byEntry: new Map() };
				for (const entry of allViewerEntries()) {
					if (entry.item.kind === "alignment" && entry.externalStationReference && (entry.parser === "vermEsn" || gndEigenstationiert(entry))) kmAbbildungLoesen(entry);
				}
				einordnungGeaendert();
				reconcileVermEsnStationing();
			}
			function renderOrdnungAnnahmen() {
				const menu = document.querySelector("#ordnungAnnahmenMenu");
				const body = document.querySelector("#ordnungAnnahmenBody");
				const summary = document.querySelector("#ordnungAnnahmenSummary");
				if (!menu || !body || !summary) return;
				const changed = ordnungAnnahmenGeaendert();
				menu.classList.toggle("geaendert", changed.length > 0);
				summary.textContent = "Annahmen ▾";
				summary.setAttribute("aria-label", changed.length ? `Annahmen der Ordnung, ${changed.length} geändert` : "Annahmen der Ordnung");
				const anwenden = () => {
					ordnungNeuStationieren();
					renderOrdnungAnnahmen();
					status.classList.remove("error");
					const now = ordnungAnnahmenGeaendert();
					status.textContent = now.length ? `Annahmen der Ordnung geändert (${now.map((annahme) => `${annahme.label} ${ordnungAnnahmen[annahme.key]} ${annahme.unit}`).join(" · ")}) · alle Gleise neu stationiert` : "Annahmen der Ordnung wieder auf dem Standard · alle Gleise neu stationiert";
					renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
					if (selectedEntry?.button) selectObject(selectedEntry, selectedEntry.button);
				};
				body.replaceChildren();
				for (const annahme of ORDNUNG_ANNAHMEN) {
					const label = document.createElement("label");
					label.className = `gwb-input${ordnungAnnahmen[annahme.key] !== annahme.standard ? " geaendert" : ""}`;
					label.title = `${annahme.grund} Standard: ${annahme.standard} ${annahme.unit}.`;
					const input = document.createElement("input");
					input.type = "number";
					input.inputMode = "numeric";
					input.min = String(annahme.min);
					input.max = String(annahme.max);
					input.step = String(annahme.step);
					input.value = String(ordnungAnnahmen[annahme.key]);
					input.dataset.annahme = annahme.key;
					input.addEventListener("change", () => {
						if (ordnungAnnahmeSetzen(annahme.key, input.value)) anwenden();
						else input.value = String(ordnungAnnahmen[annahme.key]);
					});
					label.append(`${annahme.label} `, input, ` ${annahme.unit}`);
					body.append(label);
				}
				const reset = document.createElement("button");
				reset.type = "button";
				reset.className = "menu-item";
				reset.textContent = "Standard";
				reset.title = "Alle Annahmen der Ordnung auf die gemessenen Standardwerte zurücksetzen";
				reset.disabled = !changed.length;
				reset.addEventListener("click", () => {
					for (const annahme of ORDNUNG_ANNAHMEN) ordnungAnnahmen[annahme.key] = annahme.standard;
					anwenden();
				});
				body.append(reset);
			}
			renderOrdnungAnnahmen();
			const TOPOLOGY_AXIS_MAX_DISTANCE_M = 150;
			// Rows split where neighbouring offsets differ by more than this. 1,5 m:
			// the Kilometerlinie of a two-track Strecke runs 2 m from either Gleis
			// (Landshut 5500 S between R and L), so 2,5 m folded all three into one
			// row; real parallel Gleise are 3,5 m apart or more, still one row each.
			const TOPOLOGY_ROW_GAP_M = 1.5;
			// The Outbox renders on every selection; the graph only changes with
			// the loaded objects (166 Gleise take ~0,8 s), so it is cached per set.
			let topologyCache = { key: "", result: null };
			function deriveTopology() {
				const key = allViewerEntries().map((entry) => entry.item.id).join("|");
				if (topologyCache.key === key && topologyCache.result) return topologyCache.result;
				const result = computeTopology();
				topologyCache = { key, result };
				return result;
			}
			// A topology node as the IVHW's junction: its Gleise, its point, its
			// km on the axis (null when the axis is a Gleis -- VermEsn without a
			// Kilometerlinie has no shared station for a window or a rail side).
			function junctionFromNode(node) {
				const axisIsGleis = deriveTopology().axisIsGleis;
				return {
					id: `topology-${node.id}`,
					node,
					entries: [...new Set(node.arms.map((arm) => arm.entry))],
					roles: node.roles?.spitze ? node.roles : null,
					point: node.point,
					stationRaw: !axisIsGleis && node.km != null ? node.km : null,
					window: !axisIsGleis && node.km != null ? JUNCTION_WINDOW_M : null,
				};
			}
			// ---- ABLEITUNG · Topologie aus den Daten (GND Satzart 31 / 33) --------
			// A GND-MDB can carry its own track graph. Satzart 31 names every
			// Knoten: a Weiche with its number and Bauart ("EW 49-190-1:9"), a
			// Kreuzung, a Streckenwechsel, a Gleisende. Satzart 33 lists every
			// Gleisstrang between two Knoten with the points along it. Where a
			// file has both, the graph is read, not guessed: nodes and edges come
			// from there, and only the Gleise no Gleisstrang covers go through the
			// geometric derivation below. DBB exports and MDBs of a plain Strecke
			// have neither table filled; they stay computed.
			// BEGIN GND TOPOLOGY (test/technet-viewer-gnd-topology.test.mjs runs this block)
			const GND_KNOTEN_KINDS = { 1: "Weiche", 2: "Ende", 3: "Fortsetzung", 4: "Kreuzung" };
			// A Knoten names a computed node when its point lies this close to it.
			const GND_KNOTEN_MATCH_M = 1;
			// Point addresses and Knoten names are fixed-width fields; runs of
			// blanks carry no meaning ("203695    24" is Betriebsstelle 203695,
			// Weiche 24).
			function gndKey(value) {
				return String(value ?? "").replace(/\s+/g, " ").trim();
			}
			function gndKnotenLabel(node) {
				return node.knotenTyp === 1 ? `W ${node.knotenName}` : node.knotenTyp === 4 ? `Kr ${node.knotenName}` : null;
			}
			// The points of a Gleisstrang, in order, against the Lage elements by
			// their two point addresses (elementOf: "a|b" → { entry, index,
			// forward }): consecutive elements of one Gleis in one direction form a
			// portion. A pair no element answers to leaves a gap between portions.
			function gndStrandPortions(pads, elementOf) {
				const portions = [];
				for (let index = 0; index + 1 < pads.length; index += 1) {
					const hit = elementOf.get(`${pads[index]}|${pads[index + 1]}`);
					if (!hit) continue;
					const last = portions[portions.length - 1];
					if (last && last.entry === hit.entry && last.forward === hit.forward && last.toPad === pads[index]) {
						last.lastIndex = hit.index;
						last.toPad = pads[index + 1];
					} else {
						portions.push({ entry: hit.entry, forward: hit.forward, firstIndex: hit.index, lastIndex: hit.index, fromPad: pads[index], toPad: pads[index + 1] });
					}
				}
				return portions;
			}
			// A Bauart as GND writes it: "EW 49-190-1:9", "ABW 60-500-1:12",
			// "IBW 60-760-1:18,5-fb", "DKW 54-190-1:9", "Kr 60-1:18.5". Form,
			// Schienenprofil, Zweigradius and Neigung, each only where the text has it.
			function gndBauart(text) {
				const value = gndKey(text);
				if (!value) return null;
				const form = (value.match(/^(DBKW|DKW|EKW|ABW|IBW|EW|Kr)\b/i) ?? [])[1] ?? null;
				const numbers = value.match(/\b(49|54|60|S49|S54|UIC60)\b-?\s*(\d{2,5})?/i);
				const rail = numbers ? numbers[1].replace(/^(S|UIC)/i, "") : null;
				const radius = numbers?.[2] ? Number(numbers[2]) : (value.match(/(?:^|[\s-])(\d{3,5})-1:/) ?? [])[1] ? Number((value.match(/(?:^|[\s-])(\d{3,5})-1:/) ?? [])[1]) : null;
				const slope = (value.match(/1:(\d+(?:[.,]\d+)?)/) ?? [])[1] ?? null;
				return { text: value, form: form ? form.toUpperCase().replace("KR", "Kr") : null, rail, radius: Number.isFinite(radius) ? radius : null, slope: slope ? `1:${slope}` : null };
			}
			// Spitze, Stamm and Zweig of a Weiche from its three legs. Each leg:
			// away (unit vector from the Knoten along the leg), deviation (signed
			// angle in rad between that tangent and the chord to a point `length`
			// metres along, + to the left), length. The Spitze is the leg that
			// faces the other two; of those the Zweig bends more. The Zweig's
			// radius follows from chord against tangent: r = length / (2 · angle).
			function weichenRoles(legs) {
				if (!Array.isArray(legs) || legs.length !== 3) return { spitze: null, stamm: null, zweig: null };
				const dot = (a, b) => a.away.x * b.away.x + a.away.y * b.away.y;
				const spitze = legs.find((leg) => legs.filter((other) => other !== leg).every((other) => dot(leg, other) < -0.5) && dot(...legs.filter((other) => other !== leg)) > 0.5) ?? null;
				if (!spitze) return { spitze: null, stamm: null, zweig: null };
				const [a, b] = legs.filter((leg) => leg !== spitze);
				const bendA = Math.abs(a.deviation);
				const bendB = Math.abs(b.deviation);
				const zweig = bendA >= bendB ? a : b;
				const stamm = zweig === a ? b : a;
				const margin = Math.abs(bendA - bendB);
				const side = zweig.deviation - stamm.deviation > 0 ? "links" : "rechts";
				// The Zweig's radius relative to the Stamm (a Bogenweiche keeps its
				// Grundform's radius against its curved Stamm): κ = 2·angle/length.
				const curvature = (leg) => leg.length > 0 ? 2 * leg.deviation / leg.length : 0;
				const relative = Math.abs(curvature(zweig) - curvature(stamm));
				const radius = relative > 1e-6 ? 1 / relative : null;
				return { spitze, stamm, zweig, side, radius, certain: margin > 0.003 };
			}
			// A Gleis without a number of its own: GND writes Gleisnummer 0 for
			// a Weichenverbindung or an unnumbered Gleis (WueTreu: 149 of 897
			// Kanten, Billwerder 420), LIRA numbers connectors from 9000. Such a
			// Gleis is known by its Weichen, so the Spurplan prints no "Gleis 0"
			// on it and a Weiche's legs name the Knoten they lead to.
			function gndGleisNumber(name) {
				const match = /^Gleis (\d+)(?:\b|$)/.exec(name ?? "");
				return match ? Number(match[1]) : null;
			}
			function gndUnnumbered(name) {
				const number = gndGleisNumber(name);
				return number != null && (number === 0 || number >= 9000);
			}
			// A Gleisstrang lists whole Lage elements (Satzart 33), but a Weiche
			// is a point of its own (Satzart 31 PAD) and mostly sits inside an
			// element, not on its boundary: WueTreu W 321 and W 322 are 18 m
			// apart inside one 376 m Gerade of Gleis 2, Billwerder ADA_401 220 m
			// into a Gerade of Strecke 1150. So an edge's station at such a
			// Knoten is its point's station on the Gleis -- when the point lies on
			// the Gleis (tolerance) and within the strand's own elements (low..high,
			// a Kilometersprung may put it outside) -- else the element boundary.
			function gndKnotenStation(boundary, hit, low, high, tolerance = 1) {
				if (!hit || !Number.isFinite(hit.station) || !(hit.distance <= tolerance)) return boundary;
				const slack = 0.5;
				return hit.station >= Math.min(low, high) - slack && hit.station <= Math.max(low, high) + slack ? hit.station : boundary;
			}
			// A Knoten name without Betriebsstelle repeats within a delivery
			// (Billwerder: "_403" twice, 29 km apart, each with its own PAD and
			// Bauart). Each Satzart-31 row with a PAD of its own is a Knoten of its
			// own; a Gleisstrang naming the shared key means the one at its end.
			function gndNearestNode(candidates, point, pointOf) {
				if (!candidates?.length) return null;
				if (candidates.length === 1 || !point) return candidates[0];
				let best = null;
				for (const node of candidates) {
					const own = pointOf(node);
					const distance = own ? Math.hypot(own.easting - point.easting, own.northing - point.northing) : Infinity;
					if (!best || distance < best.distance) best = { node, distance };
				}
				return best.node;
			}
			// A far Gleisgruppe no placed Knoten leads to (WueTreu: the stubs of
			// the Ringlokschuppen, 33 m each, fanning from parallel to perpendicular
			// to Strecke 1733) is foreshortened by the perpendicular -- a stub
			// across the Strecke would be 2 m long on the band. So its km run along
			// the group's own main direction (principal axis of its points), from
			// the mean km of the group, in the sense in which the km grow across
			// the group; every Gleis keeps its length on the band.
			function gndGroupStations(points, kms) {
				const count = points.length;
				if (count < 2 || kms.length !== count) return kms.slice();
				const cx = points.reduce((sum, point) => sum + point.easting, 0) / count;
				const cy = points.reduce((sum, point) => sum + point.northing, 0) / count;
				let sxx = 0;
				let sxy = 0;
				let syy = 0;
				for (const point of points) {
					const dx = point.easting - cx;
					const dy = point.northing - cy;
					sxx += dx * dx;
					sxy += dx * dy;
					syy += dy * dy;
				}
				const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
				const ux = Math.cos(theta);
				const uy = Math.sin(theta);
				const along = points.map((point) => (point.easting - cx) * ux + (point.northing - cy) * uy);
				const km0 = kms.reduce((sum, km) => sum + km, 0) / count;
				const slope = along.reduce((sum, value, index) => sum + value * (kms[index] - km0), 0);
				const sign = slope < 0 ? -1 : 1;
				return along.map((value) => km0 + sign * value);
			}
			// A Weiche's leg ends at the next node of the graph; where that is a
			// seam of the data (Naht between two Gleise of one Gleisstrang, a
			// Gleis's Fortsetzung into the next Gleis, a Knick), the leg's target
			// is the Knoten beyond it: WueTreu W 38 reaches W 37 across the seam
			// of Strecke 5209 and 5910. A loop or a dead seam stops the walk.
			function gndLegTarget(other, edge, edgesAt) {
				let node = other;
				let via = edge;
				const seen = new Set([edge]);
				while (node && node.knotenTyp == null && (edgesAt.get(node) ?? []).length === 2) {
					const next = (edgesAt.get(node) ?? []).find((candidate) => candidate !== via);
					if (!next || seen.has(next)) break;
					seen.add(next);
					via = next;
					node = next.from === node ? next.to : next.from;
				}
				return node;
			}
			// Whether a Bauart's Stamm runs straight, so a leg's own bend tells
			// Stamm from Zweig against the declared Zweigradius: EW, and the halves
			// of a DKW or EKW (each a Weiche whose straight leg crosses the
			// Kreuzung), unless the text puts the Weiche into an Übergangsbogen
			// ("iU", "i.U.", "tlw. i.UB"). ABW, IBW and DBKW bend their Stamm.
			function gndStraightStamm(bauartInfo, text) {
				const form = bauartInfo?.form ?? null;
				if (![null, "EW", "DKW", "EKW"].includes(form)) return false;
				return !/i\.?U\b|i\.U\.|iU\b|zTiU|i\.UB/i.test(text ?? "");
			}
			// One leg against the Bauart's Zweigradius: its chord-to-tangent bend
			// gives r = length / (2 · angle); within 25 % of the declared radius it
			// is the Zweig, beyond twice the radius it is straight enough for the
			// Stamm, in between nothing is said.
			function gndLegByRadius(leg, declared) {
				if (!leg || !(declared > 0)) return null;
				const measured = leg.length > 0 && Math.abs(leg.deviation) > 1e-6 ? leg.length / (2 * Math.abs(leg.deviation)) : Infinity;
				if (Math.abs(measured - declared) / declared <= 0.25) return "zweig";
				if (measured > 2 * declared) return "stamm";
				return null;
			}
			// The Gleis a Gleisstrang (Satzart 33) belongs to: a Streckengleis by
			// Strecke and STRRIKZ (1 rechts, 2 links, 0/3 the Kilometerlinie), a
			// Bahnhofsgleis (STRRIKZ 4/5) by its number; a Verbindung ("Gleis 0")
			// belongs to no Gleis. Measured on five deliveries against the roles
			// from the Lage, this Gleis does not follow the Stamm: at 16 % of the
			// Weichen (WueTreu 78 of 405, ABW 23 of 93, EKW 8 of 21; Billwerder
			// 14 of 129) it runs on through the Zweig, the Stamm enters a
			// Verbindung or the other Streckengleis -- the number follows the
			// Fahrweg. So the through Gleis is a finding about the Gleis's
			// course, not a witness for Stamm and Zweig.
			function gndStrandGleis(row) {
				const strRikz = gndKey(row.STRRIKZ);
				if (["4", "5"].includes(strRikz)) {
					const number = gndKey(row.LIRA_GLSNR) || gndKey(row.GLEISNR) || gndKey(row.STRECKE);
					return number && number !== "0" ? { key: `G ${number}`, label: `Gleis ${number}` } : null;
				}
				const strecke = gndKey(row.STRECKE);
				if (!strecke) return null;
				return { key: `S ${strecke}/${strRikz}`, label: `Strecke ${strecke} · ${{ 1: "rechts", 2: "links" }[strRikz] ?? "Kilometerlinie"}` };
			}
			// Which neighbour the Spitze's Gleis runs on to: the one, and only
			// one, of KN1/KN2 whose strand carries the Gleis of the strand to
			// KN0. Two strands of one pair with different Gleise say nothing.
			function gndThroughGleis(gleise) {
				const [spitze, ...others] = gleise;
				if (!spitze?.key) return null;
				const hits = others.map((gleis, index) => gleis?.key === spitze.key ? index + 1 : -1).filter((index) => index > 0);
				return hits.length === 1 ? hits[0] : null;
			}
			// END GND TOPOLOGY
			const gndTableCache = new WeakMap();
			function gndTableRows(loaded, name) {
				if (!loaded) return [];
				let tables = gndTableCache.get(loaded);
				if (!tables) { tables = new Map(); gndTableCache.set(loaded, tables); }
				if (!tables.has(name)) {
					const table = loaded.sourceEnvelope?.tables?.find((candidate) => candidate.name === name);
					tables.set(name, (table?.rows ?? []).map((row) => Object.fromEntries((row.cells ?? []).map((cell) => [cell.columnName, cell.value]))));
				}
				return tables.get(name);
			}
			function gndDataTopology(gleise, polylineOf) {
				const nodes = [];
				const edges = [];
				const covered = new Set();
				const summary = { files: 0, strands: 0, strandsWithoutGleis: 0, samePoint: 0 };
				// Every Knoten of the data by its key, with the label it goes by --
				// the Outbox names a Weiche's neighbours without Lage through it.
				const knotenLabels = new Map();
				// Along a Gleis the topology measures by run (Lauflänge, see
				// referenceStationPolyline); the data's station at a run is kept on
				// arms and edges for what reads the Gleis's own frame (GWB speeds).
				const stationOfRun = (polyline, run) => {
					let index = polyline.findIndex((point) => point.run >= run);
					if (index < 0) return polyline[polyline.length - 1]?.station ?? null;
					if (index === 0) return polyline[0].station;
					const p = polyline[index - 1];
					const q = polyline[index];
					const t = q.run > p.run ? (run - p.run) / (q.run - p.run) : 0;
					return p.station + t * (q.station - p.station);
				};
				const unitAt = (entry, run, sign) => {
					const polyline = polylineOf(entry);
					if (polyline.length < 2) return { x: 1, y: 0 };
					let index = polyline.findIndex((point) => point.run >= run);
					if (index < 0) index = polyline.length - 1;
					index = Math.max(1, index);
					const p = polyline[index - 1];
					const q = polyline[index];
					const length = Math.hypot(q.easting - p.easting, q.northing - p.northing) || 1;
					return { x: sign * (q.easting - p.easting) / length, y: sign * (q.northing - p.northing) / length };
				};
				for (const [loaded, fileGleise] of groupBy(gleise.filter((entry) => entry.parser === "gndEdit"), (entry) => entry.loaded)) {
					const knRows = gndTableRows(loaded, "X_ASC31_KN");
					const gsRows = gndTableRows(loaded, "X_ASC33_GS");
					if (!knRows.length || !gsRows.length) continue;
					summary.files += 1;
					// Coordinates of a point address, per Lagesystem.
					const coordinates = new Map();
					for (const row of gndTableRows(loaded, "X_ASC12_PL")) {
						const easting = numberValue(row.Y);
						const northing = numberValue(row.X);
						if (!Number.isFinite(easting) || !Number.isFinite(northing)) continue;
						const pad = gndKey(row.PAD);
						if (!coordinates.has(pad)) coordinates.set(pad, new Map());
						coordinates.get(pad).set(gndKey(row.LSYS), { easting, northing });
					}
					// Every Lage element of the file's Gleise by its two point addresses.
					const elementOf = new Map();
					for (const entry of fileGleise) {
						(gndSequenceForEntry(entry)?.edgeChain ?? []).forEach((edge, index) => {
							const a = gndKey(edge.padA);
							const b = gndKey(edge.padB);
							elementOf.set(`${a}|${b}`, { entry, index, forward: true });
							if (!elementOf.has(`${b}|${a}`)) elementOf.set(`${b}|${a}`, { entry, index, forward: false });
						});
					}
					// Run of an element's start or end on its Gleis's polyline. Where the
					// element list and the point chain differ in length, or the element
					// has no points of its own (a Knick), the point is projected instead.
					const runAt = (entry, index, atEnd, pad) => {
						const elements = entry.item.payload.coordGeom.elements;
						const sequence = gndSequenceForEntry(entry);
						const polyline = polylineOf(entry);
						if (elements.length === (sequence?.edgeChain ?? []).length) {
							const own = polyline.filter((point) => point.element === index);
							if (own.length) return atEnd ? own[own.length - 1].run : own[0].run;
						}
						const point = coordinates.get(pad)?.get(gndKey(sequence?.lsys));
						return point ? distanceAndStationOnPolyline(polyline, point)?.run ?? null : null;
					};
					const pointAt = (entry, index, atEnd, pad) => {
						const element = entry.item.payload.coordGeom.elements[index];
						const own = (gndSequenceForEntry(entry)?.edgeChain ?? []).length === entry.item.payload.coordGeom.elements.length ? (atEnd ? element?.end : element?.start) : null;
						const point = own ?? coordinates.get(pad)?.get(gndKey(gndSequenceForEntry(entry)?.lsys));
						return point ? { easting: numberValue(point.easting), northing: numberValue(point.northing) } : null;
					};
					const fileNodes = new Map();
					const homonyms = new Map();
					const nodeOf = (key, mapKey = key) => {
						if (!fileNodes.has(mapKey)) {
							const tokens = key.split(" ");
							const node = { id: -1, point: null, arms: [], source: "daten", knoten: key, knotenName: tokens[tokens.length - 1], betriebsstelle: tokens.length > 1 ? tokens[0] : null, knotenTyp: null, bauart: null, pad: null };
							fileNodes.set(mapKey, node);
							nodes.push(node);
						}
						return fileNodes.get(mapKey);
					};
					// A strand's end names a Knoten; where the name is shared, the
					// Knoten at the strand's end point (gndNearestNode).
					const nodeAt = (key, point, lsys) => gndNearestNode(homonyms.get(key) ?? [nodeOf(key)], point, (node) => node.coordinates?.get(lsys) ?? null);
					for (const row of knRows) {
						const key = gndKey(row.KNOTEN);
						if (!key) continue;
						const pad = gndKey(row.PAD) || null;
						let node = nodeOf(key);
						if (node.knotenTyp != null && pad && node.pad && node.pad !== pad) {
							// A second Satzart-31 row under the same name with a PAD of its
							// own: a Knoten of its own.
							if (!homonyms.has(key)) homonyms.set(key, [node]);
							node = nodeOf(key, `${key}#${pad}`);
							if (!homonyms.get(key).includes(node)) homonyms.get(key).push(node);
						}
						node.knotenTyp = Number(row.KNTYP);
						node.bauart = gndKey(row.KNBE) || null;
						node.pad = pad;
						node.coordinates = coordinates.get(node.pad) ?? null;
						if (!knotenLabels.has(key)) knotenLabels.set(key, gndKnotenLabel(node) ?? (node.knotenTyp === 2 ? `Gleisende ${node.knotenName}` : node.knotenTyp === 3 ? `Fortsetzung ${node.knotenName}` : node.knotenName));
						// KN0..KN3: the neighbouring Knoten, in the data's order.
						node.neighbours = ["KN0", "KN1", "KN2", "KN3"].map((column) => gndKey(row[column]) || null);
					}
					const lists = new Map();
					for (const row of gndTableRows(loaded, "X_ASC33_GS_L")) {
						const key = String(row.ParseLfdNr);
						if (!lists.has(key)) lists.set(key, []);
						lists.get(key).push({ order: Number(row.LfdNr), pad: gndKey(row.L) });
					}
					// The Gleis of every strand by its pair of Knoten, Lage or not
					// (gndStrandGleis); a pair with two different Gleise is ambiguous.
					const strandGleis = new Map();
					for (const row of gsRows) {
						const fromKey = gndKey(row.AKNOTEN);
						const toKey = gndKey(row.EKNOTEN);
						if (!fromKey || !toKey) continue;
						summary.strands += 1;
						const gleisOf = gndStrandGleis(row);
						for (const pair of [`${fromKey}|${toKey}`, `${toKey}|${fromKey}`]) {
							const known = strandGleis.get(pair);
							if (known === undefined || (known === null && gleisOf)) strandGleis.set(pair, gleisOf);
							else if (known && gleisOf && known.key !== gleisOf.key) strandGleis.set(pair, { key: null, label: null, ambiguous: true });
						}
						const pads = (lists.get(String(row.ParseLfdNr)) ?? []).sort((a, b) => a.order - b.order).map((item) => item.pad);
						const portions = gndStrandPortions(pads, elementOf);
						if (!portions.length) { summary.strandsWithoutGleis += 1; continue; }
						// A Bahnhofsgleis is numbered in the Gleisstrang (STRRIKZ 4/5:
						// STRECKE holds the Gleisnummer), often where the points only
						// say "Gleis 0".
						const strRikz = gndKey(row.STRRIKZ);
						const number = gndKey(row.LIRA_GLSNR) || gndKey(row.GLEISNR) || gndKey(row.STRECKE);
						const strand = { strecke: gndKey(row.STRECKE), strRikz, text: gndKey(row.GTEXT) || null, name: ["4", "5"].includes(strRikz) && number && number !== "0" ? `Gleis ${number}` : null };
						portions.forEach((portion, index) => {
							let runFrom = runAt(portion.entry, portion.firstIndex, !portion.forward, portion.fromPad);
							let runTo = runAt(portion.entry, portion.lastIndex, portion.forward, portion.toPad);
							if (runFrom == null || runTo == null) return;
							const fromPoint = pointAt(portion.entry, portion.firstIndex, !portion.forward, portion.fromPad);
							const toPoint = pointAt(portion.entry, portion.lastIndex, portion.forward, portion.toPad);
							const lsys = gndKey(gndSequenceForEntry(portion.entry)?.lsys);
							// Between two Gleise of one Gleisstrang sits a seam, not a Knoten
							// of the data.
							const from = index === 0 ? nodeAt(fromKey, fromPoint, lsys) : nodeOf(`Naht ${portion.fromPad}`);
							const to = index === portions.length - 1 ? nodeAt(toKey, toPoint, lsys) : nodeOf(`Naht ${portion.toPad}`);
							for (const [node, fallback] of [[from, fromPoint], [to, toPoint]]) {
								if (node.point) continue;
								const own = node.pad ? coordinates.get(node.pad)?.get(lsys) : null;
								node.point = own ?? fallback;
							}
							// The strand's elements are whole; the edge ends where the Knoten's
							// own point meets the Gleis (gndKnotenStation, by run).
							const polyline = polylineOf(portion.entry);
							const [boundaryFrom, boundaryTo] = [runFrom, runTo];
							const knotenRun = (node, boundary) => {
								const own = node.pad ? coordinates.get(node.pad)?.get(lsys) : null;
								const hit = own ? distanceAndStationOnPolyline(polyline, own) : null;
								return hit ? gndKnotenStation(boundary, { distance: hit.distance, station: hit.run }, boundaryFrom, boundaryTo, TOPOLOGY_TOLERANCE_M) : boundary;
							};
							const refinedFrom = knotenRun(from, runFrom);
							const refinedTo = knotenRun(to, runTo);
							if (Math.abs(refinedTo - refinedFrom) >= TOPOLOGY_TOLERANCE_M || Math.abs(runTo - runFrom) < TOPOLOGY_TOLERANCE_M) {
								runFrom = refinedFrom;
								runTo = refinedTo;
							} else {
								// Two Weichen Spitze an Spitze share one point in the data
								// (WueTreu W 125/W 126: PAD 41251 and 41261 at one place, the
								// Gleisstrang between them 89 m of Lage). The point cannot say
								// where on this strand each Knoten sits, so the strand's own
								// elements do, as before; the Outbox names the pair.
								if (!from.samePoint && !to.samePoint) summary.samePoint += 1;
								from.samePoint ??= to;
								to.samePoint ??= from;
							}
							const direction = runTo >= runFrom ? 1 : -1;
							from.arms.push({ entry: portion.entry, station: stationOfRun(polyline, runFrom), run: runFrom, atStart: runFrom < 1e-6, away: unitAt(portion.entry, runFrom, direction) });
							to.arms.push({ entry: portion.entry, station: stationOfRun(polyline, runTo), run: runTo, atStart: runTo < 1e-6, away: unitAt(portion.entry, runTo, -direction) });
							edges.push({ id: -1, entry: portion.entry, from, to, stationFrom: stationOfRun(polyline, runFrom), stationTo: stationOfRun(polyline, runTo), runFrom, runTo, part: "", source: "daten", strand, name: strand.name });
							covered.add(portion.entry);
						});
					}
					// The Spitze's Gleis (strand to KN0) and the neighbour it runs on to.
					for (const node of fileNodes.values()) {
						if (!node.neighbours) continue;
						const gleise = node.neighbours.slice(0, 3).map((key) => key ? strandGleis.get(`${node.knoten}|${key}`) ?? null : null);
						const through = gndThroughGleis(gleise);
						node.through = through ? { gleis: gleise[0], to: node.neighbours[through], via: null } : null;
					}
				}
				// A Gleis runs on where the Gleisstränge end: a Bahnhof's file names
				// the Knoten of the Bahnhof, its Streckengleis goes on for
				// kilometres. Those stretches -- before the first Knoten, after the
				// last, between two Gleisstränge that leave a gap -- stay edges of
				// the Gleis; their open ends meet like any two Gleis ends do.
				const restEnds = [];
				const restEndAt = (point) => {
					let node = restEnds.find((candidate) => Math.hypot(candidate.point.easting - point.easting, candidate.point.northing - point.northing) <= TOPOLOGY_TOLERANCE_M);
					if (!node) {
						node = { id: -1, point: { easting: point.easting, northing: point.northing }, arms: [], source: "daten", knoten: null, knotenTyp: null, bauart: null, pad: null };
						restEnds.push(node);
						nodes.push(node);
					}
					return node;
				};
				for (const [entry, own] of groupBy(edges, (edge) => edge.entry)) {
					const polyline = polylineOf(entry);
					if (polyline.length < 2) continue;
					const spans = own.map((edge) => edge.runFrom <= edge.runTo ? { low: edge.runFrom, high: edge.runTo, lowNode: edge.from, highNode: edge.to } : { low: edge.runTo, high: edge.runFrom, lowNode: edge.to, highNode: edge.from }).sort((a, b) => a.low - b.low);
					const first = polyline[0];
					const last = polyline[polyline.length - 1];
					const rest = (fromNode, fromRun, toNode, toRun) => {
						fromNode.arms.push({ entry, station: stationOfRun(polyline, fromRun), run: fromRun, atStart: fromRun < 1e-6, away: unitAt(entry, fromRun, 1) });
						toNode.arms.push({ entry, station: stationOfRun(polyline, toRun), run: toRun, atStart: false, away: unitAt(entry, toRun, -1) });
						edges.push({ id: -1, entry, from: fromNode, to: toNode, stationFrom: stationOfRun(polyline, fromRun), stationTo: stationOfRun(polyline, toRun), runFrom: fromRun, runTo: toRun, part: "", source: "rest" });
					};
					if (spans[0].low - first.run > 1) rest(restEndAt(first), first.run, spans[0].lowNode, spans[0].low);
					let reached = spans[0];
					for (const span of spans.slice(1)) {
						if (span.low - reached.high > 1) rest(reached.highNode, reached.high, span.lowNode, span.low);
						if (span.high > reached.high) reached = span;
					}
					if (last.run - reached.high > 1) rest(reached.highNode, reached.high, restEndAt(last), last.run);
				}
				// A Knoten no Gleisstrang with a Lage reaches has no place in the plan
				// by itself; it may still name a Weiche the geometry finds (see
				// computeTopology).
				const unplaced = nodes.filter((node) => node.knotenTyp != null && !node.arms.length && node.pad && node.coordinates?.size);
				const placed = nodes.filter((node) => node.point && node.arms.length);
				for (const node of placed) {
					const seen = new Map();
					for (const arm of node.arms) seen.set(arm.entry, (seen.get(arm.entry) ?? 0) + 1);
					for (const arm of node.arms) if (seen.get(arm.entry) > 1) arm.through = true;
					// Satzart 31 calls an Achsende a Gleisende too; where a second
					// Gleisstrang goes on from it, it is a seam.
					node.kind = node.knotenTyp == null ? (node.arms.length === 1 ? "Ende" : node.arms.length === 2 ? "Fortsetzung" : "Knoten")
						: node.knotenTyp === 2 ? (node.arms.length === 1 ? "Ende" : node.arms.length === 2 ? "Fortsetzung" : "Knoten")
						: GND_KNOTEN_KINDS[node.knotenTyp] ?? "Knoten";
					node.label = gndKnotenLabel(node);
					// Second witness: the Knoten's own point against the Gleise the
					// data hangs on it. A Weiche lies on its Gleise.
					if (node.knotenTyp != null) {
						node.gap = 0;
						for (const entry of new Set(node.arms.map((arm) => arm.entry))) {
							const hit = distanceAndStationOnPolyline(polylineOf(entry), node.point);
							// gapAtEnd: the Gleis's Lage stops short of the Knoten (Eifel
							// W 130B: Gleis 46 ends 451 m before it) rather than passing beside it.
							if (hit && hit.distance > node.gap) { node.gap = hit.distance; node.gapEntry = entry; node.gapAtEnd = Boolean(hit.atEnd); }
						}
					}
				}
				// "2/5": the Gleis's second Gleisstrang of five, in station order.
				for (const [, own] of groupBy(edges, (edge) => edge.entry)) {
					if (own.length < 2) continue;
					own.sort((a, b) => Math.min(a.runFrom, a.runTo) - Math.min(b.runFrom, b.runTo)).forEach((edge, index) => { edge.part = `${index + 1}/${own.length}`; });
				}
				return { nodes: placed, edges, covered, summary, unplaced, knotenLabels };
			}
			// The name a Weiche or Kreuzung goes by: from the data's Knoten, else
			// from a Gleis named after it (VermEsn: W403-404, DKW503, EKW410).
			// How an edge is called: its Gleisstrang's name, else its Gleis's; a
			// Gleis without a number (0, LIRA ≥ 9000) by what it is -- a
			// Verbindung between two Weichen, else a Gleis ohne Nummer.
			function node_form(item) { return item.bauartInfo?.form ? `${item.bauartInfo.form} (Kreuzungsweiche)` : "Kreuzungsweiche"; }
			function edgeLabelOf(edge) {
				const name = edge.name ?? objectDisplayName(edge.entry);
				if (!gndUnnumbered(name)) return name;
				const junction = (node) => node.kind === "Weiche" || node.kind === "Kreuzung";
				return `${junction(edge.from) && junction(edge.to) ? "Verbindung" : "Gleis ohne Nummer"} (${name.replace(" · Nebengleis", "")})`;
			}
			// A Weiche's leg: the Gleis's name, or, without a number, the Knoten it leads to.
			function legLabelOf(leg) {
				const name = leg.edge.name ?? objectDisplayName(leg.entry);
				if (!gndUnnumbered(name)) return name;
				return `→ ${leg.target?.label ?? leg.other?.label ?? leg.other?.kind ?? name}`;
			}

			function junctionLabelOf(node) {
				return node.label ?? node.names?.find((candidate) => /^(W|DKW|EKW|ABW|IBW)\s*-?\d/i.test(candidate)) ?? null;
			}

			function computeTopology() {
				const alignments = allViewerEntries().filter((entry) => entry.item.kind === "alignment" && alignmentEndpoints(entry));
				const gleise = alignments.filter((entry) => sevenLineSide(entry) !== "kilometer");
				const kmLineAxes = alignments.filter((entry) => sevenLineSide(entry) === "kilometer").map((entry) => ({ entry, polyline: referenceStationPolyline(entry, 5) })).filter((axis) => axis.polyline.length > 1);
				const kmLines = kmLineAxes.map((axis) => axis.polyline);
				const polylines = new Map();
				const longest = gleise.map((entry) => ({ entry, length: Math.abs(numberValue(stationRangeForEntry(entry)?.to) - numberValue(stationRangeForEntry(entry)?.from)) || 0 })).sort((a, b) => b.length - a.length)[0];
				const references = kmLines.length ? kmLines : longest ? [referenceStationPolyline(longest.entry, 5)] : [];
				const referenceGrids = kmLines.length ? kmLines.map((polyline) => lageGrid(polyline)) : null;
				// Which axis gave a node its km, so the main Spurplan can draw one
				// band per Strecke instead of mixing every Strecke's km on one x.
				const axisEntries = kmLines.length ? kmLineAxes.map((axis) => axis.entry) : longest ? [longest.entry] : [];
				const axes = axisEntries.map((entry, index) => {
					const track = deliveryTrackOf(entry);
					return { index, entry, track, label: track && isValidRouteNumber(track) ? `Strecke ${track}` : `Achse ${objectDisplayName(entry)}` };
				});
				const polylineOf = (entry) => {
					if (!polylines.has(entry)) polylines.set(entry, referenceStationPolyline(entry, 2));
					return polylines.get(entry);
				};
				// What the data says comes first; the geometry answers for the rest.
				const data = gndDataTopology(gleise, polylineOf);
				const computed = gleise.filter((entry) => !data.covered.has(entry));
				const close = (a, b) => Math.hypot(a.easting - b.easting, a.northing - b.northing) <= TOPOLOGY_TOLERANCE_M;
				const unit = (from, to) => {
					const length = Math.hypot(to.easting - from.easting, to.northing - from.northing) || 1;
					return { x: (to.easting - from.easting) / length, y: (to.northing - from.northing) / length };
				};
				const nodes = [];
				const nodeFor = (point) => {
					let node = nodes.find((candidate) => close(candidate.point, point));
					if (!node) {
						node = { id: nodes.length, point: { easting: point.easting, northing: point.northing }, arms: [] };
						nodes.push(node);
					}
					return node;
				};
				// 1. Every end: its node, its tangent away from the node, and whether it
				//    lies on another Gleis away from that Gleis's ends (a cut there).
				const cuts = new Map();
				for (const gleis of computed) {
					const polyline = polylineOf(gleis);
					if (polyline.length < 2) continue;
					const ends = alignmentEndpoints(gleis);
					for (const [end, atStart] of [[ends.start, true], [ends.end, false]]) {
						const node = nodeFor(end);
						const [p, q] = atStart ? [polyline[0], polyline[1]] : [polyline[polyline.length - 1], polyline[polyline.length - 2]];
						node.arms.push({ entry: gleis, atStart, station: p.station, run: p.run, away: unit(p, q) });
						for (const other of computed) {
							if (other === gleis) continue;
							const otherEnds = alignmentEndpoints(other);
							if (close(otherEnds.start, end) || close(otherEnds.end, end)) continue;
							const hit = distanceAndStationOnPolyline(polylineOf(other), end);
							if (!hit || hit.distance > TOPOLOGY_TOLERANCE_M) continue;
							if (!cuts.has(other)) cuts.set(other, []);
							if (!cuts.get(other).some((cut) => cut.node === node)) cuts.get(other).push({ station: hit.station, run: hit.run, node });
						}
					}
				}
				// 2. Edges: each Gleis between its ends and its cuts; a cut gives the
				//    node the through Gleis's two tangents.
				const edges = [];
				for (const gleis of computed) {
					const polyline = polylineOf(gleis);
					if (polyline.length < 2) continue;
					const ends = alignmentEndpoints(gleis);
					const stops = [
						{ station: polyline[0].station, run: polyline[0].run, node: nodeFor(ends.start) },
						...(cuts.get(gleis) ?? []).sort((a, b) => a.run - b.run),
						{ station: polyline[polyline.length - 1].station, run: polyline[polyline.length - 1].run, node: nodeFor(ends.end) },
					];
					for (let index = 0; index + 1 < stops.length; index += 1) {
						edges.push({ id: edges.length, entry: gleis, from: stops[index].node, to: stops[index + 1].node, stationFrom: stops[index].station, stationTo: stops[index + 1].station, runFrom: stops[index].run, runTo: stops[index + 1].run, part: stops.length > 2 ? `${index + 1}/${stops.length - 1}` : "" });
					}
					for (const cut of cuts.get(gleis) ?? []) {
						const index = Math.max(1, polyline.findIndex((point) => point.run >= cut.run));
						const dir = unit(polyline[index - 1], polyline[index]);
						cut.node.arms.push({ entry: gleis, through: true, station: cut.station, away: dir }, { entry: gleis, through: true, station: cut.station, away: { x: -dir.x, y: -dir.y } });
					}
				}
				// A file whose Gleisstränge list no points (Billwerder 6100, issue of
				// 2024-11) still names its Knoten: one whose point sits on a computed
				// node gives that node its number and Bauart.
				let namedFromData = 0;
				for (const knoten of data.unplaced) {
					if (knoten.knotenTyp !== 1 && knoten.knotenTyp !== 4) continue;
					let best = null;
					for (const node of nodes) {
						if (node.label) continue;
						const lsys = gndKey(gndSequenceForEntry(node.arms[0]?.entry)?.lsys);
						const point = knoten.coordinates.get(lsys);
						if (!point) continue;
						const distance = Math.hypot(point.easting - node.point.easting, point.northing - node.point.northing);
						if (distance <= GND_KNOTEN_MATCH_M && (!best || distance < best.distance)) best = { node, distance };
					}
					if (!best) continue;
					Object.assign(best.node, { label: gndKnotenLabel(knoten), bauart: knoten.bauart, knoten: knoten.knoten, knotenName: knoten.knotenName, named: "daten" });
					namedFromData += 1;
				}
				// 3. Kinds, km, names. The data's nodes bring their kind along.
				nodes.unshift(...data.nodes);
				edges.unshift(...data.edges);
				nodes.forEach((node, index) => { node.id = index; });
				edges.forEach((edge, index) => { edge.id = index; });
				for (const node of nodes) {
					const arms = node.arms;
					let throughPairs = 0;
					for (let i = 0; i < arms.length; i += 1) for (let j = i + 1; j < arms.length; j += 1) {
						if (arms[i].away.x * arms[j].away.x + arms[i].away.y * arms[j].away.y < TOPOLOGY_TANGENT_COS) throughPairs += 1;
					}
					node.degree = arms.length;
					if (node.source !== "daten") node.kind = arms.length === 1 ? "Ende" : arms.length === 2 ? (throughPairs ? "Fortsetzung" : "Knick") : arms.length === 3 ? "Weiche" : arms.length === 4 && throughPairs >= 2 ? "Kreuzung" : "Knoten";
					// The Spurplan's axis: the nearest Kilometerlinie; a batch without one
					// (VermEsn) takes its longest Gleis, so x and rows still share one
					// frame. offset is the signed distance from that axis (+ = left in
					// its direction), the row grouping happens below.
					let best = null;
					references.forEach((reference, axisIndex) => {
						// Kilometerlinien are looked up through the Lage grid (its reach
						// is the km reach); a Gleis standing in as the axis reaches farther.
						const hit = referenceGrids ? lageOffset(reference, node.point, referenceGrids[axisIndex]) : distanceAndStationOnPolyline(reference, node.point);
						if (hit && (!best || hit.distance < best.distance)) best = { ...hit, axisIndex };
					});
					const within = best && best.distance <= (kmLines.length ? TOPOLOGY_KM_MAX_DISTANCE_M : TOPOLOGY_AXIS_MAX_DISTANCE_M);
					node.km = within ? best.station : null;
					node.offset = within ? best.side * best.distance : null;
					node.axis = within ? best.axisIndex : null;
					node.names = [...new Set(arms.map((arm) => objectDisplayName(arm.entry)))];
				}
				// 3b. Far Knoten. A Gleisgruppe 60-150 m beside the Strecke (WueTreu:
				// 121 of 756 Knoten, 105 of them Gleisenden) had no km so far. Its
				// Gleise say which Strecke it belongs to: a Knoten with a placed
				// neighbour takes that neighbour's axis and its km from the foot of
				// the perpendicular onto it, chain by chain into the yard; a group
				// without any placed Knoten takes the nearest Kilometerlinie within
				// TOPOLOGY_KM_FAR_M. Both carry node.far (the distance) and
				// node.farVia, and the Outbox says so.
				if (kmLines.length) {
					const farHit = (axisIndex, point) => {
						const hit = lageOffset(references[axisIndex], point);
						return hit && !hit.atEnd && hit.distance <= TOPOLOGY_KM_FAR_M ? hit : null;
					};
					const place = (node, hit, axisIndex, via) => Object.assign(node, { km: hit.station, offset: hit.side * hit.distance, axis: axisIndex, far: hit.distance, farVia: via });
					let grew = true;
					while (grew) {
						grew = false;
						for (const edge of edges) {
							for (const [here, there] of [[edge.from, edge.to], [edge.to, edge.from]]) {
								if (here.km != null || there.km == null) continue;
								const hit = farHit(there.axis, here.point);
								if (!hit) continue;
								place(here, hit, there.axis, "nachbar");
								grew = true;
							}
						}
					}
					for (const node of nodes) {
						if (node.km != null) continue;
						let best = null;
						references.forEach((reference, axisIndex) => {
							const hit = farHit(axisIndex, node.point);
							if (hit && (!best || hit.distance < best.distance)) best = { hit, axisIndex };
						});
						if (best) place(node, best.hit, best.axisIndex, "linie");
					}
					// A group of such Knoten on one axis, joined by Gleise among
					// themselves only, lies on the band along its own main direction
					// (gndGroupStations), not foreshortened by the perpendicular.
					const grouped = new Set();
					for (const start of nodes) {
						if (start.farVia !== "linie" || grouped.has(start)) continue;
						const group = [start];
						grouped.add(start);
						for (let index = 0; index < group.length; index += 1) {
							for (const edge of edges) {
								for (const [here, there] of [[edge.from, edge.to], [edge.to, edge.from]]) {
									if (here !== group[index] || there.farVia !== "linie" || there.axis !== start.axis || grouped.has(there)) continue;
									grouped.add(there);
									group.push(there);
								}
							}
						}
						if (group.length < 2) continue;
						const stations = gndGroupStations(group.map((node) => node.point), group.map((node) => node.km));
						group.forEach((node, index) => { node.km = stations[index]; node.farVia = "gruppe"; });
					}
				}
				// A data node's Gleise go by their Gleisstrang's name where it has one.
				for (const edge of data.edges) {
					if (!edge.name) continue;
					for (const node of [edge.from, edge.to]) node.names = [...new Set(node.names.map((name) => name === objectDisplayName(edge.entry) ? edge.name : name))];
				}
				const fromData = data.nodes.length || namedFromData ? { ...data.summary, nodes: data.nodes.filter((node) => node.knotenTyp != null).length, gleise: data.covered.size, named: namedFromData, offGleis: data.nodes.filter((node) => node.gap > TOPOLOGY_TOLERANCE_M).length } : null;
				// An edge has a row of its own: the offset of its middle stretch from
				// the axis (median of five samples between 20 and 80 % of its
				// length). A Weiche sits on the Stammgleis, so a node's offset is
				// the Stammgleis's; the Gleis that leaves it runs on its own row
				// after the Weiche, and the plan draws it there with a short
				// diagonal at each end instead of one long slant between the nodes.
				const offsetAt = (axisIndex, point) => {
					const reference = references[axisIndex];
					if (!reference) return null;
					let hit = referenceGrids ? lageOffset(reference, point, referenceGrids[axisIndex]) : distanceAndStationOnPolyline(reference, point);
					// Beyond the grid's reach (a far Knoten's Gleis) the whole line answers.
					if (!hit && referenceGrids) hit = lageOffset(reference, point);
					if (!hit || hit.distance > (kmLines.length ? TOPOLOGY_KM_FAR_M : TOPOLOGY_AXIS_MAX_DISTANCE_M)) return null;
					return hit.side * hit.distance;
				};
				for (const edge of edges) {
					edge.offset = null;
					const axisIndex = edge.from.axis ?? edge.to.axis;
					if (axisIndex == null) continue;
					const polyline = polylineOf(edge.entry);
					const low = Math.min(edge.runFrom, edge.runTo);
					const high = Math.max(edge.runFrom, edge.runTo);
					if (polyline.length < 2 || high - low < 1) continue;
					const samples = [];
					for (const fraction of [0.2, 0.35, 0.5, 0.65, 0.8]) {
						const target = low + fraction * (high - low);
						let index = polyline.findIndex((point) => point.run >= target);
						if (index < 0) index = polyline.length - 1;
						const offset = offsetAt(axisIndex, polyline[index]);
						if (offset != null) samples.push(offset);
					}
					if (samples.length < 3) continue;
					samples.sort((a, b) => a - b);
					edge.offset = samples[Math.floor(samples.length / 2)];
				}
				// Rows: the offsets of nodes and edges sorted and split where a gap
				// exceeds half a Gleisabstand -- 4,0 and 4,5 m spacing and curved
				// yards all land in their own row without a fixed raster. Row 0 is
				// the axis's row, larger rows lie to the left of the axis direction.
				// Rows are counted per Strecke (the band that draws them): a yard
				// 150 m beside Strecke A must not open twenty empty rows in the
				// band of Strecke B whose own Gleise fill those offsets.
				const placed = nodes.filter((node) => node.offset != null);
				const rowed = [...placed, ...edges.filter((edge) => edge.offset != null)];
				const bandOf = (item) => axes[item.axis ?? item.from?.axis ?? item.to?.axis]?.label ?? "";
				for (const [, items] of groupBy(rowed, bandOf)) {
					items.sort((a, b) => a.offset - b.offset);
					let rowIndex = -1;
					let rowLast = null;
					let axisRow = 0;
					for (const item of items) {
						if (rowLast == null || item.offset - rowLast > TOPOLOGY_ROW_GAP_M) rowIndex += 1;
						item.row = rowIndex;
						rowLast = item.offset;
						if (Math.abs(item.offset) < TOPOLOGY_ROW_GAP_M && axisRow === 0) axisRow = rowIndex;
					}
					for (const item of items) item.row -= axisRow;
				}
				// Spitze, Stamm, Zweig of every Weiche the data names: from the
				// geometry of its three legs, 25 m along each; the Bauart's radius
				// is the second witness for the Zweig.
				const legLength = 25;
				const edgesAt = new Map();
				for (const edge of edges) {
					for (const node of [edge.from, edge.to]) {
						if (!edgesAt.has(node)) edgesAt.set(node, []);
						edgesAt.get(node).push(edge);
					}
				}
				for (const node of placed) {
					if (node.knotenTyp !== 1 || node.kind !== "Weiche") continue;
					const legs = [];
					for (const edge of edgesAt.get(node) ?? []) {
						const atFrom = edge.from === node;
						const runHere = atFrom ? edge.runFrom : edge.runTo;
						const runThere = atFrom ? edge.runTo : edge.runFrom;
						const polyline = polylineOf(edge.entry);
						// The leg follows the Gleis for 25 m, past a near neighbour too
						// (WueTreu W 208 and W 209 are 4.8 m apart on Strecke 5321): the
						// Gleis's own geometry gives the tangent and the bend.
						const length = legLength;
						if (polyline.length < 2 || Math.abs(runThere - runHere) < TOPOLOGY_TOLERANCE_M) continue;
						// Tangent and chord in the leg's own direction (a Streckengleis
						// has two legs at one Weiche, one each way). The point of the
						// Weiche is found by run; a seam repeats a run at two indices,
						// there the point nearer the Knoten's own point wins.
						const forwardLeg = runThere >= runHere;
						let here = 0;
						let bestGap = Infinity;
						for (let index = 0; index < polyline.length; index += 1) {
							const gap = Math.abs(polyline[index].run - runHere);
							if (gap > bestGap + 1e-6) continue;
							const near = Math.hypot(polyline[index].easting - node.point.easting, polyline[index].northing - node.point.northing);
							const nearBest = Math.hypot(polyline[here].easting - node.point.easting, polyline[here].northing - node.point.northing);
							if (gap < bestGap - 1e-6 || near < nearBest) { here = index; bestGap = gap; }
						}
						const step = forwardLeg ? 1 : -1;
						// Element seams repeat a point; the tangent needs a real step.
						let next = here + step;
						while (next >= 0 && next < polyline.length && Math.hypot(polyline[next].easting - polyline[here].easting, polyline[next].northing - polyline[here].northing) < 0.01) next += step;
						if (next < 0 || next >= polyline.length) continue;
						const away = unit(polyline[here], polyline[next]);
						let walked = 0;
						let at = here;
						while (walked < length && at + step >= 0 && at + step < polyline.length) {
							walked += Math.hypot(polyline[at + step].easting - polyline[at].easting, polyline[at + step].northing - polyline[at].northing);
							at += step;
						}
						if (walked < 5) continue;
						// Chord from the leg's own end: a Gleisstrang may end a Weichenlänge
						// from the Knoten's point.
						const sample = polyline[at];
						const dx = sample.easting - polyline[here].easting;
						const dy = sample.northing - polyline[here].northing;
						const chord = Math.hypot(dx, dy) || 1;
						const deviation = Math.atan2(away.x * dy / chord - away.y * dx / chord, away.x * dx / chord + away.y * dy / chord);
						const other = atFrom ? edge.to : edge.from;
						// target: the Knoten the leg reaches, seams of the data crossed (gndLegTarget).
						legs.push({ edge, entry: edge.entry, other, target: gndLegTarget(other, edge, edgesAt), away, deviation, length: chord, sample: { easting: sample.easting, northing: sample.northing } });
					}
					// Two Strecken on one track (WueTreu: 5321 and 5902 through Treuchtlingen)
					// give a Weiche the same leg twice, one per Streckengleis: same
					// point 25 m out and same bend. Stamm and Zweig of a flat Weiche are
					// not that -- an EW 1200 puts its Zweig only 0.26 m beside the Stamm
					// at 25 m, but bends it by 0.010. One leg per track, the one with the
					// Knoten the data names as a neighbour (KN0..KN3), else the nearer.
					const targetKey = (leg) => leg.target?.knoten ?? null;
					const named = (leg) => node.neighbours?.includes(targetKey(leg)) ? 0 : 1;
					legs.sort((a, b) => named(a) - named(b) || Math.abs(a.edge.runTo - a.edge.runFrom) - Math.abs(b.edge.runTo - b.edge.runFrom));
					const distinct = [];
					for (const leg of legs) {
						if (distinct.some((kept) => Math.abs(kept.deviation - leg.deviation) < 0.001 && Math.hypot(kept.sample.easting - leg.sample.easting, kept.sample.northing - leg.sample.northing) < 0.3)) continue;
						distinct.push(leg);
					}
					node.legs = distinct;
					node.bauartInfo = gndBauart(node.bauart);
					node.roles = weichenRoles(distinct);
					// The data's own word on the Spitze: KN0 of Satzart 31 is the
					// neighbour at the Spitze (Lüneburg 165 of 165, Eifel 123 of 123,
					// WueTreu 432 of 432 Weichen with roles from the Lage; KN1/KN2
					// are Stamm and Zweig in no fixed order). So the Lage's Spitze is
					// checked against KN0, and a Weiche at the edge of the delivery,
					// without three legs with Lage, still gets its Spitze from the
					// data. A leg that reaches KN1 or KN2 is Stamm or Zweig; which
					// one, the Bauart's Zweigradius says where the Stamm runs straight
					// (gndStraightStamm, gndLegByRadius) -- EW, and the halves of a
					// DKW or EKW (Lüneburg G_87B: the straight leg across the
					// Kreuzung to G_87D is its Stamm).
					node.spitzeData = node.neighbours?.[0] ?? null;
					node.spitzeCheck = null;
					if (node.neighbours?.some(Boolean)) {
						const dataLeg = node.spitzeData ? legs.find((leg) => targetKey(leg) === node.spitzeData) ?? null : null;
						if (node.roles.spitze) node.spitzeCheck = !node.spitzeData ? null : targetKey(node.roles.spitze) === node.spitzeData ? "belegt" : dataLeg ? "abweichend" : "offen";
						else {
							// Only a leg the data lists as a neighbour other than KN0 is
							// Stamm or Zweig for sure; one ending where the Lage stops
							// could still be the Spitze's. Without a KN0 (Lüneburg W 2108)
							// the Stamm may still be told, the Spitze stays open.
							const others = node.neighbours.slice(1).filter(Boolean);
							const rest = distinct.filter((leg) => leg !== dataLeg && others.includes(targetKey(leg)));
							const declared = node.bauartInfo?.radius;
							const byRadius = (leg) => declared && gndStraightStamm(node.bauartInfo, node.bauart) ? gndLegByRadius(leg, declared) : null;
							let stamm = null;
							let zweig = null;
							if (rest.length === 1) {
								const kind = byRadius(rest[0]);
								if (kind === "zweig") zweig = rest[0];
								else if (kind === "stamm") stamm = rest[0];
							} else if (rest.length === 2) {
								const kinds = rest.map(byRadius);
								if (kinds[0] === "zweig" && kinds[1] === "stamm") [zweig, stamm] = rest;
								else if (kinds[0] === "stamm" && kinds[1] === "zweig") [stamm, zweig] = rest;
							}
							if (dataLeg || stamm || zweig) {
								node.roles = { spitze: dataLeg, stamm, zweig, side: stamm && zweig ? null : zweig ? (zweig.deviation > 0 ? "links" : "rechts") : null, radius: null, certain: true, fromData: true, kreuzung: /KW$/.test(node.bauartInfo?.form ?? ""), straightStamm: gndStraightStamm(node.bauartInfo, node.bauart) };
								node.spitzeCheck = node.spitzeData ? "daten" : null;
							}
						}
					}
					// The Spitze's Gleis runs on to one neighbour (gndThroughGleis);
					// by the Lage's roles that is the Stamm or the Zweig.
					if (node.through) {
						const to = node.through.to;
						node.through.via = node.roles?.stamm && targetKey(node.roles.stamm) === to ? "stamm" : node.roles?.zweig && targetKey(node.roles.zweig) === to ? "zweig" : null;
					}
					// The Bauart's radius is the Zweig's radius against the Stamm for
					// EW, ABW and IBW in a circular Stamm; a Kreuzungsweiche has two
					// Zweige and "i.U." (im Übergangsbogen) a Stamm whose curvature
					// changes under the Weiche -- there the check says nothing.
					const declared = node.bauartInfo?.radius;
					const measured = node.roles?.radius;
					const checkable = ["EW", "ABW", "IBW", null].includes(node.bauartInfo?.form ?? null) && !/i\.?U\b|i\.U\.|iU\b|zTiU|i\.UB/i.test(node.bauart ?? "");
					node.radiusCheck = declared && measured && checkable ? (Math.abs(measured - declared) / declared <= 0.15 ? "belegt" : "abweichend") : null;
				}
				// A Gleisende sits on its own Gleis, not on a neighbour's row.
				for (const node of placed) {
					if (node.arms.length !== 1) continue;
					const own = edges.find((edge) => (edge.from === node || edge.to === node) && edge.row != null);
					if (own) node.row = own.row;
				}
				const checks = nodes.filter((node) => node.spitzeCheck);
				const spitze = checks.length ? { compared: checks.filter((node) => node.spitzeCheck === "belegt" || node.spitzeCheck === "abweichend").length, belegt: checks.filter((node) => node.spitzeCheck === "belegt").length, abweichend: checks.filter((node) => node.spitzeCheck === "abweichend").length, daten: checks.filter((node) => node.spitzeCheck === "daten").length } : null;
				const throughNodes = nodes.filter((node) => node.through);
				const durchgehend = throughNodes.length ? { stamm: throughNodes.filter((node) => node.through.via === "stamm").length, zweig: throughNodes.filter((node) => node.through.via === "zweig").length, offen: throughNodes.filter((node) => !node.through.via).length } : null;
				const farNodes = nodes.filter((node) => node.far != null);
				const far = farNodes.length ? { count: farNodes.length, max: Math.max(...farNodes.map((node) => node.far)), open: nodes.filter((node) => node.km == null).length, gruppe: farNodes.filter((node) => node.farVia === "gruppe").length } : null;
				return { nodes, edges, axes, fromData, far, spitze, durchgehend, knotenLabels: data.knotenLabels, computedGleise: computed.length, gleise: gleise.length, kmLines: kmLines.length, axisIsGleis: !kmLines.length, rows: rowed.length ? [Math.min(...rowed.map((item) => item.row)), Math.max(...rowed.map((item) => item.row))] : null };
			}

			function activateJunctionCluster(junction) {
				activeJunction = junction;
				bulkSelectedEntries.clear();
				for (const entry of junction.entries) bulkSelectedEntries.add(entry);
				renderDiagram();
				const reference = junction.entries[0];
				selectObject(reference, reference.button);
			}

			function renderSevenLineOutbox(current = selectedEntry) {
				outboxContent.replaceChildren();
				outboxContent.className = "outbox-tree";
				outboxContent.append(buildNewGroupControl(current));
				const topology = deriveTopology();
				if (topology.gleise > 1) {
					const count = (kind) => topology.nodes.filter((node) => node.kind === kind).length;
					const node = document.createElement("details");
					node.className = "outbox-frame outbox-junctions";
					const summary = document.createElement("summary");
					node.open = Boolean(activeJunction?.node);
					const origin = !topology.fromData ? "gerechnet" : topology.computedGleise ? "aus den Daten und gerechnet" : "aus den Daten";
					const offGleis = topology.fromData?.offGleis ? ` · ${topology.fromData.offGleis} neben ihren Gleisen` : "";
					summary.textContent = `Weichen · Topologie (${origin}) · ${count("Weiche")} Weichen · ${count("Kreuzung")} Kreuzungen${offGleis} · ${count("Ende")} Enden · ${topology.edges.length} Kanten`;
					summary.title = `${topology.fromData ? `Aus den Daten (GND Satzart 31/33): ${topology.fromData.nodes} Knoten, ${topology.fromData.strands - topology.fromData.strandsWithoutGleis} von ${topology.fromData.strands} Gleissträngen mit Lage, ${topology.fromData.gleise} Gleise${topology.computedGleise ? ` · ${topology.computedGleise} Gleise ohne Gleisstrang gerechnet` : ""}${topology.fromData.samePoint ? ` · ${topology.fromData.samePoint} Weichenpaare auf einem Punkt (Spitze an Spitze; ihre Kante nach den Elementen des Gleisstrangs)` : ""}\n` : ""}${topology.gleise} Gleise, ${topology.nodes.length} Knoten (${count("Fortsetzung")} Fortsetzungen, ${count("Knick")} Knicke, ${count("Knoten")} sonstige) · Berührung ≤ ${TOPOLOGY_TOLERANCE_M} m, Tangente 2 gon${topology.kmLines ? ` · km von der nächsten Kilometerlinie (bis ${TOPOLOGY_KM_MAX_DISTANCE_M} m)` : " · keine Kilometerlinie, Stationen der Gleise"}${topology.spitze ? `\nSpitze: ${topology.spitze.belegt} von ${topology.spitze.compared} Weichen aus der Lage stimmen mit den Daten (KN0) überein${topology.spitze.abweichend ? `, ${topology.spitze.abweichend} weichen ab` : ""}${topology.spitze.daten ? ` · ${topology.spitze.daten} Spitzen nur aus den Daten` : ""}` : ""}${topology.durchgehend ? `\nDurchgehendes Gleis (Satzart 33): das Gleis der Spitze läuft bei ${topology.durchgehend.stamm} Weichen über den Stamm weiter, bei ${topology.durchgehend.zweig} über den Zweig${topology.durchgehend.offen ? `, bei ${topology.durchgehend.offen} ohne Rollen aus der Lage` : ""} · die Gleisnummer folgt dem Fahrweg, nicht dem Stamm, und entscheidet Stamm und Zweig nicht` : ""}${topology.far ? `\n${topology.far.count} Knoten weiter weg (bis ${Math.round(topology.far.max)} m): km über das Lot auf die Strecke ihrer Nachbarn, sonst auf die nächste Kilometerlinie (bis ${TOPOLOGY_KM_FAR_M} m)${topology.far.gruppe ? `, ${topology.far.gruppe} davon in Gruppen längs ihrer eigenen Richtung` : ""}${topology.far.open ? ` · ${topology.far.open} ohne Lage` : ""}` : ""}`;
					node.append(summary);
					const list = document.createElement("div");
					list.className = "outbox-junction-list";
					const listed = topology.nodes.filter((candidate) => ["Weiche", "Kreuzung", "Knoten", "Knick"].includes(candidate.kind)).sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
					for (const item of listed) {
						const row = document.createElement("button");
						row.type = "button";
						row.className = "outbox-junction-row";
						// A Knoten of the data is checked against the Lage: its point lies on
						// its Gleise, or the row says how far off it is.
						const gapText = item.gap >= 10 ? Math.round(item.gap) : (item.gap ?? 0).toFixed(1).replace(".", ",");
						const offGleis = item.gap > TOPOLOGY_TOLERANCE_M ? (item.gapAtEnd ? ` · Lage von ${objectDisplayName(item.gapEntry)} endet ${gapText} m vor dem Knoten` : ` · liegt ${gapText} m neben ${objectDisplayName(item.gapEntry)}`) : "";
						// Spitze, Stamm, Zweig from the Lage; the Zweig's radius against
						// the Bauart as the second witness. Without three legs the data
						// name the Spitze (KN0) and the neighbours no leg with Lage reaches.
						const roles = item.roles?.spitze || item.roles?.stamm || item.roles?.zweig ? item.roles : null;
						const legName = (leg) => legLabelOf(leg);
						// A neighbour the file has no Satzart-31 row for (the next
						// Betriebsstelle) goes by its name and Betriebsstelle.
						const nameOf = (key) => topology.knotenLabels?.get(key) ?? topology.nodes.find((candidate) => candidate.knoten === key)?.label ?? (key?.includes(" ") ? `Knoten ${key.split(" ").pop()} (Bst ${key.split(" ")[0]})` : key);
						const reached = new Set((item.legs ?? []).map((leg) => leg.target?.knoten ?? null));
						const unreached = [...new Set((item.neighbours ?? []).slice(1).filter((key) => key && !reached.has(key)))];
						const missingText = roles && (!roles.stamm || !roles.zweig) ? (() => {
							const role = !roles.stamm && !roles.zweig ? "Stamm/Zweig" : !roles.stamm ? "Stamm" : "Zweig";
							const fits = role === "Stamm/Zweig" ? unreached.length >= 1 : unreached.length === 1;
							return fits ? ` · ${role} → ${unreached.map(nameOf).join(", ")} (Daten, ohne Lage)` : ` · ${role} offen`;
						})() : "";
						const spitzeMark = item.spitzeCheck === "belegt" ? " ✓" : item.spitzeCheck === "abweichend" ? ` · Daten: Spitze → ${nameOf(item.spitzeData)}` : item.spitzeCheck === "daten" ? " (aus den Daten)" : "";
						const spitzeText = roles?.spitze ? `Spitze ${legName(roles.spitze)}${spitzeMark}` : item.spitzeData ? `Spitze → ${nameOf(item.spitzeData)} (Daten, ohne Lage)` : "Spitze offen (KN0 fehlt in den Daten)";
						const rolesText = roles ? ` · ${roles.side ? `${roles.side === "links" ? "Linksweiche" : "Rechtsweiche"}${roles.certain ? "" : " (unsicher)"} · ` : ""}${spitzeText}${roles.stamm ? ` · Stamm ${legName(roles.stamm)}` : ""}${roles.zweig ? ` · Zweig ${legName(roles.zweig)}` : ""}${missingText}${roles.radius ? ` · r ${Math.round(roles.radius)} m${item.radiusCheck === "belegt" ? " ✓" : item.radiusCheck === "abweichend" ? ` statt ${item.bauartInfo.radius}` : ""}` : ""}` : "";
						// Lage against data: where KN0 cannot be the Spitze by the geometry
						// (metroB W 2: the two other legs run through in one line, the leg
						// to KN0 bends like the Bauart's Zweig), the row says so.
						const witness = (() => {
							if (item.spitzeCheck !== "abweichend" || !roles?.spitze) return "";
							const dataLeg = (item.legs ?? []).find((leg) => leg.target?.knoten === item.spitzeData);
							if (!dataLeg) return "";
							const rest = [roles.spitze, roles.stamm, roles.zweig].filter((leg) => leg && leg !== dataLeg);
							const through = rest.length === 2 && rest[0].away.x * rest[1].away.x + rest[0].away.y * rest[1].away.y < -0.5;
							const measured = dataLeg.length > 0 && Math.abs(dataLeg.deviation) > 1e-6 ? dataLeg.length / (2 * Math.abs(dataLeg.deviation)) : null;
							const likeZweig = item.bauartInfo?.radius && gndLegByRadius(dataLeg, item.bauartInfo.radius) === "zweig";
							const lageIndex = item.neighbours?.indexOf(roles.spitze.target?.knoten ?? null) ?? -1;
							const pair = legName(rest[0]) === legName(rest[1]) ? `die beiden Schenkel auf ${legName(rest[0])}` : `${legName(rest[0])} und ${legName(rest[1])}`;
							return `\nLage gegen Daten: ${through ? `${pair} laufen in einer Flucht durch den Knoten, dazwischen liegt keine Spitze` : `die Lage sieht die Spitze bei ${legName(roles.spitze)}`}${likeZweig && measured ? `; der Schenkel zu ${nameOf(item.spitzeData)} krümmt sich mit r ≈ ${Math.round(measured)} m wie der Zweig der Bauart (${item.bauartInfo.radius} m)` : ""}${lageIndex > 0 ? ` · in den Daten stehen KN0 und KN${lageIndex} wohl vertauscht` : ""}`;
						})();
						const farText = item.far != null ? ` · ${Math.round(item.far)} m neben der Kilometerlinie` : "";
						// The Spitze's Gleis runs on through the Zweig (the number follows
						// the Fahrweg), or, without roles from the Lage, to a named neighbour.
						const throughText = item.through?.via === "zweig" ? ` · ${item.through.gleis.label} läuft über den Zweig weiter` : item.through && !item.through.via && !(roles?.stamm && roles?.zweig) ? ` · ${item.through.gleis.label} läuft nach ${nameOf(item.through.to)} weiter (Daten)` : "";
						const throughTitle = item.through ? `\nDurchgehendes Gleis (Satzart 33): ${item.through.gleis.label} von ${nameOf(item.spitzeData)} über ${item.through.via === "stamm" ? "den Stamm" : item.through.via === "zweig" ? "den Zweig" : "einen Schenkel ohne Rolle"} nach ${nameOf(item.through.to)}${item.through.via === "zweig" ? "; die Gleisnummer der Stränge folgt dem Fahrweg, nicht dem Stamm, und ist darum kein Zeuge für Stamm und Zweig" : ""}` : "";
						row.textContent = `${item.label ? `${item.label}${item.bauart ? ` · ${item.bauart}` : ""}` : item.kind} · ${item.km != null ? `${topology.axisIsGleis ? "Station" : "km"} ${station(item.km).trim()}` : "Lage offen"}${farText}${roles ? rolesText : ` · ${item.names.join(" / ")}`}${throughText}${offGleis}`;
						if (offGleis || item.radiusCheck === "abweichend" || item.spitzeCheck === "abweichend") row.classList.add("outbox-junction-off");
						row.title = `${item.source === "daten" ? `${item.kind} aus den Daten · Knoten ${item.knoten}${item.neighbours ? ` · Nachbarn ${item.neighbours.filter(Boolean).join(", ")}` : ""} · ` : `${item.kind} gerechnet · `}Grad ${item.degree} · E ${item.point.easting.toFixed(2)} N ${item.point.northing.toFixed(2)}${item.samePoint ? `\nteilt seinen Punkt mit ${item.samePoint.label ?? item.samePoint.knoten} (Spitze an Spitze, PAD ${item.pad} und ${item.samePoint.pad}); die Kante dazwischen liegt nach den Elementen ihres Gleisstrangs` : ""}${item.far != null ? `\n${item.farVia === "gruppe" ? `km längs der eigenen Gleisgruppe, ab dem Lot ihrer Mitte auf ${topology.axes?.[item.axis]?.label ?? "die Achse"} (nächste Kilometerlinie)` : `km über das Lot auf ${topology.axes?.[item.axis]?.label ?? "die Achse"} (${item.farVia === "nachbar" ? "die Strecke der Nachbarknoten" : "nächste Kilometerlinie"})`}, ${Math.round(item.far)} m daneben` : ""}${roles ? `\n${roles.fromData ? `${roles.spitze ? "Spitze aus den Daten (KN0 der Satzart 31)" : item.spitzeData ? `Spitze nach den Daten (KN0 der Satzart 31) bei ${nameOf(item.spitzeData)}, ohne Lage` : "Spitze offen: die Daten nennen keinen Nachbarn an KN0"}${roles.stamm && roles.zweig ? ", Stamm und Zweig aus den Radien der beiden Schenkel gegen die Bauart" : roles.stamm || roles.zweig ? `, ${roles.zweig ? "Zweig" : "Stamm"} aus dem Radius des Schenkels mit Lage gegen die Bauart${roles.kreuzung ? ` (${item.bauartInfo?.form}: der gerade Strang kreuzt, der Bogen zweigt ab)` : ""}` : roles.kreuzung && !roles.straightStamm ? `; Stamm und Zweig bei einer ${node_form(item)} im Bogen nicht aus der Bauart ableitbar` : roles.straightStamm === false ? "; Stamm und Zweig bei gebogenem Stamm nicht aus dem Radius ableitbar" : ", Stamm und Zweig ohne Lage oder aus dem Radius nicht entscheidbar"}` : `Spitze, Stamm und Zweig aus der Lage (25 m je Schenkel)${item.spitzeCheck === "belegt" ? "; die Daten (KN0) nennen dieselbe Spitze" : item.spitzeCheck === "abweichend" ? `; die Daten (KN0) nennen ${nameOf(item.spitzeData)} als Spitze` : ""}`}${roles.radius ? `; Zweigradius gegen den Stamm ${Math.round(roles.radius)} m${item.bauartInfo?.radius ? `, Bauart ${item.bauartInfo.radius} m${item.radiusCheck ? ` (${item.radiusCheck})` : " (nicht prüfbar)"}` : ""}` : ""}${witness}` : item.knotenTyp === 1 ? `\nSpitze/Stamm/Zweig offen: nicht drei Schenkel mit Lage${item.spitzeData ? "" : ", die Daten nennen keinen Nachbarn an KN0"}` : ""}`;
						if (throughTitle) row.title += throughTitle;
						if (activeJunction?.node === item) row.classList.add("outbox-junction-active");
						row.addEventListener("click", () => activateJunctionCluster(junctionFromNode(item)));
						list.append(row);
					}
					node.append(list);
					outboxContent.append(node);
				}
				// The Ordnung comes from the Einordnung: Strecken, their Abschnitte,
				// and in each the Spuren; this function only draws them.
				const model = einordnung();
				const entriesOf = (keys) => keys.map(einordnungEintrag).filter(Boolean);
				if (!model.strecken.size) {
					const empty = document.createElement("span");
					empty.textContent = "Noch keine 7L-Struktur. GND/LandXML erzeugt sie automatisch, oder lege oben eine Gruppe manuell an.";
					outboxContent.append(empty);
				}
				// Compact: one closed row per Strecke. A Strecke delivered in many
				// Abschnitte (Eifel 2631: 15) is one row with the strip over all of
				// them and the Abschnitte inside; a single Abschnitt is its own row.
				const trackName = (frame) => isValidRouteNumber(frame.track) ? `Strecke ${frame.track}` : String(frame.track);
				const buildSummary = (name, entries, sourceEntries) => {
					const summary = document.createElement("summary");
					const title = document.createElement("span");
					title.className = "outbox-frame-name";
					title.textContent = name;
					summary.append(title, buildLaneStrip(entries, current));
					const meta = document.createElement("span");
					meta.className = "outbox-frame-meta";
					const systems = [...new Set(sourceEntries.map((entry) => effectiveLsys(entry) || geoFrameInfo(entry)?.lsys || "LSYS?"))];
					meta.textContent = systems.join(" / ");
					const sourceHint = frameSourceHint(sourceEntries);
					if (sourceHint) meta.append(document.createTextNode(" · "), sourceHint);
					summary.append(meta);
					return summary;
				};
				const buildSectionFrame = (abschnitt, nameWithTrack) => {
					const entries = entriesOf(abschnitt.keys);
					const frame = geoFrameInfo(entries[0]);
					const packageFrame = { ...frame, sectionId: abschnitt.sectionId || null, stationFrom: abschnitt.range?.from ?? null, stationTo: abschnitt.range?.to ?? null };
					const node = document.createElement("details");
					node.className = `outbox-frame${entries.includes(current) ? " contains-selection" : ""}`;
					node.open = entries.includes(current);
					node.append(buildSummary(`${nameWithTrack ? `${trackName(frame)} · ` : ""}${sectionLabel(abschnitt)}`, entries, entries));
					node.append(buildSevenLineLanes(packageFrame, entries, current));
					return node;
				};
				for (const strecke of model.strecken.values()) {
					if (strecke.abschnitte.length === 1) {
						outboxContent.append(buildSectionFrame(strecke.abschnitte[0], true));
						continue;
					}
					const allEntries = entriesOf(strecke.abschnitte.flatMap((abschnitt) => abschnitt.keys));
					const route = document.createElement("details");
					route.className = `outbox-frame outbox-route${allEntries.includes(current) ? " contains-selection" : ""}`;
					route.open = allEntries.includes(current);
					route.append(buildSummary(`${trackName(geoFrameInfo(allEntries[0]))} · ${strecke.abschnitte.length} Abschnitte`, allEntries, allEntries));
					const inner = document.createElement("div");
					inner.className = "outbox-route-sections";
					for (const abschnitt of strecke.abschnitte) inner.append(buildSectionFrame(abschnitt, false));
					route.append(inner);
					outboxContent.append(route);
				}
				draftSevenLineFrames = draftSevenLineFrames.filter((draft) => !model.strecken.has(String(draft.track)));
				for (const draft of draftSevenLineFrames) {
					const frame = { track: draft.track, lsys: draft.lsys, direction: "unbekannt", source: "user" };
					const node = document.createElement("details");
					node.className = "outbox-frame outbox-frame-draft";
					node.open = true;
					const summary = document.createElement("summary");
					const label = document.createElement("span");
					label.textContent = `${isValidRouteNumber(draft.track) ? `Strecke ${draft.track}` : draft.track} · neu · ${draft.lsys || "LSYS?"}`;
					const remove = document.createElement("button");
					remove.type = "button";
					remove.className = "outbox-frame-draft-remove";
					remove.textContent = "✕";
					remove.title = "Leere Gruppe entfernen";
					remove.addEventListener("click", (event) => {
						event.preventDefault();
						draftSevenLineFrames = draftSevenLineFrames.filter((candidate) => candidate !== draft);
						renderSevenLineOutbox(current);
					});
					summary.append(label, remove);
					node.append(summary);
					node.append(buildSevenLineLanes(frame, [], current));
					outboxContent.append(node);
				}
			}

			// Inbox = Grabbeltisch. GND arrives fully qualified (Strecke, side,
			// Lage) and sorts itself to the right; the rest (VermEsn, landXML)
			// arrives naked and lies here until it has a Lage and a Höhe and is
			// moved to the right by hand. So the pile is "what is not right yet",
			// flat over all files, with one text filter; the words "ohne Lage",
			// "ohne Höhe", "ausgeblendet", "sichtbar" are searchable states. Lage,
			// Höhe and the map visibility are set for the hits in one go -- or,
			// when rows are ticked, for the ticked hits only.
			let inboxQuery = "";
			// Hidden on the map (GIS and SVG); Spurplan, Lieferung and the Pläne
			// follow the selection, not this flag. Keyed like the saved state so
			// it survives a reopen. Toggled left (Inbox) and right (Outbox).
			const hiddenEntryKeys = new Set();
			function isEntryHidden(entry) {
				return hiddenEntryKeys.has(stateKey(entry));
			}
			function setEntriesHidden(entries, hidden) {
				for (const entry of entries) {
					if (hidden) hiddenEntryKeys.add(stateKey(entry));
					else hiddenEntryKeys.delete(stateKey(entry));
				}
				einordnungGeaendert();
				if (activeMapMode === "crs") renderMap("crs");
				renderBasemap();
				renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
			}
			function eyeButton(entry) {
				const hidden = isEntryHidden(entry);
				const eye = document.createElement("button");
				eye.type = "button";
				eye.className = "object-eye";
				eye.textContent = hidden ? "◌" : "◉";
				eye.title = hidden ? "Auf der Karte ausgeblendet · einblenden" : "Auf der Karte sichtbar · ausblenden";
				eye.setAttribute("aria-label", `${objectListName(entry)} auf der Karte ${hidden ? "einblenden" : "ausblenden"}`);
				eye.setAttribute("aria-pressed", String(!hidden));
				eye.addEventListener("click", (event) => { event.stopPropagation(); setEntriesHidden([entry], !hidden); });
				return eye;
			}
			let grabbelHitSet = new Set();
			function updateGrabbelCount() {
				const label = tablesNav.querySelector(".bulk-crs-head strong");
				if (!label) return;
				const hits = Number(label.dataset.hits ?? 0);
				const checked = [...bulkSelectedEntries].filter((entry) => grabbelHitSet.has(entry)).length;
				label.textContent = checked ? `${checked} angehakt von ${hits} Treffern` : `${hits} Treffer`;
				label.title = checked ? "Lage, Höhe, Aus- und Einblenden wirken auf die angehakten Treffer" : "Lage, Höhe, Aus- und Einblenden wirken auf alle Treffer; Haken grenzen ein";
				const clear = tablesNav.querySelector(".grabbel-unhook");
				if (clear) clear.classList.toggle("hidden", !checked);
			}
			function isGndEntry(entry) {
				return entry.parser === "gndEdit" || Boolean(gndSequenceForEntry(entry));
			}
			// A GND Gleis stationed in itself: a Nebengleis or Bahnhofsgleis
			// (STRRIKZ 4, 5) counts from its own start, not in a Strecke's km.
			function gndEigenstationiert(entry) {
				return entry?.parser === "gndEdit" && ["4", "5"].includes(String(gndSequenceForEntry(entry)?.strRikz ?? ""));
			}
			// What goes with a Trasse, as the Einordnung has it.
			function inboxDependents(alignment) {
				return (einordnung().objects.get(einordnungKey(alignment))?.dependents ?? []).map(einordnungEintrag).filter(Boolean);
			}
			function inboxRowsAll() {
				const model = einordnung();
				const terms = inboxQuery.toLowerCase().split(/\s+/).filter(Boolean);
				const rows = [];
				for (const key of model.pile) {
					const placed = model.objects.get(key);
					const entry = einordnungEintrag(key);
					if (!placed || !entry) continue;
					const dependents = placed.dependents.map(einordnungEintrag).filter(Boolean);
					if (terms.length) {
						const hay = [placed, ...placed.dependents.map((dependentKey) => model.objects.get(dependentKey)).filter(Boolean)].map(einordnungSuchtext).join(" ");
						if (!terms.every((term) => hay.includes(term))) continue;
					}
					rows.push({ entry, loaded: entry.loaded, organized: false, orphan: placed.orphan, dependent: false, dependents });
				}
				return rows;
			}
			function appendInboxRow(container, entry, { organized = false, orphan = false, dependent = false, fileName = "" } = {}) {
				const row = document.createElement("div");
				const hidden = isEntryHidden(entry);
				row.className = `object-row${dependent ? " dependent" : ""}${organized ? " organized" : ""}${hidden ? " hidden-object" : ""}`;
				// Lage belongs to a Trasse, Höhe to a Gradiente; an Überhöhung or
				// Stationsgleichung gets no checkbox -- there is nothing to assign.
				const selectable = !dependent && (entry.item.kind === "alignment" || entry.item.kind === "profile");
				if (selectable) {
					const checkbox = document.createElement("input");
					checkbox.type = "checkbox";
					checkbox.className = "object-select";
					checkbox.checked = bulkSelectedEntries.has(entry);
					checkbox.setAttribute("aria-label", `${objectListName(entry)} zur Mehrfachauswahl hinzufügen`);
					checkbox.addEventListener("change", () => {
						if (checkbox.checked) bulkSelectedEntries.add(entry);
						else bulkSelectedEntries.delete(entry);
						updateGrabbelCount();
						renderDiagram();
					});
					row.append(checkbox);
				} else {
					row.append(document.createElement("span"));
				}
				const draggable = !dependent && !organized;
				const button = document.createElement("button");
				button.draggable = draggable;
				button.title = draggable ? "Zum Zuordnen rechts in die passende Zeile ziehen" : dependent ? "Geht mit seiner Trasse" : "Bereits rechts einsortiert";
				const label = document.createElement("span");
				label.style.display = "flex";
				label.style.alignItems = "center";
				if (draggable) {
					const handle = document.createElement("span");
					handle.className = "drag-handle";
					handle.textContent = "⠿";
					handle.setAttribute("aria-hidden", "true");
					label.append(handle);
				}
				const name = document.createElement("span");
				name.textContent = `${dependent ? "↳ " : ""}${objectListName(entry)}`;
				label.append(name);
				const kind = document.createElement("span");
				kind.dataset.kind = "true";
				const family = sourceFamilyForEntry(entry);
				const byHand = dependent && Boolean(entry.userTrasse);
				kind.textContent = `${dependent ? `${family} · gehört zur Trasse${byHand ? " · von Hand zugeordnet" : ""}` : organized ? `${family} · rechts einsortiert` : orphan ? `${family} · ohne Trasse` : `${family} · roh`}${hidden ? " · ausgeblendet" : ""}${fileName ? ` · ${fileName}` : ""}`;
				// A Gleis says where it lies; the tooltip names the witnesses.
				const evidence = entry.item.kind === "alignment" ? sideEvidence(entry) : null;
				if (evidence) {
					const position = evidence.grade === "widerspruch" ? "Gleisseite widersprüchlich" : lageCompactText(evidence.lage);
					if (position) kind.textContent += ` · ${position}`;
					if (evidence.grade === "widerspruch") kind.classList.add("side-conflict");
					button.title = `${button.title}\n${sideEvidenceText(evidence)}`;
				}
				button.append(label, kind);
				entry.button = button;
				button.addEventListener("click", () => selectObject(entry, button));
				if (draggable) {
					button.addEventListener("dragstart", (event) => {
						draggedOrganizationEntry = { entry, row };
						row.classList.add("dragging");
						event.dataTransfer.effectAllowed = "copy";
						event.dataTransfer.setData("text/plain", String(entry.item.id ?? objectDisplayName(entry)));
					});
					button.addEventListener("dragend", () => {
						row.classList.remove("dragging");
						draggedOrganizationEntry = null;
					});
				}
				row.append(button);
				// The eye: on the map or not. A dependent follows its Trasse; one
				// the user put there can be taken back.
				if (!dependent) row.append(eyeButton(entry));
				else if (byHand) {
					const unlink = document.createElement("button");
					unlink.type = "button";
					unlink.className = "object-eye object-unlink";
					unlink.textContent = "✕";
					unlink.title = "Von Hand zugeordnet · Zuordnung lösen";
					unlink.setAttribute("aria-label", `${objectListName(entry)} von seiner Trasse lösen`);
					unlink.addEventListener("click", (event) => { event.stopPropagation(); gradienteLoesen(entry); });
					row.append(unlink);
				}
				container.append(row);
				if (!draggable) return;
				// A Gradiente without a Trasse: the proposal by the names, with its
				// reason. It is the user who takes it over.
				const vorschlag = orphan ? gradientenVorschlaege().get(entry) : null;
				if (vorschlag) {
					const hint = document.createElement("div");
					hint.className = `row-suggestion${vorschlag.eindeutig ? "" : " row-suggestion-open"}`;
					const text = document.createElement("span");
					const accept = document.createElement("button");
					accept.type = "button";
					accept.textContent = "Übernehmen";
					if (vorschlag.auswahl.length) {
						text.textContent = `Vorschlag: gehört zu einer von ${vorschlag.auswahl.length} · ${gradientenVorschlagText(vorschlag)} `;
						const choice = document.createElement("select");
						choice.setAttribute("aria-label", `Trasse für ${objectListName(entry)}`);
						vorschlag.auswahl.forEach((item, index) => {
							const option = document.createElement("option");
							option.value = String(index);
							option.textContent = objectListName(item.trassen[0]);
							choice.append(option);
						});
						hint.append(text, choice, accept);
						accept.addEventListener("click", () => gradienteZuordnen([{ profile: entry, trasse: vorschlag.auswahl[Number(choice.value)]?.trassen[0] }]));
					} else {
						text.textContent = `Vorschlag: gehört zu ${objectListName(vorschlag.trassen[0])} · ${gradientenVorschlagText(vorschlag)}${vorschlag.eindeutig ? "" : " · unsicher"}`;
						hint.append(text, accept);
						accept.addEventListener("click", () => gradienteZuordnen([{ profile: entry, trasse: vorschlag.trassen[0] }]));
					}
					container.append(hint);
				}
				const suggestion = suggestRoleForEntry(entry);
				if (suggestion) {
					const hint = document.createElement("div");
					hint.className = "row-suggestion";
					const text = document.createElement("span");
					text.textContent = `Vorschlag: ${suggestion.groupDef.title}${suggestion.reason ? ` · ${suggestion.reason}` : ""}`;
					const accept = document.createElement("button");
					accept.type = "button";
					accept.textContent = "Übernehmen";
					accept.addEventListener("click", () => assignEntryToSevenLine(entry, suggestion.groupDef, geoFrameInfo(entry)));
					hint.append(text, accept);
					container.append(hint);
				}
				// The Gleis's share of its Bündel's Sortiervorschlag, to take over
				// alone; the Strecke is the one standing in the Bündel's line.
				const sortier = suggestion || dependent ? null : buendelVorschlagJeEintrag.get(entry);
				const spur = sortier ? SEVEN_LINE_GROUPS.find((group) => group.role === BUENDEL_SPUR[sortier.side]) : null;
				// Beside several Kilometerlinien the line is a choice: it stands in
				// the proposal as a field, the nearest preselected. Picking changes
				// the proposal, not the Gleis. Where the Gleis lies beside the
				// nearest only in part and beside another from end to end, the row
				// says so and stands out.
				const wahl = suggestion || dependent || entry.item.kind !== "alignment" ? null : vorschlagLinienwahl(entry);
				const gewaehlt = Boolean(wahl) && wahl.gewaehlt !== wahl.naechste;
				const anteil = (linie) => linie.hits >= wahl.samples ? "ganz" : `${Math.round(100 * linie.hits / wahl.samples)} %`;
				const linienwahl = () => {
					const choice = document.createElement("select");
					choice.className = "linienwahl";
					choice.setAttribute("aria-label", `Kilometerlinie für den Vorschlag zu ${objectListName(entry)}`);
					choice.title = `Das Gleis liegt neben ${wahl.linien.length} Kilometerlinien (Anteil des Gleises, mittlerer Abstand):\n${wahl.linien.map((linie) => `${linie.route} · ${anteil(linie)} · ${lageMeters(linie.median)} m`).join("\n")}\nVorgeschlagen ist die nächste. Die Wahl ändert den Vorschlag; zugeordnet wird erst mit dem Übernehmen.`;
					for (const linie of wahl.linien) {
						const option = document.createElement("option");
						option.value = linie.route;
						option.textContent = linie.route;
						option.dataset.lang = `${linie.route} · ${anteil(linie)} · ${lageMeters(linie.median)} m`;
						option.selected = linie.route === wahl.gewaehlt;
						choice.append(option);
					}
					// Closed it shows the line; open, each line with share and distance.
					// The field keeps its width meanwhile, so the row does not jump.
					const lang = () => {
						if (!choice.style.width) choice.style.width = `${choice.getBoundingClientRect().width}px`;
						for (const option of choice.options) option.textContent = option.dataset.lang;
					};
					const kurz = () => {
						for (const option of choice.options) option.textContent = option.value;
						choice.style.width = "";
					};
					choice.addEventListener("pointerdown", lang);
					choice.addEventListener("focus", lang);
					choice.addEventListener("blur", kurz);
					choice.addEventListener("click", (event) => event.stopPropagation());
					choice.addEventListener("change", () => {
						if (choice.value === wahl.naechste) vorschlagLinie.delete(entry);
						else vorschlagLinie.set(entry, choice.value);
						renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
					});
					return choice;
				};
				// "9,2 m rechts der Kilometerlinie", the line itself is the field.
				const lageOhneLinie = () => lagePositionText({ ...lageWitnessVorschlag(entry), route: "" }).trim();
				const wahlGrund = () => gewaehlt ? ` · gewählt statt der nächsten (${wahl.naechste})`
					: wahl.zweifel ? ` · daran ${anteil(wahl.linien[0])} des Gleises, ganz an ${wahl.ganz}`
					: "";
				const bleibt = wahl && !spur ? buendelBleibtJeEintrag.get(entry) : null;
				if (bleibt) {
					// No side at this line (the Gleis crosses it, lies on it, or its
					// name says the other side): another line may give one.
					const hint = document.createElement("div");
					hint.className = `row-suggestion${wahl.zweifel || gewaehlt ? " row-suggestion-open" : ""}`;
					const text = document.createElement("span");
					text.append(`Kein Vorschlag: ${lageOhneLinie()} `, linienwahl(), `${bleibt === "widerspruch" ? " · der Name nennt die andere Seite" : ""}${wahlGrund()}`);
					hint.append(text);
					container.append(hint);
				}
				if (spur) {
					const hint = document.createElement("div");
					hint.className = `row-suggestion${wahl && (wahl.zweifel || gewaehlt) ? " row-suggestion-open" : ""}`;
					const text = document.createElement("span");
					if (wahl) text.append(`Vorschlag: ${spur.title} · ${sortier.grund === "name" ? "Seite aus dem Namen · " : sortier.grund === "name+lage" ? "Name und Lage: " : ""}${lageOhneLinie()} `, linienwahl(), wahlGrund());
					else text.textContent = `Vorschlag: ${spur.title} · ${buendelVorschlagGrund(entry, sortier)}`;
					const accept = document.createElement("button");
					accept.type = "button";
					accept.textContent = "Übernehmen";
					accept.title = "Dieses Gleis allein in die Strecke einsortieren, die oben im Bündel steht";
					accept.addEventListener("click", () => {
						const strecke = sortier.strecke();
						if (!strecke) {
							status.classList.add("error");
							status.textContent = "Die Strecke fehlt: oben im Bündel eintragen, dann übernehmen.";
							return;
						}
						buendelEinsortieren([{ entry, side: sortier.side }], strecke);
					});
					hint.append(text, accept);
					container.append(hint);
				}
			}

			// The Sortiervorschlag of a Bündel, drawn above its rows: one line
			// per Strecke with what would go where and why, and what stays. The
			// Strecke read from a name stands in a field the user can change;
			// what is typed there is kept while the pile is redrawn.
			const buendelStrecken = new Map();
			let buendelVorschlagJeEintrag = new Map();
			// Why a Gleis of a Bündel has no proposal (entry -> "kreuzt", "achse",
			// "widerspruch"); what finds no Kilometerlinie has no line to choose.
			let buendelBleibtJeEintrag = new Map();
			function appendBuendelVorschlag(section, group) {
				const { ziele, bleiben } = group.sortier;
				for (const grund of ["kreuzt", "achse", "widerspruch"]) {
					for (const key of bleiben[grund]) { const entry = einordnungEintrag(key); if (entry) buendelBleibtJeEintrag.set(entry, grund); }
				}
				const anzahl = (count, one, many) => count === 1 ? one : `${count} ${many}`;
				for (const ziel of ziele) {
					const fest = Boolean(ziel.track) && !ziel.trackAusName;
					const stateId = `${group.id}|${ziel.id}`;
					const strecke = () => String(fest ? ziel.track : buendelStrecken.get(stateId) ?? ziel.track).trim();
					const items = ziel.items.map((item) => ({ entry: einordnungEintrag(item.key), side: item.side, grund: item.grund })).filter((item) => item.entry);
					if (!items.length) continue;
					for (const item of items) buendelVorschlagJeEintrag.set(item.entry, { ...item, strecke });
					const line = document.createElement("div");
					line.className = "row-suggestion bundle-suggestion";
					const text = document.createElement("span");
					const accept = document.createElement("button");
					accept.type = "button";
					accept.textContent = `${items.length} einsortieren`;
					accept.title = "Diese Gleise in die Strecke einsortieren, jedes auf die genannte Seite. Es gilt als von Hand zugeordnet und lässt sich als Ganzes zurücknehmen.";
					text.append(`Vorschlag: ${anzahl(items.length, "1 Gleis", "Gleise")} nach Strecke `);
					if (fest) {
						const name = document.createElement("strong");
						name.textContent = ziel.track;
						text.append(name);
					} else {
						const input = document.createElement("input");
						input.type = "text";
						input.className = "bundle-strecke";
						input.size = 6;
						input.value = strecke();
						input.placeholder = "Nummer";
						input.setAttribute("aria-label", "Strecke, in die das Bündel einsortiert wird");
						input.title = ziel.track
							? "Aus dem Namen der Kilometerlinie gelesen. Änderbar; die Strecke gilt erst mit dem Einsortieren."
							: "Der Name der Kilometerlinie nennt keine Strecke: hier eintragen.";
						input.addEventListener("input", () => {
							buendelStrecken.set(stateId, input.value);
							scheduleStateSave();
							accept.disabled = !input.value.trim();
						});
						text.append(input);
						accept.disabled = !strecke();
					}
					const sides = [ziel.counts.left ? `${ziel.counts.left} links` : "", ziel.counts.right ? `${ziel.counts.right} rechts` : ""].filter(Boolean).join(", ");
					const bezug = ziel.bezug.length === 1 ? `der Kilometerlinie ${ziel.bezug[0]}` : `von ${ziel.bezug.length} Kilometerlinien`;
					const linien = anzahl(ziel.counts.kilometer, "die Kilometerlinie", "Kilometerlinien");
					text.append(sides
						? ` · ${sides} ${bezug}${ziel.counts.kilometer ? `, dazu ${linien}` : ""}`
						: ` · ${linien} laut Name`);
					// Gleise that lie beside this line only in part and beside another
					// from end to end: counted here, the choice stands at the Gleis.
					const teilweise = items.filter((item) => { const wahl = vorschlagLinienwahl(item.entry); return wahl && wahl.zweifel && wahl.gewaehlt === wahl.naechste; }).length;
					if (teilweise) text.append(` · ${teilweise} davon ${teilweise === 1 ? "liegt" : "liegen"} nur teilweise daran (andere Kilometerlinie am Gleis wählbar)`);
					accept.addEventListener("click", () => buendelEinsortieren(items, strecke()));
					line.append(text, accept);
					section.append(line);
				}
				const rest = [
					[bleiben.kreuzt.length, "kreuzt die Kilometerlinie"],
					[bleiben.achse.length, "liegt auf der Kilometerlinie"],
					[bleiben.widerspruch.length, "Name und Lage nennen verschiedene Seiten"],
					[bleiben.ohne.length, "ohne Kilometerlinie in Reichweite"],
				].filter(([count]) => count);
				const left = rest.reduce((sum, [count]) => sum + count, 0);
				if (!left || (!ziele.length && left < 2)) return;
				const note = document.createElement("div");
				note.className = "bundle-rest";
				const reasons = rest.map(([count, reason]) => `${count} × ${reason}`).join(" · ");
				note.textContent = ziele.length
					? `${left} ${left === 1 ? "bleibt" : "bleiben"} hier: ${reasons}`
					: `Kein Sortiervorschlag: ${reasons}.${bleiben.ohne.length === left ? " Ist die Kilometerlinie einsortiert, folgen die Seiten der übrigen aus der Lage." : ""}`;
				section.append(note);
			}

			// Which Bündel of the pile stand open: what the user opened or closed
			// stays so; untouched ones open when the pile is short or they hold
			// the selection.
			const pileBundleOpen = new Map();
			function renderRawInbox(preferredFileName = null) {
				const previousSelection = selectedEntry;
				const allEntries = allViewerEntries();
				const rows = inboxRowsAll();
				tablesNav.replaceChildren(renderGrabbeltischBar(allEntries, rows));
				updateGrabbelCount();
				const hasUnassigned = allEntries.some((entry) => !isOutboxOrganized(entry));
				if (hasUnassigned && !dragHintUsed && !dragHintDismissed) {
					const hint = document.createElement("div");
					hint.className = "inbox-drag-hint";
					const text = document.createElement("p");
					text.textContent = "Objekte per Ziehen (⠿) rechts in die Ordnung einsortieren, oder Vorschlag übernehmen, wo vorhanden.";
					const dismiss = document.createElement("button");
					dismiss.type = "button";
					dismiss.textContent = "✕";
					dismiss.setAttribute("aria-label", "Hinweis ausblenden");
					dismiss.addEventListener("click", () => {
						dragHintDismissed = true;
						hint.remove();
					});
					hint.append(text, dismiss);
					tablesNav.append(hint);
				}
				const pile = document.createElement("div");
				pile.className = "inbox-pile";
				buendelVorschlagJeEintrag = new Map();
				buendelBleibtJeEintrag = new Map();
				// A step is offered only while something of it still stands as taken.
				const loadedNow = new Set(allEntries);
				buendelRuecknahmen = buendelRuecknahmen.filter((step) => step.before.some((item) => loadedNow.has(item.entry) && item.entry.frameEdit === item.frameEdit));
				if (buendelRuecknahmen.length) {
					const undo = document.createElement("div");
					undo.className = "row-suggestion pile-undo";
					const text = document.createElement("span");
					const steps = buendelRuecknahmen.length;
					text.textContent = `Zuletzt einsortiert: ${buendelRuecknahmen[steps - 1].text} · von Hand übernommen${steps > 1 ? ` · ${steps} Schritte zurücknehmbar` : ""}`;
					const back = document.createElement("button");
					back.type = "button";
					back.textContent = "Zurücknehmen";
					back.title = "Diese Gleise wieder in den Haufen legen. Was seither von Hand weiter umsortiert wurde, bleibt.";
					back.addEventListener("click", buendelZuruecknehmen);
					undo.append(text, back);
					pile.append(undo);
				}
				if (!rows.length) {
					const done = document.createElement("div");
					done.className = "file-group-done";
					done.textContent = inboxQuery ? "Kein Treffer für diesen Filter" : "Alles einsortiert · siehe rechts";
					pile.append(done);
				}
				let firstPreferred = null;
				// The pile is laid out the way the eye reads the map: Gleise that
				// run together are one Bündel under its longest line. Gradienten
				// without a Trasse come first, with their proposals; Trassen
				// without a Lage on the map last. The Bündel order the pile, they
				// assign nothing.
				const stand = buendelStand();
				const vorschlaege = gradientenVorschlaege();
				const groups = new Map();
				const groupFor = (id, make) => { if (!groups.has(id)) groups.set(id, { id, rows: [], ...make() }); return groups.get(id); };
				for (const row of rows) {
					const isTrasse = row.entry.item.kind === "alignment";
					const bundle = isTrasse ? stand.of.get(row.entry) : null;
					const group = bundle
						? groupFor(bundle.id, () => ({ order: 1 + bundle.index, bundle }))
						: isTrasse
							? groupFor("ohne-lage", () => ({ order: 100000, title: "Trassen ohne Lage auf der Karte", sub: "kein Lagesystem erkannt oder gesetzt" }))
							: groupFor("ohne-trasse", () => ({ order: 0, title: row.entry.item.kind === "profile" ? "Gradienten ohne Trasse" : "Ohne Trasse" }));
					group.rows.push(row);
				}
				const ordered = [...groups.values()].sort((a, b) => a.order - b.order);
				const few = rows.length <= 12 || ordered.length <= 1;
				for (const group of ordered) {
					const section = document.createElement("details");
					section.className = "pile-bundle";
					const holdsSelection = group.rows.some((row) => row.entry === previousSelection || row.dependents.includes(previousSelection));
					section.open = pileBundleOpen.has(group.id) ? pileBundleOpen.get(group.id) : few || holdsSelection || group.id === "ohne-trasse";
					section.addEventListener("toggle", () => pileBundleOpen.set(group.id, section.open));
					const summary = document.createElement("summary");
					const name = document.createElement("span");
					name.className = "pile-bundle-name";
					const meta = document.createElement("span");
					meta.className = "pile-bundle-meta";
					summary.append(name, meta);
					if (group.bundle) {
						const { leader, members, length } = group.bundle;
						name.textContent = members.length > 1 ? `entlang ${objectListName(leader)}` : objectListName(leader);
						name.title = `Bündel aus der Lage: ${members.length} ${members.length === 1 ? "Gleis" : "Gleise"} laufen zu mindestens ${Math.round(BUENDEL_ANTEIL * 100)} % innerhalb von ${BUENDEL_REICHWEITE_M} m an ${objectListName(leader)} entlang (der längsten Linie). Nur eine Anordnung des Haufens, keine Zuordnung.`;
						meta.textContent = `${group.rows.length} hier · ${members.length} ${members.length === 1 ? "Gleis" : "Gleise"} · ${(length / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`;
						const show = document.createElement("button");
						show.type = "button";
						show.className = "pile-bundle-show";
						show.textContent = "⌖";
						show.title = "Dieses Bündel auf der Karte zeigen";
						show.setAttribute("aria-label", `Bündel entlang ${objectListName(leader)} auf der Karte zeigen`);
						show.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); centerMapOnEntries(members); });
						summary.append(show);
						group.sortier = buendelVorschlag(group.rows.map((row) => row.entry));
						const sortierbar = group.sortier.ziele.reduce((sum, ziel) => sum + ziel.items.length, 0);
						if (sortierbar) meta.textContent += ` · ${sortierbar} mit Vorschlag`;
					} else {
						name.textContent = group.title;
						const clear = group.rows.map((row) => ({ profile: row.entry, vorschlag: vorschlaege.get(row.entry) })).filter((item) => item.vorschlag?.eindeutig);
						const proposed = group.rows.filter((row) => vorschlaege.has(row.entry)).length;
						meta.textContent = group.id === "ohne-trasse" ? `${group.rows.length} hier${proposed ? ` · ${proposed} mit Vorschlag` : ""}` : `${group.rows.length} hier · ${group.sub}`;
						if (clear.length) {
							const takeAll = document.createElement("button");
							takeAll.type = "button";
							takeAll.className = "pile-bundle-take";
							takeAll.textContent = `${clear.length} eindeutige übernehmen`;
							takeAll.title = "Alle Vorschläge übernehmen, bei denen genau ein Name passt (Name gleich bis auf System/Variante oder bis auf ein Zeichen, oder die meisten Namensteile). Vorschläge mit Auswahl und unsichere bleiben stehen.";
							takeAll.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); gradienteZuordnen(clear.map((item) => ({ profile: item.profile, trasse: item.vorschlag.trassen[0] }))); });
							summary.append(takeAll);
						}
					}
					section.append(summary);
					if (group.sortier) appendBuendelVorschlag(section, group);
					for (const row of group.rows) {
						appendInboxRow(section, row.entry, { organized: row.organized, orphan: row.orphan, dependent: Boolean(row.dependent), fileName: row.loaded.fileKey ?? row.loaded.fileName });
						for (const dependent of row.dependents) appendInboxRow(section, dependent, { organized: row.organized, dependent: true, fileName: dependent.loaded?.fileKey ?? dependent.loaded?.fileName ?? row.loaded.fileName });
						if (row.loaded.fileName === preferredFileName && !firstPreferred) firstPreferred = row.entry;
					}
					pile.append(section);
				}
				tablesNav.append(pile);
				appendPlanningTree();
				renderSevenLineOutbox(previousSelection);
				syncMapFilterState();
				applyMapFilters();
				if (!mapFilterPanel.classList.contains("hidden")) renderMapFilterPanel();
				// A filter keystroke must not re-select (and re-centre the map):
				// the old selection just keeps its mark; a lost selection moves on.
				const keep = previousSelection && allEntries.includes(previousSelection) ? previousSelection : null;
				if (keep) keep.button?.classList.add("selected");
				else {
					const next = firstPreferred ?? rows[0]?.entry ?? allEntries[0];
					if (next?.button) selectObject(next, next.button);
				}
			}

			function renderObjectTree(preferredFileName = null) {
				einordnungGeaendert();
				scheduleStateSave();
				return renderRawInbox(preferredFileName);
				const previousSelection = selectedEntry;
				const previousPlanningSelection = selectedPlanningFile;
				const allEntries = loadedFiles.flatMap((loaded) => loaded.objects);
				const frames = new Map();
				for (const entry of allEntries) {
					const frame = geoFrameInfo(entry);
					if (!frame) continue;
					const key = geoFrameKey(frame);
					if (!frames.has(key)) frames.set(key, { frame, entries: [] });
					frames.get(key).entries.push(entry);
				}

				tablesNav.replaceChildren(renderGrabbeltischBar(allEntries, []));
				let firstPreferred = null;

				function createRow(entry, scope) {
					const row = document.createElement("div");
					row.className = "object-row";
					row.draggable = false;
					const button = document.createElement("button");
					const checkbox = document.createElement("input");
					checkbox.type = "checkbox";
					checkbox.className = "object-select";
					checkbox.draggable = false;
					checkbox.checked = bulkSelectedEntries.has(entry);
					checkbox.setAttribute("aria-label", `${objectListName(entry)} zur Mehrfachauswahl hinzufügen`);
					checkbox.addEventListener("change", () => {
						if (checkbox.checked) bulkSelectedEntries.add(entry);
						else bulkSelectedEntries.delete(entry);
						updateGrabbelCount();
					});
					button.draggable = true;
					const name = document.createElement("span");
					const kind = document.createElement("span");
					kind.dataset.kind = "true";
					name.textContent = objectListName(entry);
					const systems = systemsForEntry(entry);
					kind.textContent = entry.item.kind === "profile" || entry.item.kind === "cant"
						? `${familyForEntry(entry)}${systems.hsys ? ` · ${systems.hsys}` : ""}`
						: `${familyForEntry(entry)}${effectiveLsys(entry) ? ` · ${effectiveLsys(entry)}` : " · LSYS?"}`;
					button.append(name, kind);
					entry.button = button;
					button.addEventListener("click", () => selectObject(entry, button));
					row.addEventListener("dragstart", (event) => {
						draggedOrganizationEntry = { entry, row };
						row.classList.add("dragging");
						event.dataTransfer.effectAllowed = "move";
						event.dataTransfer.setData("text/plain", String(entry.item.id ?? objectDisplayName(entry)));
					});
					row.addEventListener("dragend", () => {
						row.classList.remove("dragging");
						for (const target of tablesNav.querySelectorAll(".drag-target")) target.classList.remove("drag-target");
						draggedOrganizationEntry = null;
					});
					row.append(checkbox, button);
					if (entry.loaded.fileName === preferredFileName && !firstPreferred) firstPreferred = entry;
					return row;
				}

				function createLane(scope, groupDef, entries, frame = null) {
					const lane = document.createElement("div");
					lane.className = "object-family-group";
					lane.dataset.family = groupDef.family;
					lane.dataset.role = groupDef.role ?? groupDef.family;
					const title = document.createElement("div");
					title.className = `object-group-title${entries.length ? "" : " empty"}`;
					title.setAttribute("role", "button");
					title.tabIndex = 0;
					title.dataset.title = groupDef.title;
					title.dataset.evidence = "false";
					const [familyCode, ...labelParts] = groupDef.title.split(" · ");
					const code = document.createElement("span");
					code.className = "family-code";
					code.textContent = familyCode;
					const label = document.createElement("span");
					label.className = "family-label";
					label.textContent = labelParts.join(" · ");
					const count = document.createElement("span");
					count.className = "family-count";
					count.textContent = entries.length ? String(entries.length) : "+";
					title.append(code, label, count);
					const assignSelected = () => {
						if (!selectedEntry) return;
						const selectedRow = selectedEntry.button?.closest(".object-row");
						if (selectedRow) assignOrganization(selectedEntry, groupDef, selectedRow, scope, frame);
					};
					title.addEventListener("click", assignSelected);
					title.addEventListener("keydown", (event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						event.preventDefault();
						assignSelected();
					});
					lane.addEventListener("dragover", (event) => {
						if (!draggedOrganizationEntry) return;
						event.preventDefault();
						lane.classList.add("drag-target");
					});
					lane.addEventListener("dragleave", (event) => {
						if (!lane.contains(event.relatedTarget)) lane.classList.remove("drag-target");
					});
					lane.addEventListener("drop", (event) => {
						event.preventDefault();
						lane.classList.remove("drag-target");
						if (!draggedOrganizationEntry) return;
						assignOrganization(draggedOrganizationEntry.entry, groupDef, draggedOrganizationEntry.row, scope, frame);
					});
					lane.append(title);
					for (const entry of entries) lane.append(createRow(entry, scope));
					scope.append(lane);
				}

				const routeFrames = [...frames.values()].filter(({ frame }) => isValidRouteNumber(frame.track));
				if (routeFrames.length) {
					const routes = workspaceSection("Strecken", new Set(routeFrames.map(({ frame }) => frame.track)).size);
					const byRoute = groupBy(routeFrames, ({ frame }) => String(frame.track));
					for (const [routeNumber, routeGroups] of byRoute) {
						const route = document.createElement("details");
						route.className = "organization-scope geo-frame-node";
						route.open = false;
						const routeEntries = routeGroups.flatMap(({ entries }) => entries);
						const routeTitle = document.createElement("summary");
						routeTitle.className = "geo-frame-title route-title";
						routeTitle.textContent = `Strecke ${routeNumber} · ${routeEntries.length}`;
						const routeSource = frameSourceHint(routeEntries);
						if (routeSource) routeTitle.append(routeSource);
						route.append(routeTitle);
						const byLsys = groupBy(routeEntries, (entry) => effectiveLsys(entry) || "LSYS?");
						for (const [lsys, entries] of byLsys) {
							const scope = document.createElement("details");
							scope.className = "organization-scope geo-frame-node";
							scope.open = false;
							const title = document.createElement("summary");
							title.className = "geo-frame-title lsys-title";
							const directions = [...new Set(entries.map((entry) => geoFrameInfo(entry)?.direction).filter(Boolean))];
							title.textContent = `${lsys} · ${directions.join(" / ") || "Abschnitt"}`;
							scope.append(title);
							const sectionFrame = { ...routeGroups[0].frame, track: routeNumber, lsys };
							for (const groupDef of SEVEN_LINE_GROUPS.filter((group) => group.family !== "UNASSIGNED")) {
								createLane(scope, groupDef, entries.filter((entry) => sevenLineRole(entry) === groupDef.role), sectionFrame);
							}
							refreshOrganizationGroups(scope);
							route.append(scope);
						}
						routes.append(route);
					}
					tablesNav.append(routes);
				}

				const otherFrames = [...frames.values()].filter(({ frame }) => !isValidRouteNumber(frame.track));
				if (otherFrames.length) {
					const otherTracks = workspaceSection("Weitere Gleise", otherFrames.length);
					for (const { frame, entries: framedEntries } of otherFrames) {
						const entries = framedEntries.filter((entry) => sevenLineRole(entry) !== "curvatureKilometer");
						if (!entries.length) continue;
						const scope = document.createElement("details");
						scope.className = "organization-scope geo-frame-node";
						scope.open = false;
						const title = document.createElement("summary");
						title.className = "geo-frame-title";
						title.textContent = `${frame.track || "Gleis ohne Bezeichnung"} · ${effectiveLsys(entries[0]) || "LSYS?"} · ${entries.length}`;
						scope.append(title);
						for (const groupDef of SEVEN_LINE_GROUPS.filter((group) => group.family !== "UNASSIGNED" && group.role !== "curvatureKilometer")) {
							createLane(scope, groupDef, entries.filter((entry) => sevenLineRole(entry) === groupDef.role), frame);
						}
						refreshOrganizationGroups(scope);
						otherTracks.append(scope);
					}
					tablesNav.append(otherTracks);
				}

				const unframedEntries = allEntries.filter((entry) => {
					const frame = geoFrameInfo(entry);
					return !frame || (!isValidRouteNumber(frame.track) && sevenLineRole(entry) === "curvatureKilometer");
				});
				if (unframedEntries.length) {
					const unframed = workspaceSection("Zu klären", unframedEntries.length);
					for (const loaded of loadedFiles) {
						const fileEntries = unframedEntries.filter((entry) => entry.loaded === loaded);
						if (!fileEntries.length) continue;
						const scope = document.createElement("details");
						scope.className = "organization-scope";
						scope.open = false;
						const fileTitle = document.createElement("summary");
						fileTitle.className = "geo-frame-title";
						fileTitle.textContent = `${loaded.fileName} · ${fileEntries.length}`;
						scope.append(fileTitle);
						addFileCrsControl(scope, loaded);
						createLane(scope, SEVEN_LINE_GROUPS[0], fileEntries, null);
						refreshOrganizationGroups(scope);
						unframed.append(scope);
					}
					tablesNav.append(unframed);
				}
				appendPlanningTree();

				const nextSelection = previousSelection && allEntries.includes(previousSelection)
					? previousSelection
					: firstPreferred ?? allEntries[0];
				if (nextSelection?.button) selectObject(nextSelection, nextSelection.button);
				else if (previousPlanningSelection && planningFiles.includes(previousPlanningSelection)) selectPlanningFile(previousPlanningSelection, previousPlanningSelection.button);
				else if (planningFiles[0]?.button) selectPlanningFile(planningFiles[0], planningFiles[0].button);
			}

			function allViewerEntries() {
				return loadedFiles.flatMap((loaded) => loaded.objects);
			}

			function validateSevenLineState() {
				const diagnostics = [];
				for (const loaded of loadedFiles) {
					const ids = new Set();
					for (const entry of loaded.objects) {
						const id = String(entry.item?.id ?? "");
						if (!id) diagnostics.push({ severity: "error", code: "IDENTITY_MISSING", object: objectDisplayName(entry) });
						else if (ids.has(id)) diagnostics.push({ severity: "error", code: "IDENTITY_DUPLICATE", object: id, source: loaded.fileName });
						ids.add(id);
						if (!geoFrameInfo(entry)) diagnostics.push({ severity: "warning", code: "GEOFRAME_OPEN", object: objectDisplayName(entry) });
						if (sevenLineRole(entry) === "UNASSIGNED") diagnostics.push({ severity: "warning", code: "SEVEN_LINE_ROLE_OPEN", object: objectDisplayName(entry) });
						const unresolved = entry.item?.payload?.extras?.unresolvedAttachments;
						if (unresolved && Object.keys(unresolved).length) diagnostics.push({ severity: "warning", code: "IMPORT_EVIDENCE_UNRESOLVED", object: objectDisplayName(entry) });
					}
				}
				const byTrack = new Map();
				for (const entry of allViewerEntries()) {
					const frame = geoFrameInfo(entry);
					if (!frame) continue;
					if (!byTrack.has(frame.track)) byTrack.set(frame.track, []);
					byTrack.get(frame.track).push(entry);
				}
				for (const [track, entries] of byTrack) {
					const roles = new Set(entries.map(sevenLineRole));
					if (roles.has("curvatureRight") && roles.has("curvatureLeft") && !roles.has("curvatureKilometer")) {
						diagnostics.push({ severity: "error", code: "KILOMETER_LINE_REQUIRED", track });
					}
				}
				return diagnostics;
			}

			function showSevenLineValidation() {
				const diagnostics = validateSevenLineState();
				const errors = diagnostics.filter((item) => item.severity === "error").length;
				const warnings = diagnostics.length - errors;
				status.classList.toggle("error", errors > 0);
				status.textContent = diagnostics.length
					? `7L-Prüfung: ${errors} Fehler · ${warnings} Hinweise · ${diagnostics.map((item) => item.code).join(" · ")}`
					: "7L-Prüfung: vollständig und widerspruchsfrei.";
				return diagnostics;
			}

			function xml(value) {
				return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
			}

			function measureNumber(value) {
				const number = numberValue(value);
				return Number.isFinite(number) ? number : null;
			}

			function pointXml(tag, point) {
				const northing = measureNumber(point?.northing ?? point?.x);
				const easting = measureNumber(point?.easting ?? point?.y);
				return northing == null || easting == null ? "" : `<${tag}>${northing} ${easting}</${tag}>`;
			}

			function geometryXml(element) {
				const attributes = [
					["staStart", measureNumber(element?.staStart)],
					["length", measureNumber(element?.length)],
					["dir", measureNumber(element?.direction ?? element?.dirStart)],
					["radius", measureNumber(element?.radius)],
					["radiusStart", measureNumber(element?.radiusStart)],
					["radiusEnd", measureNumber(element?.radiusEnd)],
					["rot", element?.rot],
					["spiType", element?.spiType],
				].filter(([, value]) => value != null && value !== "").map(([key, value]) => `${key}="${xml(value)}"`).join(" ");
				const tag = ["Line", "Curve", "Spiral"].includes(element?.type) ? element.type : "Line";
				return `<${tag}${attributes ? ` ${attributes}` : ""}>${pointXml("Start", element?.start)}${pointXml("End", element?.end)}${pointXml("Center", element?.center)}${pointXml("PI", element?.pi)}</${tag}>`;
			}

			function exportAlignmentXml(entry) {
				const payload = entry.item.payload ?? {};
				const frame = geoFrameInfo(entry);
				const sameTrack = frame ? allViewerEntries().filter((candidate) => geoFrameInfo(candidate)?.track === frame.track) : relatedDiagramEntries(entry).entries;
				const role = sevenLineRole(entry);
				const side = role.includes("Right") ? "Right" : role.includes("Left") ? "Left" : null;
				// Prefer what references this alignment directly; a side can hold
				// several segments, each with its own profile and cant.
				const own = referencingEntries(entry);
				const profile = side ? own.find((candidate) => candidate.item.kind === "profile") ?? sameTrack.find((candidate) => sevenLineRole(candidate) === `gradient${side}`) : null;
				const cant = side ? own.find((candidate) => candidate.item.kind === "cant") ?? sameTrack.find((candidate) => sevenLineRole(candidate) === `cant${side}`) : null;
				const equations = role === "curvatureKilometer" ? sameTrack.find((candidate) => candidate.item.kind === "staEq") : null;
				const profilePoints = profile?.item?.payload?.points ?? [];
				const cantPoints = cant?.item?.payload?.points ?? [];
				const equationItems = equations?.item?.payload?.equations ?? [];
				const profileXml = profilePoints.length ? `<Profile name="${xml(objectDisplayName(profile))}"><ProfAlign>${profilePoints.map((point) => `<PVI>${measureNumber(point.station ?? point.sta)} ${measureNumber(point.elevation ?? point.height ?? point.z)}</PVI>`).join("")}</ProfAlign></Profile>` : "";
				const cantXml = cantPoints.length ? `<Cant name="${xml(objectDisplayName(cant))}">${cantPoints.map((point) => `<CantStation station="${xml(measureNumber(point.station ?? point.sta))}" appliedCant="${xml(measureNumber(point.cant ?? point.value ?? point.superelevation ?? point.u))}"/>`).join("")}</Cant>` : "";
				const staXml = equationItems.map((equation) => `<StaEquation staBack="${xml(measureNumber(equation.staBack ?? equation.stationBack))}" staAhead="${xml(measureNumber(equation.staAhead ?? equation.stationAhead))}"/>`).join("");
				return `<Alignment name="${xml(objectDisplayName(entry))}" oID="${xml(entry.item.id)}"><Feature code="ufAIM-7L"><Property label="lineRole" value="${xml(sevenLineRole(entry))}"/><Property label="track" value="${xml(frame?.track)}"/><Property label="direction" value="${xml(frame?.direction)}"/><Property label="LSYS" value="${xml(effectiveLsys(entry))}"/><Property label="HSYS" value="${xml(systemsForEntry(entry).hsys)}"/><Property label="sourceFile" value="${xml(entry.loaded.fileName)}"/></Feature><CoordGeom>${(payload.coordGeom?.elements ?? []).map(geometryXml).join("")}</CoordGeom>${staXml}${profileXml}${cantXml}</Alignment>`;
			}

			function buildLandXmlExport() {
				const alignments = allViewerEntries().filter((entry) => entry.item.kind === "alignment" && (entry.item.payload?.coordGeom?.elements ?? []).length);
				const diagnostics = validateSevenLineState();
				const diagnosticXml = diagnostics.map((item, index) => `<Property label="diagnostic.${index + 1}.${xml(item.code)}" value="${xml(JSON.stringify(item))}"/>`).join("");
				return `<?xml version="1.0" encoding="UTF-8"?>\n<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2" date="${new Date().toISOString().slice(0, 10)}"><Application name="ufAIM Technet Viewer" version="1"/><Feature code="ufAIM-validation"><Property label="contract" value="7L-1"/><Property label="diagnosticCount" value="${diagnostics.length}"/>${diagnosticXml}</Feature><Alignments>${alignments.map(exportAlignmentXml).join("")}</Alignments></LandXML>`;
			}

			function buildSevenLineSnapshot() {
				return {
					contract: "7L-1",
					sources: loadedFiles.map((loaded) => ({ fileName: loaded.fileName, lsys: loaded.sourceLsysList, objectCount: loaded.objects.length })),
					objects: allViewerEntries().map((entry) => {
						const frame = geoFrameInfo(entry);
						return {
							id: String(entry.item?.id ?? ""),
							kind: entry.item?.kind ?? null,
							lineRole: sevenLineRole(entry),
							track: frame?.track ?? null,
							direction: frame?.direction ?? null,
							lsys: effectiveLsys(entry) || null,
							hsys: systemsForEntry(entry).hsys || null,
							sourceFile: entry.loaded.fileName,
							metadataEdited: Boolean(entry.organizationEdit || entry.frameEdit),
						};
					}),
					diagnostics: validateSevenLineState(),
				};
			}

			async function validateLandXmlRoundTrip(content) {
				const sourceAlignments = allViewerEntries().filter((entry) => entry.item.kind === "alignment" && (entry.item.payload?.coordGeom?.elements ?? []).length);
				const result = await runTechnetImport(new File([content], "technet-viewer-roundtrip.landxml", { type: "application/xml" }));
				const importedAlignments = (result?.items ?? []).filter((item) => item.kind === "alignment");
				const sourceElementCount = sourceAlignments.reduce((sum, entry) => sum + (entry.item.payload?.coordGeom?.elements ?? []).length, 0);
				const importedElementCount = importedAlignments.reduce((sum, item) => sum + (item.payload?.coordGeom?.elements ?? []).length, 0);
				const errors = [];
				if (!result?.ok) errors.push(`Re-Importstatus ${result?.status ?? "unbekannt"}`);
				if (importedAlignments.length !== sourceAlignments.length) errors.push(`Alignments ${sourceAlignments.length} → ${importedAlignments.length}`);
				if (importedElementCount !== sourceElementCount) errors.push(`Geometrieelemente ${sourceElementCount} → ${importedElementCount}`);
				const importedBySourceId = new Map(importedAlignments.map((item) => [String(item.payload?.id ?? ""), item]));
				for (const entry of sourceAlignments) {
					const imported = importedBySourceId.get(String(entry.item.id));
					if (!imported) continue;
					const expectedFrame = geoFrameInfo(entry) ?? {};
					const actual = imported.payload?.extended?.viewer7L ?? {};
					const expected = {
						lineRole: sevenLineRole(entry),
						track: expectedFrame.track ?? "",
						direction: expectedFrame.direction ?? "",
						LSYS: effectiveLsys(entry) ?? "",
						HSYS: systemsForEntry(entry).hsys ?? "",
					};
					for (const key of Object.keys(expected)) {
						if (String(actual[key] ?? "") !== String(expected[key] ?? "")) errors.push(`${entry.item.id}: ${key} „${expected[key]}“ → „${actual[key] ?? ""}“`);
					}
				}
				const expectedProfiles = allViewerEntries().filter((entry) => ["gradientRight", "gradientLeft"].includes(sevenLineRole(entry))).length;
				const expectedCants = allViewerEntries().filter((entry) => ["cantRight", "cantLeft"].includes(sevenLineRole(entry))).length;
				const expectedStaEqs = allViewerEntries().filter((entry) => entry.item.kind === "staEq").length;
				const importedProfiles = (result?.items ?? []).filter((item) => item.kind === "profile").length;
				const importedCants = (result?.items ?? []).filter((item) => item.kind === "cant").length;
				const importedStaEqs = (result?.items ?? []).filter((item) => item.kind === "staEq").length;
				if (importedProfiles !== expectedProfiles) errors.push(`Gradienten ${expectedProfiles} → ${importedProfiles}`);
				if (importedCants !== expectedCants) errors.push(`Überhöhungen ${expectedCants} → ${importedCants}`);
				if (importedStaEqs !== expectedStaEqs) errors.push(`Kilometersprünge ${expectedStaEqs} → ${importedStaEqs}`);
				return {
					ok: errors.length === 0,
					errors,
					sourceAlignments: sourceAlignments.length,
					importedAlignments: importedAlignments.length,
					sourceElementCount,
					importedElementCount,
					expectedProfiles,
					importedProfiles,
					expectedCants,
					importedCants,
					expectedStaEqs,
					importedStaEqs,
				};
			}

			async function downloadLandXml() {
				const content = buildLandXmlExport();
				const parsed = new DOMParser().parseFromString(content, "application/xml");
				if (parsed.getElementsByTagName("parsererror").length) {
					status.classList.add("error");
					status.textContent = "LandXML-Export abgebrochen: erzeugtes XML ist nicht wohlgeformt.";
					return;
				}
				status.classList.remove("error");
				status.textContent = "LandXML wird vor dem Export erneut importiert …";
				const roundTrip = await validateLandXmlRoundTrip(content);
				if (!roundTrip.ok) {
					status.classList.add("error");
					status.textContent = `LandXML-Export abgebrochen: Roundtrip fehlgeschlagen · ${roundTrip.errors.join(" · ")}`;
					return;
				}
				const url = URL.createObjectURL(new Blob([content], { type: "application/xml;charset=utf-8" }));
				const link = document.createElement("a");
				link.href = url;
				link.download = "technet-viewer-7L.landxml";
				link.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
				status.classList.remove("error");
				status.textContent = `LandXML exportiert · Roundtrip bestätigt · ${roundTrip.sourceAlignments} Alignments · ${roundTrip.sourceElementCount} Geometrieelemente.`;
			}

			validate7lButton.addEventListener("click", showSevenLineValidation);
			exportLandxmlButton.addEventListener("click", downloadLandXml);
			window.ufAIMTechnetViewer = Object.freeze({
				contract: "7L-1",
				snapshot: buildSevenLineSnapshot,
				validate: validateSevenLineState,
				landXML: buildLandXmlExport,
				roundTrip: validateLandXmlRoundTrip,
				performance: () => performanceSamples.slice(),
			});

			// landXML files often carry multiple Alignments for one Strecke: a
			// Kilometrierungslinie (real, absolute Bahn-km) plus Richtungs-/
			// Gegenrichtungsgleis alignments whose own staStart restarts near 0
			// (dateilokal) -- confirmed against SCx_1720.xml: A101720S runs
			// km 210695-273008, A101720R/L/M all start near 0. Their profile/cant
			// points inherit that local station too, so on any diagram combining
			// them with the Kilometerlinie they land nowhere near it and get
			// clipped away entirely (clipPointsToRange() against the anchor's
			// range) instead of just looking wrong.
			//
			// Fix: sample the Kilometrierungslinie into a dense polyline, then for
			// every other alignment's element boundaries (which DO carry real
			// easting/northing tied to that alignment's own local station) find the
			// nearest point on that polyline -- its station is the true external
			// station for that local station. Interpolating over those matched
			// pairs gives a local-to-external mapping good for any local station,
			// including profile/cant points (local-station-only, no coordinates of
			// their own). The mapping is kept on the entry as its kmAbbildung and
			// read through elementKmStart, elementKmEnd and pointKm; every consumer
			// (curvatureSeries, pointSeries, stationRangeForEntry) asks those and
			// falls back to the file's own station.
			function landXmlAlignmentDesc(entry) {
				return String(entry?.item?.payload?.meta?.desc ?? "");
			}

			function isLandXmlKilometrierungslinie(entry) {
				return /kilometrierungslinie/i.test(landXmlAlignmentDesc(entry));
			}

			function referenceStationPolyline(alignmentEntry, maximumStep = 10) {
				const points = [];
				const elements = alignmentEntry?.item?.payload?.coordGeom?.elements ?? [];
				for (let elementIndex = 0; elementIndex < elements.length; elementIndex += 1) {
					const element = elements[elementIndex];
					const kmStart = elementKmStart(alignmentEntry, element);
					const elementStart = stationScalar(kmStart ?? element.staStart);
					if (!Number.isFinite(elementStart)) continue;
					const length = Math.abs(numberValue(element.length));
					// Only where the km are the Abbildung onto a Kilometerlinie, which
					// runs one way through the whole Gleis. GND gives a Gleis made of
					// several Verbindungen stations that turn from element to element
					// (WueTreu Gleis 0, 262, 406); following them there would turn the
					// side of everything beside it with each element.
					const stationRun = einordnungStationsgang(elementStart, kmAbbildungPairs(alignmentEntry) ? stationScalar(elementKmEnd(alignmentEntry, element)) : NaN, length);
					// A Knick (GND EKTYP 5) is an element of length 0 carrying the
					// neighbouring Gerade's two points; sampled, it would lay a second,
					// backwards run of that Gerade onto the polyline at one station
					// (Billwerder Strecke 1150: 11 of them, stations jumping 1700 m).
					if (length === 0) continue;
					const sampled = sampleElementSource(element, maximumStep);
					const segments = sampled.length - 1;
					sampled.forEach((point, index) => {
						const ratio = segments > 0 ? index / segments : 0;
						// run: the Lauflänge from the Gleis's first point, monotone and
						// unique where the data's station is not -- GND gives the Bogen
						// elements of a Weiche the Weiche's station (WueTreu Gleis 262:
						// three 21-m Bögen all at 164,1), an unnumbered Gleis of several
						// Verbindungen restarts at 0. The topology walks by run, the
						// Spurplan still shows the station.
						const last = points[points.length - 1];
						const run = last ? last.run + Math.hypot(point.easting - last.easting, point.northing - last.northing) : 0;
						points.push({ easting: point.easting, northing: point.northing, station: elementStart + ratio * stationRun, run, element: elementIndex });
					});
				}
				return points;
			}

			function nearestStationOnPolyline(polyline, easting, northing) {
				let best = null;
				let bestDistanceSq = Infinity;
				for (let i = 0; i < polyline.length - 1; i += 1) {
					const a = polyline[i];
					const b = polyline[i + 1];
					const dx = b.easting - a.easting;
					const dy = b.northing - a.northing;
					const lengthSq = dx * dx + dy * dy;
					const t = lengthSq > 1e-9 ? Math.max(0, Math.min(1, ((easting - a.easting) * dx + (northing - a.northing) * dy) / lengthSq)) : 0;
					const projEasting = a.easting + t * dx;
					const projNorthing = a.northing + t * dy;
					const distanceSq = (easting - projEasting) ** 2 + (northing - projNorthing) ** 2;
					if (distanceSq < bestDistanceSq) {
						bestDistanceSq = distanceSq;
						best = a.station + t * (b.station - a.station);
					}
				}
				return best;
			}

			function landXmlStationMapping(targetEntry, referencePolyline) {
				const elements = targetEntry?.item?.payload?.coordGeom?.elements ?? [];
				const pairs = [];
				for (const element of elements) {
					const local = numberValue(element.staStart);
					if (Number.isFinite(local) && element.start) {
						const external = nearestStationOnPolyline(referencePolyline, element.start.easting, element.start.northing);
						if (Number.isFinite(external)) pairs.push({ local, external });
					}
				}
				const lastElement = elements[elements.length - 1];
				if (lastElement?.end) {
					const local = numberValue(lastElement.staStart) + Math.abs(numberValue(lastElement.length));
					const external = nearestStationOnPolyline(referencePolyline, lastElement.end.easting, lastElement.end.northing);
					if (Number.isFinite(local) && Number.isFinite(external)) pairs.push({ local, external });
				}
				pairs.sort((a, b) => a.local - b.local);
				return pairs;
			}

			function mapLandXmlStation(pairs, localStation) {
				if (!pairs.length || !Number.isFinite(localStation)) return null;
				if (localStation <= pairs[0].local) return pairs[0].external;
				if (localStation >= pairs[pairs.length - 1].local) return pairs[pairs.length - 1].external;
				for (let i = 1; i < pairs.length; i += 1) {
					if (localStation <= pairs[i].local) {
						const a = pairs[i - 1];
						const b = pairs[i];
						const ratio = b.local === a.local ? 0 : (localStation - a.local) / (b.local - a.local);
						return a.external + ratio * (b.external - a.external);
					}
				}
				return pairs[pairs.length - 1].external;
			}

			// The Abbildung of an entry onto its Kilometerlinie: the pairs on the
			// entry, read through elementKmStart/elementKmEnd/pointKm. Nothing is
			// written into the delivered elements and points.
			function applyLandXmlStationMapping(targetEntry, pairs) {
				if (targetEntry) targetEntry.kmAbbildung = { pairs, owner: targetEntry };
			}

			function applyLandXmlStationMappingToPoints(pointsEntry, pairs, owner = null) {
				if (pointsEntry) pointsEntry.kmAbbildung = { pairs, owner };
			}

			function reconcileLandXmlStationing(objects) {
				const alignments = objects.filter((entry) => entry.item.kind === "alignment");
				if (alignments.length < 2) return;
				const reference = alignments.find(isLandXmlKilometrierungslinie);
				if (!reference) return;
				const referencePolyline = referenceStationPolyline(reference);
				if (referencePolyline.length < 2) return;
				for (const target of alignments) {
					if (target === reference) continue;
					const pairs = landXmlStationMapping(target, referencePolyline);
					if (pairs.length < 2) continue;
					applyLandXmlStationMapping(target, pairs);
					target.externalStationReference = reference.item.id;
					// Only this alignment's own profile/cant -- the 7L closure would also
					// hand over the other Gleis's objects and map them twice.
					for (const sibling of referencingEntries(target)) {
						if (sibling.item.kind === "profile" || sibling.item.kind === "cant") {
							applyLandXmlStationMappingToPoints(sibling, pairs, target);
						}
					}
				}
			}

			// ---- Main · Verknüpfung (Bild) ----------------------------------------
			// Every link the viewer makes between two loaded objects, with the
			// reason it was made -- so the user sees the linking itself, not only
			// its result. Nothing here derives a new link; it collects the ones
			// Main already holds: the source relations (GND PAD identity, landXML
			// stationReference), the TRA/GRA file stem, the VermEsn file name,
			// the station projection onto a Kilometerlinie, GND Streckennummern,
			// the topology's touch points, and the user's own hand.
			const LINK_REASONS = {
				identity: "Identität (PAD, GND)",
				relation: "Relation (landXML)",
				file: "Selbe Datei (VermEsn)",
				stem: "Dateistamm (TRA ↔ GRA)",
				name: "Dateiname (Strecke, Seite)",
				projection: "Projektion auf die Kilometerlinie",
				strecke: "Streckennummer (GND)",
				touch: "Berührpunkt (Topologie)",
				user: "per Hand",
			};
			function deriveLinks() {
				const entries = allViewerEntries();
				const byId = new Map(entries.map((entry) => [entry.item.id, entry]));
				const alignments = entries.filter((entry) => entry.item.kind === "alignment");
				const edges = [];
				const seen = new Set();
				// Two objects are one pair by themselves, not by their ids: two
				// deliveries reuse ids, and the second file's edges went missing.
				const add = (from, to, reason, detail = "") => {
					if (!from || !to || from === to) return;
					const a = einordnungKey(from);
					const b = einordnungKey(to);
					if (seen.has(`${a}|${b}|${reason}`) || seen.has(`${b}|${a}|${reason}`)) return;
					seen.add(`${a}|${b}|${reason}`);
					edges.push({ from, to, reason, detail });
				};
				// References as the Bezüge have them (per file), each pair once with
				// its true reason: a VermEsn pair across two files hangs together by
				// the file stem, not by "the same file". The stem pairs come last.
				const bezuege = einordnungBezuegeStand();
				for (const stemPass of [false, true]) {
					for (const from of entries) {
						for (const refKey of bezuege.nodes.get(from)?.refKeys ?? []) {
							const to = bezuege.entries.get(refKey);
							const how = bezuege.origin.get(`${einordnungKey(from)}>${refKey}`);
							const byStem = !how?.user && (Boolean(how?.stem) || (from.parser === "vermEsn" && to?.loaded !== from.loaded));
							if (byStem !== stemPass) continue;
							add(from, to, how?.user ? "user" : byStem ? "stem" : from.parser === "gndEdit" ? "identity" : from.parser === "vermEsn" ? "file" : "relation", how?.user ? "Gradiente von Hand zugeordnet" : how?.detail ?? "");
						}
					}
				}
				const isKm = (sequence) => ["0", "3"].includes(String(sequence?.strRikz ?? ""));
				for (const entry of entries) {
					const nameFrame = vermEsnNameFrame(entry);
					if (nameFrame && nameFrame.side !== "kilometer") {
						const km = alignments.find((candidate) => { const frame = vermEsnNameFrame(candidate); return frame?.side === "kilometer" && frame.track === nameFrame.track && (!nameFrame.segment || !frame.segment || frame.segment === nameFrame.segment); });
						add(entry, km, "name", `Strecke ${nameFrame.track} · ${nameFrame.gleis ?? nameFrame.side}`);
					}
					if (entry.externalStationReference) add(entry, byId.get(entry.externalStationReference), "projection");
					if (entry.frameEdit?.source === "user") {
						const km = alignments.find((candidate) => candidate !== entry && sevenLineSide(candidate) === "kilometer" && geoFrameInfo(candidate)?.track === entry.frameEdit.track);
						add(entry, km, "user", entry.frameEdit.direction ?? "");
					}
					const sequence = gndSequenceForEntry(entry);
					if (sequence && entry.item.kind === "alignment" && !isKm(sequence)) {
						const range = stationRangeForEntry(entry);
						const km = alignments.find((candidate) => {
							const other = gndSequenceForEntry(candidate);
							if (!other || other.strecke !== sequence.strecke || !isKm(other)) return false;
							const otherRange = stationRangeForEntry(candidate);
							return !range || !otherRange || (otherRange.from <= range.to + 5 && otherRange.to >= range.from - 5);
						});
						add(entry, km, "strecke", `Strecke ${sequence.strecke}`);
					}
				}
				for (const node of deriveTopology().nodes) {
					if (!["Weiche", "Kreuzung", "Knoten"].includes(node.kind)) continue;
					const members = [...new Set(node.arms.map((arm) => arm.entry))];
					for (let i = 0; i < members.length; i += 1) for (let j = i + 1; j < members.length; j += 1) add(members[i], members[j], "touch", `${node.kind}${node.km != null ? ` · km ${station(node.km).trim()}` : ""}`);
				}
				const linked = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
				return { entries, edges, unlinked: entries.filter((entry) => !linked.has(entry)) };
			}
			// Row order keeps arcs short: by Strecke, inside it the Kilometerlinie
			// first, then every Gleis followed by the objects that reference it
			// directly, then what is left; objects without a Strecke last.
			function linkRows(links) {
				// landXML names its Strecke only in the desc ("Kilometrierungslinie
				// 1720"); for the picture that is enough to group by.
				const trackOf = (entry) => {
					const frame = geoFrameInfo(entry);
					if (frame && isValidRouteNumber(frame.track)) return `Strecke ${frame.track}`;
					const anchor = entry.item.kind === "alignment" ? entry : relatedDiagramEntries(entry).anchor;
					const fromDesc = /\b(\d{4})\b/.exec(landXmlAlignmentDesc(anchor))?.[1];
					return fromDesc ? `Strecke ${fromDesc}` : "ohne Strecke";
				};
				const groups = groupBy(links.entries, trackOf);
				const keys = [...groups.keys()].sort((a, b) => (a === "ohne Strecke") - (b === "ohne Strecke") || a.localeCompare(b, "de"));
				const sideRank = { kilometer: 0, right: 1, left: 2, unknown: 3 };
				const rows = [];
				for (const key of keys) {
					const members = groups.get(key);
					rows.push({ header: key, count: members.length });
					const placed = new Set();
					const alignmentsHere = members.filter((entry) => entry.item.kind === "alignment")
						.sort((a, b) => sideRank[sevenLineSide(a)] - sideRank[sevenLineSide(b)] || String(a.loaded.fileName).localeCompare(String(b.loaded.fileName), "de") || objectDisplayName(a).localeCompare(objectDisplayName(b), "de"));
					for (const alignment of alignmentsHere) {
						rows.push({ entry: alignment });
						placed.add(alignment);
						for (const own of referencingEntries(alignment)) {
							if (members.includes(own) && !placed.has(own)) { rows.push({ entry: own }); placed.add(own); }
						}
					}
					for (const entry of members) if (!placed.has(entry)) { rows.push({ entry }); placed.add(entry); }
				}
				return rows;
			}
			// Arc diagram: one row per object, one arc per link on the right,
			// coloured by reason; the selected object's arcs stand out, the rest
			// fade. Click on a row selects the object, click on an arc its Gleis.
			function renderLinks() {
				if (!loadedFiles.length) { linksContent.replaceChildren(); linksNote.textContent = ""; linksLegend.replaceChildren(); return; }
				const started = performance.now();
				const links = deriveLinks();
				const rows = linkRows(links);
				// Fit the panel: the label column is as wide as its longest name
				// (at most 55 % of the panel), the arcs take all the rest; a short
				// list spreads its rows over the panel's height (16-24 px) so the
				// arcs are not a thumbnail in the corner.
				const panelWidth = Math.max(320, linksScroll.clientWidth - 24);
				const panelHeight = Math.max(200, linksScroll.clientHeight - 16);
				const TOP = 8;
				const ROW = Math.max(16, Math.min(24, Math.floor((panelHeight - TOP - 8) / Math.max(rows.length, 1))));
				const labelOf = (row) => row.header ? `${row.header} · ${row.count}` : `${row.entry.loaded.fileName} · ${objectListName(row.entry)}${links.unlinked.includes(row.entry) ? " · unverknüpft" : ""}`;
				const longest = Math.max(20, ...rows.map((row) => labelOf(row).length));
				const LABEL_W = Math.min(Math.max(200, Math.ceil(longest * 6.1) + 40), Math.floor(panelWidth * 0.55));
				const ARC_MAX = Math.max(70, panelWidth - LABEL_W - 36);
				const LABEL_CHARS = Math.floor((LABEL_W - 30) / 6.1);
				const WIDTH = LABEL_W + ARC_MAX + 36;
				const height = TOP + rows.length * ROW + 8;
				// Hover: a row lights its arcs and their far ends, an arc its two rows.
				const arcsOf = new Map();
				const rowOf = new Map();
				const hovered = new Set();
				const unhover = () => { for (const element of hovered) element.classList.remove("links-arc-hover", "links-row-hover"); hovered.clear(); svg.classList.remove("links-hovering"); };
				const hover = (elements) => { unhover(); svg.classList.add("links-hovering"); for (const element of elements) { element.classList.add(element.classList.contains("links-arc") ? "links-arc-hover" : "links-row-hover"); hovered.add(element); } };
				const svg = svgElement("svg", { class: "links-svg", width: WIDTH, height, viewBox: `0 0 ${WIDTH} ${height}` });
				const yOf = new Map();
				rows.forEach((row, index) => {
					const y = TOP + index * ROW + ROW / 2;
					if (row.header) {
						const text = svgElement("text", { x: 4, y: y + 4, class: "links-header" });
						text.textContent = `${row.header} · ${row.count}`;
						svg.append(text);
						return;
					}
					yOf.set(row.entry, y);
					const unlinked = links.unlinked.includes(row.entry);
					const group = svgElement("g", { class: `links-node links-${row.entry.item.kind}${row.entry === selectedEntry ? " links-selected" : ""}${unlinked ? " links-unlinked" : ""}` });
					const mark = svgElement("rect", { x: 14, y: y - 4, width: 8, height: 8, rx: row.entry.item.kind === "alignment" ? 0 : 4 });
					const text = svgElement("text", { x: 28, y: y + 4 });
					const name = `${row.entry.loaded.fileName} · ${objectListName(row.entry)}`;
					text.textContent = `${name.length > LABEL_CHARS ? `${name.slice(0, LABEL_CHARS - 1)}…` : name}${unlinked ? " · unverknüpft" : ""}`;
					const title = svgElement("title");
					title.textContent = `${name} · ${familyForEntry(row.entry)}${unlinked ? " · unverknüpft" : ""}`;
					group.append(mark, text, title);
					group.addEventListener("click", () => selectObject(row.entry, row.entry.button ?? null));
					group.addEventListener("mouseenter", () => hover([group, ...(arcsOf.get(row.entry) ?? []).flatMap((arc) => [arc.path, rowOf.get(arc.other)].filter(Boolean))]));
					group.addEventListener("mouseleave", unhover);
					rowOf.set(row.entry, group);
					svg.append(group);
				});
				const counts = {};
				const reasonOrder = Object.keys(LINK_REASONS);
				for (const edge of links.edges) {
					const y1 = yOf.get(edge.from);
					const y2 = yOf.get(edge.to);
					if (y1 == null || y2 == null) continue;
					counts[edge.reason] = (counts[edge.reason] ?? 0) + 1;
					const [a, b] = y1 < y2 ? [y1, y2] : [y2, y1];
					const ry = (b - a) / 2;
					const rx = Math.min(ry, ARC_MAX) + reasonOrder.indexOf(edge.reason) * 3;
					const selected = edge.from === selectedEntry || edge.to === selectedEntry;
					const path = svgElement("path", { d: `M ${LABEL_W} ${a} A ${rx} ${ry} 0 0 1 ${LABEL_W} ${b}`, class: `links-arc links-reason-${edge.reason}${selected ? " links-arc-selected" : ""}` });
					const title = svgElement("title");
					title.textContent = `${LINK_REASONS[edge.reason]}${edge.detail ? ` · ${edge.detail}` : ""}\n${objectListName(edge.from)} ↔ ${objectListName(edge.to)}`;
					path.append(title);
					path.addEventListener("click", () => selectObject(edge.to.item.kind === "alignment" ? edge.to : edge.from, null));
					path.addEventListener("mouseenter", () => hover([path, rowOf.get(edge.from), rowOf.get(edge.to)].filter(Boolean)));
					path.addEventListener("mouseleave", unhover);
					for (const [entry, other] of [[edge.from, edge.to], [edge.to, edge.from]]) {
						if (!arcsOf.has(entry)) arcsOf.set(entry, []);
						arcsOf.get(entry).push({ path, other });
					}
					svg.append(path);
				}
				linksContent.replaceChildren(svg);
				linksLegend.replaceChildren(...reasonOrder.filter((reason) => counts[reason]).map((reason) => {
					const item = document.createElement("span");
					item.className = `legend-item swatch-dot links-legend-item links-reason-${reason}`;
					item.textContent = `${LINK_REASONS[reason]} · ${counts[reason]}`;
					return item;
				}));
				linksNote.textContent = `${links.entries.length} Objekte · ${links.edges.length} Verknüpfungen · ${links.unlinked.length} unverknüpft`;
				linksNote.title = linksNote.textContent;
				recordPerformance("links-render", started, { objects: links.entries.length });
			}

			// ---- Spurplan · Hauptbild ---------------------------------------------
			// The computed Gleis graph as the entry picture: one band per Strecke
			// (per axis the topology used for km), the whole extent, edges coloured
			// by the GWB (today or proposal, the same derivation the diagram
			// uses, per Gleis and cached per input set), Weichen named where the
			// data names them, a km grid, and the shared cursor. Click on an edge
			// selects the Gleis, on a Weiche opens the IVHW.
			const SPURPLAN_SPEED_CLASSES = [[40, "#b42318"], [60, "#d0433f"], [80, "#e08a2b"], [100, "#c9a800"], [120, "#7bb342"], [160, "#2f855a"], [Infinity, "#2b6cb0"]];
			// A stretch without a node longer than this is folded in the Spurplan ...
			const SPURPLAN_GAP_M = 300;
			// ... to this many pixels.
			const SPURPLAN_FOLD_PX = 36;
			// A Weiche's slant from the Stammgleis to the next row, in pixels.
			const SPURPLAN_SLANT_PX = 10;
			function spurplanSpeedColor(v) { return SPURPLAN_SPEED_CLASSES.find(([max]) => v <= max)[1]; }
			const spurplanSpeedCache = new Map();
			let spurplanSvg = null;
			// Zoom per Strecke band: a km window narrower than the band's full
			// extent, kept across re-renders (selection, colouring) and reset by
			// a double click. ⌘/Strg + wheel (a trackpad pinch sends the same)
			// zooms around the mouse's km, a drag pans; a plain wheel still
			// scrolls the panel.
			const SPURPLAN_MIN_WINDOW_M = 100;
			const spurplanZoom = new Map();
			const spurplanBandExtents = new Map();
			function spurplanWindow(label, full) {
				const zoom = spurplanZoom.get(label);
				if (!zoom) return full;
				const span = Math.max(SPURPLAN_MIN_WINDOW_M, Math.min(zoom.xMax - zoom.xMin, full.xMax - full.xMin));
				const xMin = Math.max(full.xMin, Math.min(zoom.xMin, full.xMax - span));
				return { xMin, xMax: xMin + span };
			}
			function spurplanFigureAt(svg, event) {
				const point = svgPointFromEvent(svg, event);
				if (!point) return null;
				const figure = cursorFigures.find((candidate) => candidate.target === svg && candidate.key && point.y >= candidate.y && point.y <= candidate.y + candidate.height);
				if (!figure) return null;
				const ratio = (point.x - figure.left) / (figure.width - figure.left - figure.right);
				return { figure, point, ratio, km: figure.toKm ? figure.toKm(point.x) : figure.xMin + ratio * (figure.xMax - figure.xMin) };
			}
			function wireSpurplanZoom(svg) {
				svg.addEventListener("wheel", (event) => {
					if (!event.ctrlKey && !event.metaKey) return;
					const hit = spurplanFigureAt(svg, event);
					if (!hit) return;
					event.preventDefault();
					const { figure, km } = hit;
					const full = spurplanBandExtents.get(figure.key);
					if (!full) return;
					const span = figure.xMax - figure.xMin;
					const factor = Math.exp(Math.max(-1, Math.min(1, event.deltaY / 100)) * 0.35);
					const nextSpan = Math.max(SPURPLAN_MIN_WINDOW_M, Math.min(full.xMax - full.xMin, span * factor));
					const xMin = km - (km - figure.xMin) * nextSpan / span;
					if (nextSpan >= full.xMax - full.xMin - 1e-6) spurplanZoom.delete(figure.key);
					else spurplanZoom.set(figure.key, { xMin, xMax: xMin + nextSpan });
					scheduleCursor(() => renderSpurplanView());
				}, { passive: false });
				let drag = null;
				svg.addEventListener("pointerdown", (event) => {
					if (event.button !== 0) return;
					const hit = spurplanFigureAt(svg, event);
					if (!hit || !spurplanZoom.has(hit.figure.key)) return;
					drag = { key: hit.figure.key, startX: hit.point.x, xMin: hit.figure.xMin, xMax: hit.figure.xMax, plotWidth: hit.figure.width - hit.figure.left - hit.figure.right, moved: false };
				});
				svg.addEventListener("pointermove", (event) => {
					if (!drag) return;
					const point = svgPointFromEvent(svg, event);
					if (!point) return;
					const shift = (drag.startX - point.x) / drag.plotWidth * (drag.xMax - drag.xMin);
					if (!drag.moved && Math.abs(point.x - drag.startX) < 3) return;
					drag.moved = true;
					const full = spurplanBandExtents.get(drag.key);
					const span = drag.xMax - drag.xMin;
					const xMin = Math.max(full.xMin, Math.min(full.xMax - span, drag.xMin + shift));
					spurplanZoom.set(drag.key, { xMin, xMax: xMin + span });
					scheduleCursor(() => renderSpurplanView());
				});
				const endDrag = () => { drag = null; };
				svg.addEventListener("pointerup", endDrag);
				svg.addEventListener("pointercancel", endDrag);
				svg.addEventListener("pointerleave", endDrag);
				svg.addEventListener("dblclick", (event) => {
					const hit = spurplanFigureAt(svg, event);
					if (!hit || !spurplanZoom.has(hit.figure.key)) return;
					spurplanZoom.delete(hit.figure.key);
					renderSpurplanView();
				});
			}
			function gleisSpeedSections(entry, useProposal) {
				const key = `${entry.item.id}|${useProposal}|${lineSpeedKmh()}|${regelbremswegM()}|${oberbauKey()}|${fahrzeugKey()}`;
				if (spurplanSpeedCache.has(key)) return spurplanSpeedCache.get(key);
				let sections = null;
				try {
					const range = stationRangeForEntry(entry);
					const cant = referencingEntries(entry).find((candidate) => candidate.item.kind === "cant") ?? null;
					const units = deriveGwbProposal(entry, cant, range);
					sections = deriveSpeedSections(units, range, lineSpeedKmh(), useProposal)?.sections ?? null;
				} catch (error) {
					sections = null;
				}
				spurplanSpeedCache.set(key, sections);
				return sections;
			}
			function edgeSpeedSegments(edge, useProposal) {
				const sections = gleisSpeedSections(edge.entry, useProposal);
				if (!sections) return null;
				const low = Math.min(edge.stationFrom, edge.stationTo);
				const high = Math.max(edge.stationFrom, edge.stationTo);
				return sections
					.map((section) => ({ from: Math.max(section.from, low), to: Math.min(section.to, high), v: section.v }))
					.filter((segment) => segment.to > segment.from && Number.isFinite(segment.v));
			}
			function renderSpurplanView() {
				if (!loadedFiles.length) { spurplanContent.replaceChildren(); spurplanNote.textContent = ""; spurplanLegend.replaceChildren(); return; }
				const started = performance.now();
				const topology = deriveTopology();
				const coloring = spurplanColoring.value;
				const panelWidth = Math.max(480, spurplanScroll.clientWidth - 20);
				if (spurplanSvg) cursorFigures = cursorFigures.filter((figure) => figure.target !== spurplanSvg);
				const svg = svgElement("svg", { class: "spurplan-svg" });
				const speeds = new Map();
				if (coloring !== "none") {
					for (const edge of topology.edges) {
						const segments = edgeSpeedSegments(edge, coloring === "proposal");
						if (segments?.length) speeds.set(edge, segments);
					}
				}
				const anchorTrack = selectedEntry ? deliveryTrackOf(selectedEntry) : null;
				let y = 0;
				let bands = 0;
				let junctions = 0;
				// One band per Strecke: a GND Kilometerlinie delivered in pieces
				// (Eifel 2631: 17) is one axis here, not seventeen bands.
				const bandsByLabel = new Map();
				for (const axis of topology.axes ?? []) {
					if (!bandsByLabel.has(axis.label)) bandsByLabel.set(axis.label, { label: axis.label, track: axis.track, axes: new Set() });
					bandsByLabel.get(axis.label).axes.add(axis.index);
				}
				spurplanBandExtents.clear();
				for (const axis of bandsByLabel.values()) {
					const nodes = topology.nodes.filter((node) => axis.axes.has(node.axis) && node.km != null);
					if (!nodes.length) continue;
					const kms = nodes.map((node) => node.km);
					const pad = Math.max(50, (Math.max(...kms) - Math.min(...kms)) * 0.02);
					const full = { xMin: Math.min(...kms) - pad, xMax: Math.max(...kms) + pad };
					spurplanBandExtents.set(axis.label, full);
					const window = spurplanWindow(axis.label, full);
					const zoomed = window.xMin > full.xMin + 1e-6 || window.xMax < full.xMax - 1e-6;
					const zoomFactor = (full.xMax - full.xMin) / Math.max(window.xMax - window.xMin, 1);
					const rowPitch = Math.min(64, Math.round(22 * Math.max(1, Math.sqrt(zoomFactor))));
					// The band is as tall as its nodes and its edges' own rows need --
					// zoomed, only those in the window (Treuchtlingen on Strecke 5310:
					// the yard's rows beyond the window made a 600-m window 1900 px tall).
					const inWindow = (node) => !zoomed || (node.km >= window.xMin && node.km <= window.xMax);
					const edgeInWindow = (edge) => !zoomed || (Math.max(edge.from.km ?? -Infinity, edge.to.km ?? -Infinity) >= window.xMin && Math.min(edge.from.km ?? Infinity, edge.to.km ?? Infinity) <= window.xMax);
					const bandRows = [...nodes.filter((node) => node.row != null && inWindow(node)).map((node) => node.row), ...topology.edges.filter((edge) => edge.row != null && axis.axes.has(edge.from.axis ?? edge.to.axis) && axis.axes.has(edge.from.axis) && axis.axes.has(edge.to.axis) && edgeInWindow(edge)).map((edge) => edge.row)];
					const rowsHere = bandRows.length ? [Math.min(...bandRows), Math.max(...bandRows)] : topology.rows;
					const here = nodes.filter((node) => node.kind === "Weiche" || node.kind === "Kreuzung").length;
					junctions += here;
					// Zoomed, the title counts what the window holds (Billwerder Achse
					// 1150: one Weiche in a 600-m window of a band with 24 Knoten).
					const shown = zoomed ? nodes.filter((node) => node.km >= window.xMin && node.km <= window.xMax) : nodes;
					const shownHere = zoomed ? shown.filter((node) => node.kind === "Weiche" || node.kind === "Kreuzung").length : here;
					y += drawFigureTitle(svg, y, axis.label, `km ${kmLabel(window.xMin)} – ${kmLabel(window.xMax)}${zoomed ? ` von ${kmLabel(full.xMin)} – ${kmLabel(full.xMax)} · Ausschnitt, Doppelklick zeigt alles` : ""} · ${zoomed ? `${shown.length} von ${nodes.length} Knoten · ${shownHere} von ${here}` : `${nodes.length} Knoten · ${here}`} Weichen/Kreuzungen`, panelWidth);
					y += drawSpurplan(svg, y, topology, window.xMin, window.xMax, selectedEntry, {
						axes: axis.axes,
						width: panelWidth,
						speeds,
						cursorFrame: axis.track && axis.track === anchorTrack ? "axis" : null,
						junctionLabels: true,
						figureKey: axis.label,
						rowPitch,
						rows: rowsHere,
						fold: !zoomed,
					});
					y += 10;
					bands += 1;
				}
				if (!bands) y += drawEmptyFigure(svg, y, topology.gleise > 1 ? "kein Knoten an einer Achse · Spurplan nicht zeichenbar" : "ein Gleis allein hat keine Topologie");
				svg.setAttribute("viewBox", `0 0 ${panelWidth} ${y}`);
				svg.setAttribute("width", panelWidth);
				svg.setAttribute("height", y);
				spurplanContent.replaceChildren(svg);
				spurplanSvg = svg;
				svg.addEventListener("mousemove", (event) => scheduleCursor(() => cursorFromFigureEvent(svg, event)));
				wireSpurplanZoom(svg);
				drawDiagramCursor();
				spurplanLegend.replaceChildren(...(coloring === "none" ? [] : SPURPLAN_SPEED_CLASSES.map(([max, color], index) => {
					const item = document.createElement("span");
					item.className = "legend-item spurplan-legend-item";
					item.style.setProperty("--speed-color", color);
					item.textContent = index === SPURPLAN_SPEED_CLASSES.length - 1 ? `> ${SPURPLAN_SPEED_CLASSES[index - 1][0]} km/h` : `≤ ${max}`;
					return item;
				})));
				spurplanNote.textContent = `${bands} ${bands === 1 ? "Strecke" : "Strecken"} · ${topology.gleise} Gleise · ${junctions} Weichen/Kreuzungen ${!topology.fromData ? "gerechnet" : topology.computedGleise ? "aus den Daten und gerechnet" : "aus den Daten"} · ${coloring === "none" ? "ohne Färbung" : `${speeds.size}/${topology.edges.length} Kanten nach GWB ${coloring === "proposal" ? "Vorschlag" : "heute"} gefärbt`}`;
				spurplanNote.title = spurplanNote.textContent;
				recordPerformance("spurplan-render", started, { bands, edges: topology.edges.length });
				scheduleStateSave();
			}

			// ---- Main · Lieferung (Bild) ------------------------------------------
			// The whole delivery as one picture: per Strecke a km axis, per Trasse
			// a bar where its Krümmung lies and thinner bars where its own
			// Gradiente and Überhöhung cover it, Stationsgleichungen as ticks,
			// Weichen from the topology as marks. Only objects that live in the
			// Strecke's km frame sit on its axis (GND external stationing, VermEsn
			// Kilometerlinie or projected, landXML Kilometrierungslinie or
			// reconciled); everything with file-local stations is listed apart
			// with a local axis, so a local 0-88 m never lands on km 0.
			function deliveryTrackOf(entry) {
				const referenced = entry.externalStationReference ? allViewerEntries().find((candidate) => candidate.item.id === entry.externalStationReference) : null;
				if (referenced && referenced !== entry) return deliveryTrackOf(referenced);
				const frame = geoFrameInfo(entry);
				if (frame && isValidRouteNumber(frame.track)) return frame.track;
				const anchor = entry.item.kind === "alignment" ? entry : relatedDiagramEntries(entry).anchor;
				return /\b(\d{4})\b/.exec(landXmlAlignmentDesc(anchor))?.[1] ?? null;
			}
			function inKilometerFrame(entry) {
				if (entry.externalStationReference) return true;
				const frame = geoFrameInfo(entry);
				if (frame?.source === "gnd") return !frame.selfReferencing;
				if (entry.parser === "vermEsn") return vermEsnNameFrame(entry)?.side === "kilometer";
				if (entry.parser === "landXML") return isLandXmlKilometrierungslinie(entry);
				return false;
			}
			function deriveDelivery() {
				const alignments = allViewerEntries().filter((entry) => entry.item.kind === "alignment" && stationRangeForEntry(entry));
				const sideRank = { kilometer: 0, right: 1, left: 2, unknown: 3 };
				// A row holds one Trasse -- or, for a GND Kilometerlinie delivered in
				// pieces (Eifel 2631: 17), all pieces of one Strecke in a single row,
				// because it is one line.
				const rowFor = (entry) => {
					const own = referencingEntries(entry);
					return {
						entry,
						entries: [entry],
						ranges: [stationRangeForEntry(entry)],
						profiles: [stationRangeForEntry(own.find((candidate) => candidate.item.kind === "profile"))].filter(Boolean),
						cants: [stationRangeForEntry(own.find((candidate) => candidate.item.kind === "cant"))].filter(Boolean),
						staEqs: own.filter((candidate) => candidate.item.kind === "staEq").flatMap(stationEquationPositions),
						junctions: [],
					};
				};
				const mergeKilometerPieces = (rows) => {
					const pieces = rows.filter((row) => sevenLineSide(row.entry) === "kilometer" && row.entry.parser === "gndEdit");
					if (pieces.length < 2) return rows;
					pieces.sort((a, b) => a.ranges[0].from - b.ranges[0].from);
					const merged = {
						entry: pieces[0].entry,
						entries: pieces.map((row) => row.entry),
						ranges: pieces.flatMap((row) => row.ranges),
						profiles: pieces.flatMap((row) => row.profiles),
						cants: pieces.flatMap((row) => row.cants),
						staEqs: pieces.flatMap((row) => row.staEqs),
						junctions: [],
					};
					return [merged, ...rows.filter((row) => !pieces.includes(row))];
				};
				const sortRows = (rows) => rows.sort((a, b) => sideRank[sevenLineSide(a.entry)] - sideRank[sevenLineSide(b.entry)] || a.ranges[0].from - b.ranges[0].from || objectDisplayName(a.entry).localeCompare(objectDisplayName(b.entry), "de"));
				const groups = [];
				const byTrack = groupBy(alignments.filter((entry) => inKilometerFrame(entry) && deliveryTrackOf(entry)), deliveryTrackOf);
				for (const track of [...byTrack.keys()].sort()) {
					const rows = sortRows(mergeKilometerPieces(byTrack.get(track).map(rowFor)));
					const spans = rows.flatMap((row) => [...row.ranges, ...row.profiles, ...row.cants]);
					groups.push({ label: `Strecke ${track}`, track, rows, from: Math.min(...spans.map((span) => span.from)), to: Math.max(...spans.map((span) => span.to)), local: false });
				}
				const local = alignments.filter((entry) => !(inKilometerFrame(entry) && deliveryTrackOf(entry)));
				if (local.length) {
					const rows = sortRows(local.map(rowFor));
					groups.push({ label: "ohne Strecke · lokale Stationen je Trasse", track: null, rows, from: 0, to: Math.max(...rows.map((row) => row.ranges[0].to - row.ranges[0].from)), local: true });
				}
				const rowsByEntry = new Map(groups.flatMap((group) => group.rows.flatMap((row) => row.entries.map((entry) => [entry, row]))));
				for (const node of deriveTopology().nodes) {
					if (!["Weiche", "Kreuzung"].includes(node.kind) || node.km == null) continue;
					for (const entry of new Set(node.arms.map((arm) => arm.entry))) {
						const row = rowsByEntry.get(entry);
						if (row && !row.junctions.includes(node)) row.junctions.push(node);
					}
				}
				return groups;
			}
			// km with one decimal, and never "-0,0" for a Strecke that starts at 0.
			function kmLabel(station) {
				const value = Math.round(station / 100) / 10;
				return (value === 0 ? 0 : value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
			}
			function niceStep(span, target = 8) {
				const raw = Math.max(span / target, 1);
				const power = 10 ** Math.floor(Math.log10(raw));
				return [1, 2, 5, 10].map((factor) => factor * power).find((step) => step >= raw);
			}
			function renderDelivery() {
				if (!loadedFiles.length) { deliveryContent.replaceChildren(); deliveryNote.textContent = ""; return; }
				const started = performance.now();
				const groups = deriveDelivery();
				deliveryCursorGroups = [];
				const panelWidth = Math.max(360, deliveryScroll.clientWidth - 24);
				const LABEL_W = Math.min(220, Math.max(150, Math.round(panelWidth * 0.32)));
				const PLOT_W = panelWidth - LABEL_W - 16;
				const ROW = 22, HEADER = 22, AXIS = 18, GAP = 12, TOP = 6;
				let height = TOP;
				for (const group of groups) height += HEADER + AXIS + group.rows.length * ROW + GAP;
				const svg = svgElement("svg", { class: "delivery-svg", width: panelWidth, height, viewBox: `0 0 ${panelWidth} ${height}` });
				let y = TOP;
				let junctionCount = 0;
				for (const group of groups) {
					const span = Math.max(group.to - group.from, 1);
					const xAt = (station) => LABEL_W + Math.max(0, Math.min(1, (station - group.from) / span)) * PLOT_W;
					const header = svgElement("text", { x: 4, y: y + 14, class: "delivery-header" });
					header.textContent = `${group.label} · ${group.rows.length} Trassen${group.local ? "" : ` · km ${kmLabel(group.from)} – ${kmLabel(group.to)}`}`;
					svg.append(header);
					y += HEADER;
					const axis = svgElement("g", { class: "delivery-axis" });
					axis.append(svgElement("line", { x1: LABEL_W, x2: LABEL_W + PLOT_W, y1: y + AXIS - 4, y2: y + AXIS - 4 }));
					const step = niceStep(span, Math.max(4, Math.floor(PLOT_W / 70)));
					const rowsTop = y + AXIS;
					const rowsBottom = rowsTop + group.rows.length * ROW;
					if (!group.local) deliveryCursorGroups.push({ track: group.track, from: group.from, to: group.to, labelW: LABEL_W, plotW: PLOT_W, top: rowsTop, bottom: rowsBottom });
					for (let tick = Math.ceil(group.from / step) * step; tick <= group.to + 1e-6; tick += step) {
						const x = xAt(tick);
						axis.append(svgElement("line", { x1: x, x2: x, y1: y + AXIS - 8, y2: y + AXIS - 4 }));
						const label = svgElement("text", { x, y: y + AXIS - 10, "text-anchor": "middle" });
						label.textContent = group.local ? `${Math.round(tick)} m` : kmLabel(tick);
						axis.append(label);
						svg.append(svgElement("line", { x1: x, x2: x, y1: rowsTop, y2: rowsBottom, class: "delivery-grid" }));
					}
					svg.append(axis);
					y += AXIS;
					for (const row of group.rows) {
						const offset = group.local ? row.ranges[0].from : 0;
						const g = svgElement("g", { class: `delivery-row${row.entries.includes(selectedEntry) ? " delivery-selected" : ""}` });
						const label = svgElement("text", { x: 4, y: y + 14 });
						const name = `${objectListName(row.entry)}${row.entries.length > 1 ? ` · ${row.entries.length} Stücke` : ""} · ${row.entry.loaded.fileName}`;
						const chars = Math.floor((LABEL_W - 10) / 6.1);
						label.textContent = name.length > chars ? `${name.slice(0, chars - 1)}…` : name;
						g.append(label);
						const bar = (range, cls, top, h) => {
							if (!range) return;
							const x1 = xAt(range.from - offset), x2 = xAt(range.to - offset);
							const rect = svgElement("rect", { x: x1, y: y + top, width: Math.max(1, x2 - x1), height: h, class: cls });
							g.append(rect);
						};
						for (const range of row.profiles) bar(range, "delivery-profile", 4, 3);
						for (const range of row.ranges) bar(range, group.local ? "delivery-alignment delivery-local" : "delivery-alignment", 8, 6);
						for (const range of row.cants) bar(range, "delivery-cant", 15, 3);
						for (const station of row.staEqs) g.append(svgElement("rect", { x: xAt(station - offset) - 1, y: y + 6, width: 2, height: 10, class: "delivery-staeq" }));
						for (const node of row.junctions) {
							if (group.local) continue;
							const x = xAt(node.km);
							if (node.km < group.from || node.km > group.to) continue;
							junctionCount += 1;
							const mark = svgElement("path", { d: `M ${x} ${y + 3} l 4 7 h -8 z`, class: "delivery-junction" });
							const title = svgElement("title");
							title.textContent = `${node.kind} · km ${station(node.km).trim()} · ${node.names.join(" / ")}`;
							mark.append(title);
							mark.addEventListener("click", (event) => { event.stopPropagation(); activateJunctionCluster(junctionFromNode(node)); });
							g.append(mark);
						}
						const title = svgElement("title");
						const fmt = (ranges) => ranges.length ? ranges.map((range) => `${station(range.from).trim()} – ${station(range.to).trim()}`).join(", ") : "fehlt";
						title.textContent = `${name}\nKrümmung ${fmt(row.ranges)}\nGradiente ${fmt(row.profiles)}\nÜberhöhung ${fmt(row.cants)}${row.staEqs.length ? `\n${row.staEqs.length} Stationsgleichung(en)` : ""}`;
						g.append(title);
						g.addEventListener("click", () => selectObject(row.entry, row.entry.button ?? null));
						svg.append(g);
						y += ROW;
					}
					y += GAP;
				}
				deliveryContent.replaceChildren(svg);
				deliverySvg = svg;
				svg.addEventListener("mousemove", (event) => scheduleCursor(() => {
					const point = svgPointFromEvent(svg, event);
					if (!point || !cursorContext?.inKm) return;
					const group = deliveryCursorGroups.find((candidate) => candidate.track === cursorContext.track && point.y >= candidate.top - 4 && point.y <= candidate.bottom);
					if (!group) return;
					const ratio = (point.x - group.labelW) / group.plotW;
					if (ratio < 0 || ratio > 1) return;
					setCursor(group.from + ratio * (group.to - group.from));
				}));
				drawDeliveryCursor();
				const trassen = groups.reduce((sum, group) => sum + group.rows.length, 0);
				const missing = groups.flatMap((group) => group.rows).filter((row) => !row.profiles.length || !row.cants.length).length;
				deliveryNote.textContent = `${groups.filter((group) => !group.local).length} Strecken · ${trassen} Trassen · ${missing} ohne Gradiente oder Überhöhung · ${junctionCount} Weichenmarken`;
				deliveryNote.title = deliveryNote.textContent;
				recordPerformance("delivery-render", started, { trassen });
			}

			// The same reconciliation for VermEsn, across files: the Gleise of a
			// Strecke arrive as separate TRA files whose stations restart at 0
			// (5500R074-082.TRA: 0-8503 m) while the S file carries Bahn-km
			// (5500S074-082.TRA: 73860-82361). Once both are loaded, every Gleis of
			// that Strecke and km-Abschnitt is projected onto the Kilometerlinie.
			// A Gleis whose own stations already lie inside the Kilometerlinie's
			// range keeps them (5720R000_Gls403: 29000-38877 like 5720S) --
			// delivered km beat projected km. Profile/cant points follow only when
			// they share the TRA's local frame; 5500R074-082.GRA already carries
			// km 73910-80510 and stays. Runs after every VermEsn file and marks
			// each finished Gleis (externalStationReference), so it is idempotent.
			// A TRA that names no Strecke (W403-404, Gls401v) is projected onto
			// the Kilometerlinie both its ends lie within TOPOLOGY_KM_MAX_DISTANCE_M
			// of -- the same distance the topology accepts for a node's km -- so a
			// Weiche picked in the Spurplan shows its own TRA/GRA at the Strecke's km.
			function reconcileVermEsnStationing() {
				const alignments = allViewerEntries().filter((entry) => entry.item.kind === "alignment" && entry.parser === "vermEsn");
				const named = alignments.filter((entry) => vermEsnNameFrame(entry));
				const rangeLength = (entry) => { const range = stationRangeForEntry(entry); return range ? range.to - range.from : 0; };
				const within = (inner, outer, slack) => inner && outer && inner.from >= outer.from - slack && inner.to <= outer.to + slack;
				// Landshut names the Abschnitt as a range (074-082) on every file,
				// Eifel only its start km (139, 142, 148) while the one Kilometerlinie
				// K139 runs through all of them: a start-only segment is compatible
				// with any reference and project() decides by range and geometry.
				const compatibleSegment = (a, b) => !a.segment || !b.segment || a.segment === b.segment || !a.segment.includes("-") || !b.segment.includes("-");
				const polylines = new Map();
				const polylineOf = (reference) => {
					if (!polylines.has(reference)) polylines.set(reference, referenceStationPolyline(reference));
					return polylines.get(reference);
				};
				// trustDelivered: a named Gleis whose stations already lie in the
				// Kilometerlinie's range keeps them; a singleton's stations are
				// file-local by nature (W403-404.TRA: 0-88 m) and are always projected.
				const project = (target, reference, trustDelivered) => {
					const localRange = stationRangeForEntry(target);
					const referenceRange = stationRangeForEntry(reference);
					if (!localRange || !referenceRange) return;
					const polyline = verbunden.get(target)?.polyline ?? polylineOf(reference);
					// Delivered stations are kept where they are the line's km by the
					// Lage too, not by their numbers alone (einordnungStationenGelten).
					const ends = alignmentEndpoints(target);
					const onLine = ends && polyline.length > 1 ? [ends.start, ends.end].map((point) => distanceAndStationOnPolyline(polyline, point).station) : null;
					const projectedRange = onLine ? { from: Math.min(...onLine), to: Math.max(...onLine) } : null;
					if (trustDelivered && within(localRange, referenceRange, 50) && einordnungStationenGelten(localRange, projectedRange, ordnungAnnahmen.ueberstand, ordnungAnnahmen.genau)) { target.externalStationReference = reference.item.id; return; }
					if (polyline.length < 2) return;
					const pairs = landXmlStationMapping(target, polyline);
					if (pairs.length < 2) return;
					if (!einordnungLaengentreu(pairs[pairs.length - 1].local - pairs[0].local, pairs[pairs.length - 1].external - pairs[0].external)) return;
					applyLandXmlStationMapping(target, pairs);
					listingCache.delete(target);
					for (const sibling of referencingEntries(target)) {
						if (sibling.item.kind !== "profile" && sibling.item.kind !== "cant") continue;
						if (!within(stationRangeForEntry(sibling), localRange, 50)) continue;
						applyLandXmlStationMappingToPoints(sibling, pairs, target);
						listingCache.delete(sibling);
					}
					target.externalStationReference = reference.item.id;
				};
				// The Kilometerlinie of a Gleis is decided by where it lies
				// (einordnungBezugslinie): each candidate line is measured from the
				// Gleis's two ends, and a Gleis that fits none stays unprojected
				// until its line is loaded. The name only narrows the candidates --
				// same Strecke, compatible Abschnitt, longest line first, equal ones
				// by name so that the order of loading decides nothing.
				// And it is decided anew every time: a Gleis that was stationed on
				// the only line known so far is taken off it and put onto the better
				// one when that arrives (Landshut loaded backwards: Gls404 on 5632 at
				// km 0,5 to -0,3 until 5500 came). The Abbildung is dropped first, so
				// the Gleis is measured in its own stations again.
				const unproject = kmAbbildungLoesen;
				const settle = (target, reference, trustDelivered) => {
					if (!reference || target.externalStationReference === reference.item.id) return;
					if (target.externalStationReference) unproject(target);
					project(target, reference, trustDelivered);
				};
				const byLengthThenName = (a, b) => rangeLength(b) - rangeLength(a) || objectDisplayName(a).localeCompare(objectDisplayName(b)) || String(a.loaded?.fileKey ?? "").localeCompare(String(b.loaded?.fileKey ?? ""));
				// byHand: the Gleis was sorted into this Strecke by the user. Then a
				// line it does not fit end to end may still be its line
				// (einordnungBezugslinieVonHand), and what was decided is kept on the
				// Gleis for the picture to say (kmHinweis): stationed from farther
				// away, or without km and why.
				const lagen = new Map();
				const lageOf = (reference) => {
					if (!lagen.has(reference)) lagen.set(reference, { polyline: polylineOf(reference) });
					return lagen.get(reference);
				};
				// Gleise lying across the joint of two pieces of their line: the two
				// pieces as one polyline, for project() to station them on.
				const verbunden = new Map();
				const pickReference = (target, references, byHand = false) => {
					if (byHand) delete target.kmHinweis;
					const ends = alignmentEndpoints(target);
					if (!ends) return null;
					const profile = referencingEntries(target).find((sibling) => sibling.item.kind === "profile");
					const profileRange = profile ? stationRangeForEntry(profile) : null;
					const candidates = references.map((reference) => {
						const polyline = polylineOf(reference);
						const hits = polyline.length < 2 ? [null, null] : [ends.start, ends.end].map((point) => distanceAndStationOnPolyline(polyline, point));
						return { key: reference, distanceStart: hits[0]?.distance ?? NaN, distanceEnd: hits[1]?.distance ?? NaN, onLine: Boolean(hits[0] && hits[1]) && !hits[0].atEnd && !hits[1].atEnd, holdsProfile: Boolean(within(profileRange, stationRangeForEntry(reference), 50)) };
					});
					const fits = einordnungBezugslinie(candidates, TOPOLOGY_KM_MAX_DISTANCE_M);
					if (fits || !byHand) return fits;
					// No single line from end to end: two pieces of the Strecke's line
					// that meet, with the Gleis across their joint.
					const stuecke = references.map((reference) => {
						const polyline = polylineOf(reference);
						const point = (item) => ({ x: item.easting, y: item.northing, station: item.station });
						return polyline.length < 2 ? null : { key: reference, first: point(polyline[0]), last: point(polyline[polyline.length - 1]) };
					}).filter(Boolean);
					for (const folge of einordnungStueckfolgen(stuecke)) {
						const first = polylineOf(folge.a);
						const run = first[first.length - 1].run ?? 0;
						const joined = [...first, ...polylineOf(folge.b).map((item) => ({ ...item, run: (item.run ?? 0) + run }))];
						const hits = [ends.start, ends.end].map((point) => distanceAndStationOnPolyline(joined, point));
						if (hits.some((hit) => !hit || hit.atEnd || hit.distance > TOPOLOGY_KM_MAX_DISTANCE_M)) continue;
						const stoss = first[first.length - 1].station;
						verbunden.set(target, { polyline: joined });
						target.kmHinweis = { art: "stuecke", linie: folge.a, zweite: folge.b, stoss };
						// The piece that carries more of the Gleis stands as its line.
						const stations = hits.map((hit) => hit.station);
						return Math.abs(stoss - Math.min(...stations)) >= Math.abs(Math.max(...stations) - stoss) ? folge.a : folge.b;
					}
					// How much of the Gleis runs beside a line, for the lines one of
					// its ends comes near at all.
					const own = referenceStationPolyline(target, 10);
					for (const candidate of candidates) {
						const measured = Math.min(candidate.distanceStart, candidate.distanceEnd) <= ordnungAnnahmen.kmFern ? lageAbstandOf(own, lageOf(candidate.key), ordnungAnnahmen.reichweite) : null;
						candidate.share = measured?.samples ? measured.hits / measured.samples : 0;
					}
					const far = einordnungBezugslinieVonHand(candidates, ordnungAnnahmen.kmFern, ordnungAnnahmen.anteil / 100);
					if (far) {
						const candidate = candidates.find((item) => item.key === far);
						target.kmHinweis = { art: "fern", linie: far, anteil: candidate.share, abstand: Math.max(candidate.distanceStart, candidate.distanceEnd) };
						return far;
					}
					const why = einordnungOhneBezugslinie(candidates, ordnungAnnahmen.kmFern, ordnungAnnahmen.anteil / 100);
					target.kmHinweis = { art: "ohne", grund: why.grund, linie: why.key ?? null, anteil: why.share ?? null, abstand: why.distance ?? null };
					return null;
				};
				const allReferences = [];
				for (const [, entries] of groupBy(named, (entry) => vermEsnNameFrame(entry).track)) {
					const references = entries.filter((entry) => vermEsnNameFrame(entry).side === "kilometer").sort(byLengthThenName);
					allReferences.push(...references);
					for (const target of entries) {
						const targetFrame = vermEsnNameFrame(target);
						if (targetFrame.side === "kilometer") continue;
						settle(target, pickReference(target, references.filter((candidate) => compatibleSegment(vermEsnNameFrame(candidate), targetFrame))), true);
					}
				}
				allReferences.sort(byLengthThenName);
				// Where two Strecken run side by side (Landshut: 5500 and 5632 through
				// the Bahnhof), a singleton's GRA decides -- W403-404.GRA is delivered
				// at km 75008-75099, inside 5500's Kilometerlinie, so that one wins
				// over the merely nearer 5632. Without a GRA, the nearer line wins.
				const namedByHand = (entry) => entry.frameEdit?.source === "user" && sevenLineSide(entry) === "kilometer";
				for (const target of alignments) {
					if (vermEsnNameFrame(target)) continue;
					// A line the user named a Kilometerlinie is stationed on nothing.
					if (namedByHand(target)) { if (target.externalStationReference) unproject(target); continue; }
					settle(target, pickReference(target, allReferences), false);
				}
				// What the user sorted by hand: a Gleis sorted into a Strecke is
				// stationed on that Strecke's Kilometerlinie, be it named by a file
				// or by the user. The user's word comes last and so wins over the
				// name's; a Gleis whose stations already lie in the line's km,
				// by their numbers and by the Lage, keeps them (Billwerder 6100 RE
				// beside 6100 KM).
				const sortedByHand = alignments.filter((entry) => entry.frameEdit?.source === "user" && !namedByHand(entry));
				for (const entry of alignments) if (entry.kmHinweis && !sortedByHand.includes(entry)) delete entry.kmHinweis;
				for (const [track, entries] of groupBy(sortedByHand, (entry) => String(entry.frameEdit.track))) {
					const references = alignments.filter((entry) => sevenLineSide(entry) === "kilometer" && String(geoFrameInfo(entry)?.track) === track).sort(byLengthThenName);
					for (const target of entries) {
						const reference = pickReference(target, references, true);
						// No line of the Strecke the user named, but the Lage alone had
						// found one of another Strecke (Landshut Gls409, sorted into
						// 5632, lies end to end on 5500 and its GRA is in 5500's km):
						// the km stay, they are what the files say, and the picture
						// names the contradiction instead of dropping either side.
						if (!reference && target.externalStationReference && target.kmHinweis) {
							target.kmHinweis = { ...target.kmHinweis, art: "fremd", von: alignments.find((entry) => entry.item.id === target.externalStationReference) ?? null };
						}
						settle(target, reference, true);
						if (reference && !target.externalStationReference) target.kmHinweis = { art: "ohne", grund: "laenge", linie: reference };
					}
				}
				// GND: a Nebengleis or Bahnhofsgleis counts its stations from its
				// own start. Sorted into a Strecke by hand it is put onto the
				// Kilometerlinie of that Strecke it lies beside, in its own
				// Lagesystem (WueTreu carries a Strecke in up to four), like a TRA
				// that names no Strecke; its own stations are never the Strecke's km
				// (WueTreu: 179 of 194 lie beside their line, at km 94,3 or 139,8,
				// each counted from 0). One that fits no line stays in its own
				// stations and is no km there (kmFrame in the Einordnung); taken
				// out of the Strecke again it has its own stations back.
				let gndChanged = false;
				for (const target of allViewerEntries()) {
					if (target.item.kind !== "alignment" || !gndEigenstationiert(target)) continue;
					const before = target.externalStationReference;
					const byHand = target.frameEdit?.source === "user" && sevenLineSide(target) !== "kilometer";
					const lsys = effectiveLsys(target) || "";
					const reference = !byHand ? null : pickReference(target, allViewerEntries().filter((entry) => entry !== target && entry.item.kind === "alignment" && sevenLineSide(entry) === "kilometer"
						&& String(geoFrameInfo(entry)?.track) === String(target.frameEdit.track) && (effectiveLsys(entry) || "") === lsys).sort(byLengthThenName), true);
					if (!byHand) delete target.kmHinweis;
					if (reference) settle(target, reference, false);
					else if (kmAbbildungPairs(target)) unproject(target);
					if (reference && !target.externalStationReference) target.kmHinweis = { art: "ohne", grund: "laenge", linie: reference };
					// Without km in the Strecke it was sorted into: the Kilometerlinie
					// of another Strecke it lies along end to end is named, so that
					// the user can sort it there. Named only; nothing is moved.
					if (target.kmHinweis?.art === "ohne") {
						const passt = pickReference(target, allViewerEntries().filter((entry) => entry !== target && entry.item.kind === "alignment" && sevenLineSide(entry) === "kilometer"
							&& String(geoFrameInfo(entry)?.track) !== String(target.frameEdit.track) && (effectiveLsys(entry) || "") === lsys).sort(byLengthThenName));
						if (passt) target.kmHinweis.passt = passt;
					}
					if (target.externalStationReference !== before) gndChanged = true;
				}
				if (gndChanged) einordnungGeaendert();
			}

			function renderResultObjects(result, fileName, { deferRender = false } = {}) {
				const objects = (result?.items ?? [])
					.filter((item) =>
						(item?.kind === "alignment" && count(item?.payload?.coordGeom?.elements) > 0) ||
						(["profile", "cant"].includes(item?.kind) && count(item?.payload?.points) > 0) ||
						(item?.kind === "staEq" && count(item?.payload?.equations) > 0)
					)
					.map((item) => ({
						item,
						parser: result?.meta?.sourceFormat ?? result?.meta?.parserId ?? null,
						references: result?.meta?.referenceEvidence ?? null,
					}));
				if (!objects.length) return false;
				const sourceLsysList = sourceLsysValues(objects);
				const sourceLsys = sourceLsysList.length === 1 ? sourceLsysList[0] : "";
				const loadedFile = {
					fileName,
					fileKey: einordnungDateischluessel(fileName, loadedFiles.map((loaded) => loaded.fileName)),
					objects,
					relations: Array.isArray(result?.relationCandidates) ? result.relationCandidates : [],
					importDiagnostics: Array.isArray(result?.meta?.diagnostics) ? result.meta.diagnostics : [],
					sourceEnvelope: result?.sourceEnvelope ?? null,
					normalizedSourceLayer: result?.normalizedSourceLayer ?? null,
					sourceLsys,
					sourceLsysList,
					sourceLsysMixed: sourceLsysList.length > 1,
					displayLsys: sourceLsys,
					displayLsysSource: sourceLsys ? "source" : "missing",
				};
				for (const entry of objects) entry.loaded = loadedFile;
				loadedFiles.push(loadedFile);
				geometryModelCache = new WeakMap();
				if (objects[0]?.parser === "landXML") reconcileLandXmlStationing(objects);
				for (const entry of objects) markBlossHalfWaves(entry.item?.payload?.coordGeom?.elements ?? []);
				if (objects[0]?.parser === "vermEsn") reconcileVermEsnStationing();
				validate7lButton.disabled = false;
				exportLandxmlButton.disabled = !allViewerEntries().some((entry) => entry.item.kind === "alignment");
				if (!deferRender) {
					viewer.classList.remove("inbox-collapsed", "outbox-collapsed");
					toggleInbox.setAttribute("aria-pressed", "true");
					toggleInbox.textContent = "‹";
					toggleOutbox.setAttribute("aria-pressed", "true");
					toggleOutbox.textContent = "›";
					renderObjectTree(fileName);
					output.classList.add("hidden");
					dropzone.classList.add("loaded");
					setViewMode(startViewMode());
				}
				return true;
			}

			async function inspectFile(file, options = {}) {
				const started = performance.now();
				const logLines = [];
				status.classList.remove("error");
				status.textContent = `${file.name} wird verarbeitet …`;

				try {
					const result = await runTechnetImport(file, {
						log: (message) => logLines.push(String(message)),
						onJobPhase: (phase) => {
							status.textContent = `${file.name}: ${phase} …`;
							progress.step(phase);
						},
						onImportPhase: ({ code }) => {
							status.textContent = `${file.name}: ${code} …`;
						}
					});
					status.textContent = result?.ok
						? `${file.name}: Import erfolgreich.`
						: `${file.name}: ${result?.status ?? "Import nicht erfolgreich"}.`;
					output.textContent = summarize(file, result, logLines);
					renderResultObjects(result, file.name, options);
					if (!result?.ok) status.classList.add("error");
					recordPerformance("import", started, { file: file.name, items: result?.items?.length ?? 0 });
					return result;
				} catch (error) {
					status.classList.add("error");
					status.textContent = `${file.name}: Verarbeitung fehlgeschlagen.`;
					output.textContent = [
						error?.stack ?? String(error),
						"",
						"Pipeline-Protokoll",
						logLines.join("\n")
					].join("\n");
					recordPerformance("import-error", started, { file: file.name });
					return { ok: false, viewerImportError: error?.message ?? String(error) };
				}
			}

			async function inspectFiles(files, { reopening = false } = {}) {
				const batchStarted = performance.now();
				// A delivery that is imported without reopening the stored one
				// replaces it in the browser: the store holds one delivery, not a
				// history.
				if (!reopening && !viewerStore.sessionStarted) await viewerStore.clear();
				viewerStore.sessionStarted = true;
				sessionOffer.classList.add("hidden");
				// The load's own first selection must not move the map or zoom the
				// Spurplan: a fresh delivery shows itself whole.
				followSuppressed = true;
				try {
					await inspectFilesBatch(files, batchStarted);
				} finally {
					followSuppressed = false;
				}
			}
			async function inspectFilesBatch(files, batchStarted) {
				const sources = Array.from(files ?? []);
				const incoming = [];
				const foundations = [];
				const warnings = [];
				let lastLoadedFileName = "";
				for (const file of sources) {
					if (fileExtension(file.name) === "zip") {
						try {
							const extracted = await extractSupportedZipFiles(file);
							for (const extractedFile of extracted) incoming.push(extractedFile);
							if (!extracted.length) foundations.push(file);
						} catch (error) {
							foundations.push(file);
							warnings.push(`${file.name}: ${error?.message ?? error}`);
						}
					} else if (isSupportedDataFile(file.name)) {
						incoming.push(file);
					} else {
						foundations.push(file);
					}
				}
				let addedFoundations = addPlanningFiles(foundations);
				if (!incoming.length && !foundations.length) {
					status.classList.add("error");
					status.textContent = "Keine Datei gefunden.";
					return;
				}
				progress.begin(incoming.length);
				for (let index = 0; index < incoming.length; index += 1) {
					const file = incoming[index];
					progress.file(index, file.name);
					status.textContent = `${index + 1}/${incoming.length}: ${file.name} wird verarbeitet …`;
					// Yield to the UI between import steps. Plain requestAnimationFrame never
					// fires while the tab is hidden, which froze the whole import at this
					// line whenever the browser pane was not visible (every stall on
					// 2026-09-06 was exactly this). Race it against a short timer: smooth
					// when visible, still progressing when not.
					await new Promise((resolve) => {
						const timer = setTimeout(resolve, 100);
						requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
					});
					const before = loadedFiles.length;
					const result = await inspectFile(file, { deferRender: true });
					if (loadedFiles.length === before) {
						let importFailure = result?.viewerImportError
							?? (!result?.ok ? result?.status ?? "Keine darstellbaren Technet-Objekte erkannt" : "Keine darstellbaren Technet-Objekte erkannt");
						if (fileExtension(file.name) === "mdb" && /^invalid$/i.test(importFailure)) {
							importFailure = "MDB konnte nicht als Technet-/GND-Daten gelesen werden";
						}
						addedFoundations += addPlanningFiles([file], { importFailure });
						warnings.push(`${file.name}: ${importFailure}`);
					} else {
						lastLoadedFileName = file.name;
						void viewerStore.rememberFile(file, loadedFiles[loadedFiles.length - 1]?.fileKey ?? file.name);
					}
				}
				progress.end();
				if (loadedFiles.length || planningFiles.length) {
					const renderStarted = performance.now();
					viewer.classList.remove("inbox-collapsed", "outbox-collapsed");
					toggleInbox.setAttribute("aria-pressed", "true");
					toggleInbox.textContent = "‹";
					toggleOutbox.setAttribute("aria-pressed", "true");
					toggleOutbox.textContent = "›";
					renderObjectTree(lastLoadedFileName || incoming.at(-1)?.name || null);
					output.classList.add("hidden");
					dropzone.classList.add("loaded");
					assignmentTools.classList.remove("hidden");
					jumpBox.classList.remove("hidden");
					coupleToggle.classList.remove("hidden");
					document.querySelector("#viewModes").classList.remove("hidden");
					setViewMode(startViewMode());
					void applyDefaultRailwayMap();
					recordPerformance("batch-render", renderStarted, { files: incoming.length, objects: allViewerEntries().length });
				}
				status.classList.toggle("error", false);
				// The title bar has little room: the count is the message, the hint
				// that more files can be dropped lives in the welcome card and the
				// Daten menu. Warnings stay in the line; the full text is the tooltip.
				status.textContent = `${loadedFiles.length.toLocaleString("de-DE")} Datendateien${planningFiles.length ? ` · ${planningFiles.length.toLocaleString("de-DE")} Grundlagen` : ""}${warnings.length ? ` · Hinweis: ${warnings.join(" · ")}` : ""}`;
				status.title = status.textContent;
				recordPerformance("drop-to-view", batchStarted, { files: incoming.length, foundations: addedFoundations, objects: allViewerEntries().length });
				status.dataset.performance = JSON.stringify(performanceSamples);
			}

			const SUPPORTED_DATA_EXTENSIONS = new Set(["tra", "gra", "xml", "landxml", "xls", "xlsx", "xlsm", "mdb", "dbb"]);
			const ZIP_MAX_ENTRY_BYTES = 64 * 1024 * 1024;
			const ZIP_MAX_TOTAL_BYTES = 256 * 1024 * 1024;

			function fileExtension(name) {
				return String(name ?? "").split(".").pop().toLowerCase();
			}

			function isSupportedDataFile(name) {
				return SUPPORTED_DATA_EXTENSIONS.has(fileExtension(name));
			}

			async function inflateRaw(bytes) {
				if (typeof DecompressionStream !== "function") throw new Error("ZIP-Deflate wird von diesem Browser nicht unterstützt.");
				const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
				return new Uint8Array(await new Response(stream).arrayBuffer());
			}

			async function extractSupportedZipFiles(file) {
				const bytes = new Uint8Array(await file.arrayBuffer());
				const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
				let end = -1;
				for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
					if (view.getUint32(offset, true) === 0x06054b50) {
						end = offset;
						break;
					}
				}
				if (end < 0) throw new Error("kein lesbares ZIP-Verzeichnis gefunden");
				const entryCount = view.getUint16(end + 10, true);
				let offset = view.getUint32(end + 16, true);
				if (entryCount === 0xffff || offset === 0xffffffff) throw new Error("ZIP64-Archive werden noch nicht unterstützt");
				let totalBytes = 0;
				const files = [];
				const decoder = new TextDecoder("utf-8");
				for (let index = 0; index < entryCount; index += 1) {
					if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error("beschädigtes ZIP-Verzeichnis");
					const flags = view.getUint16(offset + 8, true);
					const method = view.getUint16(offset + 10, true);
					const compressedSize = view.getUint32(offset + 20, true);
					const uncompressedSize = view.getUint32(offset + 24, true);
					const nameLength = view.getUint16(offset + 28, true);
					const extraLength = view.getUint16(offset + 30, true);
					const commentLength = view.getUint16(offset + 32, true);
					const localOffset = view.getUint32(offset + 42, true);
					const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
					offset += 46 + nameLength + extraLength + commentLength;
					if (name.endsWith("/") || !isSupportedDataFile(name)) continue;
					if (flags & 1) throw new Error(`${name}: verschlüsselte ZIP-Einträge werden nicht unterstützt`);
					if (![0, 8].includes(method)) throw new Error(`${name}: ZIP-Kompressionsmethode ${method} wird nicht unterstützt`);
					if (uncompressedSize > ZIP_MAX_ENTRY_BYTES || totalBytes + uncompressedSize > ZIP_MAX_TOTAL_BYTES) throw new Error("ZIP-Inhalt überschreitet das Sicherheitslimit");
					if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`${name}: lokaler ZIP-Eintrag fehlt`);
					const localNameLength = view.getUint16(localOffset + 26, true);
					const localExtraLength = view.getUint16(localOffset + 28, true);
					const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
					if (dataOffset + compressedSize > bytes.length) throw new Error(`${name}: ZIP-Eintrag ist unvollständig`);
					const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
					const content = method === 0 ? compressed.slice() : await inflateRaw(compressed);
					if (content.byteLength !== uncompressedSize) throw new Error(`${name}: entpackte Größe ist inkonsistent`);
					totalBytes += content.byteLength;
					files.push(new File([content], name, { lastModified: file.lastModified }));
				}
				return files;
			}

			function readEntryFile(entry) {
				return new Promise((resolve, reject) => entry.file((file) => {
					const path = String(entry.fullPath ?? file.name).replace(/^\/+/, "");
					resolve(path && path !== file.name
						? new File([file], path, { type: file.type, lastModified: file.lastModified })
						: file);
				}, reject));
			}

			function readDirectoryBatch(reader) {
				return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
			}

			// What a drop hands over is taken synchronously: after the first await
			// the drop's data store is protected and dataTransfer.files reads
			// empty. Chrome on a file:// page (the Viewer's normal life) fails
			// webkitGetAsEntry().file() with "EncodingError ... Data URL has
			// exceeded the URL length limitations" for every file, so a drop of two
			// Eifel files ended in "Keine Datei gefunden." (measured 09.11., Chrome
			// 156). So: the File of each item (getAsFile), a FileSystem handle for
			// folders (Chrome), the entry as the last resort (Safari, Firefox).
			async function collectDroppedFiles(dataTransfer) {
				let items = [];
				let plainFiles = [];
				try {
					items = Array.from(dataTransfer?.items ?? []).filter((item) => item.kind === "file").map((item) => ({
						file: item.getAsFile?.() ?? null,
						handle: typeof item.getAsFileSystemHandle === "function" ? item.getAsFileSystemHandle().catch(() => null) : null,
						entry: item.webkitGetAsEntry?.() ?? null,
					}));
					plainFiles = Array.from(dataTransfer?.files ?? []);
				} catch (error) {
					// Chrome can throw while negotiating DataTransferItem flavors for very
					// large native drags; whatever was read before the throw is kept.
				}
				const files = [];
				const problems = [];
				const named = (file, path) => path && path !== file.name ? new File([file], path, { type: file.type, lastModified: file.lastModified }) : file;
				const walkHandle = async (handle, prefix) => {
					for await (const child of handle.values()) {
						if (child.kind === "file") files.push(named(await child.getFile(), `${prefix}${child.name}`));
						else if (child.kind === "directory") await walkHandle(child, `${prefix}${child.name}/`);
					}
				};
				const walkEntry = async (root) => {
					const pending = [root];
					for (let pendingIndex = 0; pendingIndex < pending.length; pendingIndex += 1) {
						const entry = pending[pendingIndex];
						if (entry?.isFile) { files.push(await readEntryFile(entry)); continue; }
						if (!entry?.isDirectory) continue;
						const reader = entry.createReader();
						while (true) {
							const children = await readDirectoryBatch(reader);
							if (!children.length) break;
							for (const child of children) pending.push(child);
						}
					}
				};
				for (const item of items) {
					const handle = item.handle ? await item.handle : null;
					const label = handle?.name ?? item.entry?.name ?? item.file?.name ?? "Eintrag";
					try {
						if (handle?.kind === "directory") { await walkHandle(handle, `${handle.name}/`); continue; }
						if (!handle && item.entry?.isDirectory) { await walkEntry(item.entry); continue; }
						if (item.file) { files.push(item.file); continue; }
						if (item.entry?.isFile) { files.push(await readEntryFile(item.entry)); continue; }
					} catch (error) {
						problems.push(`${label}: ${error?.message ?? error}`);
					}
				}
				if (!files.length && plainFiles.length) return plainFiles;
				if (!files.length && problems.length) throw new Error(`Drop übergeben, aber nicht lesbar – ${problems.join("; ")}. Bitte stattdessen „+ Daten“ oder „Ordner …“ verwenden.`);
				return files;
			}

			// ---- Menüs: Klick außerhalb oder Esc schließt ------------------------------
			document.addEventListener("pointerdown", (event) => {
				for (const menu of document.querySelectorAll("details.menu[open]")) {
					if (!menu.contains(event.target)) menu.removeAttribute("open");
				}
			});
			slideScrim.addEventListener("click", () => setViewMode("crs"));
			document.addEventListener("keydown", (event) => {
				if (event.key !== "Escape") return;
				const openMenus = document.querySelectorAll("details.menu[open]");
				if (openMenus.length) { for (const menu of openMenus) menu.removeAttribute("open"); return; }
				// No menu open: Esc puts the slide away and shows the map.
				if (loadedFiles.length && !workspace.classList.contains("mode-crs") && !event.target?.closest?.("input, select, textarea")) setViewMode("crs");
			});
			// The open leaf goes to the top layer (Popover API) and sits under its
			// summary, right-aligned, clamped to the viewport. Measured before:
			// the Ebenen leaf was clipped by the map panel (contain: paint), the
			// Daten leaf hidden behind the welcome card, the Annahmen leaf 384 px
			// off the left edge. The details element stays the one source of
			// open/closed; the popover follows it.
			for (const menu of document.querySelectorAll("details.menu")) {
				const body = menu.querySelector(".menu-body");
				if (!body || typeof body.showPopover !== "function") continue;
				menu.addEventListener("toggle", () => {
					if (!menu.open) {
						if (body.matches(":popover-open")) body.hidePopover();
						return;
					}
					const anchor = menu.querySelector("summary").getBoundingClientRect();
					body.showPopover();
					const width = body.offsetWidth;
					body.style.left = `${Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8))}px`;
					// Below the summary; above it when the bar sits at the bottom (the
					// diagram's) and the leaf would leave the window.
					const below = anchor.bottom + 4;
					const fits = below + body.offsetHeight <= window.innerHeight - 8;
					body.style.top = `${fits ? below : Math.max(8, anchor.top - 4 - body.offsetHeight)}px`;
					body.style.maxHeight = `${Math.max(120, (fits ? window.innerHeight - below : anchor.top - 4) - 8)}px`;
				});
			}
			window.addEventListener("resize", () => {
				for (const menu of document.querySelectorAll("details.menu[open]")) menu.removeAttribute("open");
			});

			// ---- Erscheinungsbild ------------------------------------------------------
			const themeToggle = document.querySelector("#themeToggle");
			const THEME_CYCLE = [["system", "◐", "System"], ["light", "☀", "Hell"], ["dark", "☾", "Dunkel"]];
			function applyTheme(value) {
				if (value === "light" || value === "dark") document.documentElement.dataset.theme = value;
				else delete document.documentElement.dataset.theme;
				const [, glyph, label] = THEME_CYCLE.find(([key]) => key === value) ?? THEME_CYCLE[0];
				themeToggle.replaceChildren(Object.assign(document.createElement("span"), { className: "glyph", textContent: glyph }), Object.assign(document.createElement("span"), { className: "label", textContent: label }));
				try { localStorage.setItem("technetViewer.theme", value); } catch { /* no storage */ }
			}
			themeToggle.addEventListener("click", () => {
				const current = document.documentElement.dataset.theme ?? "system";
				const index = THEME_CYCLE.findIndex(([key]) => key === current);
				applyTheme(THEME_CYCLE[(index + 1) % THEME_CYCLE.length][0]);
			});
			try { applyTheme(localStorage.getItem("technetViewer.theme") ?? "system"); } catch { applyTheme("system"); }

			// ---- Ladefortschritt -------------------------------------------------------
			// One bar for the whole batch: "Datei 3 von 12 · name · Phase", the
			// bar at (files done + this file's phase share) / files. The phases
			// are the import's own job phases in their order; an unknown phase
			// counts as half a file.
			const importProgress = document.querySelector("#importProgress");
			const importProgressBar = document.querySelector("#importProgressBar");
			const importProgressText = document.querySelector("#importProgressText");
			const IMPORT_PHASES = ["reading", "parser-loading", "extracting", "normalizing", "file-recognized", "fingerprinted", "access-format-checked", "tables-extracted", "gnd-evidence-interpreted", "truthfulness-gate"];
			const IMPORT_PHASE_LABELS = { reading: "lesen", "parser-loading": "Parser laden", extracting: "entpacken", normalizing: "normalisieren", "file-recognized": "erkannt", fingerprinted: "Fingerabdruck", "access-format-checked": "Format geprüft", "tables-extracted": "Tabellen gelesen", "gnd-evidence-interpreted": "Geometrie gedeutet", "truthfulness-gate": "geprüft" };
			const progress = {
				total: 0, index: 0, name: "", phase: null,
				begin(total) { this.total = total; this.index = 0; this.phase = null; importProgress.classList.remove("hidden"); this.draw(); },
				file(index, name) { this.index = index; this.name = name; this.phase = null; this.draw(); },
				step(phase) { this.phase = phase; this.draw(); },
				end() { importProgress.classList.add("hidden"); },
				draw() {
					if (!this.total) return;
					const order = IMPORT_PHASES.indexOf(this.phase);
					const share = this.phase == null ? 0 : order >= 0 ? (order + 1) / (IMPORT_PHASES.length + 1) : 0.5;
					const percent = Math.min(100, Math.round((this.index + share) / this.total * 100));
					importProgressBar.style.width = `${percent}%`;
					importProgress.setAttribute("aria-valuenow", String(percent));
					const phaseLabel = this.phase ? (IMPORT_PHASE_LABELS[this.phase] ?? this.phase) : "wird gelesen";
					importProgressText.textContent = `Datei ${this.index + 1} von ${this.total} · ${this.name} · ${phaseLabel} · ${percent} %`;
				},
			};

			// ---- Bildexport ----------------------------------------------------------
			// Spurplan, Lieferung, Verknüpfung and the diagram leave the page as
			// SVG or PNG. The pictures draw with CSS classes, so the clone gets the
			// computed style of every element written inline, a background in the
			// page's colour, and the SVG namespace -- then it stands alone in a
			// browser, an Office document or an image viewer. PNG renders the
			// same SVG through a canvas at double resolution.
			const EXPORT_STYLE_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "paint-order", "dominant-baseline", "letter-spacing", "display", "visibility"];
			function standaloneSvg(svg) {
				const clone = svg.cloneNode(true);
				const sourceElements = [svg, ...svg.querySelectorAll("*")];
				const cloneElements = [clone, ...clone.querySelectorAll("*")];
				sourceElements.forEach((element, index) => {
					const computed = getComputedStyle(element);
					const target = cloneElements[index];
					for (const prop of EXPORT_STYLE_PROPS) {
						const value = computed.getPropertyValue(prop);
						if (value && value !== "normal" && value !== "auto") target.style.setProperty(prop, value);
					}
					target.removeAttribute("class");
				});
				const viewBox = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
				const width = svg.getAttribute("width") ?? (viewBox.length === 4 ? viewBox[2] : svg.getBoundingClientRect().width);
				const height = svg.getAttribute("height") ?? (viewBox.length === 4 ? viewBox[3] : svg.getBoundingClientRect().height);
				clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
				clone.setAttribute("width", width);
				clone.setAttribute("height", height);
				if (viewBox.length !== 4) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
				const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
				const box = clone.getAttribute("viewBox").split(/[\s,]+/).map(Number);
				background.setAttribute("x", box[0]); background.setAttribute("y", box[1]); background.setAttribute("width", box[2]); background.setAttribute("height", box[3]);
				background.setAttribute("fill", getComputedStyle(document.body).backgroundColor || "#ffffff");
				clone.insertBefore(background, clone.firstChild);
				return { text: new XMLSerializer().serializeToString(clone), width: Number(width), height: Number(height) };
			}
			function downloadBlob(name, blob) {
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = name;
				link.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			}
			async function exportPicture(which, format) {
				const svg = which === "spurplan" ? spurplanSvg : which === "delivery" ? deliverySvg : which === "links" ? linksContent.querySelector("svg") : diagram;
				if (!svg || !svg.isConnected) { status.textContent = "Kein Bild zum Exportieren; die Ansicht ist leer."; return; }
				const stamp = new Date().toISOString().slice(0, 10);
				const label = { spurplan: "spurplan", delivery: "lieferung", links: "verknuepfung", diagram: diagramKind }[which];
				const { text, width, height } = standaloneSvg(svg);
				if (format === "svg") {
					downloadBlob(`${label}-${stamp}.svg`, new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
					status.textContent = `${label}-${stamp}.svg gespeichert.`;
					return;
				}
				const image = new Image();
				image.decoding = "async";
				await new Promise((resolve, reject) => {
					image.onload = resolve;
					image.onerror = () => reject(new Error("SVG konnte nicht gerastert werden"));
					image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
				});
				const scale = 2;
				const canvas = document.createElement("canvas");
				canvas.width = Math.round(width * scale);
				canvas.height = Math.round(height * scale);
				const context = canvas.getContext("2d");
				context.scale(scale, scale);
				context.drawImage(image, 0, 0, width, height);
				const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
				downloadBlob(`${label}-${stamp}.png`, blob);
				status.textContent = `${label}-${stamp}.png gespeichert (${canvas.width} × ${canvas.height} px).`;
			}
			for (const group of document.querySelectorAll(".picture-export")) {
				for (const button of group.querySelectorAll("button")) {
					button.addEventListener("click", () => exportPicture(group.dataset.picture, button.dataset.format).catch((error) => {
						status.classList.add("error");
						status.textContent = `Bild konnte nicht exportiert werden: ${error?.message ?? error}`;
					}));
				}
			}

			// ---- Suche und Sprung ------------------------------------------------------
			// One field finds a Gleis, Weiche or file by name, or reads a
			// Kilometrierung ("75,0+12", "km 75", "75012"). A hit selects the
			// object (or activates the Weiche, or sets the cursor to the km) and
			// pulls every picture along: the map centres on it, the diagram opens,
			// the Spurplan zooms its Strecke's band to it. Arrow keys move the
			// cursor, Esc clears it.
			const jumpBox = document.querySelector("#jump");
			const jumpInput = document.querySelector("#jumpInput");
			const jumpResults = document.querySelector("#jumpResults");
			let jumpActive = -1;
			let jumpMatches = [];
			function parseStationQuery(text) {
				const query = String(text ?? "").trim().toLowerCase().replace(/\s+/g, "");
				let match = /^(?:km)?(\d{1,3})[,.](\d)(?:\+(\d{1,3})(?:[,.](\d{1,2}))?)?$/.exec(query);
				if (match) return Number(match[1]) * 1000 + Number(match[2]) * 100 + Number(match[3] ?? 0) + Number(`0.${match[4] ?? "0"}`);
				match = /^km(\d{1,3})(?:[,.](\d{1,3}))?$/.exec(query);
				if (match) return Number(match[1]) * 1000 + Number(`0.${match[2] ?? "0"}`) * 1000;
				match = /^(\d{4,6})(?:[,.](\d{1,2}))?$/.exec(query);
				if (match) return Number(`${match[1]}.${match[2] ?? "0"}`);
				return null;
			}
			function jumpCandidates(text) {
				const query = String(text ?? "").trim().toLowerCase();
				if (!query) return [];
				const hits = [];
				const station = parseStationQuery(query);
				if (station != null) hits.push({ kind: "km", label: `km ${stationLabel(station)}`, note: "Cursor setzen", station });
				for (const entry of allViewerEntries()) {
					const name = objectListName(entry);
					const file = entry.loaded?.fileName ?? "";
					const haystack = `${name} ${file}`.toLowerCase();
					if (!haystack.includes(query)) continue;
					hits.push({ kind: "object", label: name, note: `${sourceFamilyForEntry(entry)} · ${file}`, entry, rank: entry.item.kind === "alignment" ? 0 : 1 });
				}
				for (const node of deriveTopology().nodes) {
					if (node.kind !== "Weiche" && node.kind !== "Kreuzung") continue;
					const name = junctionLabelOf(node);
					const label = `${name ?? node.kind}${node.km != null ? ` km ${stationLabel(node.km)}` : ""}`;
					const haystack = `${label} ${node.bauart ?? ""} ${node.knotenName ?? ""} ${node.names.join(" ")}`.toLowerCase();
					if (!haystack.includes(query)) continue;
					hits.push({ kind: "junction", label, note: `${node.kind}${node.bauart ? ` · ${node.bauart}` : ""} · ${node.names.join(" / ")}`, node, rank: 0 });
				}
				hits.sort((a, b) => (a.rank ?? -1) - (b.rank ?? -1) || a.label.length - b.label.length);
				return hits.slice(0, 8);
			}
			function stationLabel(value) { return station(value).trim(); }
			function openDiagramPanel(kind = "ivmg") {
				setViewMode(kind);
			}
			function centerMapOnEntry(entry) {
				if (maplibreMap && !maplibreMapElement.classList.contains("hidden") && globalThis.maplibregl) {
					const bounds = new globalThis.maplibregl.LngLatBounds();
					for (const coordinate of interpretedGeometry(entry).coordinates ?? []) bounds.extend(coordinate);
					if (!bounds.isEmpty()) maplibreMap.fitBounds(bounds, { padding: 64, maxZoom: 17, duration: 500 });
					return;
				}
				const points = mapPathForEntry(entry, activeMapMode).points;
				if (!points.length || !currentMapViewBox) return;
				const { minX, maxX, minY, maxY } = mapViewBounds(points);
				const rect = multi2d.getBoundingClientRect();
				const aspect = rect.width && rect.height ? rect.width / rect.height : 1.5;
				let width = Math.max(maxX - minX, 50) * 1.3;
				let height = Math.max(maxY - minY, 50) * 1.3;
				if (width / height < aspect) width = height * aspect; else height = width / aspect;
				currentMapViewBox = { x: (minX + maxX) / 2 - width / 2, y: (minY + maxY) / 2 - height / 2, width, height };
				applyMapViewBox();
			}
			// Several entries at once (a Bündel): the map goes to all of them, and
			// their lines stand out for a moment in the Übersicht.
			function centerMapOnEntries(entries) {
				const list = entries.filter(Boolean);
				if (!list.length) return;
				if (maplibreMap && !maplibreMapElement.classList.contains("hidden") && globalThis.maplibregl) {
					const bounds = new globalThis.maplibregl.LngLatBounds();
					for (const entry of list) for (const coordinate of interpretedGeometry(entry).coordinates ?? []) bounds.extend(coordinate);
					if (!bounds.isEmpty()) maplibreMap.fitBounds(bounds, { padding: 64, maxZoom: 17, duration: 500 });
					return;
				}
				const points = list.flatMap((entry) => mapPathForEntry(entry, activeMapMode).points);
				if (!points.length || !currentMapViewBox) return;
				const { minX, maxX, minY, maxY } = mapViewBounds(points);
				const rect = multi2d.getBoundingClientRect();
				const aspect = rect.width && rect.height ? rect.width / rect.height : 1.5;
				let width = Math.max(maxX - minX, 50) * 1.3;
				let height = Math.max(maxY - minY, 50) * 1.3;
				if (width / height < aspect) width = height * aspect; else height = width / aspect;
				currentMapViewBox = { x: (minX + maxX) / 2 - width / 2, y: (minY + maxY) / 2 - height / 2, width, height };
				applyMapViewBox();
				for (const entry of list) entry.mapPath?.classList.add("in-bundle");
				setTimeout(() => { for (const entry of list) entry.mapPath?.classList.remove("in-bundle"); }, 2600);
			}
			function centerMapOnPoint(point, entry) {
				if (!point) return;
				if (maplibreMap && !maplibreMapElement.classList.contains("hidden")) {
					const geographic = geographicPoint(point, entry);
					if (geographic) maplibreMap.flyTo({ center: [geographic.longitude, geographic.latitude], zoom: Math.max(maplibreMap.getZoom(), 16), duration: 500 });
					return;
				}
				const mapped = mapPoint(point, entry, activeMapMode);
				if (!mapped || !currentMapViewBox) return;
				currentMapViewBox = { ...currentMapViewBox, x: mapped.x - currentMapViewBox.width / 2, y: mapped.y - currentMapViewBox.height / 2 };
				applyMapViewBox();
			}
			// A Gleis's km extent on one axis: a Weiche between two Strecken has
			// nodes on both (W403-404: 5500 at km 74,97 and 5632 at km 0,99), so
			// the band with more of its nodes wins and only their km count.
			function spurplanExtentFor(entry) {
				const topology = deriveTopology();
				const byAxis = new Map();
				for (const edge of topology.edges) {
					if (edge.entry !== entry) continue;
					for (const node of [edge.from, edge.to]) {
						if (node.km == null || node.axis == null) continue;
						if (!byAxis.has(node.axis)) byAxis.set(node.axis, []);
						byAxis.get(node.axis).push(node.km);
					}
				}
				const best = [...byAxis.entries()].sort((a, b) => b[1].length - a[1].length)[0];
				if (!best) return null;
				return { label: topology.axes?.[best[0]]?.label ?? null, from: Math.min(...best[1]), to: Math.max(...best[1]) };
			}
			function spurplanFocus(label, from, to) {
				if (!label) return;
				const full = spurplanBandExtents.get(label);
				const pad = Math.max(150, (to - from) * 0.25);
				let xMin = from - pad;
				let xMax = to + pad;
				if (full) { xMin = Math.max(full.xMin, xMin); xMax = Math.min(full.xMax, xMax); }
				if (xMax - xMin < SPURPLAN_MIN_WINDOW_M) { const mid = (xMin + xMax) / 2; xMin = mid - SPURPLAN_MIN_WINDOW_M / 2; xMax = mid + SPURPLAN_MIN_WINDOW_M / 2; }
				spurplanZoom.set(label, { xMin, xMax });
				if (workspace.classList.contains("mode-spurplan")) renderSpurplanView();
			}
			function jumpToEntry(entry) {
				withFollowSuppressed(() => selectObject(entry, entry.button ?? null));
				lastFollowedEntry = entry;
				openDiagramPanel();
				centerMapOnEntry(entry);
				const extent = spurplanExtentFor(entry);
				if (extent) spurplanFocus(extent.label, extent.from, extent.to);
			}
			function jumpToJunction(node) {
				withFollowSuppressed(() => activateJunctionCluster(junctionFromNode(node)));
				lastFollowedEntry = node.arms[0]?.entry ?? lastFollowedEntry;
				openDiagramPanel("ivhw");
				const entry = node.arms[0]?.entry;
				if (entry) centerMapOnPoint(node.point, entry);
				if (node.km != null && node.axis != null) spurplanFocus(deriveTopology().axes?.[node.axis]?.label ?? null, node.km - 250, node.km + 250);
			}
			function jumpToStation(targetStation) {
				// The km lives on a Kilometerlinie's frame: pick one if the current
				// selection has none.
				if (!cursorContext?.inKm) {
					const kmLine = allViewerEntries().find((entry) => entry.item.kind === "alignment" && sevenLineSide(entry) === "kilometer" && inKilometerFrame(entry))
						?? allViewerEntries().find((entry) => entry.item.kind === "alignment" && inKilometerFrame(entry));
					if (!kmLine) { status.textContent = "Keine Kilometrierung geladen, zu der ein km passen könnte."; return; }
					withFollowSuppressed(() => selectObject(kmLine, kmLine.button ?? null));
					lastFollowedEntry = kmLine;
				}
				setCursor(targetStation);
				openDiagramPanel();
				const point = cursorPointAt(targetStation);
				if (point && cursorContext?.anchor) centerMapOnPoint(point, cursorContext.anchor);
				else status.textContent = `km ${stationLabel(targetStation)} liegt außerhalb von ${objectListName(cursorContext?.anchor ?? {}) || "der gewählten Trasse"}.`;
				if (cursorContext?.track) spurplanFocus(`Strecke ${cursorContext.track}`, targetStation - 500, targetStation + 500);
			}
			// ---- Kopplung: eine Auswahl zieht alle Bilder nach ------------------------
			// Every selection -- Inbox, Outbox, Lieferung, Verknüpfung, Spurplan,
			// map -- passes through selectObject; with the coupling on, the map
			// centres on the object (now, or when the GIS is next shown) and the
			// Spurplan zooms the object's band to it. Only
			// a changed selection follows: the panels re-select the same object
			// on every re-render, and that must not move anything. Jumps and the
			// restore do their own focusing and switch the follow off meanwhile.
			let selectionCoupled = true;
			let followSuppressed = false;
			let lastFollowedEntry = null;
			let pendingMapFocus = null;
			const coupleToggle = document.querySelector("#coupleToggle");
			coupleToggle.addEventListener("click", () => {
				selectionCoupled = !selectionCoupled;
				coupleToggle.setAttribute("aria-pressed", String(selectionCoupled));
				scheduleStateSave();
			});
			function setSelectionCoupled(value) {
				selectionCoupled = Boolean(value);
				coupleToggle.setAttribute("aria-pressed", String(selectionCoupled));
			}
			function followSelection(entry) {
				if (!selectionCoupled || followSuppressed || viewerStore.restoring || !entry) return;
				const target = entry.item?.kind === "alignment" ? entry : relatedDiagramEntries(entry).anchor;
				if (!target || target.item?.kind !== "alignment" || target === lastFollowedEntry) return;
				lastFollowedEntry = target;
				// The diagram is not opened here: open, it takes the height the
				// window can give and can squeeze the map to nothing; a jump opens
				// it, a selection only feeds it when it is open.
				if (workspace.classList.contains("mode-crs")) centerMapOnEntry(target);
				else pendingMapFocus = target;
				const extent = spurplanExtentFor(target);
				if (extent) spurplanFocus(extent.label, extent.from, extent.to);
			}
			function withFollowSuppressed(work) {
				followSuppressed = true;
				try { return work(); } finally { followSuppressed = false; }
			}
			function runJump(hit) {
				if (!hit) return;
				if (hit.kind === "object") jumpToEntry(hit.entry);
				else if (hit.kind === "junction") jumpToJunction(hit.node);
				else if (hit.kind === "km") jumpToStation(hit.station);
				closeJumpResults();
			}
			function closeJumpResults() {
				jumpResults.classList.add("hidden");
				jumpResults.replaceChildren();
				jumpMatches = [];
				jumpActive = -1;
			}
			function renderJumpResults() {
				jumpMatches = jumpCandidates(jumpInput.value);
				jumpResults.replaceChildren();
				if (!jumpMatches.length) { jumpResults.classList.add("hidden"); return; }
				jumpActive = 0;
				jumpMatches.forEach((hit, index) => {
					const item = document.createElement("li");
					item.setAttribute("role", "option");
					item.className = index === jumpActive ? "active" : "";
					const label = document.createElement("span");
					label.textContent = hit.label;
					const kind = document.createElement("span");
					kind.className = "jump-kind";
					kind.textContent = hit.note;
					item.append(label, kind);
					item.addEventListener("mousedown", (event) => { event.preventDefault(); runJump(hit); });
					jumpResults.append(item);
				});
				jumpResults.classList.remove("hidden");
			}
			jumpInput.addEventListener("input", renderJumpResults);
			jumpInput.addEventListener("focus", () => { if (jumpInput.value) renderJumpResults(); });
			jumpInput.addEventListener("blur", () => setTimeout(closeJumpResults, 150));
			jumpInput.addEventListener("keydown", (event) => {
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					if (!jumpMatches.length) return;
					event.preventDefault();
					jumpActive = (jumpActive + (event.key === "ArrowDown" ? 1 : jumpMatches.length - 1)) % jumpMatches.length;
					[...jumpResults.children].forEach((item, index) => item.classList.toggle("active", index === jumpActive));
				} else if (event.key === "Enter") {
					event.preventDefault();
					if (!jumpMatches.length) renderJumpResults();
					runJump(jumpMatches[Math.max(0, jumpActive)]);
				} else if (event.key === "Escape") {
					closeJumpResults();
					jumpInput.blur();
				}
			});
			document.addEventListener("keydown", (event) => {
				const target = event.target;
				const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
				if (typing) return;
				if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || event.key === "/") {
					if (jumpBox.classList.contains("hidden")) return;
					event.preventDefault();
					jumpInput.focus();
					jumpInput.select();
				} else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && cursorStation != null && !event.metaKey && !event.ctrlKey && !event.altKey) {
					event.preventDefault();
					setCursor(cursorStation + (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 100 : 10));
				} else if (event.key === "Escape" && cursorStation != null) {
					setCursor(null);
				}
			});

			// ---- Wiederöffnen -------------------------------------------------------
			// The browser keeps the current delivery: every imported data file as
			// it was dropped, plus what the user did to it -- hand assignments in
			// the 7L lanes, Lage/Höhe per file and object, drafts, the GWB inputs,
			// Spurplan colouring and zoom, view, selection. On the next open the
			// page offers to bring it back; importing something else first
			// replaces it. The same state travels as a JSON file ("Zuordnung ⤓/⤒"),
			// keyed by file name and object id, so it can be applied to the same
			// files on another machine. Nothing here touches the data itself.
			const VIEWER_DB_NAME = "technetViewer";
			const viewerStore = {
				sessionStarted: false,
				restoring: false,
				open() {
					return new Promise((resolve, reject) => {
						if (!globalThis.indexedDB) { reject(new Error("IndexedDB nicht verfügbar")); return; }
						const request = indexedDB.open(VIEWER_DB_NAME, 1);
						request.onupgradeneeded = () => {
							const db = request.result;
							if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "name" });
							if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
						};
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					});
				},
				async run(store, mode, work) {
					const db = await this.open();
					try {
						return await new Promise((resolve, reject) => {
							const tx = db.transaction(store, mode);
							const request = work(tx.objectStore(store));
							tx.oncomplete = () => resolve(request?.result);
							tx.onerror = () => reject(tx.error);
							tx.onabort = () => reject(tx.error);
						});
					} finally {
						db.close();
					}
				},
				// One record per file key: stored by name alone, the second of two
				// files of one name replaced the first and was the only one to come
				// back. `name` stays the key path (the first file's key is its
				// name, so older stores read as before), `fileName` is the real name.
				async rememberFile(file, fileKey = file.name) {
					try {
						viewerStore.sequence = (viewerStore.sequence ?? 0) + 1;
						await this.run("files", "readwrite", (store) => store.put({ name: fileKey, fileName: file.name, blob: file, lastModified: file.lastModified ?? Date.now(), addedAt: Date.now(), order: viewerStore.sequence }));
					} catch (error) {
						console.warn("Lieferung nicht gespeichert:", error);
					}
				},
				// In the order of loading, so that the turn of two files of one name
				// (and with it their keys) is the same after a reopen.
				async files() {
					try {
						const records = (await this.run("files", "readonly", (store) => store.getAll())) ?? [];
						return records.map((record, index) => ({ record, index })).sort((a, b) => (a.record.addedAt ?? 0) - (b.record.addedAt ?? 0) || (a.record.order ?? 0) - (b.record.order ?? 0) || a.index - b.index).map((item) => item.record);
					} catch { return []; }
				},
				async saveState(state) {
					try { await this.run("state", "readwrite", (store) => store.put(state, "current")); } catch (error) { console.warn("Zustand nicht gespeichert:", error); }
				},
				async state() {
					try { return await this.run("state", "readonly", (store) => store.get("current")); } catch { return null; }
				},
				async clear() {
					try {
						await this.run("files", "readwrite", (store) => store.clear());
						await this.run("state", "readwrite", (store) => store.clear());
					} catch { /* nothing stored */ }
				},
			};
			// An object is known by its file's key and its id in that file; two
			// deliveries of one file name stay two (einordnungDateischluessel).
			const stateKey = (entry) => `${entry.loaded?.fileKey ?? entry.loaded?.fileName ?? "?"}|${entry.item?.id ?? "?"}`;
			function captureViewerState() {
				const entries = {};
				for (const entry of allViewerEntries()) {
					const record = {};
					for (const field of ["userFamily", "userLineRole", "frameEdit", "organizationEdit", "displayLsys", "displayHsys", "userTrasse"]) {
						if (entry[field] !== undefined && entry[field] !== null) record[field] = entry[field];
					}
					if (Object.keys(record).length) entries[stateKey(entry)] = record;
				}
				const files = {};
				for (const loaded of loadedFiles) files[loaded.fileKey ?? loaded.fileName] = { displayLsys: loaded.displayLsys, displayLsysSource: loaded.displayLsysSource };
				return {
					version: 1,
					savedAt: new Date().toISOString(),
					fileNames: loadedFiles.map((loaded) => loaded.fileName),
					entries,
					files,
					drafts: draftSevenLineFrames,
					gwb: { lineSpeed: gwbLineSpeedInput.value, brakeDistance: gwbBrakeDistanceInput.value, oberbau: gwbOberbauSelect.value, fahrzeug: gwbFahrzeugSelect.value, cantLimit: gwbCantLimitSelect.value },
					spurplan: { coloring: spurplanColoring.value, zoom: [...spurplanZoom.entries()] },
					kilometerLinesVisible,
					hidden: [...hiddenEntryKeys],
					inbox: { query: inboxQuery },
					// What the user chose inside the proposals of the pile: the
					// Kilometerlinie for a Gleis, the Strecke typed for a Bündel. No
					// assignments; kept so that reopening does not undo the choice.
					// The Annahmen of the Ordnung that differ from the standard.
					annahmen: Object.fromEntries(ordnungAnnahmenGeaendert().map((annahme) => [annahme.key, ordnungAnnahmen[annahme.key]])),
					vorschlaege: {
						linien: (() => { const live = new Set(allViewerEntries()); return [...vorschlagLinie].filter(([entry, route]) => live.has(entry) && typeof route === "string").map(([entry, route]) => [stateKey(entry), route]); })(),
						strecken: [...buendelStrecken].filter(([, value]) => typeof value === "string"),
					},
					coupled: selectionCoupled,
					precisionKind: precisionKind(),
					viewMode: viewModeButtons.find((button) => button.getAttribute("aria-pressed") === "true")?.dataset.mode ?? null,
					selected: selectedEntry ? stateKey(selectedEntry) : null,
				};
			}
			function applyViewerState(state) {
				if (!state || typeof state !== "object") return { applied: 0, missing: 0 };
				einordnungGeaendert();
				viewerStore.restoring = true;
				let applied = 0;
				let missing = 0;
				try {
					const byKey = new Map(allViewerEntries().map((entry) => [stateKey(entry), entry]));
					for (const [key, record] of Object.entries(state.entries ?? {})) {
						const entry = byKey.get(key);
						if (!entry) { missing += 1; continue; }
						for (const field of ["userFamily", "userLineRole", "frameEdit", "organizationEdit", "displayLsys", "displayHsys", "userTrasse"]) {
							if (record[field] !== undefined) entry[field] = record[field];
						}
						listingCache.delete(entry);
						mapGeometryCache.delete(entry);
						geometryModelCache.delete(entry);
						applied += 1;
					}
					for (const loaded of loadedFiles) {
						const record = state.files?.[loaded.fileKey ?? loaded.fileName];
						if (!record || record.displayLsys === undefined) continue;
						loaded.displayLsys = record.displayLsys;
						loaded.displayLsysSource = record.displayLsysSource ?? loaded.displayLsysSource;
						for (const entry of loaded.objects) { listingCache.delete(entry); mapGeometryCache.delete(entry); geometryModelCache.delete(entry); }
					}
					if (Array.isArray(state.drafts)) draftSevenLineFrames = state.drafts;
					// The Annahmen first: what is stationed below is measured by them.
					if (state.annahmen && typeof state.annahmen === "object") {
						let changed = false;
						for (const [key, value] of Object.entries(state.annahmen)) changed = ordnungAnnahmeSetzen(key, value) || changed;
						if (changed) { ordnungNeuStationieren(); renderOrdnungAnnahmen(); }
					}
					for (const [key, route] of Array.isArray(state.vorschlaege?.linien) ? state.vorschlaege.linien : []) {
						const entry = byKey.get(key);
						if (entry && typeof route === "string") vorschlagLinie.set(entry, route);
					}
					for (const [id, value] of Array.isArray(state.vorschlaege?.strecken) ? state.vorschlaege.strecken : []) {
						if (typeof id === "string" && typeof value === "string") buendelStrecken.set(id, value);
					}
					if (state.gwb) {
						if (state.gwb.lineSpeed) gwbLineSpeedInput.value = state.gwb.lineSpeed;
						if (state.gwb.brakeDistance) gwbBrakeDistanceInput.value = state.gwb.brakeDistance;
						if (state.gwb.oberbau) gwbOberbauSelect.value = state.gwb.oberbau;
						if (state.gwb.fahrzeug) gwbFahrzeugSelect.value = state.gwb.fahrzeug;
					if (state.gwb.cantLimit) gwbCantLimitSelect.value = state.gwb.cantLimit;
					}
					if (state.spurplan) {
						if (state.spurplan.coloring) spurplanColoring.value = state.spurplan.coloring;
						spurplanZoom.clear();
						for (const [label, window] of state.spurplan.zoom ?? []) spurplanZoom.set(label, window);
					}
					if (typeof state.kilometerLinesVisible === "boolean" && state.kilometerLinesVisible !== kilometerLinesVisible) toggleKilometerLines();
					if (typeof state.coupled === "boolean") setSelectionCoupled(state.coupled);
					if (state.precisionKind === "height" || state.precisionKind === "point") precisionKindSelect.value = state.precisionKind;
					// Gradienten the user gave to Trassen: the references change, and
					// those Trassen are stationed anew with their Gradienten.
					bezuegeStamp += 1;
					einordnungGeaendert();
					trassenAbbildungErneuern([...new Set(allViewerEntries().filter((entry) => entry.userTrasse).map((entry) => byKey.get(entry.userTrasse)).filter(Boolean))]);
					// Gleise the user sorted into a Strecke are stationed on its Kilometerlinie.
					if (allViewerEntries().some((entry) => (entry.parser === "vermEsn" || gndEigenstationiert(entry)) && entry.frameEdit?.source === "user")) reconcileVermEsnStationing();
					hiddenEntryKeys.clear();
					for (const key of Array.isArray(state.hidden) ? state.hidden : []) if (byKey.has(key)) hiddenEntryKeys.add(key);
					if (state.inbox && typeof state.inbox === "object") inboxQuery = typeof state.inbox.query === "string" ? state.inbox.query : "";
					spurplanSpeedCache.clear();
					renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
					const selected = state.selected ? byKey.get(state.selected) : null;
					if (selected) selectObject(selected, selected.button ?? null);
					if (state.viewMode && viewModeButtons.some((button) => button.dataset.mode === state.viewMode)) setViewMode(state.viewMode);
				} finally {
					viewerStore.restoring = false;
				}
				scheduleStateSave();
				return { applied, missing };
			}
			let stateSaveTimer = 0;
			function scheduleStateSave() {
				if (viewerStore.restoring || !loadedFiles.length) return;
				clearTimeout(stateSaveTimer);
				stateSaveTimer = setTimeout(() => { void viewerStore.saveState(captureViewerState()); }, 800);
			}
			const sessionOffer = document.querySelector("#sessionOffer");
			const sessionOfferText = document.querySelector("#sessionOfferText");
			const assignmentTools = document.querySelector("#assignmentTools");
			async function offerReopen() {
				const stored = await viewerStore.files();
				if (!stored.length || loadedFiles.length) return;
				const state = await viewerStore.state();
				const when = state?.savedAt ? new Date(state.savedAt) : new Date(Math.max(...stored.map((record) => record.addedAt ?? 0)));
				sessionOfferText.textContent = `Zuletzt: ${stored.length} ${stored.length === 1 ? "Datei" : "Dateien"} vom ${when.toLocaleDateString("de-DE")}, ${when.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
				sessionOffer.classList.remove("hidden");
			}
			document.querySelector("#reopenAccept").addEventListener("click", async () => {
				sessionOffer.classList.add("hidden");
				const stored = await viewerStore.files();
				const files = stored.map((record) => new File([record.blob], record.fileName ?? record.name, { lastModified: record.lastModified ?? Date.now() }));
				const state = await viewerStore.state();
				await inspectFiles(files, { reopening: true });
				const result = applyViewerState(state);
				status.textContent = `${status.textContent} · wieder geöffnet${result.applied ? `, ${result.applied} Objekte mit gesicherter Zuordnung` : ""}${result.missing ? `, ${result.missing} nicht mehr gefunden` : ""}`;
			});
			document.querySelector("#reopenDiscard").addEventListener("click", async () => {
				await viewerStore.clear();
				sessionOffer.classList.add("hidden");
				status.textContent = "Gespeicherte Lieferung verworfen.";
			});
			document.querySelector("#assignmentExport").addEventListener("click", () => {
				const state = captureViewerState();
				const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = `zuordnung-${state.savedAt.slice(0, 10)}.json`;
				link.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			});
			const assignmentImport = document.querySelector("#assignmentImport");
			assignmentImport.addEventListener("change", async () => {
				const file = assignmentImport.files?.[0];
				assignmentImport.value = "";
				if (!file) return;
				try {
					const state = JSON.parse(await file.text());
					const result = applyViewerState(state);
					status.classList.remove("error");
					status.textContent = `Zuordnung aus ${file.name}: ${result.applied} Objekte übernommen${result.missing ? `, ${result.missing} nicht in den geladenen Dateien` : ""}.`;
				} catch (error) {
					status.classList.add("error");
					status.textContent = `Zuordnung konnte nicht gelesen werden: ${error?.message ?? error}`;
				}
			});
			void offerReopen();

			fileInput.addEventListener("change", async () => {
				await inspectFiles(fileInput.files);
				fileInput.value = "";
			});
			folderFileInput.addEventListener("change", async () => {
				await inspectFiles(folderFileInput.files);
				folderFileInput.value = "";
			});
			function setDiagramHeight(height, { manual = true } = {}) {
				const minimum = 96;
				const maximum = Math.max(minimum, viewer.clientHeight - 112);
				const next = Math.min(maximum, Math.max(minimum, height));
				viewer.style.setProperty("--diagram-content-height", `${next}px`);
				diagramHeightManual = manual;
				diagramResizeHandle.setAttribute("aria-valuemin", String(minimum));
				diagramResizeHandle.setAttribute("aria-valuemax", String(maximum));
				diagramResizeHandle.setAttribute("aria-valuenow", String(Math.round(next)));
				maplibreMap?.resize();
			}
			function resetDiagramHeight() {
				setDiagramHeight(Number(diagramPanel.dataset.autoHeight) || 216, { manual: false });
			}
			diagramResizeHandle.addEventListener("pointerdown", (event) => {
				event.preventDefault();
				diagramResize = { pointerId: event.pointerId, startY: event.clientY, startHeight: diagramPanel.getBoundingClientRect().height };
				diagramResizeHandle.setPointerCapture?.(event.pointerId);
				viewer.classList.add("diagram-resizing");
			});
			diagramResizeHandle.addEventListener("pointermove", (event) => {
				if (!diagramResize || event.pointerId !== diagramResize.pointerId) return;
				setDiagramHeight(diagramResize.startHeight + diagramResize.startY - event.clientY);
			});
			function finishDiagramResize(event) {
				if (!diagramResize || event.pointerId !== diagramResize.pointerId) return;
				diagramResize = null;
				viewer.classList.remove("diagram-resizing");
			}
			diagramResizeHandle.addEventListener("pointerup", finishDiagramResize);
			diagramResizeHandle.addEventListener("pointercancel", finishDiagramResize);
			diagramResizeHandle.addEventListener("dblclick", resetDiagramHeight);
			diagramResizeHandle.addEventListener("keydown", (event) => {
				if (!["ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
				event.preventDefault();
				if (event.key === "Home") resetDiagramHeight();
				else setDiagramHeight(diagramPanel.getBoundingClientRect().height + (event.key === "ArrowUp" ? 24 : -24));
			});
			for (const button of diagramPresentationButtons) {
				button.addEventListener("click", () => activateDiagramPresentation(button.dataset.diagramPresentation));
			}
			for (const control of [gwbLineSpeedInput, gwbBrakeDistanceInput, gwbOberbauSelect, gwbFahrzeugSelect, gwbCantLimitSelect, fzkZugartSelect, fzkHaltSelect]) control.addEventListener("change", () => { renderDiagram(); if (workspace.classList.contains("mode-spurplan")) renderSpurplanView(); });
			spurplanColoring.addEventListener("change", () => renderSpurplanView());
			// The three pictures size themselves to their panel; when the panel
			// changes (Inbox/Outbox folded, window resized), the open one redraws.
			let panelResizeRequest = 0;
			new ResizeObserver(() => {
				if (panelResizeRequest) return;
				panelResizeRequest = requestAnimationFrame(() => {
					panelResizeRequest = 0;
					if (!loadedFiles.length) return;
					if (workspace.classList.contains("mode-spurplan")) renderSpurplanView();
					else if (workspace.classList.contains("mode-delivery")) renderDelivery();
					else if (workspace.classList.contains("mode-links")) renderLinks();
				});
			}).observe(workspace);
			gwbBogenCsvButton.addEventListener("click", () => downloadCsv(`gwb-boegen-${new Date().toISOString().slice(0, 10)}.csv`, buildGwbBogenCsv(selectedEntry)));
			gwbAbschnittCsvButton.addEventListener("click", () => downloadCsv(`gwb-abschnitte-${new Date().toISOString().slice(0, 10)}.csv`, buildGwbAbschnittCsv(selectedEntry)));
			for (const button of viewModeButtons) {
				button.addEventListener("click", () => setViewMode(button.dataset.mode));
			}
			toggleInbox.addEventListener("click", () => {
				const collapsed = viewer.classList.toggle("inbox-collapsed");
				toggleInbox.setAttribute("aria-pressed", String(!collapsed));
				toggleInbox.textContent = collapsed ? "›" : "‹";
				maplibreMap?.resize();
			});
			toggleOutbox.addEventListener("click", () => {
				const collapsed = viewer.classList.toggle("outbox-collapsed");
				toggleOutbox.setAttribute("aria-pressed", String(!collapsed));
				toggleOutbox.textContent = collapsed ? "‹" : "›";
				maplibreMap?.resize();
			});
			toggleDiagram.addEventListener("click", () => {
				const collapsed = viewer.classList.toggle("diagram-collapsed");
				toggleDiagram.setAttribute("aria-pressed", String(!collapsed));
				toggleDiagram.textContent = collapsed ? "⌃" : "⌄";
				maplibreMap?.resize();
			});
			toggleText.addEventListener("click", () => setViewMode(dataPanel.classList.contains("hidden") ? "listing" : "crs"));
			reopenText.addEventListener("click", () => setViewMode("listing"));
			for (const button of document.querySelectorAll(".slide-close")) button.addEventListener("click", () => setViewMode("crs"));
			toggleTextOpacity.addEventListener("click", () => {
				const transparent = dataPanel.classList.toggle("transparent");
				toggleTextOpacity.setAttribute("aria-pressed", String(transparent));
				toggleTextOpacity.setAttribute("aria-label", transparent ? "Textoverlay deckend anzeigen" : "Textoverlay transparent anzeigen");
			});
			toggleFullscreen.addEventListener("click", () => {
				const fullscreen = viewer.classList.toggle("gis-fullscreen");
				toggleFullscreen.setAttribute("aria-pressed", String(fullscreen));
				toggleFullscreen.textContent = fullscreen ? "↙" : "⛶";
				toggleFullscreen.setAttribute("aria-label", fullscreen ? "GIS-Fensteransicht" : "GIS-Vollbild");
				maplibreMap?.resize();
				if (!maplibreMap || !railwayMapActive) fitMap();
			});
			mapFit.addEventListener("click", fitMap);
			mapZoomOut.addEventListener("click", () => zoomMap(1.25));
			mapZoomIn.addEventListener("click", () => zoomMap(0.8));
			// "Lage zuordnen" opens the Grabbeltisch on the Trassen without a Lage.
			gisAssign.addEventListener("click", () => {
				inboxQuery = "ohne lage";
				viewer.classList.remove("inbox-collapsed");
				toggleInbox.setAttribute("aria-pressed", "true");
				toggleInbox.textContent = "‹";
				renderObjectTree(selectedEntry?.loaded?.fileName ?? null);
				tablesNav.querySelector(".grabbel-lsys")?.focus();
			});
			baseMapLoad.addEventListener("click", () => toggleRailwayMap());
			document.querySelector("#tileConsentOnce").addEventListener("click", () => answerTileConsent("once"));
			document.querySelector("#tileConsentAlways").addEventListener("click", () => answerTileConsent("always"));
			document.querySelector("#tileConsentNo").addEventListener("click", () => answerTileConsent("no"));
			tileConsentForget.addEventListener("click", forgetTileConsent);
			tileConsentClose.addEventListener("click", () => { tileConsentCard.classList.add("hidden"); tileConsentClose.classList.add("hidden"); });
			document.querySelector("#tileSourceOpen").addEventListener("click", () => { renderTileConsentText(); tileSourceEditor.open = true; tileConsentClose.classList.remove("hidden"); tileConsentCard.classList.remove("hidden"); });
			document.querySelector("#tileSourceApply").addEventListener("click", async () => {
				const override = readTileSourceEditor();
				if (override === null && status.classList.contains("error")) return;
				await applyTileSources(override);
				tileSourceEditor.open = false;
				status.textContent = override ? `Kachelquelle: ${tileHostOf(override.base)}${override.railway ? ` und ${tileHostOf(override.railway)}` : ""} (in diesem Browser gemerkt).` : "Kachelquelle: OpenStreetMap und OpenRailwayMap.";
			});
			document.querySelector("#tileSourceReset").addEventListener("click", async () => { await applyTileSources(null); tileSourceEditor.open = false; status.textContent = "Kachelquelle: OpenStreetMap und OpenRailwayMap."; });
			renderTileConsentText();
			// A packed copy (tools/pack-technet-viewer.mjs) carries its build in a
			// meta tag; the welcome card shows it, so a hand-out answers "which
			// version is this" by itself. The repo file has no such tag.
			{
				const build = document.querySelector('meta[name="technet-viewer-build"]')?.content;
				if (build) document.querySelector("#welcomeEyebrow").textContent += ` · Build ${build}`;
			}
			precisionToggle.addEventListener("click", () => togglePrecisionMode());
			precisionKindSelect.addEventListener("change", () => {
				rejectListToggle.title = `Alle Segmente über σ_r = ${formatPrecisionValue(PRECISION_REJECT_THRESHOLD)} (Ril 883.3100) gemeldeter ${precisionKind() === "height" ? "Höhengenauigkeit (meanHeightError)" : "Punktgenauigkeit (meanPointError)"}, zur Einzelprüfung`;
				precisionPopup?.remove(); precisionPopup = null;
				if (maplibreMap?.getSource("technet-precision")) maplibreMap.getSource("technet-precision").setData(precisionFeatureCollection());
				renderRejectList();
				scheduleStateSave();
			});
			kmLineToggle.addEventListener("click", () => toggleKilometerLines());
			railwayOpacity.addEventListener("input", () => {
				railwayLayerOpacity = Number(railwayOpacity.value) / 100;
				railwayOpacityValue.textContent = `${railwayOpacity.value} %`;
				if (maplibreMap?.getLayer("underlay-dimmer")) {
					maplibreMap.setPaintProperty("underlay-dimmer", "fill-opacity", (1 - railwayLayerOpacity) * 0.82);
				}
			});
			mapFilterToggle.addEventListener("click", () => {
				const willOpen = mapFilterPanel.classList.contains("hidden");
				mapFilterPanel.classList.toggle("hidden", !willOpen);
				mapFilterToggle.setAttribute("aria-pressed", String(willOpen));
				if (willOpen) renderMapFilterPanel();
			});
			rejectListToggle.addEventListener("click", () => {
				const willOpen = rejectListPanel.classList.contains("hidden");
				rejectListPanel.classList.toggle("hidden", !willOpen);
				rejectListToggle.setAttribute("aria-pressed", String(willOpen));
				if (willOpen) renderRejectList();
			});
			listingZoomOut.addEventListener("click", () => zoomListing(-0.1));
			listingZoomIn.addEventListener("click", () => zoomListing(0.1));
			gridWrap.addEventListener("wheel", (event) => {
				if (!event.ctrlKey && !event.metaKey) return;
				event.preventDefault();
				zoomListing(event.deltaY > 0 ? -0.1 : 0.1);
			}, { passive: false });
			multi2d.addEventListener("wheel", (event) => {
				event.preventDefault();
				zoomMap(event.deltaY > 0 ? 1.12 : 0.89, { x: event.clientX, y: event.clientY });
			}, { passive: false });
			multi2d.addEventListener("pointermove", (event) => scheduleCursor(() => {
				if (mapDrag || !currentMapViewBox) return;
				const shown = svgPointFromEvent(multi2d, event);
				if (!shown) return;
				const point = mapViewToWorld(shown);
				const tolerance = 25 * currentMapViewBox.width / Math.max(multi2d.getBoundingClientRect().width, 1);
				cursorFromMap(point.x, point.y, tolerance, activeMapMode);
			}));
			diagram.addEventListener("mousemove", (event) => scheduleCursor(() => cursorFromFigureEvent(diagram, event)));
			wireDiagramZoom();
			multi2d.addEventListener("pointerdown", startMapPan);
			// The right button turns the view; its menu would only be in the way.
			multi2d.addEventListener("contextmenu", (event) => event.preventDefault());
			mapNorth.addEventListener("click", () => {
				if (maplibreMap && !maplibreMapElement.classList.contains("hidden")) { maplibreMap.easeTo?.({ bearing: 0, pitch: 0 }); return; }
				setMapRotation(0);
			});
			multi2d.addEventListener("pointermove", moveMapPan);
			multi2d.addEventListener("pointerup", endMapPan);
			multi2d.addEventListener("pointercancel", endMapPan);
			multi2d.addEventListener("click", (event) => {
				if (multi2d.dataset.suppressClick !== "true") return;
				event.preventDefault();
				event.stopImmediatePropagation();
				delete multi2d.dataset.suppressClick;
			}, true);
			setViewMode("crs");
			void toggleRailwayMap({ automatic: true });
			// dragenter and dragover both cancelled, dropEffect "copy": the pair
			// the HTML spec and Chrome want before they show a drop as allowed.
			for (const type of ["dragenter", "dragover"]) {
				document.addEventListener(type, (event) => {
					event.preventDefault();
					if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
					document.body.classList.add("dragover");
				});
			}
			document.addEventListener("dragleave", (event) => {
				if (!event.relatedTarget) document.body.classList.remove("dragover");
			});
			document.addEventListener("drop", async (event) => {
				event.preventDefault();
				document.body.classList.remove("dragover");
				status.classList.remove("error");
				status.textContent = "Drop-Inhalt wird gelesen …";
				try {
					await inspectFiles(await collectDroppedFiles(event.dataTransfer));
				} catch (error) {
					status.classList.add("error");
					status.textContent = `Drop konnte nicht gelesen werden: ${error?.message ?? error}`;
				}
			});
		