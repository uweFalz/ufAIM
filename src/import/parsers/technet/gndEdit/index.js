// src/import/parsers/technet/gndEdit/index.js

import { parseGND_XLSX } from './parseGND_XLSX.js';

//
export const meta = {
	id: 'gndEdit',
	label: 'GND Edit'
};

//
export const sniff = {
	extensions: ['xlsx', 'xlsm', 'xls'],
	looksLike: async ({ file }) => {
		const name = file?.name?.toLowerCase() || '';
		const ext = name.includes('.') ? name.split('.').pop() : '';
		if (!['xlsx', 'xlsm', 'xls'].includes(ext)) {
			return false;
		}
		return name.includes('gnd');
	}
};

//
export async function parse({ file, text, bytes, context = {} }) {
	return await parseGND_XLSX({ file, text, bytes, context });
}
