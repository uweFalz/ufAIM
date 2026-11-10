// Keep the standalone Viewer's DBB entry identical to the shared decoder.
// Its existing GND interpreter stays in place; rebuilding the whole Viewer
// from the older shared parser would lose Viewer functionality.
import fs from "node:fs/promises";
import { renderDbbBlock } from "./technet-shared-blocks.mjs";

const root = new URL("../", import.meta.url);
const target = new URL("technetViewer.html", root);
const begin = "  // BEGIN GENERATED GND DBB ADAPTER";
const end = "  // END GENERATED GND DBB ADAPTER";
const block = await renderDbbBlock(source => fs.readFile(new URL(source, root), "utf8"));
const current = await fs.readFile(target, "utf8");
const start = current.indexOf(begin), finish = current.indexOf(end);
if (start < 0 || finish < start || current.indexOf(begin, start + begin.length) >= 0 || current.indexOf(end, finish + end.length) >= 0) throw new Error("Expected exactly one DBB adapter block");
const updated = current.slice(0, start) + block + current.slice(finish + end.length);
if (process.argv.includes("--write")) {
	if (current !== updated) await fs.writeFile(target, updated);
	console.log("DBB adapter synchronized; all other Viewer code preserved.");
} else {
	if (current !== updated) { console.error("Viewer DBB adapter is stale; run node tools/sync-technet-dbb.mjs --write"); process.exitCode = 1; }
	else console.log("Viewer DBB adapter matches the shared source.");
}
