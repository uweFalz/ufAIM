// app/bootstrap/loadImportMaps.js

const bootScript =
	document.currentScript ||
	document.scripts[document.scripts.length - 1];

(async () => {
	try {
		const [ext, int] = await Promise.all([
			fetch("./config/importmap.external.json").then(r => r.json()),
			fetch("./config/importmap.internal.json").then(r => r.json())
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
		mainScript.src = "./app/main.js";

		document.head.appendChild(mainScript);

		console.log("[importmap] loaded ✔");

	} catch (err) {
		console.error("[importmap] FAILED ❌", err);
	}
})();
