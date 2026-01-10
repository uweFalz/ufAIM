// app/transition/halfwaves/polynomial.js

// 
function polynomialSet( def0 ) {
	const def1 = [];
	def0.forEach( (ai, idx) => def1[idx-1] = ai * idx );
	const def2 = [];
	def1.forEach( (ai, idx) => def2[idx-1] = ai * idx );
	
	// console.log(def, df1, df2);
	
	return {
		f:  (t) => { let res = 0; def0.forEach( (ai, idx) => res += ai * t ** idx ); return res; },
		f1: (t) => { let res = 0; def1.forEach( (ai, idx) => res += ai * t ** idx ); return res; },
		f2: (t) => { let res = 0; def2.forEach( (ai, idx) => res += ai * t ** idx ); return res; }
	};
}

// klassische cubic halfwave
// f(0)=0, f(1)=1, f'(0)=0, f'(1)=m
export function cubicHalfWave(m = 1.5) {
	// Basisform: -t^3 + 2t^2  → f'(1)=1
	const scale = m;
	const bloss = polynomialSet( [0, 0, 3, -2] );

	return {
		f:  (t) => 2*scale * bloss.f( t/2), // (-t*t*t + 2*t*t),
		f1: (t) => 2*scale * bloss.f1(t/2), // (-3*t*t + 4*t),
		f2: (t) => 2*scale * bloss.f2(t/2)  // (-6*t + 4)
	};
}

// schiefsymmetrischer Ausgang
export function mirrorHalfWave(hw) {
	return {
		f:  (t) => 1 - hw.f( 1 - t),
		f1: (t) =>     hw.f1(1 - t),
		f2: (t) =>    -hw.f2(1 - t)
	};
}
