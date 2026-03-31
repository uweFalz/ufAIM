// src/import/parsers/technet/vermEsn/index.js

import { parseTraGraAuto } from './parseTRA_GRA.js';

export const meta = {
	id: 'vermEsn',
	label: 'VermEsn'
};

export const sniff = {
	extensions: ['tra', 'gra'],
	looksLike: async ({ file, text = '' }) => {
		const name = file?.name?.toLowerCase() || '';

		if (name.endsWith('.tra') || name.endsWith('.gra')) return true;

		return (
			text.includes('VERM') ||
			text.includes('TRASSE') ||
			text.includes('GRADIENTE')
		);
	}
};

export async function parse({ file }) {
	return parseTraGraAuto(file);
}
