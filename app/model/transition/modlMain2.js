"use strict";

// =============================
// 🔧 Utility: Vector, Angle, Curvature (Optimized & Structured)
// =============================

class ufMath {
	
	static Z2 = ufMath.bisection(   ( x ) => ( x - Math.tan(x) ), [4.5 - .1, 4.5 + .1] );
	static Z3 = ufMath.regulaFalsi( ( x ) => ( x - Math.tan(x) ), [4.5 - .1, 4.5 + .1] );
	
	/* root-of-a-function solver */
	
	static bisection( fcn, [a, b], eps = 1e-15 ) {
		
		let fa = fcn( a ), fb = fcn( b );
		
		if ( fa * fb > 0 ) return NaN;
		
		do {
			let c = ( a + b ) / 2, fc = fcn( c );
			( fa * fc < 0 ) ? [ b, fb ] = [c, fc] : [ a, fa ] = [ c, fc ];
		} while ( b - a > eps )
		
		return ( a + b ) / 2;
	}
	
	static regulaFalsi( fcn, [a, b], eps = 1e-15 ) {
		
		let fa = fcn( a ), fb = fcn( b );
		
		if ( fa * fb > 0 ) return NaN;
		
		do {
			let c = ( a * fb - b * fa ) / ( fb - fa ), fc = fcn( c );
			( fa * fc < 0 ) ? [ b, fb ] = [c, fc] : [ a, fa ] = [ c, fc ];
		} while ( b - a > eps )
		
		return ( a + b ) / 2;
	}
}

/**
* @typedef {Object} Polygon
* @property {Array} pol
*/
const PolynomialDef = {
	/*
	def = {
	pol: { sc: {}, cff: [] },
	sin: { sc: {}, cff: [] },
	cos: { sc: {}, cff: [] },
	}
	*/
	
	simplify: ( def ) => {
		switch (true) {
			case ( def.map ): {
				
				break;
			}
			case ( def.scale ): {
				
				break;
			}
			case ( def.addend ): {
				
				break;
			}
			case ( def.factor ): {
				
				break;
			}
			case ( def.compo ): {
				
				break;
			}
			case ( def.deriv ): {
				
				break;
			}
			case ( def.integ ): {
				
				break;
			}
			default: {
				return def;
				break;
			}
		}
	},
	
	clean: ( cff ) => {
		const res = [];
		cff.forEach( (ak, k) => { if ( ak != 0 ) res[k] = ak; } );
		return res;
	},
	
	add: ( cff, dff ) => {
		const tmp = [];
		cff.forEach( (ai, i) => tmp[i] = ai );
		dff.forEach( (bj, j) => ( tmp[j] ) ? tmp[j] += bj : tmp[j] = bj );
		return PolynomialDef.clean( tmp );
	},
	
	mult: ( cff, dff ) => {
		const tmp = [];
		cff.forEach( (ai, i) => {
			dff.forEach( (bj, j) => { 
				( tmp[i+j] ) ? tmp[i+j] += ai*bj : tmp[i+j] = ai*bj; 
			} )
		} );
		return PolynomialDef.clean( tmp );
	},
	
	scale: (sc, cff ) => {
		const tmp = [];
		cff.forEach( (ai, i) => tmp[i] = sc * ai );
		return PolynomialDef.clean( tmp );
	},
	
	fromFactor: ( fac ) => {
		let tmpI = [1];
		for ( let idx = 0, ll = fac.length; idx < ll; idx++ ) { 
			let tmpJ = [1]
			for ( let jdx = 1, lll = fac[idx].exp; jdx <= lll; jdx++) {
				tmpJ = PolynomialDef.mult( tmpJ, fac[idx].cff );
			}
			tmpI = PolynomialDef.mult( tmpI, tmpJ );
		}
		return PolynomialDef.clean( tmpI );
	},
	
	toFunction: ( cff ) => ( x ) => {
		let res = 0;
		cff.forEach( ( ai, i ) => res += ai * x**i );
		return res;
	},
	
	derivate: ( deg, cff, dom = [-1, 1] ) => { 
		switch ( Math.sgn(deg) ) {
			case +1: {
				const tmp = [];
				cff.forEach( (ai, i) => tmp[i-1] = ai * i );
				return PolynomialDef.derivate( deg-1, tmp, dom );
				break;
			}
			case  0: {
				return PolynomialDef.clean( cff ); 
				break;
			} 
			case -1: {
				const tmp = [];
				// map [anchr, anchor+2] --> [0, 1]
				let dff = PolynomialDef.mapp( dom, [0, 1], cff );
				// integrate
				dff.forEach( (ai, i) => tmp[i+1] = ai / (i + 1) );
				// ! F (0) == 0 !!!, also f (s) = F (s) - F (0) = F (s) - 0 = F (s) !!!
				// backmap [0, 1] --> [anchr, anchr+2]
				tmp = PolynomialDef.mapp( [0, 1], dom, tmp );
				return PolynomialDef.derivate( deg+1, tmp, dom );
				break;
			}
		}
	},
	
	derivateFromFactor: ( deg, fac, dom ) => {
		PolynomialDef.derivate( deg, Polynomial.fromFactor( fac ), dom )
	},
	
	mapp: ( [x0, x1], [s0, s1], cff ) => {
		let res = [];
		let m = ( x1 - x0 ) / ( s1 - s0 );
		let n = ( x0 * s1 - x1 * s0 ) / ( s1 - s0 );
		cff.forEach( (ai, i) => {
			res = PolynomialDef.add( res, PolynomialDef.scale( ai, PolynomialDef.fromFactor( [ { cff: [n, m], exp: i } ] ) ) );
		});
		return PolynomialDef.clean( res );
	},
	
	normalize: ( cff ) => {
		const res = [];
		// let fcn = PolynomialDef.toFunction( pol );
		let vid = 0;
		cff.forEach( (ai, i) => vid += ai );
		cff.forEach( (ai, i) => res[i] = ai / vid );
		return res;
	},
	
	normDerivateFromFactor: ( deg, fac, dom ) => { 
		PolynomialDef.normalize( PolynomialDef.derivateFromFactor( deg, fac, dom ) )
	},
	
	realVietaFormula: ( roots ) => {
		let res = [1];
		roots.forEach( (ri, i) => res = PolynomialDef.mult( res, [ri, -1] ) );
		return res;
	},
};

/**
* @typedef {Object} Vector
* @property {number} x
* @property {number} y
* @property {number} z
*/
const Vector = {
	create: (x = 0, y = 0, z = 0) => ({ x, y, z }),

	add: (vec, wec) => ({ x: vec.x + wec.x, y: vec.y + wec.y, z: vec.z + wec.z }),

	subtract: (vec, wec) => ({ x: vec.x - wec.x, y: vec.y - wec.y, z: vec.z - wec.z }),

	scale: (sc, vec) => ({ x: sc * vec.x, y: sc * vec.y, z: sc * vec.z }),

	dot: (vec, wec) => vec.x * wec.x + vec.y * wec.y + vec.z * wec.z,

	transposeXY: (vec) => ({ x: vec.y, y: -vec.x, z: vec.z }),

	toArray: (vec) => [vec.x, vec.y, vec.z],

	fromArray: ([x, y, z = 0]) => ({ x, y, z }),

	toString: (vec) => `(${vec.x.toFixed(9)}, ${vec.y.toFixed(9)}, ${vec.z.toFixed(9)})`
};

/**
* @typedef {Object} Angle
* @property {number} cos
* @property {number} sin
*/
const Angle = {
	create: (rad = 0) => ({ cos: Math.cos(rad), sin: Math.sin(rad) }),

	fromGon: (gon) => Angle.create((100 - gon) / 200 * Math.PI),
	fromDeg: (deg) => Angle.create(( 90 - deg) / 180 * Math.PI),

	toRad: (tau) => Math.atan2(tau.sin, tau.cos),

	toGon: (tau) => 100 - (Math.atan2(tau.sin, tau.cos) * 200 / Math.PI),
	toDeg: (tau) =>  90 - (Math.atan2(tau.sin, tau.cos) * 180 / Math.PI),

	add: (phi, psi) => Angle.create(Angle.toRad(phi) + Angle.toRad(psi)),

	subtract: (phi, psi) => Angle.create(Angle.toRad(phi) - Angle.toRad(psi)),

	transpose: (tau) => Angle.create(Angle.toRad(tau) + Math.PI / 2),

	scale: (sc, tau) => Vector.create(sc * tau.cos, sc * tau.sin, 0),

	rotateV2: (vec, tau) => Vector.create(
	tau.cos * vec.x - tau.sin * vec.y,
	tau.sin * vec.x + tau.cos * vec.y,
	vec.z
	),

	affTrans: (pntA, dirV, pntX) => ({
		s: Vector.dot(Vector.subtract(pntX, pntA), dirV),
		q: Vector.dot(Vector.subtract(pntX, pntA), Vector.transposeXY(dirV))
	})
};

/**
* @typedef {Object} Curvature
* @property {number} value
*/
const Curvature = {
	create: (value = 0) => ({ value }),

	getValue: (c) => c.value,

	equalsZero: (c) => c.value === 0,

	add: (a, b) => ({ value: a.value + b.value }),

	scale: (sc, c) => ({ value: sc * c.value }),

	average: (a, b) => ({ value: (a.value + b.value) / 2 }),

	partitionFill: (ka, ke, arr) => arr.map(t => ({ value: ka.value + t * (ke.value - ka.value) }))
};

console.log("✅ Structured Vector, Angle, and Curvature interfaces initialized.");

// =============================
// 📐 Preferences
// =============================

// mode 'Schwerpunkttrassierung' --> to alignmentElement
const cogRouting = { enabled: false, height: 1500., cant: 0. };

const attPrefs = {

	fatAttribute : [ "elementType", "east", "north", "gonDirectionCW", "arclength", "radiusA", "radiusE", "gonBeta200" ],

	sparseAttributes: {
		A : [ "point", "direction" ],
		C : [ "type", "arclength", "curvature", "deltaDir" ],
		E : [ "point", "direction" ]
	},
};

const transSimpleFcnDefs = {
	
	klauder: ( m, n ) => ({ // [-1, 1]: u"= ( const ) ( 1 + s )^m * s^n * ( 1 - s )^m = kpol(0, 1)
		drvDgr: 2, 
		factor: [ { cff: [-1, +1], exp: m }, { cff: [, 1], exp: n }, { cff: [+1, 1], exp: m } ],
	}),
	
	regular: ( m, n = m ) => ({ // [-1, 1]: u'= ( const ) ( 1 + s )^m * ( 1 - s )^n
		drvDgr: 1, 
		factor: [ { cff: [-1, +1], exp: m }, { cff: [+1, 1], exp: n } ],
	}),
	
	degree: ( k ) => ({ 
		factor: [ { cff: [, 1], exp: k } ] 
	}),
	
	parabola: ( k ) => ({
		factor: [ { cff: [-1, 1], exp: k } ] 
	}),

	symmRoots: ( r ) => ({  // [-1, 1]: u'= ( const ) ( 1 - s )^2 * ( r - s )^2
		// r = ±5: part of Vienna6
		// [ 0, 1]: u = 2.5*s^2 -2.5*s^4 +1*s^5
		drvDgr: 1, 
		factor: [ { cff: [-1,, 1], exp: 2 }, { cff: [-r,, 1], exp: 2 } ],
	}),
	
	sinus: ( sc, dom ) => ({ // ??????????????????????????????????
		sin: { sc: sc, cff: [ dom[0], dom[1] - dom[0] ] },
	}),
	
	cosinus: ( sc, dom ) => ({ // ????????????????????????????????
		cos: { sc: sc, cff: [ dom[0], dom[1] - dom[0] ] },
	}),
};

const transAtomCoreDefs = { // transform core.pcs -> atom.def
	/*
	... Zusammmenstellung "lebensfähiger Atomkerne" als Abb. [0, 1] -> [0, 1] oder "nur" [0, 1] -> [0, 0] !!!
	*/
	constant: { // [,]: u = 1*s^0
		sc: 1, def: transSimpleFcnDefs.degree( 0 ), 
	},
	
	clotho:    { // [,]: u = 0 + 1*s^1
		sc: 1, def: transSimpleFcnDefs.degree( 1 ), 
	},
	
	helmert:   { // ????????????????????????????????????????
		sc: 1, def: transSimpleFcnDefs.degree( 2 ),
	},
	
	bloss:     { // [ 0, 1]: u = 3*s^2 - 2*s^3 (=pol_0_1)
		sc: 1, def: transSimpleFcnDefs.regular( 1 ),
	},
	
	watorek:   { // [ 0, 1]: u = 10*s^3 -15*s^4 +6*s^5, 
		sc: 1, def: transSimpleFcnDefs.regular( 2 ),
	},
	
	spec5:     { 
		// [ 0, 1]: u = 2.5*s^2 -2.5*s^4 +1*s^5
		// [-1, 1]: u'= ( const ) s * ( 1 - s ) * ( 1 + s - s^2 )
		sc: 1, def: transSimpleFcnDefs.symmRoots( 5 ),
	},
	
	mieloko: {
		// [ 0, 1]: u = 20*s^3 -45*s^4 +36*s^5 -10*s^6
		// [-1, 1]: u'= ( const ) ( 1 + s )^2 ( 1 - s )^3
		sc: 1, def: transSimpleFcnDefs.regular( 3, 2 ),
	},
	
	mielokoINV: {
		// [ 0, 1]: u = 20*s^3 -45*s^4 +36*s^5 -10*s^6 ???
		// [-1, 1]: u'= ( const ) ( 1 + s )^2 ( 1 - s )^3
		sc: 1, def: transSimpleFcnDefs.regular( 2, 3 ),
	},
	
	vienna2: { // [ 0, 1]: u = 35s^4 -84s^5 +70s^6 -20s^7
		sc: 1, def: transSimpleFcnDefs.regular( 3 ),
	},
	
	vienna3: {
		
	},
	
	vienna4: {
		
	},
	
	vienna5: {
		
	},
	
	vienna6: {
		addend: [],
	},
	
	vienna7: { // [ 0, 1]: u = 126*s^5 -420*s^6 +540*s^7 -315*s^8 +70*s^9
		sc: 1, def: transSimpleFcnDefs.regular(4),
	},
	
	klauder01: { sc: 1, def: transSimpleFcnDefs.klauder(0, 1) },
	klauder11: { sc: 1, def: transSimpleFcnDefs.klauder(1, 1) },
	klauder21: { sc: 1, def: transSimpleFcnDefs.klauder(2, 1) },
	klauder25: { sc: 1, def: transSimpleFcnDefs.klauder(2, 5) },
	klauder29: { sc: 1, def: transSimpleFcnDefs.klauder(2, 9) },
	
	sine: { 
		addend: [ 
		{ dom: [ 0, 1           ], sc: +1 /   1            , def: transSimpleFcnDefs.degree( 1 ), },
		{ dom: [ 0, 2 * Math.PI ], sc: -1 / ( 2 * Math.PI ), def: transSimpleFcnDefs.sinus( 1, [ 0, 2 * Math.PI ] ), }
		]
	},
	
	zeroSine: {
		addend: [
		{ dom: [ -ufMath.Z2, ufMath.Z2 ], sc:  -Math.cos(ufMath.Z2) / 1, def: transSimpleFcnDefs.degree( 1 ), },
		{ dom: [          0, 1         ], sc:                     1 / 1, def: transSimpleFcnDefs.sinus( 1, [-1, 1] ), }
		],
	},
	
	cosine: {
		addend: [  
		{ dom: [ 0,      1 ], sc: +1 / 2, def: transSimpleFcnDefs.degree( 0 ), },
		{ dom: [ 0, Math.PI], sc: -1 / 2, def: transSimpleFcnDefs.sinus( 1, [ 0, Math.PI ] ), }
		],
	},
	
};

const transitionAtomDefs = {
	/*
	scaled sum of cores, 
	*/
	
	cloth: // clotho
	{ sc: 1., def: transAtomCoreDefs.degree01 },
	
	biqua: // 2nd order
	{ sc: 1., def: transAtomCoreDefs.degree02 },
	
	bloss: // 3rd order
	{ sc: 1., def: transAtomCoreDefs.degree03b },
	
	wator:
	// 5th order
	{ sc: 1., def: transAtomCoreDefs.degree05w },
	
	mieko: 
	// 6th order
	{ sc: 1., def: transAtomCoreDefs.degree06mk },
	
	kla07: [
	// 7th order
	{ sc: 1., def: transAtomCoreDefs.degree07k }
	],

	vien2: [ 
	// 7th order
	{ sc: 1., def: transAtomCoreDefs.degree07v }
	],

	vien7: [ 
	// 9th order
	{ sc: 1., def: transAtomCoreDefs.degree09v }
	],

	kla11: [
	// 11th order
	{ sc: 1., def: transAtomCoreDefs.degree11k }
	],
	
	kla15: [ 
	// 15th order
	{ sc: 1., def: transAtomCoreDefs.degree15k }
	],

	sineX: [
	// u = s - sin( 2pi * s )/(2pi)
	{ sc: +1 / 1          , def: transAtomCoreDefs.degree01 },
	{ sc: -1 / 2 * Math.PI, def: transAtomCoreDefs.sinus }
	],

	vien5: [ 
	// 15 /    (15 - pi^2)* SINE
	{ sc: { num: +1, den: 1 }, def: transAtomCoreDefs.degree01 },
	{ sc: { num: -1, den: 1 }, def: transAtomCoreDefs.sinus },
	// -pi^2 / (15 - pi^2)* WATOREK
	{ sc: { num: +1, den: 1 }, def: transAtomCoreDefs.degree05w }
	],
	
	vien3: [ 
	// 1* BLOSS
	{ sc: { num: 1, den: 1 }, def: transAtomCoreDefs.degree03b },
	/*
	... ?* nullSINUS ?????????????????????????????????????????????????????????
	*/
	{ sc: { num: 1, den: 1 }, def: transAtomCoreDefs.zeroSine }
	],

	cosin: [ 
	// u = 1/2 - 1/2 * cos(pi* s)
	{ sc: +1 / 2, def: transAtomCoreDefs.degree00 },
	{ sc: -1 / 2, def: transAtomCoreDefs.cosinus }
	],
	
	vien6: [ 
	// 10 /    ( 10 - pi^2 )* COSINE
	{ sc: { num: +1, den: 2                    }, def: transAtomCoreDefs.degree00 },
	{ sc: { num:  5, den: 2 * (10 - Math.PI^2) }, def: transAtomCoreDefs.cosinus },
	// -pi^2 / ( 10 - pi^2 )* spec5
	{ sc: { num: -Math.PI^2, den: 2 * (10 - Math.PI^2) }, def: transAtomCoreDefs.degree05v }
	],
	
	vien4: [ 
	// (1 / 4)*( -pi^2 / (12-pi^2) )* BLOSS
	{ sc: { num:  1 *1 *(-Math.PI^2), den: 1 *4*(12 - Math.PI^2) }, def: transAtomCoreDefs.degree03b },
	// (1 / 4)*(    12 / (12-pi^2) )* COSINE
	{ sc: { num: +1 *1 *3,            den: 2 *4*(12 - Math.PI^2) }, def: transAtomCoreDefs.degree00 },
	{ sc: { num: -1 *1 *3,            den: 2 *4*(12 - Math.PI^2) }, def: transAtomCoreDefs.cosinus },
	// (3 / 4)* SINE
	{ sc: { num: +1 *3,               den: 1         *4          }, def: transAtomCoreDefs.degree01 },
	{ sc: { num: -1 *3,               den: 2*Math.PI *4          }, def: transAtomCoreDefs.sinus }
	],
};

const transitionTypeDefs = {
	/*
	the three atoms-parts will be mapped into the len-crv-grid, and awaiting [0, 1]-input which will be mapped
	*/

	"Clothoid": { // aka 'Euler spiral' or 'Cornu spiral', Talbot 1899
		lenPartition: (e = 1.0) => [0, 1, 0],
		crvPartition: (e = 1.0) => [0, 0, 1, 1],
		atoms: [ 
		{ type: "cloth", dom: [0, 0], img: [0, 0] }, 
		{ type: "cloth", dom: [0, 1], img: [1, 1] }, 
		{ type: "cloth", dom: [0, 0], img: [0, 0] } 
		]
	},
	"HelmertSchramm": { // Helmert 1872, Schramm 1934
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "biqua", /* wave: 1, */ dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", /* wave: 0, */ dom: [ 0,  1], img: [ 0,  1] },
		{ type: "biqua", /* wave: 2, */ dom: [.5,  0], img: [.5,  0] } 
		]
	},
	"RuchSchuhr": { // Ruch 1903 incl. cog (Schuhr 1984 simplified)
		lenPartition: (e = 1/3) => [e, 1 - 2*e, e],
		crvPartition: (e = 1/3) => [0, 1 - 1 / (4*e), 1 / (4*e), 1],
		atoms: [ 
		{ type: "biqua", dom: [ 0, .5], img: [ 0, .5] }, 
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "biqua", dom: [.5,  0], img: [.5,  0] } 
		]
	},
	"Bloss": { // Bloss 1936
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "bloss", dom: [ 0, .5], img: [ 0, .5] }, 
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "bloss", dom: [.5,  0], img: [.5,  0] } 
		]
	},
	"Watorek": { // Watorek 1907
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "wator", dom: [ 0, .5], img: [ 0, .5] }, 
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "wator", dom: [.5,  0], img: [.5,  0] } 
		]
	},
	"MieloKoc": { // Mieloszyk & Koc 1991
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "mieko", dom: [ 0, .5], img: [ 0, .7] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "mieko", dom: [.5,  1], img: [.7,  1] }
		]
	},
	"MieloKocINV": { // Mieloszyk & Koc 1991
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .7) => [0, e, e, 1],
		atoms: [ 
		{ type: "mieko", dom: [ 1, .5], img: [ 1, .7] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "mieko", dom: [.5,  0], img: [.7,  0] }
		]
	},
	"Sine": { // Klein 1937
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "sine0", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "sine0", dom: [.5,  0], img: [.5,  0] } 
		]
	},
	"Cosine": { // Vojacec 1868
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "cosin", dom: [ 0, .5], img: [ 0, .5] }, 
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "cosin", dom: [.5,  0], img: [.5,  0] } 
		]
	},
	"Gubar": { // Gubar 1990
		lenPartition: (e = 1/3) => [e, 1 - 2*e, e],
		crvPartition: (e = 1/3) => {
			let tmp = (2*e) / ( Math.PI * (1 - 2*e) + 4*e );
			return [0, tmp, 1 - tmp, 1];
		},
		atoms: [ 
		{ type: "cosin", dom: [ 0, .5], img: [  0,  1/3] }, 
		{ type: "cloth", dom: [ 0,  1], img: [1/3,  2/3] }, 
		{ type: "cosin", dom: [.5,  0], img: [2/3,    1] } 
		]
	},
	"Klauder07": { // Klauder 2001
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "kla07", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "kla07", dom: [.5,  1], img: [.5,  0] } 
		]
	},
	"Klauder11": { // Klauder 2001
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "kla11", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "kla11", dom: [.5,  1], img: [.5,  1] } 
		]
	},
	"Klauder15": { // Klauder 2001
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "kla15", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "kla15", dom: [.5,  1], img: [.5,  0] } 
		]
	},
	"Vienna2": { // Hasslinger 2002
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "vien2", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "vien2", dom: [.5,  1], img: [.5,  1] } 
		]
	},
	"Vienna3": { // Hasslinger 2002
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "vien3", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "vien3", dom: [.5,  1], img: [.5,  1] } 
		]
	},
	"Vienna4": { // Hasslinger 2002
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "vien4", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "vien4", dom: [.5,  1], img: [.5,  1] } 
		]
	},
	"Vienna5": { // Hasslinger 2002
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "vien5", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "vien5", dom: [.5,  1], img: [.5,  1] } 
		]
	},
	"Vienna6": { // Hasslinger 2002
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "vien6", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "vien6", dom: [.5,  1], img: [.5,  1] } 
		]
	},
	"Vienna7": { // Hasslinger 2002
		lenPartition: (e = .5) => [e, 0, 1-e],
		crvPartition: (e = .5) => [0, e, e, 1],
		atoms: [ 
		{ type: "vien7", dom: [ 0, .5], img: [ 0, .5] },
		{ type: "cloth", dom: [ 0,  1], img: [ 0,  1] }, 
		{ type: "vien7", dom: [.5,  1], img: [.5,  1] } 
		]
	},
};

// =============================
// 🔃 Transition Function Generators
// =============================

const FcnGenerator = {
	
	generateYpslnFcn: ( def, [x0, x1] = [0, 1], [f0, f1] = [0, 1] ) => (sig) => {
		const sigma = x0 + (x1 - x0) * sig;
		let res = 0;
		if ( def.ccf ) def.ccf.forEach( (ai, i) => res += ai * sigma ** i );
		if ( def.sin ) res += def.sin.sc * Math.sin(def.sin.cff[0] + def.sin.cff[1] * sigma); 
		if ( def.cos ) res += def.cos.sc * Math.cos(def.cos.cff[0] + def.cos.cff[1] * sigma);
		return (res - f0) / (f1 - f0);
	},

	generateKappaFcn: ( def, [x0, x1] = [0, 1], [f0, f1] = [0, 1] ) => (sig) => {
		const sigma = x0 + (x1 - x0) * sig;
		let res = 0;
		if ( def.ccf ) def.ccf.forEach( (ai, i) => res += ai * sigma ** i );
		if ( def.sin ) res += def.sin.sc * Math.sin(def.sin.cff[0] + def.sin.cff[1] * sigma); 
		if ( def.cos ) res += def.cos.sc * Math.cos(def.cos.cff[0] + def.cos.cff[1] * sigma);
		return (res - f0) / (f1 - f0);
	},

	generateThetaFcn: ( def, [x0, x1] = [0, 1], [f0, f1] = [0, 1] ) => (sig) => {
		const sigma = x0 + (x1 - x0) * sig;
		let res = 0;
		if ( def.ccf ) def.ccf.forEach( (ai, i) => res += ( ai / (i + 1) ) * sigma ** (i + 1) );
		if ( def.sin ) res += 0;
		if ( def.cos ) res += 0.;
		return (res - f0) / (f1 - f0);
	}
};

console.log("✅ Transition function generators set up.");

// =============================
// 📏 Alignment Elements
// =============================

// =============================
// 🧱 Base Class: AlignmentElement (refactored)
// =============================

class AlignmentElement {
	constructor(A, C, E) {
		this.A = A; // { point, direction, curvature }
		this.C = C; // { type, length }
		this.E = E; // { point, direction, curvature }
	}

	update() {
		this.E = {
			point: this.getPointAt(this.C.arclength),
			direction: this.getDirecAt(this.C.arclength),
			curvature: this.getCrvtrAt(this.C.arclength)
		};
	}

	getCrvtrAt(s) {
		const sigma = s / this.C.arclength;
		const kappa = this.kappaFcn(sigma);
		const delta = (this.E.curvature.value - this.A.curvature.value) * kappa;
		return Curvature.add(this.A.curvature, Curvature.create(delta));
	}

	getDirecAt(s) {
		const sigma = s / this.C.arclength;
		const theta = this.thetaFcn(sigma);
		const delta =
		this.A.curvature.value * s +
		(this.E.curvature.value - this.A.curvature.value) * this.C.arclength * theta;
		return Angle.add(this.A.direction, Angle.create(delta));
	}

	getPointAt(s) {
		const len = this.C.arclength;
		const crvA = this.A.curvature.value;
		const crvE = this.E.curvature.value;
		const dirA = Angle.toRad(this.A.direction);

		const fnc = (t) => dirA + crvA * t + this.thetaFcn(t / len) * (crvE - crvA) * len;
		const delta = romberg.integrateFresnel(fnc, 0, s);

		return Vector.add(this.A.point, Vector.create(delta.intC, delta.intS, 0));
	}

	trForm(pntT) {
		return Vector.add(
		this.getPointAt(pntT.s),
		Angle.scale(pntT.q, this.getDirecAt(pntT.s))
		);
	}
	
	umForm(pntX) {
		const splits = 3;
		const abs = 1e-12;

		for (let idx = 0; idx < splits; idx++) {
			let sa = ((idx + 0) / splits) * this.C.arclength;
			let se = ((idx + 1) / splits) * this.C.arclength;

			let relA = Angle.affTrans(this.getPointAt(sa), Angle.scale(1., this.getDirecAt(sa)), pntX);
			let relE = Angle.affTrans(this.getPointAt(se), Angle.scale(1., this.getDirecAt(se)), pntX);

			if (relA.s <= 0 && relE.s >= 0) {
				let sc, relC;
				do {
					sc = (sa + se) / 2;
					relC = Angle.affTrans(this.getPointAt(sc), Angle.scale(1, this.getDirecAt(sc)), pntX);
					if (relC.s <= 0) sa = sc; else se = sc;
				} while (se - sa > abs);

				return { s: sc, q: relC.q };
			}
		}

		return null;
	}

	reverse() {
		return null;
	}
}

console.log("✅ AlignmentElement class refactored using structured types.");

// =============================
// 🧱 Subclasses: FixxElement and TransitionAtom
// =============================

class FixxElement extends AlignmentElement {
	constructor(A, C, E) {
		super(A, C, E);
		this.kappaFcn = () => 0;
		this.thetaFcn = () => 0;
	}

	getCrvtrAt(s) {
		return Curvature.create(this.A.curvature.value);
	}

	getDirecAt(s) {
		const rot = this.A.curvature.value * s;
		return Angle.add(this.A.direction, Angle.create(rot));
	}

	getPointAt(s) {
		const rot = this.A.curvature.value * s;
		const d = Angle.scale(s, Angle.add(this.A.direction, Angle.create(rot / 2)));
		return Vector.add(this.A.point, d);
	}
}

class TransitionAtom extends AlignmentElement {
	constructor(A, C, E, kappaFcn, thetaFcn) {
		super(A, C, E);
		this.kappaFcn = kappaFcn;
		this.thetaFcn = thetaFcn;
	}
}

console.log("✅ FixxElement and TransitionAtom refactored.");

// =============================
// 🧱 Transition: A sequence of TransitionAtoms
// =============================

class Transition extends AlignmentElement {
	constructor(A, C, E, atoms = []) {
		super(A, C, E);
		this.atoms = atoms;
	}

	update() {
		super.update();
		let pnt = this.A.point;
		let dir = this.A.direction;
		let crv = this.A.curvature;

		for (let atom of this.atoms) {
			atom.A = { point: pnt, direction: dir, curvature: crv };
			atom.update();
			pnt = atom.E.point;
			dir = atom.E.direction;
			crv = atom.E.curvature;
		}

		this.E = this.atoms.length ? this.atoms[this.atoms.length - 1].E : this.A;
	}

	getCrvtrAt(s) {
		for (let atom of this.atoms) {
			if (s <= atom.C.arclength) return atom.getCrvtrAt(s);
			s -= atom.C.arclength;
		}
		return this.atoms.length ? this.atoms[this.atoms.length - 1].getCrvtrAt(this.atoms[this.atoms.length - 1].C.arclength) : Curvature.create(0);
	}

	getDirecAt(s) {
		for (let atom of this.atoms) {
			if (s <= atom.C.arclength) return atom.getDirecAt(s);
			s -= atom.C.arclength;
		}
		return this.atoms.length ? this.atoms[this.atoms.length - 1].getDirecAt(this.atoms[this.atoms.length - 1].C.arclength) : this.A.direction;
	}

	getPointAt(s) {
		for (let atom of this.atoms) {
			if (s <= atom.C.arclength) return atom.getPointAt(s);
			s -= atom.C.arclength;
		}
		return this.atoms.length ? this.atoms[this.atoms.length - 1].getPointAt(this.atoms[this.atoms.length - 1].C.arclength) : this.A.point;
	}

	trForm(pntT) {
		for (let atom of this.atoms) {
			if (pntT.s <= atom.C.arclength) return atom.trForm(pntT);
			pntT.s -= atom.C.arclength;
		}
		return null;
	}

	umForm(pntX) {
		for (let atom of this.atoms) {
			const local = atom.umForm(pntX);
			if (local !== null) {
				let s = 0;
				for (let a of this.atoms) {
					if (a === atom) break;
					s += a.C.arclength;
				}
				return { s: s + local.s, q: local.q };
			}
		}
		return null;
	}

	reverse() {
		const revAtoms = this.atoms.map(a => a.reverse()).reverse();
		const T = new Transition(this.E, this.C, this.A, revAtoms);
		T.C.arclength = this.C.arclength;
		T.update();
		return T;
	}
}

console.log("✅ Transition class refactored.");

// =============================
// 📐 Horizontal Alignment Model (refactored)
// =============================

class HorizontalAlignmentModel {
	constructor(elements = []) {
		this.elements = elements;
	}

	addElement(element) {
		this.elements.push(element);
	}

	getPointAt(s) {
		let acc = 0;
		for (let el of this.elements) {
			if (s <= acc + el.C.arclength) return el.getPointAt(s - acc);
			acc += el.C.arclength;
		}
		return null;
	}

	getDirecAt(s) {
		let acc = 0;
		for (let el of this.elements) {
			if (s <= acc + el.C.arclength) return el.getDirecAt(s - acc);
			acc += el.C.arclength;
		}
		return null;
	}

	getCrvtrAt(s) {
		let acc = 0;
		for (let el of this.elements) {
			if (s <= acc + el.C.arclength) return el.getCrvtrAt(s - acc);
			acc += el.C.arclength;
		}
		return null;
	}

	trForm(pntT) {
		let acc = 0;
		for (let el of this.elements) {
			if (pntT.s <= el.C.arclength) return el.trForm(pntT);
			pntT.s -= el.C.arclength;
		}
		return null;
	}

	umForm(pntX) {
		let acc = 0;
		for (let el of this.elements) {
			const local = el.umForm(pntX);
			if (local !== null) return { s: acc + local.s, q: local.q };
			acc += el.C.arclength;
		}
		return null;
	}
}

console.log("✅ HorizontalAlignmentModel is ready.");

// =============================
// 📦 Model Classes
// =============================

class /* tbc */ Alignment2D {
	
	static convertFatToSparse(fatData) {
		const sparse = [];
		for (let i = 0, len = fatData.length; i < len ; i++) {
			let entry = fatData[i];
			sparse.push({
				startPoint: entry.startPoint,
				startDirection: entry.startDirection,
				arclength: entry.arclength,
				curvatureA: entry.curvatureA,
				curvatureE: entry.curvatureE || (fatData[i+1]?.curvatureA ?? [1, 0])
			});
		}
		return sparse;
	}

	static validateSparse(sparse) {
		return sparse.every(e => e.curvatureA && e.curvatureE);
	}

	elements = [];

	constructor(sparseList = []) {
		this.elements = sparseList;
	}

}

class PointDataBase {
	constructor(initialPoints = []) {
		this.pntList = [...initialPoints];
	}
}

// =============================
// 🗺️ Route Project & Alignment Conversion
// =============================

class RouteProject {
	constructor() {
		this.alignments = [];
	}

	addAlignment(alignment) {
		this.alignments.push(alignment);
	}

	convertFatToSparse(fatData) {
		const elements = [];

		for (let i = 0; i < fatData.length; i++) {
			const entry = fatData[i];

			const A = {
				point: Vector.fromArray(entry.pointA),
				direction: Angle.fromGon(entry.dirA),
				curvature: Curvature.create(entry.curvatureA)
			};
			const E = {
				point: Vector.fromArray(entry.pointE),
				direction: Angle.fromGon(entry.dirE),
				curvature: Curvature.create(entry.curvatureE)
			};

			const C = { type: entry.type, length: entry.length };

			if (entry.type === 'line' || entry.curvatureA === entry.curvatureE) {
				elements.push(new FixxElement(A, C, E));
			} else {
				const transType = prefs.transTypes[entry.transitionType];
				const partLengths = transType.lenPartition();
				const partCurvatures = transType.crvPartition(A.curvature, E.curvature);

				const atoms = partLengths.map((len, idx) => {
					const atomDef = prefs.atomDefs[transType.atoms[idx].type];
					const kappaFcn = FcnGenerator.generateKappaFcn(atomDef);
					const thetaFcn = FcnGenerator.generateThetaFcn(atomDef);

					return new TransitionAtom(null, { type: 'atom', length: len * C.length }, null, kappaFcn, thetaFcn);
				});

				elements.push(new Transition(A, C, E, atoms));
			}
		}

		return new HorizontalAlignmentModel(elements);
	}
}

console.log("✅ RouteProject and fat-to-sparse conversion initialized.");

class Model {
	constructor() {
		this.pointDB = new PointDataBase();
		this.routeProjects = [ new RouteProject() ];
	}

	set data(data) {}
	get data() {}

	handleEvent(msg) {
		console.log("Model received:", msg);
	}

	parseAlignment(fileContent) {
		console.log("Parsing alignment", fileContent);
	}
}

console.log("✅ Model setup and elements loaded.");

// =============================
// 📤 Export Utilities (Simple JSON serialization)
// =============================

function exportAlignmentJSON(alignmentModel) {
	return JSON.stringify(
	alignmentModel.elements.map(el => ({
		type: el.C.type,
		length: el.C.length,
		start: {
			x: el.A.point.x,
			y: el.A.point.y,
			dir: Angle.toGon(el.A.direction),
			k: el.A.curvature.value
		},
		end: {
			x: el.E.point.x,
			y: el.E.point.y,
			dir: Angle.toGon(el.E.direction),
			k: el.E.curvature.value
		}
	})),
	null,
	2
	);
}

// console.log("📤 Alignment JSON Export Preview:\n", exportAlignmentJSON(alignment));

// =============================
// 🎥 Three.js Hook Placeholder
// =============================

function renderAlignment3D(alignmentModel, scene) {
	alignmentModel.elements.forEach(el => {
		const points = [];
		for (let s = 0; s <= el.C.length; s += 2) {
			const p = el.getPointAt(s);
			points.push(new THREE.Vector3(p.x, p.y, p.z));
		}
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const material = new THREE.LineBasicMaterial({ color: 0xff6600 });
		const line = new THREE.Line(geometry, material);
		scene.add(line);
	});
}

console.log("🎥 Three.js hook available via renderAlignment3D(alignment, scene)");

// =============================
// 📈 JSXGraph Hook (2D Viewer + Control Points)
// =============================

function renderAlignment2D(alignmentModel, board) {
	board.removeObject(board.objectsList);

	alignmentModel.elements.forEach((el, index) => {
		const data = [];
		for (let s = 0; s <= el.C.length; s += 1) {
			const p = el.getPointAt(s);
			data.push([p.x, p.y]);
		}
		board.create('curve', [
		data.map(p => p[0]),
		data.map(p => p[1])
		], {
			strokeColor: '#0066cc',
			strokeWidth: 2,
			name: `Element ${index}`
		});

		const startPnt = el.A.point;
		const cp = board.create('point', [startPnt.x, startPnt.y], {
			name: `P${index}`,
			size: 3,
			color: '#ff0000',
			fixed: false,
			snapToGrid: true
		});

		cp.on('drag', () => {
			el.A.point = Vector.create(cp.X(), cp.Y());
			el.update();
			renderAlignment2D(alignmentModel, board);
		});
	});
}

console.log("📈 JSXGraph hook now includes control point editing.");
