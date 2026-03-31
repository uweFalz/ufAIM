// src/import/parsers/landXML/index.js

import { parseLandXML } from './parseLandXML.js';

export const meta = {
	id: 'landXML',
	label: 'LandXML'
};

export const sniff = {
	extensions: ['xml', 'landxml'],
	looksLike: async ({ text = '' }) => {
		return text.includes('<LandXML') || text.includes(':LandXML');
	}
};

export async function parse({ file, text, bytes, context = {} }) {
	const xmlText =
		typeof text === 'string'
			? text
			: (file && typeof file.text === 'function')
				? await file.text()
				: '';

	return parseLandXML(xmlText, file?.name ?? '');
}
