// app/bootstrap/loadImportMaps.js

const bootScript = document.currentScript;

(async () => {
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

	const s = document.createElement("script");
	s.type = "importmap";
	s.textContent = JSON.stringify(merged);
	bootScript.after(s);

	const m = document.createElement("script");
	m.type = "module";
	m.src = "./app/main.js";
	s.after(m);
})();
