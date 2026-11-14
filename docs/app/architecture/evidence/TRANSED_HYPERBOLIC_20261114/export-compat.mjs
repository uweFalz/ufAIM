import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const [root, mode, file] = process.argv.slice(2);
const R = pathToFileURL(root + "/");
const { createTransitionLibraryService } = await import(new URL("src/services/transition-library/createTransitionLibraryService.js", R));
const builtIn = JSON.parse(await readFile(new URL("src/domain/transition/transitionLookup.json", R), "utf8"));
const svc = createTransitionLibraryService({ catalogue: builtIn });
const recs = (op) => [
  { level: "simpleFcn", id: "MY_F", value: { op, m: 3, n: 0 } },
  { level: "protoFcn", id: "PROTO_MY_F", value: { op: "ref", id: "MY_F", crop: [0, op === "sin" ? 0.5 : 1] } },
  { level: "halfWave", id: "HW_MY_F", value: { proto: "PROTO_MY_F", source: "kappa" } },
  { level: "transition", id: "my_f", value: { halfWave1: "HW_MY_F", halfWave2: "HW_MY_F", normLengthPartition: [0.5, 0, 0.5] } },
];
if (mode.startsWith("export:")) {
  const r = svc.putUserRecords(recs(mode.slice(7)));
  if (!r.ok) { console.log("put", r.code, r.reason); process.exit(0); }
  const lib = svc.exportUserLibrary();
  await writeFile(file, JSON.stringify(lib, null, 1));
  console.log("exported", mode, "schema", JSON.stringify(lib.schema));
} else {
  const lib = JSON.parse(await readFile(file, "utf8"));
  const before = JSON.stringify(svc.exportUserLibrary());
  const r = svc.importUserLibrary(lib);
  const after = JSON.stringify(svc.exportUserLibrary());
  console.log("import ->", JSON.stringify(r), "| library unchanged:", before === after);
  if (r.ok) { const d = svc.describeDraft({ halfWave1: "HW_MY_F", halfWave2: "HW_MY_F", normLengthPartition: [0.5,0,0.5], count: 5 }); console.log("draft ok:", d.ok, d.ok ? d.samples.map(s=>+s.k.toFixed(4)).join(" ") : d.reason); }
  // construct at start with the library (what the page does on load)
  try { createTransitionLibraryService({ catalogue: builtIn, userLibrary: lib }); console.log("start with library: ok"); } catch (e) { console.log("start with library: throws:", e.message); }
}
