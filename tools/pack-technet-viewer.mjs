// Pack the standalone Viewer for hand-out: a ZIP with the HTML and a
// LIESMICH. Mail gateways drop bare .html attachments as phishing bait;
// a ZIP gets through, and the LIESMICH answers what IT asks first --
// what is this, which version, what does it talk to, how is it hosted.
// The packaged HTML differs from the repo file by one line: a
// <meta name="technet-viewer-build"> with commit and date, which the
// welcome card shows. Output goes to dist/ (ignored by git).
//
//   node tools/pack-technet-viewer.mjs            -> dist/technetViewer-<date>-<hash>.zip
//   node tools/pack-technet-viewer.mjs --out X    -> X
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = new URL("../", import.meta.url);
execFileSync(process.execPath, ["tools/build-technet-viewer.mjs"], { cwd: root, stdio: "pipe" });
const source = new URL("technetViewer.html", root);
const distDir = new URL("dist/", root);

const git = (...args) => { try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); } catch { return ""; } };
const hash = git("rev-parse", "--short", "HEAD") || "ohne-git";
const dirty = git("status", "--porcelain", "--", "technetViewer.html") ? "+" : "";
const dateIndex = process.argv.indexOf("--date");
const date = dateIndex >= 0 ? process.argv[dateIndex + 1] : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Expected --date YYYY-MM-DD");
const sourceHash = createHash("sha256").update(await fs.readFile(source)).digest("hex");
const build = `${hash}${dirty} ${date} source:${sourceHash.slice(0,12)}`;

let html = await fs.readFile(source, "utf8");
const marker = '<meta name="viewport" content="width=device-width, initial-scale=1" />';
if (!html.includes(marker)) throw new Error("viewport meta not found; the pack script needs updating");
html = html.replace(marker, `${marker}\n\t\t<meta name="technet-viewer-build" content="${build}" />`);
const sha256 = createHash("sha256").update(html).digest("hex");
const sizeMb = (Buffer.byteLength(html, "utf8") / 1048576).toFixed(1);

const liesmich = `Technet-Datei-Viewer
====================

Build ${build}
SHA-256 der Datei technetViewer.html: ${sha256}
Groesse: ${sizeMb} MB, eine einzige HTML-Datei, keine Installation.

Was das ist
-----------
Ein Betrachter fuer Trassierungsdaten der Bahnvermessung: GND (MDB, DBB),
VermEsn (TRA, GRA) und landXML. Er zeigt die Daten als Karte, Spurplan,
Lieferungsbild, Verknuepfungsbild und 7L-Diagramm (IVMG, IVHW, GWB).
Alles rechnet im Browser; die Dateien bleiben auf dem Rechner.

Starten
-------
1. ZIP entpacken.
2. technetViewer.html im Browser oeffnen (Doppelklick), oder die Datei
   auf einen internen Webserver legen und die Adresse aufrufen.
3. Dateien, ZIPs oder Ordner in das Fenster ziehen, oder ueber "Daten"
   laden.

Browser: Edge, Chrome oder Firefox in einer Fassung der letzten zwei
Jahre (Edge 114, Chrome 114, Firefox 125 oder neuer). Der Internet-
Explorer-Modus von Edge laeuft nicht. Die Kartentafel braucht WebGL 2;
ohne WebGL (Citrix, RDP ohne GPU) bleibt die Karte leer, alle anderen
Bilder laufen.

Was den Rechner verlaesst
-------------------------
Nur die Kartenkacheln der Kartentafel, und nur nach einer Erlaubnis in
der Kartentafel selbst. Standardquellen sind tile.openstreetmap.de und
tiles.openrailwaymap.org; die Kachelkoordinaten nennen diesen Servern
den Kartenausschnitt, also die Lage des Projekts. Ohne Erlaubnis bleibt
die Lageansicht als Vektorzeichnung ohne Hintergrund, die nichts abruft.

Interner Kachelserver: im Viewer unter Ebenen > Kachelquelle (je
Browser gemerkt), oder vor dem Verteilen einmal im Block
"Kachelquellen" in technetViewer.html eintragen (Suche nach
TILE_SOURCES_DEFAULT). Fuer Kacheln aus OpenStreetMap ist der
Quellenvermerk Pflicht (ODbL).

Hosten
------
Die Datei ist in sich geschlossen und laeuft von jedem statischen
Webserver, auch ueber http im Intranet (ohne https stellt der Viewer
die noetigen Browserfunktionen selbst). https ist trotzdem die bessere
Wahl. Keine Datenbank, kein Backend, keine Anmeldung. Der Browser
merkt sich die Sitzung (geladene Dateien, Zuordnungen) nur lokal in
seinem eigenen Speicher.

Rampen-Korrektur
----------------
GRA-Gradientpunkte und Ueberhoehungsrampen werden getrennt gelistet.
Rampen stehen in ihrer eigenen Tabelle, nicht mehr in der Gradientpunktliste.
Bei widerspruechlichem Kopfsatz bleibt der bisherige Lesepfad mit Hinweis.
IVMG zeigt die GRA-Rampen auch als Band und Wertetabelle. Ohne passend
zugeordnete Trasse bleibt die Rampenseite unbestimmt; Hinweise beachten.
Darstellung und Tests sind keine konstruktive Freigabe.

Inbox und Sichtbarkeit
---------------------
Der Grabbeltisch filtert unzugeordnete Objekte ueber Namen und Zustaende.
Lage, Hoehe und Kartensichtbarkeit wirken auf Treffer oder angehakte Treffer.
Ausblenden entfernt keine Quelldaten; die Sichtbarkeit betrifft die Karte,
nicht automatisch Spurplan, Lieferung oder andere Diagramme.

Pruefen
-------
QUELLEN.json dokumentiert die Repository-Quellen und deren SHA-256.
Reproduktion: node tools/build-technet-viewer.mjs --write; danach
node tools/pack-technet-viewer.mjs --date ${date} --out <neues-ZIP>.

Der SHA-256 oben gehoert zur ausgelieferten Datei. Wer den Wert
nachrechnet (PowerShell: Get-FileHash technetViewer.html), weiss, dass
die Datei unveraendert ist.
`;

await fs.mkdir(distDir, { recursive: true });
const stage = new URL(`file://${await fs.mkdtemp(path.join(distDir.pathname, "viewer-stage-"))}/`);
await fs.writeFile(new URL("technetViewer.html", stage), html);
await fs.writeFile(new URL("LIESMICH.txt", stage), liesmich);

const outIndex = process.argv.indexOf("--out");
const out = outIndex >= 0 ? path.resolve(process.argv[outIndex + 1]) : path.join(distDir.pathname, `technetViewer-${date}-${hash}${dirty ? "-arbeitskopie" : ""}.zip`);
try { await fs.access(out); throw new Error(`Output already exists: ${out}`); } catch (e) { if (e.code !== "ENOENT") throw e; }
const manifest = JSON.parse(await fs.readFile(new URL("viewer/source-manifest.json", root), "utf8"));
await fs.writeFile(new URL("QUELLEN.json", stage), JSON.stringify({ build, sourceManifest: manifest, packagedHtmlSha256: sha256 }, null, 2)+"\n");
for (const name of ["technetViewer.html", "LIESMICH.txt", "QUELLEN.json"]) await fs.utimes(new URL(name,stage),new Date("1980-01-01T00:00:00Z"),new Date("1980-01-01T00:00:00Z"));
execFileSync("zip", ["-q", "-X", "-j", out, path.join(stage.pathname, "technetViewer.html"), path.join(stage.pathname, "LIESMICH.txt"), path.join(stage.pathname, "QUELLEN.json")]);
await fs.rm(stage, { recursive: true, force: true });
const zipped = await fs.stat(out);
console.log(`${out}\n  Build ${build} · ${sizeMb} MB HTML · ZIP ${(zipped.size / 1048576).toFixed(1)} MB\n  SHA-256 technetViewer.html: ${sha256}`);
