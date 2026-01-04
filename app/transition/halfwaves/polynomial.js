// app/transition/halfwaves/polynomial.js

// klassische cubic halfwave
// f(0)=0, f(1)=1, f'(0)=0, f'(1)=m
export function cubicHalfWave(m = 1.5) {
	// Basisform: -t^3 + 2t^2  → f'(1)=1
	const scale = m;

	return {
		f:  (t) => scale * (-t*t*t + 2*t*t),
		f1: (t) => scale * (-3*t*t + 4*t),
		f2: (t) => scale * (-6*t + 4)
	};
}

// schiefsymmetrischer Ausgang
export function mirrorHalfWave(hw) {
	return {
		f:  (t) => 1 - hw.f(1 - t),
		f1: (t) => hw.f1(1 - t),
		f2: (t) => -hw.f2(1 - t)
	};
}
