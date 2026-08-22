import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const ROOT=new URL("../../../",import.meta.url),read=(path)=>readFile(new URL(path,ROOT),"utf8");

test("directory dataset scope never derives engineering meaning from path name or order",async()=>{
	const source=(await Promise.all([read("app/io/input/directoryPicker.js"),read("app/gndImportWorkbench/gndImportWorkbenchController.js"),read("app/gndImportWorkbench/gndImportWorkbenchView.js")])).join("\n");
	assert.doesNotMatch(source,/relativePath.*(?:Strecke|relation|topolog)|sort.*(?:Strecke|relation|topolog)/i);
	assert.doesNotMatch(source,/auto.?promot|appendCant|createVertical|docs\/knowledgeKernel|aim-core/i);
	assert.match(source,/showDirectoryPicker/);
	assert.match(source,/importController\?\.importFiles\?\.\(files\)/);
});

test("relative paths are provenance-only and directory capability has honest fallback",async()=>{
	const [picker,view]=await Promise.all([read("app/io/input/directoryPicker.js"),read("app/gndImportWorkbench/gndImportWorkbenchView.js")]);
	assert.match(picker,/relativePath/);
	assert.match(picker,/new FileCtor\(\[source\], relativePath/);
	assert.match(view,/Ordner per Drag & Drop/);
	assert.match(view,/model\.directoryPickerSupported/);
	assert.match(view,/model\.directoryPickerSupported === true/);
	const controller=await read("app/gndImportWorkbench/gndImportWorkbenchController.js");
	assert.match(controller,/windowRef = globalThis\.window/);
	assert.match(controller,/supportsDirectoryPicker\(windowRef\) === true/);
	assert.match(controller,/pickDirectoryFiles\(\{ windowRef \}\)/);
	assert.match(controller,/state\.directoryPickerSupported = supportsDirectoryPicker\(windowRef\) === true/);
});

test("dataset uses existing serial importer and real activity events only",async()=>{
	const importer=await read("app/controllers/importController.js");
	assert.match(importer,/for \(const \[sourceIndex, file\] of batch\.entries\(\)\)/);
	assert.match(importer,/state: "queued"/);
	assert.match(importer,/state: "processing"/);
	assert.match(importer,/state: "staged"/);
	assert.match(importer,/state: "unsupported"/);
	assert.doesNotMatch(importer,/Promise\.all\(batch|setTimeout|setInterval/);
});
