// app/io/fileDrop.js

/*
installFileDrop({
	element: elements.dropZone ?? document.body,
	onFiles: (files) => {
		if (elements.log) elements.log.textContent += `files: ${files.length}\n`;
	}
});
*/

export function installFileDrop({ element = document.documentElement, onFiles }) {
    if (!element) throw new Error("installFileDrop: missing element");
    if (typeof onFiles !== "function") throw new Error("installFileDrop: onFiles must be a function");

    function stop(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    element.addEventListener("dragenter", stop);
    element.addEventListener("dragover", stop);
    element.addEventListener("dragleave", stop);

    element.addEventListener("drop", async (event) => {
        stop(event);
        const fileList = event.dataTransfer?.files;
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList);
        await onFiles(files);
    });
}
