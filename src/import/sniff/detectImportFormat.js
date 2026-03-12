// src/import/sniffers.detectImportFormat.js

export function detectImportFormat(file) {

	const name = file.name.toLowerCase()

	if (name.endsWith('.xml') || name.endsWith('.landxml'))
	return 'landxml'

	if (name.endsWith('.tra'))
	return 'tra'

	if (name.endsWith('.gra'))
	return 'gra'

	if (name.endsWith('.ifc'))
	return 'ifc'

	return 'unknown'
}
