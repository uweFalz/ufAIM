// validator.js (schema_v3) - fast structural validation + cycle/ref checks
// Goal: NEVER dead-loop on broken refs; always throw a readable error.

function isObj(v){return v&&typeof v==='object'&&!Array.isArray(v);} 

export function validateLookupV3(db){
	if (!isObj(db)) throw new Error('lookup: root must be an object');
	if (!isObj(db.schema)) throw new Error('lookup: missing schema');
	if (!isObj(db.simpleFcn)) throw new Error('lookup: missing simpleFcn');
	if (!isObj(db.protoFcn)) throw new Error('lookup: missing protoFcn');
	if (!isObj(db.halfWave)) throw new Error('lookup: missing halfWave');
	if (!isObj(db.transition)) throw new Error('lookup: missing transition');

	// --- validate simpleFcn nodes ---
	for (const [id, def] of Object.entries(db.simpleFcn)) {
		if (!isObj(def)) throw new Error(`simpleFcn.${id}: must be an object`);
		if (!def.op) throw new Error(`simpleFcn.${id}: missing op`);
		if (def.op==='poly') {
			if (!Array.isArray(def.coeff)) throw new Error(`simpleFcn.${id}: poly.coeff must be array`);
			continue;
		}
		if (def.op==='sin' || def.op==='cos') {
			if ('m' in def && !Number.isFinite(Number(def.m))) throw new Error(`simpleFcn.${id}: trig.m must be finite`);
			if ('n' in def && !Number.isFinite(Number(def.n))) throw new Error(`simpleFcn.${id}: trig.n must be finite`);
			continue;
		}
		if (def.op==='const') {
			if (!Number.isFinite(Number(def.value))) throw new Error(`simpleFcn.${id}: const.value must be finite`);
			continue;
		}
		if (def.op==='pi' || def.op==='2pi') continue;
		throw new Error(`simpleFcn.${id}: unsupported op '${def.op}'`);
	}

	// --- validate protoFcn ---
	for (const [id, def] of Object.entries(db.protoFcn)) {
		if (!isObj(def)) throw new Error(`protoFcn.${id}: must be an object`);
		if (def.disabled === true) {
			console.warn(`protoFcn.${id}: disabled (skipped validation)`);
			continue;
		}
		const tree = def.tree ?? def; // allow {tree:AST} or AST directly
		validateAst(tree, `protoFcn.${id}`);
	}

	// --- validate halfWave -> proto exists ---
	for (const [id, def] of Object.entries(db.halfWave)) {
		if (!isObj(def)) throw new Error(`halfWave.${id}: must be an object`);
		if (!def.proto) throw new Error(`halfWave.${id}: missing proto`);
		if (!db.protoFcn[def.proto]) throw new Error(`halfWave.${id}: proto '${def.proto}' not found`);
		if (def.source){
			const ok = ['kappa','kappa1','kappa2','kappaInt'];
			if (!ok.includes(def.source)) throw new Error(`halfWave.${id}: source must be one of ${ok.join(', ')}`);
		}
	}

	// --- validate transition -> hw exists ---
	for (const [id, def] of Object.entries(db.transition)) {
		if (!isObj(def)) throw new Error(`transition.${id}: must be an object`);
		if (!def.halfWave1 || !def.halfWave2) throw new Error(`transition.${id}: missing halfWave1/halfWave2`);
		if (!db.halfWave[def.halfWave1]) throw new Error(`transition.${id}: halfWave1 '${def.halfWave1}' not found`);
		if (!db.halfWave[def.halfWave2]) throw new Error(`transition.${id}: halfWave2 '${def.halfWave2}' not found`);
		if (def.normLengthPartition && !Array.isArray(def.normLengthPartition)) throw new Error(`transition.${id}: normLengthPartition must be array`);
	}

	// NOTE: proto-internal refs intentionally not supported yet.
	// We still ensure that all refs point to simpleFcn and exist.
	for (const [id, def] of Object.entries(db.protoFcn)) {
		if (def.disabled === true) continue;
		const tree = def.tree ?? def;
		for (const refId of collectRefIds(tree)) {
			if (!db.simpleFcn[refId]) throw new Error(`protoFcn.${id}: ref '${refId}' not found in simpleFcn`);
		}
	}

	return true;
}

function validateAst(node, path){
	if (node==null) throw new Error(`${path}: node is null/undefined`);
	if (typeof node!=='object') throw new Error(`${path}: node must be object`);
	const op = node.op;
	if (typeof op!=='string') throw new Error(`${path}: missing op`);

	if (op==='const') {
		if (!('value' in node)) throw new Error(`${path}: const.value missing`);
		if (!Number.isFinite(Number(node.value))) throw new Error(`${path}: const.value must be finite number`);
		return;
	}
	if (op==='pi' || op==='2pi') return;
	if (op==='poly') {
		if (!Array.isArray(node.coeff)) throw new Error(`${path}: poly.coeff must be array`);
		return;
	}
	if (op==='ref') {
		if (!node.id) throw new Error(`${path}: ref.id missing`);
		if (node.crop){
			if (!Array.isArray(node.crop) || node.crop.length!==2) throw new Error(`${path}: ref.crop must be [a,b]`);
			const a = Number(node.crop[0]), b = Number(node.crop[1]);
			if (!Number.isFinite(a)||!Number.isFinite(b)) throw new Error(`${path}: ref.crop entries must be finite numbers`);
		}
		return;
	}
	if (op==='neg') { validateAst(node.arg, `${path}.arg`); return; }
	if (op==='add' || op==='mul') {
		const args = node.args;
		if (!Array.isArray(args) || args.length<1) throw new Error(`${path}: ${op}.args must be array`);
		args.forEach((a,i)=>validateAst(a, `${path}.args[${i}]`));
		return;
	}
	if (op==='sub') {
		validateAst(node.minuend ?? node.a, `${path}.minuend`);
		validateAst(node.subtrahend ?? node.b, `${path}.subtrahend`);
		return;
	}
	if (op==='div') {
		validateAst(node.dividend ?? node.a, `${path}.dividend`);
		validateAst(node.divisor ?? node.b, `${path}.divisor`);
		return;
	}
	if (op==='sin' || op==='cos') {
		if (node.arg) validateAst(node.arg, `${path}.arg`);
		if ('m' in node && !Number.isFinite(Number(node.m))) throw new Error(`${path}: trig.m must be finite`);
		if ('n' in node && !Number.isFinite(Number(node.n))) throw new Error(`${path}: trig.n must be finite`);
		return;
	}
	if (op==='sc') {
		if (!Number.isFinite(Number(node.value))) throw new Error(`${path}: sc.value must be finite`);
		validateAst(node.arg, `${path}.arg`);
		return;
	}
	if (op==='pow') {
		validateAst(node.base, `${path}.base`);
		const e = node.exp;
		const ev = (typeof e==='number') ? e : (isObj(e)&&e.op==='const') ? Number(e.value) : NaN;
		if (!Number.isFinite(ev) || !Number.isInteger(ev)) throw new Error(`${path}: pow.exp must be integer number or const`);
		return;
	}
	if (op==='diff' || op==='int') {
		validateAst(node.arg, `${path}.arg`);
		return;
	}

	throw new Error(`${path}: unknown op '${op}'`);
}

function collectRefIds(node, out=new Set()){
	if (!node||typeof node!=='object') return out;
	if (node.op==='ref' && node.id) out.add(String(node.id));
	for (const k of Object.keys(node)) {
		const v = node[k];
		if (Array.isArray(v)) v.forEach(x=>collectRefIds(x,out));
		else if (v && typeof v==='object') collectRefIds(v,out);
	}
	return out;
}
