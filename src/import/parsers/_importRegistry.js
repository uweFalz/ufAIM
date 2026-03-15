// src/lib/import/importRegistry.js
// Stufe_1: Fokus auf TRA/GRA mit neuem DataSet, Rest bleibt vorerst (XML/IFC/MDB via bestehende Parser).

import { parseTra }        from './hex/traParser.js';
import { parseGra }        from './hex/graParser.js';
import { mapTraToDataSet } from './hex/mapTraToDataSet.js';
import { mapGraToDataSet } from './hex/mapGraToDataSet.js';

import { parseGndXlsx } from './mdb/gndXlsxParser.js';
import { parseMdb }     from './mdb/mdbParser.js';

// Bereits vorhandene Parser/Mapper (XML/IFC/GND …) lässt du unverändert eingebunden.
import { parseLandXml }    from './xml/landxmlParser.js';
import { parseInfraGml }   from './xml/infraGmlParser.js';
// ifc: beachte deine Umbenennung ifcAlignmentParser -> ifcXmlParser (hier nur Platzhalter)
import { parseIfcXml }     from './ifc/ifcXmlParser.js';
import { parseIfcStep }    from './ifc/ifcStepParser.js';
import { parseIfcZip }     from './ifc/ifczipParser.js';
import { parseIfcJson }    from './ifc/ifcjsonParser.js';

import { mapLandXmlToDataSet }  from './xml/mapLandXmlToDataSet.js';
import { mapInfraGmlToDataSet } from './xml/mapInfraGmlToDataSet.js';
import { mapIfcToDataSet }      from './ifc/mapIfcToDataSet.js';

// Helpers
async function getText(file){ return file._cachedText ??= await file.text(); }
async function getAB(file){   return file._cachedAB   ??= await file.arrayBuffer(); }

// Registry
export const importRegistry = [
// ---- TRA
{
	id: 'tra',
	label: 'TRA (binary)',
	canHandle: (file) => /\.tra$/i.test(file.name),
	parse: async (file) => parseTra(await getAB(file)),
	mapToDataSet: (parsed) => mapTraToDataSet(parsed, { defaultCRS: 'UNKNOWN' })
},
// ---- GRA
{
	id: 'gra',
	label: 'GRA (binary)',
	canHandle: (file) => /\.gra$/i.test(file.name),
	parse: async (file) => parseGra(await getAB(file)),
	mapToDataSet: (parsed) => mapGraToDataSet(parsed, { defaultCRS: 'UNKNOWN' })
},
// Bestehende (lassen wir vorerst unberührt; Rückgabe weiterhin dataSet-kompatibel machen, sobald wir sie anfassen)
{
	id: 'gnd-xlsx',
	label: 'GNDedit (Excel Export)',
	canHandle: (file) => /\.xlsx$/i.test(file.name),
	parse: async (file) => parseGndXlsx(file),
	toResult: (parsed, file) => ({
		format: 'GND XLSX',
		meta: { name:file.name, size:file.size, type:file.type||'(binary)', lastModified:file.lastModified, ...(parsed?.meta||{}) },
		raw: parsed?.raw ?? [],
		dataSet: parsed?.dataSet || { defaultCRS:'UNKNOWN', alignments: [] },
	}),
},
// ...
{
	id: 'gnd-mdb',
	label: 'GND MDB (binary)',
	canHandle: (file) => /\.mdb$/i.test(file.name),
	parse: async (file) => parseMdb(file),
	toResult: (parsed, file) => ({
		format: 'GND MDB',
		meta: { name:file.name, size:file.size, type:file.type||'(binary)', lastModified:file.lastModified, ...(parsed?.meta||{}) },
		raw: parsed?.raw ?? [],
		dataSet: parsed?.dataSet || { defaultCRS:'UNKNOWN', alignments: [] },
	}),
},
// ---- InfraGML
{
	id: 'infragml',
	label: 'InfraGML',
	canHandle: async (file) => {
		if (!/\.xml$/i.test(file.name)) return false;
		const txt = await getText(file);
		return /opengis\.net\/infragml/i.test(txt);
	},
	parse: async (file) => parseInfraGml(await getText(file)),
	mapToDataSet: (parsed) => mapInfraGmlToDataSet(parsed)
},

// ---- IFC XML
{
	id: 'ifcxml',
	label: 'IFC (IFCXML)',
	canHandle: async (file) => {
		if (!/\.xml$|\.ifcxml$/i.test(file.name)) return false;
		const txt = await getText(file);
		return /IfcAlignment/i.test(txt) || /ifc\.org/i.test(txt);
	},
	parse: async (file) => parseIfcXml(await getText(file)),
	mapToDataSet: (parsed) => mapIfcToDataSet(parsed)
},

// ---- IFC STEP
{
	id: 'ifc-step',
	label: 'IFC (STEP .ifc)',
	canHandle: (file) => /\.ifc$/i.test(file.name),
	parse: async (file) => parseIfcStep(await getAB(file)),
	mapToDataSet: (parsed) => mapIfcToDataSet(parsed)
},

// ---- IFC ZIP
{
	id: 'ifc-zip',
	label: 'IFCZIP (archive)',
	canHandle: (file) => /\.ifczip$/i.test(file.name),
	parse: async (file) => parseIfcZip(file),
	mapToDataSet: (parsed) => mapIfcToDataSet(parsed)
},

// ---- IFC JSON
{
	id: 'ifc-json',
	label: 'IFC (JSON)',
	canHandle: (file) => /\.ifcjson$/i.test(file.name),
	parse: async (file) => parseIfcJson(file),
	mapToDataSet: (parsed) => mapIfcToDataSet(parsed)
}
];

// Einziger offizieller Entry-Point
export async function importFile(file) {
	if (!file?.name) throw new Error('Kein Dateiname vorhanden.');
	const metaBase = {
		name: file.name, size: file.size,
		type: file.type || '(binary)', lastModified: file.lastModified
	};

	for (const h of importRegistry) {
		const ok = await h.canHandle(file);
		if (!ok) continue;

		const parsed = await h.parse(file); // { meta, raw, src }
		const dataSet = h.mapToDataSet(parsed);

		// 'raw' möglichst beibehalten, bei XML/JSON/Text liegt raw idR bereits als String vor
		const rawFallback = Array.isArray(parsed?.raw) || typeof parsed?.raw === 'string'
		? parsed.raw
		: null;

		return {
			format: h.label,
			meta: { ...metaBase, ...(parsed?.meta || {}) },
			raw: rawFallback,
			dataSet
		};
	}

	throw new Error('Unbekanntes Format. Erwartet: .TRA, .GRA, .XML (LandXML/InfraGML/IFCXML), .IFC/.IFCZIP/.IFCJSON.');
}
