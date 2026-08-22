// app/bootstrap/loadImportMaps.js

const bootScript =
	document.currentScript ||
	document.scripts[document.scripts.length - 1];

const BOOTSTRAP_REVISION = "20260726-step-b";

function isExplicitE2EStart() {
	const query = new URLSearchParams(window.location.search);
	return query.get("e2e") === "1"
		|| query.has("aimCoreAuthoringAcceptance");
}

(async () => {
	try {
		const explicitE2E = isExplicitE2EStart();
		const [ext, int] = await Promise.all([
			fetch("./config/importmap.external.json", { cache: "no-store" }).then(r => r.json()),
			fetch("./config/importmap.internal.json", { cache: "no-store" }).then(r => r.json())
		]);

		const merged = {
			imports: {
				...(ext.imports || {}),
				...(int.imports || {})
			}
		};

		// 👉 ImportMap einsetzen
		const mapScript = document.createElement("script");
		mapScript.type = "importmap";
		mapScript.textContent = JSON.stringify(merged, null, 2);

		document.head.appendChild(mapScript);

		// 👉 main starten
		const mainScript = document.createElement("script");
		mainScript.type = "module";
		mainScript.src = `./app/main.js?boot=${explicitE2E ? "e2e" : "normal"}-${BOOTSTRAP_REVISION}`;

		document.head.appendChild(mainScript);

		console.log("[importmap] loaded ✔");

	} catch (err) {
		console.error("[importmap] FAILED ❌", err);
	}
})();
