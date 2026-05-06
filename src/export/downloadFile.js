// /src/export/downloadFile.js

export function downloadTextFile({ content, fileName = "export.xml" }) {
	const blob = new Blob([content], { type: "application/xml" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	a.click();

	URL.revokeObjectURL(url);
}
