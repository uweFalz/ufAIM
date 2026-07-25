// src/import/parsers/technet/gndEdit/index.js

import { parseGND_XLSX } from './parseGND_XLSX.js';
import { parseGND_MDB } from './parseGND_MDB.js';

//
export const meta = {
	id: 'gndEdit',
	label: 'GND Edit'
};

//
export const sniff = {
	extensions: ['xlsx', 'xlsm', 'xls', 'mdb'],
	looksLike: async ({ file, bytes }) => {
		const name = file?.name?.toLowerCase() || '';
		const ext = name.includes('.') ? name.split('.').pop() : '';
		if (ext === 'mdb') {
			return bytes?.length >= 19 && new TextDecoder('latin1').decode(bytes.slice(4, 19)) === 'Standard Jet DB';
		}
		if (!['xlsx', 'xlsm', 'xls'].includes(ext)) {
			return false;
		}
		return name.includes('gnd');
	}
};

//
export async function parse({ file, text, bytes, context = {} }) {
	const ext = file?.name?.toLowerCase().split('.').pop();
	return ext === 'mdb'
		? await parseGND_MDB({ file, bytes, context })
		: await parseGND_XLSX({ file, text, bytes, context });
}
